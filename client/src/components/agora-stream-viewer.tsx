import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Volume2, VolumeX, Send, MessageCircle } from "lucide-react";
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
  const [message, setMessage] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const { user, isAuthenticated } = useAuth();
  const typedUser = user as any;
  
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<IRemoteVideoTrack | null>(null);
  const remoteAudioRef = useRef<IRemoteAudioTrack | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize Agora client
  useEffect(() => {
    const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
    clientRef.current = client;

    // Set client role to audience (viewer)
    client.setClientRole("audience");

    // Handle remote user events
    client.on("user-published", async (user, mediaType) => {
      console.log("🎥 CREATOR BROADCASTING:", mediaType, "from user:", user.uid);
      
      try {
        // Subscribe to the remote user
        await client.subscribe(user, mediaType);
        console.log("✅ Successfully subscribed to creator:", mediaType);
        
        if (mediaType === "video") {
          const remoteVideoTrack = user.videoTrack;
          if (remoteVideoTrack && videoContainerRef.current) {
            console.log("📺 Playing creator video stream");
            remoteVideoTrack.play(videoContainerRef.current);
            remoteVideoRef.current = remoteVideoTrack;
            setHasVideo(true);
            setIsLoading(false);
            
            toast({
              title: "Creator is live!",
              description: "Video stream connected successfully",
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
        toast({
          title: "Stream Connection Error",
          description: "Failed to connect to creator's video",
          variant: "destructive",
        });
      }
    });

    client.on("user-unpublished", (user, mediaType) => {
      console.log("Creator stopped broadcasting:", mediaType);
      
      if (mediaType === "video") {
        setHasVideo(false);
        remoteVideoRef.current = null;
      }
      
      if (mediaType === "audio") {
        remoteAudioRef.current = null;
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

  // Send chat message
  const sendChatMutation = useMutation({
    mutationFn: async () => {
      if (!message.trim()) return;

      if (isAuthenticated) {
        const response = await apiRequest("POST", "/api/chat", {
          streamId,
          message: message.trim(),
          tipAmount: 0
        });
        return await response.json();
      } else {
        // For guests, create a simple guest session
        const response = await fetch(`/api/streams/${streamId}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': `guest-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          },
          body: JSON.stringify({
            message: message.trim(),
            tipAmount: 0
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to send message');
        }

        return await response.json();
      }
    },
    onSuccess: () => {
      setMessage("");
    },
    onError: (error: Error) => {
      toast({
        title: "Chat Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

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
      
      console.log('Viewer joining Agora channel:', channelName, 'with user ID:', userId);
      
      // Get Agora token from backend
      const tokenResponse = await fetch('/api/agora/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelName,
          uid: userId,
          role: 'audience'
        }),
      });
      
      if (!tokenResponse.ok) {
        throw new Error('Failed to get Agora token');
      }
      
      const { token } = await tokenResponse.json();
      console.log('Got Agora token, joining channel as viewer...');
      
      // Join the channel as viewer with proper authentication token
      await clientRef.current.join(appId, channelName, token, userId);
      setIsConnected(true);
      
      console.log("🟢 Viewer connected to Agora channel:", channelName);
      console.log("👥 Waiting for creator to start broadcasting...");
      
      // Set a timeout to show message if no video appears
      setTimeout(() => {
        if (!hasVideo) {
          console.log("⚠️ No video detected after 10 seconds");
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
      if (clientRef.current) {
        await clientRef.current.leave();
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Video Player */}
      <div className="lg:col-span-2 space-y-4">
        {/* Stream Info */}
        <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div>
              <div className="text-lg">{title}</div>
              <div className="text-sm text-slate-400">by {creatorName}</div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-red-600 text-white">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-2"></div>
                LIVE
              </Badge>
              <Badge variant="outline" className="border-slate-600 text-slate-300">
                <Users className="w-3 h-3 mr-1" />
                {viewerCount} viewers
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowChat(!showChat)}
                className="lg:hidden border-slate-600 text-slate-300"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        </Card>
        
        {/* Video Player */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-0">
            <div className="relative">
            <div 
              ref={videoContainerRef}
              className="w-full h-96 bg-slate-900 flex items-center justify-center"
            >
              {!hasVideo && (
                <div className="text-center text-slate-400">
                  {isConnected ? (
                    <div>
                      <div className="text-lg mb-2">🎥</div>
                      <p>Waiting for video...</p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-lg mb-2">📺</div>
                      <p>Stream not available</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Video Controls */}
            {hasVideo && (
              <div className="absolute bottom-4 right-4">
                <Button
                  size="sm"
                  variant={isMuted ? "destructive" : "secondary"}
                  className="bg-black/50 hover:bg-black/70"
                  onClick={toggleMute}
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
              </div>
            )}
            </div>
          </CardContent>
        </Card>

        {/* Connection Status */}
        {isConnected && (
          <div className="text-center">
            <div className="inline-flex items-center text-green-400 text-sm">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
              Connected to Agora Live Stream
            </div>
          </div>
        )}
      </div>

      {/* Live Chat Panel */}
      <div className={`${showChat ? 'block' : 'hidden'} lg:block`}>
        <Card className="bg-slate-800 border-slate-700 h-[600px] flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-lg flex items-center">
              <MessageCircle className="mr-2 h-5 w-5" />
              Live Chat
            </CardTitle>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-4">
            {/* Chat Messages */}
            <ScrollArea className="flex-1 pr-4 mb-4">
              <div className="space-y-3">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-slate-400 py-8">
                    <MessageCircle className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p>No messages yet</p>
                    <p className="text-sm">Be the first to say hello!</p>
                  </div>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div key={index} className="flex flex-col space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-white">
                          {msg.senderName || msg.guestName || 'Anonymous'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(msg.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300">{msg.message}</p>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Chat Input */}
            <div className="border-t border-slate-700 pt-4">
              <div className="flex space-x-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={isAuthenticated ? "Type a message..." : "Type a message (guest)..."}
                  className="flex-1 bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                  onKeyPress={(e) => e.key === 'Enter' && !sendChatMutation.isPending && sendChatMutation.mutate()}
                  disabled={sendChatMutation.isPending}
                />
                <Button 
                  onClick={() => sendChatMutation.mutate()}
                  size="sm" 
                  className="bg-primary hover:bg-primary/90"
                  disabled={!message.trim() || sendChatMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {!isAuthenticated && (
                <p className="text-xs text-slate-400 mt-2">
                  Watching as guest • <span className="text-primary">Sign up</span> for unlimited chat
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}