import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { Button } from "@/components/ui/button";
import { Video, VideoOff, Mic, MicOff, Users, StopCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EnhancedAgoraStreamCreatorProps {
  streamId: string;
  onStreamEnd: () => void;
  viewerCount: number;
}

export function EnhancedAgoraStreamCreator({ streamId, onStreamEnd, viewerCount }: EnhancedAgoraStreamCreatorProps) {
  const { toast } = useToast();
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasVideo, setHasVideo] = useState(true);
  const [hasAudio, setHasAudio] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string>('DISCONNECTED');
  
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const videoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);

  const APP_ID = import.meta.env.VITE_AGORA_APP_ID;

  useEffect(() => {
    if (!isInitializedRef.current && streamId) {
      initializeStreaming();
      isInitializedRef.current = true;
    }

    return () => {
      cleanupStreaming();
    };
  }, [streamId]);

  const initializeStreaming = async () => {
    try {
      console.log('🎥 Initializing enhanced Agora streaming for stream:', streamId);
      setError(null);

      if (!APP_ID) {
        throw new Error('Agora App ID not found in environment');
      }

      console.log('🔧 Using App ID:', APP_ID);

      // Create client with enhanced settings
      const client = AgoraRTC.createClient({ 
        mode: 'live', 
        codec: 'vp8',  // VP8 for better compatibility
        role: 'host'
      });

      clientRef.current = client;

      // Enhanced connection state monitoring
      client.on('connection-state-change', (curState, revState, reason) => {
        console.log('📡 Connection state changed:', { curState, revState, reason });
        setConnectionState(curState);
        
        if (curState === 'DISCONNECTED' && revState === 'CONNECTED') {
          console.log('❌ Connection lost, attempting reconnection...');
          setTimeout(() => {
            if (!isStreaming) {
              initializeStreaming();
            }
          }, 3000);
        }
      });

      // Enhanced error handling
      client.on('exception', (evt) => {
        console.error('🚨 Agora client exception:', evt);
        setError(`Streaming error: ${evt.reason}`);
      });

      // Set client role explicitly
      await client.setClientRole('host');
      console.log('👑 Client role set to host');

      // Request token with enhanced validation
      console.log('🎫 Requesting enhanced token for channel:', streamId);
      const tokenResponse = await apiRequest('POST', '/api/agora/token', {
        channelName: streamId,
        uid: Date.now() % 1000000, // Generate consistent UID
        role: 'host'
      });

      console.log('✅ Enhanced token received:', {
        appId: tokenResponse.appId,
        channelName: tokenResponse.channelName,
        uid: tokenResponse.uid,
        debug: tokenResponse.debug
      });

      // Join channel with enhanced parameters
      console.log('🔗 Joining channel with enhanced validation...');
      await client.join(
        tokenResponse.appId,
        tokenResponse.channelName, // Use cleaned channel name from backend
        tokenResponse.token,
        tokenResponse.uid
      );

      console.log('🎉 Successfully joined channel!');
      setConnectionState('CONNECTED');

      // Create and publish video/audio tracks
      await setupMediaTracks();
      setIsStreaming(true);

      toast({
        title: "Streaming Started",
        description: "You are now live! Viewers can join your stream.",
      });

    } catch (error: any) {
      console.error('❌ Enhanced streaming initialization failed:', error);
      setError(error.message || 'Failed to start streaming');
      setIsStreaming(false);
      
      toast({
        title: "Streaming Failed",
        description: error.message || 'Could not start streaming. Please try again.',
        variant: "destructive",
      });
    }
  };

  const setupMediaTracks = async () => {
    try {
      console.log('🎬 Setting up enhanced media tracks...');

      // Create video track with enhanced settings
      if (hasVideo) {
        const videoTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: {
            width: 1280,
            height: 720,
            frameRate: 30,
            bitrateMin: 600,
            bitrateMax: 1000
          },
          optimizationMode: 'motion' // Better for streaming
        });
        
        videoTrackRef.current = videoTrack;
        
        // Enhanced video container styling
        if (videoContainerRef.current) {
          videoContainerRef.current.innerHTML = '';
          videoTrack.play(videoContainerRef.current);
          
          // Apply enhanced styling to video elements
          setTimeout(() => {
            const videoElements = videoContainerRef.current?.querySelectorAll('video');
            videoElements?.forEach(video => {
              video.style.width = '100%';
              video.style.height = '100%';
              video.style.objectFit = 'cover';
              video.style.borderRadius = '8px';
              video.style.backgroundColor = '#000';
            });
          }, 100);
        }

        await clientRef.current?.publish(videoTrack);
        console.log('✅ Video track published successfully');
      }

      // Create audio track with enhanced settings
      if (hasAudio) {
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          encoderConfig: {
            sampleRate: 48000,
            stereo: true,
            bitrate: 128
          },
          AEC: true, // Acoustic Echo Cancellation
          AGC: true, // Automatic Gain Control
          ANS: true  // Automatic Noise Suppression
        });
        
        audioTrackRef.current = audioTrack;
        await clientRef.current?.publish(audioTrack);
        console.log('✅ Audio track published successfully');
      }

    } catch (error: any) {
      console.error('❌ Media track setup failed:', error);
      throw new Error(`Media setup failed: ${error.message}`);
    }
  };

  const toggleVideo = async () => {
    try {
      if (!videoTrackRef.current) return;

      if (hasVideo) {
        await videoTrackRef.current.setEnabled(false);
        setHasVideo(false);
      } else {
        await videoTrackRef.current.setEnabled(true);
        setHasVideo(true);
      }

      console.log('📹 Video toggled:', hasVideo ? 'OFF' : 'ON');
    } catch (error) {
      console.error('❌ Video toggle failed:', error);
    }
  };

  const toggleAudio = async () => {
    try {
      if (!audioTrackRef.current) return;

      if (hasAudio) {
        await audioTrackRef.current.setEnabled(false);
        setHasAudio(false);
      } else {
        await audioTrackRef.current.setEnabled(true);
        setHasAudio(true);
      }

      console.log('🎤 Audio toggled:', hasAudio ? 'OFF' : 'ON');
    } catch (error) {
      console.error('❌ Audio toggle failed:', error);
    }
  };

  const endStream = async () => {
    try {
      console.log('🛑 Ending enhanced stream...');
      
      await cleanupStreaming();
      setIsStreaming(false);
      setConnectionState('DISCONNECTED');
      
      // Update stream status in backend
      await apiRequest('PATCH', `/api/streams/${streamId}`, {
        isLive: false
      });

      toast({
        title: "Stream Ended",
        description: "Your stream has been stopped successfully.",
      });

      onStreamEnd();
    } catch (error) {
      console.error('❌ Error ending stream:', error);
    }
  };

  const cleanupStreaming = async () => {
    try {
      console.log('🧹 Cleaning up enhanced streaming resources...');

      // Stop and close tracks
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
        videoTrackRef.current.close();
        videoTrackRef.current = null;
      }

      if (audioTrackRef.current) {
        audioTrackRef.current.stop();
        audioTrackRef.current.close();
        audioTrackRef.current = null;
      }

      // Leave channel and cleanup client
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current = null;
      }

      // Clear video container
      if (videoContainerRef.current) {
        videoContainerRef.current.innerHTML = '';
      }

      console.log('✅ Enhanced streaming cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium mb-2">Streaming Error</h3>
          <p className="text-red-600 text-sm mb-3">{error}</p>
          <Button 
            onClick={() => {
              setError(null);
              initializeStreaming();
            }}
            variant="outline"
            size="sm"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Enhanced Video Container */}
      <div className="relative bg-black rounded-lg overflow-hidden" style={{ height: '65vh' }}>
        <div 
          ref={videoContainerRef}
          className="w-full h-full"
          style={{ minHeight: '400px' }}
        />
        
        {/* Enhanced Stream Controls Overlay */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <div className="bg-black/70 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            {viewerCount}
          </div>
          
          <div className="bg-black/70 text-white px-3 py-1 rounded-full text-sm">
            {connectionState}
          </div>
          
          {isStreaming && (
            <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm animate-pulse">
              LIVE
            </div>
          )}
        </div>

        {/* Enhanced Media Controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3">
          <Button
            onClick={toggleVideo}
            variant={hasVideo ? "default" : "destructive"}
            size="sm"
            className="bg-black/70 hover:bg-black/90"
          >
            {hasVideo ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </Button>
          
          <Button
            onClick={toggleAudio}
            variant={hasAudio ? "default" : "destructive"}
            size="sm"
            className="bg-black/70 hover:bg-black/90"
          >
            {hasAudio ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </Button>
          
          <Button
            onClick={endStream}
            variant="destructive"
            size="sm"
            className="bg-red-600 hover:bg-red-700"
          >
            <StopCircle className="w-4 h-4 mr-2" />
            End Stream
          </Button>
        </div>
      </div>

      {/* Enhanced Status Display */}
      {isStreaming && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-green-800 font-medium">Enhanced Streaming Active</h3>
              <p className="text-green-600 text-sm">
                Connection: {connectionState} • Viewers: {viewerCount}
              </p>
            </div>
            <div className="flex items-center gap-2 text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">LIVE</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}