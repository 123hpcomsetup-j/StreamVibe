import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings, 
  CreditCard, 
  Check, 
  X, 
  Clock,
  Coins,
  AlertCircle,
  Edit,
  Save,
  Users
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface TokenPurchase {
  id: string;
  userId: string;
  username: string;
  requestedTokens: number;
  paidAmount: number;
  utrNumber: string;
  paymentNote?: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
  processedAt?: string;
  adminNote?: string;
}

interface UpiConfig {
  upiId: string;
  updatedAt: string;
}

export default function AdminTokenManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditingUpi, setIsEditingUpi] = useState(false);
  const [upiData, setUpiData] = useState({ upiId: "" });
  const [processingPurchase, setProcessingPurchase] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");

  // Fetch UPI config
  const { data: upiConfig } = useQuery<UpiConfig>({
    queryKey: ["/api/admin/upi-config"],
  });

  // Fetch token purchases
  const { data: purchases = [], isLoading } = useQuery<TokenPurchase[]>({
    queryKey: ["/api/admin/token-purchases"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Update UPI config mutation
  const updateUpiMutation = useMutation({
    mutationFn: async (data: { upiId: string }) => {
      return await apiRequest("POST", "/api/admin/upi-config", data);
    },
    onSuccess: () => {
      setIsEditingUpi(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/upi-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/upi-config"] });
      toast({
        title: "UPI ID Updated!",
        description: "The payment UPI ID has been successfully updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Process purchase mutation
  const processPurchaseMutation = useMutation({
    mutationFn: async ({ id, action, note }: { id: string; action: 'approve' | 'deny'; note?: string }) => {
      return await apiRequest("POST", `/api/admin/token-purchases/${id}/process`, {
        action,
        adminNote: note,
      });
    },
    onSuccess: (_, { action }) => {
      setProcessingPurchase(null);
      setAdminNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/token-purchases"] });
      toast({
        title: action === 'approve' ? "Purchase Approved!" : "Purchase Denied",
        description: action === 'approve' 
          ? "Tokens have been credited to the user's wallet" 
          : "Purchase request has been denied",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Process Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleUpiSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!upiData.upiId.trim()) {
      toast({
        title: "Invalid UPI ID",
        description: "Please enter a valid UPI ID",
        variant: "destructive",
      });
      return;
    }

    updateUpiMutation.mutate({ upiId: upiData.upiId.trim() });
  };

  const startEditUpi = () => {
    setIsEditingUpi(true);
    setUpiData({ upiId: upiConfig?.upiId || "" });
  };

  const handleProcessPurchase = (id: string, action: 'approve' | 'deny') => {
    processPurchaseMutation.mutate({ id, action, note: adminNote });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'denied':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-600';
      case 'denied':
        return 'bg-red-600';
      default:
        return 'bg-yellow-600';
    }
  };

  const pendingPurchases = purchases.filter(p => p.status === 'pending');
  const processedPurchases = purchases.filter(p => p.status !== 'pending');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-slate-400">Loading token management...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* UPI Configuration */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Settings className="mr-2 h-5 w-5 text-blue-500" />
            UPI Payment Configuration
          </CardTitle>
          <p className="text-slate-400 text-sm">
            Configure the UPI ID for token purchases
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditingUpi ? (
            <form onSubmit={handleUpiSave} className="space-y-4">
              <div>
                <Label className="text-slate-300">UPI ID</Label>
                <Input
                  value={upiData.upiId}
                  onChange={(e) => setUpiData({ upiId: e.target.value })}
                  placeholder="e.g., admin@paytm"
                  className="bg-slate-700 border-slate-600 text-white"
                  required
                />
              </div>
              
              <div className="flex space-x-3">
                <Button 
                  type="submit"
                  disabled={updateUpiMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {updateUpiMutation.isPending ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save UPI ID
                    </>
                  )}
                </Button>
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditingUpi(false)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300">
                  Current UPI ID: <span className="text-white font-mono">{upiConfig?.upiId || 'Not configured'}</span>
                </p>
                {upiConfig?.updatedAt && (
                  <p className="text-slate-500 text-sm">
                    Last updated: {new Date(upiConfig.updatedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <Button 
                onClick={startEditUpi}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit UPI ID
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Purchases */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="mr-2 h-5 w-5 text-yellow-500" />
              Pending Token Purchases
            </div>
            <Badge className="bg-yellow-600 text-white">
              {pendingPurchases.length} pending
            </Badge>
          </CardTitle>
          <p className="text-slate-400 text-sm">
            Review and approve/deny token purchase requests
          </p>
        </CardHeader>
        <CardContent>
          {pendingPurchases.length > 0 ? (
            <div className="space-y-4">
              {pendingPurchases.map((purchase) => (
                <div key={purchase.id} className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Purchase Details */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-blue-400" />
                        <span className="text-white font-medium">{purchase.username}</span>
                      </div>
                      
                      <div className="text-sm text-slate-300">
                        <p><strong>Tokens Requested:</strong> {purchase.requestedTokens}</p>
                        <p><strong>Amount Paid:</strong> ₹{purchase.paidAmount}</p>
                        <p><strong>UTR Number:</strong> {purchase.utrNumber}</p>
                        <p><strong>Requested:</strong> {new Date(purchase.createdAt).toLocaleString()}</p>
                      </div>
                      
                      {purchase.paymentNote && (
                        <div className="bg-slate-800 p-2 rounded text-sm">
                          <p className="text-slate-400">Payment Note:</p>
                          <p className="text-slate-300">"{purchase.paymentNote}"</p>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                      {processingPurchase === purchase.id ? (
                        <div className="space-y-3">
                          <Textarea
                            value={adminNote}
                            onChange={(e) => setAdminNote(e.target.value)}
                            placeholder="Optional admin note..."
                            className="bg-slate-800 border-slate-600 text-white text-sm"
                            rows={2}
                          />
                          
                          <div className="flex space-x-2">
                            <Button
                              onClick={() => handleProcessPurchase(purchase.id, 'approve')}
                              disabled={processPurchaseMutation.isPending}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 flex-1"
                            >
                              <Check className="mr-1 h-3 w-3" />
                              Approve
                            </Button>
                            <Button
                              onClick={() => handleProcessPurchase(purchase.id, 'deny')}
                              disabled={processPurchaseMutation.isPending}
                              size="sm"
                              className="bg-red-600 hover:bg-red-700 flex-1"
                            >
                              <X className="mr-1 h-3 w-3" />
                              Deny
                            </Button>
                            <Button
                              onClick={() => setProcessingPurchase(null)}
                              variant="outline"
                              size="sm"
                              className="border-slate-600 text-slate-300"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          onClick={() => setProcessingPurchase(purchase.id)}
                          className="w-full bg-purple-600 hover:bg-purple-700"
                        >
                          <CreditCard className="mr-2 h-4 w-4" />
                          Process Purchase
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-slate-400 mb-2">No pending purchases</p>
              <p className="text-slate-500 text-sm">All token purchase requests have been processed</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Processed Purchases */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Coins className="mr-2 h-5 w-5 text-green-500" />
            Recent Processed Purchases
          </CardTitle>
        </CardHeader>
        <CardContent>
          {processedPurchases.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {processedPurchases.slice(0, 10).map((purchase) => (
                <div key={purchase.id} className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(purchase.status)}
                      <div>
                        <p className="text-white font-medium">{purchase.username}</p>
                        <p className="text-slate-400 text-sm">
                          {purchase.requestedTokens} tokens • ₹{purchase.paidAmount} • {purchase.utrNumber}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <Badge className={getStatusColor(purchase.status)}>
                        {purchase.status}
                      </Badge>
                      <p className="text-slate-500 text-xs mt-1">
                        {purchase.processedAt ? new Date(purchase.processedAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                  
                  {purchase.adminNote && (
                    <div className="mt-2 bg-slate-800 p-2 rounded text-sm">
                      <p className="text-slate-400">Admin Note:</p>
                      <p className="text-slate-300">"{purchase.adminNote}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400 mb-2">No processed purchases yet</p>
              <p className="text-slate-500 text-sm">Processed token purchases will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}