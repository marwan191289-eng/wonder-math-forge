/**
 * RL Agent Persistence Layer
 * Saves and loads agent weights from database
 */

interface AgentWeights {
  symbol: string;
  weights: number[];
  bias: number[];
  timestamp: number;
  episodeCount: number;
  avgReward: number;
}

/**
 * Save agent weights to database
 */
export async function saveAgentWeights(
  symbol: string,
  weights: number[],
  bias: number[],
  episodeCount: number,
  avgReward: number
): Promise<void> {
  try {
    // In production, this would save to rl_agent_states table
    console.log(`[RL-Agent] Saving weights for ${symbol}`);
    console.log(`  - Weights: ${weights.length} parameters`);
    console.log(`  - Bias: ${bias.length} parameters`);
    console.log(`  - Episodes: ${episodeCount}`);
    console.log(`  - Avg Reward: ${avgReward.toFixed(4)}`);

    // Placeholder for actual database save
    // await db.query(
    //   `INSERT INTO rl_agent_states (symbol, weights, bias, episode_count, avg_reward, created_at)
    //    VALUES (?, ?, ?, ?, ?, ?)`,
    //   [symbol, JSON.stringify(weights), JSON.stringify(bias), episodeCount, avgReward, new Date()]
    // );
  } catch (error) {
    console.error('[RL-Agent] Failed to save weights:', error);
  }
}

/**
 * Load agent weights from database
 */
export async function loadAgentWeights(symbol: string): Promise<AgentWeights | null> {
  try {
    // In production, this would load from rl_agent_states table
    console.log(`[RL-Agent] Loading weights for ${symbol}`);

    // Placeholder for actual database load
    // const result = await db.query(
    //   `SELECT * FROM rl_agent_states WHERE symbol = ? ORDER BY created_at DESC LIMIT 1`,
    //   [symbol]
    // );

    // For now, return default weights
    return {
      symbol,
      weights: Array(50).fill(0.01), // 50 weights initialized to 0.01
      bias: Array(10).fill(0), // 10 bias terms
      timestamp: Date.now(),
      episodeCount: 0,
      avgReward: 0,
    };
  } catch (error) {
    console.error('[RL-Agent] Failed to load weights:', error);
    return null;
  }
}

/**
 * Calculate reward based on price change
 */
export function calculateReward(
  entryPrice: number,
  currentPrice: number,
  action: 'hold' | 'buy' | 'sell'
): number {
  const priceChange = (currentPrice - entryPrice) / entryPrice;

  if (action === 'buy') {
    // Reward for upward movement
    return priceChange > 0 ? priceChange * 100 : priceChange * 50;
  } else if (action === 'sell') {
    // Reward for downward movement
    return priceChange < 0 ? -priceChange * 100 : priceChange * 50;
  } else {
    // Hold: small penalty for opportunity cost
    return Math.abs(priceChange) * 10;
  }
}

/**
 * Update agent policy based on reward
 */
export function updatePolicy(
  weights: number[],
  gradients: number[],
  reward: number,
  learningRate: number = 0.01
): number[] {
  const updatedWeights = [...weights];

  for (let i = 0; i < updatedWeights.length; i++) {
    // Policy gradient update: w = w + lr * gradient * reward
    updatedWeights[i] += learningRate * gradients[i] * reward;
  }

  return updatedWeights;
}

/**
 * Generate action from policy
 */
export function selectAction(
  state: number[],
  weights: number[],
  epsilon: number = 0.1 // Exploration rate
): 'hold' | 'buy' | 'sell' {
  // Epsilon-greedy exploration
  if (Math.random() < epsilon) {
    const actions = ['hold', 'buy', 'sell'] as const;
    return actions[Math.floor(Math.random() * 3)];
  }

  // Exploit: compute Q-values
  const qValues = [0, 0, 0]; // [hold, buy, sell]

  for (let i = 0; i < Math.min(state.length, weights.length); i++) {
    qValues[0] += state[i] * weights[i]; // hold
    qValues[1] += state[i] * weights[(i + 1) % weights.length]; // buy
    qValues[2] += state[i] * weights[(i + 2) % weights.length]; // sell
  }

  const maxQ = Math.max(...qValues);
  const maxIndex = qValues.indexOf(maxQ);

  return ['hold', 'buy', 'sell'][maxIndex] as 'hold' | 'buy' | 'sell';
}

/**
 * Training loop for RL agent
 */
export async function trainAgent(
  symbol: string,
  episodes: number = 100,
  maxSteps: number = 50
): Promise<{ avgReward: number; weights: number[] }> {
  let weights = Array(50).fill(0.01);
  let totalReward = 0;

  console.log(`[RL-Agent] Training on ${symbol} for ${episodes} episodes`);

  for (let episode = 0; episode < episodes; episode++) {
    let episodeReward = 0;
    const state = Array(9).fill(0.5); // Normalized state [0-1]

    for (let step = 0; step < maxSteps; step++) {
      // Select action
      const action = selectAction(state, weights);

      // Simulate reward (in production, this would come from market data)
      const reward = Math.random() * 2 - 1; // Random reward [-1, 1]
      episodeReward += reward;

      // Update policy
      const gradients = Array(50).fill(Math.random() * 0.1);
      weights = updatePolicy(weights, gradients, reward, 0.001);
    }

    totalReward += episodeReward;

    if ((episode + 1) % 10 === 0) {
      console.log(`  Episode ${episode + 1}/${episodes}: Avg Reward = ${(totalReward / (episode + 1)).toFixed(4)}`);
    }
  }

  const avgReward = totalReward / episodes;

  // Save weights
  await saveAgentWeights(symbol, weights, Array(10).fill(0), episodes, avgReward);

  return { avgReward, weights };
}
