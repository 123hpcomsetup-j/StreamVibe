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
import ModernAdminPanel from "@/pages/modern-admin-panel";
import AdminProfile from "@/pages/admin-profile";
import StreamView from "@/pages/stream-view";
import UserDashboard from "@/pages/user-dashboard";
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { io } from "socket.io-client";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const typedUser = user as User | undefined;

  return (
    <Switch>
      {/* Public routes - always accessible */}
      <Route path="/" component={Landing} />
      <Route path="/public-home" component={PublicHome} />
      <Route path="/stream/:streamId" component={StreamView} />
      <Route path="/login" component={Login} />
      <Route path="/creator-login" component={CreatorLogin} />
      <Route path="/user-login" component={UserLogin} />
      <Route path="/admin" component={AdminLogin} />
      
      {/* Protected routes - accessible when authenticated or during loading */}
      <Route path="/home" component={Home} />
      <Route path="/user-dashboard" component={UserDashboard} />
      <Route path="/creator-dashboard" component={CreatorDashboard} />
      <Route path="/admin-panel" component={ModernAdminPanel} />
      <Route path="/admin-profile" component={AdminProfile} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Remove the duplicate WebSocket connection - let components handle their own connections

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
