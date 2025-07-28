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

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      
      // Clean up streams if creator disconnected
      for (const [streamId, stream] of activeStreams.entries()) {
        if (stream.creatorSocketId === socket.id) {
          // Notify viewers that stream ended
          io.to(`stream-${streamId}`).emit('stream-ended', { streamId });
          activeStreams.delete(streamId);
          console.log(`Stream ${streamId} ended due to creator disconnect`);
        } else if (stream.viewers.has(socket.id)) {
          // Remove viewer from stream
          stream.viewers.delete(socket.id);
          // Update viewer count
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