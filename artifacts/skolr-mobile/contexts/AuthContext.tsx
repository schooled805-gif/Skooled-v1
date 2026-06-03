import React, { createContext, useContext, useEffect, useState } from "react";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  user_id: string;
  role: "student" | "parent" | "teacher" | "admin";
  full_name: string;
  email: string;
  school_id: string | null;
  avatar_url?: string | null;
  phone?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  const fetchProfile = async (userId: string, email: string, token: string) => {
    if (!baseUrl) return;
    try {
      setProfileLoading(true);
      const res = await fetch(`${baseUrl}/api/profiles/me`, {
        headers: {
          "x-user-id": userId,
          "x-user-email": email,
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data as Profile);
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setAuthTokenGetter(async () => {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ?? null;
        });
        fetchProfile(s.user.id, s.user.email ?? "", s.access_token);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          setAuthTokenGetter(async () => {
            const { data } = await supabase.auth.getSession();
            return data.session?.access_token ?? null;
          });
          await fetchProfile(s.user.id, s.user.email ?? "", s.access_token ?? "");
        } else {
          setProfile(null);
          setAuthTokenGetter(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
  };

  const refreshProfile = async () => {
    if (user && session) {
      await fetchProfile(user.id, user.email ?? "", session.access_token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        profileLoading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
