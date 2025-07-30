import { Search, Coins, LogOut, Menu, X, Home, Eye, Video, Users, User as UserIcon, Plus, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface NavbarProps {
  user: User;
}

export default function Navbar({ user }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const [showBuyTokens, setShowBuyTokens] = useState(false);
  const [tokenAmount, setTokenAmount] = useState("");
  const [utrNumber, setUtrNumber] = useState("");
  const { toast } = useToast();

  // Fetch real-time wallet balance
  const { data: walletData } = useQuery({
    queryKey: ["/api/wallet"],
    enabled: !!user,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch UPI configuration
  const { data: upiConfig } = useQuery({
    queryKey: ["/api/upi-config"],
    enabled: showBuyTokens,
  });

  // Token purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: async ({ amount, utrNumber }: { amount: number; utrNumber: string }) => {
      return await apiRequest("POST", "/api/token-purchases", {
        tokenAmount: amount,
        utrNumber,
      });
    },
    onSuccess: () => {
      toast({
        title: "Purchase Request Submitted",
        description: "Your token purchase request has been submitted for admin approval.",
      });
      setShowBuyTokens(false);
      setTokenAmount("");
      setUtrNumber("");
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleBuyTokens = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(tokenAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid token amount",
        variant: "destructive",
      });
      return;
    }
    if (!utrNumber.trim()) {
      toast({
        title: "UTR Required",
        description: "Please enter your UPI transaction reference number",
        variant: "destructive",
      });
      return;
    }
    purchaseMutation.mutate({ amount, utrNumber });
  };

  // Get current wallet balance
  const currentBalance = (walletData as any)?.tokenBalance || 0;

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
  
  // Consistent white and black theme for all users
  const theme = {
    bg: 'bg-white',
    border: 'border-border',
    text: 'text-muted-foreground',
    textHover: 'hover:text-foreground',
    textActive: 'text-foreground',
    bgActive: 'bg-primary',
    searchBg: 'bg-background',
    searchBorder: 'border-input',
    searchFocus: 'focus:border-primary',
    badgeBg: 'bg-primary',
    logoColor: 'text-primary'
  };

  return (
    <nav className={`${theme.bg} border-b ${theme.border} sticky top-0 z-50`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center flex-1">
            <div className="flex-shrink-0">
              <Link href={user?.role === 'admin' ? '/admin-panel' : user?.role === 'creator' ? '/creator-dashboard' : '/user-dashboard'}>
                <div className="flex items-center space-x-1.5 sm:space-x-2 cursor-pointer">
                  <Video className={`h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 ${theme.logoColor}`} />
                  <span className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">StreamVibe</span>
                  <Badge variant="secondary" className={`${theme.badgeBg} text-primary-foreground hidden sm:flex text-xs`}>
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
                      <div className={`${theme.text} ${theme.textHover} px-2 xl:px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center cursor-pointer ${
                        isActive ? `${theme.bgActive} text-primary-foreground` : ''
                      }`}>
                        <Icon className="mr-1.5 xl:mr-2 h-3.5 w-3.5 xl:h-4 xl:w-4" />
                        <span className="hidden xl:inline">{item.label}</span>
                        <span className="xl:hidden">{item.label.split(' ')[0]}</span>
                      </div>
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
            
            {/* Wallet Balance - Responsive & Clickable */}
            <Button
              variant="ghost"
              onClick={() => setShowBuyTokens(true)}
              className={`hidden sm:flex items-center space-x-2 ${theme.searchBg} rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-opacity-80 transition-all duration-200`}
            >
              <Coins className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-400" />
              <span className="text-xs sm:text-sm font-medium text-white">{currentBalance}</span>
              <span className="hidden md:inline text-xs sm:text-sm text-slate-300">tokens</span>
              <Plus className="h-3 w-3 text-green-400 ml-1" />
            </Button>
            
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
                    <div className={`${theme.text} ${theme.textHover} hover:${theme.bgActive.split(' ')[1]} block px-3 py-2 rounded-md text-base font-medium flex items-center transition-colors cursor-pointer ${
                      isActive ? `${theme.bgActive} ${theme.textActive}` : ''
                    }`}>
                      <Icon className="mr-3 h-5 w-5" />
                      {item.label}
                    </div>
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
              
              {/* Mobile Wallet Balance - Clickable */}
              <div className="px-3 py-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowBuyTokens(true)}
                  className={`w-full flex items-center space-x-2 ${theme.searchBg} rounded-lg px-3 py-2 hover:bg-opacity-80 transition-all duration-200`}
                >
                  <Coins className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm font-medium text-white">{currentBalance} tokens</span>
                  <Plus className="h-4 w-4 text-green-400 ml-auto" />
                </Button>
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

      {/* Buy Tokens Modal */}
      <Dialog open={showBuyTokens} onOpenChange={setShowBuyTokens}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center">
              <ShoppingCart className="mr-2 h-5 w-5 text-green-500" />
              Buy Tokens
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleBuyTokens} className="space-y-4">
            <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300">Current Balance</span>
                <div className="flex items-center space-x-1">
                  <Coins className="h-4 w-4 text-yellow-400" />
                  <span className="font-bold text-white">{currentBalance} tokens</span>
                </div>
              </div>
            </div>

            {upiConfig && (
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 mb-4">
                <h4 className="text-blue-200 font-medium mb-2">Payment Details</h4>
                <div className="space-y-1 text-sm">
                  <div><span className="text-slate-400">UPI ID:</span> <span className="text-blue-300 font-mono">{(upiConfig as any).upiId}</span></div>
                  <div><span className="text-slate-400">Name:</span> <span className="text-blue-300">{(upiConfig as any).recipientName}</span></div>
                  <div><span className="text-slate-400">Rate:</span> <span className="text-green-400">₹{(upiConfig as any).ratePerToken} per token</span></div>
                </div>
              </div>
            )}

            <div>
              <Label className="text-slate-300">Token Amount</Label>
              <Input
                type="number"
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
                placeholder="Enter number of tokens"
                min="1"
                required
              />
              {tokenAmount && upiConfig && (
                <p className="text-sm text-slate-400 mt-1">
                  Total: ₹{(parseInt(tokenAmount) || 0) * (upiConfig as any).ratePerToken}
                </p>
              )}
            </div>

            <div>
              <Label className="text-slate-300">UPI Transaction Reference (UTR)</Label>
              <Input
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
                placeholder="Enter UTR number after payment"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Complete the UPI payment first, then enter the transaction reference number here
              </p>
            </div>

            <div className="flex space-x-2">
              <Button 
                type="button"
                variant="outline"
                onClick={() => setShowBuyTokens(false)}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={purchaseMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {purchaseMutation.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
