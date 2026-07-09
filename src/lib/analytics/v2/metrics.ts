// In-memory latency tracker for V2 score computation.
// Keeps a bounded ring buffer per (symbol, interval) key and exposes p50/p95.
// Zero-mock: samples are wall-clock deltas recorded around real analyzeV2 runs.

const MAX_SAMPLES = 120;

interface Bucket {
  samples: number[];
  cursor: number;
  count: number;
  lastMs: number;
  lastAt: number;
}

const store = new Map<string, Bucket>();
const listeners = new Set<() => void>();

function getBucket(key: string): Bucket {
  let b = store.get(key);
  if (!b) {
    b = { samples: new Array(MAX_SAMPLES).fill(0), cursor: 0, count: 0, lastMs: 0, lastAt: 0 };
    store.set(key, b);
  }
  return b;
}

export function recordV2Latency(key: string, ms: number) {
  const b = getBucket(key);
  b.samples[b.cursor] = ms;
  b.cursor = (b.cursor + 1) % MAX_SAMPLES;
  b.count = Math.min(b.count + 1, MAX_SAMPLES);
  b.lastMs = ms;
  b.lastAt = Date.now();
  // Defer to avoid setState-in-render when callers invoke us during a
  // React render pass (e.g. inside useMemo).
  queueMicrotask(() => listeners.forEach((l) => l()));
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export interface V2LatencyStats {
  key: string;
  count: number;
  p50: number;
  p95: number;
  max: number;
  lastMs: number;
  lastAt: number;
}

export function getV2LatencyStats(): V2LatencyStats[] {
  const rows: V2LatencyStats[] = [];
  for (const [key, b] of store.entries()) {
    if (!b.count) continue;
    const live = b.samples.slice(0, b.count).sort((a, z) => a - z);
    rows.push({
      key,
      count: b.count,
      p50: percentile(live, 50),
      p95: percentile(live, 95),
      max: live[live.length - 1] ?? 0,
      lastMs: b.lastMs,
      lastAt: b.lastAt,
    });
  }
  return rows.sort((a, b) => a.key.localeCompare(b.key));
}

export function subscribeV2Latency(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetV2Latency() {
  store.clear();
  listeners.forEach((l) => l());
}
