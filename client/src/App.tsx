import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
import Login from "@/pages/login";
import CreatorLogin from "@/pages/creator-login";
import UserLogin from "@/pages/user-login";
import AdminLogin from "@/pages/admin-login";
import PublicHome from "@/pages/public-home";
import Home from "@/pages/home";
import CreatorDashboard from "@/pages/creator-dashboard";
import AdminPanel from "@/pages/admin-panel";
import StreamView from "@/pages/stream-view";
import UserDashboard from "@/pages/user-dashboard";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { io } from "socket.io-client";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const typedUser = user as User | undefined;

  return (
    <Switch>
      {/* Public routes - always accessible */}
      <Route path="/" component={PublicHome} />
      <Route path="/stream/:streamId" component={StreamView} />
      <Route path="/login" component={Login} />
      <Route path="/creator-login" component={CreatorLogin} />
      <Route path="/user-login" component={UserLogin} />
      <Route path="/admin" component={AdminLogin} />
      
      {/* Protected routes - accessible when authenticated or during loading */}
      <Route path="/home" component={Home} />
      <Route path="/user-dashboard" component={UserDashboard} />
      <Route path="/creator-dashboard" component={CreatorDashboard} />
      <Route path="/admin-panel" component={AdminPanel} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    // Initialize WebSocket connection for real-time updates
    const socket = io("http://localhost:5000", {
      path: "/socket.io",
      transports: ["websocket", "polling"]
    });

    socket.on('connect', () => {
      console.log('Connected to streaming server for real-time updates');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from streaming server');
    });

    socket.on('stream-status-changed', (data: any) => {
      console.log('Stream status changed:', data);
      // Invalidate queries to refresh live streams
      queryClient.invalidateQueries({ queryKey: ["/api/streams/live"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/online"] });
    });

    // Make socket globally available for components
    (window as any).streamSocket = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
