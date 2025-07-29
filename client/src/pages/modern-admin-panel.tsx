import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import AdminNavbar from "@/components/admin-navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  IndianRupee, 
  CheckCircle, 
  XCircle, 
  Clock, 
  CreditCard, 
  Send,
  Wallet,
  TrendingUp,
  Users,
  Eye,
  Ban,
  AlertTriangle,
  Play,
  Home
} from "lucide-react";

export default function ModernAdminPanel() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [selectedPayout, setSelectedPayout] = useState<any>(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  // Get active tab from URL parameters  
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const [activeTab, setActiveTab] = useState(urlParams.get('tab') || 'dashboard');
  
  // Update active tab when URL changes
  useEffect(() => {
    const currentParams = new URLSearchParams(location.split('?')[1] || '');
    const tabFromUrl = currentParams.get('tab') || 'dashboard';
    setActiveTab(tabFromUrl);
  }, [location]);

  const typedUser = user as User | undefined;

  // Redirect to home if not authenticated or not an admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || typedUser?.role !== 'admin')) {
      toast({
        title: "Unauthorized",
        description: "Admin access required. Redirecting...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/admin";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, typedUser, toast]);

  // Fetch pending token purchases
  const { data: pendingTokenPurchases = [] } = useQuery({
    queryKey: ["/api/admin/pending-token-purchases"],
    retry: false,
  }) as { data: any[] };

  // Fetch pending payouts
  const { data: pendingPayouts = [] } = useQuery({
    queryKey: ["/api/admin/pending-payouts"],
    retry: false,
  }) as { data: any[] };

  // Fetch pending creators
  const { data: pendingCreators = [] } = useQuery({
    queryKey: ["/api/admin/pending-creators"],
    retry: false,
  }) as { data: any[] };

  // Get platform stats
  const { data: platformStats } = useQuery({
    queryKey: ["/api/admin/stats"],
    retry: false,
  });

  // Fetch live streams for monitoring
  const { data: liveStreams = [] } = useQuery({
    queryKey: ["/api/streams/live"],
    refetchInterval: 5000, // Refresh every 5 seconds
  }) as { data: any[] };

  // Fetch all users for banning
  const { data: allUsers = [] } = useQuery({
    queryKey: ["/api/admin/users"],
    retry: false,
  }) as { data: any[] };

  // Approve token purchase mutation
  const approveTokenPurchaseMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      await apiRequest("POST", `/api/admin/approve-token-purchase/${purchaseId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Token Purchase Approved",
        description: "Tokens have been credited to user's wallet.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-token-purchases"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please login again.",
          variant: "destructive",
        });
        window.location.href = "/admin";
        return;
      }
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Reject token purchase mutation
  const rejectTokenPurchaseMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      await apiRequest("POST", `/api/admin/reject-token-purchase/${purchaseId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Token Purchase Rejected",
        description: "Purchase request has been rejected.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-token-purchases"] });
    },
    onError: (error) => {
      toast({
        title: "Rejection Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Release payout mutation
  const releasePayoutMutation = useMutation({
    mutationFn: async ({ payoutId, utrNumber }: { payoutId: string; utrNumber: string }) => {
      await apiRequest("POST", `/api/admin/release-payout/${payoutId}`, { utrNumber });
    },
    onSuccess: () => {
      toast({
        title: "Payout Released",
        description: "Payment has been sent to creator.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payouts"] });
      setShowReleaseDialog(false);
      setSelectedPayout(null);
      setUtrNumber("");
    },
    onError: (error) => {
      toast({
        title: "Payout Release Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleReleasePayout = (payout: any) => {
    setSelectedPayout(payout);
    setShowReleaseDialog(true);
  };

  // Approve creator mutation
  const approveCreatorMutation = useMutation({
    mutationFn: async (creatorId: string) => {
      await apiRequest("POST", `/api/admin/approve-creator/${creatorId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Creator Approved",
        description: "Creator can now access their dashboard.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-creators"] });
    },
    onError: (error) => {
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Ban user mutation
  const banUserMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      await apiRequest("POST", `/api/admin/ban-user/${userId}`, { reason });
    },
    onSuccess: () => {
      toast({
        title: "User Banned",
        description: "User has been banned successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams/live"] });
    },
    onError: (error) => {
      toast({
        title: "Ban Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // End stream mutation (for inappropriate content)
  const endStreamMutation = useMutation({
    mutationFn: async ({ streamId, reason }: { streamId: string; reason: string }) => {
      await apiRequest("POST", `/api/admin/end-stream/${streamId}`, { reason });
    },
    onSuccess: () => {
      toast({
        title: "Stream Ended",
        description: "Stream has been terminated for policy violation.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/streams/live"] });
    },
    onError: (error) => {
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleConfirmRelease = () => {
    if (!utrNumber.trim()) {
      toast({
        title: "UTR Required",
        description: "Please enter the UTR number for the transaction.",
        variant: "destructive",
      });
      return;
    }
    releasePayoutMutation.mutate({ payoutId: selectedPayout.id, utrNumber });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || typedUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white">Unauthorized Access</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <AdminNavbar />
      
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-slate-400">Manage payments, approvals, and platform oversight</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Pending Purchases</p>
                  <p className="text-2xl font-bold text-white">{pendingTokenPurchases.length}</p>
                </div>
                <CreditCard className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Pending Payouts</p>
                  <p className="text-2xl font-bold text-white">{pendingPayouts.length}</p>
                </div>
                <Send className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Pending Creators</p>
                  <p className="text-2xl font-bold text-white">{pendingCreators.length}</p>
                </div>
                <Users className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Purchase Value</p>
                  <p className="text-2xl font-bold text-white">
                    ₹{pendingTokenPurchases.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0).toLocaleString()}
                  </p>
                </div>
                <Wallet className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Payout Value</p>
                  <p className="text-2xl font-bold text-white">
                    ₹{pendingPayouts.reduce((sum, p) => sum + parseFloat(p.requestedAmount || 0), 0).toLocaleString()}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Buttons */}
        <div className="mb-8 flex flex-wrap gap-4">
          <Button
            onClick={() => setActiveTab('dashboard')}
            variant={activeTab === 'dashboard' ? 'default' : 'outline'}
            className={activeTab === 'dashboard' ? 'bg-blue-600 hover:bg-blue-700' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
          >
            <Home className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
          <Button
            onClick={() => setActiveTab('streams')}
            variant={activeTab === 'streams' ? 'default' : 'outline'}
            className={activeTab === 'streams' ? 'bg-red-600 hover:bg-red-700' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
          >
            <Eye className="mr-2 h-4 w-4" />
            Stream Monitor
          </Button>
          <Button
            onClick={() => setActiveTab('purchases')}
            variant={activeTab === 'purchases' ? 'default' : 'outline'}
            className={activeTab === 'purchases' ? 'bg-blue-600 hover:bg-blue-700' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Token Purchases ({pendingTokenPurchases.length})
          </Button>
          <Button
            onClick={() => setActiveTab('payouts')}
            variant={activeTab === 'payouts' ? 'default' : 'outline'}
            className={activeTab === 'payouts' ? 'bg-green-600 hover:bg-green-700' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
          >
            <Send className="mr-2 h-4 w-4" />
            Creator Payouts ({pendingPayouts.length})
          </Button>
          <Button
            onClick={() => setActiveTab('users')}
            variant={activeTab === 'users' ? 'default' : 'outline'}
            className={activeTab === 'users' ? 'bg-blue-600 hover:bg-blue-700' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
          >
            <Users className="mr-2 h-4 w-4" />
            All Users
          </Button>
          <Button
            onClick={() => setActiveTab('creators')}
            variant={activeTab === 'creators' ? 'default' : 'outline'}
            className={activeTab === 'creators' ? 'bg-purple-600 hover:bg-purple-700' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
          >
            <Users className="mr-2 h-4 w-4" />
            Creator Approval ({pendingCreators.length})
          </Button>
        </div>

        {/* Main Content */}
        <div className="space-y-6">

          {/* Dashboard View */}
          {activeTab === 'dashboard' && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Home className="mr-2 h-5 w-5" />
                  Platform Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                  <p className="text-slate-400 mb-4">Welcome to the StreamVibe Admin Dashboard</p>
                  <p className="text-slate-500 text-sm">Use the navigation buttons above to manage different aspects of the platform.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stream Monitor Tab */}
          {activeTab === 'streams' && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Eye className="mr-2 h-5 w-5" />
                  Live Stream Monitoring
                </CardTitle>
              </CardHeader>
              <CardContent>
                {liveStreams.length === 0 ? (
                  <div className="text-center py-8">
                    <Play className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-400">No live streams currently active</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {liveStreams.map((stream: any) => (
                      <Card key={stream.id} className="bg-slate-700 border-slate-600">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            {/* Stream Info */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="text-white font-medium truncate">{stream.title}</h3>
                                <Badge className="bg-red-600 text-white text-xs">
                                  LIVE
                                </Badge>
                              </div>
                              <p className="text-slate-400 text-sm">Creator: {stream.creatorName}</p>
                              <p className="text-slate-400 text-sm">Category: {stream.category}</p>
                              <p className="text-slate-400 text-sm">
                                Started: {new Date(stream.createdAt).toLocaleString()}
                              </p>
                            </div>

                            {/* Stream Actions */}
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => window.open(`/stream/${stream.id}`, '_blank')}
                                className="bg-blue-600 hover:bg-blue-700 flex-1"
                              >
                                <Eye className="mr-1 h-4 w-4" />
                                Monitor
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => endStreamMutation.mutate({ 
                                  streamId: stream.id, 
                                  reason: "Content policy violation" 
                                })}
                                disabled={endStreamMutation.isPending}
                                className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Creator Actions */}
                            <div className="pt-2 border-t border-slate-600">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 text-sm">Creator Actions:</span>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => banUserMutation.mutate({ 
                                    userId: stream.creatorId, 
                                    reason: "Inappropriate content" 
                                  })}
                                  disabled={banUserMutation.isPending}
                                  className="text-xs"
                                >
                                  <AlertTriangle className="mr-1 h-3 w-3" />
                                  Ban Creator
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* All Users Tab */}
          {activeTab === 'users' && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  All Platform Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-400">No users found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {users.map((user: any) => (
                      <Card key={user.id} className="bg-slate-700 border-slate-600">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                  <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center">
                                    <span className="text-white font-medium text-sm">
                                      {user.username?.charAt(0).toUpperCase() || 'U'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <p className="text-white font-medium">
                                    {user.firstName} {user.lastName} (@{user.username})
                                  </p>
                                  <p className="text-slate-400 text-sm">
                                    {user.email || 'No email provided'}
                                  </p>
                                  <div className="flex items-center space-x-2 mt-2">
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs ${
                                        user.role === 'admin' ? 'text-red-400 border-red-400' :
                                        user.role === 'creator' ? 'text-purple-400 border-purple-400' :
                                        'text-blue-400 border-blue-400'
                                      }`}
                                    >
                                      {user.role?.charAt(0).toUpperCase() + user.role?.slice(1)}
                                    </Badge>
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs ${
                                        user.isOnline ? 'text-green-400 border-green-400' : 'text-gray-400 border-gray-400'
                                      }`}
                                    >
                                      {user.isOnline ? 'Online' : 'Offline'}
                                    </Badge>
                                    {user.role === 'creator' && (
                                      <Badge 
                                        variant="outline" 
                                        className={`text-xs ${
                                          user.isApproved ? 'text-green-400 border-green-400' : 'text-yellow-400 border-yellow-400'
                                        }`}
                                      >
                                        {user.isApproved ? 'Approved' : 'Pending'}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-4 mt-1 text-xs text-slate-500">
                                    <span>Wallet: ₹{user.walletBalance || 0}</span>
                                    <span>Joined: {new Date(user.createdAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => banUserMutation.mutate({ 
                                  userId: user.id, 
                                  reason: "Admin action" 
                                })}
                                disabled={banUserMutation.isPending || user.role === 'admin'}
                                className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white text-xs"
                              >
                                <Ban className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Token Purchases Tab */}
          {activeTab === 'purchases' && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <CreditCard className="mr-2 h-5 w-5" />
                  Pending Token Purchases
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingTokenPurchases.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-400">No pending token purchases</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingTokenPurchases.map((purchase: any) => (
                      <Card key={purchase.id} className="bg-slate-700 border-slate-600">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white font-medium">{purchase.username || 'Unknown User'}</p>
                              <p className="text-slate-400 text-sm">
                                {purchase.tokens} tokens • ₹{purchase.amount}
                              </p>
                              {purchase.utrNumber && (
                                <p className="text-slate-400 text-sm">UTR: {purchase.utrNumber}</p>
                              )}
                              <p className="text-slate-500 text-xs">
                                {new Date(purchase.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => approveTokenPurchaseMutation.mutate(purchase.id)}
                                disabled={approveTokenPurchaseMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="mr-1 h-4 w-4" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => rejectTokenPurchaseMutation.mutate(purchase.id)}
                                disabled={rejectTokenPurchaseMutation.isPending}
                                className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                              >
                                <XCircle className="mr-1 h-4 w-4" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Payouts Tab */}
          {activeTab === 'payouts' && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Send className="mr-2 h-5 w-5" />
                  Pending Creator Payouts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingPayouts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-400">No pending payouts</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingPayouts.map((payout: any) => (
                      <Card key={payout.id} className="bg-slate-700 border-slate-600">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white font-medium">{payout.creatorName || 'Unknown Creator'}</p>
                              <p className="text-slate-400 text-sm">
                                {payout.tokenAmount} tokens → ₹{payout.requestedAmount}
                              </p>
                              <p className="text-slate-400 text-sm">UPI: {payout.upiId}</p>
                              <p className="text-slate-500 text-xs">
                                Requested: {new Date(payout.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => handleReleasePayout(payout)}
                                disabled={releasePayoutMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Send className="mr-1 h-4 w-4" />
                                Release Payment
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Creator Approvals Tab */}
          {activeTab === 'creators' && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  Pending Creator Approvals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingCreators.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-400">No pending creator approvals</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingCreators.map((creator: any) => (
                      <Card key={creator.id} className="bg-slate-700 border-slate-600">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white font-medium">
                                {creator.firstName} {creator.lastName} (@{creator.username})
                              </p>
                              <p className="text-slate-400 text-sm">
                                Email: {creator.email || 'Not provided'}
                              </p>
                              <div className="flex items-center space-x-2 mt-2">
                                <Badge variant="outline" className="text-purple-400 border-purple-400">
                                  Creator Account
                                </Badge>
                                <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                                  <Clock className="mr-1 h-3 w-3" />
                                  Pending Approval
                                </Badge>
                              </div>
                              <p className="text-slate-500 text-xs mt-1">
                                Registered: {new Date(creator.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => approveCreatorMutation.mutate(creator.id)}
                                disabled={approveCreatorMutation.isPending}
                                className="bg-purple-600 hover:bg-purple-700"
                              >
                                <CheckCircle className="mr-1 h-4 w-4" />
                                Approve Creator
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Release Payout Dialog */}
      <Dialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Release Payout</DialogTitle>
            <DialogDescription className="text-slate-400">
              Confirm payment release to {selectedPayout?.creatorName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-slate-700 p-4 rounded-lg">
              <p className="text-white font-medium">Payment Details:</p>
              <p className="text-slate-400">Amount: ₹{selectedPayout?.requestedAmount}</p>
              <p className="text-slate-400">UPI ID: {selectedPayout?.upiId}</p>
              <p className="text-slate-400">Tokens: {selectedPayout?.tokenAmount}</p>
            </div>
            
            <div>
              <Label className="text-slate-300">Transaction UTR Number *</Label>
              <Input
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                placeholder="Enter UTR number from payment transaction"
                className="bg-slate-700 border-slate-600 text-white"
              />
              <p className="text-slate-500 text-sm mt-1">
                Enter the UTR number after completing the UPI payment
              </p>
            </div>
            
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setShowReleaseDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmRelease}
                disabled={releasePayoutMutation.isPending || !utrNumber.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {releasePayoutMutation.isPending ? "Releasing..." : "Confirm Release"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}