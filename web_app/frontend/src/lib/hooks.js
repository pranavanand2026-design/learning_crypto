import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

/** Fetch JSON from the API; refetch with `reload`, poll with `interval`. */
export function useApi(path, { interval, enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path && enabled) });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!path || !enabled) return;
    const ctrl = new AbortController();
    let timer;
    const run = (quiet) => {
      if (!quiet) setState((s) => ({ ...s, loading: true }));
      api(path, { signal: ctrl.signal })
        .then((data) => setState({ data, error: null, loading: false }))
        .catch((error) => {
          if (error.name !== "AbortError") setState((s) => ({ ...s, error, loading: false }));
        });
    };
    run(false);
    if (interval) timer = setInterval(() => run(true), interval);
    return () => {
      ctrl.abort();
      clearInterval(timer);
    };
  }, [path, enabled, interval, nonce]);

  return { ...state, reload, setData: (data) => setState((s) => ({ ...s, data })) };
}

/** Remember the previous value of a prop. */
export function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
