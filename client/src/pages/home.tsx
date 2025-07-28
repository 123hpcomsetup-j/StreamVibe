import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { User, Stream } from "@shared/schema";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import StreamModalWebRTC from "@/components/stream-modal-webrtc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Play, Coins, Heart, Gamepad2, Music, Palette, UtensilsCrossed, Dumbbell, GraduationCap } from "lucide-react";

export default function Home() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: liveStreams = [], isLoading: streamsLoading } = useQuery({
    queryKey: ["/api/streams/live"],
    retry: false,
  });

  const handleStreamError = (error: Error) => {
    if (isUnauthorizedError(error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
    toast({
      title: "Error",
      description: "Failed to load streams. Please try again.",
      variant: "destructive",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const categories = [
    { name: "Gaming", icon: Gamepad2, count: 245, color: "text-primary" },
    { name: "Music", icon: Music, count: 89, color: "text-secondary" },
    { name: "Art", icon: Palette, count: 156, color: "text-accent" },
    { name: "Cooking", icon: UtensilsCrossed, count: 67, color: "text-yellow-500" },
    { name: "Fitness", icon: Dumbbell, count: 78, color: "text-orange-500" },
    { name: "Education", icon: GraduationCap, count: 134, color: "text-blue-500" },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50">
      <Navbar user={user as User} />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 overflow-y-auto p-6">
          {/* Welcome Section */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">
              Welcome back, {user.firstName || 'User'}!
            </h2>
            <p className="text-slate-400">Discover amazing creators streaming live</p>
          </div>

          {/* Featured Stream */}
          <div className="mb-8">
            <div className="relative rounded-xl overflow-hidden bg-slate-800">
              <div className="aspect-video relative">
                <img 
                  src="https://images.unsplash.com/photo-1542751371-adc38448a05e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=675" 
                  alt="Featured streaming setup" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                
                {/* Live indicator */}
                <div className="absolute top-4 left-4 flex items-center space-x-2">
                  <Badge className="bg-red-500 text-white px-3 py-1">
                    <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                    LIVE
                  </Badge>
                  <Badge variant="secondary" className="bg-black/50 text-white px-3 py-1">
                    <Users className="mr-1 h-3 w-3" />
                    2.4K watching
                  </Badge>
                </div>

                {/* Stream info overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="flex items-center space-x-4">
                    <img 
                      src="https://images.unsplash.com/photo-1494790108755-2616b332c3b0?ixlib=rb-4.0.3&auto=format&fit=crop&w=64&h=64" 
                      alt="Creator profile" 
                      className="w-16 h-16 rounded-full border-2 border-white object-cover"
                    />
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white">Sarah's Art Studio</h3>
                      <p className="text-white/80">Digital painting & tutorials</p>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="text-accent font-medium">
                          <Heart className="mr-1 h-4 w-4 inline" />
                          12.5K followers
                        </span>
                        <span className="text-white/80">
                          <Coins className="mr-1 h-4 w-4 inline" />
                          Min tip: 10 tokens
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        onClick={() => setSelectedStreamId('featured')}
                        className="bg-primary hover:bg-primary/80"
                      >
                        Join Stream
                      </Button>
                      <Button 
                        variant="secondary"
                        className="bg-secondary hover:bg-secondary/80"
                      >
                        Private Session
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Creators Grid */}
          <div className="mb-8">
            <h3 className="text-2xl font-bold mb-6">Live Creators</h3>
            {streamsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.isArray(liveStreams) && liveStreams.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <div className="text-slate-400 text-lg">No live streams at the moment</div>
                    <p className="text-slate-500 mt-2">Check back later for amazing content!</p>
                  </div>
                ) : (
                  Array.isArray(liveStreams) && liveStreams.map((stream: any) => (
                    <Card key={stream.id} className="bg-slate-800 border-slate-700 hover:bg-slate-800/80 transition-colors cursor-pointer">
                      <div className="aspect-video relative">
                        <img 
                          src="https://images.unsplash.com/photo-1542751371-adc38448a05e?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=338" 
                          alt="Stream thumbnail" 
                          className="w-full h-full object-cover rounded-t-lg"
                        />
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
                      </div>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3 mb-3">
                          <img 
                            src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=48&h=48" 
                            alt="Creator profile" 
                            className="w-12 h-12 rounded-full object-cover"
                          />
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
                          <Button 
                            size="sm"
                            onClick={() => setSelectedStreamId(stream.id)}
                            className="bg-primary hover:bg-primary/80"
                          >
                            Watch
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Categories */}
          <div className="mb-8">
            <h3 className="text-2xl font-bold mb-6">Browse by Category</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories.map((category) => (
                <Card key={category.name} className="bg-slate-800 border-slate-700 hover:bg-slate-800/80 transition-colors cursor-pointer">
                  <CardContent className="p-4 text-center">
                    <category.icon className={`h-8 w-8 mx-auto mb-3 ${category.color}`} />
                    <p className="font-medium text-white">{category.name}</p>
                    <p className="text-slate-400 text-sm">{category.count} live</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>

      {selectedStreamId && (
        <StreamModalWebRTC
          streamId={selectedStreamId}
          streamData={liveStreams?.find((s: any) => s.id === selectedStreamId)}
          onClose={() => setSelectedStreamId(null)}
        />
      )}
    </div>
  );
}
