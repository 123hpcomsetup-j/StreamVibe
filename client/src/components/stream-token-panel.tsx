import { useState } from "react";
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
  Sparkles,
  LogIn,
  UserPlus
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
  
  const [customTipAmount, setCustomTipAmount] = useState("");
  const [tipMessage, setTipMessage] = useState("");
  const [isTipDialogOpen, setIsTipDialogOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // Login form state
  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
    isSignup: false,
    firstName: "",
    lastName: "",
    email: ""
  });

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
      const activity = (activities as any[]).find((a: any) => a.id === activityId);
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

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: any) => {
      const endpoint = loginForm.isSignup ? "/api/register" : "/api/login";
      return await apiRequest("POST", endpoint, credentials);
    },
    onSuccess: () => {
      setShowLoginModal(false);
      setLoginForm({
        username: "",
        password: "",
        isSignup: false,
        firstName: "",
        lastName: "",
        email: ""
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: loginForm.isSignup ? "Account Created!" : "Welcome Back!",
        description: loginForm.isSignup ? "Your account has been created successfully" : "You are now logged in",
      });
    },
    onError: (error: Error) => {
      toast({
        title: loginForm.isSignup ? "Signup Failed" : "Login Failed", 
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loginForm.isSignup) {
      // Signup validation
      if (!loginForm.username || !loginForm.password || !loginForm.firstName || !loginForm.lastName) {
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }
      
      loginMutation.mutate({
        username: loginForm.username,
        password: loginForm.password,
        firstName: loginForm.firstName,
        lastName: loginForm.lastName,
        email: loginForm.email,
        role: "viewer"
      });
    } else {
      // Login validation
      if (!loginForm.username || !loginForm.password) {
        toast({
          title: "Missing Information",
          description: "Please enter your username and password",
          variant: "destructive",
        });
        return;
      }
      
      loginMutation.mutate({
        username: loginForm.username,
        password: loginForm.password,
      });
    }
  };

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

    if (!wallet || (wallet as any).tokenBalance < amount) {
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
    if (!wallet || (wallet as any).tokenBalance < amount) {
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
    const activity = (activities as any[]).find((a: any) => a.id === activityId);
    if (!activity) return;

    if (!wallet || (wallet as any).tokenBalance < activity.tokenCost) {
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
      <>
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
              onClick={() => setShowLoginModal(true)}
              className="bg-purple-600 hover:bg-purple-700 w-full"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Login to Tip
            </Button>
          </CardContent>
        </Card>

        {/* Login Modal */}
        <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center">
                {loginForm.isSignup ? (
                  <>
                    <UserPlus className="mr-2 h-5 w-5 text-green-500" />
                    Create Account
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-5 w-5 text-blue-500" />
                    Login to StreamVibe
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleLogin} className="space-y-4">
              {loginForm.isSignup && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">First Name</Label>
                      <Input
                        value={loginForm.firstName}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, firstName: e.target.value }))}
                        className="bg-slate-800 border-slate-600 text-white"
                        placeholder="John"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Last Name</Label>
                      <Input
                        value={loginForm.lastName}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, lastName: e.target.value }))}
                        className="bg-slate-800 border-slate-600 text-white"
                        placeholder="Doe"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-300">Email (Optional)</Label>
                    <Input
                      type="email"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                      className="bg-slate-800 border-slate-600 text-white"
                      placeholder="john@example.com"
                    />
                  </div>
                </>
              )}

              <div>
                <Label className="text-slate-300">Username</Label>
                <Input
                  value={loginForm.username}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white"
                  placeholder="Enter username"
                  required
                />
              </div>

              <div>
                <Label className="text-slate-300">Password</Label>
                <Input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white"
                  placeholder="Enter password"
                  required
                />
              </div>

              <Button 
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {loginMutation.isPending ? (
                  "Please wait..."
                ) : loginForm.isSignup ? (
                  "Create Account"
                ) : (
                  "Login"
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setLoginForm(prev => ({ 
                    ...prev, 
                    isSignup: !prev.isSignup,
                    username: "",
                    password: "",
                    firstName: "",
                    lastName: "",
                    email: ""
                  }))}
                  className="text-purple-400 hover:text-purple-300 text-sm"
                >
                  {loginForm.isSignup ? "Already have an account? Login" : "Don't have an account? Sign up"}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </>
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
          <Badge className="bg-green-600 text-white">
            {(wallet as any)?.tokenBalance || 0} tokens
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {/* Quick Tip Buttons */}
        <div className="space-y-3">
          <h4 className="text-white text-sm font-medium">Quick Tips</h4>
          <div className="grid grid-cols-2 gap-2">
            {[5, 10, 25, 50].map((amount) => (
              <Button
                key={amount}
                onClick={() => handleQuickTip(amount)}
                disabled={tipMutation.isPending || !wallet || (wallet as any).tokenBalance < amount}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
              >
                <Heart className="mr-1 h-3 w-3" />
                {amount}
              </Button>
            ))}
          </div>
        </div>

        {/* Creator Activities */}
        {(activities as any[]).length > 0 && (
          <div className="space-y-3">
            <h4 className="text-white text-sm font-medium">Creator Activities</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {(activities as any[]).map((activity: any) => (
                <Button
                  key={activity.id}
                  onClick={() => handleActivity(activity.id)}
                  disabled={activityMutation.isPending || !wallet || (wallet as any).tokenBalance < activity.tokenCost}
                  className="w-full justify-between text-left p-3 h-auto bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
                >
                  <div className="flex items-center">
                    <Sparkles className="mr-2 h-4 w-4 text-pink-400" />
                    <div>
                      <p className="text-white text-sm font-medium">{activity.name}</p>
                      {activity.description && (
                        <p className="text-slate-400 text-xs">{activity.description}</p>
                      )}
                    </div>
                  </div>
                  <Badge className="bg-pink-600 text-white">
                    {activity.tokenCost}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Custom Tip */}
        <div className="space-y-3">
          <Dialog open={isTipDialogOpen} onOpenChange={setIsTipDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                <Gift className="mr-2 h-4 w-4" />
                Custom Tip
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700 text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Send Custom Tip</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-300">Tip Amount (tokens)</Label>
                  <Input
                    type="number"
                    value={customTipAmount}
                    onChange={(e) => setCustomTipAmount(e.target.value)}
                    className="bg-slate-800 border-slate-600 text-white"
                    placeholder="Enter amount..."
                    min="1"
                  />
                </div>
                
                <div>
                  <Label className="text-slate-300">Message (Optional)</Label>
                  <Textarea
                    value={tipMessage}
                    onChange={(e) => setTipMessage(e.target.value)}
                    className="bg-slate-800 border-slate-600 text-white"
                    placeholder="Add a message with your tip..."
                    rows={3}
                  />
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    onClick={handleCustomTip}
                    disabled={tipMutation.isPending || !customTipAmount}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    {tipMutation.isPending ? "Sending..." : "Send Tip"}
                  </Button>
                  <Button
                    onClick={() => setIsTipDialogOpen(false)}
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Token Balance Info */}
        <div className="bg-slate-800 p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 text-sm">Your Tokens:</span>
            <span className="text-white font-medium">{(wallet as any)?.tokenBalance || 0}</span>
          </div>
          {(!wallet || (wallet as any).tokenBalance < 10) && (
            <p className="text-orange-400 text-xs mt-1">
              Low balance! Consider buying more tokens.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}