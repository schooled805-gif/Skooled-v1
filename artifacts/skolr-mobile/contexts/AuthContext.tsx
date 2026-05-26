import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { registerForPushNotificationsAsync } from "@/hooks/usePushNotifications";

interface Profile {
  id: string;
  user_id: string;
  role: string;
  full_name: string;
  email: string;
  school_id: string;
  avatar_url?: string | null;
  phone?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  role: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const baseUrl = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : "";

  const registerPushToken = useCallback(
    async (u: User) => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (!token) return;
        await fetch(`${baseUrl}/api/profiles/me/push-token`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": u.id,
          },
          body: JSON.stringify({ push_token: token }),
        });
      } catch {
        // Non-fatal — push notifications are best-effort
      }
    },
    [baseUrl],
  );

  const fetchProfile = useCallback(
    async (u: User) => {
      try {
        const res = await fetch(`${baseUrl}/api/profiles/me`, {
          headers: { "x-user-id": u.id },
        });
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch {
        setProfile(null);
      }
    },
    [baseUrl],
  );

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user);
  }, [user, fetchProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user).finally(() => setLoading(false));
        registerPushToken(s.user);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user);
        registerPushToken(s.user);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, registerPushToken]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role: profile?.role ?? null,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
