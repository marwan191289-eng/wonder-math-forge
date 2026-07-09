import { useEffect, useRef, useState } from "react";
import { Kalman1D } from "@/lib/quant/kalman";
import { hurstRS } from "@/lib/quant/hurst";
import { HawkesIntensity } from "@/lib/quant/hawkes";
import { Garch11 } from "@/lib/quant/garch";
import { randn } from "@/lib/quant/rng";
import { useQuantSettings } from "@/lib/quant/settings";

export interface Tick {
  t: number;               // seconds
  price: number;           // raw noisy
  kalman: number;          // smoothed
  ret: number;             // log return
  vol: number;             // GARCH conditional σ (per-tick)
  volAnnual: number;       // annualized σ
  hurst: number;
  hawkes: number;
  intensityEvents: number; // trades in last tick
}

export interface VenuePrice {
  venue: string;
  price: number;
  bidBps: number;    // spread relative
}

const VENUES = ["Binance", "Kraken", "Bybit", "OKX"] as const;

interface State {
  ticks: Tick[];
  venues: Record<string, number[]>;   // recent prices per venue
}

export function useMarketData() {
  const settings = useQuantSettings();
  const [state, setState] = useState<State>(() => ({
    ticks: [],
    venues: Object.fromEntries(VENUES.map((v) => [v, []])),
  }));

  const kalmanRef = useRef<Kalman1D | null>(null);
  const hawkesRef = useRef<HawkesIntensity | null>(null);
  const garchRef = useRef<Garch11 | null>(null);
  const priceRef = useRef<number>(60000);
  const tRef = useRef<number>(0);
  const venueRef = useRef<Record<string, number>>(
    Object.fromEntries(VENUES.map((v) => [v, 60000])),
  );

  // (Re)initialize engines when key params change
  useEffect(() => {
    kalmanRef.current = new Kalman1D(priceRef.current, settings.kalmanQ, settings.kalmanR);
  }, [settings.kalmanQ, settings.kalmanR]);

  useEffect(() => {
    hawkesRef.current = new HawkesIntensity(settings.hawkesMu, settings.hawkesAlpha, settings.hawkesBeta);
  }, [settings.hawkesMu, settings.hawkesAlpha, settings.hawkesBeta]);

  useEffect(() => {
    garchRef.current = new Garch11(settings.garchOmega, settings.garchAlpha, settings.garchBeta);
  }, [settings.garchOmega, settings.garchAlpha, settings.garchBeta]);

  useEffect(() => {
    if (!kalmanRef.current) kalmanRef.current = new Kalman1D(priceRef.current, settings.kalmanQ, settings.kalmanR);
    if (!hawkesRef.current) hawkesRef.current = new HawkesIntensity(settings.hawkesMu, settings.hawkesAlpha, settings.hawkesBeta);
    if (!garchRef.current) garchRef.current = new Garch11(settings.garchOmega, settings.garchAlpha, settings.garchBeta);

    const dt = settings.marketSpeedMs / 1000;
    const secsPerYear = 365 * 24 * 3600;
    const sigmaTick = settings.baseVolatility / Math.sqrt(secsPerYear / dt);

    const id = setInterval(() => {
      tRef.current += dt;
      const t = tRef.current;

      // Correlated random walk for main price (regime shifts baked in)
      const regimeDrift = Math.sin(t / 60) * sigmaTick * 0.3; // gentle drift
      const shock = randn() * sigmaTick;
      const prevPrice = priceRef.current;
      const newPrice = prevPrice * Math.exp(regimeDrift + shock);
      priceRef.current = newPrice;

      // Kalman smoothing
      const kal = kalmanRef.current!.step(newPrice);

      // Log return
      const r = Math.log(newPrice / prevPrice);

      // GARCH update
      const volTick = garchRef.current!.update(r);
      const volAnnual = volTick * Math.sqrt(secsPerYear / dt);

      // Trade intensity: base ~ 20/s + spike when |r| high
      const baseRate = 20;
      const shockRate = Math.min(200, Math.abs(r) / (sigmaTick + 1e-12) * 40);
      const nTrades = Math.max(1, Math.round((baseRate + shockRate) * dt + randn() * 2));
      let hawkesVal = settings.hawkesMu;
      for (let i = 0; i < nTrades; i++) {
        hawkesVal = hawkesRef.current!.event(t + i * (dt / nTrades));
      }

      // Venues: each is main price + small idiosyncratic spread + shared cointegration
      const venuesUpdate = { ...venueRef.current };
      for (const v of VENUES) {
        const spreadBps = randn() * 3 + (v === "OKX" ? 1 : v === "Kraken" ? -1 : 0);
        // Mean-reverting toward main price (cointegrated)
        const prev = venuesUpdate[v];
        const meanRev = 0.08 * (newPrice - prev);
        const idio = randn() * newPrice * 0.0006;
        venuesUpdate[v] = prev + meanRev + idio + spreadBps * newPrice * 1e-5;
      }
      venueRef.current = venuesUpdate;

      setState((prev) => {
        const newTicks = [...prev.ticks, {
          t, price: newPrice, kalman: kal, ret: r,
          vol: volTick, volAnnual, hurst: 0.5, hawkes: hawkesVal,
          intensityEvents: nTrades,
        }].slice(-600);

        // Rolling Hurst
        if (newTicks.length >= settings.hurstWindow) {
          const window = newTicks.slice(-settings.hurstWindow).map((x) => x.price);
          const H = hurstRS(window);
          newTicks[newTicks.length - 1].hurst = H;
        } else if (newTicks.length > 20) {
          newTicks[newTicks.length - 1].hurst =
            hurstRS(newTicks.map((x) => x.price));
        }

        const newVenues: Record<string, number[]> = {};
        for (const v of VENUES) {
          newVenues[v] = [...(prev.venues[v] || []), venuesUpdate[v]].slice(-300);
        }
        return { ticks: newTicks, venues: newVenues };
      });
    }, settings.marketSpeedMs);

    return () => clearInterval(id);
  }, [settings.marketSpeedMs, settings.baseVolatility, settings.hurstWindow, settings.hawkesMu, settings.hawkesAlpha, settings.hawkesBeta, settings.kalmanQ, settings.kalmanR, settings.garchOmega, settings.garchAlpha, settings.garchBeta]);

  return { ...state, venues: state.venues, VENUES: VENUES as unknown as string[] };
}
