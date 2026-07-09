// React hook: run analyzeV2 in a Web Worker when kline history is heavy.
// Threshold picked so the default dashboard (200 bars) stays synchronous —
// worker cost only pays off past a few hundred bars.
import { useEffect, useRef, useState } from "react";
import { analyzeV2, type AnalyzeV2Input, type AnalyzeV2Result } from "./index";

const WORKER_THRESHOLD = 500;

export function useV2Analysis(input: AnalyzeV2Input | null): AnalyzeV2Result | null {
  const [result, setResult] = useState<AnalyzeV2Result | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!input) return;

    const heavy = input.klines.length > WORKER_THRESHOLD;
    if (!heavy) {
      setResult(analyzeV2(input));
      return;
    }

    if (typeof window === "undefined" || typeof Worker === "undefined") {
      setResult(analyzeV2(input));
      return;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    }
    const id = ++seqRef.current;
    const worker = workerRef.current;
    const onMsg = (ev: MessageEvent<{ id: number; result?: AnalyzeV2Result; error?: string }>) => {
      if (ev.data.id !== id) return;
      if (ev.data.result) setResult(ev.data.result);
    };
    worker.addEventListener("message", onMsg);
    worker.postMessage({ id, input });
    return () => worker.removeEventListener("message", onMsg);
  }, [input]);

  useEffect(() => () => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  return result;
}
