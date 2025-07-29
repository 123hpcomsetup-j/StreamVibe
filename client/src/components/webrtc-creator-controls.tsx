import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Play, Square, Video, VideoOff, Mic, MicOff } from "lucide-react";
import WebRTCStreamPlayer from "./webrtc-stream-player";
import { useWebRTC } from "@/hooks/useWebRTC";

interface WebRTCCreatorControlsProps {
  onStreamStart?: (streamId: string) => void;
  onStreamStop?: () => void;
}

export default function WebRTCCreatorControls({ onStreamStart, onStreamStop }: WebRTCCreatorControlsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const [streamData, setStreamData] = useState({
    title: "",
    category: "Art & Design"
  });

  // WebRTC hook for creator
  const webrtc = useWebRTC({
    streamId: currentStreamId || 'temp',
    userId: (user as any)?.id || '',
    username: `${(user as any)?.firstName || ''} ${(user as any)?.lastName || ''}`.trim() || 'Creator',
    isCreator: true
  });

  // Create stream mutation
  const createStreamMutation = useMutation({
    mutationFn: async (data: { title: string; category: string }) => {
      const response = await apiRequest("POST", "/api/streams", {
        title: data.title,
        category: data.category,
        isLive: true,
        streamUrl: `webrtc://${Date.now()}`,
        minTip: 5,
        privateRate: 20
      });
      return response;
    },
    onSuccess: async (streamResponse: any) => {
      const streamId = streamResponse.id;
      setCurrentStreamId(streamId);
      
      try {
        await webrtc.startStreaming();
        setIsStreaming(true);
        
        toast({
          title: "Stream Started!",
          description: "You are now live. Viewers can join your stream.",
        });
        
        onStreamStart?.(streamId);
        queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      } catch (error) {
        console.error("Failed to start WebRTC stream:", error);
        toast({
          title: "Camera/Microphone Access Required",
          description: "Please allow camera and microphone access to start streaming.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create stream. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Stop stream mutation
  const stopStreamMutation = useMutation({
    mutationFn: async () => {
      if (currentStreamId) {
        await apiRequest("PATCH", `/api/streams/${currentStreamId}`, { isLive: false });
      }
    },
    onSuccess: () => {
      webrtc.stopStreaming();
      setIsStreaming(false);
      setCurrentStreamId(null);
      
      toast({
        title: "Stream Ended",
        description: "Your stream has been stopped.",
      });
      
      onStreamStop?.();
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    },
  });

  const handleStartStream = () => {
    if (!streamData.title.trim()) {
      toast({
        title: "Stream Title Required",
        description: "Please enter a title for your stream.",
        variant: "destructive",
      });
      return;
    }
    
    createStreamMutation.mutate(streamData);
  };

  const handleStopStream = () => {
    stopStreamMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Stream Controls */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">WebRTC Live Stream Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Stream Status</span>
            <Badge className={isStreaming ? "bg-red-500" : "bg-gray-500"}>
              {isStreaming ? "LIVE" : "OFFLINE"}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="title">Stream Title</Label>
            <Input
              id="title"
              placeholder="Enter stream title..."
              value={streamData.title}
              onChange={(e) => setStreamData({ ...streamData, title: e.target.value })}
              className="bg-slate-700 border-slate-600"
              disabled={isStreaming}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select 
              value={streamData.category} 
              onValueChange={(value) => setStreamData({ ...streamData, category: value })}
              disabled={isStreaming}
            >
              <SelectTrigger className="bg-slate-700 border-slate-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Art & Design">Art & Design</SelectItem>
                <SelectItem value="Gaming">Gaming</SelectItem>
                <SelectItem value="Music">Music</SelectItem>
                <SelectItem value="Cooking">Cooking</SelectItem>
                <SelectItem value="Education">Education</SelectItem>
                <SelectItem value="Fitness">Fitness</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {webrtc.isConnected && (
            <div className="flex items-center space-x-2 text-sm text-green-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>WebRTC Connected - {webrtc.viewerCount} viewers</span>
            </div>
          )}
          
          {isStreaming ? (
            <Button 
              onClick={handleStopStream}
              className="w-full bg-red-600 hover:bg-red-700"
              disabled={stopStreamMutation.isPending}
            >
              <Square className="mr-2 h-4 w-4" />
              {stopStreamMutation.isPending ? "Stopping..." : "Stop Streaming"}
            </Button>
          ) : (
            <Button 
              onClick={handleStartStream}
              disabled={createStreamMutation.isPending}
              className="w-full bg-red-500 hover:bg-red-600"
            >
              <Play className="mr-2 h-4 w-4" />
              {createStreamMutation.isPending ? "Starting..." : "Start Live Stream"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Live Stream Preview */}
      {isStreaming && currentStreamId && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Live Stream Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <WebRTCStreamPlayer
              streamId={currentStreamId}
              userId={(user as any)?.id || ''}
              username={`${(user as any)?.firstName || ''} ${(user as any)?.lastName || ''}`.trim() || 'Creator'}
              isCreator={true}
              title={streamData.title}
              creatorName={`${(user as any)?.firstName || ''} ${(user as any)?.lastName || ''}`.trim()}
              onViewerCountChange={() => {}}
            />
            
            {/* Stream Stats */}
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-slate-700 rounded-lg p-3">
                <div className="text-slate-400 text-sm">Viewers</div>
                <div className="text-white text-xl font-bold">{webrtc.viewerCount}</div>
              </div>
              <div className="bg-slate-700 rounded-lg p-3">
                <div className="text-slate-400 text-sm">Chat Messages</div>
                <div className="text-white text-xl font-bold">{webrtc.chatMessages.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}