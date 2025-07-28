import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Users, Video, Heart, Coins, ChevronRight } from "lucide-react";
import { io, Socket } from 'socket.io-client';

export default function PublicHome() {
  const [, setLocation] = useLocation();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [realTimeStreams, setRealTimeStreams] = useState<any[]>([]);

  const { data: liveStreams = [], isLoading: streamsLoading, refetch: refetchStreams } = useQuery({
    queryKey: ["/api/streams/live"],
    retry: false,
  });

  const { data: onlineUsers = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ["/api/users/online"],
    retry: false,
  });

  // Filter only creators who are online
  const onlineCreators = Array.isArray(onlineUsers) ? onlineUsers.filter((user: any) => user.role === 'creator') : [];

  // Initialize real-time updates with WebSocket
  useEffect(() => {
    setRealTimeStreams(Array.isArray(liveStreams) ? liveStreams : []);
  }, [liveStreams]);

  // WebSocket connection for real-time stream status updates
  useEffect(() => {
    const newSocket = io(window.location.origin, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to streaming server for real-time updates');
      setSocket(newSocket);
    });

    // Listen for real-time stream status changes
    newSocket.on('stream-status-changed', (data: { streamId: string, isLive: boolean, viewerCount: number }) => {
      setRealTimeStreams(prevStreams => {
        if (data.isLive) {
          // Stream went live - check if it's already in the list
          const existingStreamIndex = prevStreams.findIndex(stream => stream.id === data.streamId);
          if (existingStreamIndex === -1) {
            // New stream, refetch to get full data
            refetchStreams();
            refetchUsers();
            return prevStreams;
          } else {
            // Update existing stream
            return prevStreams.map(stream => 
              stream.id === data.streamId 
                ? { ...stream, isLive: true, viewerCount: data.viewerCount }
                : stream
            );
          }
        } else {
          // Stream went offline - remove from live streams
          return prevStreams.filter(stream => stream.id !== data.streamId);
        }
      });
    });

    // Listen for viewer count updates
    newSocket.on('viewer-count-update', (data: { streamId: string, count: number }) => {
      setRealTimeStreams(prevStreams => 
        prevStreams.map(stream => 
          stream.id === data.streamId 
            ? { ...stream, viewerCount: data.count }
            : stream
        )
      );
    });

    return () => {
      newSocket.close();
    };
  }, []); // Remove dependencies to prevent infinite loop

  // Use real-time streams data instead of static query data
  const displayStreams = realTimeStreams.filter((stream: any) => stream.isLive);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary">StreamVibe</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost"
                onClick={() => setLocation("/user-login")}
                className="text-slate-300 hover:text-white"
              >
                Watch Streams
              </Button>
              <Button 
                variant="ghost"
                onClick={() => setLocation("/creator-login")}
                className="text-slate-300 hover:text-white"
              >
                Start Creating
              </Button>
              <Button 
                onClick={() => setLocation("/login")}
                className="bg-primary hover:bg-primary/80"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Live Streaming 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary"> Community</span>
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
              Join thousands of creators and viewers in real-time streaming experiences. Watch live content, chat with creators, and be part of an amazing community.
            </p>
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-2xl mx-auto">
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-primary mb-1">
                  {displayStreams.length}
                </div>
                <div className="text-slate-400 text-sm">Live Streams</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-500 mb-1">
                  {onlineCreators.length}
                </div>
                <div className="text-slate-400 text-sm">Online Creators</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-500 mb-1">
                  {Array.isArray(onlineUsers) ? onlineUsers.length : 0}
                </div>
                <div className="text-slate-400 text-sm">Active Users</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => setLocation("/user-login")}
                className="bg-primary hover:bg-primary/80 text-lg px-8 py-3"
              >
                <Play className="mr-2 h-5 w-5" />
                Start Watching
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                onClick={() => setLocation("/creator-login")}
                className="border-primary text-primary hover:bg-primary hover:text-white text-lg px-8 py-3"
              >
                <Video className="mr-2 h-5 w-5" />
                Become a Creator
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Streams Section */}
      <div className="py-16 bg-slate-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-white">Live Now</h2>
            <Button 
              variant="outline" 
              onClick={() => setLocation("/user-login")}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              View All <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {streamsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="bg-slate-800 animate-pulse">
                  <div className="aspect-video bg-slate-700 rounded-t-lg"></div>
                  <CardContent className="p-4">
                    <div className="h-4 bg-slate-700 rounded mb-2"></div>
                    <div className="h-3 bg-slate-700 rounded w-2/3"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : displayStreams.length === 0 ? (
            <div className="text-center py-12">
              <Video className="h-16 w-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-300 mb-2">No Live Streams</h3>
              <p className="text-slate-400 mb-6">Be the first to start streaming today!</p>
              <Button onClick={() => setLocation("/creator-login")}>
                Start Your Stream
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayStreams.slice(0, 6).map((stream: any) => (
                <Card key={stream.id} className="bg-slate-800 border-slate-700 hover:bg-slate-800/80 transition-colors cursor-pointer group">
                  <div className="aspect-video relative bg-slate-700 rounded-t-lg flex items-center justify-center">
                    {/* Live stream preview placeholder - real WebRTC will connect when clicked */}
                    <div className="text-center">
                      <Video className="h-12 w-12 text-slate-400 mx-auto mb-2" />
                      <p className="text-slate-300 text-sm font-medium">Live Stream</p>
                      <p className="text-slate-500 text-xs">Click to watch</p>
                    </div>
                    
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-red-500 text-white">
                        <div className="w-1.5 h-1.5 bg-white rounded-full mr-1 animate-pulse"></div>
                        LIVE
                      </Badge>
                    </div>
                    <div className="absolute top-3 right-3">
                      <Badge variant="secondary" className="bg-black/50 text-white">
                        <Users className="mr-1 h-3 w-3" />
                        {stream.viewerCount || 0}
                      </Badge>
                    </div>
                    
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        onClick={() => setLocation(`/stream/${stream.id}`)}
                        className="bg-primary hover:bg-primary/80"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Watch Stream
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-12 h-12 bg-slate-600 rounded-full flex items-center justify-center">
                        <Video className="h-6 w-6 text-slate-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{stream.title}</h4>
                        <p className="text-slate-400 text-sm">{stream.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-accent text-sm font-medium">
                        <Coins className="mr-1 h-3 w-3 inline" />
                        Min: {stream.minTip || 5} tokens
                      </span>
                      <span className="text-slate-400 text-sm">
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
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-white flex items-center">
              <Users className="mr-3 h-8 w-8 text-green-500" />
              Online Creators ({onlineCreators.length})
            </h2>
            <Button 
              variant="outline" 
              onClick={() => setLocation("/user-login")}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Join Community <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {usersLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[...Array(12)].map((_, i) => (
                <Card key={i} className="bg-slate-800 animate-pulse">
                  <CardContent className="p-4 text-center">
                    <div className="w-16 h-16 bg-slate-700 rounded-full mx-auto mb-3"></div>
                    <div className="h-4 bg-slate-700 rounded mb-2"></div>
                    <div className="h-3 bg-slate-700 rounded w-2/3 mx-auto"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : onlineCreators.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-300 mb-2">No Creators Online</h3>
              <p className="text-slate-400 mb-6">Check back later or become a creator yourself!</p>
              <Button onClick={() => setLocation("/creator-login")}>
                Start Creating
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {onlineCreators.map((creator: any) => (
                <Card key={creator.id} className="bg-slate-800 border-slate-700 hover:bg-slate-800/80 transition-colors">
                  <CardContent className="p-4 text-center">
                    <div className="relative w-16 h-16 mx-auto mb-3">
                      {creator.profileImageUrl ? (
                        <img 
                          src={creator.profileImageUrl}
                          alt={`${creator.firstName || creator.username || 'Creator'}'s profile`}
                          className="w-full h-full rounded-full object-cover border-2 border-purple-500"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-slate-600 border-2 border-purple-500 flex items-center justify-center">
                          <Users className="h-8 w-8 text-slate-400" />
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-slate-800 rounded-full animate-pulse"></div>
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className="font-medium text-white text-sm truncate">
                        {creator.firstName && creator.lastName 
                          ? `${creator.firstName} ${creator.lastName}` 
                          : creator.username || 'Creator'}
                      </h4>
                      <Badge 
                        variant="outline" 
                        className="text-xs border-purple-500 text-purple-400"
                      >
                        creator
                      </Badge>
                      <div className="flex items-center justify-center text-xs text-green-400">
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
      <div className="py-16 bg-slate-800/50">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Join StreamVibe?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Choose your path: watch amazing content or start creating your own
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => setLocation("/user-login")}
              className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3"
            >
              I Want to Watch
            </Button>
            <Button 
              size="lg" 
              onClick={() => setLocation("/creator-login")}
              className="bg-purple-600 hover:bg-purple-700 text-lg px-8 py-3"
            >
              I Want to Create
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-primary mb-4">StreamVibe</h3>
            <p className="text-slate-400 mb-4">
              The future of live streaming and creator economy
            </p>
            <div className="flex justify-center space-x-6">
              <Button 
                variant="link" 
                onClick={() => setLocation("/user-login")}
                className="text-slate-400 hover:text-white"
              >
                Watch Streams
              </Button>
              <Button 
                variant="link" 
                onClick={() => setLocation("/creator-login")}
                className="text-slate-400 hover:text-white"
              >
                Become Creator
              </Button>
              <Button 
                variant="link" 
                onClick={() => setLocation("/admin")}
                className="text-slate-400 hover:text-white"
              >
                Admin
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}