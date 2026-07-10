// Oracle: Elliott + CVD + SMC + LSTM unified analytical engine.
// All inputs are REAL Binance klines (with takerBuyBase for CVD).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { runFullAnalysis } from "@/engines/integrationHub";
import { DivergenceStore, type Candle, type FullAnalysisResult } from "@/engines/types";
import { SMCPanel } from "@/components/oracle/SMCPanel";
import { LSTMPanel } from "@/components/oracle/LSTMPanel";

export const Route = createFileRoute("/oracle")({
  component: OraclePage,
  head: () => ({
    meta: [
      { title: "Oracle — Elliott · CVD · SMC · LSTM" },
      { name: "description", content: "Deterministic multi-engine market analysis on live Binance data." },
    ],
  }),
});

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"] as const;
const INTERVALS = [
  { v: "15m", h: 0.25 },
  { v: "1h", h: 1 },
  { v: "4h", h: 4 },
  { v: "1d", h: 24 },
] as const;

interface KlinesResp {
  klines: Array<{
    openTime: number; open: number; high: number; low: number; close: number;
    volume: number; takerBuyBase: number;
  }>;
}

async function fetchOracleCandles(symbol: string, interval: string, limit = 500): Promise<Candle[]> {
  const r = await fetch(`/api/binance/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  if (!r.ok) throw new Error(`klines ${r.status}`);
  const j = (await r.json()) as KlinesResp;
  return j.klines.map((k) => ({
    time: k.openTime,
    open: k.open, high: k.high, low: k.low, close: k.close,
    volume: k.volume,
    takerBuyVolume: k.takerBuyBase,
  }));
}

function OraclePage() {
  const [symbol, setSymbol] = useState<string>("BTCUSDT");
  const [interval, setInterval] = useState<(typeof INTERVALS)[number]>(INTERVALS[1]);
  const storeRef = useRef(new DivergenceStore());
  const [result, setResult] = useState<FullAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: candles, isLoading, error: qErr } = useQuery({
    queryKey: ["oracle-klines", symbol, interval.v],
    queryFn: () => fetchOracleCandles(symbol, interval.v, 500),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!candles || candles.length < 60) return;
    let cancelled = false;
    setAnalyzing(true);
    setErr(null);
    runFullAnalysis(candles, storeRef.current, interval.h)
      .then((r) => { if (!cancelled) setResult(r); })
      .catch((e) => { if (!cancelled) setErr(String(e?.message ?? e)); })
      .finally(() => { if (!cancelled) setAnalyzing(false); });
    return () => { cancelled = true; };
  }, [candles, interval.h]);

  const last = candles?.[candles.length - 1];
  const summary = useMemo(() => {
    if (!result) return null;
    return {
      elliott: result.elliott?.score ?? null,
      cvd: result.cvd?.strength ?? null,
      composite: result.compositeScore,
      dq: result.dataQuality.score,
      unc: result.uncertainty,
      alert: result.alert,
      exec: result.logs.executionTimeMs,
    };
  }, [result]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            🧬 Oracle <span className="text-slate-500 text-base font-normal">Elliott · CVD · SMC · LSTM</span>
          </h1>
          <p className="text-xs text-slate-500">
            Deterministic multi-engine analysis on live Binance klines. 500 candles, 500 ms compute budget.
          </p>
        </div>
        <nav className="flex gap-2 text-xs">
          <Link to="/app" className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700">← Terminal</Link>
          <Link to="/quant" className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700">Quant</Link>
        </nav>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={`px-3 py-1.5 text-xs rounded font-mono ${
                symbol === s ? "bg-teal-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {INTERVALS.map((tf) => (
            <button
              key={tf.v}
              onClick={() => setInterval(tf)}
              className={`px-3 py-1.5 text-xs rounded font-mono ${
                interval.v === tf.v ? "bg-fuchsia-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {tf.v}
            </button>
          ))}
        </div>
      </div>

      {/* Top KPI band */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <Kpi label="Price" value={last ? last.close.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"} accent="text-teal-400" />
        <Kpi label="Candles" value={candles ? String(candles.length) : "—"} />
        <Kpi label="Data Quality" value={summary ? `${summary.dq.toFixed(0)}%` : "—"} accent={summary && summary.dq > 80 ? "text-emerald-400" : "text-amber-400"} />
        <Kpi label="Elliott" value={summary?.elliott != null ? summary.elliott.toFixed(0) : "—"} />
        <Kpi label="CVD strength" value={summary?.cvd != null ? summary.cvd.toFixed(0) : "—"} />
        <Kpi
          label="Composite"
          value={summary?.composite != null ? summary.composite.toFixed(1) : "—"}
          accent={
            summary?.composite == null
              ? "text-slate-300"
              : summary.composite > 70
              ? "text-emerald-400"
              : summary.composite > 50
              ? "text-amber-400"
              : "text-slate-300"
          }
        />
      </div>

      {summary?.alert && (
        <div className="rounded border border-amber-500/60 bg-amber-950/40 px-4 py-2 text-amber-300 font-mono text-sm">
          {summary.alert}
        </div>
      )}
      {(qErr || err) && (
        <div className="rounded border border-red-500/60 bg-red-950/40 px-4 py-2 text-red-300 font-mono text-xs">
          {(qErr as Error | undefined)?.message ?? err}
        </div>
      )}
      {(isLoading || analyzing) && (
        <div className="text-xs text-slate-500 font-mono">
          {isLoading ? "loading klines…" : `analyzing (${result?.logs.executionTimeMs ?? "…"} ms)`}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SMCPanel smc={result?.smc ?? null} />
        <LSTMPanel prediction={result?.lstm ?? null} />
        <ElliottCard result={result} />
      </div>

      <ConfluenceCard result={result} />
      <LogsCard result={result} />
    </div>
  );
}

function Kpi({ label, value, accent = "text-slate-100" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-lg font-mono font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function ElliottCard({ result }: { result: FullAnalysisResult | null }) {
  const e = result?.elliott;
  return (
    <div className="bg-slate-800 rounded-lg p-4 text-sm text-slate-200 space-y-2">
      <h3 className="text-teal-400 font-bold text-lg">🌊 Elliott Waves</h3>
      {!e ? (
        <div className="text-slate-500">No Elliott data</div>
      ) : (
        <>
          <div className="flex justify-between">
            <span className="text-slate-400">Best count score</span>
            <span className="font-mono">{e.score.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Waves detected</span>
            <span className="font-mono">{e.bestCount.waves.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Alternates</span>
            <span className="font-mono">{e.alternates.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Search truncated</span>
            <span className="font-mono">{e.searchTruncated ? "yes" : "no"}</span>
          </div>
          {e.projections.length > 0 && (
            <div className="border-t border-slate-700 pt-2 mt-2 space-y-1">
              <div className="text-slate-500 text-xs">Projections</div>
              {e.projections.slice(0, 4).map((p, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-slate-400 truncate mr-2">{p.formula}</span>
                  <span className="font-mono">
                    {p.price.toFixed(2)} <span className="text-slate-500">({(p.confidence * 100).toFixed(0)}%)</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          {e.penalties.length > 0 && (
            <div className="text-xs text-amber-400/80">⚠ {e.penalties.length} penalty(ies)</div>
          )}
        </>
      )}
    </div>
  );
}

function ConfluenceCard({ result }: { result: FullAnalysisResult | null }) {
  const c = result?.confluence;
  return (
    <div className="bg-slate-800 rounded-lg p-4 text-sm text-slate-200">
      <h3 className="text-fuchsia-400 font-bold text-lg mb-2">⚡ Confluence (Elliott ↔ CVD)</h3>
      {!c ? (
        <div className="text-slate-500 text-sm">No confluence signal in current window.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <Mini label="Type" value={c.type} />
          <Mini label="Strength" value={c.strengthLabel} />
          <Mini label="Score" value={c.strengthValue.toFixed(3)} />
          <Mini label="Z-score" value={c.zScore.toFixed(2)} />
          <Mini label="Distance" value={String(c.distance)} />
          <Mini label="Confirmed" value={c.isConfirmed ? "yes" : "no"} />
        </div>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900 rounded px-2 py-1.5">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="text-sm font-mono">{value}</div>
    </div>
  );
}

function LogsCard({ result }: { result: FullAnalysisResult | null }) {
  if (!result) return null;
  const l = result.logs;
  return (
    <details className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-300">
      <summary className="cursor-pointer text-slate-400">📋 Engine logs · {l.executionTimeMs} ms</summary>
      <div className="mt-2 space-y-1 font-mono">
        <div>SMC: {l.smcDetails}</div>
        <div>LSTM: {l.lstmDetails}</div>
        {l.elliottPenalties.length > 0 && <div>Elliott penalties: {l.elliottPenalties.join(" · ")}</div>}
        {l.cvdPenalties.length > 0 && <div>CVD penalties: {l.cvdPenalties.join(" · ")}</div>}
        {l.dataQualityIssues.length > 0 && <div>DQ issues: {l.dataQualityIssues.join(" · ")}</div>}
        {result.uncertainty && (
          <div>
            Uncertainty (Monte Carlo): μ={result.uncertainty.mean.toFixed(2)} σ={result.uncertainty.std.toFixed(2)}
          </div>
        )}
        {result.weights && (
          <div>
            Adaptive weights: elliott={result.weights.elliottW.toFixed(2)} cvd={result.weights.cvdW.toFixed(2)}
          </div>
        )}
      </div>
    </details>
  );
}
