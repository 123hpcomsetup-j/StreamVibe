import { useEffect, useRef } from 'react';

interface SRSPlayerProps {
  streamId: string;
  serverUrl?: string;
}

export default function SRSPlayer({ streamId, serverUrl = 'http://localhost:8080' }: SRSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    // WebRTC player for SRS
    const script = document.createElement('script');
    script.src = `${serverUrl}/players/js/srs.sdk.js`;
    script.onload = () => {
      // Initialize SRS WebRTC player
      const sdk = new (window as any).SrsRtcPlayerAsync();
      
      // WebRTC URL for SRS
      const url = `webrtc://${window.location.hostname}:8080/live/${streamId}`;
      
      sdk.play(url).then((session: any) => {
        videoRef.current!.srcObject = sdk.stream;
        playerRef.current = session;
        console.log('SRS WebRTC stream connected');
      }).catch((e: any) => {
        console.error('SRS WebRTC error:', e);
        
        // Fallback to HTTP-FLV if WebRTC fails
        if ((window as any).flvjs && (window as any).flvjs.isSupported()) {
          const flvPlayer = (window as any).flvjs.createPlayer({
            type: 'flv',
            url: `${serverUrl}/live/${streamId}.flv`
          });
          flvPlayer.attachMediaElement(videoRef.current!);
          flvPlayer.load();
          flvPlayer.play();
          playerRef.current = flvPlayer;
        }
      });
    };
    
    document.head.appendChild(script);

    return () => {
      if (playerRef.current) {
        if (playerRef.current.stop) playerRef.current.stop();
        if (playerRef.current.destroy) playerRef.current.destroy();
      }
      script.remove();
    };
  }, [streamId, serverUrl]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full"
        autoPlay
        playsInline
        muted
        controls
      />
    </div>
  );
}