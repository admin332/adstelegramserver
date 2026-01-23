import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { 
  getTelegramInitData, 
  getTelegramUser, 
  isTelegramMiniApp, 
  initTelegramApp,
  type TelegramUser 
} from "@/lib/telegram";

export interface User {
  id: string;
  telegram_id: number | null;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  is_premium: boolean;
  auth_user_id?: string;
}

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isTelegram: boolean;
  isSupabaseAuth: boolean;
  error: string | null;
  telegramUser: TelegramUser | null;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTelegram, setIsTelegram] = useState(false);
  const [isSupabaseAuth, setIsSupabaseAuth] = useState(false);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);

  const loadSupabaseUserProfile = useCallback(async (authUser: SupabaseUser) => {
    const { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    if (profile) {
      setUser(profile as User);
      setSupabaseUser(authUser);
      setIsSupabaseAuth(true);
    }
  }, []);

  const authenticate = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log("[Auth] Starting authentication...");

      // Check if running in Telegram FIRST
      const inTelegram = isTelegramMiniApp();
      console.log("[Auth] isTelegramMiniApp:", inTelegram);
      setIsTelegram(inTelegram);

      if (inTelegram) {
        // Initialize Telegram WebApp ONLY if we're in Telegram
        initTelegramApp();
        // Telegram Mini App auth flow
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
          console.log("[Auth] Success! User:", data.user);
          setUser(data.user);
        } else {
          console.log("[Auth] Failed:", data?.error);
          setError(data?.error || "Authentication failed");
        }
      } else {
        // Check for existing Supabase session (email/password login)
        console.log("[Auth] Checking Supabase session...");
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log("[Auth] Found Supabase session:", session.user.email);
          await loadSupabaseUserProfile(session.user);
        } else {
          console.log("[Auth] No session found");
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError("Authentication error");
    } finally {
      setIsLoading(false);
    }
  }, [loadSupabaseUserProfile]);

  // Listen for Supabase auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[Auth] Auth state changed:", event);
        
        if (event === 'SIGNED_IN' && session?.user && !isTelegram) {
          await loadSupabaseUserProfile(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSupabaseUser(null);
          setIsSupabaseAuth(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [isTelegram, loadSupabaseUserProfile]);

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
    if (isSupabaseAuth) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSupabaseUser(null);
    setTelegramUser(null);
    setIsSupabaseAuth(false);
  }, [isSupabaseAuth]);

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  const value: AuthContextType = {
    user,
    supabaseUser,
    isLoading,
    isAuthenticated: !!user,
    isTelegram,
    isSupabaseAuth,
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
