import { Search, Coins, LogOut, Menu, X, Home, Eye, Video, Users, User as UserIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import type { User } from "@shared/schema";

interface NavbarProps {
  user: User;
}

export default function Navbar({ user }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = "/";
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = "/";
    }
  };

  // Define navigation items based on user role
  const getNavItems = () => {
    const baseItems = [
      { 
        href: "/", 
        label: "Home", 
        icon: Home,
        description: "Main platform home"
      },
      { 
        href: "/user-dashboard", 
        label: "Browse", 
        icon: Eye,
        description: "Browse live streams"
      }
    ];

    if (user?.role === 'creator') {
      baseItems.push({
        href: "/creator-dashboard",
        label: "Dashboard",
        icon: Video,
        description: "Creator tools and streaming"
      });
    }

    if (user?.role === 'admin') {
      baseItems.push({
        href: "/admin-panel",
        label: "Admin Panel",
        icon: Users,
        description: "Admin controls"
      });
    }

    return baseItems;
  };

  const navItems = getNavItems();
  
  // Get theme colors based on user role
  const getThemeColors = () => {
    switch (user?.role) {
      case 'creator':
        return {
          bg: 'bg-purple-900',
          border: 'border-purple-800',
          text: 'text-purple-200',
          textHover: 'hover:text-white',
          textActive: 'text-white',
          bgActive: 'bg-purple-800',
          searchBg: 'bg-purple-800',
          searchBorder: 'border-purple-700',
          searchFocus: 'focus:border-purple-500',
          badgeBg: 'bg-purple-600',
          logoColor: 'text-purple-400'
        };
      case 'viewer':
        return {
          bg: 'bg-blue-900',
          border: 'border-blue-800', 
          text: 'text-blue-200',
          textHover: 'hover:text-white',
          textActive: 'text-white',
          bgActive: 'bg-blue-800',
          searchBg: 'bg-blue-800',
          searchBorder: 'border-blue-700',
          searchFocus: 'focus:border-blue-500',
          badgeBg: 'bg-blue-600',
          logoColor: 'text-blue-400'
        };
      default:
        return {
          bg: 'bg-slate-800',
          border: 'border-slate-700',
          text: 'text-slate-300',
          textHover: 'hover:text-white',
          textActive: 'text-white',
          bgActive: 'bg-slate-700',
          searchBg: 'bg-slate-700',
          searchBorder: 'border-slate-600',
          searchFocus: 'focus:border-primary',
          badgeBg: 'bg-slate-600',
          logoColor: 'text-primary'
        };
    }
  };

  const theme = getThemeColors();

  return (
    <nav className={`${theme.bg} border-b ${theme.border} sticky top-0 z-50`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center flex-1">
            <div className="flex-shrink-0">
              <Link href={user?.role === 'admin' ? '/admin-panel' : user?.role === 'creator' ? '/creator-dashboard' : '/user-dashboard'}>
                <div className="flex items-center space-x-1.5 sm:space-x-2 cursor-pointer">
                  <Video className={`h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 ${theme.logoColor}`} />
                  <span className="text-lg sm:text-xl lg:text-2xl font-bold text-white">StreamVibe</span>
                  <Badge variant="secondary" className={`${theme.badgeBg} text-white border-${user?.role === 'creator' ? 'purple' : user?.role === 'viewer' ? 'blue' : 'slate'}-500 hidden sm:flex text-xs`}>
                    {user?.role === 'creator' ? 'Creator' : user?.role === 'viewer' ? 'Viewer' : 'User'}
                  </Badge>
                </div>
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden lg:block ml-6 xl:ml-10">
              <div className="flex items-baseline space-x-2 xl:space-x-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href;
                  
                  return (
                    <Link key={item.href} href={item.href}>
                      <a className={`${theme.text} ${theme.textHover} px-2 xl:px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                        isActive ? `${theme.bgActive} ${theme.textActive}` : ''
                      }`}>
                        <Icon className="mr-1.5 xl:mr-2 h-3.5 w-3.5 xl:h-4 xl:w-4" />
                        <span className="hidden xl:inline">{item.label}</span>
                        <span className="xl:hidden">{item.label.split(' ')[0]}</span>
                      </a>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4">
            {/* Desktop Search - hidden on mobile */}
            <div className="relative hidden lg:block">
              <Input 
                type="text" 
                placeholder="Search creators..." 
                className={`${theme.searchBg} ${theme.searchBorder} rounded-lg px-3 py-2 w-48 xl:w-64 focus:outline-none ${theme.searchFocus} pr-9 text-sm text-white placeholder-${user?.role === 'creator' ? 'purple' : user?.role === 'viewer' ? 'blue' : 'slate'}-300`}
              />
              <Search className={`absolute right-2.5 top-2.5 h-4 w-4 ${user?.role === 'creator' ? 'text-purple-300' : user?.role === 'viewer' ? 'text-blue-300' : 'text-slate-400'}`} />
            </div>
            
            {/* Wallet Balance - Responsive */}
            <div className={`hidden sm:flex items-center space-x-2 ${theme.searchBg} rounded-lg px-2 sm:px-3 py-1.5 sm:py-2`}>
              <Coins className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-400" />
              <span className="text-xs sm:text-sm font-medium text-white">{user?.walletBalance || 0}</span>
              <span className="hidden md:inline text-xs sm:text-sm text-slate-300">tokens</span>
            </div>
            
            {/* Profile and Controls */}
            <div className="flex items-center space-x-2">
              {/* Mobile menu button */}
              <div className="lg:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className={`${theme.text} ${theme.textHover} p-1.5`}
                >
                  {isMobileMenuOpen ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Menu className="h-4 w-4 sm:h-5 sm:w-5" />}
                </Button>
              </div>
              
              {/* Desktop profile info and logout */}
              <div className="hidden lg:flex items-center space-x-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border-2 border-yellow-400 relative cursor-pointer">
                  <img 
                    src={user?.profileImageUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 right-0 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-green-500 rounded-full border border-slate-800"></div>
                </div>
                
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white">{user?.username || 'User'}</span>
                  <span className={`text-xs ${user?.role === 'creator' ? 'text-purple-300' : user?.role === 'viewer' ? 'text-blue-300' : 'text-slate-300'}`}>
                    {user?.role === 'creator' ? 'Content Creator' : user?.role === 'viewer' ? 'Viewer' : 'User'}
                  </span>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className={`${theme.text} ${theme.textHover}`}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className={`lg:hidden border-t ${theme.border}`}>
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                
                return (
                  <Link key={item.href} href={item.href}>
                    <a className={`${theme.text} ${theme.textHover} hover:${theme.bgActive.split(' ')[1]} block px-3 py-2 rounded-md text-base font-medium flex items-center transition-colors ${
                      isActive ? `${theme.bgActive} ${theme.textActive}` : ''
                    }`}>
                      <Icon className="mr-3 h-5 w-5" />
                      {item.label}
                    </a>
                  </Link>
                );
              })}
              
              {/* Mobile Search */}
              <div className="px-3 py-2">
                <div className="relative">
                  <Input 
                    type="text" 
                    placeholder="Search creators..." 
                    className={`${theme.searchBg} ${theme.searchBorder} rounded-lg px-3 py-2 w-full focus:outline-none ${theme.searchFocus} pr-9 text-sm text-white placeholder-${user?.role === 'creator' ? 'purple' : user?.role === 'viewer' ? 'blue' : 'slate'}-300`}
                  />
                  <Search className={`absolute right-2.5 top-2.5 h-4 w-4 ${user?.role === 'creator' ? 'text-purple-300' : user?.role === 'viewer' ? 'text-blue-300' : 'text-slate-400'}`} />
                </div>
              </div>
              
              {/* Mobile Wallet Balance */}
              <div className="px-3 py-2">
                <div className={`flex items-center space-x-2 ${theme.searchBg} rounded-lg px-3 py-2`}>
                  <Coins className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm font-medium text-white">{user?.walletBalance || 0} tokens</span>
                </div>
              </div>
              
              {/* Mobile Profile */}
              <div className={`px-3 py-2 border-t ${theme.border}`}>
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-yellow-400">
                    <img 
                      src={user?.profileImageUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-white font-medium">{user?.username}</div>
                    <div className={`${user?.role === 'creator' ? 'text-purple-300' : user?.role === 'viewer' ? 'text-blue-300' : 'text-slate-400'} text-sm`}>
                      {user?.role === 'creator' ? 'Content Creator' : user?.role === 'viewer' ? 'Viewer' : 'User'}
                    </div>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className={`w-full text-left justify-start ${theme.text} ${theme.textHover} hover:${theme.bgActive.split(' ')[1]} transition-colors`}
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
