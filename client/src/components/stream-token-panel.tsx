import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Coins, 
  Heart, 
  Zap,
  Gift,
  Star,
  Sparkles
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

interface StreamTokenPanelProps {
  streamId: string;
  creatorName: string;
  isVisible: boolean;
  onToggle: () => void;
}

export default function StreamTokenPanel({ 
  streamId, 
  creatorName, 
  isVisible, 
  onToggle 
}: StreamTokenPanelProps) {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const typedUser = user as any;
  
  const [customTipAmount, setCustomTipAmount] = useState("");
  const [tipMessage, setTipMessage] = useState("");
  const [isTipDialogOpen, setIsTipDialogOpen] = useState(false);

  // Fetch user wallet
  const { data: wallet } = useQuery({
    queryKey: ["/api/wallet"],
    enabled: isAuthenticated,
  });

  // Fetch creator activities
  const { data: activities = [] } = useQuery({
    queryKey: ["/api/streams", streamId, "activities"],
  });

  // Send tip mutation
  const tipMutation = useMutation({
    mutationFn: async ({ amount, message }: { amount: number; message?: string }) => {
      return await apiRequest("POST", "/api/transactions/tip", {
        streamId,
        amount,
        message,
      });
    },
    onSuccess: () => {
      setCustomTipAmount("");
      setTipMessage("");
      setIsTipDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      toast({
        title: "Tip Sent!",
        description: `Successfully tipped ${creatorName}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Tip Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Use activity mutation
  const activityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      return await apiRequest("POST", "/api/transactions/activity", {
        streamId,
        activityId,
      });
    },
    onSuccess: (data, activityId) => {
      const activity = activities.find((a: any) => a.id === activityId);
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      toast({
        title: "Activity Used!",
        description: `"${activity?.name}" for ${activity?.tokenCost} tokens`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Activity Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleCustomTip = () => {
    const amount = parseInt(customTipAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid tip amount",
        variant: "destructive",
      });
      return;
    }

    if (!wallet || wallet.tokenBalance < amount) {
      toast({
        title: "Insufficient Tokens",
        description: "You don't have enough tokens for this tip",
        variant: "destructive",
      });
      return;
    }

    tipMutation.mutate({ amount, message: tipMessage });
  };

  const handleQuickTip = (amount: number) => {
    if (!wallet || wallet.tokenBalance < amount) {
      toast({
        title: "Insufficient Tokens",
        description: "You don't have enough tokens for this tip",
        variant: "destructive",
      });
      return;
    }

    tipMutation.mutate({ amount });
  };

  const handleActivity = (activityId: string) => {
    const activity = activities.find((a: any) => a.id === activityId);
    if (!activity) return;

    if (!wallet || wallet.tokenBalance < activity.tokenCost) {
      toast({
        title: "Insufficient Tokens",
        description: `You need ${activity.tokenCost} tokens for this activity`,
        variant: "destructive",
      });
      return;
    }

    activityMutation.mutate(activityId);
  };

  if (!isVisible) return null;

  if (!isAuthenticated) {
    return (
      <Card className="bg-slate-900 border-slate-700 h-full flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium text-white flex items-center">
            <Coins className="mr-2 h-4 w-4 text-yellow-500" />
            Support {creatorName}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <Gift className="h-12 w-12 text-slate-500 mb-4" />
          <h3 className="text-white font-medium mb-2">Login to Support</h3>
          <p className="text-slate-400 text-sm mb-4">
            Sign in to tip and use activities
          </p>
          <Button 
            onClick={() => window.location.href = '/login'}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Login to Continue
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900 border-slate-700 h-full flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-medium text-white flex items-center justify-between">
          <div className="flex items-center">
            <Coins className="mr-2 h-4 w-4 text-yellow-500" />
            Support {creatorName}
          </div>
          <Badge variant="secondary" className="text-yellow-400 bg-yellow-400/10">
            <Coins className="mr-1 h-3 w-3" />
            {wallet?.tokenBalance || 0}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col space-y-4 p-4">
        {/* Quick Tip Buttons */}
        <div className="space-y-2">
          <h4 className="text-white text-sm font-medium">Quick Tips</h4>
          <div className="grid grid-cols-2 gap-2">
            {[5, 10, 25, 50].map((amount) => (
              <Button
                key={amount}
                variant="outline"
                size="sm"
                onClick={() => handleQuickTip(amount)}
                disabled={tipMutation.isPending || !wallet || wallet.tokenBalance < amount}
                className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
              >
                <Heart className="mr-1 h-3 w-3 text-red-400" />
                {amount}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Tip */}
        <div className="space-y-2">
          <h4 className="text-white text-sm font-medium">Custom Tip</h4>
          <Dialog open={isTipDialogOpen} onOpenChange={setIsTipDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="w-full bg-purple-900/30 border-purple-500 text-purple-300 hover:bg-purple-800/50"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Custom Amount
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Send Custom Tip</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-300">Amount (Tokens)</Label>
                  <Input
                    type="number"
                    value={customTipAmount}
                    onChange={(e) => setCustomTipAmount(e.target.value)}
                    placeholder="Enter amount..."
                    className="bg-slate-800 border-slate-600 text-white"
                    min="1"
                  />
                </div>
                
                <div>
                  <Label className="text-slate-300">Message (Optional)</Label>
                  <Textarea
                    value={tipMessage}
                    onChange={(e) => setTipMessage(e.target.value)}
                    placeholder="Add a message with your tip..."
                    className="bg-slate-800 border-slate-600 text-white"
                    rows={3}
                  />
                </div>
                
                <div className="text-sm text-slate-400">
                  <div className="flex items-center justify-between">
                    <span>Your Balance:</span>
                    <Badge className="bg-yellow-600 text-white">
                      <Coins className="mr-1 h-3 w-3" />
                      {wallet?.tokenBalance || 0}
                    </Badge>
                  </div>
                </div>
                
                <Button 
                  onClick={handleCustomTip}
                  disabled={tipMutation.isPending || !customTipAmount}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {tipMutation.isPending ? (
                    "Sending Tip..."
                  ) : (
                    <>
                      <Heart className="mr-2 h-4 w-4" />
                      Send Tip
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Creator Activities */}
        {activities.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-white text-sm font-medium">Activities</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activities.map((activity: any) => (
                <Button
                  key={activity.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleActivity(activity.id)}
                  disabled={activityMutation.isPending || !wallet || wallet.tokenBalance < activity.tokenCost}
                  className="w-full bg-slate-800 border-slate-600 text-white hover:bg-slate-700 flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <Zap className="mr-2 h-3 w-3 text-blue-400" />
                    <span className="truncate">{activity.name}</span>
                  </div>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {activity.tokenCost}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Buy Tokens Link */}
        <div className="mt-auto pt-4 border-t border-slate-700">
          <Button 
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/buy-tokens'}
            className="w-full text-yellow-400 hover:text-yellow-300 hover:bg-slate-800"
          >
            <Star className="mr-2 h-4 w-4" />
            Buy More Tokens
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}