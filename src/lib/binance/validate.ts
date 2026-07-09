// Shared Zod schemas for Binance proxy query params.
// Used by every /api/binance/* route so validation lives in one place.
import { z } from "zod";

export const symbolSchema = z
  .string()
  .transform((s) => s.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{5,20}$/, "invalid symbol"));

// Binance klines intervals (whitelist — no free-form strings)
export const intervalSchema = z.enum([
  "1s", "1m", "3m", "5m", "15m", "30m",
  "1h", "2h", "4h", "6h", "8h", "12h",
  "1d", "3d", "1w", "1M",
]);

export const limitSchema = (min: number, max: number, def: number) =>
  z.coerce.number().int().min(min).max(max).catch(def);

export const symbolsListSchema = z
  .string()
  .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 20))
  .pipe(z.array(symbolSchema).min(1).max(20));
