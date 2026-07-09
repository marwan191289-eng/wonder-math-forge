// Online GARCH(1,1): σ²_t = ω + α r²_{t-1} + β σ²_{t-1}
// Persistence = α + β  (must be < 1)
export class Garch11 {
  omega: number;
  alpha: number;
  beta: number;
  private sigma2: number;
  private lastR = 0;

  constructor(omega = 1e-6, alpha = 0.08, beta = 0.9, initSigma2 = 1e-4) {
    this.omega = omega; this.alpha = alpha; this.beta = beta;
    this.sigma2 = initSigma2;
  }
  update(r: number): number {
    this.sigma2 = this.omega + this.alpha * this.lastR * this.lastR + this.beta * this.sigma2;
    this.lastR = r;
    return Math.sqrt(this.sigma2);
  }
  get variance() { return this.sigma2; }
  get vol() { return Math.sqrt(this.sigma2); }
  get persistence() { return this.alpha + this.beta; }
  // Unconditional (long-run) volatility if persistence < 1
  get unconditionalVol() {
    const p = this.persistence;
    return p < 1 ? Math.sqrt(this.omega / (1 - p)) : NaN;
  }
}
