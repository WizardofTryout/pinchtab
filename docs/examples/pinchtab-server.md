# Example: Server Smoke Test

This example is a happy-path smoke test for a running `pinchtab server` (orchestrator mode) on `127.0.0.1:9867`.

It is useful when you want to verify that the multi-instance orchestrator can:
- respond to health checks
- list and manage profiles
- launch and stop instances
- route requests to instances
- use the `--instance` CLI flag

For the server-mode mental model, see [Multi-Instance Guide](../guides/multi-instance.md).

## Prerequisites

Start the server:

```bash
pinchtab server
# or just: pinchtab (server is the default mode)
```

Set the base URL:

```bash
BASE=http://127.0.0.1:9867
```

The commands below assume `jq` is installed.

## 1. Check Health

```bash
curl -s "$BASE/health" | jq .
```

```bash
# CLI alternative
pinchtab health
```

```jsonc
// Response
{
  "status": "ok",
  "mode": "dashboard"
}
```

## 2. List Profiles

```bash
curl -s "$BASE/profiles" | jq .
```

```bash
# CLI alternative
pinchtab profiles
```

```jsonc
// Response
[
  {
    "id": "prof_967ae079",
    "name": "default",
    "path": "/Users/you/.pinchtab/profiles/default",
    "pathExists": true,
    "running": false,
    "sizeMB": 160.17
  }
]
```

## 3. List Instances

```bash
curl -s "$BASE/instances" | jq .
```

```bash
# CLI alternative
pinchtab instances
```

```jsonc
// Response (empty initially)
[]
```

## 4. Launch An Instance

```bash
INST=$(curl -s -X POST "$BASE/instances/launch" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-profile","mode":"headless"}' \
  | jq -r '.id')

echo "$INST"
```

```jsonc
// Response
{
  "id": "inst_944a07ad",
  "profileId": "prof_910b1739",
  "profileName": "my-profile",
  "port": "9871",
  "headless": true,
  "status": "starting",
  "startTime": "2026-03-07T19:29:54.066542+01:00",
  "attached": false
}
```

> **Note:** The instance will transition from `starting` to `running` within a few seconds.

## 5. Get Instance Details

```bash
curl -s "$BASE/instances/$INST" | jq .
```

```jsonc
// Response
{
  "id": "inst_944a07ad",
  "profileId": "prof_910b1739",
  "profileName": "my-profile",
  "port": "9871",
  "headless": true,
  "status": "running",
  "startTime": "2026-03-07T19:29:54.066542+01:00",
  "attached": false
}
```

## 6. Navigate On An Instance

Use the orchestrator proxy:

```bash
curl -s -X POST "$BASE/instances/$INST/navigate" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/pinchtab/pinchtab"}' | jq .
```

Or connect directly to the instance port:

```bash
PORT=$(curl -s "$BASE/instances/$INST" | jq -r '.port')
curl -s -X POST "http://127.0.0.1:$PORT/navigate" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/pinchtab/pinchtab"}' | jq .
```

```bash
# CLI alternative (uses --instance flag)
pinchtab nav --instance $INST https://github.com/pinchtab/pinchtab
```

```jsonc
// Response
{
  "tabId": "E291F6815F61C58B0C9EA9129F960744",
  "title": "GitHub - pinchtab/pinchtab",
  "url": "https://github.com/pinchtab/pinchtab"
}
```

## 7. List Tabs On An Instance

```bash
curl -s "$BASE/instances/$INST/tabs" | jq .
```

```bash
# CLI alternative
pinchtab tabs --instance $INST
```

```jsonc
// Response
{
  "tabs": [
    {
      "id": "E291F6815F61C58B0C9EA9129F960744",
      "title": "GitHub - pinchtab/pinchtab",
      "type": "page",
      "url": "https://github.com/pinchtab/pinchtab"
    }
  ]
}
```

## 8. Snapshot On An Instance

```bash
curl -s "$BASE/instances/$INST/snapshot?filter=interactive" | jq '.nodes[:5]'
```

