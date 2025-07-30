import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Volume2, VolumeX, Send, MessageCircle, Phone, Video as VideoIcon, ArrowLeft, Coins } from "lucide-react";
import { io, Socket } from 'socket.io-client';
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import AgoraRTC, {
  IAgoraRTCClient,
  IRemoteVideoTrack,
  IRemoteAudioTrack,
  UID
} from "agora-rtc-sdk-ng";
import StreamChat from "./stream-chat";

interface AgoraStreamViewerProps {
  streamId: string;
  userId: string;
  username: string;
  creatorName: string;
  title: string;
}

export default function AgoraStreamViewer({
  streamId,
  userId,
  username,
  creatorName,
  title
}: AgoraStreamViewerProps) {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const { user, isAuthenticated } = useAuth();
  const typedUser = user as any;
  
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<IRemoteVideoTrack | null>(null);
  const remoteAudioRef = useRef<IRemoteAudioTrack | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Device compatibility check
  useEffect(() => {
    const checkDeviceCompatibility = async () => {
      try {
        // Check if browser supports WebRTC
        if (!AgoraRTC.checkSystemRequirements()) {
          toast({
            title: "Browser Not Supported",
            description: "Your browser doesn't support live streaming. Please use Chrome, Firefox, Safari, or Edge.",
            variant: "destructive",
          });
          return;
        }

        // Check for mobile devices and adjust codec
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const codec = isMobile ? "h264" : "vp8"; // H.264 is better for mobile devices
        
        console.log(`Device: ${isMobile ? 'Mobile' : 'Desktop'}, Using codec: ${codec}`);
        
        const client = AgoraRTC.createClient({ 
          mode: "live", 
          codec: codec as "vp8" | "h264"
        });
        clientRef.current = client;

        // Set client role to audience (viewer)
        client.setClientRole("audience");
        
      } catch (error) {
        console.error("Device compatibility check failed:", error);
        toast({
          title: "Compatibility Error",
          description: "Unable to initialize streaming on this device.",
          variant: "destructive",
        });
      }
    };

    checkDeviceCompatibility();
  }, []);

  // Initialize Agora client event handlers
  useEffect(() => {
    if (!clientRef.current) return;

    const client = clientRef.current;

    // Handle remote user events
    client.on("user-published", async (user, mediaType) => {
      console.log("🎉 🎥 CREATOR IS BROADCASTING!", mediaType, "from user:", user.uid);
      console.log("🎯 Channel:", clientRef.current?.channelName);
      console.log("📊 Current viewer state:", { isConnected, hasVideo, connectionState: clientRef.current?.connectionState });
      
      try {
        // Check if client is still connected before subscribing
        if (client.connectionState !== "CONNECTED") {
          console.log("⚠️ Client not connected, skipping subscription. State:", client.connectionState);
          return;
        }
        
        // Subscribe to the remote user
        await client.subscribe(user, mediaType);
        console.log("✅ Successfully subscribed to creator:", mediaType);
        console.log("📱 User object:", user);
        
        if (mediaType === "video") {
          const remoteVideoTrack = user.videoTrack;
          console.log("📺 Video track received:", !!remoteVideoTrack);
          console.log("🎥 Video container available:", !!videoContainerRef.current);
          
          if (remoteVideoTrack && videoContainerRef.current) {
            console.log("🎬 Starting video playback...");
            
            // Clear any existing content in video container safely
            try {
              if (videoContainerRef.current.firstChild) {
                videoContainerRef.current.innerHTML = '';
              }
            } catch (clearError) {
              console.log("Note: Could not clear video container, continuing...");
            }
            
            // Configure video playback for maximum compatibility
            const playConfig = {
              fit: "cover" as const,
              mirror: false
            };
            
            try {
              remoteVideoTrack.play(videoContainerRef.current, playConfig);
              remoteVideoRef.current = remoteVideoTrack;
              setHasVideo(true);
              setIsLoading(false);
              
              console.log("✅ VIDEO SUCCESSFULLY PLAYING");
              
              toast({
                title: "Creator is live!",
                description: "Video stream connected successfully",
              });
            } catch (playError) {
              console.error("❌ Error playing video:", playError);
              toast({
                title: "Video Playback Error", 
                description: "Unable to display video stream",
                variant: "destructive",
              });
            }
          } else {
            console.log("❌ Missing video track or container:", {
              hasTrack: !!remoteVideoTrack,
              hasContainer: !!videoContainerRef.current
            });
          }
        }
        
        if (mediaType === "audio") {
          const remoteAudioTrack = user.audioTrack;
          if (remoteAudioTrack) {
            console.log("🔊 Playing creator audio stream");
            remoteAudioTrack.play();
            remoteAudioRef.current = remoteAudioTrack;
          }
        }
      } catch (error) {
        console.error("❌ Error subscribing to creator stream:", error);
        console.log("📊 Error details:", {
          errorCode: (error as any)?.code,
          errorMessage: (error as any)?.message,
          mediaType,
          userId: user.uid
        });
        toast({
          title: "Stream Connection Error",
          description: `Failed to connect to creator's ${mediaType}: ${(error as any)?.message || 'Unknown error'}`,
          variant: "destructive",
        });
      }
    });

    client.on("user-unpublished", (user, mediaType) => {
      console.log("Creator stopped broadcasting:", mediaType);
      
      if (mediaType === "video") {
        setHasVideo(false);
        // Clean up video track and container safely
        if (remoteVideoRef.current) {
          try {
            remoteVideoRef.current.stop();
          } catch (error) {
            console.log("Note: Video track stop skipped");
          }
          remoteVideoRef.current = null;
        }
        
        if (videoContainerRef.current) {
          try {
            videoContainerRef.current.innerHTML = '';
          } catch (error) {
            console.log("Note: Video container clear skipped");
          }
        }
      }
      
      if (mediaType === "audio") {
        if (remoteAudioRef.current) {
          try {
            remoteAudioRef.current.stop();
          } catch (error) {
            console.log("Note: Audio track stop skipped");
          }
          remoteAudioRef.current = null;
        }
      }
    });

    client.on("user-joined", (user) => {
      setViewerCount(prev => prev + 1);
    });

    client.on("user-left", (user) => {
      setViewerCount(prev => Math.max(0, prev - 1));
    });

    // Connect to stream
    connectToStream();

    return () => {
      disconnect();
    };
  }, [streamId]);

  // Initialize WebSocket for live chat
  useEffect(() => {
    if (!streamId) return;

    const newSocket = io({
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Chat connected to WebSocket');
      newSocket.emit('join-stream', { streamId, userId: typedUser?.id || 'guest' });
    });

    newSocket.on('chat-message', (messageData: any) => {
      setChatMessages(prev => [...prev, messageData]);
    });

    newSocket.on('stream-ended', () => {
      toast({
        title: "Stream Ended",
        description: "The creator has ended the stream.",
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [streamId, typedUser?.id]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Video streaming focus - chat handled by StreamChat component

  const connectToStream = async () => {
    if (!clientRef.current) return;

    try {
      setIsLoading(true);
      
      // Check if we have Agora App ID
      const appId = import.meta.env.VITE_AGORA_APP_ID;
      if (!appId) {
        toast({
          title: "Configuration Error",
          description: "Agora App ID not configured. Please contact support.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Use exact same channel name format as creator - keep original streamId format
      let channelName = streamId;
      if (!channelName || channelName.trim() === "" || channelName === "undefined") {
        channelName = `stream_${Date.now()}`;
      }
      
      // Only ensure reasonable length, keep original format to match creator
      channelName = channelName
        .substring(0, 64);
      
      if (!channelName) {
        channelName = `stream_${Date.now()}`;
      }
      
      // Convert string userId to number (same format as creator) for consistent Agora connections
      const numericUserId = Math.abs(userId.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0));
      
      console.log('=== VIEWER JOIN ATTEMPT ===');
      console.log('Original User ID:', userId);
      console.log('Numeric User ID:', numericUserId);
      console.log('Channel Name:', channelName);
      console.log('App ID:', appId);
      
      // Get Agora token from backend with numeric ID
      const tokenResponse = await fetch('/api/agora/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelName,
          uid: numericUserId,
          role: 'audience'
        }),
      });
      
      if (!tokenResponse.ok) {
        throw new Error('Failed to get Agora token');
      }
      
      const { token } = await tokenResponse.json();
      console.log('Got Agora token (first 20 chars):', token.substring(0, 20) + '...');
      console.log('=== VIEWER JOIN ATTEMPT ===');
      console.log('- appId:', appId);
      console.log('- channelName:', channelName);
      console.log('- token (first 20):', token.substring(0, 20) + '...');
      console.log('- uid:', numericUserId);
      console.log('- streamId passed as prop:', streamId);
      console.log('- userId passed as prop:', userId);
      console.log('- username passed as prop:', username);
      
      // Join the channel as viewer with proper authentication token and numeric ID
      await clientRef.current.join(appId, channelName, token, numericUserId);
      console.log('=== VIEWER JOIN SUCCESSFUL ===');
      console.log('👁️ VIEWER NOW LISTENING FOR CREATOR BROADCASTS...');
      console.log('📊 Current Agora client state:', {
        connectionState: clientRef.current.connectionState,
        remoteUsers: clientRef.current.remoteUsers.length,
        localTracks: clientRef.current.localTracks.length,
        channelName: clientRef.current.channelName
      });
      setIsConnected(true);
      
      console.log("🟢 VIEWER SUCCESSFULLY JOINED AGORA CHANNEL:", channelName);
      console.log("👥 Waiting for creator to start broadcasting...");
      console.log("🔍 Agora client details:", {
        connectionState: clientRef.current.connectionState,
        channelName: clientRef.current.channelName,
        uid: clientRef.current.uid,
        remoteUsers: clientRef.current.remoteUsers.length
      });
      console.log("🎯 VIEWER LISTENING FOR CREATOR ON CHANNEL:", channelName);
      
      // TEST: Log existing remote users immediately upon joining
      if (clientRef.current.remoteUsers.length > 0) {
        console.log("🎉 FOUND EXISTING REMOTE USERS:", clientRef.current.remoteUsers.map(u => ({ uid: u.uid, hasVideo: !!u.videoTrack, hasAudio: !!u.audioTrack })));
      } else {
        console.log("📭 No remote users currently in channel - waiting for creator to broadcast");
      }
      
      // Set a timeout to show message if no video appears
      setTimeout(() => {
        if (!hasVideo) {
          console.log("⚠️ No video detected after 10 seconds - Creator may not be broadcasting yet");
          console.log("🔍 Current viewer state:", {
            isConnected,
            hasVideo,
            viewerCount,
            remoteUsers: clientRef.current?.remoteUsers?.length || 0,
            connectionState: clientRef.current?.connectionState
          });
          toast({
            title: "Waiting for Creator",
            description: "The creator hasn't started broadcasting yet. Please wait...",
          });
        }
      }, 10000);
      
      setIsLoading(false);

      toast({
        title: "Connected to Stream",
        description: `Now watching ${creatorName}'s live stream`,
      });

    } catch (error: any) {
      console.error("Failed to connect to stream:", error);
      setIsLoading(false);
      toast({
        title: "Connection Failed",
        description: "Unable to connect to the live stream. Please try again.",
        variant: "destructive",
      });
    }
  };

  const disconnect = async () => {
    try {
      console.log("🔌 Disconnecting from stream...");
      
      // Stop and cleanup video/audio tracks first
      if (remoteVideoRef.current) {
        try {
          remoteVideoRef.current.stop();
          remoteVideoRef.current = null;
        } catch (trackError) {
          console.log("Note: Video track cleanup skipped");
        }
      }
      
      if (remoteAudioRef.current) {
        try {
          remoteAudioRef.current.stop();
          remoteAudioRef.current = null;
        } catch (trackError) {
          console.log("Note: Audio track cleanup skipped");
        }
      }
      
      // Clear video container safely
      if (videoContainerRef.current) {
        try {
          videoContainerRef.current.innerHTML = '';
        } catch (domError) {
          console.log("Note: Video container cleanup skipped");
        }
      }
      
      // Leave Agora channel
      if (clientRef.current && clientRef.current.connectionState === "CONNECTED") {
        await clientRef.current.leave();
        console.log("✅ Successfully left Agora channel");
      }
      
      setIsConnected(false);
      setHasVideo(false);
      setViewerCount(0);
    } catch (error: any) {
      console.error("Error disconnecting:", error);
    }
  };

  const toggleMute = () => {
    if (remoteAudioRef.current) {
      if (isMuted) {
        remoteAudioRef.current.play();
      } else {
        remoteAudioRef.current.stop();
      }
      setIsMuted(!isMuted);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-8">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p>Connecting to live stream...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full h-full flex bg-black rounded-lg overflow-hidden">
      {/* Main Video Container - Desktop: left side, Mobile: full width */}
      <div className={`relative flex-1 ${showChat ? 'lg:w-2/3' : 'w-full'} min-h-0`}>
        {/* Video Stream Container */}
        <div 
          ref={videoContainerRef}
          className="w-full h-full bg-black flex items-center justify-center"
          style={{ 
            position: 'relative',
            width: '100%', 
            height: '100%',
            WebkitBackfaceVisibility: 'hidden',
            WebkitTransform: 'translate3d(0, 0, 0)',
            transform: 'translate3d(0, 0, 0)',
          }}
        >
          {!hasVideo && (
            <div className="text-center text-slate-400">
              {isConnected ? (
                <div className="space-y-3">
                  <div className="text-4xl">🎥</div>
                  <p className="text-lg">Waiting for {creatorName}...</p>
                  <p className="text-sm text-slate-500">Stream will appear automatically</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-4xl">📺</div>
                  <p className="text-lg">Connecting to stream...</p>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto"></div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Stream Info Overlays */}
        <div className="absolute top-2 left-2 sm:top-4 sm:left-4 flex items-center space-x-1 sm:space-x-2">
          <Badge className="bg-red-600 text-white shadow-lg text-xs">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full mr-1 animate-pulse"></div>
            LIVE
          </Badge>
          <Badge className="bg-black/70 backdrop-blur-sm text-white text-xs">
            <Users className="mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />
            {viewerCount}
          </Badge>
        </div>
        
        {/* Video Controls */}
        <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 flex items-center space-x-2">
          {/* Chat Toggle */}
          <Button
            size="sm"
            variant={showChat ? "default" : "secondary"}
            className="bg-black/70 hover:bg-black/90 backdrop-blur-sm border-none shadow-lg w-8 h-8 sm:w-auto sm:h-auto p-1 sm:p-2"
            onClick={() => setShowChat(!showChat)}
          >
            <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline ml-1">{showChat ? 'Hide' : 'Chat'}</span>
          </Button>
          
          {/* Audio Control */}
          {hasVideo && (
            <Button
              size="sm"
              variant={isMuted ? "destructive" : "secondary"}
              className="bg-black/70 hover:bg-black/90 backdrop-blur-sm border-none shadow-lg w-8 h-8 sm:w-auto sm:h-auto p-1 sm:p-2"
              onClick={toggleMute}
            >
              {isMuted ? <VolumeX className="h-3 w-3 sm:h-4 sm:w-4" /> : <Volume2 className="h-3 w-3 sm:h-4 sm:w-4" />}
            </Button>
          )}
        </div>
        
        {/* Connection Status */}
        {isConnected && (
          <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4">
            <Badge className="bg-green-600/80 backdrop-blur-sm text-white text-xs">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full mr-1 animate-pulse"></div>
              <span className="hidden sm:inline">Connected</span>
              <span className="sm:hidden">●</span>
            </Badge>
          </div>
        )}
      </div>

      {/* Chat Panel - Desktop: right side, Mobile: overlay */}
      {showChat && (
        <div className={`
          ${showChat ? 'block' : 'hidden'}
          absolute lg:relative
          top-0 right-0 lg:top-auto lg:right-auto
          w-full lg:w-1/3
          h-full
          z-50 lg:z-auto
          bg-black/95 lg:bg-transparent
          lg:border-l lg:border-slate-700
        `}>
          <StreamChat
            streamId={streamId}
            creatorName={creatorName}
            isVisible={showChat}
            onToggle={() => setShowChat(false)}
          />
        </div>
      )}
    </div>
  );
}