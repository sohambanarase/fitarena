import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
const ACTIVE_KEY = "fitarena.activeChallenge";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [challenges, setChallenges] = useState([]); // ALL challenges I'm in
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) || null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async (uid) => {
    if (!uid) { setProfile(null); setChallenges([]); return; }
    const [{ data: p }, { data: cm }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).single(),
      supabase
        .from("challenge_members")
        .select("challenges(*)")
        .order("joined_at", { ascending: true }),
    ]);
    setProfile(p || null);
    const list = (cm || []).map((r) => r.challenges).filter(Boolean);
    setChallenges(list);
    // keep active valid; otherwise fall back to the first one
    setActiveId((cur) => (list.some((c) => c.id === cur) ? cur : list[0]?.id || null));
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

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId]);

  const activeChallenge = challenges.find((c) => c.id === activeId) || null;
  const refresh = useCallback(() => hydrate(session?.user?.id), [hydrate, session]);

  const value = {
    session,
    user: session?.user || null,
    profile,
    challenges,
    activeChallenge,
    setActiveId,
    loading,
    refresh,
    signOut: () => supabase.auth.signOut(),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
