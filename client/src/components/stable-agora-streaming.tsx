import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { Button } from "@/components/ui/button";
import { Video, VideoOff, Mic, MicOff, Users, StopCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StableAgoraStreamingProps {
  streamId: string;
  onStreamEnd: () => void;
  viewerCount: number;
}

export function StableAgoraStreaming({ streamId, onStreamEnd, viewerCount }: StableAgoraStreamingProps) {
  const { toast } = useToast();
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasVideo, setHasVideo] = useState(true);
  const [hasAudio, setHasAudio] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string>('DISCONNECTED');
  const [channelInfo, setChannelInfo] = useState<{channelName: string, uid: number} | null>(null);
  
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const videoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef(false);
  const videoStyleIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const APP_ID = import.meta.env.VITE_AGORA_APP_ID;

  useEffect(() => {
    if (!initializationRef.current && streamId) {
      initializeStableStreaming();
      initializationRef.current = true;
    }

    return () => {
      cleanupStreaming();
    };
  }, [streamId]);

  const initializeStableStreaming = async () => {
    try {
      console.log('🎯 Initializing stable Agora streaming...');
      setError(null);
      setConnectionState('CONNECTING');

      if (!APP_ID) {
        throw new Error('Agora App ID not configured');
      }

      // Create optimized client for better stability
      const client = AgoraRTC.createClient({ 
        mode: 'live',
        codec: 'vp8'
      });

      clientRef.current = client;

      // Enhanced error handling for better debugging
      client.on('connection-state-change', (curState, revState) => {
        console.log(`📡 Connection: ${revState} → ${curState}`);
        setConnectionState(curState);
      });

      client.on('exception', (evt) => {
        console.log('🚨 Client exception:', evt);
        // Don't show video bitrate warnings as errors - they're normal
        if (evt.code !== 1003) {
          setError(`Streaming issue: ${evt.msg}`);
        }
      });

      // Set client role for broadcasting
      await client.setClientRole('host');

      // Generate token for authentication
      const tokenResponse = await fetch('/api/agora/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelName: streamId,
          role: 'host',
          uid: Math.floor(Math.random() * 1000000)
        })
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get streaming token');
      }

      const { token, channelName: cleanChannelName, uid: validUid } = await tokenResponse.json();

      // Store channel info for consistent usage
      setChannelInfo({ channelName: cleanChannelName, uid: validUid });

      // Join channel with proper authentication using cleaned channel name and validated UID
      await client.join(APP_ID, cleanChannelName, token, validUid);
      console.log('✅ Successfully joined Agora channel:', cleanChannelName, 'with UID:', validUid);

      // Setup media tracks with optimized settings
      await setupOptimizedMediaTracks();

      // Update stream status to live
      await updateStreamStatus(true);

      console.log('🎯 Setting isStreaming to true - stop stream button should now be visible');
      setIsStreaming(true);
      setConnectionState('CONNECTED');

      toast({
        title: "Stream Started",
        description: "You are now live! Viewers can see your stream.",
      });

    } catch (error: any) {
      console.error('❌ Streaming initialization failed:', error);
      setError(error.message);
      setConnectionState('FAILED');
      
      toast({
        title: "Streaming Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const setupOptimizedMediaTracks = async () => {
    try {
      console.log('🎬 Setting up optimized media tracks...');

      // Create video track with stable settings
      if (hasVideo) {
        const videoTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: {
            width: 1280,
            height: 720,
            frameRate: 30,
            bitrateMin: 400,
            bitrateMax: 1000
          },
          optimizationMode: 'detail'
        });

        videoTrackRef.current = videoTrack;
        
        // Enhanced video display with persistent styling
        if (videoContainerRef.current) {
          videoContainerRef.current.innerHTML = '';
          videoTrack.play(videoContainerRef.current);
          
          // Apply and maintain video styling
          const ensureVideoVisibility = () => {
            const videoElements = videoContainerRef.current?.querySelectorAll('video');
            videoElements?.forEach(video => {
              video.style.cssText = `
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
                border-radius: 8px !important;
                background-color: #000 !important;
                position: relative !important;
                z-index: 1 !important;
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
              `;
              
              // Ensure video is playing
              if (video.paused) {
                video.play().catch(() => {});
              }
            });
          };

          // Apply styling immediately and maintain it
          setTimeout(ensureVideoVisibility, 100);
          
          // Set up persistent monitoring to prevent black screen
          videoStyleIntervalRef.current = setInterval(() => {
            if (videoContainerRef.current && isStreaming) {
              ensureVideoVisibility();
            }
          }, 3000); // Check every 3 seconds
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
            bitrate: 64 // Reduced bitrate for stability
          },
          AEC: true,
          AGC: true,
          ANS: true
        });
        
        audioTrackRef.current = audioTrack;
        await clientRef.current?.publish(audioTrack);
        console.log('✅ Audio track published successfully');
      }

    } catch (error) {
      console.error('❌ Media track setup failed:', error);
      throw new Error('Failed to setup camera/microphone');
    }
  };

  const updateStreamStatus = async (isLive: boolean) => {
    try {
      const response = await fetch(`/api/streams/${streamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLive })
      });

      if (!response.ok) {
        throw new Error('Failed to update stream status');
      }

      console.log(`✅ Stream status updated to ${isLive ? 'live' : 'offline'}`);
    } catch (error) {
      console.error('Failed to update stream status:', error);
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
    } catch (error) {
      console.error('❌ Audio toggle failed:', error);
    }
  };

  const endStream = async () => {
    try {
      console.log('🛑 Ending stable stream...');
      
      await cleanupStreaming();
      await updateStreamStatus(false);
      
      setIsStreaming(false);
      setConnectionState('DISCONNECTED');

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
      console.log('🧹 Cleaning up stable streaming...');

      // Clear video styling interval
      if (videoStyleIntervalRef.current) {
        clearInterval(videoStyleIntervalRef.current);
        videoStyleIntervalRef.current = null;
      }

      // Cleanup video track
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
        videoTrackRef.current.close();
        videoTrackRef.current = null;
      }

      // Cleanup audio track
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

      console.log('✅ Stable streaming cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-red-800 font-medium mb-2">Streaming Error</h3>
              <p className="text-red-600 text-sm mb-4">{error}</p>
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    setError(null);
                    initializationRef.current = false;
                    initializeStableStreaming();
                  }}
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  Try Again
                </Button>
                <Button 
                  onClick={onStreamEnd}
                  variant="outline"
                  size="sm"
                  className="border-gray-300"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stable Video Container with Anti-Black-Screen Protection */}
      <div className="relative bg-black rounded-lg overflow-hidden" style={{ height: '65vh' }}>
        <div 
          ref={videoContainerRef}
          className="creator-video-container w-full h-full"
          style={{ minHeight: '400px' }}
        />
        
        {/* Status Overlay */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <div className="bg-black/70 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            {viewerCount}
          </div>
          
          <div className={`px-3 py-1 rounded-full text-sm ${
            connectionState === 'CONNECTED' ? 'bg-green-500/70 text-white' : 
            connectionState === 'CONNECTING' ? 'bg-yellow-500/70 text-white' :
            'bg-red-500/70 text-white'
          }`}>
            {connectionState}
          </div>
          
          {isStreaming && (
            <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm animate-pulse">
              LIVE
            </div>
          )}
        </div>

        {/* STOP STREAM Button - Top Right for Maximum Visibility */}
        <div className="absolute top-4 left-4 z-50">
          <Button
            onClick={endStream}
            variant="destructive"
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white border-0 shadow-lg font-semibold"
          >
            <StopCircle className="w-5 h-5 mr-2" />
            STOP STREAM
          </Button>
        </div>

        {/* Media Controls - Bottom Center */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3 z-50">
          <Button
            onClick={toggleVideo}
            variant={hasVideo ? "default" : "destructive"}
            size="sm"
            className="bg-black/70 hover:bg-black/90 text-white border-0"
          >
            {hasVideo ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </Button>
          
          <Button
            onClick={toggleAudio}
            variant={hasAudio ? "default" : "destructive"}
            size="sm"
            className="bg-black/70 hover:bg-black/90 text-white border-0"
          >
            {hasAudio ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Status Display */}
      {isStreaming && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-green-800 font-medium">Stable Streaming Active</h3>
              <p className="text-green-600 text-sm">
                Status: {connectionState} • Viewers: {viewerCount} • High Quality Video
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