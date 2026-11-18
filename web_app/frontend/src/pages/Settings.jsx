import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useTheme } from "../lib/theme";
import { CURRENCIES, LOCALES, allTimeZones, deviceTimeZone } from "../lib/regions";
import { RULE_QUESTIONS } from "../lib/rules";
import { resetTours } from "../lib/tours";
import { useAuth } from "../state/auth";
import { useAccount } from "../state/account";
import { Tiles } from "../components/Pick";
import RuleChooser from "../components/RuleChooser";
import { PageHeader } from "../components/Page";
import Avatar, { PRESETS, PresetArt, imageToAvatar } from "../components/Avatar";

const SECTIONS = [
  ["profile", "Profile"],
  ["region", "Region"],
  ["appearance", "Appearance"],
  ["rules", "Your rules"],
  ["security", "Password"],
  ["help", "Guided tour"],
  ["reset", "Start over"],
];

function Block({ id, title, hint, children }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-rule py-10 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-medium tracking-tight">{title}</h2>
      {hint && <p className="mt-1 max-w-prose text-sm text-graphite">{hint}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Saved({ state }) {
  if (!state) return null;
  return <span className={`text-sm ${state === "Saved" ? "text-gain" : "text-loss"}`}>{state}</span>;
}

function sample(locale) {
  const tag = locale === "auto" ? navigator.language : locale;
  const n = new Intl.NumberFormat(tag).format(1234567.89);
  const d = new Date().toLocaleDateString(tag);
  return `${n}  ${d}`;
}

function Region({ user, onSave }) {
  const [showAll, setShowAll] = useState(false);
  const [zoneQuery, setZoneQuery] = useState("");
  const names = Object.fromEntries(CURRENCIES);
  const popular = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD", "JPY"];
  const current = user.preferred_currency || "USD";
  const codes = showAll ? CURRENCIES.map(([c]) => c) : [...new Set([current, ...popular])].slice(0, 8);
  const zones = useMemo(() => {
    const q = zoneQuery.trim().toLowerCase().replace(/\s+/g, "_");
    return q.length < 2 ? [] : allTimeZones().filter((z) => z.toLowerCase().includes(q)).slice(0, 8);
  }, [zoneQuery]);
  const device = deviceTimeZone();

  return (
    <div className="space-y-10">
      <div>
        <h3 className="mb-3 text-sm text-graphite">Show prices in</h3>
        <Tiles
          label="Currency"
          value={current}
          onChange={(c) => onSave({ preferred_currency: c })}
          options={codes.map((c) => ({ value: c, label: c, hint: names[c] }))}
        />
        {!showAll && (
          <button onClick={() => setShowAll(true)} className="link mt-3 text-sm text-graphite">
            Show all {CURRENCIES.length} currencies
          </button>
        )}
        <p className="mt-3 text-xs text-graphite">Your practice account stays in US dollars; prices are converted at today's rate.</p>
      </div>

      <div>
        <h3 className="mb-3 text-sm text-graphite">Numbers and dates</h3>
        <Tiles
          label="Number and date style"
          columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          value={user.date_format?.includes("-") || user.date_format === "auto" ? user.date_format : "auto"}
          onChange={(l) => onSave({ date_format: l })}
          options={LOCALES.map(([value, label]) => ({ value, label, hint: sample(value) }))}
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm text-graphite">Time zone</h3>
        <p className="mb-3">
          <span className="font-medium">{(user.timezone || device).replace(/_/g, " ")}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {user.timezone !== device && (
            <button className="btn-quiet" onClick={() => onSave({ timezone: device })}>
              Use this device's ({device.replace(/_/g, " ")})
            </button>
          )}
        </div>
        <input
          type="search"
          value={zoneQuery}
          onChange={(e) => setZoneQuery(e.target.value)}
          placeholder="Search for a city"
          aria-label="Search time zones"
          className="field mt-3 max-w-sm"
        />
        {zones.length > 0 && (
          <div className="mt-3 flex max-w-xl flex-wrap gap-1.5">
            {zones.map((z) => (
              <button
                key={z}
                className="chip !py-1.5"
                onClick={() => {
                  onSave({ timezone: z });
                  setZoneQuery("");
                }}
              >
                {z.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AvatarPicker({ user, onSave }) {
  const [state, setState] = useState(null);
  const current = user.avatar || "";
  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setState("Uploading…");
    try {
      await onSave({ avatar: await imageToAvatar(file) });
      setState(null);
    } catch (err) {
      setState(err.message);
    }
  }
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <Avatar user={user} size={72} />
      <div className="flex-1">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Avatar">
          {Object.keys(PRESETS).map((name) => {
            const selected = current === `preset:${name}`;
            return (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={name}
                onClick={() => onSave({ avatar: `preset:${name}` })}
                className={`rounded-full p-0.5 ring-2 transition ${selected ? "ring-accent" : "ring-transparent hover:ring-rule"}`}
              >
                <PresetArt name={name} size={44} />
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="btn-quiet cursor-pointer">
            Upload a photo
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={upload} />
          </label>
          {current && (
            <button type="button" className="text-sm text-graphite hover:text-ink" onClick={() => onSave({ avatar: "" })}>
              Use my initial
            </button>
          )}
          {state && <span className="text-sm text-graphite">{state}</span>}
        </div>
      </div>
    </div>
  );
}

function Rules({ account, onSaved }) {
  const [values, setValues] = useState(account.rules);
  const [state, setState] = useState(null);
  const dirty = RULE_QUESTIONS.some((q) => values[q.key] !== account.rules[q.key]);
  async function save() {
    try {
      await api("/account/rules/", { method: "PUT", body: values });
      setState("Saved");
      onSaved();
    } catch (err) {
      setState(err.message);
    }
  }
  return (
    <>
      <div className="space-y-7">
        {RULE_QUESTIONS.map((q) => (
          <div key={q.key}>
            <p className="mb-3">{q.question}</p>
            <RuleChooser rule={q} value={values[q.key]} onChange={(v) => setValues({ ...values, [q.key]: v })} />
          </div>
        ))}
      </div>
      <div className="mt-8 flex items-center gap-3">
        <button className="btn-ink" disabled={!dirty} onClick={save}>
          Save rules
        </button>
        <Saved state={state} />
      </div>
    </>
  );
}

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const { data: account, reload } = useAccount();
  const navigate = useNavigate();
  const [theme, setTheme, themeChoice] = useTheme();
  const [name, setName] = useState(user.display_name || "");
  const [nameState, setNameState] = useState(null);
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [pwState, setPwState] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  async function saveProfile(patch) {
    const res = await api("/accounts/profile/", { method: "PUT", body: patch });
    setUser(res.data ?? res);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[12rem_1fr]">
      <nav className="hidden lg:block" aria-label="Settings sections">
        <ul className="sticky top-24 space-y-1 text-sm">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="block rounded-chip px-3 py-1.5 text-graphite hover:bg-sheet hover:text-ink">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="max-w-2xl">
        <div className="mb-10">
          <PageHeader title="Settings" sub="Your profile, how things look, and the rules you trade by." />
        </div>

        <Block id="profile" title="Profile">
          <AvatarPicker user={user} onSave={saveProfile} />
          <form
            className="mt-8 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await saveProfile({ display_name: name });
                setNameState("Saved");
              } catch (err) {
                setNameState(err.message);
              }
            }}
          >
            <label className="block">
              <span className="block text-sm text-graphite">Name</span>
              <input className="field mt-1.5 max-w-sm" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <p className="text-sm text-graphite">Signed in as {user.email}</p>
            <div className="flex items-center gap-3">
              <button className="btn-ink" disabled={name === user.display_name}>
                Save name
              </button>
              <Saved state={nameState} />
            </div>
          </form>
        </Block>

        <Block id="region" title="Region" hint="How money, numbers, dates and times appear to you.">
          <Region user={user} onSave={saveProfile} />
        </Block>

        <Block id="appearance" title="Appearance">
          <Tiles
            label="Theme"
            columns="grid-cols-3"
            value={themeChoice}
            onChange={setTheme}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "Match device", hint: `Now ${theme}` },
            ]}
          />
        </Block>

        <Block id="rules" title="Your rules" hint="When you hit one, new buys pause until it resets. Selling is always open.">
          {account && <Rules account={account} onSaved={reload} />}
        </Block>

        <Block id="security" title="Password" hint={user.has_password ? "At least 10 characters with letters and numbers. We also block passwords seen in data breaches." : undefined}>
          {!user.has_password ? (
            <p className="text-graphite">You sign in with Google, so there's no password to manage here.</p>
          ) : (
          <form
            className="max-w-sm space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/accounts/change-password/", { method: "POST", body: pw });
                setPw({ current_password: "", new_password: "" });
                setPwState("Saved");
              } catch (err) {
                setPwState(err.message);
              }
            }}
          >
            <label className="block">
              <span className="text-sm text-graphite">Current password</span>
              <input type="password" autoComplete="current-password" className="field mt-1.5" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required />
            </label>
            <label className="block">
              <span className="text-sm text-graphite">New password</span>
              <input type="password" autoComplete="new-password" className="field mt-1.5" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required />
            </label>
            <div className="flex items-center gap-3">
              <button className="btn-ink">Change password</button>
              <Saved state={pwState} />
            </div>
          </form>
          )}
        </Block>

        <Block id="help" title="Guided tour" hint="Walk through each page again, one step at a time.">
          <button
            className="btn-quiet"
            onClick={() => {
              resetTours(user.id);
              navigate("/");
            }}
          >
            Show me around again
          </button>
        </Block>

        <Block id="reset" title="Start over" hint="Close every position and get your starting cash back. Your journal and progress stay.">
          {confirmReset ? (
            <div className="flex gap-3">
              <button
                className="btn bg-loss text-white"
                onClick={async () => {
                  await api("/account/restart/", { method: "POST" });
                  setConfirmReset(false);
                  reload();
                  navigate("/portfolio");
                }}
              >
                Reset my portfolio
              </button>
              <button className="btn-quiet" onClick={() => setConfirmReset(false)}>
                Keep it
              </button>
            </div>
          ) : (
            <button className="btn-quiet" onClick={() => setConfirmReset(true)}>
              Start over
            </button>
          )}
        </Block>

        <div className="border-t border-rule pt-8">
          <button
            className="btn-quiet"
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
