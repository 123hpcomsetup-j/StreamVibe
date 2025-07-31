import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }), // Return null instead of throwing on 401
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes - keep session data fresh
    gcTime: 1000 * 60 * 30, // 30 minutes - cache management
    refetchOnMount: true, // Always check auth on mount
    refetchOnWindowFocus: true, // Check auth when window gets focus
  });

  // Debug logging
  console.log("🔐 useAuth - User data:", user);
  console.log("🔐 useAuth - Is loading:", isLoading);
  console.log("🔐 useAuth - Error:", error);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
