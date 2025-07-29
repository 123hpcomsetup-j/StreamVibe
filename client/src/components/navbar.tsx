import { Search, Coins, LogOut, Menu, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import type { User } from "@shared/schema";

interface NavbarProps {
  user: User;
}

export default function Navbar({ user }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    if (user?.role === 'admin') {
      // For admin users, logout and redirect to admin login
      fetch('/api/auth/logout', { method: 'POST' })
        .then(() => {
          window.location.href = "/";
        })
        .catch(() => {
          window.location.href = "/";
        });
    } else {
      // For regular users, logout and redirect to homepage
      fetch('/api/auth/logout', { method: 'POST' })
        .then(() => {
          window.location.href = "/";
        })
        .catch(() => {
          window.location.href = "/";
        });
    }
  };

  return (
    <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center flex-1">
            <div className="flex-shrink-0">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-primary">StreamVibe</h1>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden lg:block ml-6 xl:ml-10">
              <div className="flex items-baseline space-x-2 xl:space-x-4">
                <a href={user?.role === 'admin' ? '/admin-panel' : user?.role === 'creator' ? '/creator-dashboard' : '/user-dashboard'} className="text-slate-300 hover:text-white px-2 xl:px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Home
                </a>
                <a href="/user-dashboard" className="text-slate-300 hover:text-white px-2 xl:px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Browse
                </a>
                {user?.role === 'admin' && (
                  <a href="/admin-panel" className="text-red-400 hover:text-red-300 px-2 xl:px-3 py-2 rounded-md text-sm font-medium transition-colors">
                    Admin Panel
                  </a>
                )}
                {user?.role === 'creator' && (
                  <a href="/creator-dashboard" className="text-green-400 hover:text-green-300 px-2 xl:px-3 py-2 rounded-md text-sm font-medium transition-colors">
                    Creator Dashboard
                  </a>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4">
            {/* Desktop Search - hidden on mobile */}
            <div className="relative hidden lg:block">
              <Input 
                type="text" 
                placeholder="Search creators..." 
                className="bg-slate-700 border-slate-600 rounded-lg px-3 py-2 w-48 xl:w-64 focus:outline-none focus:border-primary pr-9 text-sm"
              />
              <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
            </div>
            
            {/* Wallet Balance - Responsive */}
            <div className="hidden sm:flex items-center space-x-2 bg-slate-700 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
              <Coins className="h-3 w-3 sm:h-4 sm:w-4 text-accent" />
              <span className="text-xs sm:text-sm font-medium text-white">{user?.walletBalance || 0}</span>
              <span className="hidden md:inline text-xs sm:text-sm text-slate-300">tokens</span>
            </div>
            
            {/* Profile and Controls */}
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border-2 border-accent relative cursor-pointer">
                <img 
                  src={user?.profileImageUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 right-0 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-green-500 rounded-full border border-slate-800"></div>
              </div>
              
              {/* Mobile menu button */}
              <div className="lg:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="text-slate-400 hover:text-white p-1.5"
                >
                  {isMobileMenuOpen ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Menu className="h-4 w-4 sm:h-5 sm:w-5" />}
                </Button>
              </div>
              
              {/* Desktop logout */}
              <div className="hidden lg:block">
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
        
        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-700">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <a href={user?.role === 'admin' ? '/admin-panel' : user?.role === 'creator' ? '/creator-dashboard' : '/user-dashboard'} className="text-slate-300 hover:text-white hover:bg-slate-700 block px-3 py-2 rounded-md text-base font-medium transition-colors">
                Home
              </a>
              <a href="/user-dashboard" className="text-slate-300 hover:text-white hover:bg-slate-700 block px-3 py-2 rounded-md text-base font-medium transition-colors">
                Browse
              </a>
              {user?.role === 'admin' && (
                <a href="/admin-panel" className="text-red-400 hover:text-red-300 hover:bg-slate-700 block px-3 py-2 rounded-md text-base font-medium transition-colors">
                  Admin Panel
                </a>
              )}
              {user?.role === 'creator' && (
                <a href="/creator-dashboard" className="text-green-400 hover:text-green-300 hover:bg-slate-700 block px-3 py-2 rounded-md text-base font-medium transition-colors">
                  Creator Dashboard
                </a>
              )}
              
              {/* Mobile Search */}
              <div className="pt-3 pb-2 border-t border-slate-700 mt-3">
                <div className="relative px-3 py-2">
                  <Input 
                    type="text" 
                    placeholder="Search creators..." 
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 pr-10"
                  />
                  <Search className="absolute right-5 top-4.5 h-4 w-4 text-slate-400" />
                </div>
              </div>
              
              {/* Mobile Wallet and Profile */}
              <div className="pt-2 pb-2 border-t border-slate-700">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center space-x-2 bg-slate-700 rounded-lg px-3 py-2 flex-1 mr-3">
                    <Coins className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium text-white">{user?.walletBalance || 0} tokens</span>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={handleLogout}
                    className="text-slate-400 hover:text-white flex items-center space-x-2"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="text-sm">Logout</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
