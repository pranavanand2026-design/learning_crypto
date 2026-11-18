import { lazy, Suspense, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth";
import { useApi } from "../lib/hooks";
import { useLiveTicks } from "../lib/live";
import { money, pct, tone } from "../lib/format";
import { Wordmark } from "../components/Shell";
import CoinMark from "../components/CoinMark";
import LivePrice from "../components/LivePrice";

const ReCAPTCHA = lazy(() => import("react-google-recaptcha"));

function Tape() {
  const { data } = useApi("/market/");
  const rows = (data?.results || []).filter((r) => r.live_product).slice(0, 9);
  const ticks = useLiveTicks(rows.map((r) => r.live_product));
  return (
    <ul className="ruled w-full max-w-sm" aria-label="Live prices">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3 py-3">
          <CoinMark src={r.image} symbol={r.symbol} size={22} />
          <span className="flex-1 text-sm">{r.name}</span>
          <LivePrice value={ticks[r.live_product]?.price ?? r.price} className="text-sm" />
          <span className={`num w-16 text-right text-xs ${tone(r.change_24h)}`}>{pct(r.change_24h)}</span>
        </li>
      ))}
    </ul>
  );
}

function Frame({ title, children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col px-6 py-6 md:px-12">
        <Wordmark />
        <div className="flex flex-1 items-center">
          <div className="w-full max-w-sm py-12">
            <h1 className="text-2xl font-light tracking-tight">{title}</h1>
            {children}
          </div>
        </div>
      </div>
      <div className="hidden flex-col items-center justify-center border-l border-rule bg-sheet px-12 lg:flex">
        <Tape />
      </div>
    </div>
  );
}

function Captcha({ siteKey, onChange, captchaRef }) {
  if (!siteKey) return null;
  return (
    <Suspense fallback={null}>
      <ReCAPTCHA ref={captchaRef} sitekey={siteKey} onChange={onChange} />
    </Suspense>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="text-sm text-graphite">{label}</span>
      <input {...props} className="field mt-1.5" />
    </label>
  );
}

export function Login() {
  const { user, login, config } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [captcha, setCaptcha] = useState(null);
  const [error, setError] = useState(location.state?.notice || null);
  const [busy, setBusy] = useState(false);
  const captchaRef = useRef(null);
  if (user) return <Navigate to={location.state?.from || "/"} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form.email.trim().toLowerCase(), form.password, captcha);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(err.status === 401 ? "That email and password don't match." : err.message);
      captchaRef.current?.reset();
      setCaptcha(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame title="Welcome back">
      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="Email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Field label="Password" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Captcha siteKey={config.recaptcha_site_key} onChange={setCaptcha} captchaRef={captchaRef} />
        {error && <p className="text-sm text-loss" role="alert">{error}</p>}
        <button className="btn-ink w-full !py-3" disabled={busy || (config.recaptcha_site_key && !captcha)}>
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-graphite">
        New here?{" "}
        <Link to="/signup" className="link text-ink">
          Create an account
        </Link>
      </p>
    </Frame>
  );
}

const RULES = [
  { test: (p) => p.length >= 8, label: "8 or more characters" },
  { test: (p) => /\d/.test(p) && /[a-z]/i.test(p), label: "Letters and numbers" },
];

export function Signup() {
  const { user, signup, config } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ display_name: "", email: "", password: "" });
  const [captcha, setCaptcha] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const strong = RULES.every((r) => r.test(form.password));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signup({ ...form, email: form.email.trim().toLowerCase(), captcha_token: captcha });
      navigate("/", { replace: true });
    } catch (err) {
      if (err.status === 400 && err.message.includes("captcha")) {
        navigate("/login", { state: { notice: "Account created. Log in to continue." } });
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame title="Create your account">
      <p className="mt-2 text-graphite">You'll start with {money(config.starting_cash, { digits: 0 })} in paper money.</p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="Name" autoComplete="name" required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
        <Field label="Email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <div>
          <Field label="Password" type="password" autoComplete="new-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <ul className="mt-2 flex gap-4 text-xs">
            {RULES.map((r) => (
              <li key={r.label} className={r.test(form.password) ? "text-gain" : "text-graphite"}>
                {r.label}
              </li>
            ))}
          </ul>
        </div>
        <Captcha siteKey={config.recaptcha_site_key} onChange={setCaptcha} />
        {error && <p className="text-sm text-loss" role="alert">{error}</p>}
        <button className="btn-ink w-full !py-3" disabled={busy || !strong || (config.recaptcha_site_key && !captcha)}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-sm text-graphite">
        Already trading?{" "}
        <Link to="/login" className="link text-ink">
          Log in
        </Link>
      </p>
    </Frame>
  );
}
