import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AgoraStreamCreator from "@/components/agora-stream-creator";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/navbar";

export default function CreatorLiveStudio() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [onlineCount, setOnlineCount] = useState(0);

  // Get stream ID from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const streamId = urlParams.get('streamId');

  // Fetch current stream data
  const { data: currentStream } = useQuery({
    queryKey: ['/api/streams/current'],
    enabled: !!user,
  });

  // Fetch online users count
  const { data: onlineUsers } = useQuery({
    queryKey: ['/api/users/online'],
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (onlineUsers && Array.isArray(onlineUsers)) {
      setOnlineCount(onlineUsers.length);
    }
  }, [onlineUsers]);

  const handleBackToDashboard = () => {
    setLocation('/creator-dashboard');
  };

  const handleStreamStart = (streamId: string) => {
    console.log('Stream started:', streamId);
  };

  const handleStreamStop = () => {
    console.log('Stream stopped, returning to dashboard');
    setLocation('/creator-dashboard');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4 text-white">Loading...</h1>
          <p className="text-slate-400">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!streamId) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4 text-white">Stream Not Found</h1>
          <p className="text-slate-400 mb-4">No stream ID provided. Please create a stream first.</p>
          <Button onClick={() => setLocation('/creator-dashboard')} className="bg-purple-600 hover:bg-purple-700">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Unified Navigation Bar */}
      {user && <Navbar user={user} />}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Live Studio Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToDashboard}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
            
            <div className="flex items-center space-x-2">
              <Badge variant="destructive" className="animate-pulse">
                LIVE
              </Badge>
              <span className="font-semibold text-lg">Live Studio</span>
            </div>
          </div>

          {/* Stream Info */}
          <div className="hidden md:flex items-center space-x-4">
            {currentStream && (currentStream as any).title && (
              <div className="text-center">
                <p className="text-sm font-medium">{(currentStream as any).title}</p>
                <p className="text-xs text-muted-foreground">{(currentStream as any).category}</p>
              </div>
            )}
          </div>

          {/* Viewer Count */}
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{onlineCount}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">online</span>
          </div>
        </div>

        {/* Main Live Studio Content */}
        <div className="flex-1">
          <AgoraStreamCreator
            streamId={streamId}
            userId={(user as any)?.id}
            username={(user as any)?.username}
            onStreamStart={handleStreamStart}
            onStreamStop={handleStreamStop}
          />
        </div>
      </div>
    </div>
  );
}