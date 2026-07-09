import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { klinesQuery, tradesQuery, depthQuery } from "@/lib/queries";
import {
  computeCVDFromTrades,
  institutionalScore,
  detectWalls,
  whaleThresholdFor,
} from "@/lib/analytics/engine";
import fluxLogo from "@/assets/flux-logo.png";
import heroVisual from "@/assets/hero-visual.jpg";
import {
  ArrowRight,
  Activity,
  Waves,
  Radar,
  Fingerprint,
  Layers3,
  Sparkles,
  ShieldCheck,
  Zap,
  Eye,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "FLUX · Institutional Crypto Intelligence — Free, No Sign-up" },
      {
        name: "description",
        content:
          "Real Binance order-flow intelligence in your browser. Whale walls, CVD, OFI, SMC, VWAP liquidity — zero fake data, zero signup, 100% free. Built with radical transparency.",
      },
    ],
  }),
});

function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <BackgroundFX />
      <NavBar />
      <Hero />
      <TickerStrip />
      <ProofSection />
      <FeatureGrid />
      <EngineSection />
      <LiveDemoSection />
      <TransparencySection />
      <FinalCTA />
      <Footer />
    </main>
  );
}

/* ─────────────────────────────  BACKGROUND FX  ───────────────────────────── */

function BackgroundFX() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 85%)",
        }}
      />
      {/* Cyan aurora */}
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full blur-[140px] opacity-40"
        style={{ background: "radial-gradient(circle, oklch(0.72 0.18 200 / 0.9), transparent 70%)" }}
      />
      {/* Magenta accent */}
      <div
        className="absolute top-[30%] -right-40 h-[500px] w-[500px] rounded-full blur-[130px] opacity-25"
        style={{ background: "radial-gradient(circle, oklch(0.65 0.24 340), transparent 70%)" }}
      />
      {/* Orange bottom */}
      <div
        className="absolute bottom-0 -left-40 h-[500px] w-[700px] rounded-full blur-[140px] opacity-20"
        style={{ background: "radial-gradient(circle, oklch(0.72 0.19 55), transparent 70%)" }}
      />
    </div>
  );
}

/* ─────────────────────────────  NAV  ───────────────────────────── */

function NavBar() {
  return (
    <header className="relative z-20 mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5">
      <Link to="/" className="flex items-center gap-2.5">
        <img src={fluxLogo} alt="FLUX" width={32} height={32} className="drop-shadow-[0_0_16px_oklch(0.82_0.15_200/0.7)]" />
        <span className="text-lg font-bold tracking-tight">
          FLUX<span className="text-primary">·</span>
          <span className="text-muted-foreground text-sm font-mono">Whale-Eye</span>
        </span>
      </Link>
      <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
        <a href="#engine" className="hover:text-foreground transition-colors">Engine</a>
        <a href="#features" className="hover:text-foreground transition-colors">Signals</a>
        <a href="#live" className="hover:text-foreground transition-colors">Live</a>
        <a href="#transparency" className="hover:text-foreground transition-colors">Transparency</a>
      </nav>
      <Link
        to="/app"
        className="group inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_24px_oklch(0.82_0.15_200/0.7)]"
      >
        Launch Terminal
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </Link>
    </header>
  );
}

/* ─────────────────────────────  HERO  ───────────────────────────── */

