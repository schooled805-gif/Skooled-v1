import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { setAuthTokenGetter } from '@workspace/api-client-react';

interface Profile {
  id: string;
  user_id: string;
  role: string;
  status: string;
  full_name: string;
  email: string;
  school_id: string;
  avatar_url?: string | null;
  phone?: string | null;
  must_change_password?: boolean;
}

export interface School {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  tuckshopUrl?: string | null;
  canteenEmail?: string | null;
  phases?: string[] | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: string | null;
  profile: Profile | null;
  schoolId: string | null;
  school: School | null;
  refreshSchool: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  profile: null,
  schoolId: null,
  school: null,
  refreshSchool: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [school, setSchool] = useState<School | null>(null);

  const fetchSchool = async (schoolId: string) => {
    try {
      const res = await fetch(`/api/schools/${schoolId}`);
      if (res.ok) {
        const data = await res.json();
        setSchool(data);
      }
    } catch {
      setSchool(null);
    }
  };

  const refreshSchool = async () => {
    if (profile?.school_id) await fetchSchool(profile.school_id);
  };

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user && session.access_token) {
      await fetchProfile(session.user, session.access_token);
    }
  };

  const fetchProfile = async (u: User, accessToken: string) => {
    try {
      const res = await fetch('/api/profiles/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        if (data?.school_id) {
          await fetchSchool(data.school_id);
        }
      }
    } catch {
      setProfile(null);
    }
  };

  // Wire the API client's auth getter so every generated hook sends the Bearer token.
  useEffect(() => {
    setAuthTokenGetter(() =>
      supabase.auth.getSession().then(({ data: { session } }) => session?.access_token ?? null),
    );
    return () => setAuthTokenGetter(null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user && session.access_token) {
        fetchProfile(session.user, session.access_token).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user && session.access_token) {
        fetchProfile(session.user, session.access_token).finally(() => setLoading(false));
      } else {
        setProfile(null);
        setSchool(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      role: profile?.role ?? null,
      profile,
      schoolId: profile?.school_id ?? null,
      school,
      refreshSchool,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
