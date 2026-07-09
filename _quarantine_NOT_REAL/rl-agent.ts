/**
 * FLUX RL Agent — Real Policy Gradient Engine
 * Uses REINFORCE algorithm with Adam optimizer.
 * Weights are persisted to MySQL and survive server restarts.
 * Runs on-server so the model is never exposed to the client.
 */

import { getDb } from './db';
import { rlWeights } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

// ── Feature vector size ──────────────────────────────────────────────────────
// [bookImbalance, wallPressure, momentum, microDrift, rsi, cvd, ofi, spread, priceChange]
const INPUT_SIZE = 9;
// Actions: 0=hold, 1=buy, 2=sell
const ACTION_SIZE = 3;
// Hidden layer
const HIDDEN_SIZE = 32;

// ── Adam optimizer state ─────────────────────────────────────────────────────
interface AdamState {
  m1: number[];
  v1: number[];
  m2: number[];
  v2: number[];
  t: number;
}

// ── Policy network weights ────────────────────────────────────────────────────
interface PolicyWeights {
  W1: number[];   // INPUT_SIZE × HIDDEN_SIZE
  b1: number[];   // HIDDEN_SIZE
  W2: number[];   // HIDDEN_SIZE × ACTION_SIZE
  b2: number[];   // ACTION_SIZE
}

// ── In-memory agent state per symbol ─────────────────────────────────────────
interface AgentState {
  weights: PolicyWeights;
  adam: AdamState;
  totalTrainings: number;
  wins: number;
  losses: number;
  totalReward: number;
  episodeBuffer: Array<{ state: number[]; action: number; reward: number; logProb: number }>;
  lastAction: 'buy' | 'sell' | 'hold';
  lastReward: number;
  lastPrice: number;
  active: boolean;
}

const agents = new Map<string, AgentState>();

// ── Initialization ────────────────────────────────────────────────────────────
function initWeights(): PolicyWeights {
  const xavier1 = Math.sqrt(2 / (INPUT_SIZE + HIDDEN_SIZE));
  const xavier2 = Math.sqrt(2 / (HIDDEN_SIZE + ACTION_SIZE));
  return {
    W1: Array.from({ length: INPUT_SIZE * HIDDEN_SIZE }, () => (Math.random() * 2 - 1) * xavier1),
    b1: new Array(HIDDEN_SIZE).fill(0),
    W2: Array.from({ length: HIDDEN_SIZE * ACTION_SIZE }, () => (Math.random() * 2 - 1) * xavier2),
    b2: new Array(ACTION_SIZE).fill(0),
  };
}

function initAdam(size: number): { m: number[]; v: number[] } {
  return { m: new Array(size).fill(0), v: new Array(size).fill(0) };
}

function initAgentState(): AgentState {
  const W1size = INPUT_SIZE * HIDDEN_SIZE;
  const W2size = HIDDEN_SIZE * ACTION_SIZE;
  return {
    weights: initWeights(),
    adam: {
      m1: new Array(W1size + HIDDEN_SIZE + W2size + ACTION_SIZE).fill(0),
      v1: new Array(W1size + HIDDEN_SIZE + W2size + ACTION_SIZE).fill(0),
      m2: [],
      v2: [],
      t: 0,
    },
    totalTrainings: 0,
    wins: 0,
    losses: 0,
    totalReward: 0,
    episodeBuffer: [],
    lastAction: 'hold',
    lastReward: 0,
    lastPrice: 0,
    active: false,
  };
}

// ── Neural network forward pass ───────────────────────────────────────────────
function relu(x: number): number { return Math.max(0, x); }

function softmax(logits: number[]): number[] {
  const maxL = Math.max(...logits);
  const exp = logits.map(l => Math.exp(l - maxL));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map(e => e / sum);
}

function forward(state: number[], w: PolicyWeights): { probs: number[]; hidden: number[] } {
  // Layer 1: INPUT → HIDDEN (ReLU)
  const hidden = new Array(HIDDEN_SIZE).fill(0);
  for (let h = 0; h < HIDDEN_SIZE; h++) {
    let sum = w.b1[h];
    for (let i = 0; i < INPUT_SIZE; i++) {
      sum += state[i] * w.W1[i * HIDDEN_SIZE + h];
    }
    hidden[h] = relu(sum);
  }
  // Layer 2: HIDDEN → ACTION (Softmax)
  const logits = new Array(ACTION_SIZE).fill(0);
  for (let a = 0; a < ACTION_SIZE; a++) {
    let sum = w.b2[a];
    for (let h = 0; h < HIDDEN_SIZE; h++) {
      sum += hidden[h] * w.W2[h * ACTION_SIZE + a];
    }
    logits[a] = sum;
  }
  return { probs: softmax(logits), hidden };
}

function sampleAction(probs: number[]): number {
  const r = Math.random();
  let cumsum = 0;
  for (let i = 0; i < probs.length; i++) {
    cumsum += probs[i];
    if (r < cumsum) return i;
  }
  return probs.length - 1;
}

