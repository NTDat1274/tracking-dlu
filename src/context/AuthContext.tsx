// src/context/AuthContext.tsx
// Supabase Authentication với tính năng Tự động Đăng xuất sau 15 phút không hoạt động.
import React, {
  createContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  sessionExpiredMsg: string | null;
  clearSessionExpiredMsg: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

// Thời gian tự động đăng xuất: 15 phút = 15 * 60 * 1000 ms
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState<string | null>(
    null,
  );

  const lastActivityRef = useRef<number>(Date.now());
  const idleTimerRef = useRef<number | null>(null);

  const signOutInternal = useCallback(async (reason?: string) => {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn("Lỗi Supabase signOut:", err);
      }
    }
    setUser(null);
    setSession(null);

    if (reason) {
      setSessionExpiredMsg(reason);
    }
  }, []);

  const signOut = useCallback(async () => {
    await signOutInternal();
  }, [signOutInternal]);

  // Kiếm tra phiên đăng nhập ban đầu từ Supabase
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      const client = getSupabaseClient();
      if (!client) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const { data } = await client.auth.getSession();
        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          setLoading(false);
        }

        const { data: listener } = client.auth.onAuthStateChange(
          (_event, newSession) => {
            if (mounted) {
              setSession(newSession);
              setUser(newSession?.user ?? null);
            }
          },
        );

        return () => {
          listener.subscription.unsubscribe();
        };
      } catch (err) {
        console.warn("Lỗi khởi tạo Auth:", err);
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  // Bộ đếm Inactivity Idle Timer (Tự động đăng xuất sau 15 phút)
  useEffect(() => {
    if (!user) {
      if (idleTimerRef.current) {
        window.clearInterval(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }

    // Cập nhật timestamp khi người dùng thao tác
    const recordActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((evt) => {
      window.addEventListener(evt, recordActivity, { passive: true });
    });

    // Kiểm tra định kỳ mỗi 10 giây xem đã vượt quá 15 phút chưa
    idleTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        console.warn(
          "Không thao tác trong 15 phút. Tự động đăng xuất để đảm bảo bảo mật.",
        );
        signOutInternal(
          "Phiên làm việc đã hết hạn vì lý do bảo mật (Không thao tác trong 15 phút).",
        );
      }
    }, 10000);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, recordActivity);
      });
      if (idleTimerRef.current) {
        window.clearInterval(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [user, signOutInternal]);

  // Đăng nhập trực tiếp bằng tài khoản trên Supabase
  const signIn = async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    setSessionExpiredMsg(null);
    lastActivityRef.current = Date.now();
    const trimmedEmail = email.trim();
    const client = getSupabaseClient();

    if (!client) {
      return {
        success: false,
        error:
          "Chưa cấu hình Supabase! Vui lòng cài đặt Supabase URL & Key trong trang Cấu hình.",
      };
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      setUser(data.user);
      setSession(data.session);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Lỗi đăng nhập hệ thống",
      };
    }
  };

  const clearSessionExpiredMsg = () => setSessionExpiredMsg(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signOut,
        sessionExpiredMsg,
        clearSessionExpiredMsg,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export { useAuth } from "./useAuth";
