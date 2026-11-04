# Local preview background process

The preview runs as a detached process, independent of the terminal and Codex session. It has no login startup or automatic restart service.

Preview: http://127.0.0.1:8766/notes/storyboards/sr71-directing.html

To start it manually from the repo root:

```sh
nohup /opt/homebrew/bin/python3 -u notes/serve-preview.py --port 8766 </dev/null >~/Library/Logs/hadsed-preview/stdout.log 2>~/Library/Logs/hadsed-preview/stderr.log &
```

The server binds only to loopback and serves only `notes/`. If it exits or the Mac reboots, start it again manually. HTML, CSS and JS edits only need a browser reload.

The earlier LaunchAgent was removed October 8, 2026. Verified the detached server has no terminal, is reparented to PID 1, and returns HTTP 200 after its launching command has finished.
