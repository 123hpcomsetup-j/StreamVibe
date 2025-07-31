import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/navbar";
import { apiRequest } from "@/lib/queryClient";
import { Video, Users, Eye, DollarSign, Play, Square, Clock, Gift } from "lucide-react";

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

interface TokenTransaction {
  id: string;
  amount: number;
  senderUsername: string;
  streamTitle: string;
  createdAt: string;
  type: 'tip' | 'activity';
}

export default function CreatorDashboard() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isStartingStream, setIsStartingStream] = useState(false);
  const [showStreamSetup, setShowStreamSetup] = useState(false);
  const [streamTitle, setStreamTitle] = useState("");
  const [streamCategory, setStreamCategory] = useState("");

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

  // Get token transaction history
  const { data: tokenHistory } = useQuery<TokenTransaction[]>({
    queryKey: ["/api/creator/token-history"],
    enabled: isAuthenticated,
  });

  // Get wallet balance
  const { data: wallet } = useQuery({
    queryKey: ["/api/wallet"],
    enabled: isAuthenticated,
  });

  // Start stream mutation
  const startStreamMutation = useMutation({
    mutationFn: async () => {
      setIsStartingStream(true);
      const response = await apiRequest("POST", "/api/streams", {
        title: streamTitle || "Live Stream",
        category: streamCategory || "General",
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
      // Show stream setup dialog
      setShowStreamSetup(true);
    }
  };

  const handleStartStream = () => {
    if (!streamTitle.trim()) {
      toast({
        title: "Stream Title Required",
        description: "Please enter a title for your stream",
        variant: "destructive",
      });
      return;
    }
    if (!streamCategory) {
      toast({
        title: "Category Required", 
        description: "Please select a category for your stream",
        variant: "destructive",
      });
      return;
    }
    setShowStreamSetup(false);
    startStreamMutation.mutate();
  };

  const handleStopStream = () => {
    if (currentStream?.id) {
      stopStreamMutation.mutate(currentStream.id);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">Access Denied</h2>
            <p className="text-muted-foreground mb-6">Please log in to access your creator dashboard.</p>
            <Button onClick={() => window.location.href = '/creator-login'} className="bg-primary hover:bg-primary/90">
              Go to Creator Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user as any} />
      
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Creator Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {(user as any)?.firstName || (user as any)?.username}!</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column - Streaming & Stats */}
          <div className="xl:col-span-2 space-y-8">
            {/* Main Action Card */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
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
                      <span className="text-foreground font-semibold">{currentStream.title}</span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-muted-foreground">
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
                        className="bg-primary hover:bg-primary/90"
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
                    <p className="text-muted-foreground">Ready to start streaming?</p>
                    
                    <Button 
                      onClick={handleGoLive}
                      disabled={isStartingStream || startStreamMutation.isPending}
                      className="bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-6"
                      size="lg"
                    >
                      <Play className="h-5 w-5 mr-2" />
                      {isStartingStream || startStreamMutation.isPending ? "Starting Stream..." : "Go Live"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-xs">Token Balance</p>
                        <p className="text-xl font-bold text-foreground">{(wallet as any)?.balance || 0}</p>
                      </div>
                      <DollarSign className="h-6 w-6 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-xs">Total Earnings</p>
                        <p className="text-xl font-bold text-foreground">{stats.totalEarnings}</p>
                      </div>
                      <DollarSign className="h-6 w-6 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-xs">Tips Received</p>
                        <p className="text-xl font-bold text-foreground">{stats.totalTips}</p>
                      </div>
                      <Gift className="h-6 w-6 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-xs">Total Viewers</p>
                        <p className="text-xl font-bold text-foreground">{stats.totalViewers}</p>
                      </div>
                      <Users className="h-6 w-6 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-xs">Active Streams</p>
                        <p className="text-xl font-bold text-foreground">{stats.activeStreams}</p>
                      </div>
                      <Video className="h-6 w-6 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Right Column - Token History */}
          <div className="xl:col-span-1">
            <Card className="bg-card border-border h-fit">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Gift className="h-5 w-5" />
                  Token History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-96 overflow-y-auto">
                  {tokenHistory && tokenHistory.length > 0 ? (
                    <div className="space-y-2 p-4">
                      {tokenHistory.map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                              <Gift className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-foreground font-medium text-sm">{transaction.senderUsername}</p>
                              <p className="text-muted-foreground text-xs">
                                {transaction.streamTitle} • {new Date(transaction.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-primary font-bold">+{transaction.amount}</p>
                            <p className="text-muted-foreground text-xs">{transaction.type}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No tokens received yet</p>
                      <p className="text-muted-foreground text-sm">Start streaming to receive tips!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Stream Setup Dialog */}
      <Dialog open={showStreamSetup} onOpenChange={setShowStreamSetup}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Video className="h-5 w-5" />
              Set Up Your Live Stream
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Configure your stream details before going live
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-foreground">Stream Title *</Label>
              <Input
                id="title"
                placeholder="e.g. Gaming Session, Art Tutorial, Music Practice..."
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                className="bg-background border-border text-foreground"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category" className="text-foreground">Category *</Label>
              <Select value={streamCategory} onValueChange={setStreamCategory}>
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gaming">Gaming</SelectItem>
                  <SelectItem value="Art & Design">Art & Design</SelectItem>
                  <SelectItem value="Music">Music</SelectItem>
                  <SelectItem value="Education">Education</SelectItem>
                  <SelectItem value="Fitness">Fitness</SelectItem>
                  <SelectItem value="Cooking">Cooking</SelectItem>
                  <SelectItem value="Technology">Technology</SelectItem>
                  <SelectItem value="Entertainment">Entertainment</SelectItem>
                  <SelectItem value="General">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowStreamSetup(false)}
              className="border-border text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleStartStream}
              disabled={startStreamMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {startStreamMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Starting...
                </>
              ) : (
                <>
                  <Video className="w-4 h-4 mr-2" />
                  Start Stream
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}