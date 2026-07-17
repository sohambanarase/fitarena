import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import BottomNav from "./components/BottomNav.jsx";
import Loader from "./components/Loader.jsx";
import AuthScreen from "./screens/AuthScreen.jsx";
import Arena from "./screens/Arena.jsx";
import Grind from "./screens/Grind.jsx";
import Coach from "./screens/Coach.jsx";
import Playbook from "./screens/Playbook.jsx";
import Profile from "./screens/Profile.jsx";
import Count from "./screens/Count.jsx";

export default function App() {
  const { session, loading } = useAuth();

  if (loading)
    return (
      <div className="phone items-center justify-center">
        <Loader label="Stepping into the ring…" />
      </div>
    );

  if (!session) return <AuthScreen />;

  return (
    <div className="phone">
      <Routes>
        <Route path="/" element={<Arena />} />
        <Route path="/grind" element={<Grind />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/playbook" element={<Playbook />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/count" element={<Count />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
