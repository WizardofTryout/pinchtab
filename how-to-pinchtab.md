# How-to-Pinchtab: Configuration & Troubleshooting

This guide summarizes how to configure, use, and troubleshoot the Pinchtab browser control server in this workspace.

## 🚀 Quick Start (CLI)

Pinchtab provides a CLI for direct browser control.

```bash
# Navigate to a URL
pinchtab nav https://example.com

# Get interactive elements (buttons, links, inputs) with refs
pinchtab snap -i -c

# Screenshot the current page
pinchtab screenshot page.jpg

# Click an element by its reference ID (e.g., e5)
pinchtab click e5
```

## 🌐 HTTP API Usage

Pinchtab is an HTTP server (default port `9867`).

| Action | Endpoint | Description |
| :--- | :--- | :--- |
| **New Tab** | `POST /tab` | `{"action":"new", "url":"..."}` -> returns `tabId` |
| **Snapshot** | `GET /snapshot` | Use `?tabId=...&filter=interactive` for token efficiency |
| **Action** | `POST /action` | `{"kind":"click", "ref":"e5", "tabId":"..."}` |
| **Screenshot** | `GET /screenshot`| `?tabId=...&quality=80` |

### Token Optimization
- **Smart Filters**: `?filter=interactive` drastically reduces token usage by only returning the accessibility tree for interactive elements.
- **Text Extraction**: Clean text extraction is up to 13x cheaper than full DOM snapshots.

---

## ⚙️ Configuration (Environment Variables)

In this Docker environment, Pinchtab is configured via `docker-compose.yml`.

| Variable | Default (Local) | Container Setup | Purpose |
| :--- | :--- | :--- | :--- |
| `PINCHTAB_BIND` | `127.0.0.1` | `0.0.0.0` | **CRITICAL**: Use `0.0.0.0` to allow access outside the container. |
| `PINCHTAB_PORT` | `9867` | `9867` | Server port. |
| `PINCHTAB_STATE_DIR`| `~/.config/pinchtab`| `/data` | Persistent storage for config and profiles. |
| `PINCHTAB_TOKEN` | (none) | `${PINCHTAB_TOKEN}` | Authentication token for the API. |
| `CHROME_BIN` | (none) | (auto-detected) | Path to Chrome/Chromium binary. |

### Configuration Precedence
1. **Environment Variables**: Overrides everything.
2. **`config.json`**: Stored in the `PINCHTAB_STATE_DIR`.
3. **Defaults**: Hardcoded in the binary.

---

## 👤 Browser Profiles

Profiles allow you to persist cookies, sessions, and histories.

- **Storage Location**: `/data/profiles` (mapped from `./data/profiles` on the host).
- **Default Profile**: `default`.
- **Interactive Creation**: Create profiles via the Dashboard at `http://localhost:9867/#/profiles`.

> [!NOTE]
> If a profile like `tester` exists on disk but isn't showing in the UI, check that it is located in the correct `profiles` subdirectory of the State Directory.

---

## 🛠 Troubleshooting & "Restart Required"

### "Restart Required" Warning
This usually happens if the Dashboard saves a new binding (e.g., `0.0.0.0`) to `config.json`, but the running process is still bound to the old address (e.g., `127.0.0.1`).
**Fix**: Restart the Docker container to pick up the new configuration.
```bash
docker compose restart pinchtab
```

### Dashboard Accessibility
If the dashboard is not accessible from your browser:
1. Ensure the container is running: `docker ps`.
2. check `PINCHTAB_BIND` is `0.0.0.0`.
3. Check port mapping in `docker-compose.yml` is `9867:9867`.

### Stealth Mode
If websites detect automation, ensure the dashboard settings for "Stealth Level" are set to `light` or `high`. This patches browser fingerprints.

---

## 🌲 Key Features Recap
- **Accessibility Tree**: No coordinate-based clicking. Use stable refs (`e0`, `e1`).
- **Stateful Sessions**: Log in once, stay logged in across container recreations.
- **Locking**: Prevent multiple agents from interfering with the same tab.
