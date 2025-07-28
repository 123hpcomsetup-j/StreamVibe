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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Video, Radio, IndianRupee, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export default function AdminPanel() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const typedUser = user as User | undefined;

  // Redirect to home if not authenticated or not an admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || typedUser?.role !== 'admin')) {
      toast({
        title: "Unauthorized",
        description: "Admin access required. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, typedUser, toast]);

  const { data: pendingCreators = [] } = useQuery({
    queryKey: ["/api/admin/pending-creators"],
    retry: false,
  }) as { data: any[] };

  const { data: pendingReports = [] } = useQuery({
    queryKey: ["/api/admin/pending-reports"],
    retry: false,
  }) as { data: any[] };

  const { data: pendingPayouts = [] } = useQuery({
    queryKey: ["/api/admin/pending-payouts"],
    retry: false,
  }) as { data: any[] };

  const { data: pendingTokenPurchases = [] } = useQuery({
    queryKey: ["/api/admin/pending-token-purchases"],
    retry: false,
  }) as { data: any[] };

  const approveCreatorMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("POST", `/api/admin/approve-creator/${userId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Creator Approved",
        description: "Creator has been approved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-creators"] });
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
        description: "Failed to approve creator. Please try again.",
        variant: "destructive",
      });
    },
  });

  const approveTokenPurchaseMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      await apiRequest("POST", `/api/admin/approve-token-purchase/${purchaseId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Token Purchase Approved",
        description: "Token purchase has been approved and tokens added to user wallet.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-token-purchases"] });
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
        description: "Failed to approve token purchase. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !typedUser || typedUser.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50">
      <Navbar user={typedUser} />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Admin Dashboard</h2>
            <p className="text-slate-400">Platform management and oversight</p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white">Total Users</h4>
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="text-2xl font-bold text-white">15,420</div>
                <div className="text-green-400 text-sm">+5.2% this month</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white">Active Creators</h4>
                  <Video className="h-5 w-5 text-secondary" />
                </div>
                <div className="text-2xl font-bold text-white">1,245</div>
                <div className="text-green-400 text-sm">+12 today</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white">Live Streams</h4>
                  <Radio className="h-5 w-5 text-red-500" />
                </div>
                <div className="text-2xl font-bold text-white">234</div>
                <div className="text-slate-400 text-sm">Currently active</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white">Revenue</h4>
                  <IndianRupee className="h-5 w-5 text-accent" />
                </div>
                <div className="text-2xl font-bold text-white">₹2.4M</div>
                <div className="text-green-400 text-sm">This month</div>
              </CardContent>
            </Card>
          </div>

          {/* Management Tabs */}
          <Card className="bg-slate-800 border-slate-700">
            <Tabs defaultValue="pending-approvals" className="w-full">
              <CardHeader>
                <TabsList className="grid w-full grid-cols-4 bg-slate-700">
                  <TabsTrigger value="pending-approvals" className="data-[state=active]:bg-primary">
                    Pending Approvals
                    {pendingCreators.length > 0 && (
                      <Badge className="ml-2 bg-red-500 text-white text-xs">{pendingCreators.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="data-[state=active]:bg-primary">
                    Reports
                    {pendingReports.length > 0 && (
                      <Badge className="ml-2 bg-yellow-600 text-white text-xs">{pendingReports.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="payouts" className="data-[state=active]:bg-primary">
                    Payouts
                    {pendingPayouts.length > 0 && (
                      <Badge className="ml-2 bg-blue-600 text-white text-xs">{pendingPayouts.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="token-purchases" className="data-[state=active]:bg-primary">
                    Token Purchases
                    {pendingTokenPurchases.length > 0 && (
                      <Badge className="ml-2 bg-green-600 text-white text-xs">{pendingTokenPurchases.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="p-6">
                {/* Pending Approvals Tab */}
                <TabsContent value="pending-approvals" className="space-y-4">
                  <h3 className="text-lg font-bold text-white">Creator Profile Approvals</h3>
                  {Array.isArray(pendingCreators) && pendingCreators.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-slate-400">No pending creator approvals</div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Array.isArray(pendingCreators) && pendingCreators.map((creator: any) => (
                        <div key={creator.id} className="flex items-center space-x-4 p-4 bg-slate-700 rounded-lg">
                          <img 
                            src={creator.profileImageUrl || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=80&h=80"} 
                            alt="Creator profile" 
                            className="w-16 h-16 rounded-full object-cover"
                          />
                          <div className="flex-1">
                            <h4 className="font-semibold text-white">{creator.firstName} {creator.lastName}</h4>
                            <p className="text-slate-400 text-sm">{creator.email}</p>
                            <p className="text-slate-300 text-sm mt-1">Role: {creator.role}</p>
                          </div>
                          <div className="flex space-x-2">
                            <Button 
                              onClick={() => approveCreatorMutation.mutate(creator.id)}
                              disabled={approveCreatorMutation.isPending}
                              className="bg-accent hover:bg-accent/80"
                            >
                              <CheckCircle className="mr-1 h-4 w-4" />
                              Approve
                            </Button>
                            <Button 
                              variant="destructive"
                              className="bg-red-600 hover:bg-red-700"
                            >
                              <XCircle className="mr-1 h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Reports Tab */}
                <TabsContent value="reports" className="space-y-4">
                  <h3 className="text-lg font-bold text-white">User Reports</h3>
                  {pendingReports.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-slate-400">No pending reports</div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingReports.map((report: any) => (
                        <div key={report.id} className="p-4 bg-slate-700 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-red-400 flex items-center">
                              <AlertTriangle className="mr-2 h-4 w-4" />
                              Inappropriate Content
                            </h4>
                            <Badge className="bg-yellow-600 text-white">Under Review</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                            <div>
                              <p className="text-slate-400 text-sm">Reported User:</p>
                              <p className="font-medium text-white">{report.reportedUser}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-sm">Reported By:</p>
                              <p className="font-medium text-white">{report.reportedBy}</p>
                            </div>
                          </div>
                          <p className="text-slate-300 mb-4">{report.reason}</p>
                          <div className="flex space-x-2">
                            <Button 
                              variant="destructive"
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Suspend User
                            </Button>
                            <Button 
                              variant="secondary"
                              className="bg-slate-600 hover:bg-slate-700"
                            >
                              Dismiss Report
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Payouts Tab */}
                <TabsContent value="payouts" className="space-y-4">
                  <h3 className="text-lg font-bold text-white">Pending Payouts</h3>
                  {pendingPayouts.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-slate-400">No pending payouts</div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingPayouts.map((payout: any) => (
                        <div key={payout.id} className="p-4 bg-slate-700 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <img 
                                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=60&h=60" 
                                alt="Creator profile" 
                                className="w-12 h-12 rounded-full object-cover"
                              />
                              <div>
                                <h4 className="font-semibold text-white">Creator</h4>
                                <p className="text-slate-400 text-sm">{payout.creatorId}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-accent">₹{payout.amount}</p>
                              <p className="text-slate-400 text-sm">Requested recently</p>
                            </div>
                          </div>
                          <div className="flex space-x-2 mt-4">
                            <Button className="bg-accent hover:bg-accent/80">
                              Approve Payout
                            </Button>
                            <Button variant="secondary" className="bg-slate-600 hover:bg-slate-700">
                              Request More Info
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Token Purchases Tab */}
                <TabsContent value="token-purchases" className="space-y-4">
                  <h3 className="text-lg font-bold text-white">UPI Token Purchase Approvals</h3>
                  {pendingTokenPurchases.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-slate-400">No pending token purchases</div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingTokenPurchases.map((purchase: any) => (
                        <div key={purchase.id} className="p-4 bg-slate-700 rounded-lg">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <p className="text-slate-400 text-sm">User:</p>
                              <p className="font-medium text-white">{purchase.userId}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-sm">Amount:</p>
                              <p className="font-medium text-white">₹{purchase.amount} ({purchase.tokens} tokens)</p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-sm">UTR Number:</p>
                              <p className="font-medium font-mono text-white">{purchase.utrNumber}</p>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button 
                              onClick={() => approveTokenPurchaseMutation.mutate(purchase.id)}
                              disabled={approveTokenPurchaseMutation.isPending}
                              className="bg-accent hover:bg-accent/80"
                            >
                              <CheckCircle className="mr-1 h-4 w-4" />
                              {approveTokenPurchaseMutation.isPending ? 'Approving...' : 'Verify & Approve'}
                            </Button>
                            <Button 
                              variant="destructive"
                              className="bg-red-600 hover:bg-red-700"
                            >
                              <XCircle className="mr-1 h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </main>
      </div>
    </div>
  );
}
