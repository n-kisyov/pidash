# pidash

A lightweight, multi-instance web dashboard for [Pi-hole](https://pi-hole.net/), written in Python Flask. pidash aggregates stats from multiple Pi-hole servers into a single clean interface — simpler and easier to use than the built-in admin panel.

**9 pages, 49 API endpoints, 2 configured instances**

![License](https://img.shields.io/badge/license-EUPL-blue)

## Screenshots

*Screenshots coming soon*

## Features

- **Multi-instance dashboard** — aggregate queries, blocked %, gravity size, and active clients from all your Pi-hole servers
- **5 summary cards** — total queries, blocked, percent, active clients, blocklist domains with "updated X ago" timestamp
- **4 charts** — queries over time (stacked bar), client activity (stacked bar), query types (doughnut), upstream servers (doughnut)
- **Top lists** — top permitted/blocked domains & top permitted/blocked clients
- **Instance filter** — view aggregated data from all instances, or isolate a single Pi-hole
- **Time range selector** — filter chart data to last hour, 6 hours, 24 hours, or 7 days
- **Dark/light theme** — toggle in navbar, persists across sessions, respects system preference
- **Query log** — filters (domain, client, status, type), multi-instance interleaving, pagination, clickable cells for quick filtering
- **Domain management** — per-instance allow/deny lists (exact + regex), add and delete entries
- **Adlist management** — view, add, edit, and delete blocklists/allowlists per instance with status indicators
- **Group management** — create, edit, and delete client groups, default group protected from deletion
- **Domain search** — search across all instances' domain lists and gravity adlists with results grouped by category
- **Settings** — DNS upstreams, blocking mode, DNSSEC, cache size, port; DHCP config with active leases table; privacy level; local DNS/CNAME records; teleporter backup/restore
- **System info** — per-instance CPU, load, memory, swap, FTL database stats, version info with update badges
- **Actions** — enable/disable blocking (per-instance or all), update gravity, restart DNS, flush logs/ARP
- **Auto-refresh** — dashboard (10s), queries (30s, with Live toggle), domains (60s), system (30s)
- **Toast notifications** — alerts when Pi-hole instances are unreachable
- **Optional auth** — disable login entirely (`auth_enabled: false`) or require username/password
- **Deployment ready** — systemd unit, nginx reverse proxy config, gunicorn WSGI entry point

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3, Flask, Flask-Login |
| HTTP client | `requests` (proxies Pi-hole REST API) |
| Frontend | Bootstrap 5.3, Chart.js 4, vanilla JavaScript |
| Fonts/icons | Bootstrap Icons |
| Production | gunicorn, nginx, systemd |

## Quick Start

```bash
# Clone and install
git clone git@github.com:YOUR_USERNAME/pidash.git
cd pidash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure
cp example.config.json config.json
# Edit config.json — add your Pi-hole instance URLs

# Run (development)
python app.py
# Open http://localhost:8080
```

## Configuration

All configuration lives in `config.json`:

```json
{
  "instances": [
    {
      "id": "primary",
      "name": "Home Pi-hole",
      "url": "http://192.168.1.10",
      "api_key": null
    },
    {
      "id": "secondary",
      "name": "Office Pi-hole",
      "url": "http://10.0.0.5",
      "api_key": null
    }
  ],
  "secret_key": "change-me-to-a-random-string",
  "auth_enabled": false,
  "username": "admin",
  "password_hash": null
}
```

- **`instances[]`** — Your Pi-hole servers. `id` must be unique (letters, numbers, hyphens, underscores). Set `api_key` if Pi-hole has API authentication enabled, or `null` if disabled.
- **`secret_key`** — Flask session signing key. Generate with `python -c "import secrets; print(secrets.token_hex())"`.
- **`auth_enabled`** — Set to `true` to require login. Leave `false` for open access.
- **`password_hash`** — Generate with `python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('your-password'))"`.

Instances can also be managed through the **Instances** page in the UI.

## Production Deployment

```bash
# Copy service and nginx config
sudo cp deploy/pidash.service /etc/systemd/system/
sudo cp deploy/pidash.nginx.conf /etc/nginx/sites-available/pidash
sudo ln -s /etc/nginx/sites-available/pidash /etc/nginx/sites-enabled/

# Edit paths in pidash.service to match your install location
# Start
sudo systemctl daemon-reload
sudo systemctl enable --now pidash
sudo nginx -t && sudo systemctl reload nginx
```

The systemd service runs gunicorn with 4 workers on `127.0.0.1:8080`. nginx reverse-proxies to it. Adjust `server_name` and paths as needed.

## Architecture

Each Pi-hole v6+ server exposes a REST API at `/api`. pidash proxies these calls through Flask, aggregating results when multiple instances are configured:

```
Browser → nginx → gunicorn/Flask → Pi-hole API #1
                                 → Pi-hole API #2
                                 → ...
```

When an instance is selected via the filter dropdown, raw data from that single Pi-hole is returned instead of aggregated data.

All Pi-hole config mutations (settings, adlists, groups, DNS records, teleporter) are proxied through `/api/settings/<instance_id>/...` endpoints.

## Pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/` | Aggregated stats, charts, blocking controls, instance filter |
| Query Log | `/queries` | Filterable query log with live auto-refresh |
| Domains | `/domains` | Per-instance allow/deny domain management |
| Search | `/search` | Search domain lists and gravity across all instances |
| Settings | `/settings` | DNS, DHCP, Privacy, DNS Records, System actions, Teleporter |
| Adlists | `/adlists` | Per-instance blocklist/allowlist management |
| Groups | `/groups` | Per-instance client group management |
| System | `/system` | Per-instance CPU, memory, FTL stats, version info |
| Instances | `/instances` | Add, edit, remove Pi-hole instances |

## License

Copyright Pi-hole, LLC. Licensed under the European Union Public License (EUPL).
