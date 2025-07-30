import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users, MessageCircle, Send, Video, VideoOff, Mic, MicOff, Square, Play, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { io, Socket } from 'socket.io-client';
import StreamMessageOverlay from "@/components/stream-message-overlay";
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  UID
} from "agora-rtc-sdk-ng";

interface ChatMessage {
  id: string;
  message: string;
  senderName: string;
  senderRole: string;
  tipAmount: number;
  timestamp: string;
  createdAt: string;
}

export default function CreatorLiveStudio() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Get stream ID from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const streamId = urlParams.get('streamId');

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Agora refs
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const videoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch current stream data
  const { data: currentStream } = useQuery({
    queryKey: ['/api/streams/current'],
    enabled: !!user,
  });

  // Get wallet balance
  const { data: wallet } = useQuery({
    queryKey: ["/api/wallet"],
    enabled: !!user,
  });

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Initialize WebSocket and Agora
  useEffect(() => {
    if (!streamId || !user) return;

    // Initialize WebSocket
    const newSocket = io({
      query: {
        userId: (user as any)?.id,
        role: (user as any)?.role || 'creator'
      }
    });

    newSocket.on('connect', () => {
      console.log('🔗 Creator WebSocket connected successfully');
      setSocket(newSocket);
      
      // Join stream room for chat
      newSocket.emit('join-stream', streamId);
    });

    newSocket.on('chat-message', (messageData: ChatMessage) => {
      setChatMessages(prev => [...prev.slice(-5), messageData]); // Keep last 6 messages
    });

    newSocket.on('tip-message', (tipData: any) => {
      // Handle tip notifications
      console.log('💰 Tip received:', tipData);
    });

    newSocket.on('viewer-count-update', (data: { streamId: string; viewerCount: number }) => {
      if (data.streamId === streamId) {
        setViewerCount(data.viewerCount);
      }
    });

    // Initialize Agora client
    const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
    clientRef.current = client;
    client.setClientRole("host");

    client.on("user-joined", (user) => {
      console.log("🎉 Viewer joined:", user.uid);
      setViewerCount(prev => prev + 1);
    });

    client.on("user-left", (user) => {
      console.log("👥 Viewer left:", user.uid);
      setViewerCount(prev => Math.max(0, prev - 1));
    });

    return () => {
      newSocket.disconnect();
      client.removeAllListeners();
    };
  }, [streamId, user]);

  const startStream = async () => {
    try {
      if (!clientRef.current || !streamId) return;

      // Get Agora token
      const tokenResponse = await fetch('/api/agora/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelName: streamId,
          role: 'host',
          uid: Math.floor(Math.random() * 1000000000)
        })
      });

      const { token } = await tokenResponse.json();

      // Join channel
      await clientRef.current.join(
        import.meta.env.VITE_AGORA_APP_ID,
        streamId,
        token,
        Math.floor(Math.random() * 1000000000)
      );

      // Create and publish tracks
      const videoTrack = await AgoraRTC.createCameraVideoTrack();
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      videoTrackRef.current = videoTrack;
      audioTrackRef.current = audioTrack;

      // Play video locally
      if (videoContainerRef.current) {
        videoTrack.play(videoContainerRef.current);
      }

      // Publish tracks
      await clientRef.current.publish([videoTrack, audioTrack]);

      setIsStreaming(true);
      setIsConnected(true);

      // Notify server
      if (socket) {
        socket.emit('start-stream', { streamId, userId: (user as any)?.id });
      }

      toast({
        title: "Stream Started!",
        description: "You are now live and broadcasting to viewers.",
      });

    } catch (error) {
      console.error("❌ Error starting stream:", error);
      toast({
        title: "Failed to Start Stream",
        description: (error as any)?.message || "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const stopStream = async () => {
    try {
      if (videoTrackRef.current) {
        videoTrackRef.current.close();
        videoTrackRef.current = null;
      }
      
      if (audioTrackRef.current) {
        audioTrackRef.current.close();
        audioTrackRef.current = null;
      }

      if (clientRef.current) {
        await clientRef.current.leave();
      }

      setIsStreaming(false);
      setIsConnected(false);

      // Notify server
      if (socket) {
        socket.emit('stop-stream', { streamId, userId: (user as any)?.id });
      }

      toast({
        title: "Stream Ended",
        description: "Your live stream has been stopped.",
      });

      // Return to dashboard
      setLocation('/creator-dashboard');

    } catch (error) {
      console.error("❌ Error stopping stream:", error);
    }
  };

  const toggleVideo = async () => {
    if (videoTrackRef.current) {
      await videoTrackRef.current.setEnabled(!isVideoOn);
      setIsVideoOn(!isVideoOn);
    }
  };

  const toggleAudio = async () => {
    if (audioTrackRef.current) {
      await audioTrackRef.current.setEnabled(!isAudioOn);
      setIsAudioOn(!isAudioOn);
    }
  };

  const sendMessage = () => {
    if (!message.trim() || !socket) return;

    socket.emit('chat-message', {
      streamId,
      message: message.trim(),
      senderName: (user as any)?.username || 'Creator',
      senderRole: 'creator'
    });

    setMessage("");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4 text-foreground">Loading...</h1>
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!streamId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4 text-foreground">Stream Not Found</h1>
          <p className="text-muted-foreground mb-4">No stream ID provided. Please create a stream first.</p>
          <Button onClick={() => setLocation('/creator-dashboard')} className="bg-primary hover:bg-primary/90">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Status Bar */}
      <div className="bg-card px-4 py-2 flex items-center justify-between border-b border-border">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/creator-dashboard')}
            className="text-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          
          <Badge variant="destructive" className="animate-pulse">
            {isStreaming ? 'LIVE' : 'OFFLINE'}
          </Badge>
          
          <span className="text-foreground font-medium">Creator Studio</span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">{viewerCount}</span>
          </div>
          
          <div className="flex items-center space-x-2 text-primary">
            <span className="text-xs">💰</span>
            <span className="text-sm font-medium">{(wallet as any)?.balance || 0} tokens</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        <div className="flex-1 relative">
          {/* Video Player */}
          <div className="relative h-[65vh] bg-black">
            {/* Video Container */}
            <div 
              ref={videoContainerRef}
              className="w-full h-full flex items-center justify-center"
              style={{ height: '100%' }}
            >
              {!isStreaming && (
                <div className="text-center text-white">
                  <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">Ready to go live?</p>
                  <p className="text-sm text-gray-400 mb-6">Start your stream to begin broadcasting</p>
                  <Button 
                    onClick={startStream}
                    className="bg-primary hover:bg-primary/90"
                    size="lg"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Go Live
                  </Button>
                </div>
              )}
            </div>

            {/* Stream Controls Overlay */}
            {isStreaming && (
              <div className="absolute bottom-4 left-4 flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleVideo}
                  className={`${isVideoOn ? 'bg-slate-700' : 'bg-red-600'} text-white border-slate-600`}
                >
                  {isVideoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAudio}
                  className={`${isAudioOn ? 'bg-slate-700' : 'bg-red-600'} text-white border-slate-600`}
                >
                  {isAudioOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                </Button>
                
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={stopStream}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Square className="h-4 w-4 mr-1" />
                  End Stream
                </Button>
              </div>
            )}
          </div>
          
          {/* Chat Section - Below Video */}
          <div className="h-[35vh] min-h-[400px] bg-card border-t border-border">
            <div className="flex flex-col h-full">
              {/* Chat Header */}
              <div className="p-3 border-b border-border">
                <div className="flex items-center space-x-2">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground font-medium text-sm">Live Chat</span>
                  <Badge variant="secondary" className="text-xs">
                    {chatMessages.length}
                  </Badge>
                </div>
              </div>

              {/* Chat Messages */}
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-2">
                  {chatMessages.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No messages yet</p>
                      <p className="text-xs">Chat will appear here when viewers send messages</p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div key={msg.id} className="text-sm">
                        <div className="flex items-start space-x-2">
                          <span className={`font-medium text-xs ${
                            msg.senderRole === 'creator' ? 'text-primary' : 'text-primary'
                          }`}>
                            {msg.senderName}:
                          </span>
                        </div>
                        <div className="text-foreground text-xs mt-1 break-words">
                          {msg.message}
                        </div>
                        {msg.tipAmount > 0 && (
                          <div className="text-primary text-xs mt-1">
                            💰 Tipped {msg.tipAmount} tokens
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              {/* Chat Input */}
              <div className="p-3 border-t border-border">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Type a message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    className="flex-1 bg-background border-input text-foreground placeholder-muted-foreground text-sm"
                  />
                  <Button
                    onClick={sendMessage}
                    size="sm"
                    disabled={!message.trim()}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Message Overlay */}
      <StreamMessageOverlay 
        streamId={streamId || ''}
        creatorName={(user as any)?.username || 'Creator'}
        stream={currentStream as any}
      />
    </div>
  );
}