import { Search, Coins, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { User } from "@shared/schema";

interface NavbarProps {
  user: User;
}

export default function Navbar({ user }: NavbarProps) {
  const handleLogout = () => {
    if (user?.role === 'admin') {
      // For admin users, logout and redirect to admin login
      fetch('/api/auth/logout', { method: 'POST' })
        .then(() => {
          window.location.href = "/admin";
        })
        .catch(() => {
          window.location.href = "/admin";
        });
    } else {
      // For regular users, logout and redirect to main login
      window.location.href = "/api/logout";
    }
  };

  return (
    <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold text-primary">StreamVibe</h1>
            </div>
            <div className="hidden md:block ml-10">
              <div className="flex items-baseline space-x-4">
                <a href="#" className="text-slate-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Home
                </a>
                <a href="#" className="text-slate-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Browse
                </a>
                <a href="#" className="text-slate-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Categories
                </a>
                {user?.role === 'admin' && (
                  <a href="/admin-panel" className="text-red-400 hover:text-red-300 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                    Admin Panel
                  </a>
                )}
                {user?.role === 'creator' && (
                  <a href="/creator-dashboard" className="text-green-400 hover:text-green-300 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                    Creator Dashboard
                  </a>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Input 
                type="text" 
                placeholder="Search creators..." 
                className="bg-slate-700 border-slate-600 rounded-lg px-4 py-2 w-64 focus:outline-none focus:border-primary pr-10"
              />
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
            
            <div className="flex items-center space-x-2 bg-slate-700 rounded-lg px-3 py-2">
              <Coins className="h-4 w-4 text-accent" />
              <span className="font-medium text-white">{user?.walletBalance || 0}</span>
              <span className="text-slate-400">tokens</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-primary/20 text-primary">
                {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
              </Badge>
              
              <div className="relative">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-accent relative cursor-pointer">
                  <img 
                    src={user?.profileImageUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"} 
                    alt="User profile" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-accent rounded-full border-2 border-slate-800"></div>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-slate-400 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
