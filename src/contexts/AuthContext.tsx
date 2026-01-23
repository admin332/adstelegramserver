import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
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

// Default state for useAuthSafe when context is not available
const defaultAuthState: AuthContextType = {
  user: null,
  supabaseUser: null,
  isLoading: true,
  isAuthenticated: false,
  isTelegram: false,
  isSupabaseAuth: false,
  error: null,
  telegramUser: null,
  logout: async () => {},
  refreshUser: async () => {},
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTelegram, setIsTelegram] = useState(false);
  const [isSupabaseAuth, setIsSupabaseAuth] = useState(false);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  
  // Guard against state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    console.log("[AuthProvider] Mounted");
    isMountedRef.current = true;
    
    return () => {
      console.log("[AuthProvider] Unmounted");
      isMountedRef.current = false;
    };
  }, []);

  const safeSetState = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    if (isMountedRef.current) {
      setter(value);
    }
  }, []);

  const loadSupabaseUserProfile = useCallback(async (authUser: SupabaseUser) => {
    const { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    if (profile && isMountedRef.current) {
      setUser(profile as User);
      setSupabaseUser(authUser);
      setIsSupabaseAuth(true);
    }
  }, []);

  const authenticate = useCallback(async () => {
    try {
      safeSetState(setIsLoading, true);
      safeSetState(setError, null);

      console.log("[Auth] Starting authentication...");

      // Check if running in Telegram FIRST
      const inTelegram = isTelegramMiniApp();
      console.log("[Auth] isTelegramMiniApp:", inTelegram);
      safeSetState(setIsTelegram, inTelegram);

      if (inTelegram) {
        // Initialize Telegram WebApp ONLY if we're in Telegram
        initTelegramApp();
        // Telegram Mini App auth flow
        const tgUser = getTelegramUser();
        safeSetState(setTelegramUser, tgUser);

        const initData = getTelegramInitData();
        if (!initData) {
          safeSetState(setError, "No Telegram data available");
          safeSetState(setIsLoading, false);
          return;
        }

        console.log("[Auth] Calling telegram-auth edge function...");
        const { data, error: fnError } = await supabase.functions.invoke("telegram-auth", {
          body: { initData },
        });

        console.log("[Auth] Response:", data, fnError);

        if (fnError) {
          console.error("[Auth] Edge function error:", fnError);
          safeSetState(setError, "Authentication failed");
          safeSetState(setIsLoading, false);
          return;
        }

        if (data?.success && data?.user) {
          console.log("[Auth] Success! User:", data.user);
          safeSetState(setUser, data.user);
        } else {
          console.log("[Auth] Failed:", data?.error);
          safeSetState(setError, data?.error || "Authentication failed");
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
      safeSetState(setError, "Authentication error");
    } finally {
      safeSetState(setIsLoading, false);
    }
  }, [loadSupabaseUserProfile, safeSetState]);

  // Listen for Supabase auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[Auth] Auth state changed:", event);
        
        if (!isMountedRef.current) {
          console.log("[Auth] Skipping state update - component unmounted");
          return;
        }
        
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
      
      if (data && isMountedRef.current) {
        setUser(data as User);
      }
    } else if (user?.auth_user_id) {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("auth_user_id", user.auth_user_id)
        .maybeSingle();
      
      if (data && isMountedRef.current) {
        setUser(data as User);
      }
    }
  }, [user?.telegram_id, user?.auth_user_id]);

  const logout = useCallback(async () => {
    if (isSupabaseAuth) {
      await supabase.auth.signOut();
    }
    if (isMountedRef.current) {
      setUser(null);
      setSupabaseUser(null);
      setTelegramUser(null);
      setIsSupabaseAuth(false);
    }
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

  console.log("[AuthProvider] Rendering with value:", { isLoading, isAuthenticated: !!user, hasUser: !!user });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Strict hook - throws if used outside AuthProvider
 * Use this in components that MUST have auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.error("[useAuth] Context undefined! Current path:", window.location.pathname);
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Safe hook - returns default state if context unavailable
 * Use this in UI components that should gracefully handle missing context
 */
export function useAuthSafe(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.warn("[useAuthSafe] Context unavailable, returning default state. Path:", window.location.pathname);
    return defaultAuthState;
  }
  return context;
}
