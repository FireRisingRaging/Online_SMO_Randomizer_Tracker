# Online_SMO_Randomizer_Tracker
An online version of the SMO Randomizer Tracker configured on github. Works on desktop and mobile. Saves progress locally in each user's browser.

## Features

| Feature | Notes |
|---|---|
| Moon rows | +/- buttons, per-row max, lock & peace toggles |
| Save button toggle | Switch between click-to-save and auto-save on type |
| Capture row | Parabones, Banzai Bill, Spark Pylon, Bowser with click to toggle |
| Ability row | Long Jump, Cappy, Wall Jump with click to toggle |
| Loading Zone Notes | Collapsible zones, icon picker, text notes per zone |
| Settings | All 5 toggles + moon requirement + OBS BG color |
| OBS Overlay | Opens at 350×550, reads live from localStorage |
| Chroma key | Toggle OBS BG switches between dark and custom color (default #00FF00) |
| Persistent saves | Full state stored in browser localStorage per user |
| Clear | Resets all progress, keeps settings |

## OBS Setup

**Option A: Popup window:**
1. Click **Open OBS Overlay** in the tracker.
2. Add the popup as a Window Capture in OBS.

**Option B: Browser source:**
1. In OBS, add a **Browser Source**.
2. Set the URL to `https://FireRisingRaging.github.io/Online_SMO_Randomizer_Tracker/obs.html`.
3. Set width **350**, height **550**, and enable **"Shutdown source when not visible"**.
4. Use **Toggle OBS BG** in the main tracker (or the small **BG** button in the corner of the overlay) to switch the background to chroma key.

> **Note:** The OBS overlay reads its data from the same browser's localStorage. If you use the browser source option, open the main tracker in the same browser profile for the state to sync automatically.

## How State Saves Work

Each visitor's progress is saved privately in their own browser's `localStorage` under the key `tracker_state`. Clearing browser data or switching devices will reset progress, this is intentional so multiple people can use the same URL independently.
