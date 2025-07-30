import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
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
import CreatorLiveStudio from "@/pages/creator-live-studio";
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";
import BuyTokens from "@/pages/buy-tokens";
import { useEffect } from "react";
import { io } from "socket.io-client";

// Initialize global WebSocket connection for debugging
const globalSocket = io(window.location.origin, {
  path: '/socket.io',
  transports: ['websocket', 'polling']
});

globalSocket.on('connect', () => {
  console.log('🌐 GLOBAL: WebSocket connected to server:', globalSocket.id);
});

globalSocket.on('disconnect', () => {
  console.log('🌐 GLOBAL: WebSocket disconnected from server');
});

globalSocket.on('connect_error', (error) => {
  console.error('🌐 GLOBAL: WebSocket connection error:', error);
});

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const typedUser = user as User | undefined;

  return (
    <Switch>
      {/* Public routes - always accessible */}
      <Route path="/" component={PublicHome} />
      <Route path="/landing" component={Landing} />
      <Route path="/stream/:streamId" component={StreamView} />
      <Route path="/login" component={Login} />
      <Route path="/creator-login" component={CreatorLogin} />
      <Route path="/user-login" component={UserLogin} />
      <Route path="/admin" component={AdminLogin} />
      
      {/* Protected routes - accessible when authenticated or during loading */}
      <Route path="/home" component={Home} />
      <Route path="/user-dashboard" component={UserDashboard} />
      <Route path="/creator-dashboard" component={CreatorDashboard} />
      <Route path="/creator-live-studio" component={CreatorLiveStudio} />
      <Route path="/admin-panel" component={ModernAdminPanel} />
      <Route path="/admin-profile" component={AdminProfile} />
      <Route path="/buy-tokens" component={BuyTokens} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
