import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Heart } from "lucide-react";

interface ChatWidgetProps {
  streamId: string;
}

export default function ChatWidget({ streamId }: ChatWidgetProps) {
  const [message, setMessage] = useState("");

  const handleSendMessage = () => {
    if (message.trim()) {
      console.log("Sending message:", message);
      setMessage("");
    }
  };

  // Mock chat messages
  const mockMessages = [
    { id: 1, user: "Alex", message: "Great stream! 🎨", timestamp: "2 min ago" },
    { id: 2, user: "Sarah", message: "Love the colors!", timestamp: "1 min ago" },
    { id: 3, user: "Mike", message: "Amazing work!", timestamp: "30s ago" },
  ];

  return (
    <div className="bg-slate-800 rounded-lg p-4 h-full flex flex-col">
      <h3 className="font-semibold text-white mb-4">Live Chat</h3>
      
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {mockMessages.map((msg) => (
          <div key={msg.id} className="flex items-start space-x-2">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-white">{msg.user}</span>
                <span className="text-xs text-slate-400">{msg.timestamp}</span>
              </div>
              <p className="text-sm text-slate-300">{msg.message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chat Input */}
      <div className="flex space-x-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-slate-700 border-slate-600 text-white"
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
        />
        <Button onClick={handleSendMessage} size="sm" className="bg-primary hover:bg-primary/90">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}