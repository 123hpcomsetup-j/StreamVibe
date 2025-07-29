import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import LiveStreamControls from "@/components/live-stream-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Users, Clock, Heart, Play, Square, Settings } from "lucide-react";

export default function CreatorDashboard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamData, setStreamData] = useState({
    title: "",
    category: "Art & Design",
    minTip: 5,
    tokenPrice: 1,
    privateRate: 20,
  });

  const typedUser = user as User | undefined;

  // Redirect if not authenticated or not a creator
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || typedUser?.role !== 'creator')) {
      toast({
        title: "Unauthorized",
        description: "Creator access required. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, typedUser, toast]);

  const { data: stats } = useQuery({
    queryKey: ["/api/creator/stats"],
    retry: false,
  });

  const { data: recentTips = [] } = useQuery({
    queryKey: ["/api/creator/tips"],
    retry: false,
  });

  const { data: currentStream } = useQuery({
    queryKey: ["/api/streams/current"],
    retry: false,
    enabled: !!typedUser,
  });

  // Update streaming state based on current stream
  useEffect(() => {
    if (currentStream && (currentStream as any).isLive) {
      setIsStreaming(true);
      setStreamData({
        title: (currentStream as any).title || "",
        category: (currentStream as any).category || "Art & Design",
        minTip: (currentStream as any).minTip || 5,
        tokenPrice: (currentStream as any).tokenPrice || 1,
        privateRate: (currentStream as any).privateRate || 20,
      });
    } else {
      setIsStreaming(false);
    }
  }, [currentStream]);

  const createStreamMutation = useMutation({
    mutationFn: async (streamData: any) => {
      return await apiRequest("/api/streams", "POST", {
        title: streamData.title || "Untitled Stream",
        category: streamData.category,
        minTip: streamData.minTip,
        tokenPrice: streamData.tokenPrice,
        privateRate: streamData.privateRate,
      });
    },
    onSuccess: (newStream) => {
      setIsStreaming(true);
      queryClient.invalidateQueries({ queryKey: ["/api/streams/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams/live"] });
      
      // Emit WebSocket event to properly start stream
      const socket = (window as any).streamSocket;
      if (socket && newStream) {
        socket.emit('start-stream', {
          streamId: newStream.id,
          userId: typedUser?.id
        });
      }
      
      toast({
        title: "Success",
        description: "Stream started successfully!",
      });
    },
    onError: (error) => {
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
        description: "Failed to start stream. Please try again.",
        variant: "destructive",
      });
    },
  });

  const stopStreamMutation = useMutation({
    mutationFn: async () => {
      if (!currentStream) return;
      
      // Emit WebSocket event to properly stop stream
      const socket = (window as any).streamSocket;
      if (socket) {
        socket.emit('stop-stream', {
          streamId: (currentStream as any).id,
          userId: typedUser?.id
        });
      }
      
      return await apiRequest(`/api/streams/${(currentStream as any).id}`, "DELETE");
    },
    onSuccess: () => {
      setIsStreaming(false);
      queryClient.invalidateQueries({ queryKey: ["/api/streams/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams/live"] });
      toast({
        title: "Success",
        description: "Stream stopped successfully!",
      });
    },
    onError: (error) => {
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
        description: "Failed to stop stream. Please try again.",
        variant: "destructive",
      });
    },
  });

  const requestPayoutMutation = useMutation({
    mutationFn: async (amount: number) => {
      return await apiRequest("/api/payouts", "POST", {
        amount: amount,
        utrNumber: "", // This would be filled by admin
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payout request submitted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/stats"] });
    },
    onError: (error) => {
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
        description: "Failed to request payout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartStream = () => {
    if (!streamData.title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a stream title.",
        variant: "destructive",
      });
      return;
    }
    createStreamMutation.mutate(streamData);
  };

  const handleStopStream = () => {
    stopStreamMutation.mutate();
  };

  const handleRequestPayout = () => {
    const availableEarnings = stats?.availableEarnings || 0;
    if (availableEarnings < 500) {
      toast({
        title: "Error",
        description: "Minimum payout amount is ₹500.",
        variant: "destructive",
      });
      return;
    }
    requestPayoutMutation.mutate(availableEarnings);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !typedUser || typedUser.role !== 'creator') {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50">
      {/* Simple Creator Navbar */}
      <nav className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary">StreamVibe</h1>
              <span className="ml-4 text-sm text-slate-400">Creator Dashboard</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                onClick={isStreaming ? handleStopStream : handleStartStream}
                className={isStreaming ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
                disabled={createStreamMutation.isPending || stopStreamMutation.isPending}
              >
                {isStreaming ? (
                  <>
                    <Square className="w-4 h-4 mr-2" />
                    Stop Stream
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Go Live
                  </>
                )}
              </Button>
              <Button 
                onClick={handleRequestPayout}
                variant="outline"
                className="border-slate-600 hover:bg-slate-700"
                disabled={requestPayoutMutation.isPending}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Request Payout
              </Button>
              <Button 
                onClick={() => window.location.href = "/api/logout"}
                variant="ghost"
                className="text-slate-300 hover:text-white"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Creator Dashboard - Real Analytics</h2>
          <p className="text-slate-400">Manage your streams and view real earnings data</p>
        </div>

        {/* Live Stream Status */}
        <div className="mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>Live Stream Status</span>
                <Badge className={isStreaming ? "bg-red-500" : "bg-gray-500"}>
                  {isStreaming ? "LIVE" : "OFFLINE"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isStreaming && (
                <div className="space-y-4">
                  <LiveStreamControls 
                    onStreamStart={handleStartStream}
                    onStreamStop={handleStopStream}
                  />
                </div>
              )}
              {!isStreaming && (
                <div className="text-center py-8">
                  <Play className="w-16 h-16 mx-auto text-slate-500 mb-4" />
                  <p className="text-slate-400 mb-4">Ready to go live? Click "Go Live" in the top navigation to start streaming.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stream Setup - Only show when not streaming */}
        {!isStreaming && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Stream Setup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Stream Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter stream title..."
                    value={streamData.title}
                    onChange={(e) => setStreamData({ ...streamData, title: e.target.value })}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={streamData.category} onValueChange={(value) => setStreamData({ ...streamData, category: value })}>
                    <SelectTrigger className="bg-slate-700 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Art & Design">Art & Design</SelectItem>
                      <SelectItem value="Gaming">Gaming</SelectItem>
                      <SelectItem value="Music">Music</SelectItem>
                      <SelectItem value="Cooking">Cooking</SelectItem>
                      <SelectItem value="Education">Education</SelectItem>
                      <SelectItem value="Fitness">Fitness</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">
                  <Settings className="mr-2 h-5 w-5 inline" />
                  Creator Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tokenPrice">Token Price (₹)</Label>
                  <Input
                    id="tokenPrice"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={streamData.tokenPrice}
                    onChange={(e) => setStreamData({ ...streamData, tokenPrice: parseFloat(e.target.value) || 1 })}
                    className="bg-slate-700 border-slate-600"
                    placeholder="1.00"
                  />
                  <p className="text-xs text-slate-400">Set how much each token costs for viewers</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="minTip">Minimum Tip (tokens)</Label>
                  <Input
                    id="minTip"
                    type="number"
                    min="1"
                    value={streamData.minTip}
                    onChange={(e) => setStreamData({ ...streamData, minTip: parseInt(e.target.value) })}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="privateRate">Private Session Rate (tokens/min)</Label>
                  <Input
                    id="privateRate"
                    type="number"
                    min="1"
                    value={streamData.privateRate}
                    onChange={(e) => setStreamData({ ...streamData, privateRate: parseInt(e.target.value) })}
                    className="bg-slate-700 border-slate-600"
                  />
                  <p className="text-xs text-slate-400">Default: 20 tokens per minute</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Analytics Dashboard - Real Data */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats?.totalEarnings || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.earningsGrowth ? `+${stats.earningsGrowth}% from last month` : 'No previous data'}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Followers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.followerCount || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.newFollowers ? `+${stats.newFollowers} new this week` : 'No new followers'}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stream Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalStreamHours || 0}</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tips</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalTips || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.weeklyTips ? `+${stats.weeklyTips} this week` : 'No tips yet'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Tips */}
        <Card className="bg-slate-800 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Recent Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTips.length > 0 ? (
                recentTips.map((tip: any) => (
                  <div key={tip.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-700">
                    <div>
                      <p className="font-medium">{tip.senderName || 'Anonymous'}</p>
                      <p className="text-sm text-slate-400">{new Date(tip.createdAt).toLocaleDateString()}</p>
                      {tip.message && <p className="text-sm text-slate-300 mt-1">"{tip.message}"</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-400">+{tip.amount} tokens</p>
                      <p className="text-xs text-slate-400">₹{(tip.amount * (stats?.tokenPrice || 1)).toFixed(2)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-center">No tips received yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payout Section */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Earnings & Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Available for Payout</span>
                <span className="font-bold text-2xl">₹{stats?.availableEarnings || 0}</span>
              </div>
              <Button 
                onClick={handleRequestPayout}
                disabled={requestPayoutMutation.isPending || (stats?.availableEarnings || 0) < 500}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600"
              >
                {requestPayoutMutation.isPending ? "Processing..." : "Request Payout"}
              </Button>
              <p className="text-xs text-slate-400">Minimum payout amount: ₹500</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}