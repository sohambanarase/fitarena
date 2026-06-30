import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [challenge, setChallenge] = useState(null); // the user's active challenge
  const [loading, setLoading] = useState(true);

  // Load profile + first challenge for a user id.
  const hydrate = useCallback(async (uid) => {
    if (!uid) {
      setProfile(null);
      setChallenge(null);
      return;
    }
    const [{ data: p }, { data: cm }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).single(),
      supabase
        .from("challenge_members")
        .select("challenges(*)")
        .order("joined_at", { ascending: true })
        .limit(1),
    ]);
    setProfile(p || null);
    setChallenge(cm?.[0]?.challenges || null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      hydrate(data.session?.user?.id).finally(() => setLoading(false));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      hydrate(s?.user?.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [hydrate]);

  const refresh = useCallback(
    () => hydrate(session?.user?.id),
    [hydrate, session]
  );

  const value = {
    session,
    user: session?.user || null,
    profile,
    challenge,
    loading,
    refresh,
    setChallenge,
    signOut: () => supabase.auth.signOut(),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