// ── REINFORCE update with Adam ────────────────────────────────────────────────
const LR = 0.001;
const BETA1 = 0.9;
const BETA2 = 0.999;
const EPSILON = 1e-8;
const GAMMA = 0.99;

function updateWeights(agent: AgentState): void {
  if (agent.episodeBuffer.length === 0) return;

  // Compute discounted returns
  const returns: number[] = new Array(agent.episodeBuffer.length).fill(0);
  let G = 0;
  for (let t = agent.episodeBuffer.length - 1; t >= 0; t--) {
    G = agent.episodeBuffer[t].reward + GAMMA * G;
    returns[t] = G;
  }

  // Normalize returns
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(returns.map(r => (r - mean) ** 2).reduce((a, b) => a + b, 0) / returns.length) + 1e-8;
  const normReturns = returns.map(r => (r - mean) / std);

  // Compute policy gradients via REINFORCE
  const W1size = INPUT_SIZE * HIDDEN_SIZE;
  const W2size = HIDDEN_SIZE * ACTION_SIZE;
  const totalParams = W1size + HIDDEN_SIZE + W2size + ACTION_SIZE;
  const grads = new Array(totalParams).fill(0);

  for (let t = 0; t < agent.episodeBuffer.length; t++) {
    const { state, action, logProb } = agent.episodeBuffer[t];
    const G_t = normReturns[t];
    const { probs, hidden } = forward(state, agent.weights);

    // Gradient of log π(a|s) w.r.t. output logits
    const dLogits = probs.map((p, i) => (i === action ? p - 1 : p));
    const scale = -G_t / agent.episodeBuffer.length;

    // Gradient w.r.t. W2 and b2
    for (let h = 0; h < HIDDEN_SIZE; h++) {
      for (let a = 0; a < ACTION_SIZE; a++) {
        grads[W1size + HIDDEN_SIZE + h * ACTION_SIZE + a] += scale * dLogits[a] * hidden[h];
      }
    }
    for (let a = 0; a < ACTION_SIZE; a++) {
      grads[W1size + HIDDEN_SIZE + W2size + a] += scale * dLogits[a];
    }

    // Gradient w.r.t. W1 and b1
    const dHidden = new Array(HIDDEN_SIZE).fill(0);
    for (let h = 0; h < HIDDEN_SIZE; h++) {
      for (let a = 0; a < ACTION_SIZE; a++) {
        dHidden[h] += dLogits[a] * agent.weights.W2[h * ACTION_SIZE + a];
      }
      dHidden[h] *= hidden[h] > 0 ? 1 : 0; // ReLU derivative
    }
    for (let i = 0; i < INPUT_SIZE; i++) {
      for (let h = 0; h < HIDDEN_SIZE; h++) {
        grads[i * HIDDEN_SIZE + h] += scale * dHidden[h] * state[i];
      }
    }
    for (let h = 0; h < HIDDEN_SIZE; h++) {
      grads[W1size + h] += scale * dHidden[h];
    }
  }

  // Adam update
  agent.adam.t++;
  const bc1 = 1 - Math.pow(BETA1, agent.adam.t);
  const bc2 = 1 - Math.pow(BETA2, agent.adam.t);

  const flatWeights = [
    ...agent.weights.W1,
    ...agent.weights.b1,
    ...agent.weights.W2,
    ...agent.weights.b2,
  ];

  for (let i = 0; i < totalParams; i++) {
    agent.adam.m1[i] = BETA1 * agent.adam.m1[i] + (1 - BETA1) * grads[i];
    agent.adam.v1[i] = BETA2 * agent.adam.v1[i] + (1 - BETA2) * grads[i] ** 2;
    const mHat = agent.adam.m1[i] / bc1;
    const vHat = agent.adam.v1[i] / bc2;
    flatWeights[i] -= LR * mHat / (Math.sqrt(vHat) + EPSILON);
  }

  // Write back
  agent.weights.W1 = flatWeights.slice(0, W1size);
  agent.weights.b1 = flatWeights.slice(W1size, W1size + HIDDEN_SIZE);
  agent.weights.W2 = flatWeights.slice(W1size + HIDDEN_SIZE, W1size + HIDDEN_SIZE + W2size);
  agent.weights.b2 = flatWeights.slice(W1size + HIDDEN_SIZE + W2size);

  agent.totalTrainings++;
  agent.episodeBuffer = [];
}

