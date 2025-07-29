import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Clock, Eye, Play } from "lucide-react";
import { Link } from "wouter";

interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string;
  role: 'viewer' | 'creator' | 'admin';
  isOnline: boolean;
}

interface Stream {
  id: string;
  title: string;
  category: string;
  isLive: boolean;
  viewerCount: number;
  creatorId: string;
  createdAt: string;
}

export default function Landing() {
  const { data: onlineUsers = [], isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users/online"],
  });

  const { data: recentStreams = [], isLoading: loadingStreams } = useQuery<Stream[]>({
    queryKey: ["/api/streams/recent"],
  });

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'creator': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Hero Section */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-slate-900 dark:text-white mb-6">
              Welcome to <span className="text-purple-600 dark:text-purple-400">StreamVibe</span>
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
              Discover amazing live streams, connect with creators, and join our vibrant community of content creators and viewers.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/creator-login">
                <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3">
                  Start Creating
                </Button>
              </Link>
              <Link href="/user-login">
                <Button size="lg" variant="outline" className="border-purple-600 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 px-8 py-3">
                  Join as Viewer
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Online Users Section */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <Users className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Online Users</h2>
            <Badge variant="secondary" className="px-3 py-1 text-sm">
              {onlineUsers.length} online
            </Badge>
          </div>

          {loadingUsers ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4">
                      <div className="rounded-full bg-slate-200 dark:bg-slate-700 h-12 w-12"></div>
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : onlineUsers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {onlineUsers.map((user) => (
                <Card key={user.id} className="hover:shadow-lg transition-shadow duration-300 border-2 border-transparent hover:border-purple-200 dark:hover:border-purple-800">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={user.profileImageUrl} alt={user.username} />
                          <AvatarFallback className="bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300">
                            {user.firstName?.[0] || user.username?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {user.username}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {user.firstName} {user.lastName}
                        </p>
                        <Badge size="sm" className={`mt-1 ${getRoleColor(user.role)}`}>
                          {user.role}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <Users className="h-16 w-16 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400 text-lg">No users are currently online</p>
                <p className="text-slate-500 dark:text-slate-500 text-sm mt-2">Check back later to see who's active!</p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Recent Streams Section */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <Clock className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Recent Streams</h2>
            <Badge variant="secondary" className="px-3 py-1 text-sm">
              Last 24 hours
            </Badge>
          </div>

          {loadingStreams ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <div className="aspect-video bg-slate-200 dark:bg-slate-700 rounded-t-lg"></div>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : recentStreams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {recentStreams.slice(0, 6).map((stream) => (
                <Card key={stream.id} className="overflow-hidden hover:shadow-lg transition-shadow duration-300 border-2 border-transparent hover:border-purple-200 dark:hover:border-purple-800">
                  {/* Video Thumbnail Placeholder */}
                  <div className="aspect-video bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800 flex items-center justify-center relative">
                    <Play className="h-16 w-16 text-purple-600 dark:text-purple-400 opacity-80" />
                    <div className="absolute top-4 right-4">
                      <Badge variant="secondary" className="bg-black/50 text-white border-none">
                        ENDED
                      </Badge>
                    </div>
                  </div>
                  
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white line-clamp-2">
                      {stream.title}
                    </CardTitle>
                    <CardDescription className="flex items-center justify-between">
                      <span className="text-purple-600 dark:text-purple-400 font-medium">
                        {stream.category}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-sm">
                        {formatDate(stream.createdAt)}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Eye className="h-4 w-4" />
                        <span>{stream.viewerCount} viewers</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Recorded
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <Clock className="h-16 w-16 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400 text-lg">No recent streams</p>
                <p className="text-slate-500 dark:text-slate-500 text-sm mt-2">Be the first to start streaming today!</p>
                <Link href="/creator-login">
                  <Button className="mt-6 bg-purple-600 hover:bg-purple-700 text-white">
                    Start Your First Stream
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      {/* Footer Call to Action */}
      <div className="bg-purple-600 dark:bg-purple-800 text-white py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-3xl font-bold mb-4">Ready to Join StreamVibe?</h3>
          <p className="text-purple-100 text-lg mb-8 max-w-2xl mx-auto">
            Create your account today and become part of our growing community of streamers and viewers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/creator-login">
              <Button size="lg" variant="secondary" className="bg-white text-purple-600 hover:bg-slate-100 px-8 py-3">
                Become a Creator
              </Button>
            </Link>
            <Link href="/user-login">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8 py-3">
                Start Watching
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}