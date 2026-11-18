import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { CURRENCIES, deviceTimeZone, guessCurrency } from "../lib/regions";
import { DEFAULT_RULES, RULE_QUESTIONS } from "../lib/rules";
import { useAuth } from "../state/auth";
import { useAccount } from "../state/account";
import { Wordmark } from "../components/Brand";
import { Steps, Tiles } from "../components/Pick";
import CoinMark from "../components/CoinMark";

const POPULAR = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD", "JPY"];

function Currency({ value, onChange }) {
  const [all, setAll] = useState(false);
  const guessed = guessCurrency();
  const codes = all ? CURRENCIES.map(([c]) => c) : [guessed, ...POPULAR.filter((c) => c !== guessed)].slice(0, 8);
  const names = Object.fromEntries(CURRENCIES);
  return (
    <>
      <Tiles
        label="Currency"
        value={value}
        onChange={onChange}
        options={codes.map((c) => ({ value: c, label: c, hint: names[c] }))}
      />
      {!all && (
        <button type="button" onClick={() => setAll(true)} className="link mt-4 text-sm text-graphite">
          Show all {CURRENCIES.length} currencies
        </button>
      )}
    </>
  );
}

function FirstCoin({ onPick }) {
  const { data } = useApi("/market/");
  const coins = (data?.results || []).filter((r) => r.live_product).slice(0, 6);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {coins.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c.id)}
          className="flex items-center gap-3 rounded-sheet border border-rule bg-sheet px-4 py-4 text-left transition-colors hover:border-ink/40"
        >
          <CoinMark src={c.image} symbol={c.symbol} size={28} />
          <span>
            <span className="block font-medium">{c.name}</span>
            <span className="block text-xs text-graphite">{c.symbol}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export default function Welcome() {
  const { user, setUser } = useAuth();
  const { data: account, reload } = useAccount();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [currency, setCurrency] = useState(user?.preferred_currency !== "USD" ? user?.preferred_currency : guessCurrency());
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [saving, setSaving] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (account?.onboarded && step === 0) return <Navigate to="/portfolio" replace />;

  const first = (user.display_name || "").split(" ")[0];
  const total = 3 + RULE_QUESTIONS.length;
  const ruleIndex = step - 2;
  const rule = RULE_QUESTIONS[ruleIndex];

  async function finish(destination) {
    setSaving(true);
    try {
      await api("/account/rules/", { method: "PUT", body: { ...rules, onboarded: true } });
      const res = await api("/accounts/profile/", { method: "PUT", body: { preferred_currency: currency, timezone: deviceTimeZone() } });
      reload();
      setUser(res.data ?? res);
      navigate(destination, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  let title, body, next;
  if (step === 0) {
    title = `Welcome${first ? `, ${first}` : ""}.`;
    body = (
      <p className="text-md text-graphite">
        You have 10,000 US dollars of practice money. Prices are live, fees are real, and nothing you do here costs anything. Let's set up how you want to trade.
      </p>
    );
    next = "Set up";
  } else if (step === 1) {
    title = "Which currency do you think in?";
    body = <Currency value={currency} onChange={setCurrency} />;
    next = "Continue";
  } else if (rule) {
    title = rule.question;
    body = (
      <>
        <p className="-mt-2 mb-6 text-graphite">{rule.hint}</p>
        <Tiles size="lg" label={rule.question} value={rules[rule.key]} onChange={(v) => setRules({ ...rules, [rule.key]: v })} options={rule.options} />
      </>
    );
    next = "Continue";
  } else {
    title = "Pick a coin to start with.";
    body = (
      <>
        <ul className="-mt-2 mb-8 space-y-1 text-graphite">
          {RULE_QUESTIONS.map((q) => (
            <li key={q.key}>{q.summary(rules[q.key])}.</li>
          ))}
          <li className="pt-2 text-sm">Change these whenever you like in settings.</li>
        </ul>
        <FirstCoin onPick={(id) => finish(`/coin/${id}?trade=buy`)} />
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-6">
        <div className="flex items-center gap-6">
          <Wordmark />
          <div className="flex-1">
            <Steps count={total} current={step} />
          </div>
        </div>

        <div key={step} className="sheet-in flex flex-1 flex-col justify-center py-12">
          <h1 className="mb-6 text-3xl font-light leading-tight tracking-tight md:text-4xl">{title}</h1>
          {body}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-rule pt-5">
          {step > 0 ? (
            <button type="button" className="btn-quiet" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : (
            <span />
          )}
          {next ? (
            <button type="button" className="btn-ink min-w-32" onClick={() => setStep(step + 1)}>
              {next}
            </button>
          ) : (
            <button type="button" className="btn-quiet" disabled={saving} onClick={() => finish("/")}>
              {saving ? "Saving…" : "Just look around"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
