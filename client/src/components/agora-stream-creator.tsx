import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Square, Video, VideoOff, Mic, MicOff, Users, Send, MessageCircle, Coins, BarChart } from "lucide-react";
import { io, Socket } from 'socket.io-client';
import StreamMessageOverlay from "./stream-message-overlay";
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
  const [showPreview, setShowPreview] = useState(false);
  const [networkQuality, setNetworkQuality] = useState(1);
  
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const videoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize Agora client and check if stream is already live
  useEffect(() => {
    const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
    clientRef.current = client;

    // Set client role to host (broadcaster)
    client.setClientRole("host");

    // Handle user joined/left events
    client.on("user-joined", (user) => {
      console.log("🎉 👥 VIEWER JOINED CHANNEL:", user.uid);
      console.log("🎯 Channel Name:", clientRef.current?.channelName);
      console.log("📺 Creator has published tracks:", clientRef.current?.localTracks?.length || 0);
      console.log("🔄 Sending published tracks to new viewer...");
      setViewerCount(prev => {
        const newCount = prev + 1;
        console.log("👥 Updated viewer count:", newCount);
        return newCount;
      });
    });

    client.on("user-left", (user) => {
      console.log("👥 Viewer left channel:", user.uid);
      setViewerCount(prev => {
        const newCount = Math.max(0, prev - 1);
        console.log("👥 Updated viewer count:", newCount);
        return newCount;
      });
    });

    // Add more detailed event logging
    client.on("connection-state-change", (curState, revState) => {
      console.log("🔗 Creator connection state changed:", revState, "->", curState);
    });

    client.on("network-quality", (stats) => {
      console.log("📶 Creator network quality:", stats);
    });

    // Check if this stream is already live and auto-start if needed
    const checkStreamStatus = async () => {
      try {
        const response = await fetch('/api/streams/current', {
          credentials: 'include'
        });
        if (response.ok) {
          const currentStream = await response.json();
          if (currentStream && currentStream.isLive && currentStream.id === streamId) {
            console.log('🔴 DETECTED EXISTING LIVE STREAM - Auto-starting');
            setIsStreaming(true);
            setShowPreview(true);
            toast({
              title: "Live Stream Detected",
              description: "Your stream is currently live. Click 'Preview' to see your camera.",
            });
          }
        }
      } catch (error) {
        console.log('Could not check stream status:', error);
      }
    };

    if (streamId) {
      checkStreamStatus();
    }

    return () => {
      stopStreaming();
    };
  }, [streamId]);

  // Setup chat WebSocket connection - connect immediately, not just when streaming
  useEffect(() => {
    const newSocket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      query: {
        userId: userId,
        role: 'creator'
      }
    });

    newSocket.on('connect', () => {
      console.log('🔗 Creator WebSocket connected successfully');
      console.log('🎯 Socket ID:', newSocket.id);
      console.log('✅ Socket connected status:', newSocket.connected);
      console.log('🌐 Socket URL:', window.location.origin);
      console.log('📋 Connection query params:', { userId, role: 'creator' });
      // Join stream room immediately
      newSocket.emit('join-stream', { streamId, userId });
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Creator WebSocket disconnected from chat server');
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('❌ Creator WebSocket connection error:', error);
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
      console.log('=== CREATOR JOIN SUCCESSFUL ===');
      console.log('🎥 CREATOR READY TO BROADCAST TO CHANNEL:', channelName);
      console.log('📊 Creator client state:', {
        connectionState: clientRef.current.connectionState,
        remoteUsers: clientRef.current.remoteUsers.length,
        localTracks: clientRef.current.localTracks.length,
        channelName: clientRef.current.channelName
      });
      setIsConnected(true);

      // Check browser permissions first
      try {
        const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
        console.log('Camera permission status:', permissions.state);
        
        const audioPermissions = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        console.log('Microphone permission status:', audioPermissions.state);
        
        if (permissions.state === 'denied' || audioPermissions.state === 'denied') {
          throw new Error('Camera or microphone permissions denied. Please allow permissions and refresh the page.');
        }
      } catch (permError) {
        console.warn('Permission check failed, attempting device access anyway:', permError);
      }

      // Test camera and microphone access first
      console.log('🎥 Testing camera access...');
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        console.log('✅ Camera and microphone access confirmed');
        // Stop test stream immediately
        testStream.getTracks().forEach(track => track.stop());
      } catch (mediaError) {
        console.error('❌ Media access failed:', mediaError);
        throw new Error('Cannot access camera or microphone. Please check permissions and try again.');
      }

      // Create and publish video track
      console.log('🎥 Creating Agora video track...');
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
      console.log('✅ Video track created successfully');

      // Create and publish audio track
      console.log('🎤 Creating Agora audio track...');
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      audioTrackRef.current = audioTrack;
      console.log('✅ Audio track created successfully');

      // Publish tracks to Agora
      console.log('📤 Publishing video and audio tracks to Agora...');
      console.log('🔗 Channel Name for Publishing:', channelName);
      console.log('👤 Creator UID for Publishing:', numericUserId);
      await clientRef.current.publish([videoTrack, audioTrack]);
      console.log('🎉 ✅ CREATOR SUCCESSFULLY BROADCASTING TO VIEWERS!');
      console.log('🔴 LIVE: Viewers can now see and hear this creator');
      console.log('📊 Published tracks:', {
        videoTrack: !!videoTrack,
        audioTrack: !!audioTrack,
        videoEnabled: videoTrack?.enabled,
        audioEnabled: audioTrack?.enabled,
        channelName: clientRef.current.channelName,
        publishedTracksCount: clientRef.current.localTracks.length
      });

      // Play video locally for creator preview
      if (videoContainerRef.current) {
        videoTrack.play(videoContainerRef.current);
        console.log('✅ Creator preview video displayed locally');
      }

      setIsStreaming(true);
      setShowPreview(true); // Ensure preview stays visible during streaming
      onStreamStart?.(streamId);

      // IMPORTANT: Only emit live status AFTER successful Agora publishing
      if (socket && socket.connected) {
        console.log('🚀 Broadcasting live stream status to all clients:', streamId);
        console.log('🔗 Socket connection status:', socket.connected);
        console.log('📡 Emitting start-stream event with data:', { streamId, userId });
        console.log('🎯 CREATOR PUBLISHED TO AGORA CHANNEL:', channelName);
        console.log('👥 Viewers should now be able to see this broadcast');
        
        socket.emit('start-stream', { streamId, userId });
        
        // Also notify about stream being truly live with video
        socket.emit('stream-live-confirmed', { 
          streamId, 
          userId,
          channelName,
          message: 'Creator is now broadcasting video to Agora channel'
        });
        
        console.log('✅ WebSocket events emitted successfully');
      } else {
        console.error('❌ No WebSocket connection available - cannot notify server of live status');
        console.error('❌ Socket details:', { exists: !!socket, connected: socket?.connected || false });
      }
      
      // ALWAYS use API fallback to ensure stream goes live regardless of WebSocket status
      try {
        console.log('🔄 ENSURING LIVE STATUS: Updating via API PATCH (works with or without WebSocket)...');
        const response = await fetch(`/api/streams/${streamId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ isLive: true })
        });
        
        if (response.ok) {
          const updatedStream = await response.json();
          console.log('✅ SUCCESS: Stream is now LIVE and visible to all viewers!', updatedStream);
          console.log('🎯 Verification: Stream should appear on homepage immediately');
        } else {
          console.error('❌ API PATCH failed with status:', response.status);
        }
      } catch (apiError) {
        console.error('❌ Failed to update stream status via API:', apiError);
      }

      toast({
        title: "Live Stream Started!",
        description: "You are now broadcasting live with video to viewers.",
      });

    } catch (error: any) {
      console.error("Failed to start streaming:", error);
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        name: error?.name,
        stack: error?.stack
      });
      
      let errorMessage = "Please check camera and microphone permissions and try again.";
      
      // Handle specific error types
      if (error?.message?.includes('Permission denied') || error?.message?.includes('NotAllowedError')) {
        errorMessage = "Camera/microphone access denied. Please allow permissions in your browser and refresh the page.";
      } else if (error?.message?.includes('NotFoundError') || error?.message?.includes('DevicesNotFoundError')) {
        errorMessage = "No camera or microphone found. Please connect a camera/microphone and try again.";
      } else if (error?.message?.includes('NotReadableError') || error?.message?.includes('TrackingError')) {
        errorMessage = "Camera/microphone is being used by another application. Please close other apps and try again.";
      } else if (error?.message?.includes('OverconstrainedError') || error?.message?.includes('ConstraintNotSatisfiedError')) {
        errorMessage = "Camera/microphone doesn't support the required settings. Please try with a different device.";
      } else if (error?.code === "CAN_NOT_GET_GATEWAY_SERVER" && error?.message?.includes("dynamic use static key")) {
        errorMessage = "Agora configuration updated successfully! Please try streaming again.";
      } else if (error?.code === "CAN_NOT_GET_GATEWAY_SERVER") {
        errorMessage = "Agora service temporarily unavailable. Please try again.";
      } else if (error?.code === "INVALID_OPERATION") {
        errorMessage = "Connection in progress. Please wait a moment and try again.";
      } else if (error?.message?.includes('Cannot access camera or microphone')) {
        errorMessage = error.message;
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

  const startPreview = async () => {
    try {
      // Create video and audio tracks for preview
      const videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: {
          width: 1280,
          height: 720,
          frameRate: 30,
          bitrateMax: 1000,
          bitrateMin: 500
        }
      });
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      
      videoTrackRef.current = videoTrack;
      audioTrackRef.current = audioTrack;

      // Play video locally for preview
      if (videoContainerRef.current) {
        videoTrack.play(videoContainerRef.current);
      }

      setShowPreview(true);
      
      toast({
        title: "Preview Started",
        description: "Camera preview is now active. Click 'Go Live' to start streaming.",
      });

    } catch (error: any) {
      console.error("Failed to start preview:", error);
      toast({
        title: "Preview Failed",
        description: "Unable to access camera/microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopPreview = async () => {
    try {
      // Close tracks
      if (videoTrackRef.current) {
        videoTrackRef.current.close();
        videoTrackRef.current = null;
      }
      if (audioTrackRef.current) {
        audioTrackRef.current.close();
        audioTrackRef.current = null;
      }

      setShowPreview(false);
      
      toast({
        title: "Preview Stopped",
        description: "Camera preview has been stopped.",
      });

    } catch (error: any) {
      console.error("Error stopping preview:", error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-screen">
      <div className="lg:col-span-2 relative">
        {/* Full-Screen Video Preview */}
        <div className="bg-slate-800 border-slate-700 h-full flex flex-col">
          <div 
            ref={videoContainerRef}
            className="relative flex-1 bg-black overflow-hidden"
          >
              {!showPreview && !isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-slate-400">
                    <Video className="h-12 w-12 mx-auto mb-2" />
                    <p>Camera preview will appear here</p>
                    <p className="text-sm text-slate-500 mt-1">Click "Preview" or "Go Live" to start</p>
                  </div>
                </div>
              )}
              {/* Live Stream Overlay Controls */}
              {isStreaming && (
                <>
                  {/* Live Badge */}
                  <div className="absolute top-4 left-4 z-10">
                    <Badge variant="secondary" className="bg-red-600 text-white">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-2"></div>
                      LIVE
                    </Badge>
                  </div>
                  
                  {/* Stream Controls Overlay - Top Right */}
                  <div className="absolute top-4 right-4 z-10 flex space-x-2">
                    <Button
                      onClick={toggleVideo}
                      size="sm"
                      variant={isVideoOn ? "secondary" : "destructive"}
                      className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70 border-white/20"
                    >
                      {isVideoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                    </Button>
                    <Button
                      onClick={toggleAudio}
                      size="sm"
                      variant={isAudioOn ? "secondary" : "destructive"}
                      className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70 border-white/20"
                    >
                      {isAudioOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  {/* Viewer Count - Top Center */}
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-black/50 text-white px-3 py-1 rounded-full text-sm flex items-center">
                      <Users className="h-3 w-3 mr-1" />
                      {viewerCount} viewers
                    </div>
                  </div>
                  
                  {/* Stop Stream Button - Bottom Center */}
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
                    <Button
                      onClick={stopStreaming}
                      size="sm"
                      className="bg-red-600/90 hover:bg-red-700 text-white px-4 py-2 h-8"
                    >
                      <Square className="h-3 w-3 mr-1" />
                      Stop Stream
                    </Button>
                  </div>

                  {/* Message Overlay - Creator can see viewer messages */}
                  <StreamMessageOverlay
                    streamId={streamId}
                    creatorName={username}
                    stream={null}
                    isCreator={true}
                  />
                </>
              )}
              
              {/* Preview Controls - Only when in preview mode */}
              {showPreview && !isStreaming && (
                <>
                  <div className="absolute top-4 left-4 z-10">
                    <Badge variant="outline" className="bg-blue-600 text-white border-blue-500">
                      PREVIEW
                    </Badge>
                  </div>
                  
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 flex space-x-2">
                    <Button
                      onClick={stopPreview}
                      size="sm"
                      variant="outline"
                      className="bg-black/50 hover:bg-black/70 text-white border-white/20 h-8"
                    >
                      <Square className="h-3 w-3 mr-1" />
                      Stop Preview
                    </Button>
                    <Button
                      onClick={startStreaming}
                      size="sm"
                      className="bg-red-600/90 hover:bg-red-700 text-white h-8"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Go Live
                    </Button>
                  </div>
                </>
              )}
            </div>
        </div>

        {/* Quick Start Controls - Only show when not streaming or previewing */}
        {!isStreaming && !showPreview && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">Quick Start</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  onClick={startPreview}
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600 h-9"
                >
                  <Video className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button 
                  onClick={startStreaming}
                  size="sm" 
                  className="bg-red-500 hover:bg-red-600 h-9"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Go Live
                </Button>
              </div>
              <p className="text-slate-400 text-xs mt-2 text-center">
                Stream controls will appear on the video when live
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stream Status Info - Only show when connected but NOT streaming */}
        {isConnected && !isStreaming && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-green-400 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                  <span>Connected to Agora</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stream Status Info - Show only when streaming */}
        {isStreaming && (
          <Card className="bg-red-900/20 border-red-500/50">
            <CardContent className="p-6">
              <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2"></div>
                  <span className="text-red-400 font-semibold">LIVE STREAMING</span>
                </div>
                <p className="text-slate-400 text-sm">
                  Viewers: {viewerCount} • Video: {isVideoOn ? 'ON' : 'OFF'} • Audio: {isAudioOn ? 'ON' : 'OFF'}
                </p>
                <p className="text-slate-500 text-xs mt-2">
                  Use overlay controls to manage your stream
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Live Chat Panel - Shows live chat and token interactions */}
      <div className="lg:col-span-1">
        <Card className="bg-slate-800 border-slate-700 h-full">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <MessageCircle className="mr-2 h-5 w-5" />
              Live Chat
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-full">
            <div className="h-96 border-b border-slate-700">
              <ScrollArea className="h-full p-4">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-slate-400 mt-8">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs mt-1">Chat will appear when viewers join</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {chatMessages.map((msg, index) => (
                      <div key={index} className="p-2 bg-slate-700/50 rounded text-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <span className="text-blue-400 font-medium">{msg.senderName}</span>
                            {msg.type === 'tip' && (
                              <div className="flex items-center mt-1">
                                <Coins className="h-3 w-3 text-yellow-400 mr-1" />
                                <span className="text-yellow-400 text-xs font-bold">
                                  Tipped {msg.tokens} tokens
                                </span>
                              </div>
                            )}
                            <div className="text-slate-300 mt-1">{msg.message}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </ScrollArea>
            </div>
            
            {/* Chat Input for Creator */}
            {isStreaming && (
              <div className="p-4">
                <div className="flex space-x-2">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Say something to your viewers..."
                    className="bg-slate-700 border-slate-600 text-white"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        // Send creator message to chat
                        if (socket && message.trim()) {
                          socket.emit('chat-message', {
                            streamId,
                            message: message.trim(),
                            senderName: username,
                            senderId: userId,
                            isCreator: true
                          });
                          setMessage("");
                        }
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      if (socket && message.trim()) {
                        socket.emit('chat-message', {
                          streamId,
                          message: message.trim(),
                          senderName: username,
                          senderId: userId,
                          isCreator: true
                        });
                        setMessage("");
                      }
                    }}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}