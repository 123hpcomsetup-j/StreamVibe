import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, VideoOff, Mic, MicOff, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StreamModalWebRTCProps {
  isOpen: boolean;
  onClose: () => void;
  streamId: string;
  socket: any;
}

export default function StreamModalWebRTC({ isOpen, onClose, streamId, socket }: StreamModalWebRTCProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [peerConnections, setPeerConnections] = useState<Map<string, RTCPeerConnection>>(new Map());

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      setLocalStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Notify server we're ready to receive viewers
      if (socket) {
        socket.emit('creator-ready', { streamId });
        setConnectionStatus('connected');
      }
    } catch (error) {
      console.error('Failed to access camera:', error);
      toast({
        title: "Camera Access Failed",
        description: "Please allow camera and microphone access to stream.",
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    // Close all peer connections
    peerConnections.forEach(pc => pc.close());
    setPeerConnections(new Map());
    
    if (socket) {
      socket.emit('creator-stopped', { streamId });
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioOn(audioTrack.enabled);
      }
    }
  };

  // Handle WebRTC signaling
  useEffect(() => {
    if (!socket || !localStream || !isOpen) return;

    // Handle new viewer joining
    socket.on(`viewer-wants-to-join-${streamId}`, async ({ viewerId }: { viewerId: string }) => {
      console.log('Viewer wants to join:', viewerId);
      
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

      const peerConnection = new RTCPeerConnection(configuration);
      
      // Add local stream tracks
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', {
            candidate: event.candidate,
            targetId: viewerId,
            streamId
          });
        }
      };

      // Create and send offer
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('offer', {
          offer,
          targetId: viewerId,
          streamId
        });

        // Store peer connection
        setPeerConnections(prev => new Map(prev).set(viewerId, peerConnection));
      } catch (error) {
        console.error('Failed to create offer:', error);
      }
    });

    // Handle answer from viewer
    socket.on('answer', async ({ answer, senderId }: { answer: RTCSessionDescriptionInit, senderId: string }) => {
      const pc = peerConnections.get(senderId);
      if (pc) {
        try {
          await pc.setRemoteDescription(answer);
          console.log('Set remote description for viewer:', senderId);
        } catch (error) {
          console.error('Failed to set remote description:', error);
        }
      }
    });

    // Handle ICE candidates from viewers
    socket.on('ice-candidate', async ({ candidate, senderId }: { candidate: RTCIceCandidateInit, senderId: string }) => {
      const pc = peerConnections.get(senderId);
      if (pc) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (error) {
          console.error('Failed to add ICE candidate:', error);
        }
      }
    });

    // Handle viewer disconnect
    socket.on(`viewer-left-${streamId}`, ({ viewerId }: { viewerId: string }) => {
      const pc = peerConnections.get(viewerId);
      if (pc) {
        pc.close();
        setPeerConnections(prev => {
          const newMap = new Map(prev);
          newMap.delete(viewerId);
          return newMap;
        });
      }
    });

    return () => {
      socket.off(`viewer-wants-to-join-${streamId}`);
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off(`viewer-left-${streamId}`);
    };
  }, [socket, localStream, streamId, peerConnections]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Live Stream Preview</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Video Preview */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            {/* Connection Status */}
            <div className="absolute top-4 right-4">
              <Badge 
                className={connectionStatus === 'connected' ? 'bg-green-500' : 'bg-yellow-500'}
              >
                {connectionStatus === 'connected' ? (
                  <><Wifi className="w-3 h-3 mr-1" /> Live</>
                ) : (
                  <><WifiOff className="w-3 h-3 mr-1" /> Connecting...</>
                )}
              </Badge>
            </div>
            
            {/* Viewer Count */}
            <div className="absolute top-4 left-4">
              <Badge className="bg-black/50">
                {peerConnections.size} viewer{peerConnections.size !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>

          {/* Stream Controls */}
          <div className="flex justify-center space-x-4">
            <Button
              variant={isVideoOn ? "default" : "destructive"}
              size="sm"
              onClick={toggleVideo}
            >
              {isVideoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </Button>
            <Button
              variant={isAudioOn ? "default" : "destructive"}
              size="sm"
              onClick={toggleAudio}
            >
              {isAudioOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>You're broadcasting live! Viewers can watch your stream in real-time.</p>
            <p>Keep this window open while streaming.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}