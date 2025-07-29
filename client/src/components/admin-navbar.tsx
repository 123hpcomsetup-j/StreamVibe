import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { 
  Home, 
  Shield, 
  Users, 
  CreditCard, 
  Eye,
  Settings,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  Search,
  Bell,
  AlertTriangle
} from "lucide-react";
import type { User } from "@shared/schema";

export default function AdminNavbar() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const typedUser = user as User | undefined;

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = "/admin";
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = "/admin";
    }
  };



  const navItems = [
    { 
      href: "/admin-panel", 
      label: "Dashboard", 
      icon: Home,
      description: "Main admin control panel"
    },
    { 
      href: "/admin-panel?tab=streams", 
      label: "Live Streams", 
      icon: Eye,
      description: "Monitor live streams"
    },
    { 
      href: "/admin-panel?tab=users", 
      label: "Users", 
      icon: Users,
      description: "Manage users and creators"
    },
    { 
      href: "/admin-panel?tab=payments", 
      label: "Payments", 
      icon: CreditCard,
      description: "Handle token purchases"
    }
  ];

  return (
    <nav className="bg-red-900 border-b border-red-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link href="/admin-panel">
                <div className="flex items-center space-x-2 cursor-pointer">
                  <Shield className="h-8 w-8 text-red-400" />
                  <span className="text-xl font-bold text-white">StreamVibe</span>
                  <Badge variant="destructive" className="bg-red-600 text-white border-red-500 hidden sm:flex">
                    Admin
                  </Badge>
                </div>
              </Link>
            </div>
            <div className="hidden md:block ml-10">
              <div className="flex items-baseline space-x-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href || 
                    (item.href.includes('?tab=') && location.includes(item.href.split('?')[1]));
                  
                  return (
                    <Link key={item.href} href={item.href}>
                      <a className={`text-red-200 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                        isActive ? 'bg-red-800 text-white' : ''
                      }`}>
                        <Icon className="mr-2 h-4 w-4" />
                        {item.label}
                      </a>
                    </Link>
                  );
                })}
              </div>
            </div>
            
            {/* Mobile menu button */}
            <div className="md:hidden ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-red-200 hover:text-white"
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-4">
            <div className="relative">
              <Input 
                type="text" 
                placeholder="Search users, streams..." 
                className="bg-red-800 border-red-700 rounded-lg px-4 py-2 w-64 focus:outline-none focus:border-red-500 pr-10 text-white placeholder-red-300"
              />
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-red-300" />
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="text-red-200 hover:text-white relative"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs rounded-full h-5 w-5 flex items-center justify-center">
                3
              </span>
            </Button>
            
            <div className="flex items-center space-x-2">
              <Badge variant="destructive" className="bg-red-600 text-white border-red-500">
                <Shield className="mr-1 h-3 w-3" />
                Admin
              </Badge>
              
              <div className="relative">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-red-400 relative cursor-pointer">
                  <img 
                    src={typedUser?.profileImageUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"} 
                    alt="Admin profile" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-red-900"></div>
                </div>
              </div>
              
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">{typedUser?.username || 'Admin'}</span>
                <span className="text-xs text-red-300">Administrator</span>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-red-200 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-red-800">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href || 
                  (item.href.includes('?tab=') && location.includes(item.href.split('?')[1]));
                
                return (
                  <Link key={item.href} href={item.href}>
                    <a className={`text-red-200 hover:text-white block px-3 py-2 rounded-md text-base font-medium flex items-center ${
                      isActive ? 'bg-red-800 text-white' : ''
                    }`}>
                      <Icon className="mr-3 h-5 w-5" />
                      {item.label}
                    </a>
                  </Link>
                );
              })}
              
              <div className="pt-4 pb-2 border-t border-red-800">
                <div className="flex items-center px-3 py-2">
                  <Badge variant="destructive" className="bg-red-600 text-white border-red-500 mr-3">
                    <Shield className="mr-1 h-3 w-3" />
                    Admin
                  </Badge>
                  <span className="font-medium text-white">{typedUser?.username || 'Administrator'}</span>
                </div>
                <div className="px-3 py-2">
                  <div className="relative mb-3">
                    <Input 
                      type="text" 
                      placeholder="Search..." 
                      className="bg-red-800 border-red-700 text-white placeholder-red-300"
                    />
                    <Search className="absolute right-3 top-2.5 h-4 w-4 text-red-300" />
                  </div>
                </div>
                <Link href="/admin-profile">
                  <a className="text-red-200 hover:text-white block px-3 py-2 rounded-md text-base font-medium flex items-center">
                    <UserIcon className="mr-3 h-5 w-5" />
                    My Profile
                  </a>
                </Link>
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="w-full text-left justify-start text-red-200 hover:text-white mt-2"
                >
                  <LogOut className="h-4 w-4 mr-3" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}