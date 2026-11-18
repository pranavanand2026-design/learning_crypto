// Live prices straight from Coinbase Exchange's public WebSocket feed.
// One shared socket; components subscribe to product ids (e.g. "BTC-USD").
import { useEffect, useState } from "react";

const URL = "wss://ws-feed.exchange.coinbase.com";
const listeners = new Map(); // product -> Set<fn>
const latest = new Map();    // product -> { price, time }
let socket = null;
let backoff = 1000;
let statusListeners = new Set();
let status = "idle";

function setStatus(next) {
  status = next;
  statusListeners.forEach((fn) => fn(next));
}

function send(type, products) {
  if (socket?.readyState === WebSocket.OPEN && products.length) {
    socket.send(JSON.stringify({ type, product_ids: products, channels: ["ticker"] }));
  }
}

function connect() {
  if (socket || typeof WebSocket === "undefined") return;
  setStatus("connecting");
  socket = new WebSocket(URL);
  socket.onopen = () => {
    backoff = 1000;
    setStatus("live");
    send("subscribe", [...listeners.keys()]);
  };
  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type !== "ticker" || !msg.price) return;
    const tick = { price: Number(msg.price), time: msg.time, open24h: Number(msg.open_24h) };
    latest.set(msg.product_id, tick);
    listeners.get(msg.product_id)?.forEach((fn) => fn(tick));
  };
  socket.onclose = () => {
    socket = null;
    setStatus("offline");
    if (listeners.size) setTimeout(connect, (backoff = Math.min(backoff * 2, 30000)));
  };
  socket.onerror = () => socket?.close();
}

function subscribe(product, fn) {
  if (!listeners.has(product)) {
    listeners.set(product, new Set());
    send("subscribe", [product]);
  }
  listeners.get(product).add(fn);
  connect();
  return () => {
    const set = listeners.get(product);
    set?.delete(fn);
    if (set && !set.size) {
      listeners.delete(product);
      send("unsubscribe", [product]);
    }
  };
}

/** Map of product id -> latest tick for the given products, batched per frame. */
export function useLiveTicks(products) {
  const key = (products || []).filter(Boolean).sort().join(",");
  const [ticks, setTicks] = useState({});

  useEffect(() => {
    if (!key) return;
    let pending = {};
    let frame = null;
    const flush = () => {
      frame = null;
      const batch = pending;
      pending = {};
      setTicks((t) => ({ ...t, ...batch }));
    };
    const offs = key.split(",").map((p) =>
      subscribe(p, (tick) => {
        pending[p] = tick;
        if (!frame) frame = requestAnimationFrame(flush);
      }),
    );
    const initial = {};
    key.split(",").forEach((p) => latest.has(p) && (initial[p] = latest.get(p)));
    setTicks(initial);
    return () => {
      offs.forEach((off) => off());
      if (frame) cancelAnimationFrame(frame);
    };
  }, [key]);

  return ticks;
}

export function useLiveStatus() {
  const [s, setS] = useState(status);
  useEffect(() => {
    statusListeners.add(setS);
    return () => statusListeners.delete(setS);
  }, []);
  return s;
}
