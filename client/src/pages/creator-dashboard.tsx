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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DollarSign, Users, Clock, Heart, Play, Settings, Phone, Mail, UserIcon, Video, Plus, Trash2, Edit, CheckCircle, XCircle, Square } from "lucide-react";
import PrivateCallRequests from "@/components/private-call-requests";
import StreamModal from "@/components/stream-modal";

export default function CreatorDashboard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  
  // Add error handling for authentication
  if (!isLoading && !isAuthenticated) {
    window.location.href = '/creator-login';
    return null;
  }
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
    email: "",
    phoneNumber: "",
    profileImageUrl: "",
  });
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [streamKey, setStreamKey] = useState<string>("");
  
  // Custom tips state
  const [customTips, setCustomTips] = useState<Array<{id?: string, name: string, tokenCost: number}>>([]);
  const [newTip, setNewTip] = useState({ name: "", tokenCost: 2 });
  const [editingTip, setEditingTip] = useState<{id: string, name: string, tokenCost: number} | null>(null);


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
        email: typedUser.email || "",
        phoneNumber: (typedUser as any).phoneNumber || "",
        profileImageUrl: typedUser.profileImageUrl || "",
      });
    }
  }, [typedUser]);



  const handleProfileSave = () => {
    updateProfileMutation.mutate(profileData);
  };



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

  // Show pending approval message if creator not approved
  if (typedUser?.role === 'creator' && !typedUser?.isApproved) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-800 border-purple-500/20">
          <CardHeader className="text-center">
            <CardTitle className="text-white text-2xl">Account Pending Approval</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="text-yellow-400 text-lg">⏳</div>
            <p className="text-slate-300">
              Your creator account is currently under review by our administrators.
            </p>
            <p className="text-slate-400 text-sm">
              You'll receive access to your creator dashboard once your account is approved. 
              This usually takes 24-48 hours.
            </p>
            <div className="pt-4">
              <Button 
                onClick={() => window.location.href = '/api/auth/logout'}
                variant="outline"
                className="text-purple-300 border-purple-500 hover:bg-purple-600"
              >
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  // Update streaming state and set stream key
  useEffect(() => {
    const stream = currentStream as any;
    if (stream && stream.isLive) {
      setIsStreaming(true);
      setStreamKey(stream.id || '');
      setStreamData(prev => {
        const newData = {
          title: stream.title || "",
          category: stream.category || "Art & Design",
          minTip: stream.minTip || 5,
          tokenPrice: stream.tokenPrice || 1,
          privateRate: stream.privateRate || 20
        };
        // Only update if values are actually different
        if (JSON.stringify(prev) !== JSON.stringify(newData)) {
          return newData;
        }
        return prev;
      });
    } else {
      setIsStreaming(false);
    }
  }, [currentStream]);

  // Fetch creator's custom tip actions
  const { data: creatorTips = [] } = useQuery({
    queryKey: ["/api/creator/action-presets"],
    retry: false,
    enabled: !!typedUser,
  });

  // Update local state when creator tips are loaded
  useEffect(() => {
    if (creatorTips && Array.isArray(creatorTips)) {
      setCustomTips(prev => {
        // Only update if the data is actually different
        if (JSON.stringify(prev) !== JSON.stringify(creatorTips)) {
          return creatorTips;
        }
        return prev;
      });
    }
  }, [creatorTips]);

  // Custom tip mutations
  const createTipMutation = useMutation({
    mutationFn: async (data: { name: string; tokenCost: number; order: number }) => {
      return await apiRequest("POST", "/api/creator/action-presets", data);
    },
    onSuccess: () => {
      toast({
        title: "Custom Tip Added",
        description: "Your custom tip action has been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/action-presets"] });
      setNewTip({ name: "", tokenCost: 2 });
    },
    onError: (error) => {
      toast({
        title: "Failed to Add Tip",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const updateTipMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; tokenCost: number } }) => {
      return await apiRequest("PUT", `/api/creator/action-presets/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Tip Updated",
        description: "Your custom tip action has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/action-presets"] });
      setEditingTip(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to Update Tip",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const deleteTipMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/creator/action-presets/${id}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Tip Deleted",
        description: "Your custom tip action has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/action-presets"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Delete Tip",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const createStreamMutation = useMutation({
    mutationFn: async (streamData: any) => {
      const response = await apiRequest("POST", "/api/streams", {
        title: streamData.title || `${typedUser?.firstName || typedUser?.username || 'Creator'}'s Stream`,
        category: streamData.category,
        minTip: streamData.minTip,
        tokenPrice: streamData.tokenPrice,
        privateRate: streamData.privateRate,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams/current"] });
      // Redirect to full-screen live studio
      window.location.href = `/creator-live-studio?streamId=${data.id}`;
      toast({
        title: "Stream Created!",
        description: "Redirecting to Live Studio...",
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
      const stream = currentStream as any;
      if (!stream?.id) {
        throw new Error('No active stream to stop');
      }
      const response = await apiRequest("DELETE", `/api/streams/${stream.id}`);
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
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please login again.",
          variant: "destructive",
        });
        window.location.href = "/creator-login";
        return;
      }
      toast({
        title: "Failed to Update Profile",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const [showPayoutDialog, setShowPayoutDialog] = useState(false);
  const [payoutData, setPayoutData] = useState({
    tokenAmount: 0,
    upiId: ""
  });

  const requestPayoutMutation = useMutation({
    mutationFn: async (data: { tokenAmount: number; upiId: string }) => {
      const response = await apiRequest("POST", "/api/creator/request-payout", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creator/stats"] });
      setShowPayoutDialog(false);
      setPayoutData({ tokenAmount: 0, upiId: "" });
      toast({
        title: "Payout Requested",
        description: "Your payout request has been submitted for admin review.",
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
    
    // If we have a stream (live or not), open full-screen live studio
    if (stream?.id) {
      window.location.href = `/creator-live-studio?streamId=${stream.id}`;
    } else {
      // Create stream first, then redirect to live studio
      if (!streamData.title.trim()) {
        toast({
          title: "Title Required",
          description: "Please enter a title for your stream",
          variant: "destructive",
        });
        return;
      }
      createStreamMutation.mutate(streamData);
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout');
      toast({
        title: "Logged out successfully",
        description: "Redirecting to login page...",
      });
      setTimeout(() => {
        window.location.href = '/creator-login';
      }, 1000);
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/creator-login';
    }
  };

  const handleStopStream = () => {
    const stream = currentStream as any;
    if (!stream?.id) {
      toast({
        title: "No Active Stream",
        description: "No stream to stop.",
        variant: "destructive",
      });
      return;
    }
    stopStreamMutation.mutate();
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
    const availableEarnings = (stats as any)?.availableEarnings || 0;
    const minimumPayout = 1000; // Minimum 1000 tokens for withdrawal
    
    if (availableEarnings < minimumPayout) {
      toast({
        title: "Not Enough Tokens to Withdraw",
        description: `You need at least ${minimumPayout} tokens to request a payout. Current balance: ${availableEarnings} tokens.`,
        variant: "destructive",
      });
      return;
    }
    
    setShowPayoutDialog(true);
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
      {/* Mobile-Friendly Navbar */}
      <nav className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <h1 className="text-xl sm:text-2xl font-bold text-primary">Creator Studio</h1>
            <div className="hidden sm:flex items-center space-x-2">
              <Button 
                onClick={() => window.location.href = '/'}
                variant="outline"
                size="sm"
                className="text-slate-300 border-slate-600 hover:bg-slate-700"
              >
                Home
              </Button>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Mobile dropdown menu */}
            <div className="sm:hidden">
              <Button 
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                variant="ghost"
                size="sm"
                className="text-slate-300"
              >
                ☰
              </Button>
            </div>
            
            {/* Desktop buttons - REMOVED DUPLICATE STOP STREAM */}
            <div className="hidden sm:flex items-center space-x-2">
              <Button 
                onClick={handleGoLive}
                className="bg-red-500 hover:bg-red-600"
                disabled={createStreamMutation.isPending}
                size="sm"
              >
                <Play className="mr-2 h-4 w-4" />
                {(currentStream as any)?.isLive ? "Live Studio" : "Go Live"}
              </Button>
              <Button 
                onClick={handleRequestPayout}
                variant="outline"
                disabled={requestPayoutMutation.isPending || ((stats as any)?.availableEarnings || 0) < 1000}
                className="border-green-600 text-green-400 hover:bg-green-600 hover:text-white disabled:border-gray-600 disabled:text-gray-500"
                size="sm"
              >
                <DollarSign className="mr-2 h-4 w-4" />
                {requestPayoutMutation.isPending ? "Processing..." : 
                 ((stats as any)?.availableEarnings || 0) < 1000 ? 
                 `Need ${1000 - ((stats as any)?.availableEarnings || 0)} more tokens` : 
                 "Request Payout"}
              </Button>
              <Button 
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="text-red-400 border-red-600 hover:bg-red-900/20"
              >
                Logout
              </Button>
            </div>

            {/* Mobile: Only show main action button - REMOVED DUPLICATE STOP STREAM */}
            <div className="sm:hidden">
              <Button 
                onClick={handleGoLive}
                className="bg-red-500 hover:bg-red-600"
                disabled={createStreamMutation.isPending}
                size="sm"
              >
                {(currentStream as any)?.isLive ? "Studio" : "Go Live"}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {showMobileMenu && (
          <div className="sm:hidden mt-4 border-t border-slate-700 pt-4">
            <div className="flex flex-col space-y-2">
              <Button 
                onClick={() => window.location.href = '/'}
                variant="outline"
                size="sm"
                className="w-full text-slate-300 border-slate-600 hover:bg-slate-700"
              >
                Home
              </Button>
              <Button 
                onClick={handleRequestPayout}
                disabled={requestPayoutMutation.isPending || ((stats as any)?.availableEarnings || 0) < 1000}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:text-gray-400"
                size="sm"
              >
                {requestPayoutMutation.isPending ? "Processing..." : 
                 ((stats as any)?.availableEarnings || 0) < 1000 ? 
                 `Need ${1000 - ((stats as any)?.availableEarnings || 0)} more tokens` : 
                 "Request Payout"}
              </Button>
              <Button 
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="w-full text-red-400 border-red-600 hover:bg-red-900/20"
              >
                Logout
              </Button>
            </div>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-6">


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



        {/* Profile Management */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <div className="flex items-center">
                <UserIcon className="mr-2 h-5 w-5" />
                Creator Profile
              </div>
              <Button
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                variant="outline"
                size="sm"
                className="text-purple-300 border-purple-500 hover:bg-purple-600"
              >
                {isEditingProfile ? "Cancel" : "Edit Profile"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isEditingProfile ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                    {profileData.profileImageUrl ? (
                      <img 
                        src={profileData.profileImageUrl} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UserIcon className="h-8 w-8 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-white font-medium">{profileData.firstName} {profileData.lastName}</p>
                    <p className="text-slate-400 text-sm">@{profileData.username}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center text-slate-300">
                    <Mail className="h-4 w-4 mr-2" />
                    <span className="text-sm">{profileData.email || "Not provided"}</span>
                  </div>
                  <div className="flex items-center text-slate-300">
                    <Phone className="h-4 w-4 mr-2" />
                    <span className="text-sm">{profileData.phoneNumber || "Not provided"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">First Name</Label>
                    <Input
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="Enter first name"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Last Name</Label>
                    <Input
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="Enter last name"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Username</Label>
                    <Input
                      value={profileData.username}
                      onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="Enter username"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Email</Label>
                    <Input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="Enter email address"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Phone Number</Label>
                    <Input
                      type="tel"
                      value={profileData.phoneNumber}
                      onChange={(e) => setProfileData({ ...profileData, phoneNumber: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="+91 XXXXX XXXXX"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Profile Image</Label>
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Convert to base64 for simple storage
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const result = event.target?.result as string;
                              setProfileData({ ...profileData, profileImageUrl: result });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="bg-slate-700 border-slate-600 text-white file:bg-slate-600 file:text-white file:border-0 file:rounded file:px-3 file:py-1"
                      />
                      <p className="text-xs text-slate-400">Upload an image or paste URL below</p>
                      <Input
                        type="url"
                        value={profileData.profileImageUrl}
                        onChange={(e) => setProfileData({ ...profileData, profileImageUrl: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <Button
                    onClick={handleProfileSave}
                    disabled={updateProfileMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
                  </Button>
                  <Button
                    onClick={() => setIsEditingProfile(false)}
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Custom Tips Management */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Heart className="mr-2 h-5 w-5 text-pink-500" />
              Custom Tip Actions
            </CardTitle>
            <p className="text-slate-400 text-sm">
              Create custom tip actions for your viewers. These will be automatically promoted in your chat every 10 seconds when you're live.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add New Tip Action */}
            <Card className="bg-slate-700 border-slate-600">
              <CardContent className="p-4">
                <h3 className="text-white font-medium mb-4">Add New Tip Action</h3>
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <Label className="text-slate-300">Action Name</Label>
                    <Input
                      value={newTip.name}
                      onChange={(e) => setNewTip(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Say Hello, Wave, Dance"
                      className="bg-slate-600 border-slate-500 text-white"
                    />
                  </div>
                  <div className="w-32">
                    <Label className="text-slate-300">Token Cost</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newTip.tokenCost}
                      onChange={(e) => setNewTip(prev => ({ ...prev, tokenCost: parseInt(e.target.value) || 2 }))}
                      className="bg-slate-600 border-slate-500 text-white"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => {
                        if (newTip.name.trim()) {
                          createTipMutation.mutate({
                            name: newTip.name.trim(),
                            tokenCost: newTip.tokenCost,
                            order: customTips.length
                          });
                        }
                      }}
                      disabled={createTipMutation.isPending || !newTip.name.trim()}
                      className="bg-pink-600 hover:bg-pink-700"
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add Action
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Existing Custom Tips */}
            {customTips.length === 0 ? (
              <div className="text-center py-8">
                <Heart className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">No custom tip actions yet</p>
                <p className="text-slate-500 text-sm">Add your first custom tip action above</p>
              </div>
            ) : (
              <div className="space-y-4">
                {customTips.map((tip: any, index: number) => (
                  <Card key={tip.id} className="bg-slate-700 border-slate-600">
                    <CardContent className="p-4">
                      {editingTip?.id === tip.id ? (
                        // Edit Mode
                        <div className="flex items-center space-x-4">
                          <div className="flex-1">
                            <Input
                              value={editingTip?.name || ''}
                              onChange={(e) => setEditingTip(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                              className="bg-slate-600 border-slate-500 text-white"
                            />
                          </div>
                          <div className="w-24">
                            <Input
                              type="number"
                              min="1"
                              value={editingTip?.tokenCost || 2}
                              onChange={(e) => setEditingTip(prev => prev ? ({ ...prev, tokenCost: parseInt(e.target.value) || 2 }) : null)}
                              className="bg-slate-600 border-slate-500 text-white"
                            />
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                updateTipMutation.mutate({
                                  id: tip.id,
                                  data: {
                                    name: editingTip?.name || '',
                                    tokenCost: editingTip?.tokenCost || 2
                                  }
                                });
                              }}
                              disabled={updateTipMutation.isPending}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingTip(null)}
                              className="border-slate-500"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // Display Mode
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <span className="text-slate-400 text-sm">#{index + 1}</span>
                            <span className="text-white font-medium">{tip.name}</span>
                            <Badge variant="outline" className="text-pink-400 border-pink-400">
                              {tip.tokenCost} tokens
                            </Badge>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingTip({
                                id: tip.id,
                                name: tip.name,
                                tokenCost: tip.tokenCost
                              })}
                              className="border-slate-500 text-slate-300 hover:bg-slate-600"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm(`Delete "${tip.name}" tip action?`)) {
                                  deleteTipMutation.mutate(tip.id);
                                }
                              }}
                              disabled={deleteTipMutation.isPending}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Information Box */}
            <div className="bg-pink-900/20 border border-pink-600/30 rounded-lg p-4">
              <h4 className="text-pink-300 font-medium mb-2 flex items-center">
                <Heart className="mr-2 h-4 w-4" />
                Auto-Promotion Feature
              </h4>
              <ul className="text-pink-200 text-sm space-y-1">
                <li>• Your custom tip actions will be automatically promoted in chat every 10 seconds while you're live</li>
                <li>• Example: "💖 Tip Actions: Say Hello (2 tokens), Wave (2 tokens) - Show some love!"</li>
                <li>• Maximum 5 custom tip actions can be created per creator</li>
                <li>• Viewers can tip you using these predefined actions for easier interaction</li>
              </ul>
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

        {/* Private Call Requests */}
        <PrivateCallRequests />

        {/* Payout Section */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Earnings & Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Available Tokens</span>
                <span className="font-bold text-2xl">{(stats as any)?.totalEarnings || 0} tokens</span>
              </div>
              <Button 
                onClick={handleRequestPayout}
                disabled={requestPayoutMutation.isPending || ((stats as any)?.totalEarnings || 0) < 1000}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600"
              >
                {requestPayoutMutation.isPending ? "Processing..." : 
                 ((stats as any)?.availableEarnings || 0) < 1000 ? 
                 `Need ${1000 - ((stats as any)?.availableEarnings || 0)} more tokens` : 
                 "Request Payout"}
              </Button>
              <p className="text-xs text-slate-400">Minimum payout: 1000 tokens</p>
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
      


      {/* Payout Request Dialog */}
      <Dialog open={showPayoutDialog} onOpenChange={setShowPayoutDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Request Payout</DialogTitle>
            <DialogDescription className="text-slate-400">
              Convert your tokens to cash and receive payment via UPI
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-slate-700 p-4 rounded-lg">
              <p className="text-white font-medium">Available Balance:</p>
              <p className="text-slate-400">{(stats as any)?.totalEarnings || 0} tokens</p>
              <p className="text-slate-400">≈ ₹{((stats as any)?.totalEarnings || 0) * 1}.00</p>
            </div>
            
            <div>
              <Label className="text-slate-300">Withdrawal Amount (tokens) *</Label>
              <Input
                type="number"
                min="1000"
                max={(stats as any)?.totalEarnings || 0}
                value={payoutData.tokenAmount}
                onChange={(e) => setPayoutData({...payoutData, tokenAmount: parseInt(e.target.value) || 0})}
                placeholder="Minimum 1000 tokens"
                className="bg-slate-700 border-slate-600 text-white"
              />
              <p className="text-slate-500 text-sm mt-1">
                Cash equivalent: ₹{(payoutData.tokenAmount * 1).toFixed(2)}
              </p>
            </div>
            
            <div>
              <Label className="text-slate-300">UPI ID *</Label>
              <Input
                value={payoutData.upiId}
                onChange={(e) => setPayoutData({...payoutData, upiId: e.target.value})}
                placeholder="yourname@paytm / 9876543210@ybl"
                className="bg-slate-700 border-slate-600 text-white"
              />
              <p className="text-slate-500 text-sm mt-1">
                Payment will be sent to this UPI ID after admin approval
              </p>
            </div>
            
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setShowPayoutDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (payoutData.tokenAmount < 1000) {
                    toast({
                      title: "Invalid Amount",
                      description: "Minimum withdrawal is 1000 tokens",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (!payoutData.upiId.trim()) {
                    toast({
                      title: "UPI ID Required",
                      description: "Please enter your UPI ID for payment",
                      variant: "destructive",
                    });
                    return;
                  }
                  requestPayoutMutation.mutate({
                    tokenAmount: payoutData.tokenAmount,
                    upiId: payoutData.upiId.trim()
                  });
                }}
                disabled={requestPayoutMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {requestPayoutMutation.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );
}