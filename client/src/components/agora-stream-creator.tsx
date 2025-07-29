import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Square, Video, VideoOff, Mic, MicOff, Users, Send, MessageCircle } from "lucide-react";
import { io, Socket } from 'socket.io-client';
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  UID
} from "agora-rtc-sdk-ng";

interface AgoraStreamCreatorProps {
  streamId: string;
  userId: string;
  username: string;
  onStreamStart?: (streamId: string) => void;
  onStreamStop?: () => void;
}

export default function AgoraStreamCreator({
  streamId,
  userId,
  username,
  onStreamStart,
  onStreamStop
}: AgoraStreamCreatorProps) {
  const { toast } = useToast();
  const [isStreaming, setIsStreaming] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const videoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize Agora client
  useEffect(() => {
    const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
    clientRef.current = client;

    // Set client role to host (broadcaster)
    client.setClientRole("host");

    // Handle user joined/left events
    client.on("user-joined", (user) => {
      console.log("Viewer joined:", user.uid);
      setViewerCount(prev => prev + 1);
    });

    client.on("user-left", (user) => {
      console.log("Viewer left:", user.uid);
      setViewerCount(prev => Math.max(0, prev - 1));
    });

    return () => {
      stopStreaming();
    };
  }, []);

  // Setup chat WebSocket connection - connect immediately, not just when streaming
  useEffect(() => {
    const newSocket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Creator connected to chat server');
      // Join stream room immediately
      newSocket.emit('join-stream', { streamId, userId });
    });

    newSocket.on('disconnect', () => {
      console.log('Creator disconnected from chat server');
    });

    // Listen for chat messages from all users (including viewers)
    newSocket.on('chat-message', (data) => {
      console.log('Creator received chat message:', data);
      setChatMessages(prev => [...prev, data]);
    });

    // Listen for tips
    newSocket.on('tip-message', (data) => {
      console.log('Creator received tip:', data);
      const tipMessage = {
        message: `💰 ${data.username} tipped ${data.amount} tokens!`,
        username: 'System',
        timestamp: data.timestamp,
        tipAmount: data.amount,
        userType: 'system'
      };
      setChatMessages(prev => [...prev, tipMessage]);
    });

    // Listen for viewer count updates from server
    newSocket.on('viewer-count-update', (data) => {
      console.log('Creator received viewer count update:', data);
      if (data.viewerCount !== undefined) {
        setViewerCount(data.viewerCount);
      }
    });

    newSocket.on('stream-update', (data) => {
      console.log('Creator received stream update:', data);
      if (data.viewerCount !== undefined) {
        setViewerCount(data.viewerCount);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [streamId, userId]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const sendMessage = () => {
    if (message.trim() && socket) {
      const messageData = {
        streamId,
        userId,
        username,
        message: message.trim(),
        timestamp: new Date().toISOString(),
        userType: 'creator'
      };

      console.log('Creator sending chat message:', messageData);
      socket.emit('chat-message', messageData);
      setMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const startStreaming = async () => {
    if (!clientRef.current) return;
    
    // Prevent multiple connection attempts
    if (isConnected || isStreaming) {
      console.log("Already connected or streaming");
      return;
    }

    try {
      // Check if we have Agora App ID
      const appId = import.meta.env.VITE_AGORA_APP_ID;
      if (!appId) {
        toast({
          title: "Configuration Required",
          description: "Agora App ID not configured. Please contact support.",
          variant: "destructive",
        });
        return;
      }

      // Convert string userId to number (Agora recommends numeric IDs)
      const numericUserId = Math.abs(userId.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0));
      
      // Create a valid channel name for Agora - use original streamId as-is since Agora supports hyphens
      let channelName = streamId;
      
      // If streamId is empty or invalid, create a unique channel name
      if (!channelName || channelName.trim() === "" || channelName === "undefined") {
        channelName = `stream_${userId}_${Date.now()}`;
      }
      
      // Only ensure reasonable length, keep original format
      channelName = channelName.substring(0, 64);
      
      // Ensure it's not empty after processing
      if (!channelName) {
        channelName = `stream_${Date.now()}`;
      }
      
      console.log('=== CREATOR JOIN ATTEMPT ===');
      console.log('Channel Name:', channelName);
      console.log('Channel Name Length:', channelName.length);
      console.log('Numeric User ID:', numericUserId);
      console.log('App ID:', appId);
      console.log('App ID Length:', appId.length);
      
      // Get Agora token from backend
      const tokenRequestBody = {
        channelName,
        uid: numericUserId,
        role: 'host'
      };
      
      console.log('Token request body:', JSON.stringify(tokenRequestBody, null, 2));
      
      const tokenResponse = await fetch('/api/agora/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tokenRequestBody),
      });
      
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error('Token request failed:', errorData);
        throw new Error('Failed to get Agora token');
      }
      
      const { token } = await tokenResponse.json();
      console.log('Got Agora token (first 20 chars):', token.substring(0, 20) + '...');
      console.log('Attempting to join channel with:');
      console.log('- appId:', appId);
      console.log('- channelName:', channelName);
      console.log('- token (first 20):', token.substring(0, 20) + '...');
      console.log('- uid:', numericUserId);
      
      // Join the channel with proper authentication token
      await clientRef.current.join(appId, channelName, token, numericUserId);
      console.log('=== JOIN SUCCESSFUL ===');
      setIsConnected(true);

      // Create and publish video track
      const videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: {
          width: 1280,
          height: 720,
          frameRate: 30,
          bitrateMax: 1000,
          bitrateMin: 500
        }
      });
      videoTrackRef.current = videoTrack;

      // Create and publish audio track
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      audioTrackRef.current = audioTrack;

      // Publish tracks to Agora
      await clientRef.current.publish([videoTrack, audioTrack]);
      console.log('✅ Successfully published video and audio to Agora');

      // Play video locally
      if (videoContainerRef.current) {
        videoTrack.play(videoContainerRef.current);
      }

      setIsStreaming(true);
      onStreamStart?.(streamId);

      // IMPORTANT: Only emit live status AFTER successful Agora publishing
      if (socket) {
        console.log('🚀 Broadcasting live stream status to all clients:', streamId);
        socket.emit('start-stream', { streamId, userId });
        
        // Also notify about stream being truly live with video
        socket.emit('stream-live-confirmed', { 
          streamId, 
          userId,
          message: 'Creator is now broadcasting video'
        });
      }

      toast({
        title: "Live Stream Started!",
        description: "You are now broadcasting live with video to viewers.",
      });

    } catch (error: any) {
      console.error("Failed to start streaming:", error);
      
      let errorMessage = "Please check camera and microphone permissions.";
      
      if (error.code === "CAN_NOT_GET_GATEWAY_SERVER" && error.message.includes("dynamic use static key")) {
        errorMessage = "Agora configuration updated successfully! Please try streaming again.";
      } else if (error.code === "CAN_NOT_GET_GATEWAY_SERVER") {
        errorMessage = "Agora service temporarily unavailable. Please try again.";
      } else if (error.code === "INVALID_OPERATION") {
        errorMessage = "Connection in progress. Please wait a moment and try again.";
      } else if (error.message.includes("Permission denied")) {
        errorMessage = "Camera/microphone access denied. Please allow permissions and refresh.";
      }
      
      // Reset states on error
      setIsConnected(false);
      setIsStreaming(false);
      
      toast({
        title: "Failed to Start Stream",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopStreaming = async () => {
    try {
      // Unpublish tracks
      if (clientRef.current && (videoTrackRef.current || audioTrackRef.current)) {
        const tracks = [videoTrackRef.current, audioTrackRef.current].filter(Boolean);
        if (tracks.length > 0) {
          await clientRef.current.unpublish(tracks as any);
        }
      }

      // Close tracks
      if (videoTrackRef.current) {
        videoTrackRef.current.close();
        videoTrackRef.current = null;
      }
      if (audioTrackRef.current) {
        audioTrackRef.current.close();
        audioTrackRef.current = null;
      }

      // Leave channel
      if (clientRef.current) {
        await clientRef.current.leave();
      }

      setIsStreaming(false);
      setIsConnected(false);
      setViewerCount(0);
      onStreamStop?.();

      // Emit WebSocket event to notify all clients that stream has ended
      if (socket) {
        console.log('Emitting end-stream event for:', streamId);
        socket.emit('end-stream', { streamId });
      }

      toast({
        title: "Stream Stopped",
        description: "Your live stream has ended.",
      });

    } catch (error: any) {
      console.error("Error stopping stream:", error);
    }
  };

  const toggleVideo = async () => {
    if (videoTrackRef.current) {
      if (isVideoOn) {
        await videoTrackRef.current.setEnabled(false);
      } else {
        await videoTrackRef.current.setEnabled(true);
      }
      setIsVideoOn(!isVideoOn);
    }
  };

  const toggleAudio = async () => {
    if (audioTrackRef.current) {
      if (isAudioOn) {
        await audioTrackRef.current.setEnabled(false);
      } else {
        await audioTrackRef.current.setEnabled(true);
      }
      setIsAudioOn(!isAudioOn);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Stream Controls */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span>Live Stream Controls</span>
              {isStreaming && (
                <Badge variant="secondary" className="bg-red-600 text-white">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-2"></div>
                  LIVE
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Connection Status */}
            {isConnected && (
              <div className="flex items-center text-green-400 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                <span>Connected to Agora - {viewerCount} viewers</span>
              </div>
            )}
            
            {/* Stream Controls */}
            <div className="flex space-x-2">
              {isStreaming ? (
                <>
                  <Button 
                    onClick={stopStreaming}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Square className="mr-2 h-4 w-4" />
                    Stop Stream
                  </Button>
                  <Button 
                    onClick={toggleVideo}
                    variant={isVideoOn ? "secondary" : "destructive"}
                    className="flex-1"
                  >
                    {isVideoOn ? <Video className="mr-2 h-4 w-4" /> : <VideoOff className="mr-2 h-4 w-4" />}
                    {isVideoOn ? "Video On" : "Video Off"}
                  </Button>
                  <Button 
                    onClick={toggleAudio}
                    variant={isAudioOn ? "secondary" : "destructive"}
                    className="flex-1"
                  >
                    {isAudioOn ? <Mic className="mr-2 h-4 w-4" /> : <MicOff className="mr-2 h-4 w-4" />}
                    {isAudioOn ? "Audio On" : "Audio Off"}
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={startStreaming}
                  className="w-full bg-red-500 hover:bg-red-600"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Live Stream
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Video Preview */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Stream Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              ref={videoContainerRef}
              className="relative w-full h-64 bg-slate-900 rounded-lg overflow-hidden"
            >
              {!isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-slate-400">
                    <Video className="h-12 w-12 mx-auto mb-2" />
                    <p>Start streaming to see preview</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Stream Stats */}
            {isStreaming && (
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="bg-slate-700 rounded-lg p-3 text-center">
                  <div className="text-slate-400 text-sm">Viewers</div>
                  <div className="text-white text-xl font-bold flex items-center justify-center">
                    <Users className="w-4 h-4 mr-1" />
                    {viewerCount}
                  </div>
                </div>
                <div className="bg-slate-700 rounded-lg p-3 text-center">
                  <div className="text-slate-400 text-sm">Video</div>
                  <div className="text-white text-xl font-bold">
                    {isVideoOn ? "ON" : "OFF"}
                  </div>
                </div>
                <div className="bg-slate-700 rounded-lg p-3 text-center">
                  <div className="text-slate-400 text-sm">Audio</div>
                  <div className="text-white text-xl font-bold">
                    {isAudioOn ? "ON" : "OFF"}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chat Section */}
      <div className="lg:col-span-1">
        <Card className="bg-slate-800 border-slate-700 h-[600px] flex flex-col">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <MessageCircle className="mr-2 h-5 w-5" />
              Live Chat
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-3">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="h-8 w-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">Chat with your viewers</p>
                  </div>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div key={index} className="text-sm">
                      <div className="flex items-start space-x-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-slate-300">
                              {msg.username || 'Anonymous'}
                            </span>
                            {msg.userType === 'creator' && (
                              <Badge variant="outline" className="text-xs text-purple-400 border-purple-400">
                                Creator
                              </Badge>
                            )}
                          </div>
                          <p className="text-slate-400 mt-1">{msg.message}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
            
            {/* Chat Input */}
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="flex space-x-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Send a message to your viewers..."
                  className="bg-slate-700 border-slate-600 text-white flex-1"
                />
                <Button 
                  onClick={sendMessage}
                  disabled={!message.trim() || !socket}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}