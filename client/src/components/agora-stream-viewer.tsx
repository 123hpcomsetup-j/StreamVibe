import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Volume2, VolumeX } from "lucide-react";
import AgoraRTC, {
  IAgoraRTCClient,
  IRemoteVideoTrack,
  IRemoteAudioTrack,
  UID
} from "agora-rtc-sdk-ng";

interface AgoraStreamViewerProps {
  streamId: string;
  userId: string;
  username: string;
  creatorName: string;
  title: string;
}

export default function AgoraStreamViewer({
  streamId,
  userId,
  username,
  creatorName,
  title
}: AgoraStreamViewerProps) {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<IRemoteVideoTrack | null>(null);
  const remoteAudioRef = useRef<IRemoteAudioTrack | null>(null);

  // Initialize Agora client
  useEffect(() => {
    const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
    clientRef.current = client;

    // Set client role to audience (viewer)
    client.setClientRole("audience");

    // Handle remote user events
    client.on("user-published", async (user, mediaType) => {
      console.log("Creator started broadcasting:", mediaType);
      
      // Subscribe to the remote user
      await client.subscribe(user, mediaType);
      
      if (mediaType === "video") {
        const remoteVideoTrack = user.videoTrack;
        if (remoteVideoTrack && videoContainerRef.current) {
          remoteVideoTrack.play(videoContainerRef.current);
          remoteVideoRef.current = remoteVideoTrack;
          setHasVideo(true);
        }
      }
      
      if (mediaType === "audio") {
        const remoteAudioTrack = user.audioTrack;
        if (remoteAudioTrack) {
          remoteAudioTrack.play();
          remoteAudioRef.current = remoteAudioTrack;
        }
      }
    });

    client.on("user-unpublished", (user, mediaType) => {
      console.log("Creator stopped broadcasting:", mediaType);
      
      if (mediaType === "video") {
        setHasVideo(false);
        remoteVideoRef.current = null;
      }
      
      if (mediaType === "audio") {
        remoteAudioRef.current = null;
      }
    });

    client.on("user-joined", (user) => {
      setViewerCount(prev => prev + 1);
    });

    client.on("user-left", (user) => {
      setViewerCount(prev => Math.max(0, prev - 1));
    });

    // Connect to stream
    connectToStream();

    return () => {
      disconnect();
    };
  }, [streamId]);

  const connectToStream = async () => {
    if (!clientRef.current) return;

    try {
      setIsLoading(true);
      
      // Check if we have Agora App ID
      const appId = import.meta.env.VITE_AGORA_APP_ID;
      if (!appId) {
        toast({
          title: "Configuration Error",
          description: "Agora App ID not configured. Please contact support.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Join the channel as viewer
      await clientRef.current.join(appId, streamId, null, userId);
      setIsConnected(true);
      setIsLoading(false);

      toast({
        title: "Connected to Stream",
        description: `Now watching ${creatorName}'s live stream`,
      });

    } catch (error: any) {
      console.error("Failed to connect to stream:", error);
      setIsLoading(false);
      toast({
        title: "Connection Failed",
        description: "Unable to connect to the live stream. Please try again.",
        variant: "destructive",
      });
    }
  };

  const disconnect = async () => {
    try {
      if (clientRef.current) {
        await clientRef.current.leave();
      }
      setIsConnected(false);
      setHasVideo(false);
      setViewerCount(0);
    } catch (error: any) {
      console.error("Error disconnecting:", error);
    }
  };

  const toggleMute = () => {
    if (remoteAudioRef.current) {
      if (isMuted) {
        remoteAudioRef.current.play();
      } else {
        remoteAudioRef.current.stop();
      }
      setIsMuted(!isMuted);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-8">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p>Connecting to live stream...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stream Info */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div>
              <div className="text-lg">{title}</div>
              <div className="text-sm text-slate-400">by {creatorName}</div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-red-600 text-white">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-2"></div>
                LIVE
              </Badge>
              <Badge variant="outline" className="border-slate-600 text-slate-300">
                <Users className="w-3 h-3 mr-1" />
                {viewerCount} viewers
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Video Player */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-0">
          <div className="relative">
            <div 
              ref={videoContainerRef}
              className="w-full h-96 bg-slate-900 flex items-center justify-center"
            >
              {!hasVideo && (
                <div className="text-center text-slate-400">
                  {isConnected ? (
                    <div>
                      <div className="text-lg mb-2">🎥</div>
                      <p>Waiting for video...</p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-lg mb-2">📺</div>
                      <p>Stream not available</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Video Controls */}
            {hasVideo && (
              <div className="absolute bottom-4 right-4">
                <Button
                  size="sm"
                  variant={isMuted ? "destructive" : "secondary"}
                  className="bg-black/50 hover:bg-black/70"
                  onClick={toggleMute}
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Connection Status */}
      {isConnected && (
        <div className="text-center">
          <div className="inline-flex items-center text-green-400 text-sm">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
            Connected to Agora Live Stream
          </div>
        </div>
      )}
    </div>
  );
}