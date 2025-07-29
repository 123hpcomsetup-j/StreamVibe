import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react";
import type { User } from "@shared/schema";

export default function AdminNavbar() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const typedUser = user as User | undefined;

  // Fetch pending approvals for notifications
  const { data: pendingCreators = [] } = useQuery({
    queryKey: ["/api/admin/pending-creators"],
    enabled: typedUser?.role === 'admin',
    retry: false,
  }) as { data: any[] };

  const { data: pendingTokenPurchases = [] } = useQuery({
    queryKey: ["/api/admin/pending-token-purchases"],
    enabled: typedUser?.role === 'admin',
    retry: false,
  }) as { data: any[] };

  const { data: pendingPayouts = [] } = useQuery({
    queryKey: ["/api/admin/pending-payouts"],
    enabled: typedUser?.role === 'admin',
    retry: false,
  }) as { data: any[] };

  const totalNotifications = (pendingCreators?.length || 0) + 
                            (pendingTokenPurchases?.length || 0) + 
                            (pendingPayouts?.length || 0);

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
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center flex-1">
            <div className="flex-shrink-0">
              <Link href="/admin-panel">
                <div className="flex items-center space-x-1.5 sm:space-x-2 cursor-pointer">
                  <Shield className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-red-400" />
                  <span className="text-lg sm:text-xl lg:text-2xl font-bold text-white">StreamVibe</span>
                  <Badge variant="destructive" className="bg-red-600 text-white border-red-500 hidden sm:flex text-xs">
                    Admin
                  </Badge>
                </div>
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden lg:block ml-6 xl:ml-10">
              <div className="flex items-baseline space-x-2 xl:space-x-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href || 
                    (item.href.includes('?tab=') && location.includes(item.href.split('?')[1]));
                  
                  return (
                    <Link key={item.href} href={item.href}>
                      <a className={`text-red-200 hover:text-white px-2 xl:px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                        isActive ? 'bg-red-800 text-white' : ''
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
                placeholder="Search users, streams..." 
                className="bg-red-800 border-red-700 rounded-lg px-3 py-2 w-48 xl:w-64 focus:outline-none focus:border-red-500 pr-9 text-sm text-white placeholder-red-300"
              />
              <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-red-300" />
            </div>
            
            {/* Notification Bell - Responsive */}
            <Popover open={showNotifications} onOpenChange={setShowNotifications}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-200 hover:text-white relative p-1.5 sm:p-2"
                >
                  <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                  {totalNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center">
                      {totalNotifications > 99 ? '99+' : totalNotifications}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 bg-slate-800 border-slate-700" align="end">
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white flex items-center text-sm">
                      <Bell className="mr-2 h-4 w-4" />
                      Pending Approvals ({totalNotifications})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 max-h-96 overflow-y-auto">
                    {totalNotifications === 0 ? (
                      <div className="p-4 text-center text-slate-400">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        <p className="text-sm">All caught up!</p>
                        <p className="text-xs">No pending approvals</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {/* Pending Creator Accounts */}
                        {pendingCreators.map((creator: any) => (
                          <div key={creator.id} className="p-3 hover:bg-slate-700/50 border-b border-slate-700 last:border-b-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-white">
                                  New Creator Application
                                </p>
                                <p className="text-xs text-slate-400">
                                  {creator.username} ({creator.email})
                                </p>
                                <div className="flex items-center mt-1">
                                  <Clock className="h-3 w-3 text-orange-400 mr-1" />
                                  <span className="text-xs text-orange-400">Awaiting approval</span>
                                </div>
                              </div>
                              <Link href="/admin-panel?tab=creators">
                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs">
                                  Review
                                </Button>
                              </Link>
                            </div>
                          </div>
                        ))}

                        {/* Pending Token Purchases */}
                        {pendingTokenPurchases.map((purchase: any) => (
                          <div key={purchase.id} className="p-3 hover:bg-slate-700/50 border-b border-slate-700 last:border-b-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-white">
                                  Token Purchase Request
                                </p>
                                <p className="text-xs text-slate-400">
                                  {purchase.tokens} tokens for ₹{purchase.amount}
                                </p>
                                <div className="flex items-center mt-1">
                                  <Clock className="h-3 w-3 text-orange-400 mr-1" />
                                  <span className="text-xs text-orange-400">Payment verification needed</span>
                                </div>
                              </div>
                              <Link href="/admin-panel?tab=payments">
                                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs">
                                  Review
                                </Button>
                              </Link>
                            </div>
                          </div>
                        ))}

                        {/* Pending Payouts */}
                        {pendingPayouts.map((payout: any) => (
                          <div key={payout.id} className="p-3 hover:bg-slate-700/50 border-b border-slate-700 last:border-b-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-white">
                                  Payout Request
                                </p>
                                <p className="text-xs text-slate-400">
                                  ₹{payout.amount} to {payout.creatorName}
                                </p>
                                <div className="flex items-center mt-1">
                                  <Clock className="h-3 w-3 text-orange-400 mr-1" />
                                  <span className="text-xs text-orange-400">Awaiting payment</span>
                                </div>
                              </div>
                              <Link href="/admin-panel?tab=payouts">
                                <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-xs">
                                  Review
                                </Button>
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </PopoverContent>
            </Popover>
            
            {/* Profile and Controls */}
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border-2 border-red-400 relative cursor-pointer">
                <img 
                  src={typedUser?.profileImageUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"} 
                  alt="Admin profile" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 right-0 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-green-500 rounded-full border border-red-900"></div>
              </div>
              
              {/* Mobile menu button */}
              <div className="lg:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="text-red-200 hover:text-white p-1.5"
                >
                  {isMobileMenuOpen ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Menu className="h-4 w-4 sm:h-5 sm:w-5" />}
                </Button>
              </div>
              
              {/* Desktop profile info and logout */}
              <div className="hidden lg:flex items-center space-x-2">
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
        </div>
        
        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-red-800">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href || 
                  (item.href.includes('?tab=') && location.includes(item.href.split('?')[1]));
                
                return (
                  <Link key={item.href} href={item.href}>
                    <a className={`text-red-200 hover:text-white hover:bg-red-800 block px-3 py-2 rounded-md text-base font-medium flex items-center transition-colors ${
                      isActive ? 'bg-red-800 text-white' : ''
                    }`}>
                      <Icon className="mr-3 h-5 w-5" />
                      {item.label}
                    </a>
                  </Link>
                );
              })}
              
              {/* Mobile Search */}
              <div className="pt-3 pb-2 border-t border-red-800 mt-3">
                <div className="relative px-3 py-2">
                  <Input 
                    type="text" 
                    placeholder="Search users, streams..." 
                    className="bg-red-800 border-red-700 text-white placeholder-red-300 pr-10"
                  />
                  <Search className="absolute right-5 top-4.5 h-4 w-4 text-red-300" />
                </div>
              </div>
              
              {/* Mobile Profile and Actions */}
              <div className="pt-2 pb-2 border-t border-red-800">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center space-x-3">
                    <Badge variant="destructive" className="bg-red-600 text-white border-red-500">
                      <Shield className="mr-1 h-3 w-3" />
                      Admin
                    </Badge>
                    <span className="font-medium text-white">{typedUser?.username || 'Administrator'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-200 hover:text-white relative p-2"
                        >
                          <Bell className="h-4 w-4" />
                          {totalNotifications > 0 && (
                            <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs rounded-full h-4 w-4 flex items-center justify-center">
                              {totalNotifications > 99 ? '99+' : totalNotifications}
                            </span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0 bg-slate-800 border-slate-700" align="end">
                        <Card className="bg-slate-800 border-slate-700">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-white flex items-center text-sm">
                              <Bell className="mr-2 h-4 w-4" />
                              Pending Approvals ({totalNotifications})
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-0 max-h-64 overflow-y-auto">
                            {totalNotifications === 0 ? (
                              <div className="p-4 text-center text-slate-400">
                                <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-500" />
                                <p className="text-sm">All caught up!</p>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {pendingCreators.map((creator: any) => (
                                  <div key={creator.id} className="p-2 hover:bg-slate-700/50 border-b border-slate-700 last:border-b-0">
                                    <p className="text-xs font-medium text-white">Creator: {creator.username}</p>
                                    <Link href="/admin-panel?tab=creators">
                                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs mt-1">
                                        Review
                                      </Button>
                                    </Link>
                                  </div>
                                ))}
                                {pendingTokenPurchases.map((purchase: any) => (
                                  <div key={purchase.id} className="p-2 hover:bg-slate-700/50 border-b border-slate-700 last:border-b-0">
                                    <p className="text-xs font-medium text-white">Token Purchase: {purchase.tokens} tokens</p>
                                    <Link href="/admin-panel?tab=payments">
                                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs mt-1">
                                        Review
                                      </Button>
                                    </Link>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                
                <Link href="/admin-profile">
                  <a className="text-red-200 hover:text-white hover:bg-red-800 block px-3 py-2 rounded-md text-base font-medium flex items-center transition-colors">
                    <UserIcon className="mr-3 h-5 w-5" />
                    My Profile
                  </a>
                </Link>
                
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="w-full text-left justify-start text-red-200 hover:text-white hover:bg-red-800 mt-2 transition-colors"
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