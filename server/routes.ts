import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { requireAuth } from "./simpleAuth";
import authRoutes from "./authRoutes";
import { setupWebRTC } from "./webrtc";
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

  app.get('/api/streams/current', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'creator' || !user.isApproved) {
        return res.status(403).json({ message: "Only approved creators can create streams" });
      }

      const validatedData = insertStreamSchema.parse({
        ...req.body,
        creatorId: userId,
      });

      const stream = await storage.createStream(validatedData);
      
      // Set user as online when starting stream
      await storage.updateUserOnlineStatus(userId, true);
      
      res.json(stream);
    } catch (error) {
      console.error("Error creating stream:", error);
      res.status(400).json({ message: "Failed to create stream" });
    }
  });

  app.patch('/api/streams/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  // Transaction routes
  app.post('/api/transactions', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      
      const validatedData = insertChatMessageSchema.parse({
        ...req.body,
        userId,
      });

      const message = await storage.createChatMessage(validatedData);
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

  const httpServer = createServer(app);
  
  // Setup WebRTC signaling server
  setupWebRTC(httpServer);
  
  return httpServer;
}
