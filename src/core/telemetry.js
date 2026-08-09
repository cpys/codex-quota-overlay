import os from 'node:os';

const DAY_MS = 24 * 60 * 60 * 1000;

export class TelemetryClient {
  constructor({endpoint = '', version, platform, locale, settings}) {
    this.endpoint = validEndpoint(endpoint) ? endpoint : '';
    this.version = version;
    this.platform = platform;
    this.locale = locale;
    this.settings = settings;
    this.nextAttemptAt = 0;
  }

  get configured() {
    return Boolean(this.endpoint);
  }

  get enabled() {
    return this.configured && this.settings.get().telemetryEnabled === true;
  }

  async sendIfDue(force = false) {
    if (!this.enabled || Date.now() < this.nextAttemptAt) return false;
    const state = this.settings.get();
    const last = Date.parse(state.lastHeartbeatUtc ?? '');
    if (!force && Number.isFinite(last) && Date.now() - last < DAY_MS) return false;
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {'content-type': 'application/json', 'user-agent': `CodexQuotaOverlay/${this.version}`},
        body: JSON.stringify({
          schemaVersion: 1,
          event: 'daily_active',
          installationId: this.settings.ensureInstallationId(),
          appVersion: this.version,
          platform: this.platform,
          osVersion: os.release(),
          locale: this.locale,
          sentAt: new Date().toISOString()
        }),
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.settings.update({lastHeartbeatUtc: new Date().toISOString()});
      this.nextAttemptAt = 0;
      return true;
    } catch {
      this.nextAttemptAt = Date.now() + 60 * 60 * 1000;
      return false;
    }
  }
}

function validEndpoint(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
