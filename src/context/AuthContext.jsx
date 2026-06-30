import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
const ACTIVE_KEY = "fitarena.activeChallenge";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) || null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async (u) => {
    const uid = u?.id;
    if (!uid) { setProfile(null); setChallenges([]); return; }

    // 1) profile — self-heal if it's missing (e.g. signed up before setup, or trigger missed)
    let { data: p } = await supabase.from("profiles").select("*").eq("id", uid).single();
    if (!p) {
      const fallbackName = u.user_metadata?.name || u.email?.split("@")[0] || "Athlete";
      const { data: created } = await supabase
        .from("profiles").upsert({ id: uid, name: fallbackName }).select().single();
      p = created;
    }
    setProfile(p || null);

    // 2) my challenges
    const { data: cm } = await supabase
      .from("challenge_members").select("challenges(*)").order("joined_at", { ascending: true });
    const list = (cm || []).map((r) => r.challenges).filter(Boolean);
    setChallenges(list);
    setActiveId((cur) => (list.some((c) => c.id === cur) ? cur : list[0]?.id || null));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      hydrate(data.session?.user).finally(() => setLoading(false));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      hydrate(s?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, [hydrate]);

  useEffect(() => { if (activeId) localStorage.setItem(ACTIVE_KEY, activeId); }, [activeId]);

  const activeChallenge = challenges.find((c) => c.id === activeId) || null;
  const refresh = useCallback(() => hydrate(session?.user), [hydrate, session]);

  const value = {
    session, user: session?.user || null, profile, challenges, activeChallenge,
    setActiveId, loading, refresh, signOut: () => supabase.auth.signOut(),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
