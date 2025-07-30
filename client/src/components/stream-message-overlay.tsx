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
        isCreator: data.isCreator || false,
        isTip: false
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
        isTip: true
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
    </>
  );
}