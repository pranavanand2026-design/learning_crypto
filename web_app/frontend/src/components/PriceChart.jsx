import { useEffect, useRef } from "react";
import { AreaSeries, ColorType, createChart, createSeriesMarkers, LineStyle } from "lightweight-charts";
import { tokenColor, useTheme } from "../lib/theme";
import { money } from "../lib/format";

/**
 * Price history on chart paper. Your own trades are marked on the line,
 * and a dashed line shows your average cost when you hold the coin.
 */
export default function PriceChart({ prices, trades = [], avgCost, livePrice, height = 340 }) {
  const el = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [theme] = useTheme();

  useEffect(() => {
    const chart = createChart(el.current, {
      autoSize: true,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: tokenColor("graphite"),
        fontFamily: "Geist, system-ui, sans-serif",
        fontSize: 12,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: tokenColor("rule", 0.55) },
        horzLines: { color: tokenColor("rule", 0.55) },
      },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.08 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: {
        vertLine: { color: tokenColor("ink", 0.35), labelBackgroundColor: tokenColor("ink") },
        horzLine: { color: tokenColor("ink", 0.35), labelBackgroundColor: tokenColor("ink") },
      },
      handleScale: { mouseWheel: false },
      localization: { priceFormatter: (p) => money(p) },
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: tokenColor("ink"),
      lineWidth: 2,
      topColor: tokenColor("ink", 0.12),
      bottomColor: tokenColor("ink", 0),
      priceLineColor: tokenColor("marker"),
      priceLineStyle: LineStyle.Solid,
      crosshairMarkerBackgroundColor: tokenColor("marker"),
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      seriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, [height, theme]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !prices?.length) return;
    const seen = new Set();
    const data = prices
      .map(([ms, value]) => ({ time: Math.floor(ms / 1000), value }))
      .filter((p) => !seen.has(p.time) && seen.add(p.time));
    series.setData(data);
    chartRef.current.timeScale().fitContent();

    const first = data[0].time;
    const markers = trades
      .map((t) => ({ t, time: Math.floor(new Date(t.created_at).getTime() / 1000) }))
      .filter(({ time }) => time >= first)
      .map(({ t, time }) => {
        const nearest = data.reduce((a, b) => (Math.abs(b.time - time) < Math.abs(a.time - time) ? b : a));
        return {
          time: nearest.time,
          position: t.side === "buy" ? "belowBar" : "aboveBar",
          shape: t.side === "buy" ? "arrowUp" : "arrowDown",
          color: t.side === "buy" ? tokenColor("gain") : tokenColor("loss"),
          text: t.side === "buy" ? "Buy" : "Sell",
        };
      })
      .sort((a, b) => a.time - b.time);
    const m = createSeriesMarkers(series, markers);

    const lines = [];
    if (avgCost) {
      lines.push(
        series.createPriceLine({
          price: avgCost,
          color: tokenColor("graphite"),
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: true,
          title: "Your cost",
        }),
      );
    }
    return () => {
      // The chart may already be gone (theme change, unmount).
      if (seriesRef.current !== series) return;
      m.detach();
      lines.forEach((l) => series.removePriceLine(l));
    };
  }, [prices, trades, avgCost, theme]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !livePrice || !prices?.length) return;
    const now = Math.floor(Date.now() / 1000);
    const lastTime = Math.floor(prices[prices.length - 1][0] / 1000);
    if (now > lastTime) series.update({ time: now, value: livePrice });
  }, [livePrice, prices]);

  return <div ref={el} style={{ height }} className="w-full" />;
}
