import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./state/auth";
import Shell from "./components/Shell";
import Market from "./pages/Market";
import Coin from "./pages/Coin";
import Portfolio from "./pages/Portfolio";
import Journal from "./pages/Journal";
import Progress from "./pages/Progress";
import Settings from "./pages/Settings";
import Welcome from "./pages/Welcome";
import { Login, Signup } from "./pages/Auth";
import { Empty, Loading } from "./components/States";

function Private({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  const { ready } = useAuth();
  if (!ready) return null;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route element={<Shell />}>
        <Route index element={<Market />} />
        <Route path="coin/:id" element={<Coin />} />
        <Route path="portfolio" element={<Private><Portfolio /></Private>} />
        <Route path="journal" element={<Private><Journal /></Private>} />
        <Route path="progress" element={<Private><Progress /></Private>} />
        <Route path="settings" element={<Private><Settings /></Private>} />
        <Route path="account" element={<Navigate to="/settings" replace />} />
        <Route path="*" element={<Empty title="This page doesn't exist.">Head back to the market.</Empty>} />
      </Route>
    </Routes>
  );
}
