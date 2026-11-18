import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../state/auth";
import { useTheme } from "../lib/theme";

export default function Account() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useTheme();
  const [name, setName] = useState(user.display_name || "");
  const [nameState, setNameState] = useState(null);
  const [pw, setPw] = useState({ old_password: "", new_password: "" });
  const [pwState, setPwState] = useState(null);

  async function saveName(e) {
    e.preventDefault();
    try {
      const res = await api("/accounts/profile/", { method: "PUT", body: { display_name: name } });
      setUser(res.data ?? res);
      setNameState("Saved");
    } catch (err) {
      setNameState(err.message);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    try {
      await api("/accounts/change-password/", { method: "POST", body: pw });
      setPw({ old_password: "", new_password: "" });
      setPwState("Password changed");
    } catch (err) {
      setPwState(err.message);
    }
  }

  return (
    <div className="max-w-xl space-y-14">
      <div>
        <h1 className="text-2xl font-light tracking-tight">Account</h1>
        <p className="mt-1 text-graphite">{user.email}</p>
      </div>

      <form onSubmit={saveName} className="space-y-3">
        <label className="block">
          <span className="text-sm text-graphite">Name</span>
          <input className="field mt-1.5" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="flex items-center gap-3">
          <button className="btn-ink" disabled={name === user.display_name}>
            Save name
          </button>
          {nameState && <span className="text-sm text-graphite">{nameState}</span>}
        </div>
      </form>

      <form onSubmit={savePassword} className="space-y-3">
        <label className="block">
          <span className="text-sm text-graphite">Current password</span>
          <input type="password" autoComplete="current-password" className="field mt-1.5" value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} required />
        </label>
        <label className="block">
          <span className="text-sm text-graphite">New password</span>
          <input type="password" autoComplete="new-password" className="field mt-1.5" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required />
        </label>
        <div className="flex items-center gap-3">
          <button className="btn-ink">Change password</button>
          {pwState && <span className="text-sm text-graphite">{pwState}</span>}
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-8">
        <div className="flex gap-1.5" role="radiogroup" aria-label="Theme">
          {["light", "dark"].map((t) => (
            <button key={t} role="radio" aria-checked={theme === t} onClick={() => setTheme(t)} className="chip capitalize">
              {t}
            </button>
          ))}
        </div>
        <button
          className="btn-quiet ml-auto"
          onClick={async () => {
            await logout();
            navigate("/login");
          }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}
