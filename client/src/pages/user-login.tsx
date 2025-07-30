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
import { Play, MessageCircle, Heart, UserPlus } from "lucide-react";

export default function UserLogin() {
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
  const [showSignup, setShowSignup] = useState(false);

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return await response.json();
    },
    onSuccess: (user: any) => {
      console.log('Login response:', user);
      console.log('User role:', user.role);
      console.log('Role comparison:', user.role === 'viewer');
      
      if (user.role === 'viewer') {
        toast({
          title: "Welcome!",
          description: "Redirecting to your viewer dashboard...",
        });
        setLocation("/user-dashboard");
      } else {
        toast({
          title: "Access Denied",
          description: `This portal is for viewers only. You have role: ${user.role}`,
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
        ...data,
        role: "viewer"
      });
      return await response.json();
    },
    onSuccess: (user: any) => {
      toast({
        title: "Account Created!",
        description: "Welcome to StreamVibe! Redirecting to your dashboard...",
      });
      setShowSignup(false);
      setLocation("/user-dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to create account",
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
    if (!signupData.username || !signupData.password || !signupData.firstName) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    signupMutation.mutate(signupData);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* User Portal Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 rounded-full p-4">
              <Play className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">StreamVibe</h1>
          <p className="text-slate-300">Watch live streams and connect with creators</p>
        </div>

        {/* Features Preview */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center">
            <div className="bg-slate-800 rounded-lg p-3 mb-2">
              <Play className="h-5 w-5 text-blue-400 mx-auto" />
            </div>
            <p className="text-xs text-slate-400">Watch Live</p>
          </div>
          <div className="text-center">
            <div className="bg-slate-800 rounded-lg p-3 mb-2">
              <MessageCircle className="h-5 w-5 text-green-400 mx-auto" />
            </div>
            <p className="text-xs text-slate-400">Live Chat</p>
          </div>
          <div className="text-center">
            <div className="bg-slate-800 rounded-lg p-3 mb-2">
              <Heart className="h-5 w-5 text-red-400 mx-auto" />
            </div>
            <p className="text-xs text-slate-400">Support Creators</p>
          </div>
        </div>

        {/* Login Form */}
        <Card className="bg-slate-800/90 border-slate-700 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-white">Viewer Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-300">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
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
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Signing In..." : "Start Watching"}
              </Button>
            </form>

            {/* New User Registration */}
            <div className="text-center mt-6 pt-6 border-t border-slate-600">
              <p className="text-slate-400 text-sm mb-3">
                New to StreamVibe?
              </p>
              <Dialog open={showSignup} onOpenChange={setShowSignup}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 mb-3"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create Viewer Account
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-800 border-slate-700 text-white">
                  <DialogHeader>
                    <DialogTitle>Create Your Viewer Account</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Join StreamVibe to watch live streams and connect with creators
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-slate-300">First Name</Label>
                        <Input
                          id="firstName"
                          placeholder="John"
                          value={signupData.firstName}
                          onChange={(e) => setSignupData({ ...signupData, firstName: e.target.value })}
                          className="bg-slate-700 border-slate-600 text-white"
                          disabled={signupMutation.isPending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-slate-300">Last Name</Label>
                        <Input
                          id="lastName"
                          placeholder="Doe"
                          value={signupData.lastName}
                          onChange={(e) => setSignupData({ ...signupData, lastName: e.target.value })}
                          className="bg-slate-700 border-slate-600 text-white"
                          disabled={signupMutation.isPending}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signupUsername" className="text-slate-300">Username</Label>
                      <Input
                        id="signupUsername"
                        placeholder="Choose a unique username"
                        value={signupData.username}
                        onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        disabled={signupMutation.isPending}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signupPassword" className="text-slate-300">Password</Label>
                      <Input
                        id="signupPassword"
                        type="password"
                        placeholder="Minimum 6 characters"
                        value={signupData.password}
                        onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        disabled={signupMutation.isPending}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-slate-300">Confirm Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Confirm your password"
                        value={signupData.confirmPassword}
                        onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        disabled={signupMutation.isPending}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      disabled={signupMutation.isPending}
                    >
                      {signupMutation.isPending ? "Creating Account..." : "Create Viewer Account"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              
              <Button
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                onClick={() => setLocation("/creator-login")}
              >
                Go to Creator Portal
              </Button>
            </div>

            <div className="text-center mt-4">
              <p className="text-slate-400 text-sm mb-3">
                Test Viewer Accounts:
              </p>
              <div className="text-xs text-slate-500 space-y-1">
                <div>👤 <strong>test_viewer</strong> / password123</div>
                <div>💫 <strong>demo_user</strong> / password123</div>
                <div>📺 <strong>stream_fan</strong> / password123</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}