# Aether Web Panel (unofficial)

**[فارسی](README.md)**

A small Next.js web panel to run and manage the [Aether](https://github.com/CluvexStudio/aether) client on a server. Connect the tunnel with one button, watch status and logs, and optionally publish a password-protected public SOCKS5 address you can use from your phone or computer.

> This project is **unofficial** and not affiliated with CluvexStudio. The Aether name and logo belong to its authors (see the trademark policy in the upstream repo). If you publish this panel publicly, ask them for permission or change the name and icon.

## Features

- Start and stop the tunnel with one button
- Choose protocol (MASQUE, WireGuard, Gool, MiM), transport, scan mode, IP version and noize profile
- Live status, gateway, exit IP, uptime and logs
- Connection test (via `cloudflare.com/cdn-cgi/trace`)
- "Share": publish the proxy on a public address with a random username and password
- Basic Auth on the whole panel and every API route

## How it works

The panel downloads the official static (musl) Aether binary from the upstream Releases page, verifies its checksum and runs it as a child process. The SOCKS5 proxy listens on `127.0.0.1:1819` **inside the container**; use the Share feature to reach it from outside.

In Docker the binary is installed at build time (`AETHER_BIN=/opt/aether/aether`), so the Install button is not needed.

## Run with Docker

```bash
docker build -t aether-panel .
docker run -d --name aether-panel -p 3000:3000 \
  -e PANEL_USER=admin \
  -e PANEL_PASSWORD='a-long-random-password' \
  -v aether-data:/data -e TMPDIR=/data/tmp \
  aether-panel
```

Open `http://localhost:3000`. The volume is optional but keeps the WARP identity across restarts (Cloudflare rate-limits repeated device registrations).

## Deploy on Railway

1. New Project → Deploy from GitHub repo and pick this repo (the Dockerfile is detected automatically).
2. Variables: `PANEL_USER` and `PANEL_PASSWORD`.
3. Settings → Networking → Generate Domain.
4. Optional: add a Volume at `/data` and set `TMPDIR=/data/tmp`.

## Deploy on Render

1. New → Web Service, connect the repo, Runtime **Docker**.
2. Use a **paid** instance type; the free plan spins down after idling and drops the tunnel.
3. Environment: `PANEL_USER` and `PANEL_PASSWORD`.
4. Advanced → Health Check Path: `/healthz`.
5. Optional: Disk at `/data` plus `TMPDIR=/data/tmp`.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `PANEL_USER` | yes | Panel username |
| `PANEL_PASSWORD` | yes | Panel password. If empty the panel serves nothing (HTTP 503) |
| `AETHER_BIN` | no | Path to the Aether binary (preset in Docker) |
| `TMPDIR` | no | Runtime data directory; point it at a volume to persist |
| `BORE_SERVER` | no | Relay for the Share feature (default `bore.pub`) |
| `PORT` | no | Panel port (set automatically by Railway and Render) |

See `.env.example`.

## Local development

Requires Node 22 and pnpm 10.

```bash
pnpm install
printf 'PANEL_USER=admin\nPANEL_PASSWORD=test\n' > web/.env.local
export AETHER_BIN=/path/to/aether     # or use the panel's Install button (Linux only)
pnpm dev
```

## Security notes

- Never expose the panel without a strong `PANEL_PASSWORD`; anyone who reaches it can control the tunnel.
- Share uses the public `bore.pub` relay. The credentials are random and change every time you enable it, but other people's traffic exits from your server's IP. Enable it only when needed and keep the link private.
- After deploying, open the URL in a private window; it must ask for a password.

## Limitations

- **Vercel is not supported.** The panel runs a long-lived process and keeps state in memory, which serverless platforms do not preserve. Use Railway, Render, Fly.io or a VPS.
- The Install button works on Linux (x64 and arm64) only.
- HTTP/3 needs UDP, which some hosts block; HTTP/2 is the default.
- Traffic exits from your server's datacenter IP.

## Layout

```text
Dockerfile          panel image + Aether binary
web/                Next.js app
  proxy.ts          Basic Auth gate and /healthz
  app/api/aether/   start, stop, status, test, install and share APIs
  lib/              process control, binary installer, sharing (bore)
```

## License and credits

License: AGPL-3.0 (see `LICENSE`). If you run a modified version over a network, AGPL requires you to make its source available to its users.

The Aether core is by [CluvexStudio](https://github.com/CluvexStudio/aether); this repo only downloads and runs its official binary. Sharing uses [bore](https://github.com/ekzhang/bore).
