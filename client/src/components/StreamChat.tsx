import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MessageCircle, Send, Coins, Gift, Phone, LogIn } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  message: string;
  senderName: string;
  senderRole: string;
  tipAmount: number;
  timestamp: string;
  createdAt: string;
}

interface StreamChatProps {
  streamId: string;
  messages: ChatMessage[];
  isAuthenticated: boolean;
  onSendMessage: (message: string) => void;
  onQuickTip: (amount: number) => void;
  onPrivateCall: () => void;
  onLogin: () => void;
  isLoading?: boolean;
}

export function StreamChat({
  streamId,
  messages,
  isAuthenticated,
  onSendMessage,
  onQuickTip,
  onPrivateCall,
  onLogin,
  isLoading = false
}: StreamChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const [showCustomTipDialog, setShowCustomTipDialog] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      console.log('🔍 StreamChat: Sending message:', messageText);
      console.log('🔍 StreamChat: API endpoint:', `/api/streams/${streamId}/chat`);
      return apiRequest('POST', `/api/streams/${streamId}/chat`, { 
        message: messageText,
        tipAmount: 0 
      });
    },
    onSuccess: (data) => {
      console.log('✅ StreamChat: Message sent successfully:', data);
      setNewMessage('');
      // Don't invalidate queries since WebSocket handles real-time updates
    },
    onError: (error) => {
      console.error('❌ StreamChat: Failed to send message:', error);
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.trim() || sendMessageMutation.isPending) return;
    
    console.log('🔍 StreamChat: handleSendMessage called');
    console.log('🔍 StreamChat: Is authenticated:', isAuthenticated);
    console.log('🔍 StreamChat: Message:', newMessage);
    
    if (isAuthenticated) {
      console.log('✅ StreamChat: User authenticated, sending via API');
      sendMessageMutation.mutate(newMessage);
    } else {
      console.log('❌ StreamChat: User not authenticated, using onSendMessage callback');
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center space-x-2">
          <MessageCircle className="h-5 w-5 text-blue-600" />
          <h3 className="text-black font-semibold text-sm">Live Chat</h3>
          <span className="text-gray-600 text-xs">({messages.length})</span>
        </div>
        
        <div className="flex items-center space-x-2">
          {isAuthenticated ? (
            <>
              {/* Tip Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Coins className="mr-1 h-3 w-3" />
                    Tip
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-white border-gray-200">
                  <DropdownMenuItem 
                    onClick={() => onQuickTip(5)}
                    className="text-black hover:bg-gray-100 cursor-pointer"
                  >
                    <Coins className="mr-2 h-4 w-4 text-blue-600" />
                    5 Tokens
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onQuickTip(10)}
                    className="text-black hover:bg-gray-100 cursor-pointer"
                  >
                    <Coins className="mr-2 h-4 w-4 text-blue-600" />
                    10 Tokens
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onQuickTip(15)}
                    className="text-black hover:bg-gray-100 cursor-pointer"
                  >
                    <Coins className="mr-2 h-4 w-4 text-blue-600" />
                    15 Tokens
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setShowCustomTipDialog(true)}
                    className="text-black hover:bg-gray-100 cursor-pointer"
                  >
                    <Gift className="mr-2 h-4 w-4 text-blue-600" />
                    Custom Amount
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button
                onClick={onPrivateCall}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Phone className="mr-1 h-3 w-3" />
                Call
              </Button>
            </>
          ) : (
            <Button
              onClick={onLogin}
              size="sm"
              variant="outline"
              className="border-gray-300 text-black hover:bg-gray-100"
            >
              <LogIn className="mr-1 h-3 w-3" />
              Login
            </Button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 min-h-0" style={{ minHeight: '300px' }}>
        <ScrollArea className="h-full">
          <div className="p-3 space-y-2" style={{ minHeight: '280px' }}>
            {messages.length === 0 ? (
              <div className="text-center text-gray-600 py-8">
                <MessageCircle className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No recent messages</p>
                <p className="text-xs opacity-75">Start the conversation!</p>
              </div>
            ) : (
              <>
                {messages.length >= 3 && (
                  <div className="text-center text-gray-500 text-xs py-2 border-b border-gray-200 mb-2">
                    Last 3 messages • Real-time updates
                  </div>
                )}
                {messages.map((msg, index) => (
                <div key={msg.id || index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`font-medium text-xs ${
                        msg.senderRole === 'creator' 
                          ? 'text-blue-600' 
                          : msg.senderRole === 'viewer'
                          ? 'text-blue-600'
                          : msg.senderRole === 'admin'
                          ? 'text-blue-600'
                          : msg.senderRole === 'guest'
                          ? 'text-gray-600'
                          : 'text-gray-600'
                      }`}>
                        {msg.senderName}
                      </span>
                      <span className="text-gray-500 text-xs">
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        }) : msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        }) : new Date().toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <p className="text-black text-sm break-words leading-relaxed">
                      {msg.message}
                    </p>
                    {msg.tipAmount > 0 && (
                      <div className="flex items-center mt-2 pt-2 border-t border-gray-300">
                        <Coins className="h-3 w-3 text-blue-600 mr-1" />
                        <span className="text-blue-600 text-xs font-bold">
                          Tipped {msg.tipAmount} tokens!
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                ))}
              </>
            )}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Message Input */}
      <div className="p-3 border-t border-gray-200 bg-white flex-shrink-0">
        {isAuthenticated ? (
          <div className="flex space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="bg-white border-gray-300 text-black flex-1 text-sm"
              disabled={sendMessageMutation.isPending || isLoading}
            />
            <Button 
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sendMessageMutation.isPending || isLoading}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="text-center w-full">
            <p className="text-gray-600 text-sm mb-2">Join the conversation</p>
            <Button 
              onClick={onLogin}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Login to Chat
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}