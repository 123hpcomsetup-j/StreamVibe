import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode, Copy, Check } from "lucide-react";

interface TokenPurchaseProps {
  onClose: () => void;
}

const tokenPackages = [
  { tokens: 100, price: 99, pricePerToken: 0.99 },
  { tokens: 500, price: 450, pricePerToken: 0.90, popular: true },
  { tokens: 1000, price: 850, pricePerToken: 0.85 },
];

export default function TokenPurchase({ onClose }: TokenPurchaseProps) {
  const { toast } = useToast();
  const [selectedPackage, setSelectedPackage] = useState(tokenPackages[1]);
  const [utrNumber, setUtrNumber] = useState("");
  const [copied, setCopied] = useState(false);

  const purchaseTokensMutation = useMutation({
    mutationFn: async (purchaseData: { amount: number; tokens: number; utrNumber: string }) => {
      await apiRequest("POST", "/api/token-purchases", purchaseData);
    },
    onSuccess: () => {
      toast({
        title: "Purchase Submitted",
        description: "Your token purchase has been submitted for approval. You'll receive tokens once approved by admin.",
      });
      onClose();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
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
        description: "Failed to submit purchase. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCopyUPI = async () => {
    try {
      await navigator.clipboard.writeText("streamvibe@paytm");
      setCopied(true);
      toast({
        title: "Copied!",
        description: "UPI ID copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy UPI ID",
        variant: "destructive",
      });
    }
  };

  const handleSubmitPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!utrNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter the UTR number",
        variant: "destructive",
      });
      return;
    }

    purchaseTokensMutation.mutate({
      amount: selectedPackage.price,
      tokens: selectedPackage.tokens,
      utrNumber: utrNumber.trim(),
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Buy Tokens</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Token Packages */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Select Package</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tokenPackages.map((pkg) => (
                <Card
                  key={pkg.tokens}
                  className={`cursor-pointer transition-all ${
                    selectedPackage.tokens === pkg.tokens
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-600 hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedPackage(pkg)}
                >
                  <CardContent className="p-4 text-center relative">
                    {pkg.popular && (
                      <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary text-white">
                        POPULAR
                      </Badge>
                    )}
                    <div className="text-2xl font-bold text-primary mb-2">{pkg.tokens}</div>
                    <div className="text-slate-400 mb-3">Tokens</div>
                    <div className="text-xl font-semibold text-white">₹{pkg.price}</div>
                    <div className="text-slate-400 text-sm">₹{pkg.pricePerToken} per token</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* UPI Payment Section */}
          <div className="bg-slate-700 rounded-lg p-6">
            <h4 className="font-semibold mb-4">Payment via UPI</h4>
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-white rounded-lg p-3">
                <QrCode className="h-12 w-12 text-slate-900" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-400 mb-2">UPI ID:</p>
                <div className="flex items-center space-x-2">
                  <p className="font-mono font-semibold text-white">streamvibe@paytm</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyUPI}
                    className="text-primary hover:text-primary/80"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-sm text-slate-400 mt-2">
                  Send ₹{selectedPackage.price} to the above UPI ID
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitPurchase} className="space-y-4">
              <div>
                <Label htmlFor="utr" className="text-white">UTR Number</Label>
                <Input
                  id="utr"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  placeholder="Enter 12-digit UTR number"
                  className="bg-slate-600 border-slate-500 text-white placeholder:text-slate-400"
                  maxLength={12}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Enter the UTR number from your payment confirmation
                </p>
              </div>
              
              <Button 
                type="submit"
                disabled={purchaseTokensMutation.isPending}
                className="w-full bg-primary hover:bg-primary/80"
              >
                {purchaseTokensMutation.isPending ? "Submitting..." : "Submit Payment Proof"}
              </Button>
            </form>
          </div>

          {/* Instructions */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <h5 className="font-semibold text-blue-400 mb-2">Payment Instructions</h5>
            <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
              <li>Send ₹{selectedPackage.price} to the UPI ID: streamvibe@paytm</li>
              <li>Copy the UTR number from your payment confirmation</li>
              <li>Enter the UTR number above and submit</li>
              <li>Your tokens will be added after admin approval (usually within 24 hours)</li>
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
