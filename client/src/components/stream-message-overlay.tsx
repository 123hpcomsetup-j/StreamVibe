import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { useToast } from "@/hooks/use-toast";
import { 
  Send, 
  Coins,
  Heart,
  MessageCircle,
  X,
  Gift,

} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { io, Socket } from 'socket.io-client';
import { useAuth } from "@/hooks/useAuth";

interface StreamMessageOverlayProps {
  streamId: string;
  creatorName: string;
  stream: any;
  isGuest?: boolean;
  guestSessionId?: string | null;
  guestTokens?: number;
  onGuestTokenUpdate?: (tokens: number) => void;
}

interface OverlayMessage {
  id: string;
  username: string;
  message: string;
  tipAmount?: number;
  timestamp: Date;
  isCreator?: boolean;
  isTip?: boolean;
}

export default function StreamMessageOverlay({ 
  streamId, 
  creatorName, 
  stream,
  isGuest = false,
  guestSessionId,
  guestTokens = 0,
  onGuestTokenUpdate
}: StreamMessageOverlayProps) {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const typedUser = user as any;
  
  const [message, setMessage] = useState("");
  const [overlayMessages, setOverlayMessages] = useState<OverlayMessage[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showTipDialog, setShowTipDialog] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [quickTipAmount, setQuickTipAmount] = useState(0);
  const [showMessageInput, setShowMessageInput] = useState(false);

  // Socket connection for live messages
  useEffect(() => {
    const newSocket = io('/', {
      transports: ['websocket', 'polling'],
      upgrade: true,
    });

    newSocket.on('connect', () => {
      console.log('Overlay: Socket connected');
      newSocket.emit('join-stream', { 
        streamId, 
        userId: isGuest ? guestSessionId : typedUser?.id || 'anonymous' 
      });
    });

    newSocket.on('chat-message', (data) => {
      console.log('Overlay: Received chat message:', data);
      const overlayMsg: OverlayMessage = {
        id: Date.now().toString(),
        username: data.senderName || data.username || 'Anonymous',
        message: data.message,
        timestamp: new Date(),
        isCreator: data.senderName === creatorName
      };
      
      setOverlayMessages(prev => [...prev, overlayMsg]);
      
      // Auto-remove message after 8 seconds
      setTimeout(() => {
        setOverlayMessages(prev => prev.filter(msg => msg.id !== overlayMsg.id));
      }, 8000);
    });

    // Handle tip messages
    newSocket.on('tip-message', (data) => {
      console.log('Overlay: Received tip:', data);
      const tipMsg: OverlayMessage = {
        id: Date.now().toString(),
        username: data.username,
        message: `Tipped ${data.amount} tokens!`,
        tipAmount: data.amount,
        timestamp: new Date(),
        isTip: true
      };
      
      setOverlayMessages(prev => [...prev, tipMsg]);
      
      // Keep tip messages longer (12 seconds)
      setTimeout(() => {
        setOverlayMessages(prev => prev.filter(msg => msg.id !== tipMsg.id));
      }, 12000);
    });

    newSocket.on('disconnect', () => {
      console.log('Overlay: Socket disconnected');
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [streamId, creatorName, isGuest, guestSessionId, typedUser?.id]);

  // Send regular message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { message: string; tipAmount?: number }) => {
      if (isGuest && guestSessionId) {
        // Guest message
        return apiRequest("POST", `/api/streams/${streamId}/chat`, {
          message: messageData.message,
          tipAmount: messageData.tipAmount || 0,
        });
      } else if (isAuthenticated && typedUser) {
        // Authenticated user message
        return apiRequest("POST", `/api/streams/${streamId}/chat`, {
          message: messageData.message,
          tipAmount: messageData.tipAmount || 0,
        });
      }
      throw new Error("Not authenticated");
    },
    onSuccess: () => {
      setMessage("");
      if (isGuest && onGuestTokenUpdate && guestTokens > 0) {
        onGuestTokenUpdate(guestTokens - 1);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Message Failed",
        description: error.message || "Could not send message",
        variant: "destructive",
      });
    },
  });

  // Send tip mutation
  const sendTipMutation = useMutation({
    mutationFn: async (tipData: { amount: number; message?: string }) => {
      if (isGuest) {
        throw new Error("Guests cannot send tips. Please sign up to tip creators!");
      }
      
      if (!isAuthenticated || !typedUser) {
        throw new Error("Please log in to send tips");
      }

      // Send tip via socket
      if (socket) {
        socket.emit('tip-message', {
          streamId,
          amount: tipData.amount,
          username: typedUser.username,
          userId: typedUser.id,
          message: tipData.message || `Tipped ${tipData.amount} tokens!`
        });
      }

      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Tip Sent!",
        description: `Successfully tipped ${tipAmount} tokens to ${creatorName}`,
      });
      setShowTipDialog(false);
      setTipAmount(0);
    },
    onError: (error: any) => {
      toast({
        title: "Tip Failed",
        description: error.message || "Could not send tip",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!message.trim()) return;
    
    // Check if guest has tokens
    if (isGuest && guestTokens <= 0) {
      toast({
        title: "No Tokens Left",
        description: "Please sign up to continue chatting",
        variant: "destructive",
      });
      return;
    }

    sendMessageMutation.mutate({ message: message.trim() });
  };

  const handleQuickTip = (amount: number) => {
    if (isGuest) {
      toast({
        title: "Tips Require Account",
        description: "Please sign up to tip creators",
        variant: "destructive",
      });
      return;
    }
    
    setQuickTipAmount(amount);
    sendTipMutation.mutate({ amount });
  };

  const handleCustomTip = () => {
    if (tipAmount < (stream?.minTip || 1)) {
      toast({
        title: "Tip Too Small",
        description: `Minimum tip is ${stream?.minTip || 1} tokens`,
        variant: "destructive",
      });
      return;
    }

    sendTipMutation.mutate({ amount: tipAmount });
  };

  const canSendMessage = isGuest ? guestTokens > 0 : isAuthenticated;
  const minTip = stream?.minTip || 5;

  return (
    <>
      {/* Message Overlay - Top of video */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
        <div className="p-4 space-y-2 max-h-64 overflow-hidden">
          {overlayMessages.map((msg) => (
            <div 
              key={msg.id}
              className={`
                animate-in slide-in-from-top-2 duration-500
                ${msg.isTip 
                  ? 'bg-gradient-to-r from-yellow-500/90 to-orange-500/90' 
                  : msg.isCreator 
                    ? 'bg-purple-600/90' 
                    : 'bg-black/70'
                }
                backdrop-blur-sm rounded-lg p-3 shadow-lg pointer-events-auto
                max-w-md ml-auto
              `}
            >
              <div className="flex items-center space-x-2">
                {msg.isTip && <Gift className="h-4 w-4 text-white animate-pulse" />}
                {msg.isCreator && <Badge className="bg-purple-700 text-white text-xs">Creator</Badge>}
                <span className="font-medium text-white text-sm">{msg.username}</span>
              </div>
              <p className="text-white text-sm mt-1">{msg.message}</p>
              {msg.tipAmount && (
                <div className="flex items-center mt-2">
                  <Coins className="h-3 w-3 text-yellow-300 mr-1" />
                  <span className="text-yellow-300 text-xs font-bold">{msg.tipAmount} tokens</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Action Bar - Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
        <div className="p-4">
          {!showMessageInput ? (
            // Collapsed state - Quick tip buttons and message button
            <div className="flex items-center justify-between pointer-events-auto">
              {/* Quick tip buttons */}
              <div className="flex items-center space-x-2">
                {!isGuest && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleQuickTip(minTip)}
                      className="bg-yellow-500/90 hover:bg-yellow-600 text-black backdrop-blur-sm"
                      disabled={sendTipMutation.isPending}
                    >
                      <Coins className="h-3 w-3 mr-1" />
                      {minTip}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowTipDialog(true)}
                      className="bg-orange-500/90 hover:bg-orange-600 text-white backdrop-blur-sm"
                    >
                      <Heart className="h-3 w-3 mr-1" />
                      Tip
                    </Button>
                  </>
                )}
              </div>

              {/* Message button */}
              <Button
                size="sm"
                onClick={() => setShowMessageInput(true)}
                disabled={!canSendMessage}
                className="bg-blue-500/90 hover:bg-blue-600 text-white backdrop-blur-sm"
              >
                <MessageCircle className="h-3 w-3 mr-1" />
                {isGuest ? `Message (${guestTokens} left)` : 'Message'}
              </Button>
            </div>
          ) : (
            // Expanded state - Message input
            <Card className="bg-black/90 backdrop-blur-sm border-slate-600 pointer-events-auto">
              <CardContent className="p-3">
                <div className="flex items-center space-x-2">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={isGuest ? `Type message (${guestTokens} tokens left)` : "Type your message..."}
                    className="bg-slate-700 border-slate-600 text-white"
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={sendMessageMutation.isPending || !canSendMessage}
                    maxLength={200}
                  />
                  <Button
                    size="sm"
                    onClick={handleSendMessage}
                    disabled={!message.trim() || sendMessageMutation.isPending || !canSendMessage}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Send className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowMessageInput(false);
                      setMessage("");
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                
                {isGuest && guestTokens <= 5 && (
                  <p className="text-yellow-400 text-xs mt-2">
                    Running low on tokens! Sign up to continue chatting.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Custom Tip Dialog */}
      <Dialog open={showTipDialog} onOpenChange={setShowTipDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center">
              <Heart className="mr-2 h-5 w-5 text-red-400" />
              Send Tip to {creatorName}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-slate-300 text-sm">Tip Amount (tokens)</label>
              <Input
                type="number"
                min={minTip}
                value={tipAmount}
                onChange={(e) => setTipAmount(Number(e.target.value))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
                placeholder={`Minimum: ${minTip} tokens`}
              />
            </div>
            
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Minimum Tip: {minTip} tokens</span>
              <span>Your Balance: {typedUser?.walletBalance || 0} tokens</span>
            </div>
            
            {/* Quick tip buttons */}
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTipAmount(minTip)}
                className="flex-1"
              >
                {minTip}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTipAmount(minTip * 2)}
                className="flex-1"
              >
                {minTip * 2}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTipAmount(minTip * 5)}
                className="flex-1"
              >
                {minTip * 5}
              </Button>
            </div>
            
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setShowTipDialog(false)}
                className="flex-1"
                disabled={sendTipMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCustomTip}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                disabled={sendTipMutation.isPending || tipAmount < minTip}
              >
                {sendTipMutation.isPending ? "Sending..." : `Tip ${tipAmount} tokens`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


    </>
  );
}