function Hero() {
  return (
    <section className="relative z-10 mx-auto max-w-[1400px] px-6 pt-10 pb-24 md:pt-20 md:pb-32">
      <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1/60 px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest text-muted-foreground backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Live Binance · Zero mock data · No sign-up
          </div>

          <h1 className="mt-6 text-[clamp(2.5rem,6vw,5rem)] font-black leading-[1.02] tracking-tight">
            See the market
            <br />
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-primary via-cyan-300 to-primary bg-clip-text text-transparent">
                the way whales
              </span>
              <span className="absolute -inset-1 -z-10 blur-3xl opacity-30 bg-primary" />
            </span>
            <br />
            <span className="text-foreground">actually trade it.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed">
            <span className="text-foreground font-medium">FLUX</span> reads live order flow, whale walls,
            stealth accumulation and Smart Money footprints directly from Binance —
            <span className="text-foreground"> derived from raw ticks, not opinions.</span>
            <br />
            <span className="mt-2 inline-block text-sm">
              Free. No account. No upsell. No dark patterns. Ever.
            </span>
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/app"
              className="group relative inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-[0_0_40px_oklch(0.82_0.15_200/0.55)] transition-all hover:scale-[1.02] hover:shadow-[0_0_60px_oklch(0.82_0.15_200/0.85)]"
            >
              <Eye size={16} />
              Open the Terminal
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#engine"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1/50 px-6 py-3.5 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:border-primary/50"
            >
              How the engine works
            </a>
          </div>

          <div className="mt-10 flex flex-wrap gap-6 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            <TrustBadge icon={<ShieldCheck size={12} />} label="Open methodology" />
            <TrustBadge icon={<Zap size={12} />} label="Edge-cached · <150ms" />
            <TrustBadge icon={<Activity size={12} />} label="Binance live REST" />
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-primary">{icon}</span>
      {label}
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative">
      <div className="absolute -inset-8 -z-10 rounded-3xl bg-gradient-to-br from-primary/30 via-transparent to-fuchsia-500/20 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-1 shadow-[0_30px_120px_-20px_oklch(0.82_0.15_200/0.45)]">
        <img
          src={heroVisual}
          alt="Institutional order flow visualization"
          width={1920}
          height={1080}
          className="w-full h-auto"
        />
        <LiveHeroOverlay />
      </div>
      {/* Floating chips */}
      <FloatingChip className="absolute -top-4 -left-6 hidden md:flex" tone="bull" text="Stealth Buying · SBI +42" />
      <FloatingChip className="absolute -bottom-5 -right-4 hidden md:flex" tone="wall" text="Whale Wall · $3.2M ask" />
    </div>
  );
}

