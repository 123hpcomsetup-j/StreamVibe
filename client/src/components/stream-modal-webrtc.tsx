import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Gift, Send, Coins } from "lucide-react";
import WebRTCStreamPlayer from "./webrtc-stream-player";
import { useWebRTC } from "@/hooks/useWebRTC";

interface StreamModalProps {
  streamId: string;
  streamData?: any;
  onClose: () => void;
}

export default function StreamModalWebRTC({ streamId, streamData, onClose }: StreamModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chatMessage, setChatMessage] = useState("");
  const [tipAmount, setTipAmount] = useState("");
  const [realViewerCount, setRealViewerCount] = useState(0);

  // WebRTC integration
  const {
    chatMessages,
    sendChatMessage: sendWebRTCMessage,
    sendTip: sendWebRTCTip
  } = useWebRTC({
    streamId,
    userId: user?.id || '',
    username: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Anonymous',
    isCreator: false
  });

  // API tip mutation as backup
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

  const handleSendMessage = () => {
    if (chatMessage.trim()) {
      sendWebRTCMessage(chatMessage);
      setChatMessage("");
    }
  };

  const handleSendTip = () => {
    const amount = parseInt(tipAmount);
    if (amount > 0) {
      // Send via WebRTC for real-time display
      sendWebRTCTip(amount, `Sent ${amount} tokens!`);
      
      // Also send via API for database recording
      sendTipMutation.mutate({
        toUserId: streamData?.creatorId || '',
        tokenAmount: amount,
        streamId,
        purpose: 'tip'
      });
      
      setTipAmount("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-white">{streamData?.title || 'Live Stream'}</h2>
            <p className="text-slate-400">{streamData?.category}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row h-[calc(90vh-80px)]">
          {/* Video Section */}
          <div className="flex-1 p-4">
            <WebRTCStreamPlayer
              streamId={streamId}
              userId={user?.id || ''}
              username={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Anonymous'}
              isCreator={false}
              title={streamData?.title}
              creatorName={streamData?.creatorName}
              onViewerCountChange={setRealViewerCount}
            />

            {/* Stream Info */}
            <div className="mt-4 bg-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <img 
                    src={streamData?.creatorImage || "https://images.unsplash.com/photo-1494790108755-2616b332c3b0?w=64"} 
                    alt="Creator" 
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="font-semibold text-white">{streamData?.creatorName || 'Creator'}</h3>
                    <p className="text-slate-400 text-sm">{realViewerCount} watching</p>
                  </div>
                </div>
                <Badge className="bg-red-500 text-white">
                  <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                  LIVE
                </Badge>
              </div>
            </div>
          </div>

          {/* Chat Section */}
          <div className="w-full lg:w-80 bg-slate-900 flex flex-col">
            <div className="p-4 border-b border-slate-700">
              <h3 className="font-semibold text-white">Live Chat</h3>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((message: any, index: number) => (
                <div key={message.id || index} className="space-y-1">
                  {message.type === 'tip' ? (
                    <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
                      <div className="flex items-center space-x-2 text-yellow-400">
                        <Coins className="h-4 w-4" />
                        <span className="font-semibold">{message.username}</span>
                        <span>tipped {message.amount} tokens</span>
                      </div>
                      {message.message && (
                        <p className="text-yellow-200 text-sm mt-1">{message.message}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-white text-sm">{message.username}</span>
                        <span className="text-xs text-slate-400">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-slate-300 text-sm">{message.message}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-slate-700 space-y-3">
              {/* Quick Tip Buttons */}
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    sendWebRTCTip(5, "Thanks for streaming!");
                    sendTipMutation.mutate({
                      toUserId: streamData?.creatorId || '',
                      tokenAmount: 5,
                      streamId,
                      purpose: 'tip'
                    });
                  }}
                  className="flex-1"
                >
                  <Gift className="h-3 w-3 mr-1" />
                  5
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    sendWebRTCTip(10, "Awesome content!");
                    sendTipMutation.mutate({
                      toUserId: streamData?.creatorId || '',
                      tokenAmount: 10,
                      streamId,
                      purpose: 'tip'
                    });
                  }}
                  className="flex-1"
                >
                  <Gift className="h-3 w-3 mr-1" />
                  10
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    sendWebRTCTip(25, "Keep it up!");
                    sendTipMutation.mutate({
                      toUserId: streamData?.creatorId || '',
                      tokenAmount: 25,
                      streamId,
                      purpose: 'tip'
                    });
                  }}
                  className="flex-1"
                >
                  <Gift className="h-3 w-3 mr-1" />
                  25
                </Button>
              </div>

              {/* Custom Tip */}
              <div className="flex space-x-2">
                <Input
                  placeholder="Tip amount..."
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  type="number"
                  className="flex-1 bg-slate-700 border-slate-600"
                />
                <Button onClick={handleSendTip} disabled={!tipAmount || parseInt(tipAmount) <= 0}>
                  <Gift className="h-4 w-4" />
                </Button>
              </div>

              {/* Chat Message */}
              <div className="flex space-x-2">
                <Input
                  placeholder="Type a message..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 bg-slate-700 border-slate-600"
                />
                <Button onClick={handleSendMessage} disabled={!chatMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}