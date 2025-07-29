import { useEffect, useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Video, 
  Clock, 
  Coins, 
  Users, 
  Send, 
  ArrowLeft,
  AlertTriangle,
  Play,
  Heart,
  UserPlus,
  MessageCircle,
  Wifi
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { io, Socket } from 'socket.io-client';
import type { ChatMessage, User } from "@shared/schema";
import NodeMediaPlayer from "@/components/node-media-player";
import WebRTCStreamViewer from "@/components/webrtc-stream-viewer";

export default function StreamView() {
  const [, params] = useRoute("/stream/:streamId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const typedUser = user as User | undefined;
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // WebRTC state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [isStreamConnected, setIsStreamConnected] = useState(false);
  const [streamEnded, setStreamEnded] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  
  // Guest state
  const [guestName, setGuestName] = useState("");
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes for guests
  const [tokensLeft, setTokensLeft] = useState(100);
  
  // Chat state
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [showSignupDialog, setShowSignupDialog] = useState(false);
  const [signupData, setSignupData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    role: "viewer" as const
  });

  const streamId = params?.streamId;

  // Fetch stream data
  const { data: stream, isLoading: streamLoading } = useQuery({
    queryKey: ["/api/streams", streamId],
    enabled: !!streamId,
  });

  // Fetch initial chat messages
  const { data: initialMessages = [] } = useQuery({
    queryKey: ["/api/streams", streamId, "chat"],
    enabled: !!streamId,
  });

  // Update chat messages when initial messages load
  useEffect(() => {
    if (Array.isArray(initialMessages) && initialMessages.length > 0) {
      setChatMessages(initialMessages);
    }
  }, [initialMessages]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Create guest session if not authenticated
  const createGuestSessionMutation = useMutation({
    mutationFn: async () => {
      const sessionId = Math.random().toString(36).substring(7);
      const response = await fetch('/api/guest-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          streamId,
          sessionId,
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create guest session');
      }
      
      const data = await response.json();
      return { sessionId, data };
    },
    onSuccess: ({ sessionId, data }) => {
      setGuestSessionId(sessionId);
      setGuestName(data.guestName);
      setTokensLeft(data.tokensRemaining || 100);
      setTimeLeft(data.viewTimeRemaining || 300);
    }
  });

  // Initialize guest session or authenticated user
  useEffect(() => {
    if (streamId && !isAuthenticated && !guestSessionId) {
      createGuestSessionMutation.mutate();
    }
  }, [streamId, isAuthenticated, guestSessionId]);

  // Guest timer countdown
  useEffect(() => {
    if (!isAuthenticated && guestSessionId && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setShowSignupDialog(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeLeft, isAuthenticated, guestSessionId]);

  // WebRTC configuration
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // Initialize WebSocket and WebRTC
  useEffect(() => {
    if (!streamId) return;

    const newSocket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to streaming server');
      setConnectionStatus('connected');
      
      // Join stream room
      const userId = typedUser?.id || `guest_${guestSessionId}`;
      newSocket.emit('join-stream', { streamId, userId });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from streaming server');
      setConnectionStatus('disconnected');
    });

    // Listen for stream ready signal
    newSocket.on('stream-ready', async (data: { streamId: string, creatorSocketId: string }) => {
      console.log('Stream ready, creating peer connection');
      setConnectionStatus('connecting');
      
      // Create peer connection
      const pc = new RTCPeerConnection(rtcConfiguration);
      
      pc.ontrack = (event) => {
        console.log('Received remote track');
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setIsStreamConnected(true);
          setConnectionStatus('connected');
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          newSocket.emit('ice-candidate', {
            candidate: event.candidate,
            targetId: data.creatorSocketId,
            streamId
          });
        }
      };

      // Set connection timeout
      setTimeout(() => {
        if (!isStreamConnected) {
          setConnectionStatus('disconnected');
          toast({
            title: "Connection Failed",
            description: "Unable to connect to stream. The creator may not be broadcasting.",
            variant: "destructive"
          });
        }
      }, 10000); // 10 second timeout

      setPeerConnection(pc);
    });

    // Listen for no active stream
    newSocket.on('no-active-stream', () => {
      console.log('No active stream found');
      setConnectionStatus('disconnected');
      setStreamEnded(false); // Don't set as ended, just not active
      toast({
        title: "Stream Not Broadcasting",
        description: "The creator is not currently live.",
        variant: "destructive"
      });
    });

    // Handle WebRTC signaling
    newSocket.on('offer', async (data: { offer: RTCSessionDescriptionInit, senderId: string }) => {
      console.log('Received offer, creating peer connection for viewer');
      
      // Create new peer connection for this offer
      const pc = new RTCPeerConnection(rtcConfiguration);
      
      pc.ontrack = (event) => {
        console.log('Viewer received remote track');
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setIsStreamConnected(true);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          newSocket.emit('ice-candidate', {
            candidate: event.candidate,
            targetId: data.senderId,
            streamId
          });
        }
      };

      await pc.setRemoteDescription(data.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      newSocket.emit('answer', {
        answer,
        targetId: data.senderId,
        streamId
      });
      
      setPeerConnection(pc);
    });

    newSocket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
      if (peerConnection) {
        try {
          await peerConnection.addIceCandidate(data.candidate);
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    });

    // Listen for chat messages
    newSocket.on('chat-message', (message: any) => {
      setChatMessages(prev => [...prev, message]);
    });

    // Handle stream end
    newSocket.on('stream-ended', (data: { message: string }) => {
      setStreamEnded(true);
      setIsStreamConnected(false);
      toast({
        title: "Stream Ended",
        description: data.message || "The stream has ended.",
      });
    });

    setSocket(newSocket);

    return () => {
      if (peerConnection) {
        peerConnection.close();
      }
      newSocket.close();
    };
  }, [streamId, typedUser?.id, guestSessionId]);

  // Send chat message
  const sendChatMutation = useMutation({
    mutationFn: async () => {
      if (!message.trim()) return;

      // For authenticated users, use standard chat endpoint
      if (isAuthenticated) {
        const response = await apiRequest("POST", "/api/chat", {
          streamId,
          message: message.trim(),
          tipAmount: 0
        });
        return await response.json();
      }

      // For guests, check if they have tokens and session
      if (!guestSessionId) {
        throw new Error('Guest session not found. Please refresh the page.');
      }
      
      if (tokensLeft <= 0) {
        throw new Error('No chat tokens remaining. Sign up to continue chatting!');
      }

      const headers: any = {
        'Content-Type': 'application/json',
        'x-session-id': guestSessionId,
      };

      const response = await fetch(`/api/streams/${streamId}/chat`, {
        method: 'POST',
        headers,
        credentials: 'include',
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
    },
    onSuccess: (chatMessage) => {
      setMessage("");
      
      // Don't add message to local state - let WebSocket handle it for real-time sync
      // The server will broadcast the message back to all connected clients
      
      // Update tokens for guests
      if (!isAuthenticated) {
        setTokensLeft(prev => Math.max(0, prev - 1));
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Chat Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Sign up mutation
  const signupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/register", signupData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Account Created!",
        description: "You can now enjoy unlimited viewing and chat.",
      });
      setShowSignupDialog(false);
      // Auto-login after signup
      window.location.href = "/user-login";
    },
    onError: (error: Error) => {
      toast({
        title: "Signup Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  if (streamLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-400">Loading stream...</p>
        </div>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800 border-slate-700 max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Stream Not Found</h2>
            <p className="text-slate-400 mb-6">This stream may have ended or been removed.</p>
            <Button onClick={() => setLocation("/")} className="bg-primary hover:bg-primary/80">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const typedStream = stream as any;
  const displayName = isAuthenticated 
    ? typedUser?.username || 'User' 
    : guestName || 'Guest';

  // Prevent creators from viewing their own stream
  if (typedStream && isAuthenticated && typedUser?.id === typedStream.creatorId) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800 border-slate-700 max-w-md">
          <CardContent className="p-8 text-center">
            <Video className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">This is Your Stream</h3>
            <p className="text-slate-400 mb-4">
              You can't view your own stream as a viewer. Use your creator dashboard to manage your live stream.
            </p>
            <Button onClick={() => setLocation("/creator-dashboard")} className="bg-blue-600 hover:bg-blue-700">
              Go to Creator Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/")}
            className="text-slate-300 hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          
          {!isAuthenticated && (
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                <Clock className="mr-1 h-3 w-3" />
                {formatTime(timeLeft)} left
              </Badge>
              <Badge variant="outline" className="text-blue-500 border-blue-500">
                <Coins className="mr-1 h-3 w-3" />
                {tokensLeft} tokens
              </Badge>
              <Button 
                onClick={() => setShowSignupDialog(true)}
                className="bg-primary hover:bg-primary/80"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Sign Up for Unlimited
              </Button>
            </div>
          )}
          
          {isAuthenticated && (
            <div className="flex items-center space-x-4">
              <span className="text-slate-300">Welcome, {displayName}!</span>
              <Badge className="bg-green-500 text-white">
                <Users className="mr-1 h-3 w-3" />
                Full Access
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Stream */}
        <div className="lg:col-span-2">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">{typedStream.title}</CardTitle>
                {getConnectionBadge()}
              </div>
              <p className="text-slate-400">{typedStream.category}</p>
            </CardHeader>
            <CardContent>
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                {/* Use WebRTC for browser streaming */}
                {!streamEnded && typedStream && (
                  <WebRTCStreamViewer
                    streamId={typedStream.id}
                    socket={socket}
                    creatorUsername={typedStream.creator?.username}
                  />
                )}
                
                {streamEnded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900 bg-opacity-90">
                    <div className="text-center">
                      <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-white mb-2">Stream Ended</h3>
                      <p className="text-slate-400 mb-4">This live stream has ended.</p>
                      <Button onClick={() => setLocation("/")} className="bg-primary hover:bg-primary/80">
                        Find More Streams
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Stream Stats Overlay - only show when streaming */}
                {typedStream.streamKey && !streamEnded && (
                  <div className="absolute top-4 left-4 flex items-center space-x-2">
                    <Badge className="bg-red-500 text-white">
                      <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
                      LIVE
                    </Badge>
                    <Badge className="bg-black/50 text-white">
                      <Users className="mr-1 h-3 w-3" />
                      {typedStream.viewerCount || 0} watching
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chat */}
        <div className="lg:col-span-1">
          <Card className="bg-slate-800 border-slate-700 h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <MessageCircle className="mr-2 h-5 w-5" />
                Live Chat
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-3">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageCircle className="h-8 w-8 text-slate-500 mx-auto mb-2" />
                      <p className="text-slate-400">No messages yet</p>
                      <p className="text-slate-500 text-sm">Be the first to say hi!</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, index) => (
                      <div key={index} className="bg-slate-700/50 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <span className="font-medium text-primary">
                              {msg.senderName || 'Anonymous'}:
                            </span>
                            <p className="text-slate-300 mt-1">{msg.message}</p>
                          </div>
                          {msg.tipAmount > 0 && (
                            <Badge className="bg-green-500 text-white ml-2">
                              <Coins className="mr-1 h-3 w-3" />
                              {msg.tipAmount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              
              {/* Chat Input */}
              <div className="mt-4 pt-4 border-t border-slate-700">
                {(!isAuthenticated && tokensLeft <= 0) ? (
                  <div className="text-center py-2">
                    <p className="text-yellow-500 text-sm mb-2">No tokens left!</p>
                    <Button 
                      size="sm"
                      onClick={() => setShowSignupDialog(true)}
                      className="bg-primary hover:bg-primary/80"
                    >
                      Sign Up for Unlimited Chat
                    </Button>
                  </div>
                ) : (
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendChatMutation.mutate();
                    }}
                    className="flex space-x-2"
                  >
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={`Chat as ${displayName}...`}
                      className="flex-1 bg-slate-700 border-slate-600 text-white"
                      disabled={sendChatMutation.isPending}
                    />
                    <Button 
                      type="submit"
                      disabled={sendChatMutation.isPending || !message.trim()}
                      className="bg-primary hover:bg-primary/80"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Signup Dialog */}
      <Dialog open={showSignupDialog} onOpenChange={setShowSignupDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Create Your Account</DialogTitle>
            <DialogDescription className="text-slate-400">
              Sign up for unlimited viewing and chat access
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            signupMutation.mutate();
          }} className="space-y-4">
            <div>
              <Label className="text-slate-300">Username</Label>
              <Input
                value={signupData.username}
                onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                required
              />
            </div>
            
            <div>
              <Label className="text-slate-300">Password</Label>
              <Input
                type="password"
                value={signupData.password}
                onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                required
              />
            </div>
            
            <div>
              <Label className="text-slate-300">Confirm Password</Label>
              <Input
                type="password"
                value={signupData.confirmPassword}
                onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/80"
              disabled={signupMutation.isPending}
            >
              {signupMutation.isPending ? "Creating Account..." : "Sign Up"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}