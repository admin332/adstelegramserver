import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  getTelegramInitData, 
  getTelegramUser, 
  isTelegramMiniApp, 
  initTelegramApp,
  type TelegramUser 
} from "@/lib/telegram";

export interface User {
  id: string;
  telegram_id?: number | null;
  auth_user_id?: string | null;
  first_name: string;
  last_name?: string | null;
  username?: string | null;
  photo_url?: string | null;
  language_code?: string | null;
  is_premium: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isTelegram: boolean;
  error: string | null;
  telegramUser: TelegramUser | null;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTelegram, setIsTelegram] = useState(false);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);

  const authenticate = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log("[Auth] Starting authentication...");

      // Initialize Telegram WebApp
      initTelegramApp();

      // Check if running in Telegram
      const inTelegram = isTelegramMiniApp();
      console.log("[Auth] isTelegramMiniApp:", inTelegram);
      setIsTelegram(inTelegram);

      if (inTelegram) {
        // Telegram Mini App authentication
        const tgUser = getTelegramUser();
        setTelegramUser(tgUser);

        const initData = getTelegramInitData();
        if (!initData) {
          setError("No Telegram data available");
          setIsLoading(false);
          return;
        }

        console.log("[Auth] Calling telegram-auth edge function...");
        const { data, error: fnError } = await supabase.functions.invoke("telegram-auth", {
          body: { initData },
        });

        console.log("[Auth] Response:", data, fnError);

        if (fnError) {
          console.error("[Auth] Edge function error:", fnError);
          setError("Authentication failed");
          setIsLoading(false);
          return;
        }

        if (data?.success && data?.user) {
          console.log("[Auth] Telegram auth success! User:", data.user);
          setUser(data.user);
        } else {
          console.log("[Auth] Telegram auth failed:", data?.error);
          setError(data?.error || "Authentication failed");
        }
      } else {
        // Not in Telegram - check Supabase Auth session
        console.log("[Auth] Not in Telegram, checking Supabase Auth session...");
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log("[Auth] Found Supabase Auth session:", session.user.id);
          
          // Load profile from public.users by auth_user_id
          const { data: profile, error: profileError } = await supabase
            .from("users")
            .select("*")
            .eq("auth_user_id", session.user.id)
            .maybeSingle();
          
          if (profileError) {
            console.error("[Auth] Error loading profile:", profileError);
          }
          
          if (profile) {
            console.log("[Auth] Found profile:", profile);
            setUser(profile as User);
          } else {
            console.log("[Auth] No profile found for auth user");
            // User is authenticated but has no profile yet
            // This is normal - profile is created on first admin login
          }
        } else {
          console.log("[Auth] No Supabase Auth session found");
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError("Authentication error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (user?.telegram_id) {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", user.telegram_id)
        .maybeSingle();
      
      if (data) {
        setUser(data as User);
      }
    } else if (user?.auth_user_id) {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("auth_user_id", user.auth_user_id)
        .maybeSingle();
      
      if (data) {
        setUser(data as User);
      }
    }
  }, [user?.telegram_id, user?.auth_user_id]);

  const logout = useCallback(async () => {
    setUser(null);
    setTelegramUser(null);
    // Also sign out from Supabase Auth if not in Telegram
    if (!isTelegram) {
      await supabase.auth.signOut();
    }
  }, [isTelegram]);

  // Listen for Supabase Auth state changes (for non-Telegram users)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[Auth] Auth state changed:", event);
        
        // Only handle auth changes if not in Telegram
        if (!isTelegram && event === 'SIGNED_IN' && session?.user) {
          // Reload profile
          const { data: profile } = await supabase
            .from("users")
            .select("*")
            .eq("auth_user_id", session.user.id)
            .maybeSingle();
          
          if (profile) {
            setUser(profile as User);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [isTelegram]);

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isTelegram,
    error,
    telegramUser,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
