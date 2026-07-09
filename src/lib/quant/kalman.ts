// 1D Kalman filter for mid-price smoothing.
// State: x_k = x_{k-1} + w,  w ~ N(0, Q)  (random walk with process noise Q)
// Obs:   z_k = x_k + v,      v ~ N(0, R)  (measurement noise R)
export class Kalman1D {
  x: number;      // state estimate
  p: number;      // estimate covariance
  q: number;      // process noise
  r: number;      // measurement noise

  constructor(initial: number, q = 1e-3, r = 1) {
    this.x = initial;
    this.p = 1;
    this.q = q;
    this.r = r;
  }
  setNoise(q: number, r: number) { this.q = q; this.r = r; }
  step(z: number): number {
    // predict
    this.p = this.p + this.q;
    // update
    const k = this.p / (this.p + this.r);
    this.x = this.x + k * (z - this.x);
    this.p = (1 - k) * this.p;
    return this.x;
  }
}
