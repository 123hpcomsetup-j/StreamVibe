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
      {/* Desktop Sidebar */}
      <aside className="w-56 xl:w-64 bg-slate-800 border-r border-slate-700 hidden lg:block">
        <div className="p-4 xl:p-6">
          <div className="space-y-4 xl:space-y-6">
            {/* User Role Badge */}
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-2.5 xl:p-3">
              <div className="flex items-center space-x-2">
                <Crown className="h-3.5 w-3.5 xl:h-4 xl:w-4 text-primary" />
                <span className="text-primary font-medium text-sm xl:text-base">Viewer</span>
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-1.5 xl:space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center space-x-2.5 xl:space-x-3 px-3 xl:px-4 py-2.5 xl:py-3 rounded-lg transition-colors text-left text-sm xl:text-base ${
                    activeSection === item.id
                      ? 'text-primary bg-primary/10 border-r-2 border-primary'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <item.icon className="h-4 w-4 xl:h-5 xl:w-5" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Quick Actions */}
            <div className="pt-4 xl:pt-6 border-t border-slate-700">
              <h3 className="text-xs xl:text-sm font-medium text-slate-400 mb-2.5 xl:mb-3">Quick Actions</h3>
              <div className="space-y-1.5 xl:space-y-2">
                <Button 
                  onClick={() => setShowTokenPurchase(true)}
                  className="w-full bg-primary hover:bg-primary/80 text-sm xl:text-base h-9 xl:h-10"
                >
                  <Plus className="mr-1.5 xl:mr-2 h-3.5 w-3.5 xl:h-4 xl:w-4" />
                  Buy Tokens
                </Button>
                <Button 
                  className="w-full bg-secondary hover:bg-secondary/80 text-sm xl:text-base h-9 xl:h-10"
                >
                  <Video className="mr-1.5 xl:mr-2 h-3.5 w-3.5 xl:h-4 xl:w-4" />
                  Go Live
                </Button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation - Alternative to sidebar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 z-40">
        <div className="grid grid-cols-5 gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex flex-col items-center justify-center py-2 px-1 transition-colors ${
                activeSection === item.id
                  ? 'text-primary bg-primary/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <item.icon className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {showTokenPurchase && (
        <TokenPurchase onClose={() => setShowTokenPurchase(false)} />
      )}
    </>
  );
}
