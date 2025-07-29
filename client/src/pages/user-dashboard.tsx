import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Video, 
  Users, 
  Clock,
  Play,
  LogOut,
  Home,
  Wifi,
  Coins
} from "lucide-react";
import type { Stream, User } from "@shared/schema";

export default function UserDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const typedUser = user as User | undefined;

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation("/user-login");
      }, 500);
    }
  }, [isAuthenticated, isLoading, setLocation, toast]);

  // Fetch live streams
  const { data: liveStreams = [], isLoading: streamsLoading } = useQuery({
    queryKey: ["/api/streams/live"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch online users
  const { data: onlineUsers = [] } = useQuery({
    queryKey: ["/api/users/online"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const typedStreams = liveStreams as Stream[];
  const typedOnlineUsers = onlineUsers as User[];

  const handleWatchStream = (streamId: string) => {
    setLocation(`/stream/${streamId}`);
  };

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  const handleGoHome = () => {
    setLocation("/");
  };

  const formatDuration = (createdAt: string) => {
    const now = new Date();
    const streamStart = new Date(createdAt);
    const diffMs = now.getTime() - streamStart.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMins / 60);
    const minutes = diffMins % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-blue-400">StreamVibe</h1>
              <Badge variant="secondary" className="bg-blue-600 text-white">
                Viewer Dashboard
              </Badge>
            </div>
            
            <div className="flex items-center space-x-4">
              {typedUser && (
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold">
                      {typedUser.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm">{typedUser.username}</span>
                  <Badge variant="outline" className="text-xs">
                    <Coins className="w-3 h-3 mr-1" />
                    {typedUser.walletBalance || 0} tokens
                  </Badge>
                </div>
              )}
              
              <Button 
                onClick={handleGoHome}
                variant="outline"
                size="sm"
                className="border-slate-600 hover:bg-slate-700"
              >
                <Home className="w-4 h-4 mr-2" />
                Home
              </Button>
              
              <Button 
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Welcome back, {typedUser?.firstName || typedUser?.username}!
          </h2>
          <p className="text-slate-400">
            Discover amazing live streams and connect with creators
          </p>
        </div>

        {/* Live Streams Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-semibold flex items-center">
              <Wifi className="w-6 h-6 mr-2 text-red-500" />
              Live Streams
              <Badge variant="secondary" className="ml-2 bg-red-600">
                {typedStreams.length} Live
              </Badge>
            </h3>
          </div>

          {streamsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-slate-800 border-slate-700 animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-40 bg-slate-700 rounded mb-4"></div>
                    <div className="h-4 bg-slate-700 rounded mb-2"></div>
                    <div className="h-3 bg-slate-700 rounded w-2/3"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : typedStreams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {typedStreams.map((stream: any) => (
                <Card key={stream.id} className="bg-slate-800 border-slate-700 hover:border-blue-500 transition-colors group">
                  <CardContent className="p-0">
                    {/* Stream Thumbnail */}
                    <div className="relative">
                      <div className="h-48 bg-gradient-to-br from-blue-600 to-purple-600 rounded-t-lg flex items-center justify-center">
                        <Video className="w-16 h-16 text-white opacity-80" />
                      </div>
                      
                      {/* Live Badge */}
                      <div className="absolute top-3 left-3">
                        <Badge className="bg-red-600 text-white animate-pulse">
                          <div className="w-2 h-2 bg-white rounded-full mr-1"></div>
                          LIVE
                        </Badge>
                      </div>
                      
                      {/* Viewer Count */}
                      <div className="absolute top-3 right-3">
                        <Badge variant="secondary" className="bg-black/50 text-white">
                          <Users className="w-3 h-3 mr-1" />
                          {stream.viewerCount || 0}
                        </Badge>
                      </div>
                      
                      {/* Duration */}
                      <div className="absolute bottom-3 right-3">
                        <Badge variant="secondary" className="bg-black/50 text-white">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDuration(stream.createdAt)}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Stream Info */}
                    <div className="p-4">
                      <h4 className="font-semibold text-lg mb-2 line-clamp-1">
                        {stream.title}
                      </h4>
                      
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-slate-400">
                          by <span className="text-blue-400">{stream.creator?.username}</span>
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {stream.category}
                        </Badge>
                      </div>
                      
                      {/* Token Info */}
                      <div className="flex items-center justify-between mb-4 text-xs text-slate-400">
                        <span>₹{stream.tokenPrice}/token</span>
                        <span>Min tip: {stream.minTip} tokens</span>
                      </div>
                      
                      <Button 
                        onClick={() => handleWatchStream(stream.id)}
                        className="w-full bg-blue-600 hover:bg-blue-700 group-hover:bg-blue-500"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Watch Stream
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center">
                <Video className="w-16 h-16 mx-auto text-slate-500 mb-4" />
                <h4 className="text-xl font-semibold mb-2">No Live Streams</h4>
                <p className="text-slate-400">
                  No creators are currently streaming. Check back later!
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Online Users Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-semibold flex items-center">
              <Users className="w-6 h-6 mr-2 text-green-500" />
              Online Users
              <Badge variant="secondary" className="ml-2 bg-green-600">
                {typedOnlineUsers.length} Online
              </Badge>
            </h3>
          </div>

          {typedOnlineUsers.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {typedOnlineUsers.map((user: any) => (
                <Card key={user.id} className="bg-slate-800 border-slate-700">
                  <CardContent className="p-4 text-center">
                    <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${
                      user.role === 'creator' ? 'bg-purple-600' : 
                      user.role === 'admin' ? 'bg-red-600' : 'bg-blue-600'
                    }`}>
                      <span className="text-sm font-semibold">
                        {user.username?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate">{user.username}</p>
                    <Badge 
                      variant="outline" 
                      className={`text-xs mt-1 ${
                        user.role === 'creator' ? 'border-purple-500 text-purple-400' : 
                        user.role === 'admin' ? 'border-red-500 text-red-400' : 'border-blue-500 text-blue-400'
                      }`}
                    >
                      {user.role}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center">
                <Users className="w-16 h-16 mx-auto text-slate-500 mb-4" />
                <h4 className="text-xl font-semibold mb-2">No Users Online</h4>
                <p className="text-slate-400">
                  You're the only one here right now.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}