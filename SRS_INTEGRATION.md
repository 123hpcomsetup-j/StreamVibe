# Simple Realtime Server (SRS) Integration Guide

## Why SRS?

SRS is a simple, high-performance real-time streaming server that supports:
- ✅ **WebRTC** (ultra-low latency)
- ✅ **RTMP** (OBS compatible)
- ✅ **HTTP-FLV** (good compatibility)
- ✅ **HLS** (widest compatibility)
- ✅ **Multiple protocols** in one server

## Quick Setup (2 minutes)

### 1. Install SRS
```bash
./setup-srs.sh
```

### 2. Start SRS Server
```bash
cd srs-server && ./objs/srs -c conf/simple.conf
```

### 3. Configure OBS
- **Server**: `rtmp://localhost:1935/live`
- **Stream Key**: Any name (e.g., `stream1`, `test`, etc.)

### 4. Test Streaming
Open in browser: `http://localhost:8080/players/rtc_player.html`
- Enter stream: `live/stream1` (or your stream key)
- Click Play

## Integration with Your Platform

### Option 1: Replace Current WebRTC (Recommended)

In `stream-view.tsx`, replace the WebRTC code with:

```tsx
import SRSPlayer from '@/components/srs-player';

// In your component
<SRSPlayer streamId={streamId} />
```

### Option 2: Update Creator Dashboard

```javascript
// When creator starts streaming
const streamKey = `creator_${userId}`;
toast({
  title: "Stream Started",
  description: `OBS Server: rtmp://your-domain/live, Key: ${streamKey}`,
});

// Store streamKey in database
await updateStream({ streamKey });
```

### Option 3: Hybrid Approach

Keep your UI, use SRS as the media backend:

```javascript
// Check stream status via SRS API
const response = await fetch('http://localhost:1985/api/v1/streams');
const streams = await response.json();
const isLive = streams.streams.some(s => s.name === streamKey);
```

## API Endpoints

### Stream Status
```bash
# Get all active streams
curl http://localhost:1985/api/v1/streams

# Get specific stream info
curl http://localhost:1985/api/v1/streams/[stream-id]
```

### Stream Statistics
```bash
# Get server stats
curl http://localhost:1985/api/v1/summaries
```

## Benefits Over Current Solution

1. **No Socket Issues**: SRS handles all connection management
2. **Multi-Protocol**: Viewers can use WebRTC, HTTP-FLV, or HLS
3. **OBS Native**: Direct RTMP support, no browser limitations
4. **Better Performance**: Written in C++, handles thousands of connections
5. **Proven**: Used by major streaming platforms

## Testing Your Setup

1. **Start OBS** → Stream to `rtmp://localhost:1935/live/test`
2. **Open Multiple Viewers**:
   - WebRTC: `http://localhost:8080/players/rtc_player.html`
   - HTTP-FLV: `http://localhost:8080/players/srs_player.html`
   - HLS: `http://localhost:8080/live/test.m3u8`

All should show your stream with different latencies:
- WebRTC: ~0.5 seconds
- HTTP-FLV: ~1-3 seconds  
- HLS: ~5-10 seconds

## Production Deployment

For Replit deployment, add to your start script:
```bash
# Start SRS in background
cd srs-server && nohup ./objs/srs -c conf/simple.conf &

# Start your app
npm run dev
```

## Troubleshooting

**Port conflicts?**
Edit `srs-server/conf/simple.conf` to change ports

**Can't see stream?**
Check SRS console output and ensure OBS is streaming

**WebRTC not working?**
Use HTTP-FLV as fallback (included in player component)