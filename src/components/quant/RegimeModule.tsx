import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid } from "recharts";
import { useQuantSettings } from "@/lib/quant/settings";
import type { Tick } from "@/lib/quant/useMarketData";

export function RegimeModule({ ticks }: { ticks: Tick[] }) {
  const s = useQuantSettings();
  const latest = ticks[ticks.length - 1];
  const H = latest?.hurst ?? 0.5;
  const regime: "TRENDING" | "MEAN-REVERTING" | "RANDOM WALK" =
    H > 0.55 ? "TRENDING" : H < 0.45 ? "MEAN-REVERTING" : "RANDOM WALK";
  const regimeColor =
    regime === "TRENDING" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
    : regime === "MEAN-REVERTING" ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
    : "bg-zinc-500/20 text-zinc-300 border-zinc-500/40";

  const data = ticks.slice(-200).map((t, i) => ({
    i, price: t.price, kalman: t.kalman, hurst: t.hurst,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2 bg-zinc-900/60 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-zinc-200">Price · Kalman Smoothed</CardTitle>
          <Badge variant="outline" className={regimeColor}>{regime}</Badge>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis dataKey="i" stroke="#71717a" fontSize={11}/>
                <YAxis domain={["auto", "auto"]} stroke="#71717a" fontSize={11}/>
                <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #27272a", fontSize: 12 }}/>
                <Line type="monotone" dataKey="price" stroke="#71717a" dot={false} strokeWidth={1} name="Raw price" isAnimationActive={false}/>
                <Line type="monotone" dataKey="kalman" stroke="#06b6d4" dot={false} strokeWidth={2} name="Kalman" isAnimationActive={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/60 border-zinc-800">
        <CardHeader><CardTitle className="text-zinc-200">Hurst Exponent</CardTitle></CardHeader>
        <CardContent>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3"/>
                <XAxis dataKey="i" stroke="#71717a" fontSize={11}/>
                <YAxis domain={[0, 1]} stroke="#71717a" fontSize={11}/>
                <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #27272a", fontSize: 12 }}/>
                <ReferenceLine y={0.55} stroke="#10b981" strokeDasharray="4 4"/>
                <ReferenceLine y={0.45} stroke="#f59e0b" strokeDasharray="4 4"/>
                <ReferenceLine y={0.5} stroke="#52525b" strokeDasharray="2 6"/>
                <Line type="monotone" dataKey="hurst" stroke="#a78bfa" dot={false} strokeWidth={2} isAnimationActive={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 text-3xl font-mono text-zinc-100">{H.toFixed(3)}</div>
          <div className="mt-4 space-y-3">
            <label className="text-xs text-zinc-400">Kalman Process Noise: {s.kalmanQ.toExponential(1)}</label>
            <Slider value={[Math.log10(s.kalmanQ) + 6]} min={0} max={6} step={0.1}
              onValueChange={([v]) => s.set("kalmanQ", Math.pow(10, v - 6))} />
            <label className="text-xs text-zinc-400">Hurst Lookback: {s.hurstWindow}</label>
            <Slider value={[s.hurstWindow]} min={32} max={256} step={8}
              onValueChange={([v]) => s.set("hurstWindow", v)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
