import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useQuantSettings } from "@/lib/quant/settings";
import type { Tick } from "@/lib/quant/useMarketData";
import { riskAdjustedSize } from "@/lib/quant/kelly";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export function SizerModule({ ticks }: { ticks: Tick[] }) {
  const s = useQuantSettings();
  const data = ticks.slice(-200).map((t, i) => ({ i, vol: t.volAnnual * 100 }));
  const latest = ticks[ticks.length - 1];
  const vol = latest?.volAnnual ?? s.baseVolatility;

  const result = riskAdjustedSize({
    balance: s.balance,
    winProb: s.winProb,
    winLossRatio: s.winLossRatio,
    currentAnnualVol: vol,
    targetAnnualVol: s.targetAnnualVol,
    fractionalKelly: s.fractionalKelly,
    maxLeverage: s.maxLeverage,
  });

  const regimeBadge = result.volatilityRegime === "low"
    ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
    : result.volatilityRegime === "medium"
      ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
      : "border-red-500/40 text-red-300 bg-red-500/10";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2 bg-zinc-900/60 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-zinc-200">GARCH(1,1) Conditional Volatility (annualized %)</CardTitle>
          <Badge variant="outline" className={regimeBadge}>
            {result.volatilityRegime.toUpperCase()} · σ = {(vol * 100).toFixed(1)}%
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3"/>
                <XAxis dataKey="i" stroke="#71717a" fontSize={11}/>
                <YAxis stroke="#71717a" fontSize={11}/>
                <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #27272a", fontSize: 12 }}/>
                <Line type="monotone" dataKey="vol" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 text-xs text-zinc-500">
            ω={s.garchOmega.toExponential(1)} · α={s.garchAlpha} · β={s.garchBeta} · persistence={(s.garchAlpha + s.garchBeta).toFixed(2)}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/60 border-zinc-800">
        <CardHeader><CardTitle className="text-zinc-200">Position Sizer</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4">
            <div className="text-xs text-zinc-400">Optimal Position Size</div>
            <div className="mt-1 text-3xl font-mono text-cyan-300">
              ${result.positionUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-sm text-zinc-400">
              {(result.adjustedFraction * 100).toFixed(2)}% of balance ·
              {" "}Leverage ≤ {result.suggestedLeverage.toFixed(2)}×
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              Kelly {result.kellyFraction.toFixed(3)} → adjusted {result.adjustedFraction.toFixed(3)} (½-Kelly × vol scale)
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-xs text-zinc-400">Win probability: {(s.winProb * 100).toFixed(0)}%</label>
            <Slider value={[s.winProb]} min={0.4} max={0.75} step={0.01}
              onValueChange={([v]) => s.set("winProb", v)} />
            <label className="text-xs text-zinc-400">Win/Loss ratio: {s.winLossRatio.toFixed(2)}</label>
            <Slider value={[s.winLossRatio]} min={0.5} max={4} step={0.05}
              onValueChange={([v]) => s.set("winLossRatio", v)} />
            <label className="text-xs text-zinc-400">Fractional Kelly: {s.fractionalKelly.toFixed(2)}</label>
            <Slider value={[s.fractionalKelly]} min={0.1} max={1} step={0.05}
              onValueChange={([v]) => s.set("fractionalKelly", v)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
