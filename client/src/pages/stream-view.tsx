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
  LogIn,
  MessageCircle,
  Wifi
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { io, Socket } from 'socket.io-client';
import type { ChatMessage, User } from "@shared/schema";
import AgoraStreamViewer from "@/components/agora-stream-viewer";

export default function StreamView() {
  const [, params] = useRoute("/stream/:streamId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const typedUser = user as User | undefined;
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Simple stream state - Agora handles connections
  const [streamEnded, setStreamEnded] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  
  // Guest state
  const [guestName, setGuestName] = useState("");
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes for guests
  const [tokensLeft, setTokensLeft] = useState(100);
  
  // Chat state
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [showChat, setShowChat] = useState(true); // Mobile chat toggle
  const [showSignupDialog, setShowSignupDialog] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [showTipDialog, setShowTipDialog] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  
  // For other live streams section
  const { data: otherStreams } = useQuery({
    queryKey: ['/api/streams/live'],
    refetchInterval: 10000 // Refresh every 10 seconds
  });
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

  // Smart auto-scroll chat - only scroll if user is near bottom
  useEffect(() => {
    const chatContainer = document.querySelector('#chat-scroll-area [data-radix-scroll-area-viewport]');
    if (chatContainer && chatEndRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100; // 100px threshold
      
      // Show/hide scroll to bottom button
      setShowScrollToBottom(!isNearBottom && chatMessages.length > 1);
      
      // Only auto-scroll if user is near the bottom or it's the first message
      if (isNearBottom || chatMessages.length === 1) {
        chatEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [chatMessages]);

  // Add scroll listener to detect when user scrolls
  useEffect(() => {
    const chatContainer = document.querySelector('#chat-scroll-area [data-radix-scroll-area-viewport]');
    if (!chatContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
      setShowScrollToBottom(!isNearBottom && chatMessages.length > 1);
    };

    chatContainer.addEventListener('scroll', handleScroll);
    return () => chatContainer.removeEventListener('scroll', handleScroll);
  }, [chatMessages.length]);
  
  // Function to scroll to bottom manually
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollToBottom(false);
  };

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
      console.log('Guest session created successfully:', { sessionId, data });
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

  // Stream check for Agora

  // Initialize WebSocket for chat only - Agora handles streaming
  const [socket, setSocket] = useState<Socket | null>(null);
  
  useEffect(() => {
    if (!streamId) return;
    
    // For guests, wait until guest session is created
    if (!isAuthenticated && !guestSessionId) {
      console.log('Waiting for guest session to be created before connecting to WebSocket');
      return;
    }

    console.log('Creating WebSocket connection for chat...');
    const newSocket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to chat server');
      
      // Join stream room for chat
      const userId = typedUser?.id || `guest_${guestSessionId}`;
      console.log('Joining stream room with userId:', userId);
      newSocket.emit('join-stream', { streamId, userId });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from chat server');
    });

    // Listen for chat messages
    newSocket.on('chat-message', (message: any) => {
      console.log('Received chat message:', message);
      setChatMessages(prev => [...prev, message]);
    });

    // Listen for tip notifications  
    newSocket.on('tip-message', (data: any) => {
      console.log('Received tip notification:', data);
      const tipNotification = {
        message: `💰 ${data.username} tipped ${data.amount} tokens!`,
        username: 'System',
        timestamp: data.timestamp,
        tipAmount: data.amount,
        userType: 'system'
      };
      setChatMessages(prev => [...prev, tipNotification]);
    });

    // Listen for tip errors
    newSocket.on('tip-error', (data: any) => {
      console.error('Tip error:', data);
      toast({
        title: "Tip Failed",
        description: data.message,
        variant: "destructive",
      });
    });

    // Listen for chat errors  
    newSocket.on('chat-error', (data: any) => {
      console.error('Chat error:', data);
      toast({
        title: "Chat Error",
        description: data.message,
        variant: "destructive",
      });
    });

    // Listen for successful chat message send
    newSocket.on('chat-message-sent', (data: any) => {
      if (data.success) {
        console.log('Chat message sent successfully');
      }
    });

    // Handle stream end
    newSocket.on('stream-ended', (data: { message: string }) => {
      setStreamEnded(true);
      toast({
        title: "Stream Ended",
        description: data.message || "The stream has ended.",
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [streamId, typedUser?.id, guestSessionId]);

  // Display name for chat
  const displayName = isAuthenticated 
    ? typedUser?.username || 'User' 
    : guestName || 'Guest';

  // Handle custom action usage
  const handleCustomAction = (action: any) => {
    const tokenCost = action.tokenCost || 1;
    
    if (!isAuthenticated && tokensLeft < tokenCost) {
      toast({
        title: "Not Enough Tokens",
        description: `You need ${tokenCost} tokens for this action. Sign up for unlimited chat!`,
        variant: "destructive",
      });
      return;
    }

    // Deduct tokens for guests
    if (!isAuthenticated) {
      setTokensLeft(prev => Math.max(0, prev - tokenCost));
    }

    // Send action as a special chat message
    const actionMessage = {
      streamId,
      message: `Used action: ${action.name}`,
      senderName: displayName,
      userId: isAuthenticated ? typedUser?.id : null,
      isCustomAction: true,
      actionName: action.name,
      actionCost: tokenCost,
      timestamp: new Date().toISOString(),
      userType: isAuthenticated ? 'viewer' : 'guest',
      guestSessionId: !isAuthenticated ? guestSessionId : undefined
    };

    console.log('Sending custom action via WebSocket:', actionMessage);
    socket?.emit('chat-message', actionMessage);

    toast({
      title: "Action Used",
      description: `"${action.name}" for ${tokenCost} tokens`,
    });
  };

  // Send chat message via WebSocket for real-time delivery
  const sendChatMessage = () => {
    if (!message.trim()) {
      console.log('Empty message, not sending');
      return;
    }
    
    if (!socket) {
      console.log('No socket connection available');
      toast({
        title: "Connection Error",
        description: "Chat connection not established. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    // Check guest limits
    if (!isAuthenticated) {
      if (!guestSessionId) {
        console.log('No guest session found');
        toast({
          title: "Session Error",
          description: "Guest session not found. Please refresh the page.",
          variant: "destructive",
        });
        return;
      }
      
      if (tokensLeft <= 0) {
        toast({
          title: "No Tokens",
          description: "No chat tokens remaining. Sign up to continue chatting!",
          variant: "destructive",
        });
        return;
      }
    }

    const messageData = {
      streamId,
      userId: typedUser?.id || `guest_${guestSessionId}`,
      username: displayName,
      message: message.trim(),
      timestamp: new Date().toISOString(),
      userType: isAuthenticated ? 'viewer' : 'guest',
      guestSessionId: !isAuthenticated ? guestSessionId : undefined
    };

    console.log('Sending chat message via WebSocket:', messageData);
    socket.emit('chat-message', messageData);
    setMessage("");
    
    // Update tokens for guests
    if (!isAuthenticated) {
      setTokensLeft(prev => Math.max(0, prev - 1));
    }
  };

  // Send tip to creator via WebSocket
  const sendTip = () => {
    if (!isAuthenticated || !tipAmount || tipAmount <= 0 || !socket) {
      toast({
        title: "Authentication Required",
        description: "Please sign up to send tips to creators.",
        variant: "destructive",
      });
      return;
    }

    if (!typedUser) {
      toast({
        title: "User Error",
        description: "Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    if ((typedUser.walletBalance || 0) < tipAmount) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough tokens for this tip.",
        variant: "destructive",
      });
      return;
    }

    console.log('Sending tip via WebSocket:', { streamId, tipAmount, username: displayName, userId: typedUser.id });

    // Send tip via WebSocket for real-time processing
    socket.emit('tip-message', {
      streamId,
      amount: tipAmount,
      username: displayName,
      userId: typedUser.id
    });

    setTipAmount(0);
    setShowTipDialog(false);
    
    toast({
      title: "Tip Sent!",
      description: `You tipped ${tipAmount} tokens to the creator.`,
    });
  };

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

  // Login mutation for existing users
  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(loginData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Login Successful!",
        description: "Welcome back! You now have unlimited access.",
      });
      setShowLoginDialog(false);
      // Refresh the page to get authenticated user data
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({
        title: "Login Failed",
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
            onClick={() => setLocation(isAuthenticated ? "/user-dashboard" : "/")}
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

      {/* Main Content - Simplified Layout */}
      <div className="mx-auto px-2 sm:px-4 lg:px-6 py-4">
        <div className="flex flex-col lg:grid lg:grid-cols-3 lg:gap-6 lg:max-w-7xl lg:mx-auto">
          
          {/* Video Stream - Clean container */}
          <div className="lg:col-span-2 mb-4 lg:mb-0">
            <div className="w-full h-[80vh] lg:h-[70vh] bg-black rounded-lg overflow-hidden">
              {!streamEnded && typedStream ? (
                <AgoraStreamViewer
                  streamId={typedStream.id}
                  userId={typedUser?.id || guestSessionId || ''}
                  username={displayName}
                  creatorName={typedStream.creatorName || 'Creator'}
                  title={typedStream.title}
                />
              ) : (
                <Card className="bg-slate-800 border-slate-700 h-full flex items-center justify-center">
                  <CardContent className="p-4 sm:p-8">
                    <div className="text-center">
                      <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-yellow-500 mx-auto mb-4" />
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Stream Ended</h3>
                      <p className="text-slate-400 mb-4 text-sm sm:text-base">This live stream has ended.</p>
                      <Button 
                        onClick={() => setLocation(isAuthenticated ? "/user-dashboard" : "/")} 
                        className="bg-primary hover:bg-primary/80"
                      >
                        Find More Streams
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Chat - Below video on mobile/tablet, side panel on desktop */}
          <div className="lg:col-span-1 mt-2 lg:mt-0">
            <Card className="bg-slate-800 border-slate-700 h-[20vh] lg:h-[600px] flex flex-col">
              <CardHeader className="py-2 lg:py-4">
                <CardTitle className="text-white flex items-center text-sm lg:text-base">
                  <MessageCircle className="mr-2 h-4 w-4 lg:h-5 lg:w-5" />
                  Live Chat
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto lg:hidden text-slate-400 hover:text-white"
                    onClick={() => setShowChat(!showChat)}
                  >
                    {showChat ? 'Hide' : 'Show'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className={`flex-1 flex flex-col overflow-hidden px-2 lg:px-6 ${showChat ? 'block' : 'hidden lg:block'}`}>
                <ScrollArea className="flex-1 pr-2 lg:pr-4 relative" id="chat-scroll-area">
                  <div className="space-y-2 lg:space-y-3">
                    {chatMessages.length === 0 ? (
                      <div className="text-center py-4 lg:py-8">
                        <MessageCircle className="h-6 w-6 lg:h-8 lg:w-8 text-slate-500 mx-auto mb-2" />
                        <p className="text-slate-400 text-sm lg:text-base">No messages yet</p>
                        <p className="text-slate-500 text-xs lg:text-sm">Be the first to say hi!</p>
                      </div>
                    ) : (
                      chatMessages.map((msg: any, index: number) => (
                        <div key={index} className={`rounded-lg p-2 lg:p-3 ${(msg.tipAmount && msg.tipAmount > 0) ? 'bg-green-900/20 border border-green-500/30' : 'bg-slate-700/50'}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <span className={`font-medium text-xs lg:text-sm ${(msg.tipAmount && msg.tipAmount > 0) ? 'font-bold text-green-400' : 'text-primary'}`}>
                                {msg.senderName || msg.username || 'Anonymous'}:
                              </span>
                              {(msg.tipAmount && msg.tipAmount > 0) && (
                                <span className="text-green-300 text-xs lg:text-sm ml-2 font-bold">
                                  💰 tipped {msg.tipAmount} tokens!
                                </span>
                              )}
                              <p className="text-slate-300 mt-1 text-xs lg:text-sm">{msg.message}</p>
                            </div>
                          {(msg.tipAmount && msg.tipAmount > 0) && (
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
                
                {/* Scroll to bottom button */}
                {showScrollToBottom && (
                  <div className="absolute bottom-20 right-4 z-10">
                    <Button
                      size="sm"
                      onClick={scrollToBottom}
                      className="bg-primary hover:bg-primary/80 rounded-full p-2 shadow-lg"
                    >
                      ↓
                    </Button>
                  </div>
                )}
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
                      sendChatMessage();
                    }}
                    className="flex space-x-2"
                  >
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          sendChatMessage();
                        }
                      }}
                      placeholder={`Chat as ${displayName}...`}
                      className="flex-1 bg-slate-700 border-slate-600 text-white"
                    />
                    <Button 
                      type="submit"
                      disabled={!message.trim()}
                      className="bg-primary hover:bg-primary/80"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                )}
                
                {/* Custom Chat Actions */}
                {typedStream?.customActions && typedStream.customActions.length > 0 && (
                  <div className="mt-3 p-3 bg-slate-700/30 rounded-lg">
                    <h4 className="text-xs font-medium text-slate-300 mb-2">Quick Actions</h4>
                    <div className="flex flex-wrap gap-1">
                      {typedStream.customActions
                        .filter((action: any) => action.enabled)
                        .map((action: any) => (
                        <Button
                          key={action.id}
                          size="sm"
                          onClick={() => handleCustomAction(action)}
                          className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-2 py-1 h-6"
                          disabled={!isAuthenticated && tokensLeft < action.tokenCost}
                        >
                          {action.name} ({action.tokenCost} 🪙)
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {isAuthenticated ? 
                        `Actions cost tokens from your wallet` : 
                        `${tokensLeft} free tokens left`
                      }
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-2 flex justify-center gap-2">
                  {isAuthenticated && (
                    <Button 
                      size="sm"
                      onClick={() => setShowTipDialog(true)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Coins className="mr-1 h-4 w-4" />
                      Send Tip
                    </Button>
                  )}
                  
                  {!isAuthenticated && (
                    <>
                      <Button 
                        size="sm"
                        onClick={() => setShowLoginDialog(true)}
                        variant="outline"
                        className="border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white"
                      >
                        <LogIn className="mr-1 h-4 w-4" />
                        Login
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => setShowSignupDialog(true)}
                        className="bg-primary hover:bg-primary/80"
                      >
                        <UserPlus className="mr-1 h-4 w-4" />
                        Sign Up
                      </Button>
                    </>
                  )}
                </div>
              </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Other Live Streams Section - Show for guests and users */}
      {otherStreams && Array.isArray(otherStreams) && otherStreams.length > 0 && (
        <div className="mt-8">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-white mb-6">Other Live Streams</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherStreams
                .filter(stream => stream.id !== streamId) // Don't show current stream
                .slice(0, 6) // Show max 6 other streams
                .map((stream: any) => (
                <Card key={stream.id} className="bg-slate-800 border-slate-700 hover:border-primary/50 transition-colors">
                  <CardContent className="p-0">
                    <div className="relative aspect-video bg-slate-700 rounded-t-lg">

                      <div className="absolute top-2 left-2">
                        <Badge className="bg-red-500 text-white">
                          <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
                          LIVE
                        </Badge>
                      </div>
                      <div className="absolute bottom-2 right-2">
                        <Badge className="bg-black/50 text-white">
                          <Users className="mr-1 h-3 w-3" />
                          {stream.viewerCount?.toString() || '0'}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-white mb-2">{stream.title}</h3>
                      <p className="text-slate-400 text-sm mb-3">{stream.category}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-green-400 text-sm">
                          <Coins className="mr-1 h-3 w-3 inline" />
                          Min: {stream.minTip || 5} tokens
                        </span>
                        <Button 
                          size="sm"
                          onClick={() => window.location.href = `/stream/${stream.id}`}
                          className="bg-primary hover:bg-primary/80"
                        >
                          Watch
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Login Dialog */}
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Login to Your Account</DialogTitle>
            <DialogDescription className="text-slate-400">
              Welcome back! Please enter your credentials.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            loginMutation.mutate();
          }} className="space-y-4">
            <div>
              <Label className="text-slate-300">Username</Label>
              <Input
                value={loginData.username}
                onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                required
              />
            </div>
            
            <div>
              <Label className="text-slate-300">Password</Label>
              <Input
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                required
              />
            </div>
            
            <div className="flex space-x-2">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setShowLoginDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Logging in..." : "Login"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tip Dialog */}
      <Dialog open={showTipDialog} onOpenChange={setShowTipDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Send Tip to Creator</DialogTitle>
            <DialogDescription className="text-slate-400">
              Support this creator with tokens
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Tip Amount (tokens)</Label>
              <Input
                type="number"
                min={typedStream?.minTip || 1}
                value={tipAmount}
                onChange={(e) => setTipAmount(Number(e.target.value))}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder={`Minimum: ${typedStream?.minTip || 1} tokens`}
              />
            </div>
            
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Minimum Tip: {typedStream?.minTip || 1} tokens</span>
              <span>Your Balance: {typedUser?.walletBalance || 0} tokens</span>
            </div>
            
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setShowTipDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={sendTip}
                disabled={tipAmount < (typedStream?.minTip || 1) || tipAmount > (typedUser?.walletBalance || 0)}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Coins className="mr-1 h-4 w-4" />
                Send {tipAmount} Tokens
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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