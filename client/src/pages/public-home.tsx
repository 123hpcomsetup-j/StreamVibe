import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Play, Users, Video, Heart, Coins, ChevronRight, UserPlus, LogIn, Menu, X, Search } from "lucide-react";
import { io } from "socket.io-client";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export default function PublicHome() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Redirect authenticated users to their appropriate dashboards
  useEffect(() => {
    if (isAuthenticated && user) {
      const typedUser = user as User;
      if (typedUser.role === 'admin') {
        setLocation('/admin-panel');
      } else if (typedUser.role === 'creator') {
        setLocation('/creator-dashboard');
      } else if (typedUser.role === 'viewer') {
        setLocation('/user-dashboard');
      }
    }
  }, [isAuthenticated, user, setLocation]);
  
  // Dialog states
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authData, setAuthData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    role: "viewer" as "viewer" | "creator"
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { data: liveStreams = [], isLoading: streamsLoading } = useQuery({
    queryKey: ["/api/streams/live"],
    retry: false,
    refetchInterval: 5000, // Refresh every 5 seconds as fallback
  });

  const { data: onlineUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users/online"],
    retry: false,
    refetchInterval: 10000, // Refresh every 10 seconds as fallback
  });

  // Setup WebSocket for real-time updates
  useEffect(() => {
    const socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('PublicHome connected to WebSocket for real-time updates');
    });

    // Listen for stream status changes
    socket.on('stream-status-changed', (data) => {
      console.log('Stream status changed:', data);
      // Invalidate and refetch live streams when status changes
      queryClient.invalidateQueries({ queryKey: ["/api/streams/live"] });
    });

    // Listen for user status changes
    socket.on('user-status-changed', (data) => {
      console.log('User status changed:', data);
      // Invalidate and refetch online users when status changes
      queryClient.invalidateQueries({ queryKey: ["/api/users/online"] });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Authentication mutations
  const loginMutation = useMutation({
    mutationFn: (data: { username: string; password: string }) =>
      apiRequest("POST", "/api/auth/login", data),
    onSuccess: () => {
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      setShowAuthDialog(false);
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  const signupMutation = useMutation({
    mutationFn: (data: { username: string; password: string; role: string }) =>
      apiRequest("POST", "/api/auth/register", data),
    onSuccess: () => {
      toast({
        title: "Account Created!",
        description: "You can now log in with your credentials.",
      });
      setIsLoginMode(true);
      setAuthData({ username: "", password: "", confirmPassword: "", role: "viewer" });
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Form handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoginMode) {
      loginMutation.mutate({ 
        username: authData.username, 
        password: authData.password 
      });
    } else {
      if (authData.password !== authData.confirmPassword) {
        toast({
          title: "Passwords Don't Match",
          description: "Please ensure both passwords are identical",
          variant: "destructive",
        });
        return;
      }
      signupMutation.mutate({
        username: authData.username,
        password: authData.password,
        role: authData.role
      });
    }
  };

  // Filter only creators who are online
  const onlineCreators = Array.isArray(onlineUsers) ? onlineUsers.filter((user: any) => user.role === 'creator') : [];

  // Simply use the live streams data from React Query without socket complications
  const displayStreams = Array.isArray(liveStreams) ? liveStreams.filter((stream: any) => stream.isLive) : [];

  // Don't render anything if authenticated user is being redirected
  if (isAuthenticated && user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation - Only show for non-authenticated users */}
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
              
              {/* Desktop Auth Buttons */}
              <div className="hidden lg:flex items-center space-x-4">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setAuthData({ ...authData, role: "viewer" });
                    setIsLoginMode(true);
                    setShowAuthDialog(true);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Login
                </Button>
                <Button 
                  onClick={() => {
                    setAuthData({ ...authData, role: "viewer" });
                    setIsLoginMode(false);
                    setShowAuthDialog(true);
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
                  onClick={() => setShowAuthDialog(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              Live Streaming 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600"> Community</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Join thousands of creators and viewers in real-time streaming experiences. Watch live content, chat with creators, and be part of an amazing community.
            </p>
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-2xl mx-auto">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-2xl font-bold text-primary mb-1">
                  {displayStreams.length}
                </div>
                <div className="text-muted-foreground text-sm">Live Streams</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-2xl font-bold text-green-500 mb-1">
                  {onlineCreators.length}
                </div>
                <div className="text-muted-foreground text-sm">Online Creators</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-500 mb-1">
                  {Array.isArray(onlineUsers) ? onlineUsers.length : 0}
                </div>
                <div className="text-muted-foreground text-sm">Active Users</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => {
                  setAuthData({ ...authData, role: "viewer" });
                  setIsLoginMode(false);
                  setShowAuthDialog(true);
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg font-semibold shadow-lg border border-primary/20"
              >
                <Play className="mr-3 h-6 w-6" />
                I Want to Watch
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                onClick={() => {
                  setAuthData({ ...authData, role: "creator" });
                  setIsLoginMode(false);
                  setShowAuthDialog(true);
                }}
                className="border-2 border-primary bg-background text-primary hover:bg-primary hover:text-primary-foreground px-8 py-4 text-lg font-semibold shadow-lg"
              >
                <Video className="mr-3 h-6 w-6" />
                I Want to Create
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Streams Section */}
      <div className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-foreground">Live Now</h2>
            <Button 
              variant="outline" 
              onClick={() => {
                setAuthData({ ...authData, role: "viewer" });
                setIsLoginMode(true);
                setShowAuthDialog(true);
              }}
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              View All <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {streamsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="bg-card border-border animate-pulse">
                  <div className="aspect-video bg-muted rounded-t-lg"></div>
                  <CardContent className="p-4">
                    <div className="h-4 bg-muted rounded mb-2"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : displayStreams.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border border-border">
              <Video className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Live Streams</h3>
              <p className="text-muted-foreground mb-6">Be the first to start streaming today!</p>
              <Button 
                onClick={() => setLocation("/creator-login")}
                className="bg-primary hover:bg-primary/90"
              >
                Start Your Stream
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayStreams.slice(0, 6).map((stream: any) => (
                <Card key={stream.id} className="bg-card border-border hover:shadow-lg transition-all duration-200 cursor-pointer group">
                  <div className="aspect-video relative bg-muted rounded-t-lg flex items-center justify-center overflow-hidden">
                    {/* Creator Profile Image as Thumbnail */}
                    {stream.creatorProfileImage ? (
                      <img 
                        src={stream.creatorProfileImage} 
                        alt={`${stream.creatorFirstName} ${stream.creatorLastName}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <Video className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                        <p className="text-foreground text-sm font-medium">Live Stream</p>
                        <p className="text-muted-foreground text-xs">Click to watch</p>
                      </div>
                    )}
                    
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-red-500 text-white border-0">
                        <div className="w-1.5 h-1.5 bg-white rounded-full mr-1 animate-pulse"></div>
                        LIVE
                      </Badge>
                    </div>
                    <div className="absolute top-3 right-3">
                      <Badge variant="secondary" className="bg-background/80 text-foreground border border-border">
                        <Users className="mr-1 h-3 w-3" />
                        {stream.viewerCount || 0}
                      </Badge>
                    </div>
                    
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-primary/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        onClick={() => {
                          // Navigate to stream view as guest
                          setLocation(`/stream/${stream.id}`);
                        }}
                        className="bg-background text-primary hover:bg-background/90 border border-primary"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Watch Stream
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center overflow-hidden">
                        {stream.creatorProfileImage ? (
                          <img 
                            src={stream.creatorProfileImage} 
                            alt={stream.creatorFirstName} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Video className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">{stream.title}</h4>
                        <p className="text-muted-foreground text-sm">
                          {stream.creatorFirstName && stream.creatorLastName 
                            ? `${stream.creatorFirstName} ${stream.creatorLastName}` 
                            : stream.creatorName} • {stream.category}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-primary text-sm font-medium">
                        <Coins className="mr-1 h-3 w-3 inline" />
                        Min: {stream.minTip || 5} tokens
                      </span>
                      <span className="text-muted-foreground text-sm">
                        <Users className="mr-1 h-3 w-3 inline" />
                        {stream.viewerCount || 0} watching
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Online Creators Section */}
      <div className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-foreground flex items-center">
              <Users className="mr-3 h-8 w-8 text-primary" />
              Online Creators ({onlineCreators.length})
            </h2>
            <Button 
              variant="outline" 
              onClick={() => setLocation("/user-login")}
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Join Community <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {usersLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[...Array(12)].map((_, i) => (
                <Card key={i} className="bg-card border-border animate-pulse">
                  <CardContent className="p-4 text-center">
                    <div className="w-16 h-16 bg-muted rounded-full mx-auto mb-3"></div>
                    <div className="h-4 bg-muted rounded mb-2"></div>
                    <div className="h-3 bg-muted rounded w-2/3 mx-auto"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : onlineCreators.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border border-border">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Creators Online</h3>
              <p className="text-muted-foreground mb-6">Check back later or become a creator yourself!</p>
              <Button 
                onClick={() => setLocation("/creator-login")}
                className="bg-primary hover:bg-primary/90"
              >
                Start Creating
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {onlineCreators.map((creator: any) => (
                <Card key={creator.id} className="bg-card border-border hover:shadow-lg transition-all duration-200">
                  <CardContent className="p-4 text-center">
                    <div className="relative w-16 h-16 mx-auto mb-3">
                      {creator.profileImageUrl ? (
                        <img 
                          src={creator.profileImageUrl}
                          alt={`${creator.firstName || creator.username || 'Creator'}'s profile`}
                          className="w-full h-full rounded-full object-cover border-2 border-primary"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-muted border-2 border-primary flex items-center justify-center">
                          <Users className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-background rounded-full animate-pulse"></div>
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className="font-medium text-foreground text-sm truncate">
                        {creator.firstName && creator.lastName 
                          ? `${creator.firstName} ${creator.lastName}` 
                          : creator.username || 'Creator'}
                      </h4>
                      <Badge 
                        variant="outline" 
                        className="text-xs border-primary text-primary"
                      >
                        creator
                      </Badge>
                      <div className="flex items-center justify-center text-xs text-green-500">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></div>
                        Online
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-16 bg-muted/50">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Ready to Join StreamVibe?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Choose your path: watch amazing content or start creating your own
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => {
                setAuthData({ ...authData, role: "viewer" });
                setIsLoginMode(false);
                setShowAuthDialog(true);
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg font-semibold shadow-lg border border-primary/20"
            >
              <Play className="mr-3 h-6 w-6" />
              I Want to Watch
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => {
                setAuthData({ ...authData, role: "creator" });
                setIsLoginMode(false);
                setShowAuthDialog(true);
              }}
              className="border-2 border-primary bg-background text-primary hover:bg-primary hover:text-primary-foreground px-8 py-4 text-lg font-semibold shadow-lg"
            >
              <Video className="mr-3 h-6 w-6" />
              I Want to Create
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-primary mb-4">StreamVibe</h3>
            <p className="text-muted-foreground mb-4">
              The future of live streaming and creator economy
            </p>
            <div className="flex justify-center space-x-6">
              <Button 
                variant="link" 
                onClick={() => {
                  setAuthData({ ...authData, role: "viewer" });
                  setIsLoginMode(false);
                  setShowAuthDialog(true);
                }}
                className="text-muted-foreground hover:text-primary"
              >
                Watch Streams
              </Button>
              <Button 
                variant="link" 
                onClick={() => {
                  setAuthData({ ...authData, role: "creator" });
                  setIsLoginMode(false);
                  setShowAuthDialog(true);
                }}
                className="text-muted-foreground hover:text-primary"
              >
                Become Creator
              </Button>
              <Button 
                variant="link" 
                onClick={() => setLocation("/admin")}
                className="text-muted-foreground hover:text-primary"
              >
                Admin
              </Button>
            </div>
          </div>
        </div>
      </footer>

      {/* Authentication Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {isLoginMode ? "Welcome Back" : "Join StreamVibe"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {isLoginMode 
                ? "Enter your credentials to access your account" 
                : "Create your account to start watching and interacting with creators"
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <Label className="text-foreground">Username</Label>
              <Input
                type="text"
                value={authData.username}
                onChange={(e) => setAuthData({ ...authData, username: e.target.value })}
                className="bg-background border-input text-foreground"
                required
              />
            </div>
            
            <div>
              <Label className="text-foreground">Password</Label>
              <Input
                type="password"
                value={authData.password}
                onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                className="bg-background border-input text-foreground"
                required
              />
            </div>
            
            {!isLoginMode && (
              <>
                <div>
                  <Label className="text-foreground">Confirm Password</Label>
                  <Input
                    type="password"
                    value={authData.confirmPassword}
                    onChange={(e) => setAuthData({ ...authData, confirmPassword: e.target.value })}
                    className="bg-background border-input text-foreground"
                    required
                  />
                </div>
                
                <div>
                  <Label className="text-foreground">I want to</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button
                      type="button"
                      variant={authData.role === "viewer" ? "default" : "outline"}
                      onClick={() => setAuthData({ ...authData, role: "viewer" })}
                      className={`h-12 ${authData.role === "viewer" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "border-primary text-primary hover:bg-primary hover:text-primary-foreground"}`}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Watch Streams
                    </Button>
                    <Button
                      type="button"
                      variant={authData.role === "creator" ? "default" : "outline"}
                      onClick={() => setAuthData({ ...authData, role: "creator" })}
                      className={`h-12 ${authData.role === "creator" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "border-primary text-primary hover:bg-primary hover:text-primary-foreground"}`}
                    >
                      <Video className="mr-2 h-4 w-4" />
                      Create Content
                    </Button>
                  </div>
                </div>
              </>
            )}
            
            <div className="flex flex-col space-y-3">
              <Button 
                type="submit" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={loginMutation.isPending || signupMutation.isPending}
              >
                {isLoginMode ? (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create Account
                  </>
                )}
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsLoginMode(!isLoginMode);
                  setAuthData({ username: "", password: "", confirmPassword: "", role: "viewer" });
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                {isLoginMode 
                  ? "Don't have an account? Sign up" 
                  : "Already have an account? Sign in"
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}