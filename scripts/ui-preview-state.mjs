export function createPreviewState(now = Date.now(), locale = 'zh-CN') {
  const resetsAt = Math.round((now + 4 * 60 * 60 * 1000) / 1000);
  const historyPoints = Array.from({length: 13}, (_, index) => ({
    at: now - (12 - index) * 10 * 60 * 1000,
    limitId: 'codex',
    resetsAt,
    usedPercent: 22 + index * 2
  }));
  const dailyUsageBuckets = Array.from({length: 14}, (_, index) => {
    const date = new Date(now - (13 - index) * 86400000);
    return {
      startDate: date.toISOString().slice(0, 10),
      tokens: [18200, 24600, 13100, 30800, 27400, 39600, 21200][index % 7] + index * 310
    };
  });
  return {
    version: '0.4.0-preview',
    locale,
    now,
    connection: 'ready',
    diagnostic: locale.startsWith('zh') ? 'OK | 运行正常' : 'OK | Ready',
    updatedAt: now - 48_000,
    quota: {
      limitId: 'codex',
      limitName: 'Codex',
      rateLimitReachedType: '',
      usedPercent: 46,
      resetsAt,
      windowDurationMins: 300,
      resetCount: 1,
      resetCards: [{expiresAt: Math.round((now + 9 * 86400000) / 1000), title: 'Rate-limit reset'}],
      buckets: [
        {
          limitId: 'codex',
          limitName: 'Codex',
          windows: [
            {kind: 'primary', usedPercent: 46, resetsAt, windowDurationMins: 300},
            {
              kind: 'secondary',
              usedPercent: 31,
              resetsAt: Math.round((now + 5 * 86400000) / 1000),
              windowDurationMins: 10080
            }
          ]
        },
        {
          limitId: 'codex_other',
          limitName: 'Review workload',
          windows: [
            {
              kind: 'primary',
              usedPercent: 18,
              resetsAt: Math.round((now + 21 * 60 * 60 * 1000) / 1000),
              windowDurationMins: 1440
            }
          ]
        }
      ]
    },
    insights: {
      burnRatePerHour: 12,
      confidence: 'high',
      exhaustsAt: now + 4.5 * 60 * 60 * 1000,
      hoursToReset: 4,
      paceRatio: 0.89,
      remaining: 54,
      safeRatePerHour: 13.5,
      sampleCount: 13,
      spanMinutes: 120,
      status: 'tight'
    },
    usage: {
      summary: {
        lifetimeTokens: 4_820_000,
        peakDailyTokens: 86_400,
        longestRunningTurnSec: 1320,
        currentStreakDays: 9,
        longestStreakDays: 23
      },
      dailyUsageBuckets
    },
    history: {enabled: false, retentionDays: 30, sampleCount: historyPoints.length, points: historyPoints},
    preferences: {
      overlayMode: 'balanced',
      history: {enabled: false, retentionDays: 30},
      alerts: {enabled: true, threshold: 20, paceRisk: true}
    }
  };
}
