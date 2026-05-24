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
- A computer and a phone on the **same Wi-Fi / LAN**

### Run

```bash
git clone https://github.com/tanghoong/desktop-namecard-station.git
cd desktop-namecard-station
docker compose up -d
```

### Capture Cards

1. Find your computer's LAN IP (e.g., `192.168.1.25`).
2. On your phone browser, open `http://<LAN-IP>:3000/capture`.
3. Place a business card within the guide frame.
4. The app auto-detects stability → counts down `3, 2, 1` → captures front.
5. Flip the card → auto-captures back.
6. Done! Images are saved in `./data/cards/`.

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