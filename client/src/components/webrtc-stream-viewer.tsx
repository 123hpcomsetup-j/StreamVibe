import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface WebRTCStreamViewerProps {
  streamId: string;
  socket: any;
  creatorUsername?: string;
}

export default function WebRTCStreamViewer({ streamId, socket, creatorUsername }: WebRTCStreamViewerProps) {
  const [, setLocation] = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (!socket || !streamId) return;

    const connectToStream = async () => {
      console.log('Attempting to connect to stream:', streamId);
      
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionRef.current = peerConnection;

      // Handle incoming stream
      peerConnection.ontrack = (event) => {
        console.log('Received remote track');
        const stream = event.streams[0];
        setRemoteStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setConnectionStatus('connected');
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
          setConnectionStatus('disconnected');
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', {
            candidate: event.candidate,
            targetId: 'creator',
            streamId
          });
        }
      };

      // Request to join the stream
      socket.emit('viewer-join-stream', { streamId });

      // Handle offer from creator
      socket.on('offer', async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
        console.log('Received offer from creator');
        try {
          await peerConnection.setRemoteDescription(offer);
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          
          socket.emit('answer', {
            answer,
            targetId: 'creator',
            streamId
          });
        } catch (error) {
          console.error('Failed to handle offer:', error);
          setConnectionStatus('disconnected');
        }
      });

      // Handle ICE candidates from creator
      socket.on('ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        try {
          await peerConnection.addIceCandidate(candidate);
        } catch (error) {
          console.error('Failed to add ICE candidate:', error);
        }
      });

      // Handle creator disconnection
      socket.on(`creator-stopped-${streamId}`, () => {
        console.log('Creator stopped streaming');
        setConnectionStatus('disconnected');
      });
    };

    connectToStream();

    return () => {
      // Cleanup
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      socket.emit('viewer-leave-stream', { streamId });
      socket.off('offer');
      socket.off('ice-candidate');
      socket.off(`creator-stopped-${streamId}`);
    };
  }, [socket, streamId]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
        style={{ display: connectionStatus === 'connected' ? 'block' : 'none' }}
      />
      
      {connectionStatus === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 bg-opacity-75">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-slate-400">Connecting to stream...</p>
          </div>
        </div>
      )}

      {connectionStatus === 'disconnected' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 bg-opacity-90">
          <div className="text-center">
            <WifiOff className="h-16 w-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Stream Not Available</h3>
            <p className="text-slate-400 mb-4">
              {creatorUsername || 'The creator'} is not currently streaming.
            </p>
            <Button onClick={() => setLocation("/")} className="bg-primary hover:bg-primary/80">
              Find Other Streams
            </Button>
          </div>
        </div>
      )}
      
      {/* Connection Status Badge */}
      {connectionStatus === 'connected' && (
        <div className="absolute top-4 right-4">
          <Badge className="bg-green-500">
            <Wifi className="w-3 h-3 mr-1" /> Live
          </Badge>
        </div>
      )}
    </>
  );
}