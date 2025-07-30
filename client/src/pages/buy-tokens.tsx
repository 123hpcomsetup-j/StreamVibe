import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Navbar from "@/components/navbar";
import { 
  Coins, 
  CreditCard, 
  Check, 
  Clock, 
  X,
  ArrowLeft,
  Star,
  Zap,
  AlertCircle
} from "lucide-react";
import type { User } from "@shared/schema";

export default function BuyTokens() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const typedUser = user as User | undefined;

  const [purchaseData, setPurchaseData] = useState({
    requestedTokens: "",
    paidAmount: "",
    utrNumber: "",
    paymentNote: "",
  });

  // Fetch user wallet
  const { data: wallet } = useQuery({
    queryKey: ["/api/wallet"],
    enabled: isAuthenticated,
  });

  // Fetch UPI config
  const { data: upiConfig } = useQuery({
    queryKey: ["/api/upi-config"],
  });

  // Fetch user's token purchases
  const { data: purchases = [] } = useQuery({
    queryKey: ["/api/token-purchases"],
    enabled: isAuthenticated,
  });

  // Token purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: async (data: typeof purchaseData) => {
      return await apiRequest("POST", "/api/token-purchase", {
        requestedTokens: parseInt(data.requestedTokens),
        paidAmount: parseFloat(data.paidAmount),
        utrNumber: data.utrNumber,
        paymentNote: data.paymentNote,
      });
    },
    onSuccess: () => {
      setPurchaseData({
        requestedTokens: "",
        paidAmount: "",
        utrNumber: "",
        paymentNote: "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/token-purchases"] });
      toast({
        title: "Purchase Request Submitted!",
        description: "Your token purchase is pending admin approval",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handlePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!purchaseData.requestedTokens || !purchaseData.paidAmount || !purchaseData.utrNumber) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    purchaseMutation.mutate(purchaseData);
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-slate-800 border-slate-700 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Coins className="h-16 w-16 text-yellow-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-white mb-4">Login Required</h2>
            <p className="text-slate-400 mb-6">Please sign in to purchase tokens</p>
            <Button 
              onClick={() => setLocation('/login')}
              className="bg-primary hover:bg-primary/80 w-full"
            >
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navbar user={typedUser!} />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation(-1 as any)}
            className="text-slate-400 hover:text-white mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Buy Tokens</h1>
            <p className="text-slate-400">Purchase tokens to support your favorite creators</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Purchase Form */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <CreditCard className="mr-2 h-5 w-5 text-blue-500" />
                  Purchase Tokens
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Balance */}
                <div className="bg-slate-900 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Current Balance:</span>
                    <Badge className="bg-yellow-600 text-white">
                      <Coins className="mr-1 h-4 w-4" />
                      {wallet?.tokenBalance || 0} tokens
                    </Badge>
                  </div>
                </div>

                {/* UPI Information */}
                {upiConfig ? (
                  <div className="bg-blue-900/20 border border-blue-500/50 p-4 rounded-lg">
                    <h3 className="text-blue-300 font-medium mb-3 flex items-center">
                      <AlertCircle className="mr-2 h-4 w-4" />
                      Payment Instructions
                    </h3>
                    <div className="space-y-2 text-sm text-blue-200">
                      <p><strong>UPI ID:</strong> {upiConfig.upiId}</p>
                      <p>1. Pay the amount via UPI to the above ID</p>
                      <p>2. Note down the UTR number from your transaction</p>
                      <p>3. Fill the form below with payment details</p>
                      <p>4. Admin will approve your request and add tokens</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-lg">
                    <p className="text-red-300">UPI payment not configured. Please contact admin.</p>
                  </div>
                )}

                {/* Purchase Form */}
                <form onSubmit={handlePurchase} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">Tokens to Purchase *</Label>
                      <Input
                        type="number"
                        value={purchaseData.requestedTokens}
                        onChange={(e) => setPurchaseData({ ...purchaseData, requestedTokens: e.target.value })}
                        placeholder="e.g., 100"
                        className="bg-slate-700 border-slate-600 text-white"
                        min="1"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label className="text-slate-300">Amount Paid (₹) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={purchaseData.paidAmount}
                        onChange={(e) => setPurchaseData({ ...purchaseData, paidAmount: e.target.value })}
                        placeholder="e.g., 100.00"
                        className="bg-slate-700 border-slate-600 text-white"
                        min="0.01"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-300">UTR Number *</Label>
                    <Input
                      type="text"
                      value={purchaseData.utrNumber}
                      onChange={(e) => setPurchaseData({ ...purchaseData, utrNumber: e.target.value })}
                      placeholder="Enter 12-digit UTR number"
                      className="bg-slate-700 border-slate-600 text-white"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-slate-300">Payment Note (Optional)</Label>
                    <Textarea
                      value={purchaseData.paymentNote}
                      onChange={(e) => setPurchaseData({ ...purchaseData, paymentNote: e.target.value })}
                      placeholder="Any additional notes about your payment..."
                      className="bg-slate-700 border-slate-600 text-white"
                      rows={3}
                    />
                  </div>

                  <Button 
                    type="submit"
                    disabled={purchaseMutation.isPending || !upiConfig}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {purchaseMutation.isPending ? (
                      "Submitting Request..."
                    ) : (
                      <>
                        <Star className="mr-2 h-4 w-4" />
                        Submit Purchase Request
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Token Packages */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Suggested Packages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { tokens: 50, price: 50, popular: false },
                  { tokens: 100, price: 100, popular: true },
                  { tokens: 250, price: 240, popular: false },
                  { tokens: 500, price: 475, popular: false },
                ].map((pkg) => (
                  <div
                    key={pkg.tokens}
                    className={`p-3 rounded-lg border cursor-pointer hover:bg-slate-700 transition-colors ${
                      pkg.popular ? 'border-purple-500 bg-purple-900/20' : 'border-slate-600'
                    }`}
                    onClick={() => {
                      setPurchaseData({
                        ...purchaseData,
                        requestedTokens: pkg.tokens.toString(),
                        paidAmount: pkg.price.toString(),
                      });
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center">
                          <Coins className="mr-2 h-4 w-4 text-yellow-500" />
                          <span className="text-white font-medium">{pkg.tokens} tokens</span>
                          {pkg.popular && (
                            <Badge className="ml-2 bg-purple-600 text-white text-xs">
                              Popular
                            </Badge>
                          )}
                        </div>
                        <p className="text-slate-400 text-sm">₹{pkg.price}</p>
                      </div>
                      <Zap className="h-4 w-4 text-purple-400" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent Purchases */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Recent Purchases</CardTitle>
              </CardHeader>
              <CardContent>
                {purchases.length > 0 ? (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {purchases.slice(0, 5).map((purchase: any) => (
                      <div key={purchase.id} className="p-3 bg-slate-900 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            {getStatusIcon(purchase.status)}
                            <span className="ml-2 text-white text-sm font-medium">
                              {purchase.requestedTokens} tokens
                            </span>
                          </div>
                          <Badge className={getStatusColor(purchase.status)}>
                            {purchase.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-400">
                          <p>Amount: ₹{purchase.paidAmount}</p>
                          <p>UTR: {purchase.utrNumber}</p>
                          <p>{new Date(purchase.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm text-center py-4">
                    No purchases yet
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}