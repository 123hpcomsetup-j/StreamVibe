import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Phone, 
  Check, 
  X, 
  Clock, 
  User,
  MessageCircle,
  Coins,
  Video,
  PlayCircle,
  StopCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { PrivateCallRequest } from "@shared/schema";

export default function PrivateCallRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch private call requests
  const { data: requests = [], isLoading } = useQuery<PrivateCallRequest[]>({
    queryKey: ['/api/creator/private-call-requests'],
    refetchInterval: 5000, // Poll every 5 seconds for new requests
  });

  // Accept/reject mutation
  const manageRequestMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'accept' | 'reject' }) => {
      const response = await apiRequest("PATCH", `/api/private-call-requests/${requestId}/${action}`, {});
      return await response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/creator/private-call-requests'] });
      toast({
        title: variables.action === 'accept' ? "Request Accepted!" : "Request Rejected",
        description: variables.action === 'accept' ? 
          "The private call has been approved. You can now start the call." :
          "The request has been declined.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Start call mutation
  const startCallMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await apiRequest("POST", `/api/private-call-requests/${requestId}/start`, {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/creator/private-call-requests'] });
      toast({
        title: "Private Call Started!",
        description: "The private call is now active. Both participants can join the private channel.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // End call mutation
  const endCallMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await apiRequest("POST", `/api/private-call-requests/${requestId}/end`, {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/creator/private-call-requests'] });
      toast({
        title: "Private Call Ended",
        description: "The private call has been completed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-600 text-white">Pending</Badge>;
      case 'accepted':
        return <Badge className="bg-green-600 text-white">Accepted</Badge>;
      case 'rejected':
        return <Badge className="bg-red-600 text-white">Rejected</Badge>;
      case 'active':
        return <Badge className="bg-blue-600 text-white animate-pulse">Active</Badge>;
      case 'completed':
        return <Badge className="bg-gray-600 text-white">Completed</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-500 text-white">Cancelled</Badge>;
      default:
        return <Badge className="bg-gray-600 text-white">{status}</Badge>;
    }
  };

  const formatDuration = (minutes: number | null | undefined) => {
    const mins = minutes || 10;
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remainingMinutes = mins % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  const formatTimeAgo = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 24 * 60) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / (24 * 60))}d ago`;
  };

  const pendingRequests = requests.filter((req) => req.status === 'pending');
  const activeRequests = requests.filter((req) => req.status === 'active');
  const acceptedRequests = requests.filter((req) => req.status === 'accepted');

  if (isLoading) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
            <span className="ml-2 text-slate-400">Loading requests...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active Calls */}
      {activeRequests.length > 0 && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Video className="mr-2 h-5 w-5 text-blue-500" />
              Active Private Calls ({activeRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeRequests.map((request) => (
                <div key={request.id} className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{request.requesterName}</p>
                        <div className="flex items-center space-x-2 text-sm text-slate-400">
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(request.durationMinutes)}</span>
                          <Coins className="h-3 w-3 ml-2" />
                          <span>{request.tokenCost} tokens</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(request.status)}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => endCallMutation.mutate(request.id)}
                        disabled={endCallMutation.isPending}
                      >
                        <StopCircle className="h-4 w-4 mr-1" />
                        End Call
                      </Button>
                    </div>
                  </div>
                  {request.message && (
                    <div className="mt-3 p-2 bg-slate-700 rounded text-sm text-slate-300">
                      <MessageCircle className="h-3 w-3 inline mr-1" />
                      {request.message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Phone className="mr-2 h-5 w-5 text-yellow-500" />
              Pending Private Call Requests ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-96">
              <div className="space-y-3">
                {pendingRequests.map((request: PrivateCallRequest) => (
                  <div key={request.id} className="bg-slate-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{request.requesterName}</p>
                          <div className="flex items-center space-x-2 text-sm text-slate-400">
                            <Clock className="h-3 w-3" />
                            <span>{formatDuration(request.durationMinutes)}</span>
                            <Coins className="h-3 w-3 ml-2" />
                            <span>{request.tokenCost} tokens</span>
                            <span className="ml-2">• {formatTimeAgo(request.createdAt || new Date())}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-400 border-red-400 hover:bg-red-400 hover:text-white"
                          onClick={() => manageRequestMutation.mutate({ requestId: request.id, action: 'reject' })}
                          disabled={manageRequestMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => manageRequestMutation.mutate({ requestId: request.id, action: 'accept' })}
                          disabled={manageRequestMutation.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                      </div>
                    </div>
                    {request.message && (
                      <div className="mt-3 p-2 bg-slate-700 rounded text-sm text-slate-300">
                        <MessageCircle className="h-3 w-3 inline mr-1" />
                        {request.message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Accepted Requests (ready to start) */}
      {acceptedRequests.length > 0 && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <PlayCircle className="mr-2 h-5 w-5 text-green-500" />
              Ready to Start ({acceptedRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {acceptedRequests.map((request: PrivateCallRequest) => (
                <div key={request.id} className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{request.requesterName}</p>
                        <div className="flex items-center space-x-2 text-sm text-slate-400">
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(request.durationMinutes)}</span>
                          <Coins className="h-3 w-3 ml-2" />
                          <span>{request.tokenCost} tokens</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(request.status)}
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => startCallMutation.mutate(request.id)}
                        disabled={startCallMutation.isPending}
                      >
                        <PlayCircle className="h-4 w-4 mr-1" />
                        Start Call
                      </Button>
                    </div>
                  </div>
                  {request.message && (
                    <div className="mt-3 p-2 bg-slate-700 rounded text-sm text-slate-300">
                      <MessageCircle className="h-3 w-3 inline mr-1" />
                      {request.message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {requests.length === 0 && (
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-8 text-center">
            <div className="text-4xl mb-4">📞</div>
            <h3 className="text-lg font-medium text-white mb-2">No Private Call Requests</h3>
            <p className="text-slate-400">
              When viewers request private calls, they'll appear here for you to manage.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}