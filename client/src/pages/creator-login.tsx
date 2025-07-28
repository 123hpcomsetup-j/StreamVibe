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
import { Video, Users, DollarSign } from "lucide-react";

export default function CreatorLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      return await apiRequest("POST", "/api/auth/login", data);
    },
    onSuccess: (user: any) => {
      if (user.role === 'creator') {
        toast({
          title: "Welcome Creator!",
          description: "Redirecting to your creator dashboard...",
        });
        setLocation("/creator-dashboard");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-indigo-900 flex items-center justify-center p-4">
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
                className="w-full bg-purple-600 hover:bg-purple-700"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Signing In..." : "Access Creator Dashboard"}
              </Button>
            </form>

            <div className="text-center mt-6 pt-6 border-t border-slate-600">
              <p className="text-slate-400 text-sm mb-3">
                Are you a viewer?
              </p>
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
                <div>🎨 <strong>artist_sarah</strong> / creator123</div>
                <div>🎮 <strong>gamer_mike</strong> / creator123</div>
                <div>👨‍🍳 <strong>chef_emma</strong> / creator123</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}