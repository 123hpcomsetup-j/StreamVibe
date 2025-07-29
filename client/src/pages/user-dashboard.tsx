import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Video, 
  Users, 
  Clock,
  Play,
  LogOut,
  Home,
  Wifi,
  Coins,
  ShoppingCart,
  Wallet,
  CreditCard,
  IndianRupee,
  TrendingUp,
  Gift,
  Plus,
  Sparkles
} from "lucide-react";
import type { Stream, User, Transaction } from "@shared/schema";

export default function UserDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const typedUser = user as User | undefined;
  const [showBuyTokens, setShowBuyTokens] = useState(false);
  const [tokenAmount, setTokenAmount] = useState("");
  const [utrNumber, setUtrNumber] = useState("");

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

  // Fetch user transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ["/api/transactions"],
    enabled: !!typedUser,
  });

  const typedStreams = liveStreams as Stream[];
  const typedTransactions = transactions as Transaction[];

  // Token purchase mutation
  const purchaseTokensMutation = useMutation({
    mutationFn: async (data: { amount: string; tokens: number; utrNumber: string }) => {
      return await apiRequest("POST", "/api/token-purchases", data);
    },
    onSuccess: () => {
      toast({
        title: "Token Purchase Submitted",
        description: "Your purchase is pending admin approval. Tokens will be added once approved.",
      });
      setShowBuyTokens(false);
      setTokenAmount("");
      setUtrNumber("");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to submit token purchase",
        variant: "destructive",
      });
    },
  });

  const handleWatchStream = (streamId: string) => {
    setLocation(`/stream/${streamId}`);
  };

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  const handleGoHome = () => {
    setLocation("/");
  };

  const handleBuyTokens = () => {
    if (!tokenAmount || !utrNumber) {
      toast({
        title: "Missing Information",
        description: "Please enter amount and UTR number",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(tokenAmount);
    if (isNaN(amount) || amount < 10) {
      toast({
        title: "Invalid Amount",
        description: "Minimum purchase is ₹10",
        variant: "destructive",
      });
      return;
    }

    const tokens = Math.floor(amount); // 1 rupee = 1 token
    purchaseTokensMutation.mutate({
      amount: tokenAmount,
      tokens,
      utrNumber,
    });
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700 bg-black/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
                StreamVibe
              </h1>
              <Badge variant="secondary" className="bg-blue-600 text-white">
                <Sparkles className="w-3 h-3 mr-1" />
                Viewer Dashboard
              </Badge>
            </div>
            
            <div className="flex items-center space-x-4">
              {typedUser && (
                <div className="flex items-center space-x-4">
                  {/* Wallet Section */}
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardContent className="flex items-center space-x-3 p-3">
                      <Wallet className="w-5 h-5 text-yellow-500" />
                      <div>
                        <p className="text-xs text-slate-400">Balance</p>
                        <p className="text-lg font-bold text-yellow-500">
                          {typedUser.walletBalance || 0} tokens
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                        onClick={() => setShowBuyTokens(true)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Buy
                      </Button>
                    </CardContent>
                  </Card>

                  {/* User Info */}
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold">
                        {typedUser.username?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm">{typedUser.username}</span>
                  </div>
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
          <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
            Welcome back, {typedUser?.firstName || typedUser?.username}!
          </h2>
          <p className="text-slate-400">
            Discover amazing live streams and support your favorite creators
          </p>
        </div>

        <Tabs defaultValue="streams" className="space-y-4">
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="streams" className="data-[state=active]:bg-purple-600">
              <Video className="w-4 h-4 mr-2" />
              Live Streams
            </TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-purple-600">
              <TrendingUp className="w-4 h-4 mr-2" />
              My Activity
            </TabsTrigger>
          </TabsList>

          {/* Live Streams Tab */}
          <TabsContent value="streams" className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold flex items-center">
                <Wifi className="w-6 h-6 mr-2 text-red-500 animate-pulse" />
                Live Now
                <Badge variant="secondary" className="ml-2 bg-red-600">
                  {typedStreams.length} Streaming
                </Badge>
              </h3>
            </div>

            {streamsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="bg-slate-800/50 border-slate-700 animate-pulse">
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
                  <Card key={stream.id} className="bg-slate-800/50 border-slate-700 hover:border-purple-500 transition-all transform hover:scale-105 group">
                    <CardContent className="p-0">
                      {/* Stream Thumbnail */}
                      <div className="relative overflow-hidden">
                        <div className="h-48 bg-gradient-to-br from-purple-600 via-pink-600 to-purple-600 flex items-center justify-center relative">
                          <div className="absolute inset-0 bg-black/20"></div>
                          <Video className="w-16 h-16 text-white opacity-80 z-10" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        </div>
                        
                        {/* Live Badge */}
                        <div className="absolute top-3 left-3">
                          <Badge className="bg-red-600 text-white animate-pulse shadow-lg">
                            <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
                            LIVE
                          </Badge>
                        </div>
                        
                        {/* Viewer Count */}
                        <div className="absolute top-3 right-3">
                          <Badge variant="secondary" className="bg-black/70 backdrop-blur-sm text-white">
                            <Users className="w-3 h-3 mr-1" />
                            {stream.viewerCount || 0}
                          </Badge>
                        </div>
                        
                        {/* Duration */}
                        <div className="absolute bottom-3 right-3">
                          <Badge variant="secondary" className="bg-black/70 backdrop-blur-sm text-white">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatDuration(stream.createdAt)}
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Stream Info */}
                      <div className="p-4">
                        <h4 className="font-semibold text-lg mb-2 line-clamp-1 group-hover:text-purple-400 transition-colors">
                          {stream.title}
                        </h4>
                        
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-slate-400">
                            by <span className="text-purple-400 font-medium">{stream.creator?.username}</span>
                          </span>
                          <Badge variant="outline" className="text-xs border-purple-600 text-purple-400">
                            {stream.category}
                          </Badge>
                        </div>
                        
                        {/* Token Info */}
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                          <span className="flex items-center">
                            <Coins className="w-3 h-3 mr-1 text-yellow-500" />
                            Min tip: {stream.minTip} tokens
                          </span>
                          <span className="flex items-center">
                            <Gift className="w-3 h-3 mr-1 text-green-500" />
                            {stream.tokenPrice} token/msg
                          </span>
                        </div>
                        
                        <Button 
                          onClick={() => handleWatchStream(stream.id)}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
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
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="text-center py-12">
                  <Video className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Live Streams</h3>
                  <p className="text-slate-400">Check back later for exciting content!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Your token spending history</CardDescription>
              </CardHeader>
              <CardContent>
                {typedTransactions.length > 0 ? (
                  <div className="space-y-3">
                    {typedTransactions.slice(0, 5).map((transaction: any) => (
                      <div key={transaction.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                        <div>
                          <p className="font-medium">{transaction.purpose}</p>
                          <p className="text-sm text-slate-400">
                            {new Date(transaction.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                          -{transaction.tokenAmount} tokens
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No transactions yet</p>
                    <p className="text-sm mt-1">Start supporting creators!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Buy Tokens Dialog */}
      <Dialog open={showBuyTokens} onOpenChange={setShowBuyTokens}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-xl">Buy Tokens</DialogTitle>
            <DialogDescription>
              Purchase tokens to support your favorite creators
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-slate-700/50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Exchange Rate</span>
                <Badge variant="secondary" className="bg-green-600">
                  <IndianRupee className="w-3 h-3 mr-1" />
                  1 = 1 Token
                </Badge>
              </div>
              <p className="text-xs text-slate-400">Minimum purchase: ₹10</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount in rupees"
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
                className="bg-slate-700 border-slate-600"
                min="10"
              />
              {tokenAmount && (
                <p className="text-sm text-green-400">
                  You will receive: {Math.floor(parseFloat(tokenAmount) || 0)} tokens
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="utr">UTR Number</Label>
              <Input
                id="utr"
                type="text"
                placeholder="Enter UPI transaction ID"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                className="bg-slate-700 border-slate-600"
              />
            </div>

            <div className="bg-blue-900/30 p-3 rounded-lg text-sm">
              <p className="font-medium mb-1">Payment Instructions:</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-300">
                <li>Send payment to UPI: streamvibe@upi</li>
                <li>Enter the UTR number from your payment</li>
                <li>Tokens will be credited after admin approval</li>
              </ol>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowBuyTokens(false)}
              className="border-slate-600"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleBuyTokens}
              disabled={purchaseTokensMutation.isPending}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {purchaseTokensMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Buy Tokens
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}