import { Server as SocketIOServer } from 'socket.io';
import type { Server } from 'http';

interface StreamRoom {
  streamId: string;
  creatorSocketId: string;
  viewers: Set<string>;
}

const activeStreams = new Map<string, StreamRoom>();

export function setupWebRTC(server: Server) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    path: '/socket.io'
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Creator starts streaming
    socket.on('start-stream', (data: { streamId: string, userId: string }) => {
      const { streamId, userId } = data;
      
      // Create stream room
      activeStreams.set(streamId, {
        streamId,
        creatorSocketId: socket.id,
        viewers: new Set()
      });

      socket.join(`stream-${streamId}`);
      
      console.log(`Creator ${userId} started stream ${streamId}`);
      
      // Notify all users about new live stream
      socket.broadcast.emit('new-stream-available', { streamId, creatorId: userId });
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
      }
    });

    // Handle WebRTC signaling
    socket.on('offer', (data: { target: string, offer: any, streamId: string }) => {
      socket.to(data.target).emit('offer', {
        offer: data.offer,
        sender: socket.id,
        streamId: data.streamId
      });
    });

    socket.on('answer', (data: { target: string, answer: any, streamId: string }) => {
      socket.to(data.target).emit('answer', {
        answer: data.answer,
        sender: socket.id,
        streamId: data.streamId
      });
    });

    socket.on('ice-candidate', (data: { target: string, candidate: any, streamId: string }) => {
      socket.to(data.target).emit('ice-candidate', {
        candidate: data.candidate,
        sender: socket.id,
        streamId: data.streamId
      });
    });

    // Chat messages
    socket.on('chat-message', (data: { streamId: string, message: string, userId: string, username: string }) => {
      io.to(`stream-${data.streamId}`).emit('chat-message', {
        id: Date.now().toString(),
        message: data.message,
        userId: data.userId,
        username: data.username,
        timestamp: new Date().toISOString()
      });
    });

    // Handle tips
    socket.on('send-tip', (data: { streamId: string, amount: number, userId: string, username: string, message?: string }) => {
      io.to(`stream-${data.streamId}`).emit('tip-received', {
        id: Date.now().toString(),
        amount: data.amount,
        userId: data.userId,
        username: data.username,
        message: data.message || '',
        timestamp: new Date().toISOString()
      });
    });

    // Creator stops streaming
    socket.on('stop-stream', (data: { streamId: string }) => {
      const { streamId } = data;
      const stream = activeStreams.get(streamId);
      
      if (stream && stream.creatorSocketId === socket.id) {
        // Notify all viewers that stream ended
        io.to(`stream-${streamId}`).emit('stream-ended', { streamId });
        
        // Clean up
        activeStreams.delete(streamId);
        console.log(`Stream ${streamId} ended`);
      }
    });

    // Handle disconnections
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      
      // Check if disconnected user was a creator
      for (const [streamId, stream] of activeStreams.entries()) {
        if (stream.creatorSocketId === socket.id) {
          // Creator disconnected - end stream
          io.to(`stream-${streamId}`).emit('stream-ended', { streamId });
          activeStreams.delete(streamId);
          console.log(`Stream ${streamId} ended due to creator disconnect`);
        } else if (stream.viewers.has(socket.id)) {
          // Viewer disconnected - remove from viewers
          stream.viewers.delete(socket.id);
          io.to(`stream-${streamId}`).emit('viewer-count-update', { 
            streamId,
            count: stream.viewers.size 
          });
        }
      }
    });
  });

  return io;
}