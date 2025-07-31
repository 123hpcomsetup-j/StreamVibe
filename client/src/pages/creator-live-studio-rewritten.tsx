import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Users, MessageCircle, Send, Video, Phone, Check, X, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { io, Socket } from 'socket.io-client';
import StreamMessageOverlay from "@/components/stream-message-overlay";
import { StableAgoraStreaming } from "@/components/stable-agora-streaming";

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
  const queryClient = useQueryClient();
  
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
  
  // Private call request notifications
  const [privateCallRequests, setPrivateCallRequests] = useState<any[]>([]);
  const [showPrivateCallPopup, setShowPrivateCallPopup] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<any>(null);
  
  // Chat refs
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Private call request handling mutations
  const acceptRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await apiRequest("PATCH", `/api/private-call-requests/${requestId}/accept`, {});
      return response.json();
    },
    onSuccess: () => {
      setShowPrivateCallPopup(false);
      setCurrentRequest(null);
      toast({
        title: "Private Call Accepted!",
        description: "The private call request has been approved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const rejectRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await apiRequest("PATCH", `/api/private-call-requests/${requestId}/reject`, {});
      return response.json();
    },
    onSuccess: () => {
      setShowPrivateCallPopup(false);
      setCurrentRequest(null);
      toast({
        title: "Request Declined",
        description: "The private call request has been declined.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

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
          // Join user-specific room for private call notifications
          if (user?.id) {
            newSocket.emit('join-user-room', { userId: user.id });
            console.log(`🔔 Creator ${user.id} joined user room for private call notifications`);
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

        // Listen for private call requests
        newSocket.on('private-call-request', (data) => {
          console.log('🔔 Private call request received:', data);
          setCurrentRequest(data);
          setShowPrivateCallPopup(true);
          setPrivateCallRequests(prev => [data, ...prev]);
          
          // Show toast notification
          toast({
            title: "Private Call Request!",
            description: `${data.requesterName} wants a private call (${data.tokenAmount} tokens)`,
            duration: 10000,
          });
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
      <StreamMessageOverlay 
        streamId={streamId || ''}
        creatorName={(user as any)?.username || 'Creator'}
        stream={currentStream}
      />
      
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
          {/* Stable Agora Streaming Component */}
          {streamId ? (
            <StableAgoraStreaming
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
                            msg.senderRole === 'creator' ? 'text-yellow-600' : 
                            msg.senderRole === 'viewer' ? 'text-blue-600' :
                            msg.senderRole === 'admin' ? 'text-red-600' :
                            msg.senderRole === 'guest' ? 'text-green-600' :
                            'text-gray-600'
                          }`}>
                            {msg.senderName}:
                          </span>
                        </div>
                        <div className="text-foreground text-xs mt-1 break-words">
                          {msg.message}
                        </div>
                        {msg.tipAmount > 0 && (
                          <div className="text-yellow-600 text-xs mt-1 font-medium">
                            🪙 Tipped {msg.tipAmount} tokens
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

      {/* Private Call Request Pop-up Dialog */}
      <Dialog open={showPrivateCallPopup} onOpenChange={setShowPrivateCallPopup}>
        <DialogContent className="bg-white border border-blue-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-800">
              <Phone className="h-5 w-5" />
              Private Call Request
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              You have received a private call request
            </DialogDescription>
          </DialogHeader>
          
          {currentRequest && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{currentRequest.requesterName}</p>
                    <p className="text-sm text-gray-600">wants a private call</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-yellow-600" />
                    <span className="text-gray-700">{currentRequest.tokenAmount} tokens</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-blue-600" />
                    <span className="text-gray-700">{currentRequest.duration || 10} minutes</span>
                  </div>
                </div>
                
                {currentRequest.message && (
                  <div className="mt-3 p-3 bg-white rounded border">
                    <p className="text-sm text-gray-700">{currentRequest.message}</p>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3">
                <Button
                  onClick={() => acceptRequestMutation.mutate(currentRequest.requestId)}
                  disabled={acceptRequestMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Accept Call
                </Button>
                <Button
                  onClick={() => rejectRequestMutation.mutate(currentRequest.requestId)}
                  disabled={rejectRequestMutation.isPending}
                  variant="outline"
                  className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                >
                  <X className="h-4 w-4 mr-2" />
                  Decline
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}