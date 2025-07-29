import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Users, Clock, Heart, Play, Square, Settings } from "lucide-react";
import { io } from "socket.io-client";
import StreamModal from "@/components/stream-modal";
import StreamModalWebRTC from "@/components/stream-modal-webrtc";

export default function CreatorDashboard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamData, setStreamData] = useState({
    title: "",
    category: "Art & Design", 
    minTip: 5,
    tokenPrice: 1,
    privateRate: 20,
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    username: "",
  });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peerConnections, setPeerConnections] = useState<Map<string, RTCPeerConnection>>(new Map());
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [showWebRTCModal, setShowWebRTCModal] = useState(false);
  const [streamKey, setStreamKey] = useState<string>("");
  const [useWebRTC, setUseWebRTC] = useState(true); // Always use WebRTC
  const videoRef = useRef<HTMLVideoElement>(null);

  const typedUser = user as User | undefined;

  // Setup WebSocket connection with auto-reconnect
  useEffect(() => {
    if (typedUser?.id) {
      // Clean up existing socket before creating new one
      if ((window as any).streamSocket) {
        (window as any).streamSocket.disconnect();
        delete (window as any).streamSocket;
      }
      
      const socket = io(window.location.origin, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
        query: {
          userId: typedUser.id,
          role: 'creator'
        }
      });

      // Store socket globally for access in mutations
      (window as any).streamSocket = socket;

      socket.on('connect', () => {
        console.log('WebRTC signaling server connected');
        // Identify this socket as the creator
        if (typedUser?.id) {
          socket.emit('identify', { userId: typedUser.id });
          console.log('Socket identified as creator:', typedUser.id);
        }
      });

      socket.on('disconnect', () => {
        console.log('WebRTC signaling server disconnected');
      });

      // Also identify on reconnect
      socket.io.on('reconnect', () => {
        console.log('WebRTC signaling server reconnected');
        if (typedUser?.id) {
          socket.emit('identify', { userId: typedUser.id });
          console.log('Socket re-identified as creator:', typedUser.id);
        }
      });

      // Listen for real-time tip updates
      socket.on('tip-message', (data: any) => {
        toast({
          title: "New Tip Received!",
          description: `${data.username} tipped ${data.amount} tokens`,
          variant: "default",
        });
        // Refresh stats and tips data
        queryClient.invalidateQueries({ queryKey: ["/api/creator/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/creator/tips"] });
      });

      // Listen for stream status updates
      socket.on('stream-status-changed', (data: any) => {
        queryClient.invalidateQueries({ queryKey: ["/api/streams/current"] });
        queryClient.invalidateQueries({ queryKey: ["/api/streams/live"] });
      });

      // Handle viewer joining - create offer for them
      socket.on('viewer-joined', async (data: { viewerId: string, userId: string, viewerCount: number, streamId?: string }) => {
        console.log('Viewer joined:', data);
        
        if (localStream) {
          const pc = new RTCPeerConnection({
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          });

          // Add local stream tracks to peer connection
          localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
          });

          // Handle ICE candidates
          pc.onicecandidate = (event) => {
            if (event.candidate) {
              socket.emit('ice-candidate', {
                candidate: event.candidate,
                targetId: data.viewerId,
                streamId: data.streamId || (window as any).currentStreamId
              });
            }
          };

          // Create and send offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          
          socket.emit('offer', {
            offer,
            targetId: data.viewerId,
            streamId: data.streamId || (window as any).currentStreamId
          });

          // Store peer connection
          peerConnections.set(data.viewerId, pc);
          setPeerConnections(new Map(peerConnections));
        }
      });

      // Handle answer from viewer
      socket.on('answer', async (data: { answer: RTCSessionDescriptionInit, senderId: string }) => {
        const pc = peerConnections.get(data.senderId);
        if (pc) {
          await pc.setRemoteDescription(data.answer);
        }
      });

      // Handle ICE candidates from viewers
      socket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit, senderId: string }) => {
        const pc = peerConnections.get(data.senderId);
        if (pc) {
          await pc.addIceCandidate(data.candidate);
        }
      });

      return () => {
        socket.disconnect();
        delete (window as any).streamSocket;
      };
    }
  }, [typedUser?.id, toast, localStream, peerConnections]);

  // Initialize profile data when user loads
  useEffect(() => {
    if (typedUser) {
      setProfileData({
        firstName: typedUser.firstName || "",
        lastName: typedUser.lastName || "",
        username: typedUser.username || "",
      });
    }
  }, [typedUser]);

  // Redirect if not authenticated or not a creator
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || typedUser?.role !== 'creator')) {
      toast({
        title: "Unauthorized",
        description: "Creator access required. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, typedUser, toast]);

  const { data: stats } = useQuery({
    queryKey: ["/api/creator/stats"],
    retry: false,
  });

  const { data: recentTips = [] } = useQuery({
    queryKey: ["/api/creator/tips"],
    retry: false,
  });

  const { data: currentStream } = useQuery({
    queryKey: ["/api/streams/current"],
    retry: false,
    enabled: !!typedUser,
  });

  // Update streaming state based on current stream
  useEffect(() => {
    if (currentStream && (currentStream as any).isLive) {
      setIsStreaming(true);
      setStreamData({
        title: (currentStream as any).title || "",
        category: (currentStream as any).category || "Art & Design",
        minTip: (currentStream as any).minTip || 5,
        tokenPrice: (currentStream as any).tokenPrice || 1,
        privateRate: (currentStream as any).privateRate || 20,
      });
    } else {
      setIsStreaming(false);
    }
  }, [currentStream]);

  // Ensure video element displays local stream when available
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
      console.log('Local stream attached to video element');
    }
  }, [localStream, isStreaming]);

  const createStreamMutation = useMutation({
    mutationFn: async (streamData: any) => {
      const response = await apiRequest("POST", "/api/streams", {
        title: streamData.title || "Untitled Stream",
        category: streamData.category,
        minTip: streamData.minTip,
        tokenPrice: streamData.tokenPrice,
        privateRate: streamData.privateRate,
        isLive: true, // Mark the stream as live immediately
      });
      return await response.json();
    },
    onSuccess: (newStream: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams/live"] });
      
      // Store stream ID globally
      (window as any).currentStreamId = newStream.id;
      
      toast({
        title: "Stream Created!",
        description: "WebRTC stream created successfully. Camera access will be requested next.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to start stream. Please try again.",
        variant: "destructive",
      });
    },
  });

  const stopStreamMutation = useMutation({
    mutationFn: async () => {
      // Stop local stream tracks
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
      
      // Clear video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      // Close all peer connections
      peerConnections.forEach(pc => pc.close());
      setPeerConnections(new Map());
      
      // Clear global stream ID
      delete (window as any).currentStreamId;
      if (!currentStream) return { message: "No active stream to stop" };
      
      // Emit WebSocket event to properly stop stream
      const socket = (window as any).streamSocket;
      if (socket) {
        socket.emit('stop-stream', {
          streamId: (currentStream as any).id,
          userId: typedUser?.id
        });
      }
      
      const response = await apiRequest("DELETE", `/api/streams/${(currentStream as any).id}`);
      return await response.json();
    },
    onSuccess: () => {
      setIsStreaming(false);
      queryClient.invalidateQueries({ queryKey: ["/api/streams/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streams/live"] });
      toast({
        title: "Success",
        description: "Stream stopped successfully!",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to stop stream. Please try again.",
        variant: "destructive",
      });
    },
  });

  const requestPayoutMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await apiRequest("POST", "/api/payouts", {
        amount: amount,
        utrNumber: "", // This would be filled by admin
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payout request submitted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/creator/stats"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to request payout. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update stream settings mutation
  const updateStreamSettingsMutation = useMutation({
    mutationFn: async (settings: { minTip: number; tokenPrice: number; privateRate: number }) => {
      if (!currentStream) throw new Error("No active stream found");
      const response = await apiRequest("PUT", `/api/streams/${(currentStream as any).id}/settings`, settings);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Stream settings updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/streams/current"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update stream settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; username: string }) => {
      const response = await apiRequest("PUT", "/api/auth/profile", data);
      return await response.json();
    },
    onSuccess: () => {
      setIsEditingProfile(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Success",
        description: "Profile updated successfully!",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleUpdateProfile = () => {
    updateProfileMutation.mutate(profileData);
  };

  const handleStartStream = async () => {
    // Use creator's name as default title if no title provided
    const defaultTitle = typedUser?.username ? `${typedUser.username}'s Live Stream` : "Live Stream";
    const finalStreamData = {
      ...streamData,
      title: streamData.title.trim() || defaultTitle,
      streamKey: useWebRTC ? null : `${typedUser?.username || 'creator'}_${Date.now()}`
    };

    // Create the stream in database
    createStreamMutation.mutate(finalStreamData, {
      onSuccess: (newStream) => {
        setIsStreaming(true);
        
        // CRITICAL: Register creator with WebRTC signaling server
        const socket = (window as any).streamSocket;
        if (socket && typedUser?.id) {
          console.log('Registering creator with WebRTC server:', newStream.id, typedUser.id);
          socket.emit('start-stream', {
            streamId: newStream.id,
            userId: typedUser.id
          });
          
          // Store stream ID globally for WebRTC use
          (window as any).currentStreamId = newStream.id;
        }
        
        // Always use WebRTC - show WebRTC streaming modal
        setShowWebRTCModal(true);
        // Generate stream key for identification
        if (!streamKey) {
          setStreamKey(`${typedUser?.username || 'creator'}_${Date.now()}`);
        }
      }
    });
  };

  const handleStopStream = () => {
    setShowStreamModal(false);
    setShowWebRTCModal(false);
    stopStreamMutation.mutate();
  };

  const handleRequestPayout = () => {
    const availableEarnings = (stats as any)?.availableEarnings || 0;
    if (availableEarnings < 500) {
      toast({
        title: "Error",
        description: "Minimum payout amount is ₹500.",
        variant: "destructive",
      });
      return;
    }
    requestPayoutMutation.mutate(availableEarnings);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !typedUser || typedUser.role !== 'creator') {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50">
      {/* Simple Creator Navbar */}
      <nav className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary">StreamVibe</h1>
              <span className="ml-4 text-sm text-slate-400">Creator Dashboard</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                onClick={isStreaming ? handleStopStream : handleStartStream}
                className={isStreaming ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
                disabled={createStreamMutation.isPending || stopStreamMutation.isPending}
              >
                {isStreaming ? (
                  <>
                    <Square className="w-4 h-4 mr-2" />
                    Stop Stream
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Go Live
                  </>
                )}
              </Button>
              <Button 
                onClick={handleRequestPayout}
                variant="outline"
                className="border-slate-600 hover:bg-slate-700"
                disabled={requestPayoutMutation.isPending}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Request Payout
              </Button>
              <Button 
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                variant="outline"
                className="border-slate-600 hover:bg-slate-700"
              >
                <Settings className="w-4 h-4 mr-2" />
                {isEditingProfile ? "Cancel" : "Edit Profile"}
              </Button>
              <Button 
                onClick={() => window.location.href = "/api/logout"}
                variant="ghost"
                className="text-slate-300 hover:text-white"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Creator Dashboard - Real Analytics</h2>
          <p className="text-slate-400">Manage your streams and view real earnings data</p>
        </div>

        {/* Live Stream Status */}
        <div className="mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>Live Stream Status</span>
                <Badge className={isStreaming ? "bg-red-500" : "bg-gray-500"}>
                  {isStreaming ? "LIVE" : "OFFLINE"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isStreaming && currentStream ? (
                <div className="space-y-4">
                  {/* Video Preview */}
                  <div className="relative rounded-lg overflow-hidden bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full aspect-video"
                    />
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-white text-sm font-medium">LIVE</span>
                    </div>
                  </div>
                  {/* Live stream controls integrated - viewer count and chat */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                    {/* Stream Stats */}
                    <div className="lg:col-span-2">
                      <Card className="bg-slate-700 border-slate-600">
                        <CardHeader>
                          <CardTitle className="text-white flex items-center justify-between">
                            Stream Statistics
                            <Badge className="bg-green-500">
                              <Users className="w-4 h-4 mr-1" />
                              {(currentStream as any).viewerCount || 0} Viewers
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="text-center">
                              <p className="text-2xl font-bold text-white">{(currentStream as any).viewerCount || 0}</p>
                              <p className="text-sm text-slate-400">Current Viewers</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold text-white">{streamData.minTip}</p>
                              <p className="text-sm text-slate-400">Min Tip (tokens)</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold text-white">{streamData.tokenPrice}</p>
                              <p className="text-sm text-slate-400">Token Price</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    
                    {/* Live Chat */}
                    <div className="lg:col-span-1">
                      <Card className="bg-slate-700 border-slate-600">
                        <CardHeader>
                          <CardTitle className="text-white">Live Chat</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-slate-400 text-sm">Chat messages will appear here when viewers interact</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              ) : null}
              {!isStreaming && (
                <div className="text-center py-8">
                  <Play className="w-16 h-16 mx-auto text-slate-500 mb-4" />
                  <p className="text-slate-400 mb-4">Ready to go live? Click "Go Live" in the top navigation to start streaming.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Profile Editing */}
        {isEditingProfile && (
          <div className="mb-8">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Edit Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="Enter first name..."
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Enter last name..."
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="Enter username..."
                    value={profileData.username}
                    onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                <div className="flex space-x-4">
                  <Button 
                    onClick={handleUpdateProfile}
                    disabled={updateProfileMutation.isPending}
                    className="bg-primary hover:bg-primary/80"
                  >
                    {updateProfileMutation.isPending ? "Updating..." : "Update Profile"}
                  </Button>
                  <Button 
                    onClick={() => setIsEditingProfile(false)}
                    variant="outline"
                    className="border-slate-600 hover:bg-slate-700"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stream Setup - Only show when not streaming */}
        {!isStreaming && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Stream Setup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Stream Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter stream title..."
                    value={streamData.title}
                    onChange={(e) => setStreamData({ ...streamData, title: e.target.value })}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={streamData.category} onValueChange={(value) => setStreamData({ ...streamData, category: value })}>
                    <SelectTrigger className="bg-slate-700 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Art & Design">Art & Design</SelectItem>
                      <SelectItem value="Gaming">Gaming</SelectItem>
                      <SelectItem value="Music">Music</SelectItem>
                      <SelectItem value="Cooking">Cooking</SelectItem>
                      <SelectItem value="Education">Education</SelectItem>
                      <SelectItem value="Fitness">Fitness</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">
                  <Settings className="mr-2 h-5 w-5 inline" />
                  Creator Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tokenPrice">Token Price (₹)</Label>
                  <Input
                    id="tokenPrice"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={streamData.tokenPrice}
                    onChange={(e) => setStreamData({ ...streamData, tokenPrice: parseFloat(e.target.value) || 1 })}
                    className="bg-slate-700 border-slate-600"
                    placeholder="1.00"
                  />
                  <p className="text-xs text-slate-400">Set how much each token costs for viewers</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="minTip">Minimum Tip (tokens)</Label>
                  <Input
                    id="minTip"
                    type="number"
                    min="1"
                    value={streamData.minTip}
                    onChange={(e) => setStreamData({ ...streamData, minTip: parseInt(e.target.value) })}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="privateRate">Private Session Rate (tokens/min)</Label>
                  <Input
                    id="privateRate"
                    type="number"
                    min="1"
                    value={streamData.privateRate}
                    onChange={(e) => setStreamData({ ...streamData, privateRate: parseInt(e.target.value) })}
                    className="bg-slate-700 border-slate-600"
                  />
                  <p className="text-xs text-slate-400">Default: 20 tokens per minute</p>
                </div>
                
                {/* Update Settings Button for Live Streams */}
                {isStreaming && (
                  <div className="pt-4 border-t border-slate-600">
                    <Button 
                      onClick={() => updateStreamSettingsMutation.mutate({
                        minTip: streamData.minTip,
                        tokenPrice: streamData.tokenPrice,
                        privateRate: streamData.privateRate
                      })}
                      disabled={updateStreamSettingsMutation.isPending}
                      className="w-full bg-primary hover:bg-primary/80"
                    >
                      {updateStreamSettingsMutation.isPending ? "Updating..." : "Update Live Stream Settings"}
                    </Button>
                    <p className="text-xs text-slate-400 mt-2 text-center">
                      Changes apply immediately to your live stream
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Analytics Dashboard - Real Data */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{(stats as any)?.totalEarnings || 0}</div>
              <p className="text-xs text-muted-foreground">
                {(stats as any)?.earningsGrowth ? `+${(stats as any).earningsGrowth}% from last month` : 'No previous data'}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Followers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(stats as any)?.followerCount || 0}</div>
              <p className="text-xs text-muted-foreground">
                {(stats as any)?.newFollowers ? `+${(stats as any).newFollowers} new this week` : 'No new followers'}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stream Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(stats as any)?.totalStreamHours || 0}</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tips</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(stats as any)?.totalTips || 0}</div>
              <p className="text-xs text-muted-foreground">
                {(stats as any)?.weeklyTips ? `+${(stats as any).weeklyTips} this week` : 'No tips yet'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Tips */}
        <Card className="bg-slate-800 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Recent Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(recentTips as any[]).length > 0 ? (
                (recentTips as any[]).map((tip: any) => (
                  <div key={tip.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-700">
                    <div>
                      <p className="font-medium">{tip.senderName || 'Anonymous'}</p>
                      <p className="text-sm text-slate-400">{new Date(tip.createdAt).toLocaleDateString()}</p>
                      {tip.message && <p className="text-sm text-slate-300 mt-1">"{tip.message}"</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-400">+{tip.amount} tokens</p>
                      <p className="text-xs text-slate-400">₹{(tip.amount * ((stats as any)?.tokenPrice || 1)).toFixed(2)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-center">No tips received yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payout Section */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Earnings & Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Available for Payout</span>
                <span className="font-bold text-2xl">₹{(stats as any)?.availableEarnings || 0}</span>
              </div>
              <Button 
                onClick={handleRequestPayout}
                disabled={requestPayoutMutation.isPending || ((stats as any)?.availableEarnings || 0) < 500}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600"
              >
                {requestPayoutMutation.isPending ? "Processing..." : "Request Payout"}
              </Button>
              <p className="text-xs text-slate-400">Minimum payout amount: ₹500</p>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* RTMP Stream Configuration Modal */}
      <StreamModal 
        isOpen={showStreamModal}
        onClose={() => setShowStreamModal(false)}
        streamKey={streamKey}
      />
      
      {/* WebRTC Stream Modal */}
      <StreamModalWebRTC
        isOpen={showWebRTCModal}
        onClose={() => setShowWebRTCModal(false)}
        streamId={streamKey}
        socket={(window as any).streamSocket}
      />
    </div>
  );
}