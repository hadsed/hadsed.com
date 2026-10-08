# Persistent local preview

Installed October 8, 2026 as the macOS user LaunchAgent
`com.hadsed.notes-preview`.

The preview runs independently of Codex terminal sessions, starts at login,
and restarts automatically when the server exits. It serves only this repo's
`notes/` directory on loopback, preserving existing `/notes/` links.

Preview: http://127.0.0.1:8766/notes/storyboards/sr71-directing.html

Server: `notes/serve-preview.py`. Installed configuration:
`~/Library/LaunchAgents/com.hadsed.notes-preview.plist`. A copy is versioned in
`notes/preview-service.plist`; its paths are specific to Had's Mac.

Logs: `~/Library/Logs/hadsed-preview/stdout.log` and `stderr.log`.

Inspect:
```sh
launchctl print gui/$(id -u)/com.hadsed.notes-preview
```

Restart after changing server code (HTML, CSS and JS edits only need a browser reload):
```sh
launchctl kickstart -k gui/$(id -u)/com.hadsed.notes-preview
```

Stop the service:
```sh
launchctl bootout gui/$(id -u)/com.hadsed.notes-preview
```

Start it again:
```sh
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.hadsed.notes-preview.plist
```

Verified the page and renderer modules return HTTP 200, then terminated the
managed server and confirmed launchd restarted it with a new PID and a working
preview. The Mac must be awake and the user logged in for the preview to respond.
