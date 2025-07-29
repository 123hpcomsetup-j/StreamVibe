#!/bin/bash

# SRS (Simple Realtime Server) Setup for Replit
echo "🚀 Setting up Simple Realtime Server (SRS)..."

# Create directories
mkdir -p srs-server
cd srs-server

# Download pre-built SRS binary (no compilation needed)
echo "📥 Downloading SRS binary..."
wget https://github.com/ossrs/srs/releases/download/v5.0-r0/SRS-CentOS7-x86_64-5.0.168.tar.gz

# Extract
echo "📦 Extracting SRS..."
tar -xzf SRS-CentOS7-x86_64-5.0.168.tar.gz
rm SRS-CentOS7-x86_64-5.0.168.tar.gz

# Create simple configuration
cat > conf/simple.conf << 'EOF'
# Simple SRS configuration for Replit
listen              1935;
max_connections     1000;
daemon              off;
srs_log_tank        console;

http_server {
    enabled         on;
    listen          8080;
    dir             ./objs/nginx/html;
}

http_api {
    enabled         on;
    listen          1985;
    crossdomain     on;
}

stream_caster {
    enabled         on;
    caster          rtc;
    output          rtmp://127.0.0.1/live/[app]/[stream];
    listen          8000;
}

vhost __defaultVhost__ {
    rtc {
        enabled     on;
        # @see https://ossrs.net/lts/zh-cn/docs/v4/doc/webrtc#rtc-to-rtmp
        rtmp_to_rtc on;
        # @see https://ossrs.net/lts/zh-cn/docs/v4/doc/webrtc#rtc
        rtc_to_rtmp on;
    }
    
    http_remux {
        enabled     on;
        mount       [vhost]/[app]/[stream].flv;
    }
    
    hls {
        enabled     on;
    }
}
EOF

echo "✅ SRS setup complete!"
echo ""
echo "📺 To start SRS, run: cd srs-server && ./objs/srs -c conf/simple.conf"
echo ""
echo "🔧 Streaming endpoints:"
echo "  - RTMP: rtmp://localhost:1935/live/stream"
echo "  - WebRTC: http://localhost:8080/players/rtc_player.html"
echo "  - HTTP-FLV: http://localhost:8080/live/stream.flv"
echo "  - HLS: http://localhost:8080/live/stream.m3u8"
echo "  - API: http://localhost:1985/api/v1/streams"