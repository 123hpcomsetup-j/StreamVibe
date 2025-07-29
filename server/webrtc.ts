import { Server as SocketIOServer } from 'socket.io';
import type { Server } from 'http';
import { storage } from './storage';

interface StreamRoom {
  streamId: string;
  creatorSocketId: string;
  viewers: Set<string>;
}

const activeStreams = new Map<string, StreamRoom>();

// Make io globally available for chat broadcasting
declare global {
  var io: any;
}

export function setupWebRTC(server: Server) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    path: '/socket.io'
  });

  // Set global io for use in routes
  global.io = io;
  
  // Store active viewers for each stream
  const activeViewers = new Map<string, Set<string>>();

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    
    // Auto-identify from query params
    const userId = socket.handshake.query.userId as string;
    const role = socket.handshake.query.role as string;
    
    if (userId) {
      socket.data = { userId, role };
      console.log(`Socket ${socket.id} auto-identified as ${role} ${userId}`);
      
      // For creators, restore their active stream if any
      if (role === 'creator') {
        for (const [streamId, stream] of Array.from(activeStreams.entries())) {
          if ((stream as any).creatorUserId === userId) {
            // Update socket ID for existing stream
            stream.creatorSocketId = socket.id;
            socket.join(`stream-${streamId}`);
            console.log(`Creator ${userId} reconnected to stream ${streamId}`);
            break;
          }
        }
      }
    }
    
    // Store user ID in socket data for later reference
    socket.on('identify', (data: { userId: string }) => {
      socket.data = { userId: data.userId };
      console.log(`Socket ${socket.id} identified as user ${data.userId}`);
    });

    // Creator starts streaming
    socket.on('start-stream', async (data: { streamId: string, userId: string }) => {
      const { streamId, userId } = data;
      
      try {
        console.log(`Attempting to start stream ${streamId} for user ${userId}`);
        
        // Update stream status in database
        await storage.updateStreamStatus(streamId, true);
        console.log(`Stream ${streamId} marked as live in database`);
        
        // Create stream room
        activeStreams.set(streamId, {
          streamId,
          creatorSocketId: socket.id,
          viewers: new Set(),
          creatorUserId: userId  // Store creator user ID for reconnection
        } as any);

        socket.join(`stream-${streamId}`);
        
        console.log(`Creator ${userId} started stream ${streamId}`);
        
        // Notify all users about new live stream with real-time update
        io.emit('stream-status-changed', { 
          streamId, 
          creatorId: userId, 
          isLive: true,
          viewerCount: 0
        });
        
        // Send confirmation back to creator
        socket.emit('stream-started', { 
          streamId, 
          success: true 
        });
        
      } catch (error) {
        console.error('Error starting stream:', error);
        socket.emit('stream-error', { message: 'Failed to start stream' });
      }
    });

    // Viewer joins stream (WebRTC)
    socket.on('viewer-join-stream', async (data: { streamId: string }) => {
      const { streamId } = data;
      const viewerId = socket.id;
      
      console.log(`Viewer ${viewerId} wants to join stream ${streamId}`);
      
      // Find the creator's socket for this stream  
      const stream = activeStreams.get(streamId);
      if (stream) {
        const creatorSocket = io.sockets.sockets.get(stream.creatorSocketId);
        if (creatorSocket) {
          // Notify creator that a viewer wants to join
          creatorSocket.emit(`viewer-wants-to-join-${streamId}`, { viewerId });
          
          // Add viewer to stream
          stream.viewers.add(viewerId);
          socket.join(`stream-${streamId}`);
          
          // Update viewer count
          io.emit('stream-status-changed', {
            streamId,
            viewerCount: stream.viewers.size
          });
        } else {
          socket.emit('stream-error', { message: 'Creator not connected' });
        }
      } else {
        socket.emit('stream-error', { message: 'Stream not found' });
      }
    });

    // Viewer leaves stream
    socket.on('viewer-leave-stream', (data: { streamId: string }) => {
      const { streamId } = data;
      const viewerId = socket.id;
      
      const stream = activeStreams.get(streamId);
      if (stream) {
        stream.viewers.delete(viewerId);
        socket.leave(`stream-${streamId}`);
        
        // Notify creator
        const creatorSocket = io.sockets.sockets.get(stream.creatorSocketId);
        if (creatorSocket) {
          creatorSocket.emit(`viewer-left-${streamId}`, { viewerId });
        }
        
        // Update viewer count
        io.emit('stream-status-changed', {
          streamId,
          viewerCount: stream.viewers.size
        });
      }
    });

    // Handle WebRTC offers
    socket.on('offer', (data: { offer: any, targetId: string, streamId: string }) => {
      const targetSocket = io.sockets.sockets.get(data.targetId);
      if (targetSocket) {
        targetSocket.emit('offer', { 
          offer: data.offer, 
          senderId: socket.id,
          streamId: data.streamId
        });
      }
    });

    // Handle WebRTC answers
    socket.on('answer', (data: { answer: any, targetId: string, streamId: string }) => {
      const stream = activeStreams.get(data.streamId);
      if (stream) {
        const creatorSocket = io.sockets.sockets.get(stream.creatorSocketId);
        if (creatorSocket) {
          creatorSocket.emit('answer', { 
            answer: data.answer, 
            senderId: socket.id 
          });
        }
      }
    });

    // Handle ICE candidates
    socket.on('ice-candidate', (data: { candidate: any, targetId: string, streamId: string }) => {
      if (data.targetId === 'creator') {
        const stream = activeStreams.get(data.streamId);
        if (stream) {
          const creatorSocket = io.sockets.sockets.get(stream.creatorSocketId);
          if (creatorSocket) {
            creatorSocket.emit('ice-candidate', { 
              candidate: data.candidate, 
              senderId: socket.id 
            });
          }
        }
      } else {
        const targetSocket = io.sockets.sockets.get(data.targetId);
        if (targetSocket) {
          targetSocket.emit('ice-candidate', { 
            candidate: data.candidate, 
            senderId: socket.id 
          });
        }
      }
    });

    // Creator ready to receive viewers
    socket.on('creator-ready', (data: { streamId: string }) => {
      const { streamId } = data;
      console.log(`Creator ready for stream ${streamId}`);
      
      const stream = activeStreams.get(streamId);
      if (stream) {
        stream.creatorSocketId = socket.id;
      }
    });

    // Creator stopped streaming
    socket.on('creator-stopped', (data: { streamId: string }) => {
      const { streamId } = data;
      const stream = activeStreams.get(streamId);
      
      if (stream) {
        // Notify all viewers
        io.to(`stream-${streamId}`).emit(`creator-stopped-${streamId}`);
        
        // Clean up
        activeStreams.delete(streamId);
      }
    });

    // Join stream handler for chat
    socket.on('join-stream', async (data: { streamId: string, userId: string }) => {
      const { streamId, userId } = data;
      console.log(`User ${userId} (${socket.id}) joining stream ${streamId} for chat`);
      
      // Always join the stream room for chat, regardless of streaming status
      socket.join(`stream-${streamId}`);
      console.log(`Socket ${socket.id} joined room stream-${streamId}`);
      
      // Update or create stream tracking
      let stream = activeStreams.get(streamId);
      
      // If stream not in memory, check database and try to restore
      if (!stream) {
        try {
          const dbStream = await storage.getStreamById(streamId);
          if (dbStream) {
            // Find creator's socket by checking all connected sockets
            const creatorSocket = Array.from(io.sockets.sockets.values())
              .find(s => s.data?.userId === dbStream.creatorId);
            
            if (creatorSocket) {
              // Restore stream to activeStreams
              activeStreams.set(streamId, {
                streamId,
                creatorSocketId: creatorSocket.id,
                viewers: new Set()
              });
              stream = activeStreams.get(streamId);
              console.log(`Restored stream ${streamId} from database`);
            }
          }
        } catch (error) {
          console.error('Error checking stream status:', error);
        }
      }
      
      // If we have a stream, add user as viewer
      if (stream) {
        stream.viewers.add(socket.id);
        
        // Update viewer count and notify creator
        const viewerCount = stream.viewers.size;
        console.log(`Stream ${streamId} now has ${viewerCount} viewers`);
        
        // Notify creator of updated viewer count
        if (stream.creatorSocketId) {
          io.to(stream.creatorSocketId).emit('viewer-count-update', { 
            streamId, 
            viewerCount 
          });
        }
        
        // Broadcast viewer count to all users in the stream
        io.to(`stream-${streamId}`).emit('stream-update', { 
          streamId, 
          viewerCount,
          type: 'viewer-joined'
        });
      }
      
      // Send confirmation that user joined chat
      socket.emit('joined-stream-chat', { streamId, success: true });
    });

    // Handle chat messages
    socket.on('chat-message', (data: { streamId: string, message: string, username: string, userId: string, userType?: string }) => {
      console.log(`Chat message received from ${data.username} (${data.userType || 'user'}):`, data.message);
      
      // Broadcast to all users in the stream room (including the sender)
      const messageData = {
        message: data.message,
        username: data.username,
        userId: data.userId,
        userType: data.userType || 'user',
        timestamp: new Date().toISOString()
      };
      
      io.to(`stream-${data.streamId}`).emit('chat-message', messageData);
      console.log(`Broadcasting message to stream-${data.streamId} room`);
    });

    // Handle tip messages
    socket.on('tip-message', async (data: { streamId: string, amount: number, username: string, userId: string }) => {
      try {
        console.log(`Processing tip: ${data.username} tipping ${data.amount} tokens to stream ${data.streamId}`);
        
        // Get stream to find creator
        const stream = await storage.getStreamById(data.streamId);
        if (!stream) {
          socket.emit('tip-error', { message: 'Stream not found' });
          return;
        }

        // Get user making the tip
        const user = await storage.getUser(data.userId);
        if (!user) {
          socket.emit('tip-error', { message: 'User not found' });
          return;
        }

        // Check if user has enough balance
        if ((user.walletBalance || 0) < data.amount) {
          socket.emit('tip-error', { message: 'Insufficient wallet balance' });
          return;
        }

        // Create transaction for tip
        await storage.createTransaction({
          fromUserId: data.userId,
          toUserId: stream.creatorId,
          tokenAmount: data.amount,
          purpose: 'tip',
          streamId: data.streamId,
        });

        // Update wallets
        await storage.updateUserWallet(data.userId, -data.amount);
        await storage.updateUserWallet(stream.creatorId, data.amount);

        console.log(`✅ Tip processed: ${data.amount} tokens from ${data.username} to creator ${stream.creatorId}`);

        // Broadcast tip to all users in the stream room
        const tipData = {
          amount: data.amount,
          username: data.username,
          userId: data.userId,
          streamId: data.streamId,
          timestamp: new Date().toISOString()
        };

        io.to(`stream-${data.streamId}`).emit('tip-message', tipData);
        console.log(`Broadcasting tip notification to stream-${data.streamId} room`);

      } catch (error) {
        console.error('Error processing tip:', error);
        socket.emit('tip-error', { message: 'Failed to process tip' });
      }
    });

    // Handle stream start - when creator successfully starts broadcasting
    socket.on('start-stream', async (data: { streamId: string, userId: string }) => {
      const { streamId, userId } = data;
      
      try {
        console.log(`🚀 Creator ${userId} started broadcasting stream ${streamId}`);
        
        // Mark stream as live in database
        await storage.updateStreamStatus(streamId, true);
        
        // Update active streams tracking
        activeStreams.set(streamId, {
          streamId,
          creatorSocketId: socket.id,
          viewers: new Set()
        });
        
        // Broadcast to ALL clients that stream is now live and available
        io.emit('stream-status-changed', { 
          streamId, 
          creatorId: userId, 
          isLive: true,
          viewerCount: 0,
          message: 'Creator started broadcasting'
        });
        
        console.log(`✅ Stream ${streamId} is now live and visible to all users`);
        
      } catch (error) {
        console.error('Error starting stream:', error);
        socket.emit('stream-error', { message: 'Failed to start stream' });
      }
    });

    // Handle stream end
    socket.on('end-stream', async (data: { streamId: string }) => {
      const { streamId } = data;
      
      try {
        console.log(`🔴 Ending stream ${streamId}`);
        
        // Mark stream as not live in database
        await storage.updateStreamStatus(streamId, false);
        
        const stream = activeStreams.get(streamId);
        if (stream && stream.creatorSocketId === socket.id) {
          // Notify all viewers that stream ended
          io.to(`stream-${streamId}`).emit('stream-ended', { 
            streamId,
            message: 'Live stream has ended'
          });
          
          // Broadcast to all clients that stream is no longer live
          io.emit('stream-status-changed', { 
            streamId, 
            isLive: false,
            viewerCount: 0,
            message: 'Stream ended'
          });
          
          // Clean up
          activeStreams.delete(streamId);
          console.log(`Stream ${streamId} ended and removed from live streams`);
        }
      } catch (error) {
        console.error('Error ending stream:', error);
      }
    });

    // Creator stops streaming
    socket.on('stop-stream', async (data: { streamId: string, userId: string }) => {
      const { streamId, userId } = data;
      
      try {
        await storage.updateStreamStatus(streamId, false);
        
        const stream = activeStreams.get(streamId);
        if (stream && stream.creatorSocketId === socket.id) {
          io.to(`stream-${streamId}`).emit('stream-ended', { 
            streamId,
            message: 'Live stream has ended'
          });
          
          io.emit('stream-status-changed', { 
            streamId, 
            creatorId: userId, 
            isLive: false,
            viewerCount: 0  
          });
          
          activeStreams.delete(streamId);
          console.log(`Creator ${userId} stopped stream ${streamId}`);
        }
      } catch (error) {
        console.error('Error stopping stream:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.id}`);
      
      // Clean up streams if creator disconnected
      const streamEntries = Array.from(activeStreams.entries());
      for (const [streamId, stream] of streamEntries) {
        if (stream.creatorSocketId === socket.id) {
          try {
            await storage.updateStreamStatus(streamId, false);
            
            io.to(`stream-${streamId}`).emit('stream-ended', { 
              streamId,
              message: 'Creator disconnected. Live stream has ended.'
            });
            
            io.emit('stream-status-changed', { 
              streamId, 
              isLive: false,
              viewerCount: 0
            });
            
            activeStreams.delete(streamId);
            console.log(`Stream ${streamId} ended due to creator disconnect`);
          } catch (error) {
            console.error('Error cleaning up stream on disconnect:', error);
          }
        } else if (stream.viewers.has(socket.id)) {
          stream.viewers.delete(socket.id);
          console.log(`Removed viewer from stream ${streamId}, now has ${stream.viewers.size} viewers`);
          
          // Notify creator of updated viewer count
          if (stream.creatorSocketId) {
            io.to(stream.creatorSocketId).emit('viewer-count-update', { 
              streamId, 
              viewerCount: stream.viewers.size 
            });
          }
          
          // Broadcast viewer count to all remaining users in the stream
          io.to(`stream-${streamId}`).emit('stream-update', { 
            streamId, 
            viewerCount: stream.viewers.size,
            type: 'viewer-left'
          });
          
          io.emit('stream-status-changed', { 
            streamId, 
            isLive: true,
            viewerCount: stream.viewers.size
          });
        }
      }
    });
  });

  return io;
}