import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import LiveStreamControls from "@/components/live-stream-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
    publicChat: true,
    privateSessions: true,
  });

  const typedUser = user as User | undefined;

  // Redirect to home if not authenticated or not a creator
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
        publicChat: true,
        privateSessions: true,
      });
    } else {
      setIsStreaming(false);
    }
  }, [currentStream]);

  const createStreamMutation = useMutation({
    mutationFn: async (streamData: any) => {
      await apiRequest("POST", "/api/streams", streamData);
    },
    onSuccess: () => {
      setIsStreaming(true);
      toast({
        title: "Stream Started",
        description: "Your stream is now live!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
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

  const requestPayoutMutation = useMutation({
    mutationFn: async (amount: number) => {
      await apiRequest("POST", "/api/payouts", { amount });
    },
    onSuccess: () => {
      toast({
        title: "Payout Requested",
        description: "Your payout request has been submitted for approval.",
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
    createStreamMutation.mutate({
      ...streamData,
      isLive: true,
    });
  };

  const stopStreamMutation = useMutation({
    mutationFn: async () => {
      // Find current active stream and stop it
      const response = await fetch('/api/streams/live');
      const liveStreams = await response.json();
      const userStream = liveStreams.find((stream: any) => stream.creatorId === typedUser?.id);
      
      if (userStream) {
        await apiRequest("PATCH", `/api/streams/${userStream.id}`, { isLive: false });
      }
    },
    onSuccess: () => {
      setIsStreaming(false);
      toast({
        title: "Stream Ended",
        description: "Your stream has been stopped.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
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
      <Navbar user={typedUser} />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Creator Dashboard - Real Analytics</h2>
            <p className="text-slate-400">Manage your streams and view real earnings data</p>
          </div>

          {/* WebRTC Live Streaming */}
          <div className="mb-8">
            <LiveStreamControls 
              onStreamStart={handleStartStream}
              onStreamStop={handleStopStream}
            />
          </div>

          {/* Stream Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Stream Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Stream Status</span>
                  <Badge className={isStreaming ? "bg-red-500" : "bg-gray-500"}>
                    {isStreaming ? "LIVE" : "OFFLINE"}
                  </Badge>
                </div>
                
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
                
                {isStreaming ? (
                  <Button 
                    onClick={handleStopStream}
                    disabled={stopStreamMutation.isPending}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    <Square className="mr-2 h-4 w-4" />
                    {stopStreamMutation.isPending ? "Stopping..." : "Stop Streaming"}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleStartStream}
                    disabled={createStreamMutation.isPending}
                    className="w-full bg-red-500 hover:bg-red-600"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {createStreamMutation.isPending ? "Starting..." : "Start Streaming"}
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">
                  <Settings className="mr-2 h-5 w-5 inline" />
                  Stream Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Public Chat</span>
                  <Switch
                    checked={streamData.publicChat}
                    onCheckedChange={(checked) => setStreamData({ ...streamData, publicChat: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="font-medium">Private Sessions</span>
                  <Switch
                    checked={streamData.privateSessions}
                    onCheckedChange={(checked) => setStreamData({ ...streamData, privateSessions: checked })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="tokenPrice">Token Price ($)</Label>
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
                </div>
              </CardContent>
            </Card>
          </div>

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
    </div>
  );
}