// ── MySQL persistence ─────────────────────────────────────────────────────────
export async function saveWeightsToDb(symbol: string, agent: AgentState): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const weightsJson = JSON.stringify(agent.weights);
  const optimizerJson = JSON.stringify({ m1: agent.adam.m1, v1: agent.adam.v1, t: agent.adam.t });
  const winRate = agent.totalTrainings > 0 ? (agent.wins / agent.totalTrainings * 100).toFixed(2) : '0';

  const existing = await db.select().from(rlWeights).where(eq(rlWeights.symbol, symbol)).limit(1);

  if (existing.length > 0) {
    await db.update(rlWeights)
      .set({
        weights: weightsJson,
        optimizer: optimizerJson,
        version: existing[0].version + 1,
        totalTrainings: agent.totalTrainings,
        winRate,
        totalReward: agent.totalReward.toFixed(4),
        lastAction: agent.lastAction,
        lastReward: agent.lastReward.toFixed(4),
      })
      .where(eq(rlWeights.symbol, symbol));
  } else {
    await db.insert(rlWeights).values({
      symbol,
      weights: weightsJson,
      optimizer: optimizerJson,
      version: 1,
      totalTrainings: agent.totalTrainings,
      winRate,
      totalReward: agent.totalReward.toFixed(4),
      lastAction: agent.lastAction,
      lastReward: agent.lastReward.toFixed(4),
    });
  }
}

export async function loadWeightsFromDb(symbol: string): Promise<AgentState | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db.select().from(rlWeights).where(eq(rlWeights.symbol, symbol)).limit(1);
  if (rows.length === 0) return null;

  const row = rows[0];
  const agent = initAgentState();

  try {
    agent.weights = JSON.parse(row.weights);
    if (row.optimizer) {
      const opt = JSON.parse(row.optimizer);
      agent.adam.m1 = opt.m1;
      agent.adam.v1 = opt.v1;
      agent.adam.t = opt.t;
    }
    agent.totalTrainings = row.totalTrainings;
    agent.totalReward = parseFloat(row.totalReward ?? '0');
    agent.lastAction = (row.lastAction as 'buy' | 'sell' | 'hold') ?? 'hold';
    agent.lastReward = parseFloat(row.lastReward ?? '0');
  } catch {
    return null;
  }

  return agent;
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function getOrCreateAgent(symbol: string): Promise<AgentState> {
  if (!agents.has(symbol)) {
    const loaded = await loadWeightsFromDb(symbol);
    agents.set(symbol, loaded ?? initAgentState());
  }
  return agents.get(symbol)!;
}

export function activateAgent(symbol: string): void {
  const agent = agents.get(symbol);
  if (agent) agent.active = true;
}

export function deactivateAgent(symbol: string): void {
  const agent = agents.get(symbol);
  if (agent) agent.active = false;
}

export function getAgentStatus(symbol: string): object {
  const agent = agents.get(symbol);
  if (!agent) return { active: false, totalTrainings: 0, winRate: 0, totalReward: 0, lastAction: 'hold', lastReward: 0 };
  const winRate = agent.totalTrainings > 0 ? (agent.wins / agent.totalTrainings * 100) : 0;
  return {
    active: agent.active,
    totalTrainings: agent.totalTrainings,
    winRate: parseFloat(winRate.toFixed(2)),
    totalReward: parseFloat(agent.totalReward.toFixed(4)),
    lastAction: agent.lastAction,
    lastReward: agent.lastReward,
    episodeBufferSize: agent.episodeBuffer.length,
  };
}

export async function stepAgent(
  symbol: string,
  features: number[],
  currentPrice: number
): Promise<{ action: 'buy' | 'sell' | 'hold'; confidence: number; probs: number[] }> {
  const agent = await getOrCreateAgent(symbol);

  // Compute reward from last action
  if (agent.lastPrice > 0 && agent.episodeBuffer.length > 0) {
    const priceChange = (currentPrice - agent.lastPrice) / agent.lastPrice;
    let reward = 0;
    if (agent.lastAction === 'buy') reward = priceChange * 100;
    else if (agent.lastAction === 'sell') reward = -priceChange * 100;
    else reward = -Math.abs(priceChange) * 10; // small penalty for holding during movement

    // Update last episode step with reward
    const last = agent.episodeBuffer[agent.episodeBuffer.length - 1];
    if (last) last.reward = reward;

    agent.totalReward += reward;
    if (reward > 0) agent.wins++;
    else if (reward < 0) agent.losses++;
    agent.lastReward = reward;

    // Train every 20 steps
    if (agent.episodeBuffer.length >= 20) {
      updateWeights(agent);
      await saveWeightsToDb(symbol, agent);
    }
  }

  // Forward pass
  const normalizedFeatures = features.map(f => Math.max(-3, Math.min(3, f)));
  const { probs } = forward(normalizedFeatures, agent.weights);
  const actionIdx = sampleAction(probs);
  const actionNames: Array<'hold' | 'buy' | 'sell'> = ['hold', 'buy', 'sell'];
  const action = actionNames[actionIdx];
  const logProb = Math.log(probs[actionIdx] + 1e-8);

  // Store in episode buffer
  agent.episodeBuffer.push({ state: normalizedFeatures, action: actionIdx, reward: 0, logProb });
  agent.lastAction = action;
  agent.lastPrice = currentPrice;

  return {
    action,
    confidence: parseFloat((probs[actionIdx] * 100).toFixed(1)),
    probs: probs.map(p => parseFloat((p * 100).toFixed(1))),
  };
}
