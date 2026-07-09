import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engleGranger } from "@/lib/quant/cointegration";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid } from "recharts";

const PAIRS: Array<[string, string]> = [
  ["Binance", "Kraken"],
  ["Binance", "Bybit"],
  ["Binance", "OKX"],
  ["Kraken", "OKX"],
  ["Bybit", "OKX"],
  ["Kraken", "Bybit"],
];

export function CointegrationModule({ venues }: { venues: Record<string, number[]> }) {
  const [selected, setSelected] = useState<number>(0);

  const rows = useMemo(() => {
    return PAIRS.map(([a, b], idx) => {
      const xs = venues[a] || [];
      const ys = venues[b] || [];
      const n = Math.min(xs.length, ys.length);
      if (n < 40) {
        return { idx, a, b, spreadBps: 0, pValue: 1, zscore: 0, cointegrated: false, res: [] as number[], mean: 0, sd: 0 };
      }
      const x = xs.slice(-Math.min(200, n));
      const y = ys.slice(-Math.min(200, n));
      const r = engleGranger(x, y);
      const spreadBps = x.length && y.length
        ? ((y[y.length - 1] - x[x.length - 1]) / ((y[y.length - 1] + x[x.length - 1]) / 2)) * 1e4
        : 0;
      return { idx, a, b, spreadBps, pValue: r.pValue, zscore: r.zscore, cointegrated: r.isCointegrated, res: r.residuals, mean: r.meanRes, sd: r.sdRes };
    });
  }, [venues]);

  const sel = rows[selected];
  const zseries = sel && sel.sd > 0 ? sel.res.slice(-200).map((v, i) => ({ i, z: (v - sel.mean) / sel.sd })) : [];

  return (
    <div className="grid gap-4">
      <Card className="bg-zinc-900/60 border-zinc-800">
        <CardHeader><CardTitle className="text-zinc-200">Multi-Venue Cointegration Scanner</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Pair</TableHead>
                  <TableHead className="text-zinc-400">Venue A</TableHead>
                  <TableHead className="text-zinc-400">Venue B</TableHead>
                  <TableHead className="text-zinc-400 text-right">Spread (bps)</TableHead>
                  <TableHead className="text-zinc-400 text-right">p-value</TableHead>
                  <TableHead className="text-zinc-400 text-right">Z-score</TableHead>
                  <TableHead className="text-zinc-400 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const abs = Math.abs(r.zscore);
                  const canEnter = abs > 2.0 && r.cointegrated;
                  return (
                    <TableRow
                      key={r.idx}
                      onClick={() => setSelected(r.idx)}
                      className={`border-zinc-800 cursor-pointer hover:bg-zinc-800/40 ${selected === r.idx ? "bg-zinc-800/60" : ""}`}
                    >
                      <TableCell className="text-zinc-200">BTC/USDT</TableCell>
                      <TableCell className="text-zinc-300">{r.a}</TableCell>
                      <TableCell className="text-zinc-300">{r.b}</TableCell>
                      <TableCell className="text-right font-mono text-zinc-200">{r.spreadBps.toFixed(1)}</TableCell>
                      <TableCell className="text-right font-mono">
                        <Badge variant="outline" className={r.cointegrated ? "border-emerald-500/40 text-emerald-300" : "border-zinc-700 text-zinc-400"}>
                          {r.pValue.toFixed(3)}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-mono ${abs > 2 ? (r.zscore > 0 ? "text-red-300" : "text-emerald-300") : "text-zinc-300"}`}>
                        {r.zscore.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          disabled={!canEnter}
                          className={canEnter
                            ? (r.zscore > 0 ? "bg-red-500/80 hover:bg-red-500" : "bg-emerald-500/80 hover:bg-emerald-500")
                            : "bg-zinc-800"}
                        >
                          {r.zscore > 0 ? "Short spread" : "Long spread"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {sel && zseries.length > 0 && (
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-200">
              Z-score · {sel.a} / {sel.b}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={zseries}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3"/>
                  <XAxis dataKey="i" stroke="#71717a" fontSize={11}/>
                  <YAxis stroke="#71717a" fontSize={11} domain={[-4, 4]}/>
                  <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #27272a", fontSize: 12 }}/>
                  <ReferenceLine y={2} stroke="#f43f5e" strokeDasharray="3 3"/>
                  <ReferenceLine y={-2} stroke="#10b981" strokeDasharray="3 3"/>
                  <ReferenceLine y={0} stroke="#52525b"/>
                  <Line type="monotone" dataKey="z" stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
