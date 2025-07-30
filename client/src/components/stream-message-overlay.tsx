import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { 
  Coins,
  Gift,
} from "lucide-react";
import { io, Socket } from 'socket.io-client';

interface StreamMessageOverlayProps {
  streamId: string;
  creatorName: string;
  stream: any;
  isGuest?: boolean;
  guestSessionId?: string | null;
  guestTokens?: number;
  onGuestTokenUpdate?: (tokens: number) => void;
  isCreator?: boolean;
}

interface OverlayMessage {
  id: string;
  username: string;
  message: string;
  tipAmount?: number;
  timestamp: Date;
  isCreator?: boolean;
  isTip?: boolean;
  userRole?: string;
  userType?: string;
}

export default function StreamMessageOverlay({ 
  streamId, 
  creatorName, 
  stream,
  isGuest = false,
  guestSessionId,
  guestTokens = 0,
  onGuestTokenUpdate,
  isCreator = false
}: StreamMessageOverlayProps) {
  const [overlayMessages, setOverlayMessages] = useState<OverlayMessage[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Listen for chat messages
    socket.on('chat-message', (data: any) => {
      const newMessage: OverlayMessage = {
        id: Date.now().toString() + Math.random(),
        username: data.username || 'Anonymous',
        message: data.message,
        timestamp: new Date(),
        isCreator: data.isCreator || data.userRole === 'creator',
        isTip: false,
        userRole: data.userRole || 'viewer',
        userType: data.userType || 'user'
      };
      
      setOverlayMessages(prev => [...prev.slice(-4), newMessage]); // Keep last 5 messages
      
      // Auto-remove message after 10 seconds
      setTimeout(() => {
        setOverlayMessages(prev => prev.filter(msg => msg.id !== newMessage.id));
      }, 10000);
    });

    // Listen for tip messages
    socket.on('tip-message', (data: any) => {
      const newTipMessage: OverlayMessage = {
        id: Date.now().toString() + Math.random(),
        username: data.username || 'Anonymous',
        message: data.message || `Tipped ${data.amount} tokens!`,
        tipAmount: data.amount,
        timestamp: new Date(),
        isCreator: false,
        isTip: true,
        userRole: data.userRole || 'viewer',
        userType: data.userType || 'user'
      };
      
      setOverlayMessages(prev => [...prev.slice(-4), newTipMessage]); // Keep last 5 messages
      
      // Auto-remove tip message after 15 seconds (longer for tips)
      setTimeout(() => {
        setOverlayMessages(prev => prev.filter(msg => msg.id !== newTipMessage.id));
      }, 15000);
    });

    // Join the stream room
    socket.emit('join-stream', { streamId });

    return () => {
      socket.off('chat-message');
      socket.off('tip-message');
    };
  }, [socket, streamId]);

  return (
    <>
      {/* Message Overlay - Top of video with high transparency for creators */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
        <div className="p-4 space-y-2 max-h-64 overflow-hidden">
          {overlayMessages.map((msg) => (
            <div 
              key={msg.id}
              className={`
                animate-in slide-in-from-top-2 duration-500
                ${msg.isTip 
                  ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30' 
                  : msg.isCreator 
                    ? 'bg-purple-600/30' 
                    : isCreator
                      ? 'bg-black/20'
                      : 'bg-black/60'
                }
                backdrop-blur-sm rounded-lg p-2 shadow-lg pointer-events-auto
                max-w-sm ml-auto border border-white/10
              `}
            >
              <div className="flex items-center space-x-1">
                {msg.isTip && <Gift className="h-3 w-3 text-white animate-pulse" />}
                {msg.isCreator && <Badge className="bg-purple-700/60 text-white text-xs px-1 py-0">Creator</Badge>}
                <span 
                  className={`text-xs ${
                    msg.isCreator || msg.userRole === 'creator' 
                      ? 'font-bold text-yellow-300 drop-shadow-lg' 
                      : msg.userRole === 'guest'
                        ? 'font-normal text-gray-300'
                        : 'font-medium text-blue-300'
                  }`}
                >
                  {msg.username}
                </span>
              </div>
              <p className="text-white/90 text-xs mt-0.5">{msg.message}</p>
              {msg.tipAmount && (
                <div className="flex items-center mt-1">
                  <Coins className="h-3 w-3 text-yellow-300 mr-1" />
                  <span className="text-yellow-300 text-xs font-bold">{msg.tipAmount} tokens</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}