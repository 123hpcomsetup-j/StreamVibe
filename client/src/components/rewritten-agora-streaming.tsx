import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { Button } from "@/components/ui/button";
import { Video, VideoOff, Mic, MicOff, Users, StopCircle, RefreshCw, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RewrittenAgoraStreamingProps {
  streamId: string;
  onStreamEnd: () => void;
  viewerCount: number;
}

export function RewrittenAgoraStreaming({ streamId, onStreamEnd, viewerCount }: RewrittenAgoraStreamingProps) {
  const { toast } = useToast();
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasVideo, setHasVideo] = useState(true);
  const [hasAudio, setHasAudio] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string>('DISCONNECTED');
  const [retryCount, setRetryCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const videoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef(false);

  const APP_ID = import.meta.env.VITE_AGORA_APP_ID;

  useEffect(() => {
    if (!initializationRef.current && streamId) {
      initializeRewrittenStreaming();
      initializationRef.current = true;
    }

    return () => {
      cleanupStreaming();
    };
  }, [streamId]);

  const initializeRewrittenStreaming = async () => {
    try {
      console.log('🎯 Initializing rewritten Agora streaming system...');
      setError(null);
      setRetryCount(0);

      if (!APP_ID) {
        throw new Error('Agora App ID not configured in environment');
      }

      // Step 1: Test multiple SDK configurations to find working one
      const configs = [
        { mode: 'live' as const, codec: 'vp8' as const, description: 'Live VP8 (Standard)' },
        { mode: 'live' as const, codec: 'h264' as const, description: 'Live H264 (Alternative)' },
        { mode: 'rtc' as const, codec: 'vp8' as const, description: 'RTC VP8 (Fallback)' }
      ];

      let successfulConfig = null;
      let lastError = null;

      for (const config of configs) {
        try {
          console.log(`🧪 Testing configuration: ${config.description}`);
          
          // Create client with current config
          const client = AgoraRTC.createClient({ 
            mode: config.mode, 
            codec: config.codec 
          });

          // Set role based on mode
          if (config.mode === 'live') {
            await client.setClientRole('host');
          }

          // Request token with specific channel validation
          console.log(`🎫 Requesting token for config: ${config.description}`);
          const tokenData = await requestValidatedToken(config.description);
          
          if (!tokenData || !tokenData.token) {
            throw new Error(`No token received for ${config.description}`);
          }

          setDebugInfo(tokenData.debug);

          // Test connection with this configuration - use cleaned channel name from backend
          console.log(`🔗 Testing connection with: ${config.description}`);
          const cleanedChannelName = tokenData.channelName || tokenData.debug?.cleanedChannelName;
          console.log(`🔗 Using cleaned channel name: ${cleanedChannelName}`);
          
          await client.join(
            tokenData.appId,
            cleanedChannelName,
            tokenData.token,
            tokenData.uid
          );

          console.log(`✅ SUCCESS! Configuration working: ${config.description}`);
          successfulConfig = { config, client, tokenData };
          break;

        } catch (configError: any) {
          console.log(`❌ Configuration failed: ${config.description} - ${configError.message}`);
          lastError = configError;
          
          // Clean up failed client
          try {
            if (clientRef.current) {
              await clientRef.current.leave();
            }
          } catch {}
        }
      }

      if (!successfulConfig) {
        throw new Error(`All configurations failed. Last error: ${lastError?.message || 'Unknown error'}`);
      }

      // Use the successful configuration
      clientRef.current = successfulConfig.client;
      setConnectionState('CONNECTED');

      // Enhanced connection monitoring
      successfulConfig.client.on('connection-state-change', (curState, revState, reason) => {
        console.log(`📡 Connection: ${revState} → ${curState} (${reason})`);
        setConnectionState(curState);
        
        if (curState === 'DISCONNECTED' && isStreaming) {
          console.log('🔄 Connection lost, attempting recovery...');
          setTimeout(() => {
            if (retryCount < 3) {
              setRetryCount(prev => prev + 1);
              initializeRewrittenStreaming();
            }
          }, 3000);
        }
      });

      successfulConfig.client.on('exception', (evt) => {
        console.error('🚨 Client exception:', evt);
        setError(`Streaming error: ${evt.msg}`);
      });

      // Setup media tracks
      await setupRewrittenMediaTracks();
      setIsStreaming(true);

      // Update backend stream status to live
      try {
        await fetch(`/api/streams/${streamId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isLive: true })
        });
        console.log('✅ Stream status updated to live in backend');
      } catch (error) {
        console.error('❌ Failed to update stream status:', error);
      }

      toast({
        title: "Streaming Started Successfully",
        description: `Using ${successfulConfig.config.description} configuration`,
      });

    } catch (error: any) {
      console.error('❌ Rewritten streaming initialization failed:', error);
      setError(error.message || 'Failed to initialize streaming');
      setIsStreaming(false);
      
      // Provide user-friendly error message with solution
      const userMessage = error.message?.includes('invalid token') 
        ? 'Streaming credentials need to be updated. Please check your browser cache or try incognito mode.'
        : error.message || 'Unable to start streaming. Please try again.';
      
      toast({
        title: "Streaming Failed",
        description: userMessage,
        variant: "destructive",
      });
    }
  };

  const requestValidatedToken = async (configDescription: string) => {
    const channelName = streamId;
    const uid = Date.now() % 1000000; // Consistent UID generation
    
    console.log(`🎫 Requesting token for: ${configDescription}`);
    console.log(`   Channel: ${channelName}`);
    console.log(`   UID: ${uid}`);

    try {
      const response = await fetch('/api/agora/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelName,
          uid,
          role: 'host'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token request failed: ${response.status} - ${errorText}`);
      }

      const tokenData = await response.json();

      if (!tokenData || !tokenData.token) {
        throw new Error('Invalid token response from server');
      }

      console.log(`✅ Token received:`, {
        appId: tokenData.appId,
        channelName: tokenData.channelName,
        uid: tokenData.uid,
        tokenLength: tokenData.token?.length || 0,
        debug: tokenData.debug
      });

      return tokenData;
    } catch (fetchError: any) {
      console.error(`❌ Token request error:`, fetchError);
      throw new Error(`Token request failed: ${fetchError.message}`);
    }
  };

  const setupRewrittenMediaTracks = async () => {
    try {
      console.log('🎬 Setting up rewritten media tracks...');

      // Enhanced video track with multiple fallback options
      if (hasVideo) {
        const videoConfigs = [
          {
            encoderConfig: { width: 1280, height: 720, frameRate: 30, bitrateMin: 600, bitrateMax: 1000 },
            optimizationMode: 'motion' as const,
            description: 'HD 720p'
          },
          {
            encoderConfig: { width: 854, height: 480, frameRate: 24, bitrateMin: 400, bitrateMax: 700 },
            optimizationMode: 'detail' as const,
            description: 'SD 480p'
          },
          {
            encoderConfig: { width: 640, height: 360, frameRate: 15, bitrateMin: 200, bitrateMax: 400 },
            optimizationMode: 'motion' as const,
            description: 'Low 360p'
          }
        ];

        let videoTrack = null;
        for (const videoConfig of videoConfigs) {
          try {
            console.log(`🎥 Trying video config: ${videoConfig.description}`);
            videoTrack = await AgoraRTC.createCameraVideoTrack(videoConfig);
            console.log(`✅ Video track created: ${videoConfig.description}`);
            break;
          } catch (videoError) {
            console.log(`❌ Video config failed: ${videoConfig.description}`);
          }
        }

        if (!videoTrack) {
          throw new Error('Failed to create video track with any configuration');
        }

        videoTrackRef.current = videoTrack;
        
        // Enhanced video display with persistent styling
        if (videoContainerRef.current) {
          // Clear container and play video
          videoContainerRef.current.innerHTML = '';
          videoTrack.play(videoContainerRef.current);
          
          // Apply styling immediately and set up persistent monitoring
          const applyVideoStyling = () => {
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
              `;
              
              // Ensure video is visible and playing
              if (video.paused) {
                video.play().catch(console.warn);
              }
            });
          };

          // Apply styling immediately
          setTimeout(applyVideoStyling, 100);
          
          // Monitor and reapply styling every 2 seconds to prevent black screen
          const styleInterval = setInterval(() => {
            if (videoContainerRef.current && isStreaming) {
              applyVideoStyling();
            } else {
              clearInterval(styleInterval);
            }
          }, 2000);
        }

        await clientRef.current?.publish(videoTrack);
        console.log('✅ Video track published');
      }

      // Enhanced audio track
      if (hasAudio) {
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          encoderConfig: {
            sampleRate: 48000,
            stereo: true,
            bitrate: 128
          },
          AEC: true,
          AGC: true,
          ANS: true
        });
        
        audioTrackRef.current = audioTrack;
        await clientRef.current?.publish(audioTrack);
        console.log('✅ Audio track published');
      }

    } catch (error: any) {
      console.error('❌ Media track setup failed:', error);
      throw new Error(`Media setup failed: ${error.message}`);
    }
  };

  const retryConnection = () => {
    setError(null);
    setRetryCount(0);
    initializationRef.current = false;
    initializeRewrittenStreaming();
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
      console.log('🛑 Ending rewritten stream...');
      
      await cleanupStreaming();
      setIsStreaming(false);
      setConnectionState('DISCONNECTED');
      
      // Update stream status in backend
      try {
        await fetch(`/api/streams/${streamId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isLive: false })
        });
      } catch (error) {
        console.error('Failed to update stream status:', error);
      }

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
      console.log('🧹 Cleaning up rewritten streaming...');

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

      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current = null;
      }

      if (videoContainerRef.current) {
        videoContainerRef.current.innerHTML = '';
      }

      console.log('✅ Rewritten streaming cleanup completed');
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
              <h3 className="text-red-800 font-medium mb-2">Streaming Connection Issue</h3>
              <p className="text-red-600 text-sm mb-4">{error}</p>
              
              {retryCount < 3 && (
                <div className="flex gap-2">
                  <Button 
                    onClick={retryConnection}
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Connection
                  </Button>
                </div>
              )}
              
              {retryCount >= 3 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                  <p className="text-yellow-800 text-sm font-medium">Troubleshooting Tips:</p>
                  <ul className="text-yellow-700 text-sm mt-1 space-y-1">
                    <li>• Try refreshing the page (Ctrl+F5)</li>
                    <li>• Use incognito/private browsing mode</li>
                    <li>• Check your internet connection</li>
                    <li>• Ensure camera/microphone permissions are granted</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Rewritten Video Container */}
      <div className="relative bg-black rounded-lg overflow-hidden" style={{ height: '65vh' }}>
        <div 
          ref={videoContainerRef}
          className="creator-video-container w-full h-full"
          style={{ minHeight: '400px' }}
        />
        
        {/* Enhanced Status Overlay */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <div className="bg-black/70 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            {viewerCount}
          </div>
          
          <div className={`px-3 py-1 rounded-full text-sm ${
            connectionState === 'CONNECTED' ? 'bg-green-500/70 text-white' : 'bg-red-500/70 text-white'
          }`}>
            {connectionState}
          </div>
          
          {isStreaming && (
            <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm animate-pulse">
              LIVE
            </div>
          )}
          
          {retryCount > 0 && (
            <div className="bg-yellow-500/70 text-white px-2 py-1 rounded-full text-xs">
              Retry {retryCount}
            </div>
          )}
        </div>

        {/* Media Controls */}
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
            className="bg-red-600/70 hover:bg-red-700/90"
          >
            <StopCircle className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Status Display */}
      {isStreaming && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-green-800 font-medium">Rewritten Streaming System Active</h3>
              <p className="text-green-600 text-sm">
                Status: {connectionState} • Viewers: {viewerCount}
                {debugInfo && ` • Config: ${debugInfo.cleanedChannelName || 'Default'}`}
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