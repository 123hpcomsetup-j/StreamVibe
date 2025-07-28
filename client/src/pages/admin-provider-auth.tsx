import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Clock, DollarSign, Video, Users, Eye, Ban, IndianRupee } from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import type { User } from "@shared/schema";

export default function AdminProviderAuth() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const typedUser = user as User | undefined;
  const { toast } = useToast();

  // Get live streams for authorization monitoring
  const { data: liveStreams = [], isLoading: streamsLoading } = useQuery({
    queryKey: ["/api/streams/live"],
    retry: false,
  });

  // Get pending token purchases
  const { data: pendingTokenPurchases = [], isLoading: purchasesLoading } = useQuery({
    queryKey: ["/api/admin/pending-token-purchases"],
    retry: false,
  });

  // Get payout requests
  const { data: pendingPayouts = [], isLoading: payoutsLoading } = useQuery({
    queryKey: ["/api/admin/pending-payouts"],
    retry: false,
  });

  // Stream authorization actions
  const authorizeStreamMutation = useMutation({
    mutationFn: async (data: { streamId: string; action: 'monitor' | 'suspend' }) => {
      await apiRequest("POST", `/api/admin/authorize-stream`, data);
    },
    onSuccess: () => {
      toast({ 
        title: "Stream Action Completed",
        description: "Stream authorization status updated."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/streams/live"] });
    },
  });

  // Payment authorization
  const authorizePaymentMutation = useMutation({
    mutationFn: async (data: { paymentId: string; type: string; action: 'approve' | 'reject' }) => {
      const endpoint = data.type === 'token_purchase' 
        ? '/api/admin/approve-token-purchase'
        : '/api/admin/approve-payout';
      await apiRequest("POST", endpoint, { id: data.paymentId, approved: data.action === 'approve' });
    },
    onSuccess: () => {
      toast({
        title: "Payment Authorization Updated",
        description: "Payment status has been updated."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-token-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payouts"] });
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
            <h2 className="text-3xl font-bold mb-2">Provider Authorization Center</h2>
            <p className="text-slate-400">Monitor and authorize creator streams and payment flows</p>
          </div>

          <Tabs defaultValue="streams" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-800">
              <TabsTrigger value="streams" className="data-[state=active]:bg-primary">
                Live Stream Monitoring
              </TabsTrigger>
              <TabsTrigger value="token-purchases" className="data-[state=active]:bg-primary">
                Token Purchase Approvals
                {pendingTokenPurchases.length > 0 && (
                  <Badge className="ml-2 bg-red-500 text-white text-xs">{pendingTokenPurchases.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="payouts" className="data-[state=active]:bg-primary">
                Creator Payouts
                {pendingPayouts.length > 0 && (
                  <Badge className="ml-2 bg-blue-600 text-white text-xs">{pendingPayouts.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Live Stream Monitoring */}
            <TabsContent value="streams" className="space-y-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <Video className="mr-2 h-5 w-5 text-red-500" />
                    Live Provider Stream Monitoring
                  </CardTitle>
                  <p className="text-slate-400">Real-time oversight of active creator streams</p>
                </CardHeader>
                <CardContent>
                  {streamsLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                      <p className="text-slate-400 mt-2">Loading live streams...</p>
                    </div>
                  ) : liveStreams.length === 0 ? (
                    <div className="text-center py-8">
                      <Video className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-400">No live streams currently active</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Creator</TableHead>
                          <TableHead>Stream Title</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Viewers</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Revenue</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {liveStreams.map((stream: any) => (
                          <TableRow key={stream.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center space-x-2">
                                <img 
                                  src={stream.creatorImage || "https://images.unsplash.com/photo-1494790108755-2616b332c3b0?w=32"} 
                                  alt="Creator" 
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                                <span>{stream.creatorName || 'Creator'}</span>
                              </div>
                            </TableCell>
                            <TableCell>{stream.title}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{stream.category}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center text-blue-400">
                                <Users className="h-4 w-4 mr-1" />
                                {stream.viewerCount || 0}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <Badge className="bg-red-500">
                                  <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
                                  LIVE
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center text-green-400">
                                <IndianRupee className="h-4 w-4 mr-1" />
                                {stream.totalRevenue || 0}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(`/streams/${stream.id}`, '_blank')}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Monitor
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => authorizeStreamMutation.mutate({ streamId: stream.id, action: 'suspend' })}
                                  disabled={authorizeStreamMutation.isPending}
                                >
                                  <Ban className="h-3 w-3 mr-1" />
                                  Suspend
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Token Purchase Approvals */}
            <TabsContent value="token-purchases" className="space-y-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <DollarSign className="mr-2 h-5 w-5 text-yellow-500" />
                    Token Purchase Authorization
                  </CardTitle>
                  <p className="text-slate-400">Review and approve UPI token purchases</p>
                </CardHeader>
                <CardContent>
                  {purchasesLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                      <p className="text-slate-400 mt-2">Loading pending purchases...</p>
                    </div>
                  ) : pendingTokenPurchases.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                      <p className="text-slate-400">No pending token purchases to review</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>UPI Transaction</TableHead>
                          <TableHead>Amount Paid</TableHead>
                          <TableHead>Tokens Requested</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingTokenPurchases.map((purchase: any) => (
                          <TableRow key={purchase.id}>
                            <TableCell className="font-medium">{purchase.userName}</TableCell>
                            <TableCell>
                              <Badge className="bg-blue-600">UPI ID: {purchase.upiId}</Badge>
                            </TableCell>
                            <TableCell className="text-green-400">₹{purchase.amountPaid}</TableCell>
                            <TableCell>{purchase.tokensRequested} tokens</TableCell>
                            <TableCell>{new Date(purchase.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => authorizePaymentMutation.mutate({ 
                                    paymentId: purchase.id, 
                                    type: 'token_purchase',
                                    action: 'approve' 
                                  })}
                                  disabled={authorizePaymentMutation.isPending}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => authorizePaymentMutation.mutate({ 
                                    paymentId: purchase.id, 
                                    type: 'token_purchase',
                                    action: 'reject' 
                                  })}
                                  disabled={authorizePaymentMutation.isPending}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Creator Payouts */}
            <TabsContent value="payouts" className="space-y-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <IndianRupee className="mr-2 h-5 w-5 text-green-500" />
                    Creator Payout Authorization
                  </CardTitle>
                  <p className="text-slate-400">Review and approve creator earning payouts</p>
                </CardHeader>
                <CardContent>
                  {payoutsLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                      <p className="text-slate-400 mt-2">Loading payout requests...</p>
                    </div>
                  ) : pendingPayouts.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                      <p className="text-slate-400">No pending payout requests</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Creator</TableHead>
                          <TableHead>Earnings Period</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Bank Details</TableHead>
                          <TableHead>Requested Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingPayouts.map((payout: any) => (
                          <TableRow key={payout.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center space-x-2">
                                <img 
                                  src={payout.creatorImage || "https://images.unsplash.com/photo-1494790108755-2616b332c3b0?w=32"} 
                                  alt="Creator" 
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                                <span>{payout.creatorName}</span>
                              </div>
                            </TableCell>
                            <TableCell>{payout.earningsPeriod}</TableCell>
                            <TableCell className="text-green-400 font-semibold">₹{payout.amount}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>Account: {payout.bankAccount}</div>
                                <div className="text-slate-400">IFSC: {payout.ifscCode}</div>
                              </div>
                            </TableCell>
                            <TableCell>{new Date(payout.requestedAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => authorizePaymentMutation.mutate({ 
                                    paymentId: payout.id, 
                                    type: 'payout',
                                    action: 'approve' 
                                  })}
                                  disabled={authorizePaymentMutation.isPending}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => authorizePaymentMutation.mutate({ 
                                    paymentId: payout.id, 
                                    type: 'payout',
                                    action: 'reject' 
                                  })}
                                  disabled={authorizePaymentMutation.isPending}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}