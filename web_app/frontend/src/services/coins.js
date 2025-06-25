// src/services/coins.js
import axios from "axios";

const API_URL = "http://localhost:8000/api";

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: { "Content-Type": "application/json" },
});

// small static fallback in case everything else is empty/offline
const FALLBACK_COINS = [
    { id: "bitcoin", symbol: "btc", name: "Bitcoin" },
    { id: "ethereum", symbol: "eth", name: "Ethereum" },
    { id: "tether", symbol: "usdt", name: "Tether" },
    { id: "binancecoin", symbol: "bnb", name: "BNB" },
    { id: "usd-coin", symbol: "usdc", name: "USDC" },
    { id: "ripple", symbol: "xrp", name: "XRP" },
    { id: "cardano", symbol: "ada", name: "Cardano" },
    { id: "dogecoin", symbol: "doge", name: "Dogecoin" },
    { id: "solana", symbol: "sol", name: "Solana" },
    { id: "tron", symbol: "trx", name: "TRON" },
];

export async function listCoins(pageSize = 25) {
    try {
        const { data } = await api.get(`/coins/?page_size=${pageSize}`);
        return data?.results ?? [];
    } catch {
        return [];
    }
}

export async function searchCoins(query, pageSize = 25) {
    try {
        const params = new URLSearchParams();
        if (query) params.set("search", query);
        params.set("page_size", String(pageSize));
        const { data } = await api.get(`/coins/?${params.toString()}`);
        return data?.results ?? [];
    } catch {
        return [];
    }
}

export async function marketTopCoins(limit = 50) {
    try {
        const { data } = await api.get(`/markets/?limit=${limit}`);
        return (data?.data ?? []).map((m) => ({
            id: m?.id,
            symbol: m?.symbol,
            name: m?.name,
        }));
    } catch {
        return [];
    }
}

export async function getCoinMarketChart(coinId, vs_currency = "usd", days = 30) {
    try {
        const { data } = await api.get(`/coingecko_proxy/`, {
            params: {
                endpoint: `coins/${coinId}/market_chart`,
                vs_currency,
                days,
            },
        });
        return data?.data ?? null;
    } catch {
        return null;
    }
}

// <-- THIS is the missing export your component imports
export async function getCoinSuggestions(query) {
    const primary = query ? await searchCoins(query) : await listCoins();
    if (primary?.length) return primary;

    const secondary = await marketTopCoins();
    if (secondary?.length) return secondary;

    return FALLBACK_COINS;
}
