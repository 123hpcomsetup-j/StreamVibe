import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Video, Users, DollarSign, UserPlus, KeyRound } from "lucide-react";

export default function CreatorLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [signupData, setSignupData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });
  const [resetData, setResetData] = useState({
    username: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showSignup, setShowSignup] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return await response.json();
    },
    onSuccess: (user: any) => {
      if (user && user.role === 'creator') {
        toast({
          title: "Welcome Creator!",
          description: "Redirecting to your creator dashboard...",
        });
        // Small delay to ensure session is established
        setTimeout(() => {
          setLocation("/creator-dashboard");
        }, 100);
      } else {
        toast({
          title: "Access Denied",
          description: "This portal is for creators only. Please use the user login.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: "Invalid username or password",
        variant: "destructive",
      });
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: typeof signupData) => {
      if (data.password !== data.confirmPassword) {
        throw new Error("Passwords do not match");
      }
      if (data.password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      const response = await apiRequest("POST", "/api/auth/register", {
        username: data.username,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        role: "creator",
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Account Created!",
        description: "Your creator account has been created. You can now login.",
      });
      setShowSignup(false);
      setSignupData({
        username: "",
        password: "",
        confirmPassword: "",
        firstName: "",
        lastName: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Signup Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (data: typeof resetData) => {
      if (data.newPassword !== data.confirmPassword) {
        throw new Error("Passwords do not match");
      }
      if (data.newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      const response = await apiRequest("POST", "/api/auth/reset-password", {
        username: data.username,
        newPassword: data.newPassword,
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Reset!",
        description: "Your password has been updated. You can now login with your new password.",
      });
      setShowReset(false);
      setResetData({
        username: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password) {
      toast({
        title: "Missing Information",
        description: "Please enter both username and password",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate(formData);
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    signupMutation.mutate(signupData);
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    resetMutation.mutate(resetData);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Creator Portal Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-purple-600 rounded-full p-4">
              <Video className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Creator Portal</h1>
          <p className="text-slate-300">Start streaming and monetize your content</p>
        </div>

        {/* Features Preview */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center">
            <div className="bg-slate-800 rounded-lg p-3 mb-2">
              <Video className="h-5 w-5 text-purple-400 mx-auto" />
            </div>
            <p className="text-xs text-slate-400">Live Stream</p>
          </div>
          <div className="text-center">
            <div className="bg-slate-800 rounded-lg p-3 mb-2">
              <Users className="h-5 w-5 text-blue-400 mx-auto" />
            </div>
            <p className="text-xs text-slate-400">Build Audience</p>
          </div>
          <div className="text-center">
            <div className="bg-slate-800 rounded-lg p-3 mb-2">
              <DollarSign className="h-5 w-5 text-green-400 mx-auto" />
            </div>
            <p className="text-xs text-slate-400">Earn Money</p>
          </div>
        </div>

        {/* Login Form */}
        <Card className="bg-slate-800/90 border-slate-700 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-white">Creator Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-300">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your creator username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                  disabled={loginMutation.isPending}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                  disabled={loginMutation.isPending}
                />
              </div>
              
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Signing In..." : "Access Creator Dashboard"}
              </Button>
            </form>

            {/* Forgot Password Link */}
            <div className="text-center mt-4">
              <Dialog open={showReset} onOpenChange={setShowReset}>
                <DialogTrigger asChild>
                  <Button variant="link" className="text-primary hover:text-primary/80 p-0 h-auto">
                    <KeyRound className="h-3 w-3 mr-1" />
                    Forgot Password?
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-background border-border">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Reset Password</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      Enter your username and new password to reset your account.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleReset} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-username" className="text-foreground">Username</Label>
                      <Input
                        id="reset-username"
                        value={resetData.username}
                        onChange={(e) => setResetData({ ...resetData, username: e.target.value })}
                        className="bg-background border-input text-foreground"
                        placeholder="Enter your username"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password" className="text-foreground">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={resetData.newPassword}
                        onChange={(e) => setResetData({ ...resetData, newPassword: e.target.value })}
                        className="bg-background border-input text-foreground"
                        placeholder="Enter new password"
                        minLength={6}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-new-password" className="text-foreground">Confirm New Password</Label>
                      <Input
                        id="confirm-new-password"
                        type="password"
                        value={resetData.confirmPassword}
                        onChange={(e) => setResetData({ ...resetData, confirmPassword: e.target.value })}
                        className="bg-background border-input text-foreground"
                        placeholder="Confirm new password"
                        minLength={6}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={resetMutation.isPending}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {resetMutation.isPending ? "Resetting..." : "Reset Password"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Signup Section */}
            <div className="text-center mt-6 pt-6 border-t border-slate-600">
              <p className="text-slate-400 text-sm mb-3">
                New to StreamVibe?
              </p>
              <Dialog open={showSignup} onOpenChange={setShowSignup}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mb-3">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create Creator Account
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-background border-border">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Create Creator Account</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      Join StreamVibe as a content creator and start monetizing your streams.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-white">First Name</Label>
                        <Input
                          id="firstName"
                          value={signupData.firstName}
                          onChange={(e) => setSignupData({ ...signupData, firstName: e.target.value })}
                          className="bg-slate-700 border-slate-600 text-white"
                          placeholder="First name"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-white">Last Name</Label>
                        <Input
                          id="lastName"
                          value={signupData.lastName}
                          onChange={(e) => setSignupData({ ...signupData, lastName: e.target.value })}
                          className="bg-slate-700 border-slate-600 text-white"
                          placeholder="Last name"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-username" className="text-white">Username</Label>
                      <Input
                        id="signup-username"
                        value={signupData.username}
                        onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        placeholder="Choose a unique username"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-white">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        value={signupData.password}
                        onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        placeholder="Create a password"
                        minLength={6}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-white">Confirm Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={signupData.confirmPassword}
                        onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        placeholder="Confirm your password"
                        minLength={6}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={signupMutation.isPending}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {signupMutation.isPending ? "Creating Account..." : "Create Creator Account"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              
              <Button
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                onClick={() => setLocation("/user-login")}
              >
                Go to Viewer Login
              </Button>
            </div>

            <div className="text-center mt-4">
              <p className="text-slate-400 text-sm mb-3">
                Test Creator Accounts:
              </p>
              <div className="text-xs text-slate-500 space-y-1">
                <div>🎮 <strong>test_creator</strong> / password123</div>
                <div>🎨 <strong>stream_bob</strong> / password123</div>
                <div>🎵 <strong>live_charlie</strong> / password123</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}