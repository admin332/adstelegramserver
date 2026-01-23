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

  // Create or update profile in public.users for admin user
  const ensureUserProfile = useCallback(async (authUser: User) => {
    try {
      // Check if profile already exists
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
        // Create new profile for admin
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
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Use setTimeout to avoid potential race conditions
          setTimeout(async () => {
            const isAdmin = await checkAdminRole(session.user.id);
            
            // Ensure profile exists for this user
            if (isAdmin) {
              await ensureUserProfile(session.user);
            }
            
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
        
        // Ensure profile exists for this user
        if (isAdmin) {
          await ensureUserProfile(session.user);
        }
        
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
  }, [checkAdminRole, ensureUserProfile]);

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
