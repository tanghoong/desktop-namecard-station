# Namecard Station

A **local-first** web tool for automatically capturing front and back images of paper business cards using your phone browser, then saving each card as a recoverable folder on your computer.

Designed for people who have many physical name cards but want a simple, private, and reliable way to digitize them before doing OCR, AI parsing, review, or export.

---

## Core Idea

1. Your **computer** runs a local Docker server.
2. Your **phone** opens the capture page through the same Wi-Fi/LAN.
3. Your phone camera detects a stable card view.
4. The app automatically counts down and captures the **front** side.
5. You flip the card.
6. The app automatically captures the **back** side.
7. Images are uploaded and saved into a local folder — one folder per card.

---

## Why Local-First?

The original card images are the most important source of truth. Namecard Station saves every card as files first, so your data can still be recovered even if a database or index breaks. No cloud, no login, no vendor lock-in.

---

## MVP Scope

- 📱 Mobile camera capture via phone browser
- ⏱️ Auto countdown capture with stability detection
- 🔄 Front/back card pairing
- 💾 Local filesystem storage (one folder per card)
- 📄 Markdown/JSON draft generation (`contact.md`, `metadata.json`, `status.json`)
- 📋 Basic card list and detail page

### Not Included in MVP

- OCR / AI parsing
- CRM features
- Login / authentication
- Cloud sync
- Database dependency
- Billing / SaaS

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)
- Android phone (Chrome or Huawei Browser) on the same computer via USB

### Camera Access — Option A: USB via adb (No Wi-Fi needed)

Android Chrome requires HTTPS for camera access — except when the page is served from `localhost`. `adb reverse` tunnels your phone's localhost port to the laptop, so the phone treats your server as `localhost` and camera works without any certificate.

**Step 1 — Enable USB Debugging on your phone:**
Settings → About phone → tap "Build number" 7 times → Developer options → USB Debugging: ON

**Step 2 — Install adb** (if you don't have it):
Download [Android Platform Tools](https://developer.android.com/tools/releases/platform-tools) and add it to your PATH, or install via winget:

```powershell
winget install Google.PlatformTools
```

**Step 3 — Connect and reverse the port:**

```bash
adb reverse tcp:3000 tcp:3000
```

Then on your phone browser open `http://localhost:3000` — camera will work.

---

### Camera Access — Option B: Wi-Fi via Cloudflare Quick Tunnel (No USB needed)

Cloudflare Quick Tunnel creates a temporary public HTTPS URL that tunnels to your local server. Because it's HTTPS, the phone camera works over Wi-Fi without any certificate setup.

**Step 1 — Install cloudflared:**

```powershell
winget install Cloudflare.cloudflared
```

Or download the installer from the [cloudflared releases page](https://github.com/cloudflare/cloudflared/releases) — grab `cloudflared-windows-amd64.msi`.

**Step 2 — Make sure your server is running first:**

```bash
# Docker:
docker compose up -d

# Or dev mode:
npm run dev:server
```

**Step 3 — Start the tunnel:**

```bash
cloudflared tunnel --url http://localhost:3000
```

**Step 4 — Open the URL on your phone:**

cloudflared will print something like:

```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://random-words-here.trycloudflare.com                                               |
+--------------------------------------------------------------------------------------------+
```

Open that `https://….trycloudflare.com` URL on your phone browser. Camera access will work.

> **Notes:**
>
> - The URL changes every time you restart cloudflared — copy it fresh each session.
> - The tunnel is active only while the `cloudflared` process is running. Close it when done.
> - No Cloudflare account or login needed for Quick Tunnel.

### Run

```bash
git clone https://github.com/tanghoong/desktop-namecard-station.git
cd desktop-namecard-station
docker compose up -d
```

### Verify Camera Detection (Before First Use)

Open `http://localhost:3000/test.html` on your phone browser. This page shows a live debug overlay — brightness, motion diff, and contrast scores — so you can confirm detection thresholds work on your device before capturing real cards.

### Capture Cards

1. Connect phone via USB and run `adb reverse tcp:3000 tcp:3000`.
2. On your phone browser, open `http://localhost:3000/capture`.
3. Place a business card within the guide frame.
4. The app continuously detects brightness, stability, and card content.
5. When conditions are met, it auto-counts down `3, 2, 1` → captures front.
6. Flip the card — the app detects the change and auto-captures back.
7. Done! Images are saved in `./data/cards/`.

---

## Project Structure

```
namecard-station/
├── apps/
│   ├── web/            # React + TypeScript + Vite frontend
│   └── server/         # Node.js + Fastify backend
├── data/
│   └── cards/          # One folder per card
├── docs/
│   ├── technical-spec.md
│   ├── api.md
│   └── roadmap.md
├── docker-compose.yml
├── Dockerfile
├── package.json
├── README.md
└── .gitignore
```

---

## Card Folder Format

Each card gets its own folder under `data/cards/`:

```
2026-05-24_230501_ab12/
├── front.original.jpg
├── front.jpg
├── back.original.jpg
├── back.jpg
├── metadata.json
├── status.json
├── ocr_raw.txt          (future)
├── contact.draft.json   (future)
└── contact.md
```

---

## Tech Stack

| Layer       | Technology              |
|------------|-------------------------|
| Frontend   | React, TypeScript, Vite |
| Backend    | Node.js, Fastify        |
| Storage    | Local filesystem        |
| Container  | Docker, Docker Compose  |
| Database   | None (MVP); SQLite planned for v2 |

---

## Architecture Principles

- **Phone decides when to capture** — the phone has the camera and analyzes frames locally.
- **Server never receives live video** — no WebRTC, no streaming complexity.
- **Server only receives and saves images** — simple upload API.
- **Images are saved immediately** — don't wait for both sides; save front as soon as it's captured.
- **Folders are the source of truth** — no database dependency in MVP.

---

## Documentation

- [Technical Specification](docs/technical-spec.md)
- [API Reference](docs/api.md)
- [Roadmap](docs/roadmap.md)

---

## License

MIT