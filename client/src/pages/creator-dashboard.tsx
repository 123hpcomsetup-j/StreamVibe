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

  const { data: earnings } = useQuery({
    queryKey: ["/api/creator/earnings"],
    retry: false,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["/api/transactions"],
    retry: false,
  });

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

  const handleStopStream = () => {
    setIsStreaming(false);
    toast({
      title: "Stream Ended",
      description: "Your stream has been stopped.",
    });
  };

  const handleRequestPayout = () => {
    const availableEarnings = 2450; // Mock data
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
            <h2 className="text-3xl font-bold mb-2">Creator Dashboard</h2>
            <p className="text-slate-400">Manage your streams and earnings</p>
          </div>

          {/* WebRTC Live Streaming */}
          <div className="mb-8">
            <LiveStreamControls 
              onStreamStart={() => {}}
              onStreamStop={() => {}}
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
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    <Square className="mr-2 h-4 w-4" />
                    Stop Streaming
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

          {/* Earnings Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-accent to-accent/80 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Today's Earnings</h4>
                  <DollarSign className="h-5 w-5" />
                </div>
                <div className="text-2xl font-bold">₹485</div>
                <div className="text-green-100 text-sm">+12% from yesterday</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white">Total Tips</h4>
                  <Heart className="h-5 w-5 text-secondary" />
                </div>
                <div className="text-2xl font-bold text-white">1,250</div>
                <div className="text-slate-400 text-sm">This month</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white">Stream Hours</h4>
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div className="text-2xl font-bold text-white">42</div>
                <div className="text-slate-400 text-sm">This month</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white">Followers</h4>
                  <Users className="h-5 w-5 text-red-500" />
                </div>
                <div className="text-2xl font-bold text-white">12.5K</div>
                <div className="text-green-400 text-sm">+245 this week</div>
              </CardContent>
            </Card>
          </div>

          {/* Payout Section */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Payout Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-4 text-white">Available for Payout</h4>
                  <div className="bg-slate-700 rounded-lg p-4 mb-4">
                    <div className="text-3xl font-bold text-accent mb-2">₹2,450</div>
                    <p className="text-slate-400">Minimum payout: ₹500</p>
                  </div>
                  <Button 
                    onClick={handleRequestPayout}
                    disabled={requestPayoutMutation.isPending}
                    className="w-full bg-accent hover:bg-accent/80"
                  >
                    {requestPayoutMutation.isPending ? "Requesting..." : "Request Payout"}
                  </Button>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-4 text-white">Recent Payouts</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-slate-700">
                      <div>
                        <p className="font-medium text-white">₹1,200</p>
                        <p className="text-slate-400 text-sm">Jan 15, 2025</p>
                      </div>
                      <Badge className="bg-accent text-white">Completed</Badge>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-700">
                      <div>
                        <p className="font-medium text-white">₹800</p>
                        <p className="text-slate-400 text-sm">Jan 8, 2025</p>
                      </div>
                      <Badge className="bg-yellow-600 text-white">Pending</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
