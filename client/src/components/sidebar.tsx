import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, Wallet, Heart, History, Settings, Plus, Video, Crown } from "lucide-react";
import TokenPurchase from "./token-purchase";

export default function Sidebar() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [showTokenPurchase, setShowTokenPurchase] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'favorites', label: 'Favorites', icon: Heart },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      <aside className="w-64 bg-slate-800 border-r border-slate-700 hidden lg:block">
        <div className="p-6">
          <div className="space-y-6">
            {/* User Role Badge */}
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Crown className="h-4 w-4 text-primary" />
                <span className="text-primary font-medium">Viewer</span>
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-left ${
                    activeSection === item.id
                      ? 'text-primary bg-primary/10 border-r-2 border-primary'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Quick Actions */}
            <div className="pt-6 border-t border-slate-700">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Button 
                  onClick={() => setShowTokenPurchase(true)}
                  className="w-full bg-primary hover:bg-primary/80"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Buy Tokens
                </Button>
                <Button 
                  className="w-full bg-secondary hover:bg-secondary/80"
                >
                  <Video className="mr-2 h-4 w-4" />
                  Go Live
                </Button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {showTokenPurchase && (
        <TokenPurchase onClose={() => setShowTokenPurchase(false)} />
      )}
    </>
  );
}
