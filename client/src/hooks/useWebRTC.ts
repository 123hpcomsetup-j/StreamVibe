import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebRTCProps {
  streamId: string;
  userId: string;
  username: string;
  isCreator: boolean;
}

export function useWebRTC({ streamId, userId, username, isCreator }: UseWebRTCProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [viewerCount, setViewerCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(window.location.origin, {
      path: '/socket.io'
    });

    newSocket.on('connect', () => {
      console.log('Connected to signaling server');
      setIsConnected(true);
      setSocket(newSocket);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from signaling server');
      setIsConnected(false);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // Get user media for creators
  const startLocalStream = useCallback(async () => {
    if (!isCreator) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }, [isCreator]);

  // Create peer connection
  const createPeerConnection = useCallback((peerId: string) => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(configuration);

    // Add local stream tracks if available
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams(prev => new Map(prev.set(peerId, remoteStream)));
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          target: peerId,
          candidate: event.candidate,
          streamId
        });
      }
    };

    peersRef.current.set(peerId, peerConnection);
    return peerConnection;
  }, [localStream, socket, streamId]);

  // Start streaming (for creators)
  const startStreaming = useCallback(async () => {
    if (!isCreator || !socket) return;

    try {
      const stream = await startLocalStream();
      socket.emit('start-stream', { streamId, userId });
      return stream;
    } catch (error) {
      console.error('Failed to start streaming:', error);
      throw error;
    }
  }, [isCreator, socket, streamId, userId, startLocalStream]);

  // Join stream (for viewers)
  const joinStream = useCallback(() => {
    if (isCreator || !socket) return;

    socket.emit('viewer-join-stream', { streamId });
  }, [isCreator, socket, streamId]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    if (socket) {
      socket.emit('stop-stream', { streamId });
    }

    // Close all peer connections
    peersRef.current.forEach(peer => peer.close());
    peersRef.current.clear();

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    setRemoteStreams(new Map());
  }, [socket, streamId, localStream]);

  // Send chat message
  const sendChatMessage = useCallback((message: string) => {
    if (socket) {
      socket.emit('chat-message', {
        streamId,
        message,
        userId,
        username
      });
    }
  }, [socket, streamId, userId, username]);

  // Send tip
  const sendTip = useCallback((amount: number, message?: string) => {
    if (socket) {
      socket.emit('send-tip', {
        streamId,
        amount,
        userId,
        username,
        message
      });
    }
  }, [socket, streamId, userId, username]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.on('viewer-joined', async ({ viewerId, viewerCount: count }) => {
      if (isCreator) {
        setViewerCount(count);
        
        // Create peer connection for new viewer
        const peerConnection = createPeerConnection(viewerId);
        
        // Create and send offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('offer', {
          target: viewerId,
          offer,
          streamId
        });
      }
    });

    socket.on('stream-ready', async ({ creatorSocketId }) => {
      if (!isCreator) {
        // Viewer received stream info, wait for offer from creator
        console.log('Stream ready, waiting for offer from creator');
      }
    });

    socket.on('offer', async ({ offer, sender }) => {
      if (!isCreator) {
        const peerConnection = createPeerConnection(sender);
        
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('answer', {
          target: sender,
          answer,
          streamId
        });
      }
    });

    socket.on('answer', async ({ answer, sender }) => {
      const peerConnection = peersRef.current.get(sender);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', async ({ candidate, sender }) => {
      const peerConnection = peersRef.current.get(sender);
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on('viewer-count-update', ({ count }) => {
      setViewerCount(count);
    });

    socket.on('chat-message', (message) => {
      setChatMessages(prev => [...prev, message]);
    });

    socket.on('tip-received', (tip) => {
      setChatMessages(prev => [...prev, {
        ...tip,
        type: 'tip'
      }]);
    });

    socket.on('stream-ended', () => {
      stopStreaming();
    });

    return () => {
      socket.off('viewer-joined');
      socket.off('stream-ready');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('viewer-count-update');
      socket.off('chat-message');
      socket.off('tip-received');
      socket.off('stream-ended');
    };
  }, [socket, isCreator, createPeerConnection, streamId, stopStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  return {
    localStream,
    remoteStreams,
    viewerCount,
    isConnected,
    chatMessages,
    localVideoRef,
    startStreaming,
    joinStream,
    stopStreaming,
    sendChatMessage,
    sendTip
  };
}