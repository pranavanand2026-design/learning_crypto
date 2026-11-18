import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth";
import { useApi } from "../lib/hooks";
import { useLiveTicks } from "../lib/live";
import { money, pct } from "../lib/format";
import { Wordmark } from "../components/Brand";
import CoinMark from "../components/CoinMark";
import GoogleButton from "../components/GoogleButton";
import LivePrice from "../components/LivePrice";

const ReCAPTCHA = lazy(() => import("react-google-recaptcha"));

function Showcase() {
  const { data } = useApi("/market/");
  const rows = (data?.results || []).filter((r) => r.live_product).slice(0, 6);
  const ticks = useLiveTicks(rows.map((r) => r.live_product));
  return (
    <div className="relative hidden overflow-hidden bg-floor text-on-floor lg:flex lg:flex-col lg:justify-end">
      <img src="/hero.webp" alt="" aria-hidden className="hero-photo absolute inset-0 h-full w-full object-cover object-[85%_bottom]" />
      <div className="absolute inset-0 bg-gradient-to-t from-floor via-floor/50 to-floor/10" />
      <ul className="relative m-10 grid grid-cols-2 gap-px overflow-hidden rounded-sheet bg-on-floor/10 backdrop-blur-sm" aria-label="Live prices">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 bg-floor/70 px-4 py-3.5">
            <CoinMark src={r.image} symbol={r.symbol} size={22} />
            <span className="flex-1 text-sm text-on-floor/70">{r.symbol}</span>
            <span className="text-right">
              <LivePrice value={ticks[r.live_product]?.price ?? r.price} className="block text-sm" />
              <span className={`num block text-xs ${r.change_24h >= 0 ? "text-gain-hi" : "text-loss-hi"}`}>{pct(r.change_24h)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Frame({ title, sub, children, shakeKey }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-6 md:px-12">
        <Wordmark />
        <div className="flex flex-1 items-center">
          <div key={shakeKey} className={`sheet-in w-full max-w-sm py-12 ${shakeKey ? "shake" : ""}`}>
            <h1 className="text-3xl font-light tracking-tight">{title}</h1>
            {sub && <p className="mt-2 text-graphite">{sub}</p>}
            {children}
          </div>
        </div>
      </div>
      <Showcase />
    </div>
  );
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-accent/40 border-t-on-accent" aria-hidden />;
}

function Captcha({ siteKey, onChange, captchaRef }) {
  if (!siteKey) return null;
  return (
    <Suspense fallback={null}>
      <ReCAPTCHA ref={captchaRef} sitekey={siteKey} onChange={onChange} />
    </Suspense>
  );
}

function Field({ label, type = "text", ...props }) {
  const [show, setShow] = useState(false);
  const secret = type === "password";
  return (
    <label className="group block">
      <span className="text-sm text-graphite transition-colors group-focus-within:text-accent">{label}</span>
      <span className="relative mt-1.5 block">
        <input
          {...props}
          type={secret && show ? "text" : type}
          className="field !py-3 transition-shadow focus:!border-accent focus:shadow-[0_0_0_4px_rgb(var(--accent)/0.15)]"
        />
        {secret && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute inset-y-0 right-0 px-3 text-xs text-graphite hover:text-ink"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? "Hide" : "Show"}
          </button>
        )}
      </span>
    </label>
  );
}

function Strength({ password }) {
  const score = [password.length >= 10, /\d/.test(password) && /[a-z]/i.test(password), /[^a-z0-9]/i.test(password), password.length >= 14].filter(Boolean).length;
  const label = ["", "Weak", "Okay", "Good", "Strong"][score];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < score ? (score < 2 ? "bg-loss" : score < 3 ? "bg-warm" : "bg-accent") : "bg-rule"}`} />
        ))}
      </div>
      {password && <span className="mt-1 block text-xs text-graphite">{label}</span>}
    </div>
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
  const [fails, setFails] = useState(0);
  const captchaRef = useRef(null);
  const onGoogle = useGoogle(setError, setFails);
  if (user) return <Navigate to={location.state?.from || "/"} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form.email.trim().toLowerCase(), form.password, captcha);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      if (err.status === 429 && err.body?.retry_at) {
        const mins = Math.max(1, Math.ceil((new Date(err.body.retry_at) - Date.now()) / 60000));
        setError(`Too many attempts. For your security, try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
      } else {
        setError(err.status === 401 ? "That email and password don't match." : err.message);
      }
      setFails((n) => n + 1);
      captchaRef.current?.reset();
      setCaptcha(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame title="Welcome back" sub="Your portfolio is where you left it." shakeKey={fails}>
      {config.google_client_id && (
        <div className="mt-8">
          <GoogleButton clientId={config.google_client_id} onCredential={onGoogle} text="signin_with" />
          <Or />
        </div>
      )}
      <form onSubmit={submit} className={`${config.google_client_id ? "" : "mt-8"} space-y-5`}>
        <Field label="Email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Field label="Password" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Captcha siteKey={config.recaptcha_site_key} onChange={setCaptcha} captchaRef={captchaRef} />
        {error && <p className="text-sm text-loss" role="alert">{error}</p>}
        <button className="btn-accent btn-lift w-full !py-3.5" disabled={busy || (config.recaptcha_site_key && !captcha)}>
          {busy ? <Spinner /> : null}
          {busy ? "Logging in" : "Log in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-graphite">
        New here?{" "}
        <Link to="/signup" className="link-draw font-medium text-accent">
          Create an account
        </Link>
      </p>
    </Frame>
  );
}

