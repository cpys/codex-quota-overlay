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

## macOS says the app cannot be opened

Current preview packages are not Apple-notarized. Download only from the official Releases page, verify the checksum, then right-click the app in Finder and choose **Open**. Do not bypass managed-device policy.

## Windows antivirus or SmartScreen warns

Current preview packages are not commercially signed. Verify the release checksum and use only the official GitHub asset. Do not disable security software. If policy blocks unsigned applications, wait for a signed release or build from reviewed source according to your organization's rules.

## Reporting safely

Use **Copy short diagnostics**. The result is at most 200 characters. Do not send settings files, paths, account data, raw App Server output, screenshots from managed devices, or long logs. See [SUPPORT.md](../SUPPORT.md).
