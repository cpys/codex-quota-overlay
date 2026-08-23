import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createPreviewState} from './ui-preview-state.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'renderer');
const port = Number(process.env.CQO_PREVIEW_PORT || 4178);
const host = '127.0.0.1';
const files = new Map([
  ['/dashboard.css', ['dashboard.css', 'text/css; charset=utf-8']],
  ['/dashboard.js', ['dashboard.js', 'text/javascript; charset=utf-8']]
]);

const server = http.createServer(async (request, response) => {
  try {
    const requestPath = new URL(request.url || '/', `http://${host}:${port}`).pathname;
    if (requestPath === '/' || requestPath === '/dashboard.html') {
      const source = await readFile(path.join(root, 'dashboard.html'), 'utf8');
      const html = source.replace(
        '<script type="module" src="dashboard.js"></script>',
        '<script src="preview-api.js"></script><script type="module" src="dashboard.js"></script>'
      );
      send(response, 200, 'text/html; charset=utf-8', html);
      return;
    }
    if (requestPath === '/preview-api.js') {
      send(response, 200, 'text/javascript; charset=utf-8', previewApiSource(createPreviewState()));
      return;
    }
    const entry = files.get(requestPath);
    if (!entry) {
      send(response, 404, 'text/plain; charset=utf-8', 'Not found');
      return;
    }
    send(response, 200, entry[1], await readFile(path.join(root, entry[0])));
  } catch (error) {
    send(
      response,
      500,
      'text/plain; charset=utf-8',
      error instanceof Error ? error.message : 'Preview error'
    );
  }
});

server.listen(port, host, () => {
  process.stdout.write(`CQO_UI_PREVIEW http://${host}:${port}/\n`);
});

function send(response, status, contentType, body) {
  response.writeHead(status, {'Cache-Control': 'no-store', 'Content-Type': contentType});
  response.end(body);
}

function previewApiSource(initialState) {
  return `(() => {
    let state = ${JSON.stringify(initialState)};
    const listeners = new Set();
    const emit = () => listeners.forEach((listener) => listener(structuredClone(state)));
    const mergePreferences = (patch) => {
      state.preferences = {
        ...state.preferences,
        ...patch,
        history: {...state.preferences.history, ...(patch.history || {})},
        alerts: {...state.preferences.alerts, ...(patch.alerts || {})}
      };
      state.history.enabled = state.preferences.history.enabled;
      state.history.retentionDays = state.preferences.history.retentionDays;
    };
    window.quotaCenter = {
      async getState() { return structuredClone(state); },
      async updateSettings(patch) { mergePreferences(patch || {}); emit(); return structuredClone(state); },
      async clearHistory() {
        state.history.points = [];
        state.history.sampleCount = 0;
        state.insights = {...state.insights, burnRatePerHour: null, confidence: 'none', exhaustsAt: null, sampleCount: 0, spanMinutes: 0, status: 'learning'};
        emit();
        return structuredClone(state);
      },
      async refresh() { state.now = Date.now(); state.updatedAt = state.now; emit(); return structuredClone(state); },
      async copyDiagnostics() { return true; },
      onState(callback) { listeners.add(callback); return () => listeners.delete(callback); }
    };
  })();`;
}