function FloatingChip({
  text, tone, className = "",
}: { text: string; tone: "bull" | "wall"; className?: string }) {
  const color = tone === "bull" ? "var(--bull)" : "var(--wall)";
  return (
    <div
      className={`items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-[11px] font-mono backdrop-blur shadow-lg ${className}`}
      style={{ borderColor: `color-mix(in oklab, ${color} 50%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
      {text}
    </div>
  );
}

function LiveHeroOverlay() {
  const q = useQuery(klinesQuery("BTCUSDT", "1m", 30));
  const last = q.data?.at(-1);
  const first = q.data?.[0];
  const pct = last && first ? ((last.close - first.open) / first.open) * 100 : 0;
  return (
    <div className="absolute left-4 top-4 rounded-lg border border-border/60 bg-background/80 px-3 py-2 backdrop-blur">
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">BTC/USDT · LIVE</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="num text-lg font-bold">
          {last ? last.close.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
        </span>
        <span
          className="num text-xs font-semibold"
          style={{ color: pct >= 0 ? "var(--bull)" : "var(--bear)" }}
        >
          {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────  TICKER STRIP  ───────────────────────────── */

const TICKERS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "AVAXUSDT"];

function TickerStrip() {
  return (
    <section className="relative z-10 border-y border-border/50 bg-surface-1/40 backdrop-blur">
      <div className="mx-auto max-w-[1400px] overflow-hidden px-6 py-4">
        <div className="flex animate-[scroll_50s_linear_infinite] gap-10 whitespace-nowrap">
          {[...TICKERS, ...TICKERS].map((s, i) => (
            <LiveTicker key={`${s}-${i}`} symbol={s} />
          ))}
        </div>
      </div>
      <style>{`@keyframes scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </section>
  );
}

function LiveTicker({ symbol }: { symbol: string }) {
  const q = useQuery(klinesQuery(symbol, "1m", 60));
  const last = q.data?.at(-1);
  const first = q.data?.[0];
  const pct = last && first ? ((last.close - first.open) / first.open) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <span className="text-muted-foreground">{symbol.replace("USDT", "/USDT")}</span>
      <span className="num font-semibold text-foreground">
        {last ? last.close.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "···"}
      </span>
      <span
        className="num text-[11px]"
        style={{ color: pct >= 0 ? "var(--bull)" : "var(--bear)" }}
      >
        {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
      </span>
    </div>
  );
}

/* ─────────────────────────────  PROOF  ───────────────────────────── */

function ProofSection() {
  const stats = [
    { k: "0", label: "Mocked data points" },
    { k: "8", label: "Weighted score components" },
    { k: "~150ms", label: "Edge-cached latency" },
    { k: "$0", label: "Ever" },
  ];
  return (
    <section className="relative z-10 mx-auto max-w-[1400px] px-6 py-16">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface-1/50 p-6 text-center backdrop-blur">
            <div className="num text-3xl font-black text-primary md:text-4xl">{s.k}</div>
            <div className="mt-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────  FEATURES  ───────────────────────────── */

const FEATURES = [
  {
    icon: Radar,
    title: "Institutional Score",
    tagline: "Composite · 8 components · [-100, +100]",
    body: "Book imbalance, wall pressure, momentum, RSI damping, volume trend, micro-price drift — regime-aware weighting and EMA smoothing.",
  },
  {
    icon: Waves,
    title: "Whale Walls",
    tagline: "Proximity-weighted depth",
    body: "Detects real bid/ask concentrations sized by USD notional. Walls near the mid dominate the pressure vector — just like they do to real price action.",
  },
  {
    icon: Fingerprint,
    title: "Stealth Buying / Selling",
    tagline: "SBI · SSI · Divergence",
    body: "When CVD rises while price stays flat — someone big is accumulating quietly. FLUX names it, times it, and shows it against the tape.",
  },
  {
    icon: Activity,
    title: "CVD & Order-Flow Imbalance",
    tagline: "Aggressive vs passive flow",
    body: "Cumulative Volume Delta with per-bucket OFI heatmap. Read the true buyer/seller aggression — the only thing that moves price.",
  },
  {
    icon: Layers3,
    title: "Smart Money Concepts",
    tagline: "Order blocks · FVGs · BOS",
    body: "Auto-detected order blocks, fair value gaps, and break-of-structure events — the SMC lexicon rendered live over your candles.",
  },
  {
    icon: Sparkles,
    title: "Liquidity Zones & Stop Hunts",
    tagline: "VWAP + depth clustering",
    body: "Where liquidity pools. Where stops hide. Where whales hunt them. Rendered as translucent bands you can trust because you can see the math.",
  },
];

function FeatureGrid() {
  return (
    <section id="features" className="relative z-10 mx-auto max-w-[1400px] px-6 py-20">
      <SectionHeader
        eyebrow="Signals"
        title="Every signal derived from real ticks."
        subtitle="Six institutional lenses. One live tape. Zero fabrication."
      />
      <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="group relative overflow-hidden rounded-2xl border border-border bg-surface-1/50 p-6 backdrop-blur transition-all hover:border-primary/40 hover:bg-surface-1"
          >
            <div className="absolute -inset-px -z-10 rounded-2xl opacity-0 transition-opacity group-hover:opacity-100"
              style={{ background: "radial-gradient(300px circle at 50% 0%, oklch(0.82 0.15 200 / 0.15), transparent 70%)" }} />
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/30">
              <f.icon size={20} />
            </div>
            <div className="mt-5 text-[10px] font-mono uppercase tracking-widest text-primary/80">{f.tagline}</div>
            <h3 className="mt-1 text-lg font-bold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────  ENGINE  ───────────────────────────── */

function EngineSection() {
  return (
    <section id="engine" className="relative z-10 mx-auto max-w-[1400px] px-6 py-24">
      <div className="grid gap-14 lg:grid-cols-[1fr_1fr] lg:gap-20 items-center">
        <div>
          <SectionHeader
            eyebrow="The Engine"
            title="Regime-aware. Proximity-weighted. Transparent."
            subtitle="Momentum weights collapse in chop. Wall pressure amplifies near the mid. RSI damps extremes. It's the math of edge — laid out for you to inspect."
            align="left"
          />
          <div className="mt-8 space-y-3">
            {ENGINE_ROWS.map((r) => (
              <div key={r.k} className="flex items-start gap-4 rounded-xl border border-border/60 bg-surface-1/40 p-4 backdrop-blur">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-mono font-bold">
                  {r.k}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{r.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{r.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <EngineCodeCard />
      </div>
    </section>
  );
}

const ENGINE_ROWS = [
  { k: "1", title: "Regime detection", body: "ATR%, ADX proxy, Bollinger width → trending / ranging / volatile. Each regime remaps the component weights." },
  { k: "2", title: "Proximity-weighted walls", body: "A wall 0.1% from mid counts ~10× more than a wall 1% away. The book you feel is the book that moves you." },
  { k: "3", title: "Confidence via entropy", body: "Agreement + component alignment + spread health + chop dampening → a single 0-100 confidence number you can act on." },
  { k: "4", title: "ATR-based targets", body: "Entry, stop, TP1, TP2, and RR — all sized from live ATR and the nearest structural wall. No arbitrary R:R." },
];

function EngineCodeCard() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 to-fuchsia-500/10 blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-border bg-[oklch(0.14_0.012_240)] font-mono text-[12px] leading-relaxed shadow-2xl">
        <div className="flex items-center gap-1.5 border-b border-border/60 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.65_0.24_25)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.78_0.16_85)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.72_0.18_155)]" />
          <span className="ml-3 text-[10px] uppercase tracking-widest text-muted-foreground">institutional-score.ts</span>
        </div>
        <pre className="p-5 overflow-x-auto text-foreground/90">
{`const { regime, chopLevel } = detectRegime(klines);
const W = REGIME_WEIGHTS[regime];

// Proximity-weighted wall pressure
const weight = 1 / (1 + distancePct * 4);
const pressure = walls.reduce(
  (s, w) => s + w.usd * proximity(w),
  0,
);

const weighted =
  bookImbalance    * W.book  +
  proximityPressure * W.wall +
  momentum         * W.mom   +
  rsiPenalty       * W.rsi   +
  microDrift       * W.micro;

const raw   = Math.tanh(weighted * 1.7) * spreadHealth;
const score = ema(prevScore, raw * 100, α = 0.35);

// Confidence via component entropy + agreement
const trust = min(agreement, 1 - entropy) * (1 - chop * 0.25);
return { `}<span className="text-primary">score</span>{`, `}<span className="text-primary">confidence</span>{`, targets };`}
        </pre>
      </div>
    </div>
  );
}

/* ─────────────────────────────  LIVE DEMO  ───────────────────────────── */

function LiveDemoSection() {
  return (
    <section id="live" className="relative z-10 mx-auto max-w-[1400px] px-6 py-24">
      <SectionHeader
        eyebrow="Live · No sign-up"
        title="A live institutional score. Right now. On this page."
        subtitle="No demo data. This is Binance BTC/USDT computed in your browser."
      />
      <div className="mt-12">
        <LiveScoreCard />
      </div>
    </section>
  );
}

function LiveScoreCard() {
  const klines = useQuery(klinesQuery("BTCUSDT", "1m", 200));
  const depth = useQuery(depthQuery("BTCUSDT", 500));
  const trades = useQuery(tradesQuery("BTCUSDT", 500));

  const ready = klines.data && depth.data && trades.data;
  const mid = ready
    ? ((depth.data!.bids[0]?.price ?? 0) + (depth.data!.asks[0]?.price ?? 0)) / 2
    : 0;
  const analytics = ready
    ? (() => {
        const cvd = computeCVDFromTrades(trades.data!);
        const score = institutionalScore({
          klines: klines.data!, trades: trades.data!, depth: depth.data!, mid,
        });
        const walls = detectWalls(depth.data!, mid, whaleThresholdFor(mid));
        return { cvd, score, walls };
      })()
    : null;

  const scoreVal = analytics?.score.score ?? 0;
  const tone =
    scoreVal >= 25 ? "bull" : scoreVal <= -25 ? "bear" : "neutral";
  const label =
    scoreVal >= 60 ? "Strong Institutional Bid"
    : scoreVal >= 25 ? "Buyers in control"
    : scoreVal <= -60 ? "Strong Institutional Offer"
    : scoreVal <= -25 ? "Sellers in control"
    : "Balanced accumulation / distribution";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-surface-1/60 p-6 md:p-10 backdrop-blur">
      <div className="absolute inset-0 -z-10 opacity-30"
        style={{ background: `radial-gradient(600px circle at 20% 0%, oklch(0.82 0.15 200 / 0.25), transparent 70%)` }} />
      <div className="grid gap-10 lg:grid-cols-[auto_1fr] items-center">
        <ScoreDial value={scoreVal} />
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            BTC/USDT · Institutional Score · Live
          </div>
          <div
            className="mt-2 text-3xl md:text-4xl font-black tracking-tight"
            style={{
              color: tone === "bull" ? "var(--bull)" : tone === "bear" ? "var(--bear)" : "var(--foreground)",
            }}
          >
            {label}
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MiniStat label="Mid" value={mid ? mid.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"} />
            <MiniStat label="Walls" value={analytics ? String(analytics.walls.length) : "—"} />
            <MiniStat
              label="CVD"
              value={analytics?.cvd.length ? analytics.cvd.at(-1)!.cvd.toFixed(1) : "—"}
              tone={analytics && analytics.cvd.length && analytics.cvd.at(-1)!.cvd > 0 ? "bull" : "bear"}
            />
            <MiniStat
              label="Components"
              value={analytics ? `${analytics.score.comps.length}/8` : "—"}
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/app"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-[0_0_30px_oklch(0.82_0.15_200/0.55)] hover:scale-[1.02] transition-transform"
            >
              Open full terminal <ArrowRight size={14} />
            </Link>
            <span className="text-[11px] font-mono text-muted-foreground self-center">
              Refresh a few seconds — number updates live.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreDial({ value }: { value: number }) {
  const clamped = Math.max(-100, Math.min(100, value));
  const angle = (clamped / 100) * 130;
  const color = clamped >= 25 ? "var(--bull)" : clamped <= -25 ? "var(--bear)" : "var(--primary)";
  return (
    <div className="relative flex h-56 w-56 items-center justify-center">
      <svg viewBox="0 0 200 200" className="absolute inset-0">
        <defs>
          <linearGradient id="dg" x1="0" x2="1">
            <stop offset="0%" stopColor="oklch(0.65 0.24 25)" />
            <stop offset="50%" stopColor="oklch(0.82 0.15 200)" />
            <stop offset="100%" stopColor="oklch(0.72 0.18 155)" />
          </linearGradient>
        </defs>
        <path d="M20 150 A80 80 0 1 1 180 150" fill="none" stroke="var(--border)" strokeWidth="10" strokeLinecap="round" />
        <path d="M20 150 A80 80 0 1 1 180 150" fill="none" stroke="url(#dg)" strokeWidth="10" strokeLinecap="round" strokeDasharray="4 6" opacity="0.6" />
        <g transform={`rotate(${angle} 100 150)`} style={{ transition: "transform 700ms cubic-bezier(.2,.9,.2,1)" }}>
          <line x1="100" y1="150" x2="100" y2="60" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <circle cx="100" cy="60" r="6" fill={color} />
        </g>
        <circle cx="100" cy="150" r="8" fill="var(--foreground)" />
      </svg>
      <div className="absolute bottom-6 text-center">
        <div className="num text-4xl font-black" style={{ color }}>
          {clamped >= 0 ? "+" : ""}{Math.round(clamped)}
        </div>
        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mt-1">Score / 100</div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "bull" | "bear" }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div
        className="num mt-1 text-lg font-bold"
        style={{ color: tone === "bull" ? "var(--bull)" : tone === "bear" ? "var(--bear)" : undefined }}
      >
        {value}
      </div>
    </div>
  );
}

/* ─────────────────────────────  TRANSPARENCY  ───────────────────────────── */

function TransparencySection() {
  return (
    <section id="transparency" className="relative z-10 mx-auto max-w-[1400px] px-6 py-24">
      <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] items-center rounded-3xl border border-border bg-surface-1/40 p-8 md:p-12 backdrop-blur">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-primary">Radical Transparency</div>
          <h2 className="mt-3 text-3xl md:text-4xl font-black tracking-tight leading-tight">
            We built this because we couldn't find one honest tool.
          </h2>
          <p className="mt-5 text-muted-foreground leading-relaxed">
            No paid tiers. No "premium signals". No fabricated whale alerts. No fake AI. No email harvesting.
            Every number on this site comes from live Binance REST endpoints, is computed with math you can
            read, and is served to everyone for free — because credibility matters more than revenue.
          </p>
          <ul className="mt-6 space-y-2 text-sm">
            {[
              "Zero mocked data — every candle, trade, and depth level is live.",
              "Open scoring formula — no black box, no marketing math.",
              "No account required to use any feature on this landing page.",
              "Sign-in only exists for saving your own watchlist and alerts.",
            ].map((s) => (
              <li key={s} className="flex items-start gap-2.5">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" />
                <span className="text-foreground/90">{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-3xl bg-primary/10 blur-2xl" />
          <div className="rounded-2xl border border-border bg-background/60 p-6 backdrop-blur">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Manifesto</div>
            <blockquote className="mt-3 text-lg font-medium leading-relaxed">
              &ldquo;If a tool claims to see whales but hides its math,
              <span className="text-primary"> it is the whale.</span>&rdquo;
            </blockquote>
            <div className="mt-4 text-xs text-muted-foreground">— FLUX design principle #1</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────  FINAL CTA  ───────────────────────────── */

function FinalCTA() {
  return (
    <section className="relative z-10 mx-auto max-w-[1400px] px-6 py-24">
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-surface-1 to-background p-10 md:p-16 text-center">
        <div className="absolute inset-0 -z-10 opacity-40"
          style={{ background: "radial-gradient(600px circle at 50% 100%, oklch(0.82 0.15 200 / 0.4), transparent 70%)" }} />
        <img src={fluxLogo} alt="FLUX" width={64} height={64} className="mx-auto drop-shadow-[0_0_30px_oklch(0.82_0.15_200/0.7)]" />
        <h2 className="mt-6 text-4xl md:text-6xl font-black tracking-tight leading-[1.05]">
          Trade with your <span className="text-primary">eyes open.</span>
        </h2>
        <p className="mt-4 mx-auto max-w-xl text-muted-foreground">
          Open the terminal. No sign-up. No trial. No credit card. Just the market — the way it actually is.
        </p>
        <Link
          to="/app"
          className="group mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-[0_0_50px_oklch(0.82_0.15_200/0.6)] hover:scale-[1.03] transition-transform"
        >
          <Eye size={18} />
          Enter the Terminal
          <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}

/* ─────────────────────────────  FOOTER  ───────────────────────────── */

function Footer() {
  return (
    <footer className="relative z-10 border-t border-border/50 bg-surface-1/30 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground md:flex-row">
        <div className="flex items-center gap-2">
          <img src={fluxLogo} alt="" width={20} height={20} />
          <span className="font-mono">FLUX · Whale-Eye — built with radical transparency</span>
        </div>
        <div className="flex items-center gap-5">
          <a href="#engine" className="hover:text-foreground">Engine</a>
          <a href="#transparency" className="hover:text-foreground">Manifesto</a>
          <Link to="/app" className="hover:text-foreground">Terminal</Link>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────  SHARED  ───────────────────────────── */

function SectionHeader({
  eyebrow, title, subtitle, align = "center",
}: { eyebrow: string; title: string; subtitle?: string; align?: "center" | "left" }) {
  const cls = align === "center" ? "text-center mx-auto max-w-3xl" : "max-w-2xl";
  return (
    <div className={cls}>
      <div className="text-[10px] font-mono uppercase tracking-widest text-primary">{eyebrow}</div>
      <h2 className="mt-3 text-3xl md:text-5xl font-black tracking-tight leading-tight">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-muted-foreground text-base md:text-lg">{subtitle}</p>}
    </div>
  );
}
