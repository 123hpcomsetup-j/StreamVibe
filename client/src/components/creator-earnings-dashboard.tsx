import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Coins, CreditCard, Clock, Check, X, TrendingUp, Wallet, Download } from "lucide-react";

interface CreatorEarnings {
  totalEarnings: number;
  availableBalance: number;
  pendingWithdrawals: number;
  payouts: Array<{
    id: string;
    amount: number;
    status: string;
    upiId: string;
    adminNote?: string;
    createdAt: string;
    processedAt?: string;
  }>;
}

export default function CreatorEarningsDashboard() {
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: earnings, isLoading } = useQuery<CreatorEarnings>({
    queryKey: ['/api/creator/earnings'],
  });

  const withdrawMutation = useMutation({
    mutationFn: async (data: { amount: number; upiId: string }) => {
      return await apiRequest('/api/creator/payout', 'POST', data);
    },
    onSuccess: () => {
      toast({
        title: "Withdrawal Request Submitted",
        description: "Your withdrawal request has been submitted for admin approval.",
      });
      setShowWithdrawDialog(false);
      setWithdrawAmount("");
      setUpiId("");
      queryClient.invalidateQueries({ queryKey: ['/api/creator/earnings'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleWithdraw = () => {
    const amount = parseInt(withdrawAmount);
    if (!amount || amount < 1000) {
      toast({
        title: "Invalid Amount",
        description: "Minimum withdrawal amount is 1000 tokens.",
        variant: "destructive",
      });
      return;
    }
    
    if (!upiId.trim()) {
      toast({
        title: "UPI ID Required",
        description: "Please enter your UPI ID for payment.",
        variant: "destructive",
      });
      return;
    }

    if (earnings && amount > earnings.availableBalance) {
      toast({
        title: "Insufficient Balance",
        description: `Available balance: ${earnings.availableBalance} tokens`,
        variant: "destructive",
      });
      return;
    }

    withdrawMutation.mutate({ amount, upiId: upiId.trim() });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'approved': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      case 'paid': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'approved': return <Check className="h-4 w-4" />;
      case 'rejected': return <X className="h-4 w-4" />;
      case 'paid': return <CreditCard className="h-4 w-4" />;
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Creator Earnings</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your earnings and withdrawals</p>
        </div>
        <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
          <DialogTrigger asChild>
            <Button 
              disabled={!earnings || earnings.availableBalance < 1000}
              className="bg-green-600 hover:bg-green-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Request Withdrawal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Withdrawal</DialogTitle>
              <DialogDescription>
                Minimum withdrawal amount is 1000 tokens. Enter your UPI ID for payment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="amount">Amount (tokens)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="1000"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  min="1000"
                />
              </div>
              <div>
                <Label htmlFor="upiId">UPI ID</Label>
                <Input
                  id="upiId"
                  placeholder="yourname@paytm"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleWithdraw} 
                  disabled={withdrawMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {withdrawMutation.isPending ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Earnings Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {earnings?.totalEarnings || 0} tokens
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Lifetime earnings from tips and activities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {earnings?.availableBalance || 0} tokens
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Ready for withdrawal (min 1000)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
            <Coins className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {earnings?.pendingWithdrawals || 0} tokens
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Awaiting admin approval
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal History */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal History</CardTitle>
          <CardDescription>Track your withdrawal requests and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {!earnings?.payouts?.length ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No withdrawal requests yet</p>
              <p className="text-sm">Submit your first withdrawal request above</p>
            </div>
          ) : (
            <div className="space-y-4">
              {earnings.payouts.map((payout) => (
                <div key={payout.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${getStatusColor(payout.status)}`}>
                      {getStatusIcon(payout.status)}
                    </div>
                    <div>
                      <p className="font-medium">{payout.amount} tokens</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {payout.upiId}
                      </p>
                      <p className="text-xs text-gray-500">
                        Requested: {new Date(payout.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={`${getStatusColor(payout.status)} text-white border-none`}>
                      {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                    </Badge>
                    {payout.processedAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Processed: {new Date(payout.processedAt).toLocaleDateString()}
                      </p>
                    )}
                    {payout.adminNote && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-48">
                        Note: {payout.adminNote}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}