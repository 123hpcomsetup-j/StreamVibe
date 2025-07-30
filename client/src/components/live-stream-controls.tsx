import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Users, AlertTriangle } from "lucide-react";

interface LiveStreamControlsProps {
  streamId?: string;
  onStreamStart?: (streamId: string) => void;
  onStreamStop?: () => void;
}

export default function LiveStreamControls({ streamId, onStreamStart, onStreamStop }: LiveStreamControlsProps) {
  const { toast } = useToast();
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);

  // DISABLED: WebRTC implementation replaced by Agora components

  if (streamId) {
    setCurrentStreamId(streamId);
  }

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('WebRTC signaling server connected');
      setConnectionStatus('connected');
      setSocket(newSocket);
    });

    newSocket.on('disconnect', () => {
      console.log('WebRTC signaling server disconnected');
      setConnectionStatus('disconnected');
    });

    newSocket.on('viewer-count-update', (data: { count: number }) => {
      setViewerCount(data.count);
    });

    newSocket.on('viewer-joined', (data: { viewerId: string, userId: string, viewerCount: number }) => {
      console.log(`New viewer joined: ${data.userId}, creating peer connection`);
      setViewerCount(data.viewerCount);
      
      // Create peer connection for new viewer
      createPeerConnection(data.viewerId);
    });

    // Listen for new chat messages
    newSocket.on('chat-message', (message: any) => {
      setChatMessages(prev => [...prev, message]);
    });

    // Handle WebRTC signaling responses
    newSocket.on('answer', async (data: { answer: RTCSessionDescriptionInit, senderId: string }) => {
      console.log('Creator received answer from viewer');
      const peerConnection = peersRef.current.get(data.senderId);
      if (peerConnection) {
        try {
          await peerConnection.setRemoteDescription(data.answer);
        } catch (error) {
          console.error('Error setting remote description:', error);
        }
      }
    });

    newSocket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit, senderId: string }) => {
      const peerConnection = peersRef.current.get(data.senderId);
      if (peerConnection) {
        try {
          await peerConnection.addIceCandidate(data.candidate);
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.off('viewer-joined');
      newSocket.off('answer');
      newSocket.off('ice-candidate');
      newSocket.off('chat-message');
      newSocket.close();
    };
  }, []);

  // Get media stream
  const getMediaStream = async () => {
    try {
      setConnectionStatus('connecting');
      
      const constraints = {
        video: {
          width: streamQuality === '1080p' ? { ideal: 1920 } : { ideal: 1280 },
          height: streamQuality === '1080p' ? { ideal: 1080 } : { ideal: 720 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      
      // Display local stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setConnectionStatus('connected');
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setConnectionStatus('disconnected');
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          toast({
            title: "Camera/Microphone Permission Denied",
            description: "Please allow camera and microphone access to start streaming.",
            variant: "destructive"
          });
        } else if (error.name === 'NotFoundError') {
          toast({
            title: "Media Devices Not Found",
            description: "No camera or microphone found. Please connect media devices.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Media Access Error",
            description: "Failed to access camera/microphone. Please check your devices.",
            variant: "destructive"
          });
        }
      }
      throw error;
    }
  };

  // Create peer connection
  const createPeerConnection = async (viewerId: string) => {
    if (!localStream || !socket) return;

    const peerConnection = new RTCPeerConnection(rtcConfiguration);
    peersRef.current.set(viewerId, peerConnection);

    // Add local stream tracks to peer connection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          candidate: event.candidate,
          targetId: viewerId,
          streamId: currentStreamId
        });
      }
    };

    // Create and send offer
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      socket.emit('offer', {
        offer,
        targetId: viewerId,
        streamId: currentStreamId
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  // Load chat messages
  const loadChatMessages = async () => {
    if (!streamId) return;
    
    try {
      const response = await fetch(`/api/streams/${streamId}/chat`, {
        credentials: 'include'
      });
      const messages = await response.json();
      setChatMessages(messages);
    } catch (error) {
      console.error('Failed to load chat messages:', error);
    }
  };

  // Send chat message
  const sendChatMessage = async () => {
    if (!newChatMessage.trim() || !streamId) return;
    
    try {
      const response = await fetch(`/api/streams/${streamId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: newChatMessage,
          tipAmount: 0
        })
      });
      
      const chatMessage = await response.json();
      setChatMessages(prev => [...prev, chatMessage]);
      setNewChatMessage('');
      
      // Broadcast via socket
      if (socket) {
        socket.emit('chat-message', chatMessage);
      }
    } catch (error) {
      console.error('Failed to send chat message:', error);
      toast({
        title: "Chat Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getConnectionBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge className="bg-green-500"><Wifi className="h-3 w-3 mr-1" />Connected</Badge>;
      case 'connecting':
        return <Badge className="bg-yellow-500"><Wifi className="h-3 w-3 mr-1" />Connecting</Badge>;
      default:
        return <Badge variant="destructive"><Wifi className="h-3 w-3 mr-1" />Disconnected</Badge>;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Live Video Preview - Main Area */}
      <div className="lg:col-span-2">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              🔴 Live Video Preview
              {getConnectionBadge()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full aspect-video object-cover"
                style={{ maxHeight: '400px' }}
              />
              {!localStream && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 bg-opacity-75">
                  <div className="text-center">
                    <Video className="h-16 w-16 mx-auto text-slate-500 mb-4" />
                    <p className="text-slate-400">Camera access required for streaming</p>
                  </div>
                </div>
              )}
              
              {/* Stream Controls Overlay */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={toggleVideo}
                    size="sm"
                    variant={isVideoEnabled ? "default" : "destructive"}
                    className="bg-black bg-opacity-50 hover:bg-opacity-75"
                  >
                    {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                  </Button>
                  <Button
                    onClick={toggleAudio}
                    size="sm"
                    variant={isAudioEnabled ? "default" : "destructive"}
                    className="bg-black bg-opacity-50 hover:bg-opacity-75"
                  >
                    {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                  </Button>
                </div>
                
                <div className="flex items-center space-x-4 text-white text-sm">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    {viewerCount}
                  </div>
                  <Badge className="bg-red-500 text-white">LIVE</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Chat - Sidebar */}
      <div className="lg:col-span-1">
        <Card className="bg-slate-800 border-slate-700 h-full">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <MessageCircle className="h-5 w-5 mr-2" />
              Live Chat
            </CardTitle>
          </CardHeader>
          <CardContent className="h-96 flex flex-col">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-4 max-h-80">
              {chatMessages.length === 0 ? (
                <div className="text-slate-400 text-center py-8">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No messages yet</p>
                  <p className="text-sm">Chat will appear here when viewers join</p>
                </div>
              ) : (
                chatMessages.map((msg, index) => (
                  <div key={index} className="text-sm">
                    <div className="flex items-start space-x-2">
                      <span className="font-medium text-blue-400 flex-shrink-0">
                        {msg.senderName || 'User'}:
                      </span>
                      <span className="text-slate-300 break-words">{msg.message}</span>
                    </div>
                    {msg.tipAmount > 0 && (
                      <div className="text-green-400 text-xs ml-2">
                        💰 Tipped {msg.tipAmount} tokens!
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            
            {/* Chat Input */}
            <div className="flex space-x-2">
              <Input
                placeholder="Say something to your viewers..."
                value={newChatMessage}
                onChange={(e) => setNewChatMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                className="bg-slate-700 border-slate-600 text-white flex-1"
              />
              <Button 
                onClick={sendChatMessage}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}