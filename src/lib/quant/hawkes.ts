// Univariate exponentially-decaying Hawkes intensity:
// λ(t) = μ + α * Σ_{t_i < t} exp(-β (t - t_i))
// Recursive form: λ(t_n) = μ + α * S_n,  S_n = e^{-β Δt} (S_{n-1} + 1)
export class HawkesIntensity {
  mu: number;    // baseline
  alpha: number; // excitation
  beta: number;  // decay
  private s = 0;
  private lastT: number | null = null;

  constructor(mu = 0.5, alpha = 0.8, beta = 1.2) {
    this.mu = mu; this.alpha = alpha; this.beta = beta;
  }
  setParams(mu: number, alpha: number, beta: number) {
    this.mu = mu; this.alpha = alpha; this.beta = beta;
  }
  // Feed a new event timestamp (seconds). Returns intensity right after event.
  event(t: number): number {
    if (this.lastT === null) {
      this.s = 1;
    } else {
      const dt = Math.max(0, t - this.lastT);
      this.s = Math.exp(-this.beta * dt) * (this.s + 1);
    }
    this.lastT = t;
    return this.mu + this.alpha * this.s;
  }
  // Read current intensity at time t without adding an event.
  at(t: number): number {
    if (this.lastT === null) return this.mu;
    const dt = Math.max(0, t - this.lastT);
    const s = Math.exp(-this.beta * dt) * this.s;
    return this.mu + this.alpha * s;
  }
  // Stability: branching ratio n = α/β. Must be < 1 for stationarity.
  branchingRatio(): number {
    return this.beta > 0 ? this.alpha / this.beta : Infinity;
  }
}
