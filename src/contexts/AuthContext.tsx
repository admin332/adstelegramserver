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
  telegram_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
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

      // Initialize Telegram WebApp
      initTelegramApp();

      // Check if running in Telegram
      const inTelegram = isTelegramMiniApp();
      setIsTelegram(inTelegram);

      if (!inTelegram) {
        // Not in Telegram - allow browsing but no auth
        setIsLoading(false);
        return;
      }

      // Get Telegram user data for immediate display
      const tgUser = getTelegramUser();
      setTelegramUser(tgUser);

      // Get initData for backend validation
      const initData = getTelegramInitData();
      if (!initData) {
        setError("No Telegram data available");
        setIsLoading(false);
        return;
      }

      // Validate with backend
      const { data, error: fnError } = await supabase.functions.invoke("telegram-auth", {
        body: { initData },
      });

      if (fnError) {
        console.error("Auth error:", fnError);
        setError("Authentication failed");
        setIsLoading(false);
        return;
      }

      if (data?.success && data?.user) {
        setUser(data.user);
      } else {
        setError(data?.error || "Authentication failed");
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError("Authentication error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user?.telegram_id) return;
    
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", user.telegram_id)
      .single();
    
    if (data) {
      setUser(data as User);
    }
  }, [user?.telegram_id]);

  const logout = useCallback(() => {
    setUser(null);
    setTelegramUser(null);
  }, []);

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
