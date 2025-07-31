import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users, MessageCircle, Send, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { io, Socket } from 'socket.io-client';
import StreamMessageOverlay from "@/components/stream-message-overlay";
import { RewrittenAgoraStreaming } from "@/components/rewritten-agora-streaming";

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
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Chat refs
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

  // Initialize WebSocket for chat
  useEffect(() => {
    const initializeConnections = async () => {
      try {
        // Initialize WebSocket
        const newSocket = io(`${window.location.protocol}//${window.location.host}`, {
          query: {
            userId: (user as any)?.id,
            role: 'creator'
          }
        });

        newSocket.on('connect', () => {
          console.log('WebSocket connected for creator');
          if (streamId) {
            newSocket.emit('join-stream', { streamId });
          }
        });

        newSocket.on('disconnect', () => {
          console.log('WebSocket disconnected');
        });

        newSocket.on('stream-status', (data) => {
          console.log('Stream status:', data);
          setViewerCount(data.viewerCount || 0);
        });

        newSocket.on('chat-message', (data) => {
          console.log('Chat message received:', data);
          const newMessage: ChatMessage = {
            id: Date.now().toString(),
            message: data.message,
            senderName: data.senderName,
            senderRole: data.senderRole,
            tipAmount: data.tipAmount || 0,
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString()
          };
          setChatMessages(prev => [...prev.slice(-5), newMessage]);
        });

        setSocket(newSocket);

      } catch (error) {
        console.error('Failed to initialize connections:', error);
        toast({
          title: "Connection Failed",
          description: "Failed to initialize streaming connections",
          variant: "destructive",
        });
      }
    };

    if (user && streamId) {
      initializeConnections();
    }

    return () => {
      // Cleanup WebSocket
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user, streamId]);

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
          <Button 
            onClick={() => setLocation('/creator-dashboard')}
            variant="outline"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Stream Message Overlay */}
      <StreamMessageOverlay />
      
      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => setLocation('/creator-dashboard')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            
            <div>
              <h1 className="text-lg font-semibold text-foreground">Live Studio</h1>
              <p className="text-sm text-muted-foreground">
                Stream ID: {streamId.substring(0, 8)}...
              </p>
            </div>
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
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        <div className="flex-1 relative">
          {/* Rewritten Agora Streaming Component */}
          {streamId ? (
            <RewrittenAgoraStreaming
              streamId={streamId}
              onStreamEnd={() => {
                setIsStreaming(false);
                setLocation('/creator-dashboard');
              }}
              viewerCount={viewerCount}
            />
          ) : (
            <div className="relative h-[65vh] bg-black flex items-center justify-center">
              <div className="text-center text-white">
                <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">Ready to go live?</p>
                <p className="text-sm text-gray-400 mb-6">Create a stream to begin broadcasting</p>
                <Button 
                  onClick={() => setLocation('/creator-dashboard')}
                  className="bg-primary hover:bg-primary/90"
                  size="lg"
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back to Dashboard
                </Button>
              </div>
            </div>
          )}
          
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
                    className="flex-1"
                  />
                  <Button onClick={sendMessage} size="sm">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}