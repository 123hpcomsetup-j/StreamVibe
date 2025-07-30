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
import path from "path";
import { 
  insertStreamSchema,
  insertReportSchema,
  insertTokenPurchaseSchema,
  insertCreatorActivitySchema,
  insertTransactionSchema,
  insertUpiConfigSchema,
} from "@shared/schema";

// Global io declaration for WebSocket broadcasting
declare global {
  var io: any;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Simple session setup with extended persistence
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-key',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset session expiry on each request
    cookie: {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year - persist until manual logout
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

  // Serve Agora test page
  app.get('/test-agora-connection.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../test-agora-connection.html'));
  });

  // User routes
  app.get('/api/users/online', async (req, res) => {
    try {
      const onlineUsers = await storage.getOnlineUsers();
      res.json(onlineUsers);
    } catch (error) {
      console.error('Error fetching online users:', error);
      res.status(500).json({ message: "Failed to fetch online users" });
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
      const liveStreams = await storage.getLiveStreams();
      res.json(liveStreams);
    } catch (error) {
      console.error("Error fetching live streams:", error);
      res.status(500).json({ message: "Failed to fetch live streams" });
    }
  });

  // Get current stream for authenticated creator
  app.get('/api/streams/current', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'creator') {
        return res.status(403).json({ message: "Creator access required" });
      }

      // Find the latest stream created by this creator
      const streams = await storage.getStreams();
      const userStreams = streams.filter(stream => stream.creatorId === userId);
      
      if (userStreams.length === 0) {
        return res.status(404).json({ message: "Stream not found" });
      }

      // Return the most recent stream (should be the current one)
      const currentStream = userStreams[0]; // Already ordered by createdAt desc
      res.json(currentStream);
    } catch (error) {
      console.error("Error fetching current stream:", error);
      res.status(500).json({ message: "Failed to fetch current stream" });
    }
  });

  app.post('/api/streams', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'creator') {
        return res.status(403).json({ message: "Creator access required" });
      }

      if (!user.isApproved) {
        return res.status(403).json({ message: "Creator approval required. Please wait for admin approval." });
      }

      const validatedData = insertStreamSchema.parse({
        ...req.body,
        creatorId: userId,
      });

      // Create streams as NOT live initially - they become live when creator starts broadcasting
      const streamData = {
        ...validatedData,
        isLive: false // Start as not live - will be updated when creator starts broadcasting
      };

      const stream = await storage.createStream(streamData);
      
      // Set user as online when creating stream (preparing to go live)
      await storage.updateUserOnlineStatus(userId, true);
      
      console.log(`Created stream ${stream.id} for creator ${userId} - waiting for broadcast to start`);
      
      res.json(stream);
    } catch (error) {
      console.error("Error creating stream:", error);
      res.status(400).json({ message: "Failed to create stream" });
    }
  });

  app.get('/api/streams/:id', async (req, res) => {
    try {
      const streamId = req.params.id;
      
      // Get stream with creator information - simplified query
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

      console.log(`🔄 API PATCH: Updating stream ${streamId} with data:`, req.body);
      
      // Handle live status specifically
      if (req.body.isLive !== undefined) {
        await storage.updateStreamStatus(streamId, req.body.isLive);
        console.log(`✅ Stream ${streamId} status updated to isLive: ${req.body.isLive}`);
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
      
      res.json({ message: "Stream stopped successfully", streamId });
    } catch (error) {
      console.error("Error stopping stream:", error);
      res.status(500).json({ message: "Failed to stop stream" });
    }
  });

  // Get recent closed streams
  app.get("/api/streams/recent", async (req, res) => {
    try {
      const recentStreams = await storage.getRecentStreams();
      res.json(recentStreams);
    } catch (error) {
      console.error('Error fetching recent streams:', error);
      res.status(500).json({ message: "Failed to fetch recent streams" });
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

  app.get('/api/admin/reports', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const reports = await storage.getReports();
      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Agora token generation for streaming
  app.post('/api/agora/token', async (req, res) => {
    try {
      const { channelName, role, uid } = req.body;
      
      if (!channelName) {
        return res.status(400).json({ message: 'Channel name is required' });
      }

      // Import agora-token package for generating RTC tokens
      const { RtcTokenBuilder, RtcRole } = require('agora-token');
      
      const appId = process.env.VITE_AGORA_APP_ID;
      const appCertificate = process.env.AGORA_APP_CERTIFICATE;

      if (!appId || !appCertificate) {
        return res.status(500).json({ message: 'Agora credentials not configured' });
      }

      // Token expiry time (24 hours from now)
      const expirationTimeInSeconds = Math.floor(Date.now() / 1000) + 86400;
      
      // Determine role: 'host' for creators, 'audience' for viewers
      const agoraRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
      
      // Generate token
      const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName as string,
        parseInt(uid as string) || 0,
        agoraRole,
        expirationTimeInSeconds
      );

      console.log(`Generated Agora token for channel: ${channelName}, role: ${role}, uid: ${uid}`);
      
      res.json({
        token,
        appId,
        channelName,
        uid: parseInt(uid as string) || 0,
        role: agoraRole,
        expirationTime: expirationTimeInSeconds
      });
    } catch (error) {
      console.error('Error generating Agora token:', error);
      res.status(500).json({ message: 'Failed to generate token' });
    }
  });

  // ========================
  // TOKEN SYSTEM ENDPOINTS
  // ========================

  // Wallet endpoints
  app.get('/api/wallet', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      let wallet = await storage.getUserWallet(userId);
      
      if (!wallet) {
        wallet = await storage.createUserWallet(userId);
      }
      
      res.json(wallet);
    } catch (error) {
      console.error("Error fetching wallet:", error);
      res.status(500).json({ message: "Failed to fetch wallet" });
    }
  });

  // Creator activities endpoints
  app.get('/api/creator/activities', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'creator') {
        return res.status(403).json({ message: "Creator access required" });
      }
      
      const activities = await storage.getCreatorActivities(userId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching creator activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.post('/api/creator/activities', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'creator') {
        return res.status(403).json({ message: "Creator access required" });
      }

      // Check if creator already has 10 activities
      const existingActivities = await storage.getCreatorActivities(userId);
      if (existingActivities.length >= 10) {
        return res.status(400).json({ message: "Maximum 10 activities allowed per creator" });
      }
      
      const validatedData = insertCreatorActivitySchema.parse({
        ...req.body,
        creatorId: userId,
      });
      
      const activity = await storage.createCreatorActivity(validatedData);
      res.status(201).json(activity);
    } catch (error) {
      console.error("Error creating activity:", error);
      res.status(500).json({ message: "Failed to create activity" });
    }
  });

  app.put('/api/creator/activities/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'creator') {
        return res.status(403).json({ message: "Creator access required" });
      }
      
      const activityId = req.params.id;
      const updates = req.body;
      
      const activity = await storage.updateCreatorActivity(activityId, updates);
      res.json(activity);
    } catch (error) {
      console.error("Error updating activity:", error);
      res.status(500).json({ message: "Failed to update activity" });
    }
  });

  app.delete('/api/creator/activities/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'creator') {
        return res.status(403).json({ message: "Creator access required" });
      }
      
      const activityId = req.params.id;
      await storage.deleteCreatorActivity(activityId);
      res.json({ message: "Activity deleted successfully" });
    } catch (error) {
      console.error("Error deleting activity:", error);
      res.status(500).json({ message: "Failed to delete activity" });
    }
  });

  // Get creator activities for stream viewers
  app.get('/api/streams/:streamId/activities', async (req, res) => {
    try {
      const streamId = req.params.streamId;
      const stream = await storage.getStreamById(streamId);
      
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }
      
      const activities = await storage.getCreatorActivities(stream.creatorId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching stream activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // UPI configuration endpoints (Admin only)
  app.get('/api/admin/upi-config', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const config = await storage.getUpiConfig();
      res.json(config || { upiId: '', qrCodeUrl: '', isActive: false });
    } catch (error) {
      console.error("Error fetching UPI config:", error);
      res.status(500).json({ message: "Failed to fetch UPI config" });
    }
  });

  app.post('/api/admin/upi-config', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const validatedData = insertUpiConfigSchema.parse(req.body);
      const config = await storage.updateUpiConfig(validatedData);
      
      res.json(config);
    } catch (error) {
      console.error("Error updating UPI config:", error);
      res.status(500).json({ message: "Failed to update UPI config" });
    }
  });

  // Public UPI config for token purchases
  app.get('/api/upi-config', async (req, res) => {
    try {
      const config = await storage.getUpiConfig();
      if (!config) {
        return res.status(404).json({ message: "UPI not configured" });
      }
      
      // Only return public info
      res.json({
        upiId: config.upiId,
        qrCodeUrl: config.qrCodeUrl
      });
    } catch (error) {
      console.error("Error fetching public UPI config:", error);
      res.status(500).json({ message: "Failed to fetch UPI config" });
    }
  });

  // Token purchase endpoints (both singular and plural for compatibility)
  app.post('/api/token-purchase', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log(`💰 User ${userId} creating token purchase request:`, req.body);
      
      const validatedData = insertTokenPurchaseSchema.parse({
        ...req.body,
        userId,
        status: 'pending', // Ensure status is set to pending
      });
      
      console.log(`✅ Validated token purchase data:`, validatedData);
      
      const purchase = await storage.createTokenPurchase(validatedData);
      console.log(`🎯 Created token purchase:`, purchase);
      
      res.status(201).json(purchase);
    } catch (error) {
      console.error("❌ Error creating token purchase:", error);
      res.status(500).json({ message: "Failed to create token purchase request" });
    }
  });



  // Plural endpoint for compatibility with navbar token purchase
  app.post('/api/token-purchases', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log(`💰 User ${userId} creating token purchase request (plural endpoint):`, req.body);
      
      // Handle different frontend request formats
      let requestData;
      if (req.body.amount && req.body.tokens && req.body.utrNumber) {
        // User dashboard format: { amount: "100", tokens: 100, utrNumber: "123" }
        requestData = {
          requestedTokens: req.body.tokens,
          amountPaid: req.body.amount,
          utrNumber: req.body.utrNumber,
          userId,
          status: 'pending'
        };
      } else if (req.body.tokenAmount && req.body.utrNumber) {
        // Alternative user dashboard format: { tokenAmount: 100, utrNumber: "123" }
        const amount = parseFloat(req.body.tokenAmount);
        requestData = {
          requestedTokens: Math.floor(amount), // Convert to tokens (1 rupee = 1 token)
          amountPaid: req.body.tokenAmount.toString(), // Ensure string format
          utrNumber: req.body.utrNumber,
          userId,
          status: 'pending'
        };
      } else if (req.body.amount && req.body.utrNumber) {
        // Navbar format: { amount: 100, utrNumber: "123" }
        requestData = {
          requestedTokens: req.body.amount,
          amountPaid: req.body.amount.toString(),
          utrNumber: req.body.utrNumber,
          userId,
          status: 'pending'
        };
      } else {
        // Direct format: { requestedTokens: 100, amountPaid: "100", utrNumber: "123" }
        requestData = {
          ...req.body,
          userId,
          status: 'pending'
        };
      }
      
      console.log(`🎯 Mapped request data:`, requestData);
      
      const validatedData = insertTokenPurchaseSchema.parse(requestData);
      console.log(`✅ Validated token purchase data:`, validatedData);
      
      const purchase = await storage.createTokenPurchase(validatedData);
      console.log(`🎯 Created token purchase:`, purchase);
      
      res.status(201).json(purchase);
    } catch (error) {
      console.error("❌ Error creating token purchase:", error);
      res.status(500).json({ message: "Failed to create token purchase request" });
    }
  });

  app.get('/api/token-purchases', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role === 'admin') {
        // Admin sees all purchases
        const purchases = await storage.getAllTokenPurchases();
        res.json(purchases);
      } else {
        // Users see only their own purchases
        const purchases = await storage.getAllTokenPurchases();
        const userPurchases = purchases.filter(p => p.userId === userId);
        res.json(userPurchases);
      }
    } catch (error) {
      console.error("Error fetching token purchases:", error);
      res.status(500).json({ message: "Failed to fetch token purchases" });
    }
  });

  // Admin-specific endpoint for pending token purchases
  app.get('/api/admin/pending-token-purchases', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const pendingPurchases = await storage.getPendingTokenPurchases();
      console.log(`📊 Admin ${userId} requested pending purchases, found: ${pendingPurchases.length} items`);
      console.log('🎯 Pending purchases data:', JSON.stringify(pendingPurchases, null, 2));
      res.json(pendingPurchases);
    } catch (error) {
      console.error("Error fetching pending token purchases:", error);
      res.status(500).json({ message: "Failed to fetch pending token purchases" });
    }
  });

  // Admin approval/denial endpoints (both URL formats for compatibility)
  app.post('/api/admin/approve-token-purchase/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const purchaseId = req.params.id;
      const { adminNote } = req.body;
      
      console.log(`🎯 Admin ${userId} approving token purchase ${purchaseId}`);
      
      // Update purchase status
      const purchase = await storage.updateTokenPurchaseStatus(
        purchaseId, 
        'approved', 
        adminNote, 
        userId
      );
      
      console.log(`📝 Purchase updated:`, purchase);
      
      // Ensure user has a wallet first
      let wallet = await storage.getUserWallet(purchase.userId);
      if (!wallet) {
        console.log(`💰 Creating wallet for user ${purchase.userId}`);
        wallet = await storage.createUserWallet(purchase.userId);
      }
      
      // Add tokens to user wallet
      const updatedWallet = await storage.updateTokenBalance(purchase.userId, purchase.requestedTokens);
      console.log(`✅ Updated wallet:`, updatedWallet);
      
      res.json({ 
        message: "Token purchase approved and tokens added to wallet",
        tokensAdded: purchase.requestedTokens,
        newBalance: updatedWallet.tokenBalance
      });
    } catch (error) {
      console.error("Error approving token purchase:", error);
      res.status(500).json({ message: "Failed to approve token purchase" });
    }
  });

  app.post('/api/admin/token-purchases/:id/approve', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const purchaseId = req.params.id;
      const { adminNote } = req.body;
      
      console.log(`🎯 Admin ${userId} approving token purchase ${purchaseId}`);
      
      // Update purchase status
      const purchase = await storage.updateTokenPurchaseStatus(
        purchaseId, 
        'approved', 
        adminNote, 
        userId
      );
      
      console.log(`📝 Purchase updated:`, purchase);
      
      // Ensure user has a wallet first
      let wallet = await storage.getUserWallet(purchase.userId);
      if (!wallet) {
        console.log(`💰 Creating wallet for user ${purchase.userId}`);
        wallet = await storage.createUserWallet(purchase.userId);
      }
      
      // Add tokens to user wallet
      const updatedWallet = await storage.updateTokenBalance(purchase.userId, purchase.requestedTokens);
      console.log(`✅ Updated wallet:`, updatedWallet);
      
      res.json({ 
        message: "Token purchase approved and tokens added to wallet",
        tokensAdded: purchase.requestedTokens,
        newBalance: updatedWallet.tokenBalance
      });
    } catch (error) {
      console.error("Error approving token purchase:", error);
      res.status(500).json({ message: "Failed to approve token purchase" });
    }
  });

  app.post('/api/admin/token-purchases/:id/deny', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const purchaseId = req.params.id;
      const { adminNote } = req.body;
      
      await storage.updateTokenPurchaseStatus(
        purchaseId, 
        'denied', 
        adminNote, 
        userId
      );
      
      res.json({ message: "Token purchase denied" });
    } catch (error) {
      console.error("Error denying token purchase:", error);
      res.status(500).json({ message: "Failed to deny token purchase" });
    }
  });

  // Transaction endpoints (tips and activities)
  app.post('/api/transactions/tip', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { streamId, amount, message } = req.body;
      
      // Check user has enough tokens
      const wallet = await storage.getUserWallet(userId);
      if (!wallet || wallet.tokenBalance < amount) {
        return res.status(400).json({ message: "Insufficient tokens" });
      }
      
      // Get stream to find creator
      const stream = await storage.getStreamById(streamId);
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }
      
      // Get user info for display
      const user = await storage.getUser(userId);
      
      // Create transaction
      const transaction = await storage.createTransaction({
        fromUserId: userId,
        toUserId: stream.creatorId,
        streamId,
        type: 'tip',
        amount,
        message,
      });
      
      // Update wallet balances
      await storage.updateTokenBalance(userId, -amount); // Deduct from tipper
      await storage.updateTokenBalance(stream.creatorId, amount); // Add to creator
      
      // Broadcast tip to all users in the stream room (including creator)
      const tipData = {
        amount: amount,
        username: user?.username || 'Anonymous',
        userId: userId,
        streamId: streamId,
        message: message || `Tipped ${amount} tokens!`,
        timestamp: new Date().toISOString()
      };
      
      // Use global io to broadcast tip notification
      if (global.io) {
        global.io.to(`stream-${streamId}`).emit('tip-message', tipData);
        console.log(`💝 Broadcasting tip notification to stream-${streamId} room:`, tipData);
      }
      
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error processing tip:", error);
      res.status(500).json({ message: "Failed to process tip" });
    }
  });

  app.post('/api/transactions/activity', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { streamId, activityId } = req.body;
      
      // Get activity details
      const activities = await storage.getCreatorActivities(''); // We'll get it from stream
      const stream = await storage.getStreamById(streamId);
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }
      
      const creatorActivities = await storage.getCreatorActivities(stream.creatorId);
      const activity = creatorActivities.find(a => a.id === activityId);
      if (!activity || !activity.isActive) {
        return res.status(404).json({ message: "Activity not found or inactive" });
      }
      
      // Check user has enough tokens
      const wallet = await storage.getUserWallet(userId);
      if (!wallet || wallet.tokenBalance < activity.tokenCost) {
        return res.status(400).json({ message: "Insufficient tokens" });
      }
      
      // Create transaction
      const transaction = await storage.createTransaction({
        fromUserId: userId,
        toUserId: stream.creatorId,
        streamId,
        type: 'activity',
        amount: activity.tokenCost,
        activityId,
        message: `Used activity: ${activity.name}`,
      });
      
      // Update wallet balances
      await storage.updateTokenBalance(userId, -activity.tokenCost);
      await storage.updateTokenBalance(stream.creatorId, activity.tokenCost);
      
      // Broadcast activity to all users in the stream room (including creator)
      const user = await storage.getUser(userId);
      const activityData = {
        amount: activity.tokenCost,
        username: user?.username || 'Anonymous',
        userId: userId,
        streamId: streamId,
        message: `Used activity: ${activity.name}`,
        activityName: activity.name,
        timestamp: new Date().toISOString()
      };
      
      // Use global io to broadcast activity notification
      if (global.io) {
        global.io.to(`stream-${streamId}`).emit('tip-message', activityData);
        console.log(`🎯 Broadcasting activity notification to stream-${streamId} room:`, activityData);
      }
      
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error processing activity:", error);
      res.status(500).json({ message: "Failed to process activity" });
    }
  });

  // Get stream transactions (for creators to see their earnings)
  app.get('/api/streams/:streamId/transactions', requireAuth, async (req: any, res) => {
    try {
      const streamId = req.params.streamId;
      const transactions = await storage.getStreamTransactions(streamId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching stream transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Create HTTP server and setup WebRTC
  const server = createServer(app);
  
  // Setup WebRTC signaling with Socket.io
  setupWebRTC(server);

  return server;
}