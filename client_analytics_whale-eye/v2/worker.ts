// Web Worker for the V2 analytics pipeline.
// Used only when klines.length > 500 (heavy path). For the default 200-bar
// dashboard the sync path stays because messaging overhead > compute cost.
/// <reference lib="webworker" />
import { analyzeV2, type AnalyzeV2Input, type AnalyzeV2Result } from "./index";

interface WorkerRequest { id: number; input: AnalyzeV2Input }
interface WorkerResponse { id: number; result?: AnalyzeV2Result; error?: string }

self.addEventListener("message", (ev: MessageEvent<WorkerRequest>) => {
  const { id, input } = ev.data;
  try {
    const result = analyzeV2(input);
    (self as unknown as Worker).postMessage({ id, result } satisfies WorkerResponse);
  } catch (e) {
    (self as unknown as Worker).postMessage({
      id,
      error: (e as Error).message,
    } satisfies WorkerResponse);
  }
});

export {}; // module worker
