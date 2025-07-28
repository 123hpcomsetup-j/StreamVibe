import { useEffect, useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  UserPlus 
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { io, Socket } from 'socket.io-client';
import type { ChatMessage, GuestSession } from "@shared/schema";

export default function GuestStream() {
  const [, params] = useRoute("/stream/:streamId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // WebRTC state for receiving live stream
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [isStreamConnected, setIsStreamConnected] = useState(false);
  const [streamEnded, setStreamEnded] = useState(false);
  const [endMessage, setEndMessage] = useState("");
  
  const [guestName, setGuestName] = useState("");
  const [message, setMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [tokensLeft, setTokensLeft] = useState(100);
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null);
  const [isNameSet, setIsNameSet] = useState(false);
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

  // Type assertion for stream to fix LSP errors
  const typedStream = stream as any;

  // Fetch guest session
  const { data: guestSession } = useQuery({
    queryKey: ["/api/guest-session", streamId],
    enabled: !!streamId && !!guestSessionId,
    refetchInterval: false, // Don't auto-refetch, we manage state locally
  });

  // Fetch chat messages
  const { data: chatMessages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["/api/streams", streamId, "chat"],
    enabled: !!streamId,
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  // Create guest session mutation
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/guest-session`, {
        streamId,
        sessionId: crypto.randomUUID(),
      });
      return response as any; // Type assertion to fix LSP errors
    },
    onSuccess: (session: any) => {
      console.log("Guest session created:", session); // Debug log
      setGuestSessionId(session.id);
      setTimeLeft(session.viewTimeRemaining || 300);
      setTokensLeft(session.tokensRemaining || 100);
    },
    onError: (error) => {
      console.error("Guest session error:", error); // Debug log
      toast({
        title: "Session Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { message: string; tipAmount?: number }) => {
      return await apiRequest("POST", `/api/streams/${streamId}/chat`, {
        guestSessionId,
        senderName: guestName,
        message: data.message,
        tipAmount: data.tipAmount || 0,
      });
    },
    onSuccess: () => {
      setMessage("");
      refetchMessages();
      if (guestSession) {
        setTokensLeft(prev => Math.max(0, prev - 1));
      }
    },
    onError: (error) => {
      toast({
        title: "Message Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Signup mutation
  const signupMutation = useMutation({
    mutationFn: async () => {
      if (signupData.password !== signupData.confirmPassword) {
        throw new Error("Passwords do not match");
      }
      if (signupData.password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      return await apiRequest("POST", "/api/auth/register", {
        username: signupData.username,
        password: signupData.password,
        role: signupData.role,
      });
    },
    onSuccess: () => {
      toast({
        title: "Account Created",
        description: "Successfully created your account! Redirecting to dashboard...",
      });
      // Redirect to user dashboard with current stream after successful registration
      setTimeout(() => {
        setLocation(`/dashboard/stream/${streamId}`);
      }, 1500);
    },
    onError: (error) => {
      toast({
        title: "Signup Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Timer effect
  useEffect(() => {
    if (!guestSessionId || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setShowSignupDialog(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [guestSessionId, timeLeft]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Initialize guest session
  useEffect(() => {
    if (streamId && !guestSessionId) {
      createSessionMutation.mutate();
    }
  }, [streamId]);

  // Timer countdown effect
  useEffect(() => {
    if (timeLeft <= 0 || !guestSessionId) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setShowSignupDialog(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, guestSessionId]);

  // Initialize WebRTC connection for live streaming
  useEffect(() => {
    if (!streamId || !stream?.isLive) return;

    const newSocket = io(window.location.origin, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to streaming server');
      setSocket(newSocket);
      
      // Join stream as viewer
      newSocket.emit('join-stream', {
        streamId,
        userId: guestSession?.id || `guest-${Date.now()}`,
        userType: 'guest'
      });
    });

    // Handle WebRTC offer from creator
    newSocket.on('offer', async (data: { offer: RTCSessionDescriptionInit, streamId: string, creatorId: string }) => {
      if (data.streamId === streamId) {
        await handleWebRTCOffer(data.offer, newSocket, data.creatorId);
      }
    });

    // Handle ICE candidates
    newSocket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
      if (peerConnection && data.candidate) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    });

    // Handle stream ended
    newSocket.on('stream-ended', (data: { streamId: string, message: string }) => {
      if (data.streamId === streamId) {
        setStreamEnded(true);
        setEndMessage(data.message || 'Live stream has ended');
        setIsStreamConnected(false);
        
        if (peerConnection) {
          peerConnection.close();
          setPeerConnection(null);
        }
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
      if (peerConnection) {
        peerConnection.close();
      }
    };
  }, [streamId, stream?.isLive, guestSession]);

  // Handle WebRTC offer from creator
  const handleWebRTCOffer = async (offer: RTCSessionDescriptionInit, socket: Socket, creatorId: string) => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      setPeerConnection(pc);

      // Handle incoming video stream
      pc.ontrack = (event) => {
        console.log('Received remote stream');
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setIsStreamConnected(true);
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setIsStreamConnected(true);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setIsStreamConnected(false);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', {
            candidate: event.candidate,
            targetId: creatorId,
            streamId
          });
        }
      };

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('answer', {
        answer,
        streamId,
        targetId: creatorId,
        userId: guestSession?.id || `guest-${Date.now()}`
      });

    } catch (error) {
      console.error('Error handling WebRTC offer:', error);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !isNameSet || tokensLeft <= 0) return;

    sendMessageMutation.mutate({ message });
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    signupMutation.mutate();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (streamLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-white">Loading stream...</div>
      </div>
    );
  }

  if (streamLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-white">Loading stream...</div>
      </div>
    );
  }

  if (!typedStream) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl text-white mb-4">Stream not found</h2>
          <Button onClick={() => setLocation("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                onClick={() => setLocation("/")}
                className="text-slate-400 hover:text-white"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <h1 className="text-xl font-bold text-white">{typedStream.title}</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {typedStream.isLive ? (
                <Badge variant="destructive" className="animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full mr-2"></div>
                  LIVE
                </Badge>
              ) : (
                <Badge variant="outline" className="text-slate-400 border-slate-600">
                  <Video className="w-3 h-3 mr-2" />
                  ENDED
                </Badge>
              )}
              
              {/* Timer and tokens in header - always visible */}
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className={`${timeLeft <= 60 ? 'animate-pulse text-red-400' : ''}`}>
                  <Clock className="mr-1 h-3 w-3" />
                  {formatTime(timeLeft)}
                </Badge>
                <Badge variant="secondary" className={`${tokensLeft <= 10 ? 'text-red-400' : ''}`}>
                  <Coins className="mr-1 h-3 w-3" />
                  {tokensLeft}
                </Badge>
              </div>
              
              <div className="flex items-center space-x-2 text-slate-300">
                <Users className="h-4 w-4" />
                <span>{typedStream.viewerCount || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800 rounded-lg overflow-hidden">
              <div className="aspect-video bg-slate-700 relative">
                {streamEnded ? (
                  // Stream ended during viewing
                  <div className="w-full h-full flex items-center justify-center bg-slate-900">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Video className="w-10 h-10 text-slate-400" />
                      </div>
                      <h3 className="text-2xl font-semibold text-white mb-3">Live Stream Ended</h3>
                      <p className="text-slate-400 mb-4">{endMessage}</p>
                      
                      <div className="space-y-3">
                        <Button 
                          onClick={() => setLocation("/")}
                          className="bg-primary hover:bg-primary/80"
                        >
                          Browse Other Streams
                        </Button>
                        <div className="text-center">
                          <Button 
                            variant="outline"
                            onClick={() => setShowSignupDialog(true)}
                            className="border-slate-600 text-slate-300 hover:bg-slate-700"
                          >
                            Sign Up for Notifications
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : typedStream.isLive ? (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      autoPlay
                      muted
                      playsInline
                    />
                    
                    {/* Guest overlay for live streams */}
                    <div className="absolute top-4 left-4 flex flex-col space-y-2">
                      <Badge className={`backdrop-blur-sm ${timeLeft <= 60 ? 'bg-red-500/90 text-red-100 animate-pulse' : 'bg-amber-500/90 text-amber-900'}`}>
                        <Clock className="mr-1 h-3 w-3" />
                        Guest Preview: {formatTime(timeLeft)}
                      </Badge>
                      <Badge className={`backdrop-blur-sm ${tokensLeft <= 10 ? 'bg-red-500/90 text-red-100' : 'bg-green-500/90 text-green-900'}`}>
                        <Coins className="mr-1 h-3 w-3" />
                        {tokensLeft} tokens left
                      </Badge>
                    </div>

                    {!videoRef.current?.srcObject && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                        <div className="text-center">
                          <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Video className="w-8 h-8 text-slate-400 animate-pulse" />
                          </div>
                          <p className="text-white text-lg">Connecting to live stream...</p>
                          <p className="text-slate-400 text-sm mt-2">Please wait while we establish connection</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  // Stream is offline or not started
                  <div className="w-full h-full flex items-center justify-center bg-slate-800">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Video className="w-10 h-10 text-slate-400" />
                      </div>
                      <h3 className="text-2xl font-semibold text-white mb-3">Stream Offline</h3>
                      <p className="text-slate-400 mb-4">This creator is not currently live, but you can still chat and tip!</p>
                      
                      {/* Guest overlay for ended streams */}
                      <div className="flex justify-center space-x-2 mb-4">
                        <Badge className={`backdrop-blur-sm ${timeLeft <= 60 ? 'bg-red-500/90 text-red-100 animate-pulse' : 'bg-amber-500/90 text-amber-900'}`}>
                          <Clock className="mr-1 h-3 w-3" />
                          Guest Time: {formatTime(timeLeft)}
                        </Badge>
                        <Badge className={`backdrop-blur-sm ${tokensLeft <= 10 ? 'bg-red-500/90 text-red-100' : 'bg-green-500/90 text-green-900'}`}>
                          <Coins className="mr-1 h-3 w-3" />
                          {tokensLeft} tokens left
                        </Badge>
                      </div>
                      
                      <Badge variant="outline" className="text-slate-300">
                        <Users className="mr-1 h-3 w-3" />
                        {typedStream.viewerCount || 0} viewers still here
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Stream info */}
              <div className="p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <img 
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=48&h=48" 
                    alt="Creator profile" 
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="text-white font-medium">
                      {typedStream.creator?.firstName} {typedStream.creator?.lastName}
                    </h3>
                    <p className="text-slate-400 text-sm">{typedStream.category}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>Token Price: ${typedStream.tokenPrice || 1}</span>
                  <span>Min Tip: {typedStream.minTip} tokens</span>
                </div>
              </div>
            </div>

            {/* Guest warning */}
            <Card className="mt-4 bg-amber-500/10 border-amber-500/20">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div>
                    <h4 className="text-amber-400 font-medium mb-1">Guest Preview Mode</h4>
                    <p className="text-amber-300/80 text-sm">
                      You're viewing as a guest with {formatTime(timeLeft)} remaining and {tokensLeft} free tokens. 
                      <span className="font-medium"> Sign up to continue watching and get unlimited access!</span>
                    </p>
                    <div className="mt-3 flex space-x-2">
                      <Button size="sm" onClick={() => setLocation("/user-login")}>
                        Sign Up as Viewer
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setLocation("/creator-login")}>
                        Become Creator
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chat */}
          <div className="lg:col-span-1">
            <Card className="bg-slate-800 border-slate-700 h-[600px] flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center">
                  <Heart className="mr-2 h-5 w-5 text-red-500" />
                  Live Chat
                </CardTitle>
              </CardHeader>
              
              <CardContent className="flex-1 flex flex-col p-0">
                {/* Name input */}
                {!isNameSet && (
                  <div className="p-4 border-b border-slate-700">
                    <div className="space-y-2">
                      <Input
                        placeholder="Enter your name to chat"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                      <Button 
                        onClick={() => guestName.trim() && setIsNameSet(true)}
                        disabled={!guestName.trim()}
                        className="w-full"
                      >
                        Start Chatting
                      </Button>
                    </div>
                  </div>
                )}

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {Array.isArray(chatMessages) && chatMessages.map((msg: ChatMessage) => (
                      <div key={msg.id} className="flex flex-col space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-400 text-xs">{msg.senderName}</span>
                          {msg.tipAmount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <Coins className="mr-1 h-3 w-3" />
                              {msg.tipAmount}
                            </Badge>
                          )}
                        </div>
                        <p className="text-white text-sm">{msg.message}</p>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>

                {/* Message input */}
                {isNameSet && (
                  <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-700">
                    <div className="flex space-x-2">
                      <Input
                        placeholder={tokensLeft > 0 ? 
                          (stream.isLive ? "Type a message..." : "Chat about the stream...") 
                          : "No tokens left"}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        disabled={tokensLeft <= 0 || sendMessageMutation.isPending}
                        className="bg-slate-700 border-slate-600 text-white flex-1"
                      />
                      <Button 
                        type="submit" 
                        disabled={!message.trim() || tokensLeft <= 0 || sendMessageMutation.isPending}
                        className="px-3"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      {tokensLeft} messages remaining {!stream.isLive && "• Stream ended but chat is still active!"}
                    </p>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Signup Dialog */}
      <Dialog open={showSignupDialog} onOpenChange={setShowSignupDialog}>
        <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Continue Watching - Create Account
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              Your 5-minute preview has ended. Create a free account to keep watching and chatting!
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-white">Username</Label>
              <Input
                id="username"
                type="text"
                value={signupData.username}
                onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                placeholder="Choose a username"
                className="bg-slate-700 border-slate-600 text-white"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Password</Label>
              <Input
                id="password"
                type="password"
                value={signupData.password}
                onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                placeholder="Choose a password"
                className="bg-slate-700 border-slate-600 text-white"
                minLength={6}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={signupData.confirmPassword}
                onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                placeholder="Confirm your password"
                className="bg-slate-700 border-slate-600 text-white"
                minLength={6}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role" className="text-white">Account Type</Label>
              <Select 
                value={signupData.role} 
                onValueChange={(value: 'viewer' | 'creator') => setSignupData({ ...signupData, role: value })}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer - Watch and chat</SelectItem>
                  <SelectItem value="creator">Creator - Stream and earn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/login")}
                className="flex-1"
              >
                Already have account?
              </Button>
              <Button
                type="submit"
                disabled={signupMutation.isPending}
                className="flex-1 bg-primary hover:bg-primary/80"
              >
                {signupMutation.isPending ? "Creating..." : "Create Account"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}