import { useEffect, useRef } from 'react';
import flvjs from 'flv.js';

interface NodeMediaPlayerProps {
  streamKey: string;
  serverUrl?: string;
  className?: string;
}

export default function NodeMediaPlayer({ streamKey, serverUrl = '', className = '' }: NodeMediaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<flvjs.Player | null>(null);

  useEffect(() => {
    if (!videoRef.current || !flvjs.isSupported()) {
      console.error('FLV.js is not supported in this browser');
      return;
    }

    // HTTP-FLV URL for Node Media Server
    const flvUrl = `http://${window.location.hostname}:8000/live/${streamKey}.flv`;

    console.log('Attempting to play stream from:', flvUrl);

    // Create FLV player
    const player = flvjs.createPlayer({
      type: 'flv',
      url: flvUrl,
      isLive: true,
    }, {
      enableWorker: false,
      enableStashBuffer: false,
      stashInitialSize: 128,
    });

    playerRef.current = player;

    // Attach to video element
    player.attachMediaElement(videoRef.current);
    player.load();

    // Handle events
    player.on(flvjs.Events.ERROR, (errorType, errorDetail) => {
      console.error('FLV Player Error:', errorType, errorDetail);
    });

    player.on(flvjs.Events.LOADING_COMPLETE, () => {
      console.log('Stream loading complete');
    });

    player.on(flvjs.Events.MEDIA_INFO, (mediaInfo) => {
      console.log('Media Info:', mediaInfo);
    });

    // Attempt to play
    const playPromise = player.play();
    if (playPromise !== undefined) {
      playPromise.catch((error: Error) => {
        console.error('Failed to start playback:', error);
      });
    }

    // Cleanup
    return () => {
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.unload();
        playerRef.current.detachMediaElement();
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [streamKey, serverUrl]);

  return (
    <div className={`relative w-full aspect-video bg-black rounded-lg overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        className="w-full h-full"
        autoPlay
        playsInline
        muted
        controls
      />
      {!flvjs.isSupported() && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-white">
          <p>Your browser doesn't support HTTP-FLV playback</p>
        </div>
      )}
    </div>
  );
}