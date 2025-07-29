#!/bin/bash

# Ant Media Server Installation Script for Replit/Ubuntu
set -e

echo "🚀 Setting up Ant Media Server Community Edition..."

# Update system
sudo apt-get update

# Install Java 11 (required for Ant Media)
sudo apt-get install -y openjdk-11-jdk wget

# Set JAVA_HOME
export JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
echo 'export JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64' >> ~/.bashrc

# Download Ant Media Server Community Edition
cd /tmp
wget https://github.com/ant-media/Ant-Media-Server/releases/download/ams-v2.9.0/ant-media-server-community-2.9.0.zip

# Install unzip if not available
sudo apt-get install -y unzip

# Extract and install
unzip ant-media-server-community-2.9.0.zip
sudo mv ant-media-server /usr/local/antmedia

# Set permissions
sudo chown -R $USER:$USER /usr/local/antmedia
sudo chmod +x /usr/local/antmedia/start.sh

# Create systemd service
sudo tee /etc/systemd/system/antmedia.service > /dev/null <<EOF
[Unit]
Description=Ant Media Server
After=network.target

[Service]
Type=forking
User=$USER
Group=$USER
WorkingDirectory=/usr/local/antmedia
ExecStart=/usr/local/antmedia/start.sh
ExecStop=/usr/local/antmedia/stop.sh
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable antmedia
sudo systemctl start antmedia

echo "✅ Ant Media Server installed successfully!"
echo "📱 Web Panel: http://localhost:5080"
echo "📺 RTMP URL: rtmp://localhost/LiveApp"
echo "🔧 Default Stream Key: stream1"

# Wait for service to start
sleep 10

# Check if service is running
if sudo systemctl is-active --quiet antmedia; then
    echo "🟢 Ant Media Server is running!"
else
    echo "🔴 Failed to start Ant Media Server"
    sudo systemctl status antmedia
fi