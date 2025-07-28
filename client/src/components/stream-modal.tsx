import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Users, Volume2, Maximize, Gift, Video, Send } from "lucide-react";
import ChatWidget from "./chat-widget";

interface StreamModalProps {
  streamId: string;
  onClose: () => void;
}

export default function StreamModal({ streamId, onClose }: StreamModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chatMessage, setChatMessage] = useState("");

  // Mock stream data - in a real app this would come from the API
  const streamData = {
    id: streamId,
    title: "Sarah's Art Studio",
    creator: {
      name: "Sarah Miller",
      profileImage: "https://images.unsplash.com/photo-1494790108755-2616b332c3b0?ixlib=rb-4.0.3&auto=format&fit=crop&w=64&h=64",
      followers: "12.5K"
    },
    viewerCount: 2431,
    minTip: 10,
    isLive: true
  };

  const { data: chatMessages = [] } = useQuery({
    queryKey: ["/api/chat", streamId],
    retry: false,
  });

  const sendTipMutation = useMutation({
    mutationFn: async (tipData: { toUserId: string; tokenAmount: number; streamId: string; purpose: string }) => {
      await apiRequest("POST", "/api/transactions", tipData);
    },
    onSuccess: () => {
      toast({
        title: "Tip Sent!",
        description: "Your tip has been sent to the creator.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to send tip. Please try again.",
        variant: "destructive",
      });
    },
  });

  const sendChatMutation = useMutation({
    mutationFn: async (messageData: { streamId: string; message: string }) => {
      await apiRequest("POST", "/api/chat", messageData);
    },
    onSuccess: () => {
      setChatMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/chat", streamId] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSendTip = () => {
    if (!user || ((user as any).walletBalance || 0) < streamData.minTip) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough tokens to send a tip.",
        variant: "destructive",
      });
      return;
    }

    sendTipMutation.mutate({
      toUserId: "creator-id", // In real app, get from stream data
      tokenAmount: streamData.minTip,
      streamId: streamId,
      purpose: "tip"
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    sendChatMutation.mutate({
      streamId: streamId,
      message: chatMessage
    });
  };

  const handlePrivateSession = () => {
    toast({
      title: "Private Session",
      description: "Private session feature coming soon!",
    });
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex">
      {/* Video Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-4 bg-slate-800/50">
          <div className="flex items-center space-x-4">
            <img 
              src={streamData.creator.profileImage} 
              alt="Creator profile" 
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <h3 className="font-bold text-lg text-white">{streamData.title}</h3>
              <div className="flex items-center space-x-3">
                <Badge className="bg-red-500 text-white">
                  {streamData.isLive ? "LIVE" : "OFFLINE"}
                </Badge>
                <span className="text-slate-300">
                  <Users className="mr-1 h-4 w-4 inline" />
                  {streamData.viewerCount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:text-slate-300"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
        
        <div className="flex-1 relative">
          <img 
            src="https://images.unsplash.com/photo-1542751371-adc38448a05e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080" 
            alt="Stream content" 
            className="w-full h-full object-cover"
          />
          
          {/* Stream Controls Overlay */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button 
                  size="sm"
                  className="bg-black/50 hover:bg-black/70 text-white"
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm"
                  className="bg-black/50 hover:bg-black/70 text-white"
                >
                  <Maximize className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button 
                  onClick={handleSendTip}
                  disabled={sendTipMutation.isPending}
                  className="bg-secondary hover:bg-secondary/80"
                >
                  <Gift className="mr-2 h-4 w-4" />
                  {sendTipMutation.isPending ? "Sending..." : "Send Tip"}
                </Button>
                <Button 
                  onClick={handlePrivateSession}
                  className="bg-primary hover:bg-primary/80"
                >
                  <Video className="mr-2 h-4 w-4" />
                  Private Session
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Chat Sidebar */}
      <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h4 className="font-bold text-white">Live Chat</h4>
          <p className="text-slate-400 text-sm">{streamData.viewerCount.toLocaleString()} viewers</p>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <ChatWidget streamId={streamId} messages={chatMessages} />
        </div>
        
        <div className="p-4 border-t border-slate-700">
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <Input
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
            />
            <Button 
              type="submit"
              disabled={sendChatMutation.isPending}
              className="bg-primary hover:bg-primary/80"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
