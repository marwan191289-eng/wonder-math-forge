// Rescaled-range (R/S) Hurst exponent on log-returns.
// Returns H in [0,1]. H>0.55 => trending, H<0.45 => mean-reverting.
export function hurstRS(series: number[]): number {
  const n = series.length;
  if (n < 20) return 0.5;
  // log returns
  const r: number[] = [];
  for (let i = 1; i < n; i++) {
    if (series[i - 1] > 0 && series[i] > 0) r.push(Math.log(series[i] / series[i - 1]));
  }
  const N = r.length;
  if (N < 16) return 0.5;
  // sub-series sizes (powers-of-two-ish)
  const sizes: number[] = [];
  for (let s = 8; s <= N; s = Math.floor(s * 1.6)) sizes.push(s);
  if (sizes[sizes.length - 1] !== N) sizes.push(N);

  const xs: number[] = [];
  const ys: number[] = [];
  for (const size of sizes) {
    const chunks = Math.floor(N / size);
    if (chunks < 1) continue;
    const rsVals: number[] = [];
    for (let c = 0; c < chunks; c++) {
      const seg = r.slice(c * size, (c + 1) * size);
      const mean = seg.reduce((a, b) => a + b, 0) / size;
      let cum = 0, min = Infinity, max = -Infinity;
      const dev: number[] = [];
      for (const v of seg) {
        cum += v - mean;
        dev.push(cum);
        if (cum < min) min = cum;
        if (cum > max) max = cum;
      }
      const R = max - min;
      const variance = seg.reduce((a, b) => a + (b - mean) ** 2, 0) / size;
      const S = Math.sqrt(variance);
      if (S > 0 && R > 0) rsVals.push(R / S);
    }
    if (rsVals.length > 0) {
      const avg = rsVals.reduce((a, b) => a + b, 0) / rsVals.length;
      xs.push(Math.log(size));
      ys.push(Math.log(avg));
    }
  }
  if (xs.length < 2) return 0.5;
  // linear regression slope
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const H = den > 0 ? num / den : 0.5;
  return Math.max(0, Math.min(1, H));
}
