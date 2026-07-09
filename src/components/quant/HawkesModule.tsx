import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useQuantSettings } from "@/lib/quant/settings";
import type { Tick } from "@/lib/quant/useMarketData";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

export function HawkesModule({ ticks }: { ticks: Tick[] }) {
  const s = useQuantSettings();
  const data = ticks.slice(-200).map((t, i) => ({
    i, volume: t.intensityEvents, hawkes: t.hawkes,
  }));
  const latest = ticks[ticks.length - 1];
  const intensity = latest?.hawkes ?? 0;
  const branching = s.hawkesBeta > 0 ? s.hawkesAlpha / s.hawkesBeta : Infinity;
  // Toxicity scale: intensity normalized to threshold based on baseline μ
  const toxicity = Math.min(1, Math.max(0, (intensity - s.hawkesMu) / (s.hawkesMu * 6 + 1e-6)));
  const toxColor = toxicity < 0.33 ? "bg-emerald-500" : toxicity < 0.66 ? "bg-amber-500" : "bg-red-500";
  const toxLabel = toxicity < 0.33 ? "Safe" : toxicity < 0.66 ? "Caution" : "Toxic";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2 bg-zinc-900/60 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-zinc-200">Trade Intensity · Hawkes λ(t)</CardTitle>
          <Badge variant="outline" className={
            branching < 1 ? "border-emerald-500/40 text-emerald-300"
                          : "border-red-500/40 text-red-300"
          }>
            n = α/β = {branching.toFixed(2)} {branching < 1 ? "· stable" : "· unstable"}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3"/>
                <XAxis dataKey="i" stroke="#71717a" fontSize={11}/>
                <YAxis yAxisId="left" stroke="#71717a" fontSize={11}/>
                <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" fontSize={11}/>
                <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #27272a", fontSize: 12 }}/>
                <Bar yAxisId="left" dataKey="volume" fill="#3f3f46" name="Trades" isAnimationActive={false}/>
                <Line yAxisId="right" type="monotone" dataKey="hawkes" stroke="#f43f5e" strokeWidth={2} dot={false} name="λ(t)" isAnimationActive={false}/>
                <ReferenceLine yAxisId="right" y={s.hawkesMu} stroke="#52525b" strokeDasharray="3 3"/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/60 border-zinc-800">
        <CardHeader><CardTitle className="text-zinc-200">Order-Flow Toxicity</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg border border-zinc-800 p-4 mb-4">
            <div className="text-xs text-zinc-400 mb-2">Current level</div>
            <div className="flex items-center gap-3">
              <div className={`h-3 flex-1 rounded ${toxColor}`} style={{ opacity: 0.25 }}>
                <div className={`h-full rounded ${toxColor}`} style={{ width: `${toxicity * 100}%` }}/>
              </div>
              <span className={`text-sm font-mono ${
                toxicity < 0.33 ? "text-emerald-300" : toxicity < 0.66 ? "text-amber-300" : "text-red-300"
              }`}>{toxLabel}</span>
            </div>
            <div className="mt-2 font-mono text-xl text-zinc-100">λ = {intensity.toFixed(2)}</div>
          </div>
          <div className="space-y-3">
            <label className="text-xs text-zinc-400">Baseline μ: {s.hawkesMu.toFixed(2)}</label>
            <Slider value={[s.hawkesMu]} min={0.05} max={2} step={0.05}
              onValueChange={([v]) => s.set("hawkesMu", v)} />
            <label className="text-xs text-zinc-400">Excitation α: {s.hawkesAlpha.toFixed(2)}</label>
            <Slider value={[s.hawkesAlpha]} min={0.05} max={1.5} step={0.05}
              onValueChange={([v]) => s.set("hawkesAlpha", v)} />
            <label className="text-xs text-zinc-400">Decay β: {s.hawkesBeta.toFixed(2)}</label>
            <Slider value={[s.hawkesBeta]} min={0.2} max={3} step={0.05}
              onValueChange={([v]) => s.set("hawkesBeta", v)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
