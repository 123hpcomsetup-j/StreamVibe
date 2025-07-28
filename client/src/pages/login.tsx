import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Video, ShieldCheck, ArrowLeft } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/")}
            className="absolute top-4 left-4 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          
          <h1 className="text-4xl font-bold text-white mb-2">Welcome to StreamVibe</h1>
          <p className="text-slate-400 text-lg">Choose how you want to get started</p>
        </div>

        {/* Login Options */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Viewer Portal */}
          <Card className="bg-slate-800 border-slate-700 hover:border-blue-500 transition-colors cursor-pointer group">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                <Users className="h-8 w-8 text-blue-500" />
              </div>
              <CardTitle className="text-xl text-white">Watch Streams</CardTitle>
              <p className="text-slate-400 text-sm">Join live streams, chat with creators, and be part of the community</p>
            </CardHeader>
            <CardContent className="pt-0">
              <Button 
                onClick={() => setLocation("/user-login")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                Viewer Portal
              </Button>
              <div className="mt-4 text-center">
                <p className="text-slate-500 text-xs mb-2">Features:</p>
                <ul className="text-slate-400 text-xs space-y-1">
                  <li>• Watch live streams</li>
                  <li>• Interactive chat</li>
                  <li>• Tip creators</li>
                  <li>• Join community</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Creator Portal */}
          <Card className="bg-slate-800 border-slate-700 hover:border-purple-500 transition-colors cursor-pointer group">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
                <Video className="h-8 w-8 text-purple-500" />
              </div>
              <CardTitle className="text-xl text-white">Create Content</CardTitle>
              <p className="text-slate-400 text-sm">Start live streaming, build your audience, and monetize your content</p>
            </CardHeader>
            <CardContent className="pt-0">
              <Button 
                onClick={() => setLocation("/creator-login")}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                Creator Portal
              </Button>
              <div className="mt-4 text-center">
                <p className="text-slate-500 text-xs mb-2">Features:</p>
                <ul className="text-slate-400 text-xs space-y-1">
                  <li>• Live streaming</li>
                  <li>• Earn from tips</li>
                  <li>• Analytics dashboard</li>
                  <li>• Community management</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Admin Portal */}
          <Card className="bg-slate-800 border-slate-700 hover:border-red-500 transition-colors cursor-pointer group">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-red-500/20 transition-colors">
                <ShieldCheck className="h-8 w-8 text-red-500" />
              </div>
              <CardTitle className="text-xl text-white">Platform Admin</CardTitle>
              <p className="text-slate-400 text-sm">Manage users, moderate content, and oversee platform operations</p>
            </CardHeader>
            <CardContent className="pt-0">
              <Button 
                onClick={() => setLocation("/admin")}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                Admin Portal
              </Button>
              <div className="mt-4 text-center">
                <p className="text-slate-500 text-xs mb-2">Features:</p>
                <ul className="text-slate-400 text-xs space-y-1">
                  <li>• User management</li>
                  <li>• Content moderation</li>
                  <li>• Analytics & reports</li>
                  <li>• System oversight</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-8">
          <p className="text-slate-500 text-sm">
            New to StreamVibe? Each portal has its own registration process to get you started quickly.
          </p>
        </div>
      </div>
    </div>
  );
}