const RULES = [
  { test: (p) => p.length >= 10, label: "10 or more characters" },
  { test: (p) => /\d/.test(p) && /[a-z]/i.test(p), label: "Letters and numbers" },
];

function Or() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-graphite">
      <span className="h-px flex-1 bg-rule" />
      or
      <span className="h-px flex-1 bg-rule" />
    </div>
  );
}

function useGoogle(setError, setFails) {
  const { googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    async (credential) => {
      try {
        const created = await googleLogin(credential);
        navigate(created ? "/welcome" : location.state?.from || "/", { replace: true });
      } catch (err) {
        setError(err.message);
        setFails((n) => n + 1);
      }
    },
    [googleLogin, navigate, location.state, setError, setFails],
  );
}

export function Signup() {
  const { user, signup, config } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ display_name: "", email: "", password: "" });
  const [captcha, setCaptcha] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fails, setFails] = useState(0);
  const onGoogle = useGoogle(setError, setFails);
  if (user) return <Navigate to="/" replace />;
  const strong = RULES.every((r) => r.test(form.password));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signup({ ...form, email: form.email.trim().toLowerCase(), captcha_token: captcha });
      navigate("/welcome", { replace: true });
    } catch (err) {
      if (err.status === 400 && err.message.includes("captcha")) {
        navigate("/login", { state: { notice: "Account created. Log in to continue." } });
      } else {
        setError(err.message);
        setFails((n) => n + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame title="Create your account" sub={`Start with ${money(config.starting_cash, { digits: 0, raw: true })} in practice money.`} shakeKey={fails}>
      {config.google_client_id && (
        <div className="mt-8">
          <GoogleButton clientId={config.google_client_id} onCredential={onGoogle} text="signup_with" />
          <Or />
        </div>
      )}
      <form onSubmit={submit} className={`${config.google_client_id ? "" : "mt-8"} space-y-5`}>
        <Field label="Name" autoComplete="name" required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
        <Field label="Email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <div>
          <Field label="Password" type="password" autoComplete="new-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Strength password={form.password} />
        </div>
        <Captcha siteKey={config.recaptcha_site_key} onChange={setCaptcha} />
        {error && <p className="text-sm text-loss" role="alert">{error}</p>}
        <button className="btn-accent btn-lift w-full !py-3.5" disabled={busy || !strong || (config.recaptcha_site_key && !captcha)}>
          {busy ? <Spinner /> : null}
          {busy ? "Creating account" : strong ? "Create account" : "10+ characters, letters and numbers"}
        </button>
      </form>
      <p className="mt-6 text-sm text-graphite">
        Already trading?{" "}
        <Link to="/login" className="link-draw font-medium text-accent">
          Log in
        </Link>
      </p>
    </Frame>
  );
}
