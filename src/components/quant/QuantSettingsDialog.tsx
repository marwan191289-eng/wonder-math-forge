import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Settings } from "lucide-react";
import { useQuantSettings } from "@/lib/quant/settings";

export function QuantSettingsDialog() {
  const s = useQuantSettings();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800">
          <Settings className="h-4 w-4 mr-1"/> Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Global Simulation</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div>
            <label className="text-xs text-zinc-400">Market speed: {s.marketSpeedMs} ms/tick</label>
            <Slider value={[s.marketSpeedMs]} min={200} max={3000} step={100}
              onValueChange={([v]) => s.set("marketSpeedMs", v)}/>
          </div>
          <div>
            <label className="text-xs text-zinc-400">Base annualized volatility: {(s.baseVolatility * 100).toFixed(0)}%</label>
            <Slider value={[s.baseVolatility]} min={0.1} max={2} step={0.05}
              onValueChange={([v]) => s.set("baseVolatility", v)}/>
          </div>
          <div>
            <label className="text-xs text-zinc-400">GARCH α: {s.garchAlpha.toFixed(2)}</label>
            <Slider value={[s.garchAlpha]} min={0.01} max={0.3} step={0.01}
              onValueChange={([v]) => s.set("garchAlpha", v)}/>
          </div>
          <div>
            <label className="text-xs text-zinc-400">GARCH β: {s.garchBeta.toFixed(2)}</label>
            <Slider value={[s.garchBeta]} min={0.5} max={0.98} step={0.01}
              onValueChange={([v]) => s.set("garchBeta", v)}/>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={s.reset} className="border-zinc-700 bg-transparent">Reset defaults</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
