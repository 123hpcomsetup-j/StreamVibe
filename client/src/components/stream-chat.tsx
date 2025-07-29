import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Send, 
  MessageCircle, 
  Phone, 
  Video as VideoIcon, 
  Coins,
  X
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { io, Socket } from 'socket.io-client';
import { useAuth } from "@/hooks/useAuth";

interface StreamChatProps {
  streamId: string;
  creatorName: string;
  isVisible: boolean;
  onToggle: () => void;
}

export default function StreamChat({ 
  streamId, 
  creatorName, 
  isVisible, 
  onToggle 
}: StreamChatProps) {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const typedUser = user as any;
  
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Private call request states
  const [isPrivateCallDialogOpen, setIsPrivateCallDialogOpen] = useState(false);
  const [privateCallMessage, setPrivateCallMessage] = useState("");
  const [privateCallDuration, setPrivateCallDuration] = useState(10);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Socket connection for chat
  useEffect(() => {
    const newSocket = io('/', {
      transports: ['websocket'],
      upgrade: true,
    });

    newSocket.on('connect', () => {
      console.log('StreamChat: Socket connected');
      newSocket.emit('join-stream', streamId);
    });

    newSocket.on('chat-message', (data) => {
      console.log('StreamChat: Received chat message:', data);
      setChatMessages(prev => [...prev, data]);
    });

    newSocket.on('disconnect', () => {
      console.log('StreamChat: Socket disconnected');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [streamId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Send chat message
  const sendChatMutation = useMutation({
    mutationFn: async () => {
      if (!message.trim()) return;

      if (isAuthenticated) {
        const response = await apiRequest("POST", "/api/chat", {
          streamId,
          message: message.trim(),
          tipAmount: 0
        });
        return await response.json();
      } else {
        // For guests
        const response = await fetch(`/api/streams/${streamId}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': `guest-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          },
          body: JSON.stringify({
            message: message.trim(),
            tipAmount: 0
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to send message');
        }

        return await response.json();
      }
    },
    onSuccess: () => {
      setMessage("");
    },
    onError: (error: Error) => {
      toast({
        title: "Chat Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Private call request mutation
  const requestPrivateCallMutation = useMutation({
    mutationFn: async () => {
      const requestData = {
        message: privateCallMessage,
        tokenCost: 20, // Default cost
        durationMinutes: privateCallDuration
      };

      if (isAuthenticated) {
        const response = await apiRequest("POST", `/api/streams/${streamId}/private-call-request`, requestData);
        return await response.json();
      } else {
        // Guest request
        const response = await fetch(`/api/streams/${streamId}/private-call-request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': `guest-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          },
          body: JSON.stringify(requestData)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to send private call request');
        }

        return await response.json();
      }
    },
    onSuccess: () => {
      setIsPrivateCallDialogOpen(false);
      setPrivateCallMessage("");
      setPrivateCallDuration(10);
      toast({
        title: "Request Sent!",
        description: `Your private call request has been sent to ${creatorName}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Request Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSendMessage = () => {
    sendChatMutation.mutate();
  };

  const handleRequestPrivateCall = () => {
    requestPrivateCallMutation.mutate();
  };

  if (!isVisible) return null;

  return (
    <Card className="bg-slate-900 border-slate-700 h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3">
        <CardTitle className="text-sm font-medium text-white flex items-center">
          <MessageCircle className="mr-2 h-4 w-4" />
          Live Chat
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="text-slate-400 hover:text-white p-1 h-auto w-auto"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-3 pt-0 min-h-0">
        {/* Chat Messages */}
        <ScrollArea className="flex-1 mb-3">
          <div className="space-y-2">
            {chatMessages.map((msg, index) => (
              <div key={index} className="text-sm">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-blue-400">{msg.senderName}</span>
                  {msg.tipAmount > 0 && (
                    <Badge className="bg-yellow-600 text-white text-xs">
                      <Coins className="mr-1 h-2 w-2" />
                      {msg.tipAmount}
                    </Badge>
                  )}
                </div>
                <p className="text-slate-300 break-words">{msg.message}</p>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* Private Call Request Button */}
        <div className="mb-3">
          <Dialog open={isPrivateCallDialogOpen} onOpenChange={setIsPrivateCallDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="w-full bg-purple-900/30 border-purple-500 text-purple-300 hover:bg-purple-800/50"
              >
                <VideoIcon className="mr-2 h-4 w-4" />
                Request Private Call
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Request Private Call with {creatorName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-300">Duration</Label>
                  <Select value={privateCallDuration.toString()} onValueChange={(value) => setPrivateCallDuration(parseInt(value))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="10">10 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-slate-300">Message (Optional)</Label>
                  <Textarea
                    value={privateCallMessage}
                    onChange={(e) => setPrivateCallMessage(e.target.value)}
                    placeholder="Tell the creator why you'd like a private call..."
                    className="bg-slate-800 border-slate-600 text-white"
                    rows={3}
                  />
                </div>
                
                <div className="text-sm text-slate-400">
                  <div className="flex items-center justify-between">
                    <span>Cost: 20 tokens</span>
                    <Badge className="bg-yellow-600 text-white">
                      <Coins className="mr-1 h-3 w-3" />
                      20
                    </Badge>
                  </div>
                </div>
                
                <Button 
                  onClick={handleRequestPrivateCall}
                  disabled={requestPrivateCallMutation.isPending}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {requestPrivateCallMutation.isPending ? (
                    "Sending Request..."
                  ) : (
                    <>
                      <Phone className="mr-2 h-4 w-4" />
                      Send Request
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Chat Input */}
        <div className="flex space-x-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={isAuthenticated ? 
              `Chat as ${typedUser?.username || 'User'}...` : 
              "Chat as guest..."
            }
            className="flex-1 bg-slate-800 border-slate-600 text-white"
          />
          <Button 
            onClick={handleSendMessage}
            disabled={!message.trim() || sendChatMutation.isPending}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}