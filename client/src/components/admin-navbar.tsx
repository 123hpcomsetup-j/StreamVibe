import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Home, 
  Shield, 
  Users, 
  CreditCard, 
  Wallet, 
  Eye,
  Settings,
  LogOut,
  User as UserIcon
} from "lucide-react";
import type { User } from "@shared/schema";

export default function AdminNavbar() {
  const { user } = useAuth();
  const [location] = useLocation();
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
      href: "/", 
      label: "Public Home", 
      icon: Home,
      description: "Browse live streams and monitor content"
    },
    { 
      href: "/admin-panel", 
      label: "Admin Dashboard", 
      icon: Shield,
      description: "Main admin control panel"
    },
    { 
      href: "/admin-panel?tab=streams", 
      label: "Stream Monitor", 
      icon: Eye,
      description: "Monitor live streams for content moderation"
    },
    { 
      href: "/admin-panel?tab=users", 
      label: "User Management", 
      icon: Users,
      description: "Manage users and creators"
    },
    { 
      href: "/admin-panel?tab=payments", 
      label: "Payments", 
      icon: CreditCard,
      description: "Handle token purchases and payouts"
    }
  ];

  return (
    <nav className="bg-red-900 border-b border-red-800 px-4 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-6">
          <Link href="/admin-panel">
            <div className="flex items-center space-x-2 cursor-pointer">
              <Shield className="h-8 w-8 text-red-400" />
              <span className="text-xl font-bold text-white">StreamVibe Admin</span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || 
                (item.href.includes('?tab=') && location.includes(item.href.split('?')[1]));
              
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className={`text-white hover:text-red-100 hover:bg-red-800/50 ${
                      isActive ? 'bg-red-700 text-white' : ''
                    }`}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Admin Profile Menu */}
        <div className="flex items-center space-x-4">
          {/* Admin Badge */}
          <Badge variant="destructive" className="bg-red-600 text-white border-red-500">
            <Shield className="mr-1 h-3 w-3" />
            Administrator
          </Badge>

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10 border-2 border-red-400">
                  <AvatarImage src={typedUser?.profileImage} alt={typedUser?.username} />
                  <AvatarFallback className="bg-red-700 text-white">
                    {typedUser?.username?.slice(0, 2).toUpperCase() || 'AD'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{typedUser?.username}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {typedUser?.email || 'admin@streamvibe.com'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin-profile" className="w-full cursor-pointer">
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>My Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin-settings" className="w-full cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden mt-3 pt-3 border-t border-red-800">
        <div className="grid grid-cols-2 gap-2">
          {navItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={`w-full text-white hover:text-red-100 hover:bg-red-800/50 ${
                    isActive ? 'bg-red-700 text-white' : ''
                  }`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}