import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const DEFAULTS = Object.freeze({
  schemaVersion: 1,
  placement: {x: 0, y: 0},
  telemetryEnabled: null,
  codexCliPath: null,
  installationId: null,
  lastHeartbeatUtc: null
});

export class SettingsStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.value = this.#load();
  }

  get() {
    return structuredClone(this.value);
  }

  update(patch) {
    this.value = merge(this.value, patch);
    this.#save();
    return this.get();
  }

  ensureInstallationId() {
    if (!this.value.installationId) this.update({installationId: randomUUID()});
    return this.value.installationId;
  }

  #load() {
    try {
      const loaded = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return merge(DEFAULTS, loaded);
    } catch {
      return structuredClone(DEFAULTS);
    }
  }

  #save() {
    fs.mkdirSync(path.dirname(this.filePath), {recursive: true});
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(this.value, null, 2)}\n`, {encoding: 'utf8', mode: 0o600});
    fs.renameSync(temporary, this.filePath);
  }
}

function merge(base, patch) {
  return {
    ...structuredClone(base),
    ...(patch && typeof patch === 'object' ? patch : {}),
    placement: {
      ...(base?.placement ?? DEFAULTS.placement),
      ...(patch?.placement && typeof patch.placement === 'object' ? patch.placement : {})
    }
  };
}
