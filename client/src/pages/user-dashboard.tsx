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
import { io } from "socket.io-client";
import Navbar from "@/components/navbar";
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
  Sparkles,
  Edit,
  User as UserIcon,
  Save,
  X,
  Phone
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
  
  // Private call state
  const [showPrivateCallDialog, setShowPrivateCallDialog] = useState(false);
  const [selectedStream, setSelectedStream] = useState<any>(null);
  const [privateCallMessage, setPrivateCallMessage] = useState("");
  
  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: ""
  });

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

  // Initialize profile data when user data loads
  useEffect(() => {
    if (typedUser) {
      setProfileData({
        firstName: typedUser.firstName || "",
        lastName: typedUser.lastName || "",
        email: typedUser.email || "",
        phoneNumber: typedUser.phoneNumber || ""
      });
    }
  }, [typedUser]);

  // Setup WebSocket for real-time updates
  useEffect(() => {
    if (isAuthenticated) {
      const socket = io(window.location.origin, {
        path: '/socket.io',
        transports: ['websocket', 'polling']
      });

      socket.on('connect', () => {
        console.log('UserDashboard connected to WebSocket for real-time updates');
      });

      // Listen for stream status changes
      socket.on('stream-status-changed', (data) => {
        console.log('Stream status changed in user dashboard:', data);
        // Invalidate and refetch live streams when status changes
        queryClient.invalidateQueries({ queryKey: ["/api/streams/live"] });
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [isAuthenticated]);

  // Fetch live streams (limit to last 4 for perfect screen fit)
  const { data: liveStreams = [], isLoading: streamsLoading } = useQuery({
    queryKey: ["/api/streams/live"],
    refetchInterval: 5000, // Refresh every 5 seconds as fallback
    select: (data) => {
      // Show only last 4 streams for perfect screen view
      return Array.isArray(data) ? data.slice(-4) : [];
    }
  });

  // Fetch user transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ["/api/transactions"],
    enabled: !!typedUser,
  });

  // Fetch user wallet for actual token balance
  const { data: wallet, refetch: refetchWallet } = useQuery({
    queryKey: ["/api/wallet"],
    enabled: !!typedUser,
    refetchInterval: 10000, // Refresh every 10 seconds to keep balance updated
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
      refetchWallet(); // Refresh wallet balance after purchase
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

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
      queryClient.clear();
      setLocation("/user-login");
    } catch (error) {
      console.error("Logout error:", error);
      setLocation("/user-login");
    }
  };

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", "/api/auth/profile", data);
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

  const handleUpdateProfile = () => {
    if (!profileData.firstName.trim() || !profileData.email.trim()) {
      toast({
        title: "Validation Error",
        description: "First name and email are required.",
        variant: "destructive",
      });
      return;
    }
    
    updateProfileMutation.mutate(profileData);
  };

  const handleGoHome = () => {
    setLocation("/user-dashboard"); // Keep users in their dashboard
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

  // Private call request mutation
  const privateCallMutation = useMutation({
    mutationFn: async (data: { creatorId: string; streamId: string; requestMessage: string }) => {
      const response = await apiRequest("POST", "/api/private-call-requests", data);
      return response.json();
    },
    onSuccess: () => {
      setShowPrivateCallDialog(false);
      setPrivateCallMessage("");
      setSelectedStream(null);
      toast({
        title: "Private Call Requested",
        description: "Your request has been sent to the creator.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Request Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handlePrivateCallRequest = (stream: any) => {
    setSelectedStream(stream);
    setShowPrivateCallDialog(true);
  };

  const submitPrivateCallRequest = () => {
    if (!selectedStream) return;
    
    privateCallMutation.mutate({
      creatorId: selectedStream.creatorId,
      streamId: selectedStream.id,
      requestMessage: privateCallMessage
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      {typedUser && <Navbar user={typedUser} />}

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            Welcome back, {typedUser?.firstName || typedUser?.username}!
          </h2>
          <p className="text-muted-foreground">
            Discover amazing live streams and support your favorite creators
          </p>
        </div>

        <Tabs defaultValue="streams" className="space-y-4">
          <TabsList className="bg-card border border-border w-full justify-start overflow-x-auto scrollbar-hide">
            <TabsTrigger value="streams" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-shrink-0 text-xs sm:text-sm px-2 sm:px-4">
              <Video className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Live Streams</span>
              <span className="sm:hidden">Streams</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-shrink-0 text-xs sm:text-sm px-2 sm:px-4">
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">My Activity</span>
              <span className="sm:hidden">Activity</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-shrink-0 text-xs sm:text-sm px-2 sm:px-4">
              <UserIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span>Profile</span>
            </TabsTrigger>
            <TabsTrigger value="wallet" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-shrink-0 text-xs sm:text-sm px-2 sm:px-4">
              <Wallet className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span>Wallet</span>
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
                  <Card key={i} className="bg-card border-border animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-40 bg-muted rounded mb-4"></div>
                      <div className="h-4 bg-muted rounded mb-2"></div>
                      <div className="h-3 bg-muted rounded w-2/3"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : typedStreams.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {typedStreams.map((stream: any) => (
                  <Card key={stream.id} className="bg-card border-border hover:border-primary transition-all transform hover:scale-105 group">
                    <CardContent className="p-0">
                      {/* Stream Thumbnail */}
                      <div className="relative overflow-hidden">
                        <div className="h-48 bg-gradient-to-br from-primary via-blue-600 to-primary flex items-center justify-center relative overflow-hidden">
                          {stream.creatorProfileImage ? (
                            <img 
                              src={stream.creatorProfileImage} 
                              alt={`${stream.creatorFirstName} ${stream.creatorLastName}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <>
                              <Video className="w-16 h-16 text-white opacity-80" />
                            </>
                          )}
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
                            by <span className="text-purple-400 font-medium">
                              {stream.creatorFirstName && stream.creatorLastName 
                                ? `${stream.creatorFirstName} ${stream.creatorLastName}` 
                                : stream.creatorName}
                            </span>
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
                            <Phone className="w-3 h-3 mr-1 text-pink-500" />
                            Private calls available
                          </span>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex space-x-2">
                          <Button 
                            onClick={() => handleWatchStream(stream.id)}
                            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Watch
                          </Button>
                          <Button 
                            onClick={() => handlePrivateCallRequest(stream)}
                            variant="outline"
                            className="border-pink-600 text-pink-400 hover:bg-pink-600 hover:text-white"
                          >
                            <Phone className="w-4 h-4" />
                          </Button>
                        </div>
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

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center">
                      <UserIcon className="mr-2 h-5 w-5 text-purple-500" />
                      Profile Settings
                    </CardTitle>
                    <CardDescription>
                      Manage your personal information and preferences
                    </CardDescription>
                  </div>
                  {!isEditingProfile && (
                    <Button
                      onClick={() => setIsEditingProfile(true)}
                      variant="outline"
                      size="sm"
                      className="border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditingProfile ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-300">First Name *</Label>
                        <Input
                          value={profileData.firstName}
                          onChange={(e) => setProfileData({...profileData, firstName: e.target.value})}
                          placeholder="Enter your first name"
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">Last Name</Label>
                        <Input
                          value={profileData.lastName}
                          onChange={(e) => setProfileData({...profileData, lastName: e.target.value})}
                          placeholder="Enter your last name"
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-slate-300">Email Address *</Label>
                      <Input
                        type="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                        placeholder="Enter your email address"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-slate-300">Phone Number</Label>
                      <Input
                        type="tel"
                        value={profileData.phoneNumber}
                        onChange={(e) => setProfileData({...profileData, phoneNumber: e.target.value})}
                        placeholder="Enter your phone number"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    
                    <div className="flex space-x-2 pt-4">
                      <Button
                        onClick={handleUpdateProfile}
                        disabled={updateProfileMutation.isPending}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button
                        onClick={() => setIsEditingProfile(false)}
                        variant="outline"
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-slate-400">Name</p>
                          <p className="text-white font-medium">
                            {typedUser?.firstName && typedUser?.lastName 
                              ? `${typedUser.firstName} ${typedUser.lastName}` 
                              : typedUser?.username || "Not set"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Email</p>
                          <p className="text-white">{typedUser?.email || "Not set"}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-slate-400">Username</p>
                          <p className="text-white">{typedUser?.username}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Phone Number</p>
                          <p className="text-white">{typedUser?.phoneNumber || "Not set"}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-slate-700">
                      <div className="flex items-center space-x-4">
                        <Badge variant="secondary" className="bg-blue-600 text-white">
                          <UserIcon className="w-3 h-3 mr-1" />
                          {typedUser?.role ? typedUser.role.charAt(0).toUpperCase() + typedUser.role.slice(1) : 'User'} Account
                        </Badge>
                        <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                          <Wallet className="w-3 h-3 mr-1" />
                          {(wallet as any)?.tokenBalance || 0} Tokens
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Wallet Tab */}
          <TabsContent value="wallet" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Wallet Balance */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <Wallet className="w-5 h-5 mr-2 text-yellow-500" />
                    Wallet Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-6">
                    <div className="text-4xl font-bold text-yellow-500 mb-2">
                      {(wallet as any)?.tokenBalance || 0}
                    </div>
                    <div className="text-slate-400">Available StreamVibe Tokens</div>
                    <Button 
                      className="mt-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      onClick={() => setShowBuyTokens(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Buy More Tokens
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Transactions */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <TrendingUp className="w-5 h-5 mr-2 text-blue-500" />
                    Recent Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {typedTransactions.length === 0 ? (
                      <div className="text-center py-4 text-slate-400">
                        No transactions yet
                      </div>
                    ) : (
                      typedTransactions.slice(0, 5).map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                              <Gift className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">
                                {transaction.type === 'tip' ? 'Tip to Creator' : 'Activity Purchase'}
                              </p>
                              <p className="text-xs text-slate-400">
                                {transaction.createdAt ? new Date(transaction.createdAt).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-red-400">
                              -{transaction.amount} tokens
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
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

      {/* Private Call Request Dialog */}
      <Dialog open={showPrivateCallDialog} onOpenChange={setShowPrivateCallDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center">
              <Phone className="w-6 h-6 mr-2 text-pink-500" />
              Request Private Call
            </DialogTitle>
            <DialogDescription>
              Send a private call request to {selectedStream?.creatorFirstName} {selectedStream?.creatorLastName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-slate-700/50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Cost per call</span>
                <Badge variant="secondary" className="bg-pink-600">
                  <Coins className="w-3 h-3 mr-1" />
                  500 Tokens
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Minimum duration</span>
                <span className="text-sm text-white">5 minutes</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="callMessage">Message (Optional)</Label>
              <Input
                id="callMessage"
                placeholder="Say something to the creator..."
                value={privateCallMessage}
                onChange={(e) => setPrivateCallMessage(e.target.value)}
                className="bg-slate-700 border-slate-600"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowPrivateCallDialog(false)}
              className="border-slate-600"
            >
              Cancel
            </Button>
            <Button 
              onClick={submitPrivateCallRequest}
              disabled={privateCallMutation.isPending}
              className="bg-pink-600 hover:bg-pink-700"
            >
              {privateCallMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Requesting...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4 mr-2" />
                  Send Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}