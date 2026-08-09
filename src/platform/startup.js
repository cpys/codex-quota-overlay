export function startupEnabled(app) {
  return app.getLoginItemSettings().openAtLogin;
}

export function setStartupEnabled(app, enabled) {
  app.setLoginItemSettings({openAtLogin: enabled, openAsHidden: true});
}
