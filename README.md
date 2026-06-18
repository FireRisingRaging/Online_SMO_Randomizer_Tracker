# Online_SMO_Randomizer_Tracker

An online version of the SMO Randomizer Tracker configured on GitHub. Works on desktop and mobile. Saves progress locally in each user's browser, with optional live sync for OBS overlays.

## Features

| Feature            | Notes                                                            |
| ------------------ | ---------------------------------------------------------------- |
| Moon rows          | +/- buttons, per-row max, lock & peace toggles                   |
| Save button toggle | Switch between click-to-save and auto-save on type               |
| Capture row        | Parabones, Banzai Bill, Spark Pylon, Bowser with click to toggle |
| Ability row        | Long Jump, Cappy, Wall Jump with click to toggle                 |
| Loading Zone Notes | Collapsible zones, icon picker, text notes per zone              |
| Settings           | All 5 toggles + moon requirement + sync server URL               |
| OBS Overlay        | Browser source with live state sync, transparent background      |
| Scale              | Default 315×450, customizable via URL parameter                  |
| Persistent saves   | Full state stored in browser localStorage per user               |
| Live sync          | Optional room-based WebSocket sync for cross-browser overlays    |
| Clear              | Resets all progress, keeps settings                              |

## Hosting the Sync Server

The static tracker files stay on GitHub Pages. The live sync server is a small Node.js/WebSocket relay that you host yourself.

### Quick start (Docker Compose)

1. Clone the repo on your VPS.
2. Edit `docker-compose.yml` if you want a port other than `3000`:
   ```yaml
   environment:
     - PORT=8080
   ports:
     - "8080:8080"
   ```
3. Start the server:
   ```bash
   docker compose up -d
   ```
4. Point your Cloudflare Tunnel (or reverse proxy) to `http://localhost:PORT`.

The server listens for WebSocket connections on `/ws`. Cloudflare handles HTTPS/WSS termination, so the origin can be plain HTTP/WS.

### Manual start

```bash
npm install
npm start
```

`PORT` defaults to `3000`.

## OBS Setup

1. Open the tracker at `https://firerisingraging.github.io/Online_SMO_Randomizer_Tracker/`.
2. Enter a room code or click **Generate**, then click **Connect**.
3. Copy the **OBS URL** that appears.
4. In OBS, add a **Browser Source** and paste the URL.
5. Set width **315**, height **450**.
6. The overlay background is transparent so no chroma key needed.

To make the overlay larger, change **OBS Overlay Scale** in Settings. The sync section shows the calculated width and height to paste into OBS, and the scale is synced to any already-open overlays.

## How Sync Works

- Each room is identified by a 12-character code.
- When connected, every state change is sent to the sync server and broadcast to all other clients in the same room.
- Multiple controllers can share one room. Last write wins.
- Without a room code, the tracker works fully offline using `localStorage`.
- Room codes are not authenticated. Use random/generated codes and keep them private.

## How State Saves Work

Each visitor's progress is saved privately in their own browser's `localStorage` under the key `tracker_state`. Connecting to a sync room does not replace local storage; it merges remote state into the local copy.
