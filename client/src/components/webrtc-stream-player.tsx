import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Volume2, VolumeX, Maximize, Video, VideoOff } from 'lucide-react';
import { useWebRTC } from '@/hooks/useWebRTC';

interface WebRTCStreamPlayerProps {
  streamId: string;
  userId: string;
  username: string;
  isCreator: boolean;
  title?: string;
  creatorName?: string;
  onViewerCountChange?: (count: number) => void;
}

export default function WebRTCStreamPlayer({
  streamId,
  userId,
  username,
  isCreator,
  title,
  creatorName,
  onViewerCountChange
}: WebRTCStreamPlayerProps) {
  const {
    localStream,
    remoteStreams,
    viewerCount,
    isConnected,
    localVideoRef,
    startStreaming,
    joinStream,
    stopStreaming
  } = useWebRTC({ streamId, userId, username, isCreator });

  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Update viewer count
  useEffect(() => {
    if (onViewerCountChange) {
      onViewerCountChange(viewerCount);
    }
  }, [viewerCount, onViewerCountChange]);

  // Handle remote streams
  useEffect(() => {
    remoteStreams.forEach((stream, peerId) => {
      const videoElement = remoteVideoRefs.current.get(peerId);
      if (videoElement && videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
      }
    });
  }, [remoteStreams]);

  // Auto-join stream for viewers
  useEffect(() => {
    if (!isCreator && isConnected) {
      joinStream();
    }
  }, [isCreator, isConnected, joinStream]);

  const handleToggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
  };

  const handleToggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
  };

  if (!isConnected) {
    return (
      <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Connecting to stream...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-slate-900 rounded-lg overflow-hidden">
      {/* Stream info header */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Badge className="bg-red-500 text-white px-3 py-1">
            <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
            LIVE
          </Badge>
          <Badge variant="secondary" className="bg-black/50 text-white px-3 py-1">
            <Users className="mr-1 h-3 w-3" />
            {viewerCount} watching
          </Badge>
        </div>
        
        {title && (
          <div className="bg-black/50 rounded px-3 py-1">
            <p className="text-white text-sm font-medium">{title}</p>
            {creatorName && (
              <p className="text-white/80 text-xs">{creatorName}</p>
            )}
          </div>
        )}
      </div>

      {/* Video container */}
      <div className="aspect-video relative">
        {isCreator ? (
          /* Creator view - show local stream */
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover bg-slate-800"
          />
        ) : (
          /* Viewer view - show remote streams */
          <div className="w-full h-full bg-slate-800">
            {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
              <video
                key={peerId}
                ref={(el) => {
                  if (el) {
                    remoteVideoRefs.current.set(peerId, el);
                    el.srcObject = stream;
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ))}
            {remoteStreams.size === 0 && (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <Video className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-400">Waiting for stream...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stream controls */}
        {isCreator && (
          <div className="absolute bottom-4 left-4 flex space-x-2">
            <Button
              size="sm"
              variant="secondary"
              className="bg-black/50 hover:bg-black/70"
              onClick={handleToggleMute}
            >
              <Volume2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-black/50 hover:bg-black/70"
              onClick={handleToggleVideo}
            >
              <Video className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Creator controls */}
      {isCreator && !localStream && (
        <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
          <div className="text-center">
            <Video className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <Button
              onClick={startStreaming}
              className="bg-red-500 hover:bg-red-600"
            >
              Start Streaming
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}