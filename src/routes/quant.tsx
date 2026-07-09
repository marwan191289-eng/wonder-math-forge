import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useMarketData } from "@/lib/quant/useMarketData";
import { useQuantSettings } from "@/lib/quant/settings";
import { RegimeModule } from "@/components/quant/RegimeModule";
import { HawkesModule } from "@/components/quant/HawkesModule";
import { SizerModule } from "@/components/quant/SizerModule";
import { CointegrationModule } from "@/components/quant/CointegrationModule";
import { QuantSettingsDialog } from "@/components/quant/QuantSettingsDialog";
import { Activity, TrendingUp, Waves, Gauge, GitCompare } from "lucide-react";

export const Route = createFileRoute("/quant")({
  head: () => ({
    meta: [
      { title: "FLUX Quant Terminal · Kalman · Hawkes · GARCH · Cointegration" },
      { name: "description", content: "Institutional-grade quantitative dashboard: Kalman + Hurst regime detection, Hawkes order-flow toxicity, GARCH(1,1) + Kelly sizing, Engle-Granger cointegration scanner." },
      { property: "og:title", content: "FLUX Quant Terminal" },
      { property: "og:description", content: "Four advanced quant modules in one live terminal." },
    ],
  }),
  component: QuantPage,
});

function QuantPage() {
  const { ticks, venues } = useMarketData();
  const s = useQuantSettings();
  const [tab, setTab] = useState("regime");

  const latest = ticks[ticks.length - 1];
  const prev = ticks[ticks.length - 2];
  const flash = latest && prev
    ? (latest.price > prev.price ? "text-emerald-300" : latest.price < prev.price ? "text-red-300" : "text-zinc-200")
    : "text-zinc-200";

  const pnl = useMemo(() => {
    if (ticks.length < 2) return 0;
    // Toy mark-to-market: track cumulative log-returns × mock position of 0.1 BTC
    return ticks.slice(-60).reduce((acc, t) => acc + t.ret, 0) * 6000;
  }, [ticks]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top nav */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-400 to-fuchsia-500"/>
              <span className="font-bold tracking-tight truncate">FLUX · Quant Terminal</span>
            </Link>
            <nav className="hidden md:flex ml-4 gap-1 text-xs text-zinc-400">
              <Link to="/" className="px-2 py-1 hover:text-zinc-100">Home</Link>
              <Link to="/app" className="px-2 py-1 hover:text-zinc-100">Trading</Link>
              <Link to="/quant" className="px-2 py-1 text-cyan-300">Quant</Link>
              <Link to="/backtest" className="px-2 py-1 hover:text-zinc-100">Backtest</Link>
              <Link to="/compare" className="px-2 py-1 hover:text-zinc-100">Compare</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Balance</div>
              <div className="font-mono text-sm text-zinc-100">
                ${s.balance.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Session PnL</div>
              <motion.div
                key={pnl.toFixed(0)}
                initial={{ opacity: 0.4 }} animate={{ opacity: 1 }}
                className={`font-mono text-sm ${pnl >= 0 ? "text-emerald-300" : "text-red-300"}`}
              >
                {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
              </motion.div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">BTC</div>
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={latest?.price.toFixed(2)}
                  initial={{ opacity: 0.6, y: -2 }} animate={{ opacity: 1, y: 0 }}
                  className={`font-mono text-sm ${flash}`}
                >
                  {latest ? `$${latest.price.toFixed(2)}` : "—"}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2 pl-2 border-l border-zinc-800">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                {s.live ? "Live" : "Sim"}
              </span>
              <Switch checked={s.live} onCheckedChange={(v) => s.set("live", v)}/>
            </div>
            <QuantSettingsDialog/>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {s.live && (
          <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Live mode requested — this terminal streams simulated market data by design (Kalman/Hurst/Hawkes/GARCH require thousands of ticks). Real-Binance data feeds are wired into the <code className="font-mono">/app</code> route.
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="regime" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-cyan-300">
              <TrendingUp className="h-4 w-4 mr-1"/> Regime
            </TabsTrigger>
            <TabsTrigger value="hawkes" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-rose-300">
              <Waves className="h-4 w-4 mr-1"/> Toxicity
            </TabsTrigger>
            <TabsTrigger value="sizer" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-amber-300">
              <Gauge className="h-4 w-4 mr-1"/> Sizer
            </TabsTrigger>
            <TabsTrigger value="coint" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-violet-300">
              <GitCompare className="h-4 w-4 mr-1"/> Arbitrage
            </TabsTrigger>
          </TabsList>
          <div className="mt-4">
            <TabsContent value="regime"><RegimeModule ticks={ticks}/></TabsContent>
            <TabsContent value="hawkes"><HawkesModule ticks={ticks}/></TabsContent>
            <TabsContent value="sizer"><SizerModule ticks={ticks}/></TabsContent>
            <TabsContent value="coint"><CointegrationModule venues={venues}/></TabsContent>
          </div>
        </Tabs>

        <div className="mt-8 grid gap-3 text-xs text-zinc-500 sm:grid-cols-4">
          <Info icon={<Activity className="h-3 w-3"/>} label="Ticks" value={ticks.length.toString()}/>
          <Info icon={<TrendingUp className="h-3 w-3"/>} label="Hurst" value={(latest?.hurst ?? 0.5).toFixed(3)}/>
          <Info icon={<Waves className="h-3 w-3"/>} label="Hawkes λ" value={(latest?.hawkes ?? 0).toFixed(2)}/>
          <Info icon={<Gauge className="h-3 w-3"/>} label="σ (ann.)" value={((latest?.volAnnual ?? 0) * 100).toFixed(1) + "%"}/>
        </div>
      </main>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2">
      <span className="flex items-center gap-2 text-zinc-400">{icon}{label}</span>
      <span className="font-mono text-zinc-200">{value}</span>
    </div>
  );
}

function Badge_({ children }: { children: React.ReactNode }) {
  return <Badge>{children}</Badge>;
}
