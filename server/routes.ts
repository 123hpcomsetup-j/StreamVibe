import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { requireAuth } from "./simpleAuth";
import authRoutes from "./authRoutes";
import { setupWebRTC } from "./webrtc";
import { db } from "./db";
import { streams, users } from "@shared/schema";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { eq } from "drizzle-orm";
import { 
  insertStreamSchema,
  insertTransactionSchema,
  insertTokenPurchaseSchema,
  insertReportSchema,
  insertPayoutSchema,
  insertChatMessageSchema 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Simple session setup
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
    }
  }));

  // Auth routes
  app.use('/api/auth', authRoutes);

  // Legacy logout route (redirects to home)
  app.get('/api/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
      }
      res.redirect('/');
    });
  });

  // User routes
  app.get('/api/users/online', async (req, res) => {
    try {
      const onlineUsers = await storage.getOnlineUsers();
      res.json(onlineUsers);
    } catch (error) {
      console.error("Error fetching online users:", error);
      res.status(500).json({ message: "Failed to fetch online users" });
    }
  });

  // Agora token generation endpoint
  app.post('/api/agora/token', async (req, res) => {
    try {
      const { channelName, uid, role } = req.body;
      
      const appId = process.env.VITE_AGORA_APP_ID;
      const appCertificate = process.env.AGORA_APP_CERTIFICATE;
      
      if (!appId || !appCertificate) {
        return res.status(500).json({ message: "Agora credentials not configured" });
      }
      
      // Import Agora token generator using CommonJS require
      const { RtcTokenBuilder, RtcRole } = require('agora-token');
      
      // Set token expiration time (24 hours)
      const expirationTimeInSeconds = 3600 * 24;
      const currentTimeStamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimeStamp + expirationTimeInSeconds;
      
      // Use proper Agora role constants
      const agoraRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
      
      // Generate token
      const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        uid,
        agoraRole,
        privilegeExpiredTs
      );
      
      console.log(`Generated Agora token for channel: ${channelName}, role: ${role}, uid: ${uid}`);
      res.json({ token });
    } catch (error: any) {
      console.error("Error generating Agora token:", error);
      console.error("Environment check - VITE_AGORA_APP_ID:", !!process.env.VITE_AGORA_APP_ID);
      console.error("Environment check - AGORA_APP_CERTIFICATE:", !!process.env.AGORA_APP_CERTIFICATE);
      res.status(500).json({ message: "Failed to generate token", error: error?.message || 'Unknown error' });
    }
  });

  // Stream routes
  app.get('/api/streams', async (req, res) => {
    try {
      const streams = await storage.getStreams();
      res.json(streams);
    } catch (error) {
      console.error("Error fetching streams:", error);
      res.status(500).json({ message: "Failed to fetch streams" });
    }
  });

  app.get('/api/streams/live', async (req, res) => {
    try {
      // Clean up stale streams before fetching (streams older than 2 hours)
      await storage.cleanupStaleStreams();
      const liveStreams = await storage.getLiveStreams();
      res.json(liveStreams);
    } catch (error) {
      console.error("Error fetching live streams:", error);
      res.status(500).json({ message: "Failed to fetch live streams" });
    }
  });

  app.get('/api/streams/current', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const streams = await storage.getStreams();
      const currentStream = streams.find(stream => stream.creatorId === userId && stream.isLive);
      res.json(currentStream || null);
    } catch (error) {
      console.error("Error fetching current stream:", error);
      res.status(500).json({ message: "Failed to fetch current stream" });
    }
  });

  app.post('/api/streams', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'creator' || !user.isApproved) {
        return res.status(403).json({ message: "Only approved creators can create streams" });
      }

      const validatedData = insertStreamSchema.parse({
        ...req.body,
        creatorId: userId,
      });

      // Ensure isLive is set when creating stream
      const streamData = {
        ...validatedData,
        isLive: req.body.isLive === true // Preserve the isLive field from request
      };

      const stream = await storage.createStream(streamData);
      
      // Set user as online when starting stream
      await storage.updateUserOnlineStatus(userId, true);
      
      res.json(stream);
    } catch (error) {
      console.error("Error creating stream:", error);
      res.status(400).json({ message: "Failed to create stream" });
    }
  });

  app.get('/api/streams/:id', async (req, res) => {
    try {
      const streamId = req.params.id;
      
      // Get stream with creator information - simplified query to avoid drizzle issues
      const stream = await storage.getStreamById(streamId);
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }

      // Get creator information separately
      const creator = await storage.getUser(stream.creatorId);
      
      // Combine stream and creator data
      const streamWithCreator = {
        ...stream,
        creator: creator ? {
          id: creator.id,
          username: creator.username,
          firstName: creator.firstName,
          lastName: creator.lastName,
          profileImageUrl: creator.profileImageUrl,
          role: creator.role,
        } : null
      };

      res.json(streamWithCreator);
    } catch (error) {
      console.error("Error fetching stream:", error);
      res.status(500).json({ message: "Failed to fetch stream" });
    }
  });

  app.patch('/api/streams/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const streamId = req.params.id;
      
      const stream = await storage.getStreamById(streamId);
      if (!stream || stream.creatorId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updatedStream = await storage.updateStream(streamId, req.body);
      
      // If stopping stream, set user offline
      if (req.body.isLive === false) {
        await storage.updateUserOnlineStatus(userId, false);
      }
      
      res.json(updatedStream);
    } catch (error) {
      console.error("Error updating stream:", error);
      res.status(400).json({ message: "Failed to update stream" });
    }
  });

  app.put('/api/streams/:id/settings', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const streamId = req.params.id;
      const { minTip, tokenPrice, privateRate } = req.body;
      
      const stream = await storage.getStreamById(streamId);
      if (!stream || stream.creatorId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Update stream settings
      const updatedStream = await storage.updateStream(streamId, {
        minTip: parseInt(minTip) || 5,
        tokenPrice: parseFloat(tokenPrice) || 1,
        privateRate: parseInt(privateRate) || 20,
      });
      
      res.json(updatedStream);
    } catch (error) {
      console.error("Error updating stream settings:", error);
      res.status(400).json({ message: "Failed to update stream settings" });
    }
  });

  app.delete('/api/streams/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const streamId = req.params.id;
      
      const stream = await storage.getStreamById(streamId);
      if (!stream || stream.creatorId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Properly stop the stream by setting isLive to false instead of deleting
      await storage.updateStreamStatus(streamId, false);
      
      // Set user offline when stopping stream
      await storage.updateUserOnlineStatus(userId, false);
      
      // Notify WebSocket clients about stream status change
      // This will be handled by the WebSocket server
      
      res.json({ message: "Stream stopped successfully", streamId });
    } catch (error) {
      console.error("Error stopping stream:", error);
      res.status(500).json({ message: "Failed to stop stream" });
    }
  });

  // Transaction routes
  app.post('/api/transactions', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user || (user.walletBalance || 0) < req.body.tokenAmount) {
        return res.status(400).json({ message: "Insufficient wallet balance" });
      }

      const validatedData = insertTransactionSchema.parse({
        ...req.body,
        fromUserId: userId,
      });

      // Create transaction
      const transaction = await storage.createTransaction(validatedData);
      
      // Update sender's wallet
      await storage.updateUserWallet(userId, -validatedData.tokenAmount);
      
      // Update receiver's wallet if applicable
      if (validatedData.toUserId) {
        await storage.updateUserWallet(validatedData.toUserId, validatedData.tokenAmount);
      }

      res.json(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(400).json({ message: "Failed to create transaction" });
    }
  });

  app.get('/api/transactions', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const transactions = await storage.getTransactionsByUser(userId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Token purchase routes
  app.post('/api/token-purchases', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertTokenPurchaseSchema.parse({
        ...req.body,
        userId,
      });

      const purchase = await storage.createTokenPurchase(validatedData);
      res.json(purchase);
    } catch (error) {
      console.error("Error creating token purchase:", error);
      res.status(400).json({ message: "Failed to create token purchase" });
    }
  });

  // Report routes
  app.post('/api/reports', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertReportSchema.parse({
        ...req.body,
        reportedBy: userId,
      });

      const report = await storage.createReport(validatedData);
      res.json(report);
    } catch (error) {
      console.error("Error creating report:", error);
      res.status(400).json({ message: "Failed to create report" });
    }
  });

  // Creator statistics
  app.get('/api/creator/stats', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'creator') {
        return res.status(403).json({ message: "Creator access required" });
      }

      const stats = await storage.getCreatorStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching creator stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Creator tips
  app.get('/api/creator/tips', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'creator') {
        return res.status(403).json({ message: "Creator access required" });
      }

      const tips = await storage.getCreatorTips(userId);
      res.json(tips);
    } catch (error) {
      console.error("Error fetching creator tips:", error);
      res.status(500).json({ message: "Failed to fetch tips" });
    }
  });

  // Payout routes
  app.post('/api/payouts', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'creator') {
        return res.status(403).json({ message: "Only creators can request payouts" });
      }

      const validatedData = insertPayoutSchema.parse({
        ...req.body,
        creatorId: userId,
      });

      const payout = await storage.createPayout(validatedData);
      res.json(payout);
    } catch (error) {
      console.error("Error creating payout:", error);
      res.status(400).json({ message: "Failed to create payout" });
    }
  });

  // Chat routes  
  app.get('/api/streams/:streamId/chat', async (req, res) => {
    try {
      const { streamId } = req.params;
      const messages = await storage.getChatMessages(streamId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });



  app.post('/api/streams/:streamId/chat', async (req: any, res) => {
    try {
      const { streamId } = req.params;
      const { message, tipAmount = 0, senderName } = req.body;
      const sessionId = req.headers['x-session-id'] as string;
      
      // Check for authenticated user session
      if (req.session?.userId && !req.user) {
        const user = await storage.getUser(req.session.userId);
        if (user) {
          req.user = user;
        }
      }
      
      // Check if this is a guest session
      if (sessionId && !req.user) {
        const guestSession = await storage.getGuestSession(streamId, sessionId);
        if (!guestSession) {
          return res.status(404).json({ message: "Guest session not found" });
        }
        
        if ((guestSession.tokensRemaining || 0) <= 0) {
          return res.status(403).json({ message: "No chat tokens remaining. Sign up to continue chatting!" });
        }
        
        // Get stream info to calculate token cost based on creator settings
        const stream = await storage.getStreamById(streamId);
        const tokenCost = (stream?.tokenPrice || 1); // Use creator's token price
        
        // Create chat message for guest with auto-generated name
        const chatMessage = await storage.createChatMessage({
          streamId,
          userId: null, // Guests don't have user IDs
          guestSessionId: guestSession.id, // Use guest session ID instead
          message,
          tipAmount: 0, // Guests can't tip
          senderName: guestSession.guestName || 'Guest', // Use auto-generated guest name
        });
        
        // Decrement guest tokens (1 token per message regardless of creator price)
        const newTokensRemaining = Math.max(0, (guestSession.tokensRemaining || 0) - 1);
        await storage.updateGuestSession(guestSession.id, {
          tokensRemaining: newTokensRemaining
        });
        
        // Include updated tokens in response for client
        const responseMessage = {
          ...chatMessage,
          tokensRemaining: newTokensRemaining
        };
        
        // Broadcast message to WebSocket for real-time delivery
        global.io?.to(`stream-${streamId}`).emit('chat-message', responseMessage);
        
        return res.json(responseMessage);
      }
      
      // Regular authenticated user flow
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const userId = req.user.id;
      
      // Handle tip if provided
      if (tipAmount > 0) {
        const user = await storage.getUser(userId);
        if (!user || (user.walletBalance || 0) < tipAmount) {
          return res.status(400).json({ message: "Insufficient wallet balance" });
        }
        
        // Get stream creator
        const stream = await storage.getStreamById(streamId);
        if (stream && stream.creatorId) {
          // Create transaction for tip
          await storage.createTransaction({
            fromUserId: userId,
            toUserId: stream.creatorId,
            tokenAmount: tipAmount,
            purpose: 'tip',
            streamId: streamId,
          });
          
          // Update wallets
          await storage.updateUserWallet(userId, -tipAmount);
          await storage.updateUserWallet(stream.creatorId, tipAmount);
        }
      }
      
      // Get user's real name for authenticated users
      const userForName = await storage.getUser(userId);
      const realSenderName = userForName ? `${userForName.firstName || ''} ${userForName.lastName || ''}`.trim() || userForName.username : 'User';

      // Create chat message
      const chatMessage = await storage.createChatMessage({
        streamId,
        userId,
        message,
        tipAmount,
        senderName: realSenderName || 'Anonymous',
      });
      
      // Broadcast message to WebSocket for real-time delivery
      global.io?.to(`stream-${streamId}`).emit('chat-message', chatMessage);
      
      res.json(chatMessage);
    } catch (error) {
      console.error("Error creating chat message:", error);
      res.status(400).json({ message: "Failed to create chat message" });
    }
  });

  app.get('/api/chat/:streamId', async (req, res) => {
    try {
      const { streamId } = req.params;
      
      // For featured stream, return mock data instead of database lookup
      if (streamId === 'featured') {
        const mockMessages = [
          { id: '1', message: 'Welcome to the featured stream!', userId: 'system', streamId: 'featured', createdAt: new Date() },
          { id: '2', message: 'Great content!', userId: 'user1', streamId: 'featured', createdAt: new Date() },
        ];
        return res.json(mockMessages);
      }
      
      const messages = await storage.getChatMessages(streamId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post('/api/chat', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // For featured stream, just return a mock response instead of database insert
      if (req.body.streamId === 'featured') {
        const mockMessage = {
          id: Date.now().toString(),
          message: req.body.message,
          userId: userId,
          streamId: 'featured',
          createdAt: new Date()
        };
        return res.json(mockMessage);
      }
      
      // Get user's real name for authenticated users
      const user = await storage.getUser(userId);
      const senderName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'User';

      const validatedData = insertChatMessageSchema.parse({
        ...req.body,
        userId,
        senderName, // Use real user name
      });

      const message = await storage.createChatMessage(validatedData);
      
      // Broadcast message to WebSocket for real-time delivery
      global.io?.to(`stream-${validatedData.streamId}`).emit('chat-message', message);
      
      res.json(message);
    } catch (error) {
      console.error("Error creating chat message:", error);
      res.status(400).json({ message: "Failed to create chat message" });
    }
  });

  // Admin routes
  app.get('/api/admin/pending-creators', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const pendingCreators = await storage.getPendingCreators();
      res.json(pendingCreators);
    } catch (error) {
      console.error("Error fetching pending creators:", error);
      res.status(500).json({ message: "Failed to fetch pending creators" });
    }
  });

  app.post('/api/admin/approve-creator/:userId', requireAuth, async (req: any, res) => {
    try {
      const adminUserId = req.user.id;
      const admin = await storage.getUser(adminUserId);
      
      if (admin?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userId } = req.params;
      const approvedCreator = await storage.approveCreator(userId);
      res.json(approvedCreator);
    } catch (error) {
      console.error("Error approving creator:", error);
      res.status(400).json({ message: "Failed to approve creator" });
    }
  });

  app.get('/api/admin/pending-reports', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const reports = await storage.getPendingReports();
      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  app.get('/api/admin/pending-payouts', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const payouts = await storage.getPendingPayouts();
      res.json(payouts);
    } catch (error) {
      console.error("Error fetching payouts:", error);
      res.status(500).json({ message: "Failed to fetch payouts" });
    }
  });

  app.get('/api/admin/pending-token-purchases', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const purchases = await storage.getPendingTokenPurchases();
      res.json(purchases);
    } catch (error) {
      console.error("Error fetching token purchases:", error);
      res.status(500).json({ message: "Failed to fetch token purchases" });
    }
  });

  app.post('/api/admin/approve-token-purchase/:id', requireAuth, async (req: any, res) => {
    try {
      const adminUserId = req.user.id;
      const admin = await storage.getUser(adminUserId);
      
      if (admin?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const purchase = await storage.updateTokenPurchaseStatus(id, 'approved');
      
      // Add tokens to user wallet
      await storage.updateUserWallet(purchase.userId, purchase.tokens);
      
      res.json(purchase);
    } catch (error) {
      console.error("Error approving token purchase:", error);
      res.status(400).json({ message: "Failed to approve token purchase" });
    }
  });

  // Guest session routes
  app.post("/api/guest-session", async (req, res) => {
    try {
      const { streamId, sessionId } = req.body;
      
      if (!streamId || !sessionId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check if stream exists (allow both live and ended streams for guest sessions)
      const stream = await storage.getStreamById(streamId);
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }

      // Generate random guest name
      const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const guestName = `Guest_${randomId}`;

      const guestSession = await storage.createGuestSession({
        streamId,
        sessionId,
        tokensRemaining: 100,
        viewTimeRemaining: 300, // 5 minutes
        guestName, // Store the generated name
      });

      res.json(guestSession);
    } catch (error) {
      console.error("Error creating guest session:", error);
      res.status(500).json({ message: "Failed to create guest session" });
    }
  });

  app.get("/api/guest-session/:streamId", async (req, res) => {
    try {
      const { streamId } = req.params;
      const sessionId = req.headers['x-session-id'] as string;
      
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID required" });
      }

      const guestSession = await storage.getGuestSession(streamId, sessionId);
      if (!guestSession) {
        return res.status(404).json({ message: "Guest session not found" });
      }

      res.json(guestSession);
    } catch (error) {
      console.error("Error fetching guest session:", error);
      res.status(500).json({ message: "Failed to fetch guest session" });
    }
  });

  const httpServer = createServer(app);
  
  // Setup WebRTC signaling server
  setupWebRTC(httpServer);
  
  return httpServer;
}
