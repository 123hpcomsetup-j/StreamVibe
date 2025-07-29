import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Users, Clock, Heart, Play, Square, Settings } from "lucide-react";
import StreamModal from "@/components/stream-modal";
import AgoraStreamCreator from "@/components/agora-stream-creator";

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
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    username: "",
  });
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [showAgoraModal, setShowAgoraModal] = useState(false);
  const [streamKey, setStreamKey] = useState<string>("");

  const typedUser = user as User | undefined;

  // Simplified setup - Agora handles all connections
  useEffect(() => {
    if (typedUser?.id) {
      console.log('Creator dashboard loaded for user:', typedUser.id);
    }
  }, [typedUser?.id]);

  // Initialize profile data when user loads
  useEffect(() => {
    if (typedUser) {
      setProfileData({
        firstName: typedUser.firstName || "",
        lastName: typedUser.lastName || "",
        username: typedUser.username || "",
      });
    }
  }, [typedUser]);

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
    const stream = currentStream as any;
    if (stream && stream.isLive) {
      setIsStreaming(true);
      setStreamData({
        title: stream.title || "",
        category: stream.category || "Art & Design",
        minTip: stream.minTip || 5,
        tokenPrice: stream.tokenPrice || 1,
        privateRate: stream.privateRate || 20,
      });
    } else {
      setIsStreaming(false);
    }
  }, [currentStream]);

  const createStreamMutation = useMutation({
    mutationFn: async (streamData: any) => {
      const response = await apiRequest("POST", "/api/streams", {
        title: streamData.title || "Untitled Stream",
        category: streamData.category,
        minTip: streamData.minTip,
        tokenPrice: streamData.tokenPrice,
        privateRate: streamData.privateRate,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setStreamKey(data.id);
      setIsStreaming(true);
      queryClient.invalidateQueries({ queryKey: ["/api/streams/current"] });
      toast({
        title: "Stream Created!",
        description: "Your stream is ready. Click 'Go Live' to start broadcasting.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      toast({
        title: "Failed to Create Stream",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const updateStreamMutation = useMutation({
    mutationFn: async (updateData: any) => {
      const response = await apiRequest("PATCH", `/api/streams/${(currentStream as any)?.id}/settings`, updateData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams/current"] });
      toast({
        title: "Stream Settings Updated",
        description: "Your pricing settings have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Settings",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const stopStreamMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/streams/${(currentStream as any)?.id}`);
      return response.json();
    },
    onSuccess: () => {
      setIsStreaming(false);
      setStreamKey("");
      queryClient.invalidateQueries({ queryKey: ["/api/streams/current"] });
      toast({
        title: "Stream Ended",
        description: "Your live stream has been stopped.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Stop Stream",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PATCH", "/api/auth/profile", data);
      return response.json();
    },
    onSuccess: () => {
      setIsEditingProfile(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Profile",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const requestPayoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/creator/payout");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creator/stats"] });
      toast({
        title: "Payout Requested",
        description: "Your payout request has been submitted for review.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Payout Request Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleGoLive = () => {
    const stream = currentStream as any;
    if (stream?.isLive) {
      toast({
        title: "Already Live",
        description: "You are already broadcasting.",
      });
      return;
    }

    // Create stream first, then show streaming options
    if (!currentStream) {
      handleCreateStream();
    } else {
      // Show streaming modal with fallback options
      setShowStreamModal(true);
    }
  };

  const handleStopStream = () => {
    stopStreamMutation.mutate();
    setShowAgoraModal(false);
  };

  const handleCreateStream = () => {
    if (!streamData.title.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a title for your stream",
        variant: "destructive",
      });
      return;
    }
    createStreamMutation.mutate(streamData);
  };

  const handleUpdateSettings = () => {
    updateStreamMutation.mutate(streamData);
  };

  const handleRequestPayout = () => {
    requestPayoutMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Simple Navbar */}
      <nav className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Creator Studio</h1>
          <div className="flex items-center space-x-4">
            {(currentStream as any)?.isLive ? (
              <Button 
                onClick={handleStopStream}
                className="bg-red-600 hover:bg-red-700"
                disabled={stopStreamMutation.isPending}
              >
                <Square className="mr-2 h-4 w-4" />
                {stopStreamMutation.isPending ? "Stopping..." : "Stop Stream"}
              </Button>
            ) : (
              <Button 
                onClick={handleGoLive}
                className="bg-red-500 hover:bg-red-600"
                disabled={createStreamMutation.isPending}
              >
                <Play className="mr-2 h-4 w-4" />
                Go Live
              </Button>
            )}
            <Button 
              onClick={handleRequestPayout}
              variant="outline"
              disabled={requestPayoutMutation.isPending || ((stats as any)?.availableEarnings || 0) < 500}
              className="border-green-600 text-green-400 hover:bg-green-600 hover:text-white"
            >
              <DollarSign className="mr-2 h-4 w-4" />
              Request Payout
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Stream Status */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`w-3 h-3 rounded-full ${(currentStream as any)?.isLive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
                <span className="text-white font-medium">
                  {(currentStream as any)?.isLive ? 'LIVE' : 'OFFLINE'}
                </span>
                {(currentStream as any)?.isLive && (
                  <Badge className="bg-red-500 text-white">
                    <Users className="mr-1 h-3 w-3" />
                    {(currentStream as any)?.viewerCount || 0} viewers
                  </Badge>
                )}
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-sm">Status</p>
                <p className="text-white font-medium">
                  {(currentStream as any)?.isLive ? (currentStream as any)?.title : 'Not streaming'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stream Settings */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              Stream Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Stream Title</Label>
                <Input
                  value={streamData.title}
                  onChange={(e) => setStreamData({ ...streamData, title: e.target.value })}
                  placeholder="Enter stream title"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Category</Label>
                <Select value={streamData.category} onValueChange={(value) => setStreamData({ ...streamData, category: value })}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="Art & Design">Art & Design</SelectItem>
                    <SelectItem value="Gaming">Gaming</SelectItem>
                    <SelectItem value="Music">Music</SelectItem>
                    <SelectItem value="Cooking">Cooking</SelectItem>
                    <SelectItem value="Education">Education</SelectItem>
                    <SelectItem value="Fitness">Fitness</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-slate-300">Min Tip (tokens)</Label>
                <Input
                  type="number"
                  value={streamData.minTip}
                  onChange={(e) => setStreamData({ ...streamData, minTip: Number(e.target.value) })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Token Price (₹)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={streamData.tokenPrice}
                  onChange={(e) => setStreamData({ ...streamData, tokenPrice: Number(e.target.value) })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Private Rate (₹/min)</Label>
                <Input
                  type="number"
                  value={streamData.privateRate}
                  onChange={(e) => setStreamData({ ...streamData, privateRate: Number(e.target.value) })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>

            <div className="flex space-x-4">
              {!currentStream ? (
                <Button 
                  onClick={handleCreateStream}
                  disabled={createStreamMutation.isPending}
                  className="bg-primary hover:bg-primary/80"
                >
                  {createStreamMutation.isPending ? "Creating..." : "Create Stream"}
                </Button>
              ) : (
                <Button 
                  onClick={handleUpdateSettings}
                  disabled={updateStreamMutation.isPending}
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary hover:text-white"
                >
                  {updateStreamMutation.isPending ? "Updating..." : "Update Settings"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Earnings</p>
                  <p className="text-2xl font-bold text-white">₹{(stats as any)?.totalEarnings || 0}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Followers</p>
                  <p className="text-2xl font-bold text-white">{(stats as any)?.totalFollowers || 0}</p>
                </div>
                <Users className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Streaming Hours</p>
                  <p className="text-2xl font-bold text-white">{(stats as any)?.totalStreamingHours || 0}</p>
                </div>
                <Clock className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Tips</p>
                  <p className="text-2xl font-bold text-white">{(stats as any)?.totalTips || 0}</p>
                </div>
                <Heart className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Tips */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Recent Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(recentTips as any[]).length > 0 ? (
                (recentTips as any[]).map((tip: any) => (
                  <div key={tip.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-700">
                    <div>
                      <p className="font-medium">{tip.senderName || 'Anonymous'}</p>
                      <p className="text-sm text-slate-400">{new Date(tip.createdAt).toLocaleDateString()}</p>
                      {tip.message && <p className="text-sm text-slate-300 mt-1">"{tip.message}"</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-400">+{tip.amount} tokens</p>
                      <p className="text-xs text-slate-400">₹{(tip.amount * ((stats as any)?.tokenPrice || 1)).toFixed(2)}</p>
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
                <span className="font-bold text-2xl">₹{(stats as any)?.availableEarnings || 0}</span>
              </div>
              <Button 
                onClick={handleRequestPayout}
                disabled={requestPayoutMutation.isPending || ((stats as any)?.availableEarnings || 0) < 500}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600"
              >
                {requestPayoutMutation.isPending ? "Processing..." : "Request Payout"}
              </Button>
              <p className="text-xs text-slate-400">Minimum payout amount: ₹500</p>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* RTMP Stream Configuration Modal */}
      <StreamModal 
        isOpen={showStreamModal}
        onClose={() => setShowStreamModal(false)}
        streamKey={streamKey}
      />
      
      {/* Agora Streaming Modal */}
      {showAgoraModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Live Stream Studio</h2>
              <Button 
                onClick={() => setShowAgoraModal(false)}
                variant="ghost"
                className="text-slate-400 hover:text-white"
              >
                ✕
              </Button>
            </div>
            
            <AgoraStreamCreator
              streamId={(currentStream as any)?.id || streamKey}
              userId={typedUser?.id || ''}
              username={typedUser?.username || 'Creator'}
              onStreamStart={(streamId) => {
                console.log('Agora stream started:', streamId);
              }}
              onStreamStop={() => {
                console.log('Agora stream stopped');
                setShowAgoraModal(false);
                handleStopStream();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}