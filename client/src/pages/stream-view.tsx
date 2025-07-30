import { useEffect, useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
  Gift
} from "lucide-react";
import type { User } from "@shared/schema";
import AgoraStreamViewer from "@/components/agora-stream-viewer";
import StreamTokenPanel from "@/components/stream-token-panel";
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
  
  // Unauthorized user viewing restrictions
  const [viewingTimeLeft, setViewingTimeLeft] = useState(120); // 2 minutes = 120 seconds
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalClosed, setLoginModalClosed] = useState(false);
  const [viewingBlocked, setViewingBlocked] = useState(false);
  
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

  const handleQuickTip = (amount: number) => {
    if (!wallet || (wallet as any).tokenBalance < amount) {
      toast({
        title: "Insufficient Tokens",
        description: "You don't have enough tokens for this tip",
        variant: "destructive",
      });
      return;
    }

    tipMutation.mutate({ amount });
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-white text-lg">Loading stream...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !typedStream) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-8">
            <div className="text-center">
              <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Stream Not Found</h2>
              <p className="text-slate-400 mb-6">This stream may have ended or doesn't exist.</p>
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
    <div className="h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col overflow-hidden"
         style={{ height: '100vh' }}>
      
      {/* Navigation */}
      {isAuthenticated && typedUser ? (
        <Navbar user={typedUser} />
      ) : (
        <div className="border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setLocation("/")}
                className="text-2xl font-bold text-white hover:text-purple-400 transition-colors"
              >
                StreamVibe
              </button>
              
              <div className="flex items-center space-x-4">
                {!isAuthenticated && !viewingBlocked && (
                  <div className="flex items-center space-x-2 bg-slate-800 px-3 py-2 rounded-lg">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    <span className="text-white text-sm">
                      Trial: {formatTime(viewingTimeLeft)}
                    </span>
                  </div>
                )}
                
                <Button 
                  onClick={() => setShowLoginModal(true)}
                  className="bg-purple-600 hover:bg-purple-700"
                  size="sm"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign Up
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          {/* Video Player */}
          <div className="relative h-[80vh] bg-black">
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
                
                {/* Video Overlay Controls - Mobile bottom left, Desktop right side corner */}
                <div className="absolute bottom-4 left-4 md:top-1/2 md:-translate-y-1/2 md:right-4 md:left-auto md:bottom-auto z-30 flex gap-2 md:flex-col">
                    {/* Quick Tip Buttons */}
                    {isAuthenticated ? (
                      <>
                        <Button
                          onClick={() => handleQuickTip(5)}
                          className="bg-purple-600/90 hover:bg-purple-700 backdrop-blur-sm text-white px-2 py-2 text-xs md:text-sm md:px-3 md:py-2 md:min-w-[80px]"
                          size="sm"
                        >
                          <Heart className="mr-1 h-3 w-3" />
                          <span className="hidden sm:inline">Tip </span>5
                        </Button>
                        <Button
                          onClick={() => handleQuickTip(10)}
                          className="bg-purple-600/90 hover:bg-purple-700 backdrop-blur-sm text-white px-2 py-2 text-xs md:text-sm md:px-3 md:py-2 md:min-w-[80px]"
                          size="sm"
                        >
                          <Heart className="mr-1 h-3 w-3" />
                          <span className="hidden sm:inline">Tip </span>10
                        </Button>
                        <Button
                          onClick={() => setShowTokenPanel(!showTokenPanel)}
                          className="bg-purple-600/90 hover:bg-purple-700 backdrop-blur-sm text-white px-2 py-2 text-xs md:text-sm md:px-3 md:py-2 md:min-w-[80px]"
                          size="sm"
                        >
                          <Gift className="mr-1 h-3 w-3" />
                          <span className="hidden sm:inline">More</span>
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => setShowLoginModal(true)}
                        className="bg-purple-600/90 hover:bg-purple-700 backdrop-blur-sm text-white px-2 py-2 text-xs md:text-sm md:px-3 md:py-2 md:min-w-[80px]"
                        size="sm"
                      >
                        <LogIn className="mr-1 h-3 w-3" />
                        <span className="hidden sm:inline">Login to </span>Tip
                      </Button>
                    )}
                </div>
              </>
            )}
          </div>

          {/* Stream Info Bar */}
          <div className="bg-slate-800 border-t border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-bold text-white">{typedStream?.title || 'Live Stream'}</h1>
                <Badge className="bg-red-600 text-white">LIVE</Badge>
                <div className="flex items-center space-x-2 text-slate-400">
                  <Users className="h-4 w-4" />
                  <span>{typedStream?.viewerCount || 0} viewers</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {!isAuthenticated && !viewingBlocked && (
                  <div className="flex items-center space-x-2 bg-slate-700 px-3 py-2 rounded-lg">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    <span className="text-white text-sm">
                      {formatTime(viewingTimeLeft)} remaining
                    </span>
                  </div>
                )}
                
                
              </div>
            </div>
          </div>
        </div>

        {/* Token Panel */}
        {showTokenPanel && (
          <div className="w-80 bg-slate-900 border-l border-slate-700 flex flex-col">
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
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center">
              {viewingBlocked && (
                <Lock className="mr-2 h-5 w-5 text-red-500" />
              )}
              {loginForm.isSignup ? (
                <>
                  <UserPlus className="mr-2 h-5 w-5 text-green-500" />
                  Create Account
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-5 w-5 text-blue-500" />
                  Login to StreamVibe
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {viewingBlocked && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 mb-4">
              <p className="text-red-200 text-sm">
                Your 2-minute trial has expired. Sign up now to continue watching unlimited streams!
              </p>
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            {loginForm.isSignup && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">First Name</Label>
                    <Input
                      value={loginForm.firstName}
                      onChange={(e) => setLoginForm(prev => ({ ...prev, firstName: e.target.value }))}
                      className="bg-slate-800 border-slate-600 text-white"
                      placeholder="John"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Last Name</Label>
                    <Input
                      value={loginForm.lastName}
                      onChange={(e) => setLoginForm(prev => ({ ...prev, lastName: e.target.value }))}
                      className="bg-slate-800 border-slate-600 text-white"
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-slate-300">Email (Optional)</Label>
                  <Input
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white"
                    placeholder="john@example.com"
                  />
                </div>
              </>
            )}

            <div>
              <Label className="text-slate-300">Username</Label>
              <Input
                value={loginForm.username}
                onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white"
                placeholder="Enter username"
                required
              />
            </div>

            <div>
              <Label className="text-slate-300">Password</Label>
              <Input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white"
                placeholder="Enter password"
                required
              />
            </div>

            <Button 
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full bg-purple-600 hover:bg-purple-700"
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
                className="text-purple-400 hover:text-purple-300 text-sm"
              >
                {loginForm.isSignup ? "Already have an account? Login" : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}