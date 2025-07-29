import React from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

export default function PublicHome() {
  const [, setLocation] = useLocation();

  // Test to ensure the component renders
  console.log('PublicHome component is rendering');

  const { data: liveStreams = [], isLoading: streamsLoading } = useQuery({
    queryKey: ["/api/streams/live"],
    retry: false,
  });

  const { data: onlineUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users/online"],
    retry: false,
  });

  // Filter only creators who are online
  const onlineCreators = Array.isArray(onlineUsers) ? onlineUsers.filter((user: any) => user.role === 'creator') : [];

  // Simply use the live streams data from React Query without socket complications
  const displayStreams = Array.isArray(liveStreams) ? liveStreams.filter((stream: any) => stream.isLive) : [];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#1e293b', color: 'white', padding: '20px' }}>
      {/* Simple test content */}
      <h1 style={{ fontSize: '32px', color: '#8b5cf6', marginBottom: '20px', textAlign: 'center' }}>
        StreamVibe - Live Streaming Platform
      </h1>
      
      <div style={{ backgroundColor: '#334155', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px', color: '#60a5fa' }}>Platform Status</h2>
        <p>Welcome to StreamVibe! This is a test to ensure the page is loading correctly.</p>
        <p>Live Streams: {displayStreams.length}</p>
        <p>Online Creators: {onlineCreators.length}</p>
        <p>Total Users: {Array.isArray(onlineUsers) ? onlineUsers.length : 0}</p>
        <p>Loading: {streamsLoading ? 'Yes' : 'No'}</p>
      </div>
      
      {/* Navigation */}
      <nav style={{ backgroundColor: '#475569', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', color: '#8b5cf6' }}>Navigation</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setLocation("/user-login")}
              style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Watch Streams
            </button>
            <button 
              onClick={() => setLocation("/creator-login")}
              style={{ padding: '8px 16px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Start Creating
            </button>
            <button 
              onClick={() => setLocation("/login")}
              style={{ padding: '8px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>
      
      {/* Live Streams Section */}
      <div style={{ backgroundColor: '#334155', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '16px', color: '#f59e0b' }}>
          Live Streams ({displayStreams.length})
        </h2>
        {streamsLoading ? (
          <p>Loading streams...</p>
        ) : displayStreams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ fontSize: '16px', marginBottom: '10px' }}>No live streams at the moment.</p>
            <p style={{ color: '#94a3b8' }}>Be the first to start streaming!</p>
            <button 
              onClick={() => setLocation("/creator-login")}
              style={{ marginTop: '10px', padding: '10px 20px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Start Your Stream
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {displayStreams.slice(0, 6).map((stream: any) => (
              <div 
                key={stream.id} 
                style={{ backgroundColor: '#475569', padding: '16px', borderRadius: '8px', cursor: 'pointer', transition: 'background-color 0.2s' }}
                onClick={() => setLocation(`/stream/${stream.id}`)}
              >
                <h3 style={{ fontSize: '16px', marginBottom: '8px', color: 'white' }}>{stream.title}</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '4px' }}>Category: {stream.category}</p>
                <p style={{ color: '#22c55e', fontSize: '14px' }}>👥 {stream.viewerCount || 0} viewers</p>
                <div style={{ marginTop: '8px', padding: '4px 8px', backgroundColor: '#dc2626', color: 'white', fontSize: '12px', borderRadius: '4px', display: 'inline-block' }}>
                  🔴 LIVE
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Online Creators Section */}
      <div style={{ backgroundColor: '#334155', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '16px', color: '#10b981' }}>
          👥 Online Creators ({onlineCreators.length})
        </h2>
        {usersLoading ? (
          <p>Loading creators...</p>
        ) : onlineCreators.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ fontSize: '16px', marginBottom: '10px' }}>No creators online right now.</p>
            <p style={{ color: '#94a3b8' }}>Check back later or become a creator yourself!</p>
            <button 
              onClick={() => setLocation("/creator-login")}
              style={{ marginTop: '10px', padding: '10px 20px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Become a Creator
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {onlineCreators.slice(0, 8).map((creator: any) => (
              <div key={creator.id} style={{ backgroundColor: '#475569', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ width: '40px', height: '40px', backgroundColor: '#6366f1', borderRadius: '50%', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                  👤
                </div>
                <h4 style={{ fontSize: '14px', color: 'white', marginBottom: '4px' }}>
                  {creator.firstName && creator.lastName 
                    ? `${creator.firstName} ${creator.lastName}` 
                    : creator.username || 'Creator'}
                </h4>
                <div style={{ fontSize: '12px', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  🟢 Online
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Call to Action */}
      <div style={{ backgroundColor: '#1e40af', padding: '30px', borderRadius: '12px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '10px', color: 'white' }}>
          Ready to Join StreamVibe?
        </h2>
        <p style={{ fontSize: '16px', color: '#bfdbfe', marginBottom: '20px' }}>
          Choose your path: watch amazing content or start creating your own
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setLocation("/user-login")}
            style={{ padding: '12px 24px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}
          >
            🎬 I Want to Watch
          </button>
          <button 
            onClick={() => setLocation("/creator-login")}
            style={{ padding: '12px 24px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}
          >
            📹 I Want to Create
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '40px', padding: '20px', textAlign: 'center', color: '#94a3b8', borderTop: '1px solid #475569' }}>
        <h3 style={{ fontSize: '18px', color: '#8b5cf6', marginBottom: '8px' }}>StreamVibe</h3>
        <p style={{ fontSize: '14px', marginBottom: '16px' }}>The future of live streaming and creator economy</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setLocation("/user-login")}
            style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Watch Streams
          </button>
          <button 
            onClick={() => setLocation("/creator-login")}
            style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Become Creator
          </button>
          <button 
            onClick={() => setLocation("/admin")}
            style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Admin Panel
          </button>
        </div>
      </div>
    </div>
  );
}