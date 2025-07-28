import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import ProviderStreamMonitor from "@/components/provider-stream-monitor";
import type { User } from "@shared/schema";

export default function ProviderAuthorization() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const typedUser = user as User | undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !typedUser || typedUser.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50">
      <Navbar user={typedUser} />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Provider Authorization Center</h2>
            <p className="text-slate-400">Monitor and authorize creator streams and payment flows</p>
          </div>

          <ProviderStreamMonitor />
        </main>
      </div>
    </div>
  );
}