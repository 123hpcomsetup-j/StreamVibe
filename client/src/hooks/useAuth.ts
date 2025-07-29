import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes - keep session data fresh
    gcTime: 1000 * 60 * 30, // 30 minutes - cache management
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
