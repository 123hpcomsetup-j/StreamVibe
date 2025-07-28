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
import { Play, MessageCircle, Heart } from "lucide-react";

export default function UserLogin() {
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
      if (user.role === 'viewer') {
        toast({
          title: "Welcome!",
          description: "Explore live streams and chat with creators",
        });
        setLocation("/");
      } else {
        toast({
          title: "Access Denied",
          description: "This portal is for viewers only. Please use the creator login.",
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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-cyan-900 flex items-center justify-center p-4">
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

            <div className="text-center mt-6 pt-6 border-t border-slate-600">
              <p className="text-slate-400 text-sm mb-3">
                Are you a content creator?
              </p>
              <Button
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                onClick={() => setLocation("/creator-login")}
              >
                Go to Creator Portal
              </Button>
            </div>

            <div className="text-center mt-4">
              <p className="text-slate-400 text-sm mb-2">
                Test Viewer Account:
              </p>
              <p className="text-xs text-slate-500">
                Username: viewer | Password: viewer123
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}