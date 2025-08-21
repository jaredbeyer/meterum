import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface User {
  id: number;
  username: string;
  role: string;
  created_at?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  });
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const user = await response.json();
        setAuthState({ user, loading: false, error: null });
      } else if (response.status === 401) {
        setAuthState({ user: null, loading: false, error: null });
      } else {
        setAuthState({ user: null, loading: false, error: 'Failed to fetch user' });
      }
    } catch (error) {
      setAuthState({ user: null, loading: false, error: 'Network error' });
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        setAuthState({ user: data.user, loading: false, error: null });
        toast.success('Login successful!');
        
        // Add slight delay to ensure state updates
        setTimeout(() => {
          if (data.user.role === 'admin') {
            console.log('Navigating to /dashboard for admin');
            router.push('/dashboard');
          } else if (data.user.role === 'customer') {
            console.log('Navigating to /dashboard/customer');
            router.push('/dashboard/customer');
          } else {
            console.log('Navigating to /dashboard for role:', data.user.role);
            router.push('/dashboard');
          }
        }, 100);
        
        return { success: true };
      } else {
        setAuthState({ user: null, loading: false, error: data.error });
        toast.error(data.error || 'Login failed');
        return { success: false, error: data.error };
      }
    } catch (error) {
      const message = 'Network error during login';
      setAuthState({ user: null, loading: false, error: message });
      toast.error(message);
      return { success: false, error: message };
    }
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      setAuthState({ user: null, loading: false, error: null });
      
      // Clean up any old localStorage (backwards compatibility)
      try {
        localStorage.removeItem('authToken');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } catch (e) {
        // Ignore localStorage errors
      }
      
      toast.success('Logged out successfully');
      router.push('/login');
    } catch (error) {
      toast.error('Logout failed');
    }
  }, [router]);

  const refreshToken = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        await fetchUser();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [fetchUser]);

  return {
    user: authState.user,
    loading: authState.loading,
    error: authState.error,
    login,
    logout,
    refreshToken,
    refetch: fetchUser
  };
}