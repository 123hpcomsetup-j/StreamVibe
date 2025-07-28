import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { Play, Square, Video, VideoOff, Mic, MicOff, Users, Settings, Wifi } from "lucide-react";
import { io, Socket } from 'socket.io-client';

interface LiveStreamControlsProps {
  onStreamStart?: (streamId: string) => void;
  onStreamStop?: () => void;
}

export default function LiveStreamControls({ onStreamStart, onStreamStop }: LiveStreamControlsProps) {
  const { user } = useAuth();
  const typedUser = user as any; // Type assertion for user object
  const { toast } = useToast();
  
  // Stream state
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [streamQuality, setStreamQuality] = useState<'720p' | '1080p'>('720p');
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  
  // WebRTC state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  
  // Stream configuration
  const [streamData, setStreamData] = useState({
    title: "",
    category: "Art & Design"
  });

  // WebRTC configuration with STUN servers
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('WebRTC signaling server connected');
      setConnectionStatus('connected');
      setSocket(newSocket);
    });

    newSocket.on('disconnect', () => {
      console.log('WebRTC signaling server disconnected');
      setConnectionStatus('disconnected');
    });

    newSocket.on('viewer-count-update', (data: { count: number }) => {
      setViewerCount(data.count);
    });

    newSocket.on('viewer-joined', (data: { viewerId: string, userId: string, viewerCount: number }) => {
      console.log(`New viewer joined: ${data.userId}`);
      setViewerCount(data.viewerCount);
      
      // Create peer connection for new viewer
      createPeerConnection(data.viewerId);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.close();
      }
    };
  }, []);

  // Get media stream
  const getMediaStream = async () => {
    try {
      setConnectionStatus('connecting');
      
      const constraints = {
        video: {
          width: streamQuality === '1080p' ? { ideal: 1920 } : { ideal: 1280 },
          height: streamQuality === '1080p' ? { ideal: 1080 } : { ideal: 720 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      
      // Display local stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setConnectionStatus('connected');
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setConnectionStatus('disconnected');
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          toast({
            title: "Camera/Microphone Permission Denied",
            description: "Please allow camera and microphone access to start streaming.",
            variant: "destructive"
          });
        } else if (error.name === 'NotFoundError') {
          toast({
            title: "Media Devices Not Found",
            description: "No camera or microphone found. Please connect media devices.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Media Access Error",
            description: "Failed to access camera/microphone. Please check your devices.",
            variant: "destructive"
          });
        }
      }
      throw error;
    }
  };

  // Create peer connection
  const createPeerConnection = async (viewerId: string) => {
    if (!localStream || !socket) return;

    const peerConnection = new RTCPeerConnection(rtcConfiguration);
    peersRef.current.set(viewerId, peerConnection);

    // Add local stream tracks to peer connection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          candidate: event.candidate,
          targetId: viewerId,
          streamId: currentStreamId
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
        streamId: currentStreamId
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  // Create stream mutation
  const createStreamMutation = useMutation({
    mutationFn: async (data: { title: string; category: string }) => {
      const response = await apiRequest("POST", "/api/streams", {
        title: data.title,
        category: data.category,
        isLive: true,
        streamUrl: `webrtc://${Date.now()}`,
        minTip: 5,
        privateRate: 20
      });
      return response;
    },
    onSuccess: async (streamResponse: any) => {
      const streamId = streamResponse.id;
      setCurrentStreamId(streamId);
      
      try {
        // Get media stream first
        await getMediaStream();
        
        // Start WebRTC streaming if socket is available
        if (socket && typedUser) {
          socket.emit('start-stream', {
            streamId,
            userId: typedUser.id,
            username: `${typedUser.firstName || ''} ${typedUser.lastName || ''}`.trim() || 'Creator'
          });
        }
        
        setIsStreaming(true);
        
        toast({
          title: "Live Stream Started!",
          description: "You are now broadcasting live to viewers.",
        });
        
        onStreamStart?.(streamId);
        queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      } catch (error) {
        console.error("Failed to start WebRTC stream:", error);
        toast({
          title: "Camera Access Required",
          description: "Please allow camera and microphone access to start streaming.",
          variant: "destructive"
        });
        // Clean up the stream record if WebRTC fails
        await apiRequest("PATCH", `/api/streams/${streamId}`, { isLive: false });
      }
    },
    onError: (error) => {
      toast({
        title: "Stream Creation Failed",
        description: "Failed to create stream. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Stop stream mutation
  const stopStreamMutation = useMutation({
    mutationFn: async () => {
      if (currentStreamId) {
        await apiRequest("PATCH", `/api/streams/${currentStreamId}`, { isLive: false });
      }
    },
    onSuccess: () => {
      // Stop local stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
      
      // Close all peer connections
      peersRef.current.forEach(peer => peer.close());
      peersRef.current.clear();
      
      // Notify signaling server
      if (socket && currentStreamId) {
        socket.emit('end-stream', { streamId: currentStreamId });
      }
      
      setIsStreaming(false);
      setCurrentStreamId(null);
      setViewerCount(0);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      
      toast({
        title: "Stream Ended",
        description: "Your live stream has been stopped.",
      });
      
      onStreamStop?.();
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    },
  });

  const handleStartStream = () => {
    if (!streamData.title.trim()) {
      toast({
        title: "Stream Title Required",
        description: "Please enter a title for your stream.",
        variant: "destructive",
      });
      return;
    }
    
    createStreamMutation.mutate(streamData);
  };

  const handleStopStream = () => {
    stopStreamMutation.mutate();
  };

  const getConnectionBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge className="bg-green-500"><Wifi className="h-3 w-3 mr-1" />Connected</Badge>;
      case 'connecting':
        return <Badge className="bg-yellow-500"><Wifi className="h-3 w-3 mr-1" />Connecting</Badge>;
      default:
        return <Badge variant="destructive"><Wifi className="h-3 w-3 mr-1" />Disconnected</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stream Setup */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            🔴 WebRTC Live Streaming
            {getConnectionBadge()}
          </CardTitle>
          <p className="text-slate-400">Open source live streaming using WebRTC technology</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Stream Title</Label>
              <Input
                id="title"
                placeholder="Enter stream title..."
                value={streamData.title}
                onChange={(e) => setStreamData({ ...streamData, title: e.target.value })}
                className="bg-slate-700 border-slate-600"
                disabled={isStreaming}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select 
                value={streamData.category} 
                onValueChange={(value) => setStreamData({ ...streamData, category: value })}
                disabled={isStreaming}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Art & Design">Art & Design</SelectItem>
                  <SelectItem value="Gaming">Gaming</SelectItem>
                  <SelectItem value="Music">Music</SelectItem>
                  <SelectItem value="Cooking">Cooking</SelectItem>
                  <SelectItem value="Education">Education</SelectItem>
                  <SelectItem value="Fitness">Fitness</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Stream Quality Settings */}
          <div className="space-y-2">
            <Label>Stream Quality</Label>
            <Select 
              value={streamQuality} 
              onValueChange={(value: '720p' | '1080p') => setStreamQuality(value)}
              disabled={isStreaming}
            >
              <SelectTrigger className="bg-slate-700 border-slate-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="720p">720p HD (Recommended)</SelectItem>
                <SelectItem value="1080p">1080p Full HD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Stream Status */}
          <div className="flex items-center justify-between">
            <span className="font-medium">Stream Status</span>
            <Badge className={isStreaming ? "bg-red-500" : "bg-gray-500"}>
              {isStreaming ? "🔴 LIVE" : "OFFLINE"}
            </Badge>
          </div>
          
          {isStreaming && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-700 rounded-lg p-3">
                <div className="text-slate-400 text-sm">Live Viewers</div>
                <div className="text-white text-xl font-bold flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  {viewerCount}
                </div>
              </div>
              <div className="bg-slate-700 rounded-lg p-3">
                <div className="text-slate-400 text-sm">Stream Quality</div>
                <div className="text-white text-xl font-bold">{streamQuality}</div>
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex space-x-2">
            {isStreaming ? (
              <>
                <Button 
                  onClick={handleStopStream}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  disabled={stopStreamMutation.isPending}
                >
                  <Square className="mr-2 h-4 w-4" />
                  {stopStreamMutation.isPending ? "Stopping..." : "Stop Stream"}
                </Button>
                <Button
                  variant="outline"
                  onClick={toggleVideo}
                  className="bg-slate-700 hover:bg-slate-600"
                >
                  {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  onClick={toggleAudio}
                  className="bg-slate-700 hover:bg-slate-600"
                >
                  {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                </Button>
              </>
            ) : (
              <Button 
                onClick={handleStartStream}
                disabled={createStreamMutation.isPending}
                className="w-full bg-red-500 hover:bg-red-600"
              >
                <Play className="mr-2 h-4 w-4" />
                {createStreamMutation.isPending ? "Starting Stream..." : "Go Live"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live Preview */}
      {localStream && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Live Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-64 object-cover"
              />
              {isStreaming && (
                <div className="absolute top-4 left-4">
                  <Badge className="bg-red-500 animate-pulse">
                    <div className="w-2 h-2 bg-white rounded-full mr-2"></div>
                    LIVE
                  </Badge>
                </div>
              )}
              {!isVideoEnabled && (
                <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                  <VideoOff className="h-12 w-12 text-slate-400" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}