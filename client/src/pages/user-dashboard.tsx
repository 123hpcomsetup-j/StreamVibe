import { useEffect, useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { 
  Video, 
  Clock, 
  Coins, 
  Users, 
  Send, 
  ArrowLeft,
  Play,
  Heart,
  Settings,
  LogOut
} from "lucide-react";
import type { ChatMessage, Stream, User } from "@shared/schema";

export default function UserDashboard() {
  const [, params] = useRoute("/dashboard/stream/:streamId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [message, setMessage] = useState("");
  const streamId = params?.streamId;

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/user-login");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  // Fetch current stream data
  const { data: currentStream, isLoading: streamLoading } = useQuery({
    queryKey: ["/api/streams", streamId],
    enabled: !!streamId,
  });

  // Fetch other live streams
  const { data: otherStreams = [] } = useQuery({
    queryKey: ["/api/streams/live"],
    refetchInterval: 5000,
  });

  // Fetch chat messages for current stream
  const { data: chatMessages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["/api/streams", streamId, "chat"],
    enabled: !!streamId,
    refetchInterval: 2000,
  });

  // Send chat message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { message: string; tipAmount?: number }) => {
      return await apiRequest("POST", `/api/streams/${streamId}/chat`, {
        message: messageData.message,
        tipAmount: messageData.tipAmount || 0,
      });
    },
    onSuccess: (data, variables) => {
      setMessage("");
      refetchMessages();
      const tipMessage = variables.tipAmount && variables.tipAmount > 0 
        ? ` with ${variables.tipAmount} token tip!`
        : "!";
      toast({
        title: "Message sent" + tipMessage,
        description: variables.tipAmount 
          ? `You tipped ${variables.tipAmount} tokens to the creator.`
          : "Your message was posted to the chat.",
      });
    },
    onError: (error) => {
      toast({
        title: "Message Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const [tipAmount, setTipAmount] = useState(0);
  const [showTipInput, setShowTipInput] = useState(false);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMessageMutation.mutate({ message, tipAmount });
    setTipAmount(0);
    setShowTipInput(false);
  };

  const handleWatchStream = (newStreamId: string) => {
    setLocation(`/dashboard/stream/${newStreamId}`);
  };

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  // Filter out current stream from other streams
  const otherLiveStreams = Array.isArray(otherStreams) 
    ? otherStreams.filter((stream: Stream) => stream.id !== streamId)
    : [];

  if (isLoading || streamLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-white">Loading...</div>
      </div>
    );
  }

  if (!currentStream) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl text-white mb-4">Stream not found</h2>
          <Button onClick={() => setLocation("/home")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                onClick={() => setLocation("/home")}
                className="text-slate-300 hover:text-white"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
              <h1 className="text-xl font-bold text-white">User Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-3">
              <span className="text-slate-300">Welcome, {user?.username}</span>
              <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Current Stream Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Video Player */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-0">
                <div className="relative aspect-video bg-black rounded-t-lg overflow-hidden">
                  {currentStream.isLive ? (
                    <>
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        autoPlay
                        muted
                        poster="/api/placeholder/800/450"
                      />
                      <div className="absolute top-4 left-4">
                        <Badge className="bg-red-500 text-white">
                          <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                          LIVE
                        </Badge>
                      </div>
                      <div className="absolute top-4 right-4">
                        <Badge variant="secondary">
                          <Users className="mr-1 h-3 w-3" />
                          {currentStream.viewerCount || 0}
                        </Badge>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800">
                      <div className="text-center">
                        <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                          <Video className="w-10 h-10 text-slate-400" />
                        </div>
                        <h3 className="text-2xl font-semibold text-white mb-3">Stream Ended</h3>
                        <p className="text-slate-400 mb-4">This stream has finished, but you can still chat and tip the creator!</p>
                        <Badge variant="outline" className="text-slate-300">
                          <Users className="mr-1 h-3 w-3" />
                          {currentStream.viewerCount || 0} viewers still here
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <h2 className="text-xl font-bold text-white mb-2">{currentStream.title}</h2>
                  <div className="flex items-center space-x-4 text-sm text-slate-400">
                    <span>Category: {currentStream.category}</span>
                    <span>•</span>
                    <span>Streamer: {currentStream.creatorName || 'Unknown'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chat Section */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Live Chat
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-80 p-4">
                <div className="space-y-3">
                  {Array.isArray(chatMessages) && chatMessages.map((msg: ChatMessage) => (
                    <div key={msg.id} className="flex flex-col space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400 text-xs">{msg.senderName}</span>
                        {msg.tipAmount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <Coins className="mr-1 h-3 w-3" />
                            {msg.tipAmount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-white text-sm">{msg.message}</p>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-700">
                {showTipInput && (
                  <div className="mb-3 p-3 bg-slate-700/50 rounded-lg">
                    <Label className="text-white text-sm mb-2 block">
                      <Coins className="inline mr-1 h-3 w-3" />
                      Add Tip (tokens)
                    </Label>
                    <div className="flex space-x-2">
                      <Input
                        type="number"
                        min="0"
                        value={tipAmount}
                        onChange={(e) => setTipAmount(parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowTipInput(false)}
                        className="px-3"
                      >
                        Cancel
                      </Button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      ${(currentStream.tokenPrice || 1) * tipAmount} total
                    </p>
                  </div>
                )}
                
                <div className="flex space-x-2">
                  <Input
                    placeholder="Type a message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={sendMessageMutation.isPending}
                    className="bg-slate-700 border-slate-600 text-white flex-1"
                  />
                  {!showTipInput && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowTipInput(true)}
                      className="px-3"
                    >
                      <Coins className="h-4 w-4" />
                    </Button>
                  )}
                  <Button 
                    type="submit" 
                    disabled={!message.trim() || sendMessageMutation.isPending}
                    className="px-3"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                
                {tipAmount > 0 && (
                  <p className="text-xs text-green-400 mt-2">
                    <Coins className="inline mr-1 h-3 w-3" />
                    Will tip {tipAmount} tokens (${(currentStream.tokenPrice || 1) * tipAmount})
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Other Live Streams */}
        {otherLiveStreams.length > 0 && (
          <div>
            <h3 className="text-2xl font-bold text-white mb-6">Other Live Streams</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {otherLiveStreams.map((stream: Stream) => (
                <Card 
                  key={stream.id} 
                  className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors cursor-pointer"
                  onClick={() => handleWatchStream(stream.id)}
                >
                  <CardContent className="p-0">
                    <div className="relative aspect-video bg-black rounded-t-lg overflow-hidden">
                      <img
                        src="/api/placeholder/400/225"
                        alt={stream.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-red-500 text-white text-xs">
                          <div className="w-1.5 h-1.5 bg-white rounded-full mr-1 animate-pulse" />
                          LIVE
                        </Badge>
                      </div>
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="text-xs">
                          <Users className="mr-1 h-2 w-2" />
                          {stream.viewerCount || 0}
                        </Badge>
                      </div>
                      <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button size="sm" className="bg-white/20 hover:bg-white/30">
                          <Play className="mr-2 h-4 w-4" />
                          Watch
                        </Button>
                      </div>
                    </div>
                    <div className="p-4">
                      <h4 className="font-semibold text-white truncate">{stream.title}</h4>
                      <p className="text-sm text-slate-400 truncate">{stream.creatorName || 'Unknown'}</p>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="outline" className="text-xs">
                          {stream.category}
                        </Badge>
                        <div className="flex items-center text-xs text-slate-400">
                          <Coins className="mr-1 h-3 w-3" />
                          ${stream.tokenPrice || 1}/token
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}