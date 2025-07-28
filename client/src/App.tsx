import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import CreatorDashboard from "@/pages/creator-dashboard";
import AdminPanel from "@/pages/admin-panel";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const typedUser = user as User | undefined;

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
          {typedUser?.role === 'creator' && (
            <Route path="/creator-dashboard" component={CreatorDashboard} />
          )}
          {typedUser?.role === 'admin' && (
            <Route path="/admin-panel" component={AdminPanel} />
          )}
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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
