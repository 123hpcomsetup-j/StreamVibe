import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/navbar";
import { apiRequest } from "@/lib/queryClient";
import { Video, Users, Eye, DollarSign, Play, Square } from "lucide-react";

interface Stream {
  id: string;
  title: string;
  category: string;
  isLive: boolean;
  viewerCount: number;
  createdAt: string;
}

interface CreatorStats {
  totalEarnings: number;
  totalTips: number;
  totalViewers: number;
  activeStreams: number;
}

export default function CreatorDashboard() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isStartingStream, setIsStartingStream] = useState(false);

  // Get current stream
  const { data: currentStream } = useQuery<Stream>({
    queryKey: ["/api/streams/current"],
    enabled: isAuthenticated,
  });

  // Get creator stats
  const { data: stats } = useQuery<CreatorStats>({
    queryKey: ["/api/creator/stats"],
    enabled: isAuthenticated,
  });

  // Start stream mutation
  const startStreamMutation = useMutation({
    mutationFn: async () => {
      setIsStartingStream(true);
      const response = await apiRequest("POST", "/api/streams", {
        title: "Live Stream",
        category: "General",
        isLive: true,
      });
      return response.json();
    },
    onSuccess: (stream) => {
      toast({
        title: "Stream Started!",
        description: "Redirecting to live studio...",
      });
      // Redirect to live studio
      window.location.href = `/creator-live-studio?streamId=${stream.id}`;
    },
    onError: (error: Error) => {
      setIsStartingStream(false);
      toast({
        title: "Failed to Start Stream",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Stop stream mutation
  const stopStreamMutation = useMutation({
    mutationFn: async (streamId: string) => {
      return await apiRequest("DELETE", `/api/streams/${streamId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/stats"] });
      toast({
        title: "Stream Stopped",
        description: "Your stream has been ended successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Stop Stream",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGoLive = () => {
    if (currentStream?.isLive) {
      // If already live, go to live studio
      window.location.href = `/creator-live-studio?streamId=${currentStream.id}`;
    } else {
      // Start new stream
      startStreamMutation.mutate();
    }
  };

  const handleStopStream = () => {
    if (currentStream?.id) {
      stopStreamMutation.mutate(currentStream.id);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
            <p className="text-slate-300 mb-6">Please log in to access your creator dashboard.</p>
            <Button onClick={() => window.location.href = '/creator-login'}>
              Go to Creator Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navbar user={user as any} />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Creator Dashboard</h1>
          <p className="text-slate-300">Welcome back, {(user as any)?.firstName || (user as any)?.username}!</p>
        </div>

        {/* Main Action Card */}
        <div className="mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Video className="h-6 w-6" />
                Live Streaming
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentStream?.isLive ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="animate-pulse">
                      LIVE
                    </Badge>
                    <span className="text-white font-semibold">{currentStream.title}</span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-slate-300">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{currentStream.viewerCount} viewers</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      <span>{currentStream.category}</span>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button 
                      onClick={handleGoLive}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Video className="h-4 w-4 mr-2" />
                      Manage Live Stream
                    </Button>
                    
                    <Button 
                      onClick={handleStopStream}
                      variant="destructive"
                      disabled={stopStreamMutation.isPending}
                    >
                      <Square className="h-4 w-4 mr-2" />
                      {stopStreamMutation.isPending ? "Stopping..." : "End Stream"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-slate-300">Ready to start streaming?</p>
                  
                  <Button 
                    onClick={handleGoLive}
                    disabled={isStartingStream || startStreamMutation.isPending}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-6"
                    size="lg"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    {isStartingStream || startStreamMutation.isPending ? "Starting Stream..." : "Go Live"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Total Earnings</p>
                    <p className="text-2xl font-bold text-white">{stats.totalEarnings}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Tips Received</p>
                    <p className="text-2xl font-bold text-white">{stats.totalTips}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Total Viewers</p>
                    <p className="text-2xl font-bold text-white">{stats.totalViewers}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Active Streams</p>
                    <p className="text-2xl font-bold text-white">{stats.activeStreams}</p>
                  </div>
                  <Video className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}