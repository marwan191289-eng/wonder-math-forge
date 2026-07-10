// src/components/SMCPanel.tsx

import React from 'react';
import { SMCResult } from '@/engines/types';

interface SMCPanelProps {
  smc: SMCResult | null;
}

export const SMCPanel: React.FC<SMCPanelProps> = ({ smc }) => {
  if (!smc) {
    return <div className="text-gray-500 p-4">No SMC data available</div>;
  }

  const critical = smc.criticalSignals;
  const blocks = smc.orderBlocks;
  const fvgs = smc.fvgs;
  const zones = smc.liquidityZones;
  const bos = smc.bosSignals;

  const mitigated = blocks.filter(b => b.isMitigated).length;
  const partiallyMitigated = blocks.filter(b => b.isPartiallyMitigated && !b.isMitigated).length;
  const unmitigated = blocks.length - mitigated - partiallyMitigated;
  const breachedZones = zones.filter(z => z.isBreached).length;
  const partialFilled = fvgs.filter(f => f.partialFill && !f.isFilled).length;

  return (
    <div className="bg-slate-800 rounded-lg p-4 text-sm text-slate-200 space-y-3">
      <h3 className="text-gold-400 font-bold text-lg">🧠 Smart Money Concepts</h3>

      {critical.length > 0 && (
        <div className="bg-green-900/40 border border-green-500/60 rounded p-2">
          <span className="text-green-400 font-bold">🔴 {critical.length} CRITICAL SIGNAL(S)</span>
          {critical.map((ob, i) => (
            <div key={i} className="text-xs text-slate-300 mt-1">
              {ob.type} Order Block at {ob.low.toFixed(2)} - {ob.high.toFixed(2)}
              {ob.confluence.withElliott && ' 🔄 Elliott'}
              {ob.confluence.withCVD && ' 📊 CVD'}
              {ob.isMitigated && ' ❌ Mitigated'}
              {ob.isPartiallyMitigated && !ob.isMitigated && ' ⚡ Partial'}
              {ob.bosStrength > 70 && ` (BOS: ${ob.bosStrength})`}
            </div>
          ))}
        </div>
      )}

      <div>
        <span className="text-slate-400">Order Blocks: </span>
        <span className="text-white font-mono">{blocks.length}</span>
        <span className="text-slate-500 text-xs ml-2">
          (⚡{blocks.filter(b => b.strength > 60).length} strong)
        </span>
        <div className="text-xs text-slate-500">
          ❌ {mitigated} fully mitigated | ⚡ {partiallyMitigated} partially | 🔴 {unmitigated} active
        </div>
      </div>

      <div>
        <span className="text-slate-400">Fair Value Gaps: </span>
        <span className="text-white font-mono">{fvgs.length}</span>
        <span className="text-slate-500 text-xs ml-2">
          (🔄{fvgs.filter(f => !f.isFilled).length} open)
        </span>
        <div className="text-xs text-slate-500">
          ✅ {fvgs.filter(f => f.isFilled).length} filled
          {partialFilled > 0 && ` ⚡ ${partialFilled} partial`}
        </div>
      </div>

      <div>
        <span className="text-slate-400">Liquidity Zones: </span>
        <span className="text-white font-mono">{zones.length}</span>
        <span className="text-slate-500 text-xs ml-2">
          (🔴{zones.filter(z => !z.isBreached).length} intact)
        </span>
        <div className="text-xs text-slate-500">
          ❌ {breachedZones} breached
        </div>
      </div>

      <div>
        <span className="text-slate-400">Break of Structure: </span>
        <span className="text-white font-mono">{bos.length}</span>
        <span className="text-slate-500 text-xs ml-2">
          (📊{bos.filter(b => b.volumeSpike).length} with volume spike)
        </span>
      </div>

      <div className="border-t border-slate-700 pt-2 mt-2">
        <div className="text-slate-500 text-xs">Strength Distribution</div>
        <div className="flex gap-1 h-2 mt-1">
          <div className="bg-red-500 h-full rounded" style={{ width: `${blocks.filter(b => b.strength < 40).length / (blocks.length || 1) * 100}%` }} />
          <div className="bg-yellow-500 h-full rounded" style={{ width: `${blocks.filter(b => b.strength >= 40 && b.strength < 70).length / (blocks.length || 1) * 100}%` }} />
          <div className="bg-green-500 h-full rounded" style={{ width: `${blocks.filter(b => b.strength >= 70).length / (blocks.length || 1) * 100}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
          <span>Weak</span>
          <span>Moderate</span>
          <span>Strong</span>
        </div>
      </div>
    </div>
  );
};
