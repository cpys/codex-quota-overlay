# Troubleshooting

## The overlay does not appear

1. Confirm Codex Desktop is open, visible, and is the foreground application.
2. Confirm Codex Quota Overlay is running in the Windows notification area or macOS menu bar.
3. Choose **Refresh now**.
4. Copy the short diagnostic and compare it with the table below.

| Code          | Meaning                                                       | Action                                                                   |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `E01`         | Codex CLI was not found                                       | Choose **Codex CLI → Choose manually…** and select the local executable. |
| `E02`–`E05`   | Local App Server start, initialization, read, or exit failure | Restart Codex Desktop and the overlay; update both before reporting.     |
| `W01` / `W02` | Codex is closed, inactive, minimized, or not recognized       | Bring the official Codex Desktop window to the foreground.               |
| `M01`         | macOS returned no usable Codex identity or bounds             | Reopen Codex; include macOS/Codex versions in a report.                  |

## Placement is slightly wrong

Use **Position adjustment** in the tray/menu-bar menu. Vertical moves are 2 px and horizontal moves are 4 px. Restore defaults before reporting a layout regression, and include display resolution/scaling without sharing a screenshot from a managed device.

## Quota Center is empty or still learning

Open Quota Center by double-clicking the tray/menu-bar icon or choosing **Open Quota Center…**. Quota data is read only while the official Codex Desktop window is open and foregrounded. Burn rate and exhaustion forecasts need at least two usable samples from the same quota cycle, separated by enough time; a new cycle or a counter reset intentionally starts learning again.

The activity panel depends on `account/usage/read`. If that optional method is unavailable in the installed Codex version, the quota panels continue to work and the activity section stays empty. Update Codex before reporting a compatibility problem.

## Local history does not survive restart

This is the privacy-preserving default. In Quota Center, enable **Local history → Persist** and choose 7, 14, 30, or 90 days. Disabling persistence stops new writes but does not silently delete an existing history file; use **Clear** and confirm to remove both session samples and the file.

## Alerts do not appear

Alerts are disabled by default. Enable them in Quota Center or the tray menu, choose a threshold, and confirm that operating-system notifications are allowed for Codex Quota Overlay. Each threshold/risk alert is deliberately shown at most once per quota cycle, so toggling windows or refreshing does not repeat it.

## macOS says the app cannot be opened

Current preview packages are not Apple-notarized. Download only from the official Releases page, verify the checksum, then right-click the app in Finder and choose **Open**. Do not bypass managed-device policy.

## Windows antivirus or SmartScreen warns

Current preview packages are not commercially signed. Verify the release checksum and use only the official GitHub asset. Do not disable security software. If policy blocks unsigned applications, wait for a signed release or build from reviewed source according to your organization's rules.

## Reporting safely

Use **Copy short diagnostics**. The result is at most 200 characters. Do not send settings files, paths, account data, raw App Server output, screenshots from managed devices, or long logs. See [SUPPORT.md](../SUPPORT.md).
