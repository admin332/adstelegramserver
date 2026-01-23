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

  useEffect(() => {
    let isMounted = true;

    const checkAdminRole = async (userId: string): Promise<boolean> => {
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
    };

    const ensureUserProfile = async (authUser: User) => {
      try {
        const { data: existingProfile, error: fetchError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', authUser.id)
          .maybeSingle();

        if (fetchError) {
          console.error('Error checking existing profile:', fetchError);
          return;
        }

        if (!existingProfile) {
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              auth_user_id: authUser.id,
              first_name: authUser.email?.split('@')[0] || 'Admin',
              username: authUser.email,
              is_premium: false,
            });

          if (insertError) {
            console.error('Error creating user profile:', insertError);
          } else {
            console.log('Created profile for admin user:', authUser.id);
          }
        }
      } catch (err) {
        console.error('Error ensuring user profile:', err);
      }
    };

    const handleAuthChange = async (session: { user: User } | null) => {
      if (!isMounted) return;

      if (session?.user) {
        try {
          const isAdmin = await checkAdminRole(session.user.id);
          
          if (isAdmin) {
            await ensureUserProfile(session.user);
          }
          
          if (isMounted) {
            setState({
              user: session.user,
              isAdmin,
              isLoading: false,
              error: null,
            });
          }
        } catch (err) {
          console.error('Error in handleAuthChange:', err);
          if (isMounted) {
            setState({
              user: session.user,
              isAdmin: false,
              isLoading: false,
              error: 'Failed to check admin status',
            });
          }
        }
      } else {
        if (isMounted) {
          setState({
            user: null,
            isAdmin: false,
            isLoading: false,
            error: null,
          });
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AdminAuth] Auth state changed:', event);
        await handleAuthChange(session);
      }
    );

    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[AdminAuth] Initial session check');
      await handleAuthChange(session);
    });

    // Safety timeout - prevent infinite loading
    const timeout = setTimeout(() => {
      if (isMounted) {
        setState(prev => {
          if (prev.isLoading) {
            console.warn('[AdminAuth] Safety timeout triggered');
            return { ...prev, isLoading: false };
          }
          return prev;
        });
      }
    }, 5000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, error: null }));
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setState(prev => ({ ...prev, isLoading: false, error: error.message }));
      return { success: false, error: error.message };
    }

    // isLoading будет сброшен через onAuthStateChange
    return { success: true, user: data.user };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, error: null }));
    
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

    // isLoading будет сброшен через onAuthStateChange
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
