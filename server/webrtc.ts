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

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

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
          viewers: new Set()
        });

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

    // Viewer joins stream
    socket.on('join-stream', (data: { streamId: string, userId: string }) => {
      const { streamId, userId } = data;
      const stream = activeStreams.get(streamId);
      
      if (stream) {
        stream.viewers.add(socket.id);
        socket.join(`stream-${streamId}`);
        
        console.log(`Viewer ${userId} joined stream ${streamId}`);
        
        // Notify creator about new viewer
        socket.to(stream.creatorSocketId).emit('viewer-joined', { 
          viewerId: socket.id,
          userId: userId,
          viewerCount: stream.viewers.size 
        });

        // Send creator's stream info to new viewer
        socket.emit('stream-ready', { 
          streamId,
          creatorSocketId: stream.creatorSocketId 
        });

        // Update viewer count for all participants
        io.to(`stream-${streamId}`).emit('viewer-count-update', { 
          streamId,
          count: stream.viewers.size 
        });
      } else {
        // No active stream found
        console.log(`No active stream found for ${streamId}`);
        socket.emit('no-active-stream', { streamId });
      }
    });

    // Handle WebRTC signaling
    socket.on('offer', (data: { offer: RTCSessionDescriptionInit, targetId: string, streamId: string }) => {
      socket.to(data.targetId).emit('offer', {
        offer: data.offer,
        senderId: socket.id,
        streamId: data.streamId
      });
    });

    socket.on('answer', (data: { answer: RTCSessionDescriptionInit, targetId: string, streamId: string }) => {
      socket.to(data.targetId).emit('answer', {
        answer: data.answer,
        senderId: socket.id,
        streamId: data.streamId
      });
    });

    socket.on('ice-candidate', (data: { candidate: RTCIceCandidateInit, targetId: string, streamId: string }) => {
      socket.to(data.targetId).emit('ice-candidate', {
        candidate: data.candidate,
        senderId: socket.id,
        streamId: data.streamId
      });
    });

    // Handle chat messages
    socket.on('chat-message', (data: { streamId: string, message: string, username: string, userId: string }) => {
      // Broadcast to all users in the stream room
      io.to(`stream-${data.streamId}`).emit('chat-message', {
        message: data.message,
        username: data.username,
        userId: data.userId,
        timestamp: new Date().toISOString()
      });
    });

    // Handle tip messages
    socket.on('tip-message', (data: { streamId: string, amount: number, username: string, userId: string }) => {
      // Broadcast tip to all users in the stream room
      io.to(`stream-${data.streamId}`).emit('tip-message', {
        amount: data.amount,
        username: data.username,
        userId: data.userId,
        timestamp: new Date().toISOString()
      });
    });

    // Handle stream end
    socket.on('end-stream', (data: { streamId: string }) => {
      const stream = activeStreams.get(data.streamId);
      if (stream && stream.creatorSocketId === socket.id) {
        // Notify all viewers that stream ended
        io.to(`stream-${data.streamId}`).emit('stream-ended', { streamId: data.streamId });
        
        // Clean up
        activeStreams.delete(data.streamId);
        console.log(`Stream ${data.streamId} ended`);
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
          
          io.to(`stream-${streamId}`).emit('viewer-count-update', { 
            streamId,
            count: stream.viewers.size 
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