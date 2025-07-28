import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Clock, DollarSign, Video, Users, Eye, Ban } from "lucide-react";

export default function ProviderStreamMonitor() {
  const { toast } = useToast();

  // Get all streams for monitoring
  const { data: allStreams = [], isLoading: streamsLoading } = useQuery({
    queryKey: ["/api/streams/all"],
    retry: false,
  });

  // Get pending creator approvals
  const { data: pendingCreators = [], isLoading: creatorsLoading } = useQuery({
    queryKey: ["/api/admin/pending-creators"],
    retry: false,
  });

  // Get payment flows that need authorization
  const { data: pendingPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/admin/pending-payments"],
    retry: false,
  });

  // Stream authorization mutation
  const authorizeStreamMutation = useMutation({
    mutationFn: async (data: { streamId: string; action: 'approve' | 'suspend' }) => {
      await apiRequest("POST", `/api/admin/authorize-stream`, data);
    },
    onSuccess: () => {
      toast({ title: "Stream Authorization Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/streams/all"] });
    },
  });

  // Payment authorization mutation
  const authorizePaymentMutation = useMutation({
    mutationFn: async (data: { paymentId: string; action: 'approve' | 'reject' }) => {
      await apiRequest("POST", `/api/admin/authorize-payment`, data);
    },
    onSuccess: () => {
      toast({ title: "Payment Authorization Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payments"] });
    },
  });

  // Creator approval mutation
  const approveCreatorMutation = useMutation({
    mutationFn: async (data: { userId: string; action: 'approve' | 'reject' }) => {
      await apiRequest("POST", `/api/admin/approve-creator`, data);
    },
    onSuccess: () => {
      toast({ title: "Creator Status Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-creators"] });
    },
  });

  const getStreamStatusBadge = (stream: any) => {
    if (stream.isLive) {
      return <Badge className="bg-red-500">LIVE</Badge>;
    }
    if (stream.isAuthorized === false) {
      return <Badge variant="destructive">SUSPENDED</Badge>;
    }
    return <Badge variant="secondary">OFFLINE</Badge>;
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />PENDING</Badge>;
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />APPROVED</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />REJECTED</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="streams" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="streams">Stream Authorization</TabsTrigger>
          <TabsTrigger value="payments">Payment Flows</TabsTrigger>
          <TabsTrigger value="creators">Creator Approvals</TabsTrigger>
        </TabsList>

        {/* Stream Authorization Tab */}
        <TabsContent value="streams" className="space-y-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Video className="mr-2 h-5 w-5" />
                Provider Stream Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent>
              {streamsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                  <p className="text-slate-400 mt-2">Loading streams...</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Stream Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Viewers</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allStreams.map((stream: any) => (
                      <TableRow key={stream.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-2">
                            <img 
                              src={stream.creatorImage || "https://images.unsplash.com/photo-1494790108755-2616b332c3b0?w=32"} 
                              alt="Creator" 
                              className="w-8 h-8 rounded-full object-cover"
                            />
                            <span>{stream.creatorName}</span>
                          </div>
                        </TableCell>
                        <TableCell>{stream.title}</TableCell>
                        <TableCell>{stream.category}</TableCell>
                        <TableCell>{getStreamStatusBadge(stream)}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            {stream.viewerCount || 0}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-green-400">
                            <DollarSign className="h-4 w-4 mr-1" />
                            {stream.totalRevenue || 0}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => authorizeStreamMutation.mutate({ streamId: stream.id, action: 'approve' })}
                              disabled={authorizeStreamMutation.isPending}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Monitor
                            </Button>
                            {stream.isLive && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => authorizeStreamMutation.mutate({ streamId: stream.id, action: 'suspend' })}
                                disabled={authorizeStreamMutation.isPending}
                              >
                                <Ban className="h-3 w-3 mr-1" />
                                Suspend
                              </Button>
                            )}
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

        {/* Payment Authorization Tab */}
        <TabsContent value="payments" className="space-y-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <DollarSign className="mr-2 h-5 w-5" />
                Payment Flow Authorization
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                  <p className="text-slate-400 mt-2">Loading payments...</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Transaction Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingPayments.map((payment: any) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.providerName}</TableCell>
                        <TableCell>{payment.type}</TableCell>
                        <TableCell className="text-green-400">₹{payment.amount}</TableCell>
                        <TableCell>{getPaymentStatusBadge(payment.status)}</TableCell>
                        <TableCell>{new Date(payment.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {payment.status === 'pending' && (
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => authorizePaymentMutation.mutate({ paymentId: payment.id, action: 'approve' })}
                                disabled={authorizePaymentMutation.isPending}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => authorizePaymentMutation.mutate({ paymentId: payment.id, action: 'reject' })}
                                disabled={authorizePaymentMutation.isPending}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Creator Approval Tab */}
        <TabsContent value="creators" className="space-y-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Users className="mr-2 h-5 w-5" />
                Creator Provider Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {creatorsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                  <p className="text-slate-400 mt-2">Loading applications...</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Application Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingCreators.map((creator: any) => (
                      <TableRow key={creator.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-2">
                            <img 
                              src={creator.profileImageUrl || "https://images.unsplash.com/photo-1494790108755-2616b332c3b0?w=32"} 
                              alt="Creator" 
                              className="w-8 h-8 rounded-full object-cover"
                            />
                            <span>{creator.firstName} {creator.lastName}</span>
                          </div>
                        </TableCell>
                        <TableCell>{creator.email}</TableCell>
                        <TableCell>{new Date(creator.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {creator.isApproved ? (
                            <Badge className="bg-green-500">APPROVED</Badge>
                          ) : (
                            <Badge className="bg-yellow-500">PENDING</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!creator.isApproved && (
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => approveCreatorMutation.mutate({ userId: creator.id, action: 'approve' })}
                                disabled={approveCreatorMutation.isPending}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => approveCreatorMutation.mutate({ userId: creator.id, action: 'reject' })}
                                disabled={approveCreatorMutation.isPending}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
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
    </div>
  );
}