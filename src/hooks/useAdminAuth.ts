import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

interface AdminAuthState {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>({
    user: null,
    isAdmin: false,
    isLoading: true,
    error: null,
  });

  const checkAdminRole = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) {
        console.error('Error checking admin role:', error);
        return false;
      }

      return !!data;
    } catch (err) {
      console.error('Error checking admin role:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Use setTimeout to avoid potential race conditions
          setTimeout(async () => {
            const isAdmin = await checkAdminRole(session.user.id);
            setState({
              user: session.user,
              isAdmin,
              isLoading: false,
              error: null,
            });
          }, 0);
        } else {
          setState({
            user: null,
            isAdmin: false,
            isLoading: false,
            error: null,
          });
        }
      }
    );

    // THEN check initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const isAdmin = await checkAdminRole(session.user.id);
        setState({
          user: session.user,
          isAdmin,
          isLoading: false,
          error: null,
        });
      } else {
        setState({
          user: null,
          isAdmin: false,
          isLoading: false,
          error: null,
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAdminRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setState(prev => ({ ...prev, isLoading: false, error: error.message }));
      return { success: false, error: error.message };
    }

    return { success: true, user: data.user };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setState(prev => ({ ...prev, isLoading: false, error: error.message }));
      return { success: false, error: error.message };
    }

    return { success: true, user: data.user };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setState(prev => ({ ...prev, error: error.message }));
      return { success: false, error: error.message };
    }
    return { success: true };
  }, []);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
  };
}
