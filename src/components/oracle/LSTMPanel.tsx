// components/LSTMPanel.tsx

import React from 'react';
import { LSTMPrediction } from '../engine/types';

interface LSTMPanelProps {
  prediction: LSTMPrediction | null;
}

export const LSTMPanel: React.FC<LSTMPanelProps> = ({ prediction }) => {
  if (!prediction) {
    return <div className="text-gray-500 p-4">LSTM model not loaded or no prediction available</div>;
  }

  const isBullish = prediction.direction === 'BULLISH';
  const confidence = prediction.confidence;
  const uncertainty = prediction.uncertainty;

  return (
    <div className="bg-slate-800 rounded-lg p-4 text-sm text-slate-200 space-y-3">
      <h3 className="text-purple-400 font-bold text-lg">🤖 LSTM Prediction</h3>

      {/* Direction & Confidence */}
      <div className={`p-3 rounded-lg ${isBullish ? 'bg-green-900/30 border border-green-500/50' : 'bg-red-900/30 border border-red-500/50'}`}>
        <div className="flex justify-between items-center">
          <span className="text-2xl font-bold">
            {isBullish ? '📈' : '📉'} {prediction.direction}
          </span>
          <span className="text-lg font-mono">
            {(confidence * 100).toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
          <div
            className={`h-2 rounded-full ${isBullish ? 'bg-green-500' : 'bg-red-500'}`}
            style={{ width: `${confidence * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>Confidence</span>
          <span>Uncertainty: {(uncertainty * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* Predicted Price */}
      <div className="bg-slate-700/50 rounded p-2">
        <div className="flex justify-between">
          <span className="text-slate-400">Predicted Price</span>
          <span className="font-mono text-yellow-400">
            ${prediction.predictedPrice.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>Log Return: {(prediction.predictedLogReturn * 100).toFixed(2)}%</span>
          <span>Regime: {prediction.regime === 'trending' ? '📈 Trending' : '🔄 Ranging'}</span>
        </div>
      </div>

      {/* Recommendation */}
      <div className={`p-2 rounded text-center font-bold ${
        prediction.recommendation.includes('STRONG')
          ? 'bg-yellow-500/20 text-yellow-400'
          : prediction.recommendation === 'WAIT'
          ? 'bg-gray-500/20 text-gray-400'
          : 'bg-blue-500/20 text-blue-400'
      }`}>
        {prediction.recommendation}
      </div>

      {/* Ensemble Vote */}
      <div className="text-xs text-slate-500">
        Ensemble Vote: {prediction.ensembleVote.bullishVotes}/{prediction.ensembleVote.totalModels} models bullish
      </div>
    </div>
  );
};
