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

### Browser Source (transparent overlay)

1. Open the tracker at `https://firerisingraging.github.io/Online_SMO_Randomizer_Tracker/`.
2. Enter a room code or click **Generate**, then click **Connect**.
3. Copy the **OBS URL** that appears.
4. In OBS, add a **Browser Source** and paste the URL.
5. Set width **315**, height **450** (or the calculated size shown in the tracker).
6. The overlay background is transparent — no chroma key needed.

To make the overlay larger, change **OBS Overlay Scale** in Settings. The sync section shows the calculated width and height to paste into OBS, and the scale is synced to any already-open overlays.

### Popup Window (Window Capture)

1. Connect to a room.
2. Click **Open Popup** to open a dark-background window sized to your overlay scale.
3. Add a **Window Capture** source in OBS and select the popup window.

## How Sync Works

- Each room is identified by a 12-character code.
- When connected, every state change is sent to the sync server and broadcast to all other clients in the same room.
- Multiple controllers can share one room. Last write wins.
- Without a room code, the tracker works fully offline using `localStorage`.
- Room codes are not authenticated. Use random/generated codes and keep them private.

## How State Saves Work

Each visitor's progress is saved privately in their own browser's `localStorage` under the key `tracker_state`. Connecting to a sync room does not replace local storage; it merges remote state into the local copy.

## Live Auto-Tracking (SMO-Randomizer entrance rando, local testing)

If you're testing the SMO-Randomizer mod's entrance-rando live-tracking feature, this draws the connection map automatically as you play — no manual click-drag. Everything runs on your own PC; nothing goes through the public GitHub Pages site or the cloud sync server above.

**Requirements:** [Node.js](https://nodejs.org/) 18+ installed, and your Switch on the same local network (Wi-Fi/LAN) as your PC.

### 1. Start the local server

One command starts the tracker page, the WebSocket relay, and the listener the mod connects to — all in one process.

**Linux / macOS:**
```bash
cd Online_SMO_Randomizer_Tracker-main
npm install
npm run local
```

**Windows (PowerShell or CMD):**
```powershell
cd Online_SMO_Randomizer_Tracker-main
npm install
npm run local
```

Leave that window open. It prints `Tracker + relay listening on http://localhost:8080` when ready.

### 2. Find your PC's local IP address

The Switch needs to reach your PC by IP, not `localhost`.

- **Windows:** open CMD/PowerShell, run `ipconfig`, and use the `IPv4 Address` under your active adapter (e.g. `192.168.1.50`).
- **macOS:** `ipconfig getifaddr en0` (or `en1` for Wi-Fi on older Macs), or System Settings → Wi-Fi → Details.
- **Linux:** `hostname -I` or `ip addr show`.

It should look like `192.168.x.x` or `10.x.x.x`. If your PC has a firewall, make sure it allows inbound connections on ports **8080** and **8173** (both TCP).

### 3. Connect in-game

Launch the randomized game, open the pause menu's **Mod Config**, and select **Tracker Live Testing**. It's a small menu with two rows:

1. **IP Address** — opens the keyboard, type the PC IP from step 2.
2. **Room Code** — opens the keyboard, type any room code (letters/numbers), e.g. `test123`.

Both keyboards pre-fill with whatever is currently set, so re-opening this menu to check or change either value is quick. These reset to the defaults on relaunch (not saved to file), so set them again each time you boot the game.

### 4. Connect the tracker page

Open `http://localhost:8080/map.html` in a browser on the same PC, click **Live Tracking**, type the *same* room code you entered in-game, and click **Connect**. The map will start drawing connections live as you play.

## Cloud Live Tracking (Firebase, no local relay needed)

An alternative to the local-relay setup above: the mod writes connection events straight to a Firestore database, and the tracker page (even the public GitHub Pages one) reads them straight from Firestore too. Nobody needs to run `npm run local` or open any ports — just a room code, same as before.

**Status:** the browser side (`firebase-live-sync.js`, the "Cloud Sync" checkbox in the Live Tracking panel) is ready once you fill in your own Firebase project's config below. The mod side (the Switch writing events to Firestore instead of/alongside the local TCP path) is separate, in-progress work in the SMO-Randomizer mod itself.

Access control here is entirely room-code-based, the same as the local relay's ("room codes are not authenticated, keep them private") — no Firebase login or per-device identity is ever required of a public user.

### Setting up your own Firebase project

1. Go to the [Firebase console](https://console.firebase.google.com/) and sign in with your Google account.
2. Click **Add project**, give it any name (e.g. `smo-randomizer-tracker`), and you can disable Google Analytics for it — not needed here.
3. Once created, in the left sidebar go to **Build → Firestore Database → Create database**. Pick any location close to you, and start in **production mode** (not test mode — you'll paste in the real rules below instead of the wide-open test-mode default).
4. Open the **Rules** tab, replace the contents with everything in this repo's [`firestore.rules`](firestore.rules), and click **Publish**.
5. Event documents don't currently carry a timestamp (the mod has no reliable wall clock to stamp one with), so there's no automatic cleanup yet — a room's events will accumulate until manually cleared from the console. Fine for now given the volume a testing session produces; worth revisiting (e.g. a Cloud Function stamping a server-side timestamp on write, then a Firestore TTL policy keyed on that) if it ever becomes a real storage concern.
6. Back in the project overview, click the gear icon → **Project settings**, scroll to **Your apps**, click the **`</>`** (web) icon to register a new web app (any nickname). Firebase shows you a `firebaseConfig` object.
7. Copy `apiKey`, `authDomain`, and `projectId` from that object into `firebase-live-sync.js` in this repo, replacing the `REPLACE_ME` placeholders at the top of the file. These values are meant to be public/committed — they identify which project to talk to, they don't grant access on their own (the rules do that).

Once that's done, checking **Cloud Sync** in the Live Tracking panel before hitting Connect uses Firestore instead of the local relay.
