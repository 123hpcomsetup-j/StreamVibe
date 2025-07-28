import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Users, DollarSign, Shield, Video, Heart } from "lucide-react";

export default function Landing() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary">StreamVibe</h1>
            </div>
            <Button 
              onClick={() => setLocation("/login")}
              className="bg-primary hover:bg-primary/80"
            >
              Sign In
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              The Future of 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary"> Live Streaming</span>
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
              Connect with creators, enjoy live streams, and participate in the creator economy with our token-based tipping system.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => setLocation("/user-login")}
                className="bg-primary hover:bg-primary/80 text-lg px-8 py-3"
              >
                <Play className="mr-2 h-5 w-5" />
                Start Watching
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                onClick={() => setLocation("/creator-login")}
                className="border-primary text-primary hover:bg-primary hover:text-white text-lg px-8 py-3"
              >
                <Video className="mr-2 h-5 w-5" />
                Become a Creator
              </Button>
            </div>
          </div>
        </div>

        {/* Decorative background elements */}
        <div className="absolute top-0 -right-4 w-72 h-72 bg-primary/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute -bottom-8 -left-4 w-72 h-72 bg-secondary/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-slate-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Why Choose StreamVibe?
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Experience the next generation of live streaming with advanced features and creator-friendly tools.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-white">Live Streaming</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">
                  High-quality live streaming with real-time chat and interactive features for creators and viewers.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 bg-secondary/20 rounded-lg flex items-center justify-center mb-4">
                  <DollarSign className="h-6 w-6 text-secondary" />
                </div>
                <CardTitle className="text-white">Token Economy</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">
                  Support your favorite creators with our secure token-based tipping system and private sessions.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-accent" />
                </div>
                <CardTitle className="text-white">Safe & Secure</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">
                  Age-verified platform with comprehensive safety measures and content moderation.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-primary mb-2">10K+</div>
              <div className="text-slate-400">Active Users</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-secondary mb-2">500+</div>
              <div className="text-slate-400">Creators</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-accent mb-2">24/7</div>
              <div className="text-slate-400">Live Content</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-yellow-500 mb-2">100%</div>
              <div className="text-slate-400">Secure</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24 bg-gradient-to-r from-primary/20 to-secondary/20">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Join the Community?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Start your streaming journey today and connect with thousands of viewers worldwide.
          </p>
          <div className="space-y-4">
            <Button 
              size="lg" 
              onClick={() => (window.location.href = "/api/login")}
              className="bg-primary hover:bg-primary/80 text-lg px-12 py-4"
            >
              <Heart className="mr-2 h-5 w-5" />
              Get Started - Sign In with Replit
            </Button>
            <div className="text-sm text-slate-400 bg-slate-800/50 p-3 rounded-lg max-w-md mx-auto">
              <p className="font-medium text-slate-300 mb-1">Testing Guide:</p>
              <p>You'll see "StreamConnect" in the authorization dialog - this is our registered OAuth app name in Replit's system. You're still signing into StreamVibe!</p>
              <p className="mt-2 text-xs">For testing different roles, see TESTING.md for role switching instructions.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-bold text-primary mb-4">StreamVibe</h3>
              <p className="text-slate-400 text-sm">The premier platform for live streaming and creator economy.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <div className="space-y-2">
                <a href="#" className="block text-slate-400 hover:text-white text-sm">Terms of Service</a>
                <a href="#" className="block text-slate-400 hover:text-white text-sm">Privacy Policy</a>
                <a href="#" className="block text-slate-400 hover:text-white text-sm">Age Verification</a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Support</h4>
              <div className="space-y-2">
                <a href="#" className="block text-slate-400 hover:text-white text-sm">Help Center</a>
                <a href="#" className="block text-slate-400 hover:text-white text-sm">Grievance Officer</a>
                <a href="#" className="block text-slate-400 hover:text-white text-sm">Report Content</a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Age Verification</h4>
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-sm font-medium">18+ Only</p>
                <p className="text-slate-400 text-xs mt-1">This platform is restricted to users 18 years and older.</p>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-700 mt-8 pt-8 text-center text-slate-400 text-sm">
            <p>&copy; 2025 StreamVibe. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
