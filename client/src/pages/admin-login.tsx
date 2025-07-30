import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [loginData, setLoginData] = useState({
    username: "",
    password: ""
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return await response.json();
    },
    onSuccess: (response: any) => {
      if (response?.role !== 'admin') {
        toast({
          title: "Access Denied",
          description: "Admin privileges required",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Admin Login Successful",
        description: "Welcome to the admin panel",
      });
      // Invalidate auth queries to refresh the auth state
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Small delay to ensure auth state is updated before redirect
      setTimeout(() => {
        setLocation("/admin-panel");
      }, 200);
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid admin credentials",
        variant: "destructive",
      });
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.username || !loginData.password) {
      toast({
        title: "Missing Information",
        description: "Please enter both username and password",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate(loginData);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Admin Portal</h1>
          <p className="text-muted-foreground">StreamVibe Administration</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-center text-foreground">Admin Login</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-muted-foreground">Admin Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter admin username"
                  value={loginData.username}
                  onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                  className="bg-background border-input text-foreground"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-muted-foreground">Admin Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter admin password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  className="bg-background border-input text-foreground"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Verifying..." : "Admin Sign In"}
              </Button>
            </form>
            
            <div className="text-center mt-4 border-t border-slate-600 pt-4">
              <p className="text-slate-400 text-sm mb-3">
                Test Admin Accounts:
              </p>
              <div className="text-xs text-slate-500 space-y-1">
                <div>🔥 <strong>super_admin</strong> / password123</div>
                <div>🛡️ <strong>content_mod</strong> / password123</div>
                <div>⚙️ <strong>admin</strong> / password123</div>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <Button 
                variant="link" 
                onClick={() => setLocation("/")}
                className="text-slate-400 hover:text-white"
              >
                ← Back to Main Login
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <div className="mt-6 text-center text-sm text-slate-500">
          <p>Restricted access for authorized personnel only</p>
        </div>
      </div>
    </div>
  );
}