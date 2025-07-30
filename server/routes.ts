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
} from "@shared/schema";

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
  app.get('/api/agora/token', async (req, res) => {
    try {
      const { channelName, role, uid } = req.query;
      
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

  // Create HTTP server and setup WebRTC
  const server = createServer(app);
  
  // Setup WebRTC signaling with Socket.io
  setupWebRTC(server);

  return server;
}