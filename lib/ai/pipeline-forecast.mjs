/**
 * lib/ai/pipeline-forecast.mjs — AI Pipeline Forecast
 * Predicts when you'll get interviews/offers based on historical data.
 */
import { askGeminiJSON } from './gemini.mjs';
import { getApplicationStats, getRejectionData } from './rejection-analyzer.mjs';

export async function forecastPipeline(opts = {}) {
  const stats = getApplicationStats();
  const rejections = getRejectionData();

  const prompt = `Forecast this job search pipeline based on historical data.

## Current Stats
Applied: ${stats.applied}
Interview: ${stats.interview}
Offer: ${stats.offer}
Rejected: ${stats.rejected}
Total tracked: ${stats.total}

## Rejection History (last 20)
${JSON.stringify(rejections.slice(-20), null, 2)}

Return JSON:
{
  "currentVelocity": "apps per week",
  "interviewRate": "percent of apps that lead to interview",
  "offerRate": "percent of interviews that lead to offer",
  "forecast": {
    "nextInterviewBy": "Estimated date",
    "nextOfferBy": "Estimated date",
    "applicationsNeededForNextInterview": 0,
    "applicationsNeededForNextOffer": 0
  },
  "bottlenecks": ["What's slowing things down"],
  "recommendations": ["What to change to speed things up"],
  "confidence": "high|medium|low",
  "weeklyTarget": "Recommended applications per week"
}`;

  return await askGeminiJSON(prompt, opts) || {
    currentVelocity: 0, interviewRate: '0%', forecast: {}, bottlenecks: [], recommendations: [], confidence: 'low'
  };
}

export function calculateMetrics(stats) {
  const { applied, interview, offer, rejected } = stats;
  return {
    applicationToInterview: applied > 0 ? `${Math.round(interview / applied * 100)}%` : '0%',
    interviewToOffer: interview > 0 ? `${Math.round(offer / interview * 100)}%` : '0%',
    overallSuccess: applied > 0 ? `${Math.round(offer / applied * 100)}%` : '0%',
    rejectionRate: applied > 0 ? `${Math.round(rejected / applied * 100)}%` : '0%',
  };
}

export default { forecastPipeline, calculateMetrics };
