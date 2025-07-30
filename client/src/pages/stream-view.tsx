import { useEffect, useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Clock, 
  Coins, 
  Users, 
  ArrowLeft,
  AlertTriangle,
  UserPlus,
  LogIn
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { User } from "@shared/schema";
import AgoraStreamViewer from "@/components/agora-stream-viewer";
import Navbar from "@/components/navbar";

export default function StreamView() {
  const [, params] = useRoute("/stream/:streamId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const typedUser = user as User | undefined;
  
  // Simple stream state - Agora handles connections
  const [streamEnded, setStreamEnded] = useState(false);
  
  // Guest state with enhanced functionality
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes for guests
  const [tokensLeft, setTokensLeft] = useState(100);
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const [isGuestExpired, setIsGuestExpired] = useState(false);
  
  // Dialog states
  const [showSignupDialog, setShowSignupDialog] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  
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
  const { data: stream, isLoading, error } = useQuery({
    queryKey: ['/api/streams/', streamId],
    enabled: !!streamId,
  });
  
  const typedStream = stream as any;
  
  // Guest session creation
  const createGuestSessionMutation = useMutation({
    mutationFn: () => {
      const sessionId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      return apiRequest("POST", "/api/guest-session", {
        streamId: streamId,
        sessionId: sessionId
      });
    },
    onSuccess: (data: any) => {
      setGuestSessionId(data.sessionId);
      setTimeLeft(data.viewTimeRemaining || 300); // 5 minutes
      setTokensLeft(data.tokensRemaining || 100);
      console.log("Guest session created:", data);
    },
    onError: (error: any) => {
      console.error("Guest session creation failed:", error);
      if (error.message?.includes("Maximum guest sessions")) {
        toast({
          title: "Too Many Guest Sessions",
          description: "Please sign up for unlimited access",
          variant: "destructive",
        });
        setShowSignupDialog(true);
      }
    }
  });

  // User registration mutation
  const signupMutation = useMutation({
    mutationFn: (userData: typeof signupData) => 
      apiRequest("POST", "/api/auth/register", userData),
    onSuccess: () => {
      toast({
        title: "Account Created!",
        description: "Welcome to StreamVibe! You can now enjoy unlimited streaming.",
      });
      setShowSignupDialog(false);
      window.location.reload(); // Refresh to update auth state
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: (credentials: typeof loginData) => 
      apiRequest("POST", "/api/auth/login", credentials),
    onSuccess: () => {
      toast({
        title: "Welcome Back!",
        description: "Successfully logged in to your account.",
      });
      setShowLoginDialog(false);
      window.location.reload(); // Refresh to update auth state
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error.message || "Please check your credentials",
        variant: "destructive",
      });
    }
  });

  // Create guest session on load if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !guestSessionId && streamId && !isGuestExpired) {
      createGuestSessionMutation.mutate();
    }
  }, [streamId, isAuthenticated, guestSessionId, isGuestExpired]);

  // Guest timer countdown
  useEffect(() => {
    if (!isAuthenticated && guestSessionId && timeLeft > 0 && !isGuestExpired) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1;
          
          // Show warning at 1 minute
          if (newTime === 60 && !showTimeWarning) {
            setShowTimeWarning(true);
            toast({
              title: "1 Minute Remaining",
              description: "Sign up now for unlimited viewing!",
              variant: "destructive",
            });
          }
          
          // Expire at 0
          if (newTime <= 0) {
            setIsGuestExpired(true);
            setShowSignupDialog(true);
            toast({
              title: "Guest Time Expired",
              description: "Create an account to continue watching",
              variant: "destructive",
            });
          }
          
          return newTime;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isAuthenticated, guestSessionId, timeLeft, showTimeWarning, isGuestExpired]);

  // Form handlers
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupData.password !== signupData.confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please ensure both passwords are identical",
        variant: "destructive",
      });
      return;
    }
    signupMutation.mutate(signupData);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginData);
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Display name logic
  const displayName = isAuthenticated 
    ? typedUser?.username || typedUser?.firstName || 'User'
    : `Guest_${guestSessionId?.slice(-6) || 'User'}`;

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
    <div className="h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col overflow-hidden">
      {/* Navigation - Use proper Navbar component if authenticated, otherwise show simple navigation */}
      {isAuthenticated && typedUser ? (
        <Navbar user={typedUser} />
      ) : (
        <div className="border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              {/* Website Name - Clickable to go home */}
              <button
                onClick={() => setLocation("/")}
                className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent hover:from-purple-300 hover:to-pink-300 transition-colors"
              >
                StreamVibe
              </button>
              
              {/* Auth Buttons - Only show for non-authenticated users */}
              <div className="flex items-center space-x-3">
                <Button 
                  variant="ghost"
                  onClick={() => setShowLoginDialog(true)}
                  className="text-slate-300 hover:text-white"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Login
                </Button>
                <Button 
                  onClick={() => setShowSignupDialog(true)}
                  className="bg-primary hover:bg-primary/80"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Sign Up
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guest Status Bar - Show time and tokens for guests */}
      {!isAuthenticated && !isGuestExpired && (
        <div className="bg-slate-800/50 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <div className="flex items-center justify-center space-x-4">
              <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
                <Clock className="mr-1 h-3 w-3" />
                {formatTime(timeLeft)} remaining
              </Badge>
              <Badge variant="outline" className="text-blue-500 border-blue-500/50">
                <Coins className="mr-1 h-3 w-3" />
                {tokensLeft} chat tokens
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Full Screen Video */}
      <div className="flex-1 overflow-hidden">
        {/* Video Stream - Full Screen Container */}
        <div className="w-full h-full bg-black overflow-hidden">
            {!streamEnded && typedStream ? (
              <AgoraStreamViewer
                streamId={typedStream.id}
                userId={typedUser?.id || guestSessionId || ''}
                username={displayName as string}
                creatorName={typedStream.creatorName || 'Creator'}
                title={typedStream.title}
                stream={typedStream}
                isGuest={!isAuthenticated}
                guestSessionId={guestSessionId}
                guestTokens={tokensLeft}
                onGuestTokenUpdate={(tokens) => setTokensLeft(tokens)}
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

      {/* Other Live Streams Section - Show for guests and users */}
      {otherStreams && Array.isArray(otherStreams) && otherStreams.length > 0 && (
        <div className="mt-8">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-white mb-6">Other Live Streams</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(otherStreams as any[])
                .filter((stream: any) => stream.id !== streamId) // Don't show current stream
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
                        <span className="text-primary font-medium">{stream.creatorName}</span>
                        <Button
                          size="sm"
                          onClick={() => setLocation(`/stream/${stream.id}`)}
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

      {/* Sign up dialog */}
      <Dialog open={showSignupDialog} onOpenChange={setShowSignupDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Create Your Account</DialogTitle>
            <DialogDescription className="text-slate-400">
              Join StreamVibe to enjoy unlimited viewing and interact with creators
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <Label className="text-slate-300">Username</Label>
              <Input
                type="text"
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

      {/* Login dialog */}
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Login to Your Account</DialogTitle>
            <DialogDescription className="text-slate-400">
              Access your account to continue watching
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label className="text-slate-300">Username</Label>
              <Input
                type="text"
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
            
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/80"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Logging in..." : "Login"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}