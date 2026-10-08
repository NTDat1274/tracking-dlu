// src/context/AuthContext.tsx
// Supabase Authentication với tính năng Phân quyền Vai trò (Admin / Student) và Tự động Đăng xuất sau 15 phút.
import React, {
  createContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getSupabaseClient, fetchUserAccount } from "../lib/supabase";
import type { AccountRecord, UserRole } from "../data/types";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  account: AccountRecord | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  sessionExpiredMsg: string | null;
  clearSessionExpiredMsg: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

// Thời gian tự động đăng xuất: 15 phút = 15 * 60 * 1000 ms
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Đường dẫn landing page mặc định cho từng role sau khi Login.
 * - admin    -> '/overview'           (Dashboard toàn quyền - WebApp quản lý state overview)
 * - lecturer -> '/lecturer-portal'    (Cổng giảng viên - sẽ tạo ở Task 1.2)
 * - student  -> '/student-portal'     (Cổng sinh viên cá nhân)
 * - fallback -> '/login'
 */
export function getDefaultLandingPathForRole(role: UserRole | null | undefined): string {
  switch (role) {
    case "admin":
      return "/overview";
    case "lecturer":
      return "/lecturer-portal";
    case "student":
      return "/student-portal";
    default:
      return "/login";
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<AccountRecord | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState<string | null>(
    null,
  );

  const lastActivityRef = useRef<number>(Date.now());
  const idleTimerRef = useRef<number | null>(null);

  const loadAccount = useCallback(async (userId: string, userEmail?: string) => {
    const acc = await fetchUserAccount(userId);
    if (acc) {
      setAccount(acc);
      setRole(acc.role);
    } else {
      // Xác định role khởi tạo dựa trên email hoặc mặc định
      // 3 vai trò được hỗ trợ: 'admin' | 'lecturer' | 'student'
      const client = getSupabaseClient();
      const normalizedEmail = (userEmail || "").toLowerCase();
      const isAdminEmail = normalizedEmail.includes("admin");
      const isLecturerEmail =
        normalizedEmail.includes("lecturer") ||
        normalizedEmail.includes("giangvien") ||
        normalizedEmail.includes("giang_vien") ||
        normalizedEmail.startsWith("gv") ||
        normalizedEmail.includes(".gv@");
      const initialRole: UserRole = isAdminEmail
        ? "admin"
        : isLecturerEmail
          ? "lecturer"
          : "student";
      const fallbackAcc: AccountRecord = {
        id: userId,
        email: userEmail || "",
        role: initialRole,
        student_id: null,
      };

      if (client) {
        try {
          await client.from("accounts").upsert({
            id: userId,
            email: userEmail || "",
            role: initialRole,
          });
        } catch (err) {
          console.warn("Chưa thể tự động ghi vào bảng accounts:", err);
        }
      }

      setAccount(fallbackAcc);
      setRole(initialRole);
    }
  }, []);

  const refreshAccount = useCallback(async () => {
    if (user) {
      await loadAccount(user.id, user.email ?? undefined);
    }
  }, [user, loadAccount]);

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
    setAccount(null);
    setRole(null);

    if (reason) {
      setSessionExpiredMsg(reason);
    }
  }, []);

  const signOut = useCallback(async () => {
    await signOutInternal();
  }, [signOutInternal]);

  // Kiểm tra phiên đăng nhập ban đầu từ Supabase
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
          if (data.session?.user) {
            await loadAccount(
              data.session.user.id,
              data.session.user.email ?? undefined,
            );
          }
          setSession(data.session);
          setUser(data.session?.user ?? null);
          setLoading(false);
        }

        const { data: listener } = client.auth.onAuthStateChange(
          async (_event, newSession) => {
            if (mounted) {
              if (newSession?.user) {
                await loadAccount(
                  newSession.user.id,
                  newSession.user.email ?? undefined,
                );
                setSession(newSession);
                setUser(newSession.user);
              } else {
                setSession(null);
                setUser(null);
                setAccount(null);
                setRole(null);
              }
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
  }, [loadAccount]);

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

      if (data.user) {
        await loadAccount(data.user.id, data.user.email ?? undefined);
      }
      setSession(data.session);
      setUser(data.user);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Lỗi đăng nhập hệ thống",
      };
    }
  };

  // Đăng ký tài khoản sinh viên mới trên Supabase
  const signUp = async (
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
      const { data, error } = await client.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          // Role mặc định cho tài khoản mới đăng ký qua form self-service.
          // 3 giá trị được hỗ trợ: 'admin' | 'lecturer' | 'student'.
          // Form đăng ký công khai chỉ cấp quyền 'student'; admin/lecturer
          // được cấp phát qua quy trình nội bộ (cập nhật bảng accounts).
          data: {
            role: "student",
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        // Tự động tạo bản ghi trong accounts với role 'student'
        try {
          await client.from("accounts").upsert({
            id: data.user.id,
            email: trimmedEmail,
            role: "student",
          });
        } catch (insertErr) {
          console.warn("Chưa thể tự động ghi vào accounts khi signUp:", insertErr);
        }
      }

      if (data.session && data.user) {
        await loadAccount(data.user.id, trimmedEmail);
        setSession(data.session);
        setUser(data.user);
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Lỗi đăng ký tài khoản sinh viên",
      };
    }
  };

  const clearSessionExpiredMsg = () => setSessionExpiredMsg(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        account,
        role,
        loading,
        signIn,
        signUp,
        signOut,
        refreshAccount,
        sessionExpiredMsg,
        clearSessionExpiredMsg,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export { useAuth } from "./useAuth";
