// web_app/frontend/src/pages/Simulation.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AddPositionForm from "../components/AddPositionForm";
import { getCoinMarketChart } from "../services/coins";
import {
    createSimulation,
    deleteSimulation,
    getSimulation,
    listSimulations,
} from "../services/simulations";
import { useAuth } from "../state/AuthContext";

export default function Simulation() {
    const { accessToken, loading: authLoading } = useAuth();
    const authed = !!accessToken;

    const [loading, setLoading] = useState(true);
    const [sims, setSims] = useState([]);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState("");

    // create sim form
    const [newSim, setNewSim] = useState({
        name: "",
        start_date: new Date().toISOString().slice(0, 10),
        description: "",
    });

    // selection & details
    const [posSimId, setPosSimId] = useState("");
    const [selectedSimDetail, setSelectedSimDetail] = useState(null);
    const [series, setSeries] = useState([]);

    // initial load
    useEffect(() => {
        if (authLoading) return; // Wait for auth to load
        if (!authed) {
            setLoading(false);
            return;
        }
        
        (async () => {
            try {
                setLoading(true);
                const data = await listSimulations();
                const items = Array.isArray(data) ? data : (data.results || []);
                setSims(items);

                // pick first sim if none selected yet
                if (items.length > 0) {
                    const first = items[0].id;
                    setPosSimId((v) => v || first);
                    const detail = await getSimulation(items[0].id);
                    setSelectedSimDetail(detail);
                } else {
                    setPosSimId("");
                    setSelectedSimDetail(null);
                }
            } catch (e) {
                setError(e?.message || "Failed to load simulations");
            } finally {
                setLoading(false);
            }
        })();
    }, [authed, authLoading]);

    // helper: extract a friendly message from API errors
    const parseApiError = (e) => {
        const d = e?.response?.data;
        const firstFromObject = (obj) => {
            if (!obj || typeof obj !== "object") return null;
            for (const key of Object.keys(obj)) {
                const v = obj[key];
                if (Array.isArray(v) && v.length) return String(v[0]);
                if (typeof v === "string") return v;
                if (v && typeof v === "object") {
                    const inner = firstFromObject(v);
                    if (inner) return inner;
                }
            }
            return null;
        };
        let msg = null;
        if (typeof d === "string") msg = d;
        else if (typeof d?.detail === "string") msg = d.detail;
        else msg = firstFromObject(d?.detail) || firstFromObject(d) || e?.message;

        if (msg && /internal serializer error/i.test(msg)) {
            const specific = firstFromObject(d?.detail?.name ? { name: d.detail.name } : null) || d?.name;
            msg = specific || "Please check the inputs. If the name already exists, choose a different one.";
        }
        return msg || "Request failed";
    };

    // create a simulation
    const handleCreateSim = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const payload = {
                name: newSim.name,
                description: newSim.description || "",
                start_date: newSim.start_date,
            };
            const created = await createSimulation(payload);
            setSims((prev) => [created, ...prev]);
            const createdId = created?.id || (sims[0]?.id);
            if (createdId) {
                setPosSimId(createdId);
                const detail = await getSimulation(createdId);
                setSelectedSimDetail(detail);
            }

            setNewSim({ name: "", start_date: newSim.start_date, description: "" });

            setSuccess("Simulation created successfully");
            setTimeout(() => setSuccess(""), 1500);
        } catch (e) {
            setError(parseApiError(e));
        }
    };

    useEffect(() => {
        (async () => {
            const detail = selectedSimDetail;
            if (!detail || !Array.isArray(detail.positions)) {
                setSeries([]);
                return;
            }
            const totals = {};
            for (const p of detail.positions) {
                const coinId = p.coin?.id || p.coin_id || p.coin?.symbol;
                if (!coinId) continue;
                const qty = Number(p.quantity || 0) * (p.type === "SELL" ? -1 : 1);
                totals[coinId] = (totals[coinId] || 0) + qty;
            }
            const ids = Object.keys(totals).filter((k) => totals[k] > 0);
            if (ids.length === 0) {
                setSeries([]);
                return;
            }
            const days = Math.max(7, Math.min(90, Math.ceil((Date.now() - new Date(detail.start_date).getTime()) / 864e5)));
            const charts = await Promise.all(ids.map((id) => getCoinMarketChart(id, "usd", days)));
            const combined = [];
            for (let i = 0; i < charts[0]?.prices?.length; i++) {
                const t = charts[0].prices[i][0];
                let v = 0;
                for (let j = 0; j < charts.length; j++) {
                    const s = charts[j]?.prices || [];
                    if (s[i]) v += s[i][1] * totals[ids[j]];
                }
                combined.push({ t, v });
            }
            setSeries(combined);
        })();
    }, [selectedSimDetail]);

    function Sparkline({ data = [], width = 520, height = 140 }) {
        if (!data.length) return <div className="text-base-content/70">No data</div>;
        const xs = data.map((d) => d.t);
        const ys = data.map((d) => d.v);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const px = (x) => ((x - minX) / (maxX - minX || 1)) * (width - 2) + 1;
        const py = (y) => height - (((y - minY) / (maxY - minY || 1)) * (height - 2) + 1);
        const path = data.map((d, i) => `${i === 0 ? "M" : "L"}${px(d.t)},${py(d.v)}`).join(" ");
        const last = data[data.length - 1]?.v ?? 0;
        return (
            <div className="flex flex-col gap-2">
                <div className="text-sm opacity-70">Portfolio value trend (USD)</div>
                <svg width={width} height={height} className="rounded bg-base-200">
                    <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
                <div className="text-sm opacity-70">Latest: ${last.toLocaleString()}</div>
            </div>
        );
    }

    // Show loading while auth is being checked
    if (authLoading) {
        return (
            <div className="min-h-screen bg-base-200 flex items-center justify-center">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    if (!authed) {
        return (
            <div className="min-h-screen bg-base-200 flex items-center justify-center p-6">
                <div className="card w-full max-w-md bg-base-100 shadow-xl">
                    <div className="card-body gap-4">
                        <h2 className="card-title text-2xl">Sign in required</h2>
                        <p className="text-base-content/80">
                            You must sign in to run simulations.
                        </p>
                        <Link to="/signup" className="btn btn-primary w-full">
                            Go to Sign Up
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-base-200">
            <div className="mx-auto max-w-6xl px-6 py-10 grid gap-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">Simulations</h1>
                </div>

                {error && (
                    <div className="alert alert-error">
                        <span>{String(error)}</span>
                    </div>
                )}
                {!!success && (
                    <div className="alert alert-success">
                        <span>{success}</span>
                    </div>
                )}

                {/* Create Simulation */}
                <div className="card bg-base-100 shadow">
                    <div className="card-body gap-4">
                        <h2 className="card-title">New Simulation</h2>
                        <form className="grid gap-4 md:grid-cols-3" onSubmit={handleCreateSim}>
                            <label className="form-control">
                                <div className="label">
                                    <span className="label-text">Name</span>
                                </div>
                                <input
                                    className="input input-bordered"
                                    value={newSim.name}
                                    onChange={(e) => setNewSim({ ...newSim, name: e.target.value })}
                                    required
                                />
                            </label>

                            <label className="form-control">
                                <div className="label">
                                    <span className="label-text">Start date</span>
                                </div>
                                <input
                                    type="date"
                                    className="input input-bordered"
                                    value={newSim.start_date}
                                    onChange={(e) =>
                                        setNewSim({ ...newSim, start_date: e.target.value })
                                    }
                                    max={new Date().toISOString().slice(0,10)}
                                    required
                                />
                            </label>

                            <label className="form-control md:col-span-3">
                                <div className="label">
                                    <span className="label-text">Description (optional)</span>
                                </div>
                                <input
                                    className="input input-bordered"
                                    value={newSim.description}
                                    onChange={(e) =>
                                        setNewSim({ ...newSim, description: e.target.value })
                                    }
                                />
                            </label>

                            <div className="md:col-span-3">
                                <button type="submit" className="btn btn-primary">
                                    Create Simulation
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Simulations table */}
                <div className="card bg-base-100 shadow">
                    <div className="card-body gap-4">
                        <h2 className="card-title">Current Simulations</h2>
                        {loading ? (
                            <div className="text-base-content/70">Loading…</div>
                        ) : sims.length === 0 ? (
                            <div className="text-base-content/70">No simulations yet.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Status</th>
                                            <th>Start</th>
                                            <th>End</th>
                                            <th>Invested</th>
                                            <th>Units</th>
                                            <th>Current Value</th>
                                            <th></th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sims.map((s) => (
                                            <tr key={s.id}>
                                                <td>{s.name}</td>
                                                <td>{s.status}</td>
                                                <td>{s.start_date}</td>
                                                <td>{s.end_date || "-"}</td>
                                                <td>
                                                    {s.invested != null
                                                        ? `$ ${Number(s.invested).toLocaleString()}`
                                                        : "-"}
                                                </td>
                                                <td>
                                                    {s.units != null
                                                        ? Number(s.units).toLocaleString()
                                                        : "-"}
                                                </td>
                                                <td>
                                                    {s.current_value != null
                                                        ? `$ ${Number(s.current_value).toLocaleString()}`
                                                        : "-"}
                                                </td>
                                                <td className="flex gap-2">
                                                    <button
                                                        className="btn btn-sm"
                                                        onClick={async () => {
                                                            setPosSimId(s.id);
                                                            const detail = await getSimulation(s.id);
                                                            setSelectedSimDetail(detail);
                                                        }}
                                                    >
                                                        Details
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-error"
                                                        onClick={async () => {
                                                            try {
                                                                await deleteSimulation(s.id);
                                                                const data = await listSimulations();
                                                                const items = Array.isArray(data) ? data : (data.results || []);
                                                                setSims(items);
                                                                if (posSimId === s.id) {
                                                                    if (items.length) {
                                                                        setPosSimId(items[0].id);
                                                                        const detail = await getSimulation(items[0].id);
                                                                        setSelectedSimDetail(detail);
                                                                    } else {
                                                                        setPosSimId("");
                                                                        setSelectedSimDetail(null);
                                                                    }
                                                                }
                                                            } catch (e) {
                                                                setError(e?.message || "Failed to delete simulation");
                                                            }
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Add Position + Detail */}
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Add Position (now gets sims + currentSimId) */}
                    <AddPositionForm
                        sims={sims}
                        currentSimId={posSimId}
                        onAdded={async () => {
                            if (!posSimId) return;
                            const detail = await getSimulation(posSimId);
                            setSelectedSimDetail(detail);
                        }}
                    />

                    {/* Details */}
                    <div className="card bg-base-100 shadow">
                        <div className="card-body gap-4">
                            <h2 className="card-title">Details</h2>
                            {!selectedSimDetail ? (
                                <div className="text-base-content/70">Select a simulation.</div>
                            ) : (
                                <>
                                    {(() => {
                                        const invested = Number(selectedSimDetail.invested || 0);
                                        const current = Number(selectedSimDetail.current_value || 0);
                                        const pl = current - invested;
                                        const plPct = invested > 0 ? ((pl / invested) * 100).toFixed(2) + "%" : "--";
                                        return (
                                            <div className="stats stats-vertical md:stats-horizontal shadow w-full overflow-x-hidden">
                                                <div className="stat">
                                                    <div className="stat-title">Invested</div>
                                                    <div className="stat-value text-primary whitespace-normal break-words leading-tight text-3xl sm:text-4xl min-h-[3.25rem]">${invested.toLocaleString()}</div>
                                                </div>
                                                <div className="stat">
                                                    <div className="stat-title">P/L</div>
                                                    <div className={`stat-value whitespace-normal break-words leading-tight text-3xl sm:text-4xl min-h-[3.25rem] ${pl >= 0 ? "text-success" : "text-error"}`}>${pl.toLocaleString()}</div>
                                                    <div className="stat-desc">{plPct}</div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="overflow-x-hidden">
                                        <Sparkline data={series} />
                                    </div>
                                    <div className="text-sm text-base-content/70">
                                        <div><b>Name:</b> {selectedSimDetail.name}</div>
                                        <div><b>Status:</b> {selectedSimDetail.status}</div>
                                        <div><b>Start:</b> {selectedSimDetail.start_date}</div>
                                        <div><b>End:</b> {selectedSimDetail.end_date || "-"}</div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="table table-sm">
                                            <thead>
                                                <tr>
                                                    <th>Type</th>
                                                    <th>Coin</th>
                                                    <th>Qty</th>
                                                    <th>Price</th>
                                                    <th>Time</th>
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(selectedSimDetail.positions || []).map((p) => (
                                                    <tr key={p.id}>
                                                        <td>{p.type}</td>
                                                        <td>{p.coin?.symbol || p.coin?.id || "-"}</td>
                                                        <td>{p.quantity}</td>
                                                        <td>{p.price}</td>
                                                        <td>{p.time}</td>
                                                        <td>
                                                            <button
                                                                className="btn btn-xs btn-error"
                                                                onClick={async () => {
                                                                    try {
                                                                        const { deleteTransaction } = await import("../services/simulations");
                                                                        await deleteTransaction(p.id);
                                                                        const detail = await getSimulation(posSimId);
                                                                        setSelectedSimDetail(detail);
                                                                    } catch (e) {
                                                                        setError(e?.message || "Failed to delete");
                                                                    }
                                                                }}
                                                            >
                                                                Delete
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