```bash
# CLI alternative
pinchtab snap -i -c --instance $INST
```

```bash
# CLI output
# GitHub - pinchtab/pinchtab | https://github.com/pinchtab/pinchtab | 144 nodes
e0:link "Skip to content"
e1:link "GitHub Homepage"
e2:link "pinchtab"
e5:button "Search or jump to…"
...
```

## 9. Click On An Instance

```bash
curl -s "$BASE/instances/$INST/snapshot?filter=interactive" > /dev/null
curl -s -X POST "$BASE/instances/$INST/action" \
  -H "Content-Type: application/json" \
  -d '{"kind":"click","ref":"e5"}' | jq .
```

```bash
# CLI alternative
pinchtab snap -i --instance $INST > /dev/null
pinchtab click e5 --instance $INST
```

```jsonc
// Response
{
  "success": true,
  "result": {
    "clicked": true
  }
}
```

## 10. Screenshot On An Instance

```bash
curl -s "$BASE/instances/$INST/screenshot" > screenshot.jpg
ls -lh screenshot.jpg
```

```bash
# CLI alternative
pinchtab ss -o screenshot.jpg --instance $INST
```

```bash
# Output
Saved screenshot.jpg (97376 bytes)
```

## 11. PDF On An Instance

```bash
curl -s "$BASE/instances/$INST/pdf" > page.pdf
ls -lh page.pdf
```

```bash
# CLI alternative
pinchtab pdf -o page.pdf --instance $INST
```

```bash
# Output
Saved page.pdf (1492879 bytes)
```

## 12. Launch A Second Instance

```bash
INST2=$(curl -s -X POST "$BASE/instances/launch" \
  -H "Content-Type: application/json" \
  -d '{"name":"another-profile","mode":"headless"}' \
  | jq -r '.id')

echo "Instance 2: $INST2"
curl -s "$BASE/instances" | jq '.[].profileName'
```

```jsonc
// Response
"my-profile"
"another-profile"
```

## 13. Stop An Instance

```bash
curl -s -X DELETE "$BASE/instances/$INST" | jq .
```

```jsonc
// Response
{
  "stopped": true
}
```

## 14. Attach To External Chrome (Optional)

If you have Chrome running with `--remote-debugging-port=9222`:

```bash
# Get the CDP URL
CDP_URL=$(curl -s http://localhost:9222/json/version | jq -r '.webSocketDebuggerUrl')

# Attach via Pinchtab (requires attach.enabled: true in config)
curl -s -X POST "$BASE/instances/attach" \
  -H "Content-Type: application/json" \
  -d "{\"cdpUrl\":\"$CDP_URL\"}" | jq .
```

```jsonc
// Response
{
  "id": "inst_abc123",
  "attached": true,
  "cdpUrl": "ws://localhost:9222/devtools/browser/..."
}
```

## CLI Quick Reference (Server Mode)

| Action | CLI Command |
|--------|-------------|
| Health check | `pinchtab health` |
| List profiles | `pinchtab profiles` |
| List instances | `pinchtab instances` |
| Navigate | `pinchtab nav <url> --instance <id>` |
| Snapshot | `pinchtab snap -i -c --instance <id>` |
| Click | `pinchtab click <ref> --instance <id>` |
| Screenshot | `pinchtab ss -o file.jpg --instance <id>` |
| PDF export | `pinchtab pdf -o file.pdf --instance <id>` |

> **Tip:** Use `pinchtab instances` to get instance IDs, then use `--instance <id>` or `-I <id>` with other commands.

## What This Example Proves

If the full sequence works, your server/orchestrator can:
- start and manage multiple Chrome instances
- launch instances with different profiles
- route requests to specific instances
- proxy all bridge endpoints through the orchestrator
- stop instances cleanly
- optionally attach to external Chrome instances

If this example fails, check:
- the server is running on `127.0.0.1:9867`
- Chrome can be started successfully
- for attach: `attach.enabled: true` is set in config
