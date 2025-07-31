import { useEffect, useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  ArrowLeft,
  AlertTriangle,
  UserPlus,
  LogIn,
  Coins,
  X,
  Lock,
  Clock,
  Heart,
  Gift,
  MessageCircle,
  Send,
  Phone,
  Video,
  Search,
  Menu
} from "lucide-react";
import type { User } from "@shared/schema";
import AgoraStreamViewer from "@/components/agora-stream-viewer";
import StreamTokenPanel from "@/components/stream-token-panel";
import { StreamChat } from "@/components/StreamChat";
import Navbar from "@/components/navbar";

export default function StreamView() {
  const [, params] = useRoute("/stream/:streamId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const typedUser = user as User | undefined;
  
  // Simple stream state - Agora handles connections
  const [streamEnded, setStreamEnded] = useState(false);
  const [showTokenPanel, setShowTokenPanel] = useState(false);
  const [showPrivateCallDialog, setShowPrivateCallDialog] = useState(false);
  const [showCustomTipDialog, setShowCustomTipDialog] = useState(false);
  const [customTipAmount, setCustomTipAmount] = useState("");
  const [privateCallMessage, setPrivateCallMessage] = useState("");
  
  // Unauthorized user viewing restrictions
  const [viewingTimeLeft, setViewingTimeLeft] = useState(120); // 2 minutes = 120 seconds
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalClosed, setLoginModalClosed] = useState(false);
  const [viewingBlocked, setViewingBlocked] = useState(false);
  
  // Chat system state
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Login form state
  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
    isSignup: false,
    firstName: "",
    lastName: "",
    email: ""
  });

  const streamId = params?.streamId;
  const queryClient = useQueryClient();
  
  // Fetch stream data
  const { data: stream, isLoading, error } = useQuery({
    queryKey: ['/api/streams/', streamId],
    enabled: !!streamId,
  });
  
  // Fetch user wallet
  const { data: wallet } = useQuery({
    queryKey: ["/api/wallet"],
    enabled: isAuthenticated,
  });
  
  // Fetch chat messages (initial load only, real-time updates via WebSocket)
  const { data: messages } = useQuery({
    queryKey: ["/api/streams", streamId, "chat"],
    enabled: !!streamId,
    refetchInterval: false, // Disable polling, use WebSocket for real-time updates
    staleTime: 30000, // Keep data fresh for 30 seconds for better real-time performance
  });
  
  // Update chat messages when data changes - keep only last 3 messages for perfect screen fit
  useEffect(() => {
    if (messages && Array.isArray(messages)) {
      console.log('📩 Loading initial chat messages:', messages.length);
      const recentMessages = messages.slice(-3);
      console.log('📩 Showing last 3 messages for perfect screen fit:', recentMessages.length);
      setChatMessages(recentMessages);
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // WebSocket connection for real-time chat
  useEffect(() => {
    if (!streamId) return;

    // Import socket.io-client
    import('socket.io-client').then(({ io }) => {
      const newSocket = io(window.location.origin, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        query: {
          userId: typedUser?.id || 'guest',
          role: typedUser?.role || 'guest'
        }
      });

      newSocket.on('connect', () => {
        console.log('🔗 Viewer WebSocket connected for chat');
        // Join stream room for real-time updates
        newSocket.emit('join-stream', { streamId, userId: typedUser?.id || 'guest' });
      });

      newSocket.on('disconnect', () => {
        console.log('❌ Viewer WebSocket disconnected from chat server');
      });

      // Listen for real-time chat messages
      newSocket.on('chat-message', (data) => {
        console.log('🔥 REAL-TIME: Viewer received chat message:', data);
        setChatMessages(prev => {
          console.log('🔥 REAL-TIME: Current chat messages:', prev.length);
          // Avoid duplicates by checking message ID first
          const exists = prev.some(msg => msg.id === data.id);
          if (!exists) {
            const newMessage = {
              id: data.id,
              senderName: data.senderName,
              senderRole: data.senderRole,
              message: data.message,
              tipAmount: data.tipAmount || 0,
              createdAt: data.createdAt || new Date().toISOString(),
              username: data.username,
              userRole: data.userRole,
              isCreator: data.isCreator || false
            };
            const newMessages = [...prev, newMessage];
            console.log('🔥 REAL-TIME: Adding new message, total will be:', newMessages.length);
            // Keep only last 3 messages for perfect screen fit
            const limitedMessages = newMessages.slice(-3);
            console.log('🔥 REAL-TIME: Final message count after limit:', limitedMessages.length);
            // Force re-render by returning new array
            setTimeout(() => {
              chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
            return [...limitedMessages];
          }
          console.log('🔥 REAL-TIME: Message already exists, skipping');
          return prev;
        });
      });

      // Listen for tip notifications
      newSocket.on('tip-message', (data) => {
        console.log('Viewer received tip notification:', data);
        const tipNotification = {
          id: `tip_${Date.now()}`,
          senderName: 'System',
          senderRole: 'system',
          message: `💰 ${data.username} tipped ${data.amount} tokens!`,
          tipAmount: data.amount,
          createdAt: new Date().toISOString()
        };
        setChatMessages(prev => {
          const newMessages = [...prev, tipNotification];
          // Keep only last 10 messages
          return newMessages.slice(-10);
        });
        setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      });

      return () => {
        newSocket.disconnect();
      };
    });
  }, [streamId, typedUser?.id, typedUser?.role]);
  
  const typedStream = stream as any;
  
  // Generate display name for guest/authenticated users
  const displayName = typedUser?.username || `Guest_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: any) => {
      const endpoint = loginForm.isSignup ? "/api/register" : "/api/login";
      return await apiRequest("POST", endpoint, credentials);
    },
    onSuccess: () => {
      setShowLoginModal(false);
      setLoginModalClosed(false);
      setViewingBlocked(false);
      setViewingTimeLeft(120);
      setLoginForm({
        username: "",
        password: "",
        isSignup: false,
        firstName: "",
        lastName: "",
        email: ""
      });
      toast({
        title: loginForm.isSignup ? "Account Created!" : "Welcome Back!",
        description: "You can now enjoy unlimited viewing",
      });
      // Refresh page to update auth state
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({
        title: loginForm.isSignup ? "Signup Failed" : "Login Failed", 
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      return await apiRequest("POST", `/api/streams/${streamId}/chat`, {
        message,
        tipAmount: 0
      });
    },
    onSuccess: (data) => {
      // Don't invalidate queries since WebSocket handles real-time updates
      setNewMessage("");
      // The message will appear via WebSocket, no need to manually add
    },
    onError: (error: Error) => {
      toast({
        title: "Chat Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Send tip mutation
  const tipMutation = useMutation({
    mutationFn: async ({ amount }: { amount: number }) => {
      return await apiRequest("POST", "/api/transactions/tip", {
        streamId,
        amount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      toast({
        title: "Tip Sent!",
        description: `Successfully tipped ${typedStream?.creator?.username || 'creator'}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Tip Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handle quick tip function
  const handleQuickTip = (amount: number) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    tipMutation.mutate({ amount });
  };

  // Handle custom tip submission
  const handleCustomTip = () => {
    const amount = parseInt(customTipAmount);
    if (amount > 0) {
      handleQuickTip(amount);
      setShowCustomTipDialog(false);
      setCustomTipAmount("");
    }
  };

  // Unauthorized viewing timer effect
  useEffect(() => {
    if (!isAuthenticated && !viewingBlocked) {
      const timer = setInterval(() => {
        setViewingTimeLeft(prev => {
          if (prev <= 1) {
            setViewingBlocked(true);
            setShowLoginModal(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isAuthenticated, viewingBlocked]);

  // Modal persistence effect - reopens every 3 seconds if closed
  useEffect(() => {
    if (!isAuthenticated && viewingBlocked && loginModalClosed) {
      const reopenTimer = setTimeout(() => {
        setShowLoginModal(true);
        setLoginModalClosed(false);
      }, 3000);

      return () => clearTimeout(reopenTimer);
    }
  }, [isAuthenticated, viewingBlocked, loginModalClosed]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loginForm.isSignup) {
      // Signup validation
      if (!loginForm.username || !loginForm.password || !loginForm.firstName || !loginForm.lastName) {
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }
      
      loginMutation.mutate({
        username: loginForm.username,
        password: loginForm.password,
        firstName: loginForm.firstName,
        lastName: loginForm.lastName,
        email: loginForm.email,
        role: "viewer"
      });
    } else {
      // Login validation
      if (!loginForm.username || !loginForm.password) {
        toast({
          title: "Missing Information",
          description: "Please enter your username and password",
          variant: "destructive",
        });
        return;
      }
      
      loginMutation.mutate({
        username: loginForm.username,
        password: loginForm.password,
      });
    }
  };

  const handleModalClose = () => {
    if (!isAuthenticated && viewingBlocked) {
      setLoginModalClosed(true);
    }
    setShowLoginModal(false);
  };



  // Private call request mutation
  const privateCallMutation = useMutation({
    mutationFn: async (data: { creatorId: string; streamId: string; requestMessage: string }) => {
      const response = await apiRequest("POST", "/api/private-call-requests", data);
      return response.json();
    },
    onSuccess: () => {
      setShowPrivateCallDialog(false);
      setPrivateCallMessage("");
      toast({
        title: "Private Call Requested",
        description: "Your request has been sent to the creator.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Request Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handlePrivateCallRequest = () => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please login to request private calls",
        variant: "destructive",
      });
      return;
    }
    setShowPrivateCallDialog(true);
  };

  const submitPrivateCallRequest = () => {
    if (!typedStream?.creatorId || !streamId) return;
    
    privateCallMutation.mutate({
      creatorId: typedStream.creatorId,
      streamId,
      requestMessage: privateCallMessage
    });
  };
  
  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    console.log('🔍 Client: Attempting to send message:', newMessage);
    console.log('🔍 Client: Is authenticated:', isAuthenticated);
    console.log('🔍 Client: User data:', typedUser);
    console.log('🔍 Client: Stream ID:', streamId);
    
    if (!isAuthenticated) {
      console.log('❌ Client: User not authenticated');
      toast({
        title: "Login Required",
        description: "Please login to send messages",
        variant: "destructive",
      });
      return;
    }
    
    console.log('✅ Client: Calling sendMessageMutation with message:', newMessage);
    sendMessageMutation.mutate({ message: newMessage });
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="bg-card border-border">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-foreground text-lg">Loading stream...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !typedStream) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="bg-card border-border">
          <CardContent className="p-8">
            <div className="text-center">
              <AlertTriangle className="h-16 w-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">Stream Not Found</h2>
              <p className="text-muted-foreground mb-6">This stream may have ended or doesn't exist.</p>
              <Button 
                onClick={() => setLocation("/")} 
                className="bg-primary hover:bg-primary/80"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col"
         style={{ minHeight: '100vh' }}>
      
      {/* Navigation */}
      {isAuthenticated && typedUser ? (
        <Navbar user={typedUser} />
      ) : (
        <nav className="bg-white border-b border-border sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
            <div className="flex items-center justify-between h-14 sm:h-16">
              <div className="flex items-center flex-1">
                <div className="flex-shrink-0">
                  <button
                    onClick={() => setLocation("/")}
                    className="flex items-center space-x-1.5 sm:space-x-2 cursor-pointer"
                  >
                    <Video className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-primary" />
                    <span className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">StreamVibe</span>
                  </button>
                </div>
                
                {/* Desktop Search */}
                <div className="hidden lg:block ml-6 xl:ml-10 flex-1 max-w-lg">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search streams, creators..."
                      className="bg-background border-input focus:border-primary pl-10"
                    />
                  </div>
                </div>
              </div>
              
              {/* Right side content */}
              <div className="flex items-center space-x-4">
                {!isAuthenticated && !viewingBlocked && (
                  <div className="flex items-center space-x-2 bg-card px-3 py-2 rounded-lg border">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-foreground text-sm">
                      Trial: {formatTime(viewingTimeLeft)}
                    </span>
                  </div>
                )}
                
                {/* Desktop Auth Buttons */}
                <div className="hidden lg:flex items-center space-x-4">
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setLoginForm(prev => ({ ...prev, isSignup: false }));
                      setShowLoginModal(true);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Login
                  </Button>
                  <Button 
                    onClick={() => {
                      setLoginForm(prev => ({ ...prev, isSignup: true }));
                      setShowLoginModal(true);
                    }}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Sign Up
                  </Button>
                </div>
                
                {/* Mobile Menu Button */}
                <div className="lg:hidden">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowLoginModal(true)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <div className="flex-1 flex">
        <div className="flex-1 relative">
          {/* Video Player */}
          <div className="relative h-[65vh] bg-black">
            {viewingBlocked ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-20">
                <div className="text-center max-w-md">
                  <Lock className="h-16 w-16 text-red-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-white mb-2">Trial Expired</h2>
                  <p className="text-slate-300 mb-6">
                    Your 2-minute trial has ended. Please sign up to continue watching.
                  </p>
                  <Button 
                    onClick={() => setShowLoginModal(true)}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign Up to Continue
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <AgoraStreamViewer
                  streamId={streamId!}
                  userId={typedUser?.id || 'guest'}
                  username={displayName}
                  creatorName={typedStream?.creator?.username || 'Creator'}
                  title={typedStream?.title || 'Live Stream'}
                  stream={typedStream}
                />
                
                {/* Creator Name Overlay - Top Right */}
                <div className="absolute top-4 right-4 z-20">
                  <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-white font-semibold text-sm">
                        {typedStream?.creator?.username || 'Creator'}
                      </span>
                    </div>
                  </div>
                </div>
                

              </>
            )}
          </div>
          
          {/* Chat Section - Below Video */}
          <div className="h-[35vh] min-h-[400px] bg-white border-t border-gray-200">
            <StreamChat
              streamId={streamId!}
              messages={chatMessages}
              isAuthenticated={isAuthenticated}
              onSendMessage={handleSendMessage}
              onQuickTip={handleQuickTip}
              onPrivateCall={handlePrivateCallRequest}
              onLogin={() => setShowLoginModal(true)}
              isLoading={sendMessageMutation.isPending}
            />
          </div>
        </div>

        {/* Token Panel */}
        {showTokenPanel && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
            <StreamTokenPanel
              streamId={streamId!}
              creatorName={typedStream?.creator?.username || 'Creator'}
              isVisible={showTokenPanel}
              onToggle={() => setShowTokenPanel(!showTokenPanel)}
            />
          </div>
        )}
      </div>

      {/* Login Modal */}
      <Dialog open={showLoginModal} onOpenChange={handleModalClose}>
        <DialogContent className="bg-white border-gray-300 text-black max-w-md">
          <DialogHeader>
            <DialogTitle className="text-black flex items-center">
              {viewingBlocked && (
                <Lock className="mr-2 h-5 w-5 text-blue-600" />
              )}
              {loginForm.isSignup ? (
                <>
                  <UserPlus className="mr-2 h-5 w-5 text-blue-600" />
                  Create Account
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-5 w-5 text-blue-600" />
                  Login to StreamVibe
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {viewingBlocked && (
            <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 mb-4">
              <p className="text-blue-800 text-sm">
                Your 2-minute trial has expired. Sign up now to continue watching unlimited streams!
              </p>
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            {loginForm.isSignup && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-700">First Name</Label>
                    <Input
                      value={loginForm.firstName}
                      onChange={(e) => setLoginForm(prev => ({ ...prev, firstName: e.target.value }))}
                      className="bg-white border-gray-300 text-black"
                      placeholder="John"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700">Last Name</Label>
                    <Input
                      value={loginForm.lastName}
                      onChange={(e) => setLoginForm(prev => ({ ...prev, lastName: e.target.value }))}
                      className="bg-white border-gray-300 text-black"
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-700">Email (Optional)</Label>
                  <Input
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                    className="bg-white border-gray-300 text-black"
                    placeholder="john@example.com"
                  />
                </div>
              </>
            )}

            <div>
              <Label className="text-gray-700">Username</Label>
              <Input
                value={loginForm.username}
                onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                className="bg-white border-gray-300 text-black"
                placeholder="Enter username"
                required
              />
            </div>

            <div>
              <Label className="text-gray-700">Password</Label>
              <Input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                className="bg-white border-gray-300 text-black"
                placeholder="Enter password"
                required
              />
            </div>

            <Button 
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loginMutation.isPending ? (
                "Please wait..."
              ) : loginForm.isSignup ? (
                "Create Account & Continue"
              ) : (
                "Login & Continue"
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setLoginForm(prev => ({ 
                  ...prev, 
                  isSignup: !prev.isSignup,
                  username: "",
                  password: "",
                  firstName: "",
                  lastName: "",
                  email: ""
                }))}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                {loginForm.isSignup ? "Already have an account? Login" : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Private Call Request Dialog */}
      <Dialog open={showPrivateCallDialog} onOpenChange={setShowPrivateCallDialog}>
        <DialogContent className="bg-white border-gray-300">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center text-black">
              <Phone className="w-6 h-6 mr-2 text-blue-600" />
              Request Private Call
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Send a private call request to {typedStream?.creator?.username || 'Creator'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Cost per call</span>
                <Badge variant="secondary" className="bg-blue-600 text-white">
                  <Coins className="w-3 h-3 mr-1" />
                  500 Tokens
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Minimum duration</span>
                <span className="text-sm text-black">5 minutes</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="callMessage" className="text-gray-700">Message (Optional)</Label>
              <Input
                id="callMessage"
                placeholder="Say something to the creator..."
                value={privateCallMessage}
                onChange={(e) => setPrivateCallMessage(e.target.value)}
                className="bg-white border-gray-300 text-black"
              />
            </div>
          </div>
          
          <div className="flex space-x-2 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setShowPrivateCallDialog(false)}
              className="flex-1 border-slate-600"
            >
              Cancel
            </Button>
            <Button 
              onClick={submitPrivateCallRequest}
              disabled={privateCallMutation.isPending}
              className="flex-1 bg-pink-600 hover:bg-pink-700"
            >
              {privateCallMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Requesting...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4 mr-2" />
                  Send Request
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Tip Dialog */}
      <Dialog open={showCustomTipDialog} onOpenChange={setShowCustomTipDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center">
              <Coins className="w-6 h-6 mr-2 text-yellow-500" />
              Custom Tip Amount
            </DialogTitle>
            <DialogDescription>
              Send a custom tip to {typedStream?.creator?.username || 'Creator'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customAmount">Token Amount</Label>
              <Input
                id="customAmount"
                type="number"
                placeholder="Enter amount..."
                value={customTipAmount}
                onChange={(e) => setCustomTipAmount(e.target.value)}
                className="bg-slate-700 border-slate-600"
                min="1"
              />
            </div>
          </div>
          
          <div className="flex space-x-2 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setShowCustomTipDialog(false)}
              className="flex-1 border-slate-600"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCustomTip}
              disabled={!customTipAmount || parseInt(customTipAmount) <= 0}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Coins className="w-4 h-4 mr-2" />
              Send Tip
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}