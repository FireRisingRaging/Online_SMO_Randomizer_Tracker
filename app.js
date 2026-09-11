'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const STATE_KEY = 'tracker_state';
const WS_URL_KEY = 'tracker_ws_url';
const ROOM_CODE_KEY = 'tracker_room_code';

let applyingRemote = false;

const KINGDOMS = [
  { name: 'Cascade Kingdom', img: 'assets/Cascade.png', multi: 'assets/Cascade_Multi.png', min: 1, max: 10 },
  { name: 'Sand Kingdom', img: 'assets/Sand.png', multi: 'assets/Sand_Multi.png', min: 11, max: 21 },
  { name: 'Lake Kingdom', img: 'assets/Lake.png', multi: 'assets/Lake_Multi.png', min: 3, max: 13 },
  { name: 'Wooded Kingdom', img: 'assets/Wooded.png', multi: 'assets/Wooded_Multi.png', min: 11, max: 21 },
  { name: 'Lost Kingdom', img: 'assets/Lost.png', multi: 'assets/Lost_Multi.png', min: 5, max: 15, hideMulti: true  },
  { name: 'Metro Kingdom', img: 'assets/Metro.png', multi: 'assets/Metro_Multi.png', min: 15, max: 25 },
  { name: 'Snow Kingdom', img: 'assets/Snow.png', multi: 'assets/Snow_Multi.png', min: 5, max: 15 },
  { name: 'Seaside Kingdom', img: 'assets/Seaside.png', multi: 'assets/Seaside_Multi.png', min: 5, max: 15 },
  { name: 'Luncheon Kingdom', img: 'assets/Luncheon.png', multi: 'assets/Luncheon_Multi.png', min: 13, max: 23 },
  { name: 'Ruined Kingdom', img: 'assets/Ruin.png', multi: 'assets/Ruined_Multi.png', min: 1, max: 8 },
  { name: 'Bowser Kingdom', img: 'assets/Bowser.png', multi: 'assets/Bowser_Multi.png', min: 3, max: 13 },
  // Optional kingdoms: hidden unless their settingKey is turned on in Settings → Kingdoms.
  // They live at the END of this array so the core kingdoms keep their saved
  // moon-index positions; DEFAULT_DISPLAY_ORDER decides where they actually show
  // on screen (Cap is forced to the top, above Cascade; Moon stays at the bottom).
  // To add another one later: give it a settingKey here, add a matching entry to
  // DEFAULT_SETTINGS (default false) and TOGGLE_SETTINGS, then copy a settings-row
  // in index.html's "Kingdoms" section using the same id. `hideMulti: true` hides
  // the multi-moon (+3) button for that kingdom while keeping its slot for alignment.
  { name: 'Moon Kingdom', img: 'assets/MoonK.png', multi: 'assets/MoonK_Multi.png', min: 2, max: 12, settingKey: 'show_kingdom_moon', hideMulti: true },
  { name: 'Cap Kingdom', img: 'assets/Cap.png', multi: 'assets/Cascade_Multi.png', min: 6, max: 16, settingKey: 'show_kingdom_cap', hideMulti: true },
];

// On-screen order for the moon rows (tracker + OBS). Cap Kingdom is stored last
// in KINGDOMS to keep saved moon indices stable, but should display first (above
// Cascade); every other kingdom follows in array order, so Moon stays at the
// bottom. This is only the DEFAULT - a user's drag-to-reorder (kingdom_order)
// still takes precedence. obs.html keeps an identical DEFAULT_DISPLAY_ORDER.
const DEFAULT_DISPLAY_ORDER = (() => {
  const capIdx = KINGDOMS.findIndex(k => k.name === 'Cap Kingdom');
  const rest = KINGDOMS.map((_, i) => i).filter(i => i !== capIdx);
  return capIdx === -1 ? rest : [capIdx, ...rest];
})();

// ── Live auto-tracking progress decode order ────────────────────────────
// TrackerBridge.cpp (the mod) sends moons/captures/abilities as compact
// positional strings, not keyed objects - decoding them means knowing the
// exact order the mod encoded them in. Moons need no separate table here:
// the mod's kProgressWorldIds order already matches KINGDOMS' own order
// above (Cascade..Bowser, then Moon, then Cap) index-for-index.
//
// CAPTURE_ORDER mirrors CaptureRando.cpp's sCaptures[] table order exactly
// (52 entries - the mod iterates getCapture(0..51) and appends one '1'/'0'
// bit per index). ABILITY_ORDER mirrors AbilityRando.h's AbilityId enum
// declaration order, skipping AbilityId_CapReturnJump (the one ability with
// no entry on this tracker's Abilities panel - always granted, nothing to
// track). If either table in the mod ever changes order, this array has to
// be updated to match or the live decode silently mislabels captures.
const CAPTURE_ORDER = [
  'Frog_Capture', 'Spark_pylon_Capture', 'Paragoomba_Capture', 'Chain_Chomp_Capture',
  'Big_Chain_Chomp_Capture', 'Gold_Chain_Chomp_Capture', 'T-Rex_Capture', 'Binoculars_Capture',
  'Bullet_Bill_Capture', 'Moe-Eye_Capture', 'Cactus_Capture', 'Goomba_Capture',
  'Knucklotec_Fist_Capture', 'Rocket_Capture', 'Glydon_Capture', 'Lakitu_Capture',
  'Zipper_Capture', 'Cheep_Cheep_Capture', 'Puzzle_Part_(Lake)_Capture', 'Poison_Piranha_Plant_Capture',
  'Uproot_Capture', 'Fire_Bro_Capture', 'Sherm_Capture', 'Coin_Coffer_Capture',
  'Tree_Capture', 'Rock_Capture', 'Picture_Match_Part_(Goomba)_Capture', 'Tropical_Wiggler_Capture',
  'Pole_Capture', 'Manhole_Capture', 'Taxi_Capture', 'RC_Car_Capture',
  'Ty-foo_Capture', 'Shiverian_Racer_Capture', 'Cheep_Cheep_(Snow)_Capture', 'Gushen_Capture',
  'Lava_Bubble_Capture', 'Volbonan_Capture', 'Hammer_Bro_Capture', 'Meat_Capture',
  'Fire_Piranha_Plant_Capture', 'Pokio_Capture', 'Jizo_Capture', 'Bowser_Statue_Capture',
  'Parabones_Capture', 'Banzai_Bill_Capture', 'Chargin_Chuck_Capture', 'Bowser_Capture',
  'Letter_Capture', 'Puzzle_Part_(Metro)_Capture', 'Picture_Match_Part_(Mario)_Capture', 'Yoshi_Capture',
];

const ABILITY_ORDER = [
  'Jump', 'Double_Jump', 'Triple_Jump', 'Backflip', 'Long_Jump', 'Vault', 'Side_Flip',
  'Ground_Pound_Jump', 'Roll', 'Roll_Boost', 'Crouch', 'Ground_Pound', 'Dive', 'Spin',
  'Wall_Jump', 'Ledge_Grab', 'Climb', 'Swing', 'Neutral_Throw', 'Up_Throw', 'Down_Throw',
  'Spin_Throw',
];

// Applies a live progress snapshot from the mod (see firebase-progress-sync.js)
// straight into tracker state, the same way a manual click would, then
// refreshes every affected UI surface and persists/broadcasts like any other
// change. A malformed or truncated string (partial write mid-transmission,
// unexpected length) just clamps to whatever prefix decodes cleanly rather
// than throwing - the next snapshot corrects it.
function applyProgressSnapshot(data) {
  if (!data) return;
  // Temporary diagnostic, pairs with firebase-progress-sync.js's own log -
  // that one shows what Firestore has, this one shows what actually got
  // decoded/applied into tracker state from it. Decoded to readable names
  // rather than raw bit strings - a 52-character string is nearly
  // impossible to verify correctly by eye off a screenshot.
  if (typeof data.captures === 'string') {
    console.log('[tracker-progress] captures unlocked:',
      CAPTURE_ORDER.filter((key, i) => data.captures[i] === '1'));
  }
  if (typeof data.abilities === 'string') {
    console.log('[tracker-progress] abilities unlocked:',
      ABILITY_ORDER.filter((key, i) => data.abilities[i] === '1'));
  }
  console.log('[tracker-progress] applying', data);
  if (typeof data.moons === 'string') {
    const counts = data.moons.split(',').map(Number);
    for (let i = 0; i < counts.length && i < state.moons.length; i++) {
      if (!isNaN(counts[i])) state.moons[i].count = counts[i];
    }
  }
  if (typeof data.moonReqs === 'string') {
    // -1 means "not visited yet" (the mod withholds the real value until
    // then, same spoiler-prevention rule the in-game HUD overlay uses) -
    // leave whatever's already there (a manual entry, or still "?") alone
    // rather than overwriting it with a value the player hasn't earned.
    const reqs = data.moonReqs.split(',').map(Number);
    for (let i = 0; i < reqs.length && i < state.moons.length; i++) {
      if (!isNaN(reqs[i]) && reqs[i] >= 0) state.moons[i].max = reqs[i];
    }
  }
  if (typeof data.kingdomStatus === 'string') {
    // One digit per kingdom, bits 4/2/1 = unlocked/peace/moon-rock (see
    // TrackerBridge.cpp's checkAndSendProgress()). state.moons[i].lock is
    // named for the toggle button, not its boolean sense - true there means
    // *unlocked* (see toggleLock()), matching bit 4 directly with no
    // inversion needed.
    const statuses = data.kingdomStatus.split(',').map(Number);
    for (let i = 0; i < statuses.length && i < state.moons.length; i++) {
      const s = statuses[i];
      if (isNaN(s)) continue;
      state.moons[i].lock = (s & 4) !== 0;
      state.moons[i].peace = (s & 2) !== 0;
      state.moons[i].rock = (s & 1) !== 0;
    }
  }
  if (window.APC && typeof data.captures === 'string') {
    for (let i = 0; i < CAPTURE_ORDER.length && i < data.captures.length; i++) {
      APC.setUnlocked(state, 'captures', CAPTURE_ORDER[i], data.captures[i] === '1');
    }
  }
  if (window.APC && typeof data.abilities === 'string') {
    for (let i = 0; i < ABILITY_ORDER.length && i < data.abilities.length; i++) {
      APC.setUnlocked(state, 'abilities', ABILITY_ORDER[i], data.abilities[i] === '1');
    }
  }
  refreshAll();
  // adoptPanelOwnedState() (called from inside saveState()) normally pulls
  // state.apc.captures/abilities back from whatever's currently in
  // localStorage before every save, so this window's saveState() calls for
  // unrelated reasons (a moon count changing, say) can't stomp an edit the
  // Abilities & Captures panel just made that hasn't round-tripped back into
  // this window's own `state` yet. It has no way to tell that apart from
  // "this window's in-memory state is actually the newer one" - which is
  // exactly the case here, straight off a live snapshot from the mod - so
  // without this, every capture/ability just set above gets silently
  // reverted to its previous value right before the write that was supposed
  // to persist it (confirmed via the panel's own diagnostics: applied here,
  // but never landed in localStorage). authoritativeWrite is the existing
  // escape hatch for "this write should win" - see resetAll() for the same
  // pattern.
  authoritativeWrite = true;
  saveState();
  authoritativeWrite = false;
}

const CAPTURE_ICONS = [
  { key: 'parabones', locked: 'assets/Parabones_Capture_Locked.png', unlocked: 'assets/Parabones_Capture.png' },
  { key: 'banzai', locked: 'assets/Banzai_Bill_Capture_Locked.png', unlocked: 'assets/Banzai_Bill_Capture.png' },
  { key: 'wire', locked: 'assets/Spark_pylon_Capture_Locked.png', unlocked: 'assets/Spark_pylon_Capture.png' },
  { key: 'golden', locked: 'assets/golden_locked.png', unlocked: 'assets/golden.png' },
];

const ABILITY_ICONS = [
  { key: 'jump', locked: 'assets/Long_Jump_Locked.png', unlocked: 'assets/Long_Jump.png' },
  { key: 'cap', locked: 'assets/Cappy_Locked.png', unlocked: 'assets/Cappy.png' },
  { key: 'wall', locked: 'assets/Wall_Jump_Locked.png', unlocked: 'assets/Wall_Jump.png' },
];

// Bowser lives on the ability side of the main tracker (bottom-left of the 2x2),
// but it is still a *capture* as far as saved state goes: its toggle owns
// state.captures.bowser, so the APC panel's Bowser_Capture link and the
// standalone Bowser icon on the OBS overlay keep working unchanged. It is drawn
// with the ability styling so it participates in the ability grid + Ability Lock
// hide behavior.
const BOWSER_ABILITY_ICON = { key: 'bowser', locked: 'assets/Bowser_Capture_Locked.png', unlocked: 'assets/Bowser_Capture.png' };

const PICKER_ICONS = [
  'Cascade.png', 'Sand.png', 'Lake.png', 'Wooded.png', 'Lost.png', 'Metro.png',
  'Snow.png', 'Seaside.png', 'Luncheon.png', 'Ruin.png', 'Bowser.png',
  'Cap.png', 'Dark.png', 'Star.png','Cloud.png','MoonK.png', "Moon.png", "Moon_Dark.png", "checkmark.png", "xmark.png",
];

const DEFAULT_SETTINGS = {
  show_moon_total: true,
  show_tracker_moon_total: false, // On-tracker "counted / requirement : left" box (default off)
  zone_names: {},                 // { [kingdom]: { [defaultZoneKey]: 'Custom Name' } } overrides
  moon_requirement: 124,
  show_icon_colors: true,
  show_ability_lock: true,
  show_captures: true,
  show_save_buttons: false,
  show_multi_moon: true,
  show_moon_range: true,
  show_complete_color: false,
  show_kingdom_moon: false,
  show_kingdom_cap: false,     // Optional Cap Kingdom row (tracker + overlay)
  show_lock: true,             // Lock sign column visible (tracker + overlay)
  show_peace: true,            // Peace sign column visible (tracker + overlay)
  show_rock: false,            // Moon Rock sign column visible (tracker + overlay)
  show_ability_jump: false,    // false = Jump icon hidden (default). true = shown
  show_ability_cap: false,     // false = Cap Bounce icon hidden (default). true = shown
  show_moon_obs: true,         // Draw Moon Kingdom on the OBS overlay; only takes
                               // effect while show_kingdom_moon is also on
  show_cap_obs: true,          // Draw Cap Kingdom on the OBS overlay; only takes
                               // effect while show_kingdom_cap is also on
  show_moon_updater: false,    // Moon Updater message strip on the OBS overlay
  updater_location: 'top',     // 'top' | 'bottom' relative to the overlay body
  updater_count: 3,            // Visible messages (1-5); drives overlay height
  overlay_scale: 1, // Popup Scale default; Browser Source Scale is always 3x this (see getBrowserSourceScale)
  notes_scroll_px: 500,
  scroll_left_binding: { type: 'mouse', code: 3 },  // MB4 (back)
  scroll_right_binding: { type: 'mouse', code: 4 },  // MB5 (forward)
  show_notes_panel: false,     // Side panel embedding notes.html beside the tracker.
                                // Mutually exclusive with show_map_panel (see applySidePanel).
  show_map_panel: false,       // Side panel embedding map.html beside the tracker.
                                // Mutually exclusive with show_notes_panel (see applySidePanel).
  panel_location: 'horizontal', // 'horizontal' | 'vertical' - beside vs below the tracker

  // Which side panel is showing. Only one at a time, so it's a single value
  // rather than one boolean per panel: 'none' | 'notes' | 'map' | 'apc'.
  // show_notes_panel / show_map_panel above are kept in sync with this purely
  // so older saves (and anything else reading them) still work - panel_mode is
  // the one that decides. See applySidePanel().
  panel_mode: 'none',

  // ── Abilities & Captures panel (apc.html) view options ──────────
  apc_sort: 'locked',          // 'locked' | 'unlocked' | 'game' | 'az'
  apc_size: 'medium',          // icon size: 'small' | 'medium' | 'large'
  apc_hide_unlocked: false,    // hide entries you've already got
  apc_hide_labels: false,      // hide the text labels (icons get bigger)

  // ── Kingdom hotkeys ─────────────────────────────────────────────
  // Off by default. Key = add a moon, Shift + key = remove one, Ctrl + key =
  // multi moon (+3). Values are KeyboardEvent.code strings, keyed by the
  // KINGDOMS entry name. Using .code means Shift + "Equal" is still "Equal",
  // so the Moon Kingdom binding doesn't fight the remove-a-moon modifier.
  hotkeys_enabled: false,
  hotkeys: null,               // null = use HOTKEY_DEFAULTS

  // Loading Zone Notes layout (shared by the modal and the popped-out notes.html)
  notes_layout: 'horizontal',  // 'horizontal' = column-wrap masonry (horizontal scroll)
                               // 'vertical'   = multi-column pack (vertical scroll)
  notes_columns: 2,            // kingdoms side-by-side in vertical mode (1 | 2 | 3)
  notes_compact: false,        // tighter spacing + shorter note boxes
  show_painting_notes: false,  // Paintings notes column (before Cascade); default off
  kingdom_order: null,         // custom moon-row display order (array of KINGDOMS indices) or null
};

function cloneDefaultSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

const LOADING_ZONES_TEMPLATE = {
  'Cap': { color: '#fff500', icon: 'Cap.png', zones: { 'Orange': { num: 2 }, 'Paragoomba': { num: 2 }, 'Frog': { num: 2 }, 'Rolling On': { num: 2 } } },
  'Cascade': { color: '#ff9900', icon: 'Cascade.png', zones: { 'Dino': { num: 2 }, '2D': { num: 2 }, 'Chain Chomp': { num: 2 }, 'Swings': { num: 2 }, 'Windy': { num: 2 } } },
  'Sand': { color: '#8bf12c', icon: 'Sand.png', zones: { "Icy Cave": { num: 1 }, "Moe-eye": { num: 2 }, "Shop": { num: 1 }, "Employees": { num: 1 }, "Slots": { num: 1 }, "Rumble": { num: 1 }, "Outfit": { num: 1 }, "Jaxi Ruins": { num: 2 }, "Bullet Bill": { num: 2 }, "Gushen": { num: 2 }, "Sphynx": { num: 1 }, "Moving Platform": { num: 2 }, "Rocket": { num: 2 }, "Colossal Ruins": { num: 2 } } },
  'Lake': { color: '#e46cab', icon: 'Lake.png', zones: { "Poison Waves": { num: 2 }, "Zipper": { num: 2 }, "Grab Climb": { num: 2 }, "Shop": { num: 1 }, "Puzzle": { num: 1 } } },
  'Wooded': { color: '#1e65e7', icon: 'Wooded.png', zones: { "DW Odyssey": { num: 0 }, "DW Red Maze": { num: 0 }, "DW Pond": { num: 0 }, "DW Treasure": { num: 1 }, "DW Outfit": { num: 1 }, "Rocket": { num: 2 }, "Sheep": { num: 2 }, "Tank": { num: 2 }, "Vine Clouds": { num: 2 }, "Breakdown": { num: 2 }, "Invisible": { num: 2 }, "Flooded Pipes": { num: 2 }, "Flower Road": { num: 2 }, "Treasure Room": { num: 1 } } },
  'Lost': { color: '#e71edd', icon: 'Lost.png', zones: { 'Wiggler': { num: 2 }, 'Shop': { num: 1 }, 'Klepto': { num: 2 } } },
  'Metro': { color: '#de7d5e', icon: 'Metro.png', zones: { "Yellow Shop": { num: 1 }, "Purple Shop": { num: 1 }, "Dino": { num: 2 }, "Bullet Billding": { num: 2 }, "Taxi": { num: 2 }, "Notes": { num: 1 }, "2D": { num: 2 }, "Slots": { num: 1 }, "People": { num: 2 }, "Outfit": { num: 2 }, "Rocket": { num: 2 }, "Dark": { num: 2 }, "Scaffolding": { num: 2 }, "Scooter": { num: 2 }, "Rotating Maze": { num: 2 }, "RC Car": { num: 2 } } },
  'Snow': { color: '#e7930a', icon: 'Snow.png', zones: { "Puzzle": { num: 1 }, "Capless": { num: 2 }, "Rocket Flower": { num: 2 }, "Iceburn Circuit": { num: 2 }, "Flower Road": { num: 2 }, "Tracewalking": { num: 1 }, "Clouds": { num: 2 }, "Outfit": { num: 2 }, "Shop": { num: 1 } } },
  'Seaside': { color: '#b36fe9', icon: 'Seaside.png', zones: { "Well Enter": { num: 1 }, "Well Exit": { num: 1 }, "Rumble": { num: 1 }, "Rocket": { num: 2 }, "Outfit": { num: 1 }, "Gushen": { num: 2 }, "Sphynx": { num: 1 }, "Pokio": { num: 2 }, "Lava Rising": { num: 2 }, "Sandy Bottom": { num: 1 }, "Spinning Maze": { num: 2 } } },
  'Luncheon': { color: '#3fddbb', icon: 'Luncheon.png', zones: { "Magma Swamp": { num: 2 }, "Forks": { num: 2 }, "Cheese Rocks": { num: 2 }, "Veggie Room": { num: 1 }, "Slots": { num: 1 }, "Shop": { num: 1 }, "Outfit": { num: 2 }, "Spinning Athletics": { num: 2 }, "Lava Islands": { num: 2 }, "Volcano Cave": { num: 2 }, "Gears": { num: 2 }, "Magma Path": { num: 2 } } },
  'Ruined': { color: '#ffd7e2', icon: 'Ruin.png', zones: { "Chargin' Chuck": { num: 2 }, 'Rocket': { num: 2 } } },
  "Bowser's": { color: '#d3304c', icon: 'Bowser.png', zones: { "Jizo": { num: 2 }, "Shop": { num: 1 }, "Outfit": { num: 2 }, "Treasure Room": { num: 1 }, "Spinning Tower": { num: 2 }, "Vine Clouds": { num: 2 }, "Hexagon Tower": { num: 2 }, "Wooden Tower": { num: 2 } } },
  'Mushroom': { color: '#fff672', icon: 'Star.png', zones: { "Shop": { num: 1 }, "Castle Door": { num: 2 }, "Outfit": { num: 2 }, "Cloud Sea": { num: 2 }, "Well": { num: 2 }, "Knucklotec": { num: 1 }, "Torkdrift": { num: 1 }, "Mechawiggler": { num: 1 }, "Octopus": { num: 1 }, "Cookatiel": { num: 1 }, "Dragon": { num: 1 }, "Rocket": { num: 2 } } },
  'Darkside': { color: '#fff2c6', icon: 'Dark.png', zones: { 'Breakdown': { num: 2 }, 'Invisible': { num: 2 }, 'Vanishing': { num: 2 }, 'Yoshi Siege': { num: 2 }, 'Lava Rising': { num: 2 }, 'Magma Swamp': { num: 2 } } },
  'Darkerside': { color: '#fff2c6', icon: 'Dark.png', zones: { 'End': { num: 1 } } },
  'Moon':       { color:'#b5c1cb', icon:'MoonK.png',    zones:{ '2D Snowman': {num:2},'Shop': {num:1},'Swings': {num:2},'Sphynx': {num:1}} },
  'Cloud':      { color:'#65ceff', icon:'Cloud.png',    zones:{ '2D Cube': {num:2},'Picture Match': {num:2} } },
};

// Number of zones above which a kingdom column auto-splits into two side-by-side columns
const ZONE_SPLIT_THRESHOLD = 10;

const MOBILE_BREAKPOINT = 540;

// ── Kingdom hotkeys ───────────────────────────────────────────────
// Keyed by KINGDOMS[].name, valued with a KeyboardEvent.code. "Minus" and
// "Equal" are the physical -/_ and =/+ keys, which is why Moon Kingdom's
// default reads as "+": you press Shift for it in normal typing, but .code
// ignores Shift so the modifier stays free for remove-a-moon.
const HOTKEY_DEFAULTS = {
  'Cascade Kingdom':  'Digit1',
  'Sand Kingdom':     'Digit2',
  'Lake Kingdom':     'Digit3',
  'Wooded Kingdom':   'Digit4',
  'Lost Kingdom':     'Digit5',
  'Metro Kingdom':    'Digit6',
  'Snow Kingdom':     'Digit7',
  'Seaside Kingdom':  'Digit8',
  'Luncheon Kingdom': 'Digit9',
  'Ruined Kingdom':   'Digit0',
  'Bowser Kingdom':   'Minus',
  'Moon Kingdom':     'Equal',
  'Cap Kingdom':      'Backquote',
};

// Returns the live binding map, filling in any kingdom the user hasn't rebound.
function getHotkeys() {
  const saved = state.settings.hotkeys || {};
  const out = {};
  for (const k of Object.keys(HOTKEY_DEFAULTS)) {
    // An empty string is a real value here: it means the binding was taken
    // over by another kingdom, so this one is deliberately unset.
    out[k] = (typeof saved[k] === 'string') ? saved[k] : HOTKEY_DEFAULTS[k];
  }
  return out;
}

// Horizontal needs room beside the tracker, so it's unavailable below the
// mobile breakpoint. Vertical stacks below instead and stays available at
// any width. Shared by applySidePanel() and the Notes/Map button fallbacks.
function isPanelLocationAvailable() {
  const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
  const location = state.settings.panel_location === 'vertical' ? 'vertical' : 'horizontal';
  return location === 'vertical' || !isMobile;
}

// ── Per-kingdom min/max scaling ───────────────────────────────────
// Each kingdom has a "normal" moon count C. When the Total Moon Requirement N
// changes, every normal scales by N/124 and its displayed range becomes
// normal ± 5 (min clamped to >= 1). The scaled normals are rounded with the
// largest-remainder method.
//
// Every kingdom now participates, Cap and Moon included. SCALE_DEFAULT_TOTAL
// stays 124, so at the default requirement each kingdom shows its own base
// min/max (Cap 6/16, Moon 2/12, and the core kingdoms unchanged from before);
// they only rescale once the requirement is changed. The base counts now sum to
// more than 124, so the scaled values no longer sum exactly to N and the
// "counted / left" accounting can be slightly off - an accepted trade-off for
// keeping the per-kingdom ranges pinned to their known values.
const SCALE_KINGDOM_COUNT = KINGDOMS.length;
const SCALE_DEFAULT_TOTAL = 124;
const SCALE_RANGE = 5;
// C for each kingdom, derived from its default max (max = C + range).
const SCALE_BASE = KINGDOMS.slice(0, SCALE_KINGDOM_COUNT).map(k => k.max - SCALE_RANGE);

function computeScaledRanges(N) {
  N = N || SCALE_DEFAULT_TOTAL;
  const raw = SCALE_BASE.map(c => c * N / SCALE_DEFAULT_TOTAL);
  const normal = raw.map(Math.floor);
  const rem = N - normal.reduce((a, b) => a + b, 0); // leftover to hand out (0..10)
  raw.map((v, i) => ({ i, frac: v - Math.floor(v) }))
     .sort((a, b) => b.frac - a.frac)
     .forEach((o, k) => { if (k < rem) normal[o.i]++; });
  return normal.map(n => ({
    normal: n,
    min: Math.max(1, n - SCALE_RANGE),
    max: n + SCALE_RANGE,
  }));
}

// Cached so the ranges are only recomputed when N actually changes.
let _rangeCache = { N: null, ranges: null };
function getScaledRanges() {
  const N = (state.settings && state.settings.moon_requirement) || SCALE_DEFAULT_TOTAL;
  if (_rangeCache.N !== N) _rangeCache = { N, ranges: computeScaledRanges(N) };
  return _rangeCache.ranges;
}
function rangeFor(i) {
  if (i < SCALE_KINGDOM_COUNT) return getScaledRanges()[i];
  return { normal: KINGDOMS[i].max, min: KINGDOMS[i].min, max: KINGDOMS[i].max };
}

// ── Human-readable labels for mouse/keyboard scroll bindings ──────
function bindingLabel(binding) {
  if (!binding) return 'Not Set';
  if (binding.type === 'mouse') {
    const names = { 0: 'Left Click', 1: 'Middle Click', 2: 'Right Click', 3: 'Mouse 4', 4: 'Mouse 5' };
    return names[binding.code] !== undefined ? names[binding.code] : `Mouse ${binding.code + 1}`;
  }
  if (binding.type === 'key') {
    const map = {
      ArrowLeft: 'Left Arrow', ArrowRight: 'Right Arrow',
      ArrowUp: 'Up Arrow', ArrowDown: 'Down Arrow',
      Space: 'Space', Enter: 'Enter', Tab: 'Tab',
    };
    if (map[binding.code]) return map[binding.code];
    if (binding.code.startsWith('Key')) return binding.code.slice(3);
    if (binding.code.startsWith('Digit')) return binding.code.slice(5);
    return binding.code;
  }
  return 'Unknown';
}

// Same idea as bindingLabel, but for the bare KeyboardEvent.code strings the
// kingdom hotkeys use (no {type, code} wrapper).
function keyCodeLabel(code) {
  if (!code) return 'Not Set';
  const map = {
    Minus: '-', Equal: '+', Backquote: '`', Backslash: '\\',
    BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'",
    Comma: ',', Period: '.', Slash: '/',
    Space: 'Space', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace',
    ArrowLeft: 'Left Arrow', ArrowRight: 'Right Arrow',
    ArrowUp: 'Up Arrow', ArrowDown: 'Down Arrow',
    NumpadAdd: 'Numpad +', NumpadSubtract: 'Numpad -',
    NumpadMultiply: 'Numpad *', NumpadDivide: 'Numpad /',
    NumpadDecimal: 'Numpad .', NumpadEnter: 'Numpad Enter',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Numpad')) return `Numpad ${code.slice(6)}`;
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Key')) return code.slice(3);
  return code;
}

// Settings toggle definitions for data-driven wiring
const TOGGLE_SETTINGS = [
  { id: 'toggle-moon-total', key: 'show_moon_total' },
  { id: 'toggle-tracker-moon-count', key: 'show_tracker_moon_total' },
  { id: 'toggle-icon-colors', key: 'show_icon_colors' },
  { id: 'toggle-lock', key: 'show_lock' },
  { id: 'toggle-peace', key: 'show_peace' },
  { id: 'toggle-rock', key: 'show_rock' },
  { id: 'toggle-ability-lock', key: 'show_ability_lock' },
  { id: 'toggle-ability-jump', key: 'show_ability_jump' },
  { id: 'toggle-ability-cap', key: 'show_ability_cap' },
  { id: 'toggle-captures', key: 'show_captures' },
  { id: 'toggle-save-buttons', key: 'show_save_buttons' },
  { id: 'toggle-complete-color', key: 'show_complete_color' },
  { id: 'toggle-multi-moon', key: 'show_multi_moon' },
  { id: 'toggle-moon-range', key: 'show_moon_range' },
  { id: 'toggle-kingdom-moon', key: 'show_kingdom_moon' },
  { id: 'toggle-moon-obs', key: 'show_moon_obs' },
  { id: 'toggle-kingdom-cap', key: 'show_kingdom_cap' },
  { id: 'toggle-cap-obs', key: 'show_cap_obs' },
  { id: 'toggle-moon-updater', key: 'show_moon_updater' },
  { id: 'toggle-painting-notes', key: 'show_painting_notes' },
];

// Maps a LOADING_ZONES_TEMPLATE kingdom name to the settings key that controls
// whether it's shown (in the Notes columns and, if applicable, as a moon-count
// row). A kingdom not listed here is always shown. To make another kingdom
// toggleable later: add it here, add a DEFAULT_SETTINGS entry (default false),
// add it to TOGGLE_SETTINGS, and add a settings-row toggle in index.html's
// "Kingdoms" section (copy the Moon Kingdom row and swap the id/label).
const KINGDOM_VISIBILITY_SETTINGS = {
  Moon: 'show_kingdom_moon',
};

// Settings keys that control whether a whole kingdom ROW appears on the main
// tracker (driven by KINGDOMS[].settingKey). Toggling one of these has to
// rebuild the moon rows, not just flip a CSS class. Built from KINGDOMS so any
// future optional kingdom is covered automatically.
const KINGDOM_ROW_SETTING_KEYS = new Set(
  KINGDOMS.map(k => k.settingKey).filter(Boolean)
);

// ── Painting tracker (Notes) ────────────────────────────────────────────────
// A single "Paintings" notes column placed before Cascade. Each kingdom below
// gets its own note box and no moon icons. Toggled from Settings → Notes.
const PAINTINGS_NOTES_KEY = 'Paintings';
const PAINTING_NOTE_KINGDOMS = ['Cascade','Sand','Lake','Wooded','Metro','Snow','Seaside','Luncheon',"Bowser's",'Mushroom'];

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────
let state = {};

function buildDefaultLoadingZones() {
  const result = {};
  for (const [kingdom, data] of Object.entries(LOADING_ZONES_TEMPLATE)) {
    result[kingdom] = { color: data.color, icon: data.icon, zones: {} };
    for (const [zone, zd] of Object.entries(data.zones)) {
      result[kingdom].zones[zone] = { note: '', icon: 'Moon.png', icon2: 'Moon.png', collapsed: false, num: zd.num };
    }
  }
  return result;
}

function getDefaultState() {
  return {
    settings: cloneDefaultSettings(),
    moons: KINGDOMS.map(() => ({ count: 0, max: null, lock: false, peace: false, rock:false, multi: false })),
    captures: { parabones: false, banzai: false, wire: false, bowser: false, golden: false },
    abilities: { jump: false, cap: false, wall: false },
    // Full Abilities & Captures panel (apc.html). The seven entries that also
    // appear on the main tracker are mirrored here but owned by the two objects
    // above - see apc-data.js.
    apc: { captures: {}, abilities: {} },
    loading_zones: buildDefaultLoadingZones(),
    // Painting tracker notes (one free-text box per kingdom, no moons)
    painting_notes: Object.fromEntries(PAINTING_NOTE_KINGDOMS.map(k => [k, ''])),
    kingdom_collapsed: Object.fromEntries(
      [...Object.keys(LOADING_ZONES_TEMPLATE), PAINTINGS_NOTES_KEY].map(k => [k, false])),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) { state = getDefaultState(); return; }

    const saved = JSON.parse(raw);
    state = getDefaultState();

    // Settings merge saved over defaults
    if (saved.settings) {
      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (key in saved.settings) state.settings[key] = saved.settings[key];
      }
    }
    // Moons
    if (Array.isArray(saved.moons)) {
      saved.moons.forEach((m, i) => {
        if (state.moons[i]) Object.assign(state.moons[i], m);
      });
    }
    // Captures / abilities
    if (saved.captures) Object.assign(state.captures, saved.captures);
    if (saved.abilities) Object.assign(state.abilities, saved.abilities);
    if (saved.apc) {
      if (saved.apc.captures) Object.assign(state.apc.captures, saved.apc.captures);
      if (saved.apc.abilities) Object.assign(state.apc.abilities, saved.apc.abilities);
    }

    // Saves made before the side panel became a single mode still carry the two
    // old booleans. Fold them into panel_mode once, then let panel_mode lead.
    if (!(saved.settings && 'panel_mode' in saved.settings)) {
      const old = saved.settings || {};
      state.settings.panel_mode = old.show_notes_panel ? 'notes'
                                : old.show_map_panel ? 'map'
                                : 'none';
    }
    syncLegacyPanelFlags();

    // Loading zones merge saved per-zone data, keep template structure for new zones
    if (saved.loading_zones) {
      for (const [kingdom, data] of Object.entries(state.loading_zones)) {
        if (!saved.loading_zones[kingdom]) continue;
        const savedKingdom = saved.loading_zones[kingdom];
        for (const zone of Object.keys(data.zones)) {
          if (savedKingdom.zones && savedKingdom.zones[zone]) {
            Object.assign(state.loading_zones[kingdom].zones[zone], savedKingdom.zones[zone]);
          }
        }
      }
    }
    // Per-kingdom collapsed state (Notes window)
    if (saved.kingdom_collapsed) {
      for (const k of Object.keys(state.kingdom_collapsed)) {
        if (k in saved.kingdom_collapsed) state.kingdom_collapsed[k] = saved.kingdom_collapsed[k];
      }
    }
    // Painting tracker notes
    if (saved.painting_notes) {
      for (const k of Object.keys(state.painting_notes)) {
        if (k in saved.painting_notes) state.painting_notes[k] = saved.painting_notes[k];
      }
    }
  } catch (e) {
    console.error('Failed to load state:', e);
    state = getDefaultState();
  }
}

// Set while the tracker is deliberately overwriting the panel's data (Clear
// All, loading a save file, a remote sync payload). Outside those cases the
// panel owns its entries and adoptPanelOwnedState() protects them.
let authoritativeWrite = false;

// The panel is the only thing that ever changes an unlinked capture/ability or
// the panel's own view options. If the tracker's in-memory copy has fallen
// behind - it can, if a cross-window message got dropped - writing it out would
// wipe whatever the panel just recorded. So re-read those specific fields
// straight from localStorage immediately before every write and keep them.
function adoptPanelOwnedState() {
  if (authoritativeWrite || !window.APC) return;
  let saved;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return;
    saved = JSON.parse(raw);
  } catch (e) {
    return;
  }
  APC.ensure(state);

  ['captures', 'abilities'].forEach(kind => {
    const stored = saved.apc && saved.apc[kind];
    if (!stored) return;
    for (const [key, value] of Object.entries(stored)) {
      // Linked entries are owned by the tracker's own icon row, so the value
      // in memory here is the newer one - leave those alone.
      if (APC.linkedTrackerKey(kind, key)) continue;
      state.apc[kind][key] = value;
    }
  });

  if (saved.settings) {
    ['apc_sort', 'apc_size', 'apc_hide_unlocked', 'apc_hide_labels'].forEach(k => {
      if (k in saved.settings) state.settings[k] = saved.settings[k];
    });
  }
}

function saveState() {
  adoptPanelOwnedState();
  mirrorLinkedToApc();
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
  if (!applyingRemote && window.SMOSync && window.SMOSync.getRoom()) {
    window.SMOSync.broadcast(state);
  }
  notifyApcIfChanged();
}

// ── Abilities & Captures link ─────────────────────────────────────
// The 4 captures and 3 abilities on the main tracker are the same things as 4
// and 3 of the entries in the Abilities & Captures panel. state.captures /
// state.abilities stay the owners (that's what OBS reads); this copies them
// into state.apc so the panel, and a downloaded save, always agree.
function mirrorLinkedToApc() {
  if (!window.APC) return;
  APC.ensure(state);
  for (const [trackerKey, panelKey] of Object.entries(APC.CAPTURE_LINKS)) {
    state.apc.captures[panelKey] = !!state.captures[trackerKey];
  }
  for (const [trackerKey, panelKey] of Object.entries(APC.ABILITY_LINKS)) {
    state.apc.abilities[panelKey] = !!state.abilities[trackerKey];
  }
}

// Cross-window channel to apc.html (side-panel iframe or popped-out window).
let apcChannel = null;
let apcLastSignature = null;
let applyingApc = false;
// Set while an authoritative wipe (Clear) is being written, so the generic
// "apc-changed" ping is held back and a single explicit "apc-reset" is sent
// instead - see resetAll(). Prevents the panel from re-asserting a just-cleared
// entry during its edit-grace window.
let suppressApcNotify = false;

function apcSignature() {
  if (!window.APC) return '';
  return JSON.stringify([state.captures, state.abilities, state.apc]);
}

// Only ping the panel when something it actually displays has changed, so
// hammering the moon hotkeys doesn't force it to redraw on every keypress.
function notifyApcIfChanged() {
  const sig = apcSignature();
  if (sig === apcLastSignature) return;
  apcLastSignature = sig;
  if (suppressApcNotify) return; // an explicit apc-reset is sent instead
  if (apcChannel && !applyingApc) apcChannel.post({ type: 'apc-changed' });
}

// A toggle in the panel writes straight to localStorage, so pull those slices
// back in, redraw the tracker's icon rows, and push the result out to OBS.
function onApcChanged() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.captures) Object.assign(state.captures, saved.captures);
    if (saved.abilities) Object.assign(state.abilities, saved.abilities);
    APC.ensure(state);
    if (saved.apc) {
      if (saved.apc.captures) Object.assign(state.apc.captures, saved.apc.captures);
      if (saved.apc.abilities) Object.assign(state.apc.abilities, saved.apc.abilities);
    }
    // The panel also owns its own view options (sort / size / hide unlocked).
    if (saved.settings) {
      ['apc_sort', 'apc_size', 'apc_hide_unlocked', 'apc_hide_labels',
       'notes_layout', 'notes_columns', 'notes_compact'].forEach(k => {
        if (k in saved.settings) state.settings[k] = saved.settings[k];
      });
    }

    // notes.html / the side panel write loading-zone notes + painting notes
    // straight to localStorage, then this same storage event lands here. The
    // saveState() below would otherwise re-write this window's older in-memory
    // copy of those slices and wipe whatever was just typed in the popout or
    // side panel. `saved` still holds that fresh text right now, so pull it in
    // before re-saving. (This is the same merge openLoadingZonesModal() does on
    // open, applied on every panel update so nothing is lost in between.)
    if (saved.loading_zones && state.loading_zones) {
      for (const [kingdom, data] of Object.entries(state.loading_zones)) {
        const savedKingdom = saved.loading_zones[kingdom];
        if (!savedKingdom || !savedKingdom.zones) continue;
        for (const zone of Object.keys(data.zones)) {
          if (savedKingdom.zones[zone]) {
            Object.assign(state.loading_zones[kingdom].zones[zone], savedKingdom.zones[zone]);
          }
        }
      }
    }
    if (saved.kingdom_collapsed && state.kingdom_collapsed) {
      for (const k of Object.keys(state.kingdom_collapsed)) {
        if (k in saved.kingdom_collapsed) state.kingdom_collapsed[k] = saved.kingdom_collapsed[k];
      }
    }
    if (saved.painting_notes) {
      state.painting_notes = state.painting_notes || {};
      for (const k of Object.keys(saved.painting_notes)) {
        state.painting_notes[k] = saved.painting_notes[k];
      }
    }
  } catch (e) {
    console.error('Failed to read Abilities & Captures update:', e);
    return;
  }

  buildCaptureRow();
  buildAbilityRow();
  applyAllSettings();

  // applyingApc stops saveState from echoing this same change back at the
  // panel; the sync-server broadcast still needs to happen so OBS follows.
  applyingApc = true;
  saveState();
  applyingApc = false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Moon Rows Build
// ─────────────────────────────────────────────────────────────────────────────
function buildAllMoonRows() {
  const container = document.getElementById('moon-rows');
  container.innerHTML = '';
  orderedKingdomIndices().forEach(i => {
    const kingdom = KINGDOMS[i];
    if (kingdom.settingKey && !state.settings[kingdom.settingKey]) return;
    const row = buildMoonRow(i);
    wireMoonRowDrag(row, i);
    container.appendChild(row);
  });
}

// Resolve the moon-row display order: start from the saved custom order (valid,
// de-duped indices), then append any kingdoms not listed in their natural order.
function orderedKingdomIndices() {
  const saved = Array.isArray(state.settings.kingdom_order) ? state.settings.kingdom_order : [];
  const seen = new Set();
  const order = [];
  saved.forEach(i => {
    if (Number.isInteger(i) && i >= 0 && i < KINGDOMS.length && !seen.has(i)) { seen.add(i); order.push(i); }
  });
  DEFAULT_DISPLAY_ORDER.forEach(i => { if (!seen.has(i)) order.push(i); });
  return order;
}

// ── Moon-row drag-to-reorder ─────────────────────────────────────────────────
// Rows are picked up from empty space / the edges of the box (not the buttons,
// counters, or input). A gray border hints where the row is draggable. The new
// order is saved into settings.kingdom_order, which also syncs to the OBS popup
// and browser source.
let draggingMoonRow = null;

function isMoonRowInteractive(target) {
  return !!(target && target.closest && target.closest('button, input, textarea, select, img'));
}

function wireMoonRowDrag(row, idx) {
  // Show the "grab" affordance only over non-interactive parts of the row.
  row.addEventListener('mousemove', (e) => {
    if (draggingMoonRow) return;
    row.classList.toggle('drag-ready', !isMoonRowInteractive(e.target));
  });
  row.addEventListener('mouseleave', () => row.classList.remove('drag-ready'));

  row.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || isMoonRowInteractive(e.target)) return;
    e.preventDefault();
    startMoonRowDrag(row, e.clientY);
    const onMove = (ev) => moveMoonRowDrag(row, ev.clientY);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      endMoonRowDrag(row);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Touch: long-press (~350ms) to pick up, so normal scrolling still works.
  let touchHold = null, touchActive = false;
  row.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || isMoonRowInteractive(e.target)) return;
    const y0 = e.touches[0].clientY;
    touchHold = setTimeout(() => {
      touchHold = null; touchActive = true;
      startMoonRowDrag(row, y0);
    }, 350);
  }, { passive: true });
  row.addEventListener('touchmove', (e) => {
    if (touchHold && Math.abs(e.touches[0].clientY - (row.getBoundingClientRect().top)) > 8) {
      // finger moved before hold fired → treat as scroll, cancel pickup
      clearTimeout(touchHold); touchHold = null;
    }
    if (touchActive) { e.preventDefault(); moveMoonRowDrag(row, e.touches[0].clientY); }
  }, { passive: false });
  const touchEnd = () => {
    if (touchHold) { clearTimeout(touchHold); touchHold = null; }
    if (touchActive) { touchActive = false; endMoonRowDrag(row); }
  };
  row.addEventListener('touchend', touchEnd);
  row.addEventListener('touchcancel', touchEnd);
}

function startMoonRowDrag(row, y) {
  draggingMoonRow = row;
  row.classList.add('dragging');
  row.classList.remove('drag-ready');
}

function moveMoonRowDrag(row, y) {
  if (draggingMoonRow !== row) return;
  const container = document.getElementById('moon-rows');
  const others = [...container.querySelectorAll('.moon-row')].filter(r => r !== row);
  let placed = false;
  for (const r of others) {
    const rect = r.getBoundingClientRect();
    if (y < rect.top + rect.height / 2) { container.insertBefore(row, r); placed = true; break; }
  }
  if (!placed) container.appendChild(row);
}

function endMoonRowDrag(row) {
  row.classList.remove('dragging');
  draggingMoonRow = null;
  commitMoonRowOrder();
}

function commitMoonRowOrder() {
  const container = document.getElementById('moon-rows');
  const visible = [...container.querySelectorAll('.moon-row')]
    .map(r => parseInt(r.dataset.idx, 10)).filter(n => !isNaN(n));
  const visibleSet = new Set(visible);
  // Keep any currently-hidden kingdoms (e.g. Moon when off) in the order too,
  // preserving their previous relative position, appended after the visible set.
  const prev = Array.isArray(state.settings.kingdom_order) ? state.settings.kingdom_order : [];
  const hidden = [];
  KINGDOMS.forEach((_, i) => { if (!visibleSet.has(i)) hidden.push(i); });
  hidden.sort((a, b) => {
    const ia = prev.indexOf(a), ib = prev.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  state.settings.kingdom_order = [...visible, ...hidden];
  saveState();
}

function buildMoonRow(i) {
  const kingdom = KINGDOMS[i];
  const row = document.createElement('div');
  row.className = 'moon-row';
  row.dataset.idx = i;

  // Equal-width flexible spacer  used between counter items so min/max land
  // exactly halfway between their neighboring button and the count value.
  function makeCounterSpacer() {
    const sp = document.createElement('span');
    sp.className = 'counter-spacer';
    return sp;
  }

  // ── Left group: lock + peace + kingdom icon ──
  const left = document.createElement('div');
  left.className = 'moon-row-left';

  const lockBtn = document.createElement('button');
  lockBtn.className = 'icon-btn lock-btn';
  lockBtn.title = 'Toggle lock';
  lockBtn.innerHTML = `<img src="assets/lock.png" alt="lock">`;
  lockBtn.addEventListener('click', () => { toggleLock(i); saveState(); });

  const peaceBtn = document.createElement('button');
  peaceBtn.className = 'icon-btn peace-btn';
  peaceBtn.title = 'Toggle peace';
  peaceBtn.innerHTML = `<img src="assets/peace.png" alt="peace">`;
  peaceBtn.addEventListener('click', () => { togglePeace(i); saveState(); });

  const rockBtn = document.createElement('button');
  rockBtn.className = 'icon-btn rock-btn';
  rockBtn.title = 'Toggle Moon Rock';
  rockBtn.innerHTML = `<img src="assets/rock_locked.png" alt="rock">`;
  rockBtn.addEventListener('click', () => { toggleRock(i); saveState(); });

  const kingdomImg = document.createElement('img');
  kingdomImg.src = kingdom.img;
  kingdomImg.alt = kingdom.name;
  kingdomImg.className = 'kingdom-icon';
  kingdomImg.title = kingdom.name;

  left.appendChild(lockBtn);
  left.appendChild(peaceBtn);
  left.appendChild(rockBtn);
  left.appendChild(kingdomImg);

  // ── Counter group: − [min] count [max] + ──
  const counter = document.createElement('div');
  counter.className = 'moon-row-counter';

  const decrBtn = document.createElement('button');
  decrBtn.className = 'count-btn decr-btn';
  decrBtn.textContent = '−';
  decrBtn.addEventListener('click', () => { decrement(i); saveState(); });

  const r = rangeFor(i);
  const minStack = document.createElement('div');
  minStack.className = 'range-stack range-min';
  minStack.innerHTML = `<span class="range-label">min</span><span class="range-value">${r.min}</span>`;

  const countLabel = document.createElement('span');
  countLabel.className = 'count-label';

  const maxStack = document.createElement('div');
  maxStack.className = 'range-stack range-max';
  maxStack.innerHTML = `<span class="range-label">max</span><span class="range-value">${r.max}</span>`;

  // Apply settings visibility
  if (!state.settings.show_moon_range) {
    minStack.classList.add('hidden');
    maxStack.classList.add('hidden');
  }

  const incrBtn = document.createElement('button');
  incrBtn.className = 'count-btn incr-btn';
  incrBtn.textContent = '+';
  incrBtn.addEventListener('click', () => { increment(i); saveState(); });

  // Moon and Cap Kingdom now display their own fixed min/max just like the core
  // kingdoms, so there's no special hiding of the range boxes here anymore.
  counter.appendChild(decrBtn);
  counter.appendChild(makeCounterSpacer());
  counter.appendChild(minStack);
  counter.appendChild(makeCounterSpacer());
  counter.appendChild(countLabel);
  counter.appendChild(makeCounterSpacer());
  counter.appendChild(maxStack);
  counter.appendChild(makeCounterSpacer());
  counter.appendChild(incrBtn);

  // ── Entry group: max field + save ──
  const entryGroup = document.createElement('div');
  entryGroup.className = 'moon-row-entry';

  // Multi-moon toggle  sits right after + before the entry field
  const multiBtn = document.createElement('button');
  multiBtn.className = 'multi-moon-btn';
  multiBtn.title = `Multi Moon (+3)`;
  const multiImg = document.createElement('img');
  multiImg.src = kingdom.multi;
  multiImg.alt = 'Multi Moon';
  multiBtn.appendChild(multiImg);
  // Apply settings visibility
  if (!state.settings.show_multi_moon) multiBtn.classList.add('hidden');
  multiBtn.addEventListener('click', () => { addMulti(i); saveState(); });

  const maxEntry = document.createElement('input');
  maxEntry.type = 'number';
  maxEntry.className = 'max-entry';
  maxEntry.placeholder = '?';
  maxEntry.min = '0';
  maxEntry.max = '9999';

  // Auto-save mode (save buttons hidden) update on every keystroke
  maxEntry.addEventListener('input', () => {
    if (!state.settings.show_save_buttons) {
      const v = parseInt(maxEntry.value);
      state.moons[i].max = (!isNaN(v) && v >= 0) ? v : null;
      refreshCountLabel(i);
      saveState();
    }
  });

  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-btn';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => { saveMax(i); });

  entryGroup.appendChild(multiBtn);
  entryGroup.appendChild(maxEntry);
  entryGroup.appendChild(saveBtn);

  row.appendChild(left);
  row.appendChild(counter);
  row.appendChild(entryGroup);

  refreshMoonRow(i, row);
  return row;
}

// ── Moon Row updates ──────────────────────────────────────────────
function getMoonRow(i) {
  return document.querySelector(`.moon-row[data-idx="${i}"]`);
}

function refreshCountLabel(i) {
  const row = getMoonRow(i);
  if (!row) return;
  const m = state.moons[i];
  row.querySelector('.count-label').textContent =
    `${m.count} / ${m.max !== null ? m.max : '?'}`;
  updateCountColor(i);
  updateMoonTotal();
}

// Green-when-complete: the count label turns green once count >= the required
// amount for that kingdom, reverting to white if it drops back below.
//
// Required amount:
//  • If the user has entered a per-kingdom max (m.max, the "?" field), that value
//    is the requirement EXACTLY - even if it's 0 (instantly green) or higher than
//    the game's normal max (e.g. a randomizer kingdom that needs 62 moons).
//  • If no max has been entered, fall back to the suggested max from KINGDOMS
//    (rangeFor(i).max), which scales with the Total Moon Requirement.
// This is deliberately NOT max(userMax, kingdomMax): a user max below the kingdom
// max must still win, so the two are never mixed.
function updateCountColor(i) {
  const row = getMoonRow(i);
  if (!row) return;
  const m = state.moons[i];
  const kingdom = KINGDOMS[i];
  const label = row.querySelector('.count-label');
  const required = (m.max !== null && m.max !== undefined) ? m.max : rangeFor(i).max;
  const isComplete = state.settings.show_complete_color && m.count >= required;
  label.classList.toggle('count-complete', isComplete);
  row.classList.toggle('row-complete', isComplete);
}

function refreshMoonRow(i, rowEl) {
  const row = rowEl || getMoonRow(i);
  if (!row) return;
  const m = state.moons[i];

  // Count label
  row.querySelector('.count-label').textContent =
    `${m.count} / ${m.max !== null ? m.max : '?'}`;

  // Lock image
  row.querySelector('.lock-btn img').src =
    m.lock ? 'assets/unlock.png' : 'assets/lock.png';

  // Peace image
  row.querySelector('.peace-btn img').src =
    m.peace ? 'assets/peace_unlock.png' : 'assets/peace.png';

  // Moon Rock image
  row.querySelector('.rock-btn img').src =
    m.rock ? 'assets/rock_unlocked.png' : 'assets/rock_locked.png';

  // Max entry only update if field not focused (avoid cursor jump)
  const entry = row.querySelector('.max-entry');
  if (document.activeElement !== entry) {
    entry.value = m.max !== null ? m.max : '';
  }

  // Kingdom icon color
  const kImg = row.querySelector('.kingdom-icon');
  kImg.classList.toggle('icon-white', !state.settings.show_icon_colors);

  // Multi moon button visibility
  const multiBtn = row.querySelector('.multi-moon-btn');
  if (multiBtn) {
    const hideMulti = KINGDOMS[parseInt(row.dataset.idx)]?.hideMulti === true;
    // Collapse in sync with every other row when the setting is off, so all
    // entry-groups shrink together and stay aligned. But when the setting is
    // on, a hideMulti row (Moon, Cap) still needs a multi-moon button-sized box
    // (just invisible) so its entry-group width - and therefore the + button
    // position - matches the other rows instead of expanding past them.
    multiBtn.classList.toggle('hidden', !state.settings.show_multi_moon);
    if (hideMulti) {
      multiBtn.style.visibility = state.settings.show_multi_moon ? 'hidden' : '';
      multiBtn.style.pointerEvents = 'none';
    } else {
      multiBtn.style.visibility = '';
      multiBtn.style.pointerEvents = '';
    }
  }

  // Min/max range stack visibility
  row.querySelectorAll('.range-stack').forEach(el => {
    el.classList.toggle('hidden', !state.settings.show_moon_range);
  });

  // Green-when-complete color
  updateCountColor(i);

  // Save button visibility
  row.querySelector('.save-btn').classList.toggle('hidden', !state.settings.show_save_buttons);

  updateMoonTotal();
}

// ── Moon actions ──────────────────────────────────────────────────
function increment(i) { state.moons[i].count++; refreshCountLabel(i); }
function decrement(i) { state.moons[i].count = Math.max(0, state.moons[i].count - 1); refreshCountLabel(i); }

function addMulti(i) {
  state.moons[i].count += 3;
  refreshMoonRow(i);
}

function toggleLock(i) {
  state.moons[i].lock = !state.moons[i].lock;
  const row = getMoonRow(i);
  if (row) row.querySelector('.lock-btn img').src =
    state.moons[i].lock ? 'assets/unlock.png' : 'assets/lock.png';
}

function togglePeace(i) {
  state.moons[i].peace = !state.moons[i].peace;
  const row = getMoonRow(i);
  if (row) row.querySelector('.peace-btn img').src =
    state.moons[i].peace ? 'assets/peace_unlock.png' : 'assets/peace.png';
}

function toggleRock(i) {
  state.moons[i].rock = !state.moons[i].rock;
  const row = getMoonRow(i);
  if (row) row.querySelector('.rock-btn img').src =
    state.moons[i].rock ? 'assets/rock_unlocked.png' : 'assets/rock_locked.png';
}

function saveMax(i) {
  const row = getMoonRow(i);
  if (!row) return;
  const v = parseInt(row.querySelector('.max-entry').value);
  state.moons[i].max = (!isNaN(v) && v >= 0) ? v : null;
  refreshCountLabel(i);
  saveState();
}

// ─────────────────────────────────────────────────────────────────────────────
// Capture Row Build
// ─────────────────────────────────────────────────────────────────────────────
function buildCaptureRow() {
  const container = document.getElementById('capture-row');
  container.innerHTML = '';
  CAPTURE_ICONS.forEach(ic => {
    const btn = document.createElement('button');
    btn.className = 'icon-toggle-btn';
    btn.dataset.key = ic.key;
    btn.title = ic.key;
    const img = document.createElement('img');
    img.src = state.captures[ic.key] ? ic.unlocked : ic.locked;
    img.alt = ic.key;
    btn.appendChild(img);
    btn.classList.toggle('active', state.captures[ic.key]);
    btn.addEventListener('click', () => {
      state.captures[ic.key] = !state.captures[ic.key];
      img.src = state.captures[ic.key] ? ic.unlocked : ic.locked;
      btn.classList.toggle('active', state.captures[ic.key]);
      saveState();
    });
    container.appendChild(btn);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Ability Row Build
// ─────────────────────────────────────────────────────────────────────────────
function buildAbilityRow() {
  const container = document.getElementById('ability-row');
  container.innerHTML = '';

  // `store` is the state slice this button owns - state.abilities for the real
  // abilities, state.captures for Bowser (which lives on the ability side but is
  // still a capture in saved state - see BOWSER_ABILITY_ICON).
  function makeAbilityBtn(ic, store) {
    store = store || state.abilities;
    const btn = document.createElement('button');
    btn.className = 'icon-toggle-btn ability-icon';
    btn.dataset.key = ic.key;
    btn.title = ic.key;
    const img = document.createElement('img');
    img.src = store[ic.key] ? ic.unlocked : ic.locked;
    img.alt = ic.key;
    btn.appendChild(img);
    btn.classList.toggle('active', store[ic.key]);
    btn.addEventListener('click', () => {
      store[ic.key] = !store[ic.key];
      img.src = store[ic.key] ? ic.unlocked : ic.locked;
      btn.classList.toggle('active', store[ic.key]);
      saveState();
    });
    return btn;
  }

  // Layout is a 2x2: [jump][cap] on top, [bowser][wall] on the bottom. Jump and
  // Cap can each be hidden independently (Show Jump / Show Cap Bounce settings).
  // applyAllSettings() decides the bottom-row arrangement: when BOTH Jump and Cap
  // show, #ability-row gets .abilities-2x2 and Bowser sits to the left of Wall
  // (completing the 2x2). Otherwise Bowser drops onto its own row centered under
  // Wall. ABILITY_ICONS = [jump, cap, wall]; Bowser owns state.captures.bowser.
  const top = document.createElement('div');
  top.className = 'ability-top';
  top.appendChild(makeAbilityBtn(ABILITY_ICONS[0])); // jump
  top.appendChild(makeAbilityBtn(ABILITY_ICONS[1])); // cap
  container.appendChild(top);

  const bottom = document.createElement('div');
  bottom.className = 'ability-bottom';
  bottom.appendChild(makeAbilityBtn(BOWSER_ABILITY_ICON, state.captures)); // bowser (left)
  bottom.appendChild(makeAbilityBtn(ABILITY_ICONS[2]));                    // wall (right)
  container.appendChild(bottom);

  // Build the Notes / Map / Ability + Capture buttons in #notes-section.
  //
  // When a side panel is already on screen (see sidePanelActive()), a click
  // SWITCHES the panel to that page - or toggles it back off if that page is
  // already the one showing. When no panel is open, each button falls back to
  // its own standalone view: Notes → in-page modal, Map and Ability + Capture
  // → a new tab.
  const notesSection = document.getElementById('notes-section');
  notesSection.innerHTML = '';

  const notesBtn = document.createElement('button');
  notesBtn.className = 'notes-btn';
  notesBtn.textContent = 'Loading Zone Notes';
  notesBtn.addEventListener('click', () => {
    if (sidePanelActive()) toggleSidePanel('notes');
    else openLoadingZones();
  });
  notesSection.appendChild(notesBtn);

  const mapBtn = document.createElement('button');
  mapBtn.className = 'map-btn';
  mapBtn.textContent = 'Connection Map';
  mapBtn.addEventListener('click', () => {
    if (sidePanelActive()) toggleSidePanel('map');
    else openMap();
  });
  notesSection.appendChild(mapBtn);

  const apcBtn = document.createElement('button');
  apcBtn.className = 'apc-btn';
  apcBtn.textContent = 'Ability + Capture';
  apcBtn.addEventListener('click', () => {
    if (sidePanelActive()) toggleSidePanel('apc');
    else openApc();
  });
  notesSection.appendChild(apcBtn);
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────────
function openSettings() {
  const modal = document.getElementById('settings-modal');
  // Populate current values
  TOGGLE_SETTINGS.forEach(({ id, key }) => {
    document.getElementById(id).checked = state.settings[key];
  });
  document.getElementById('input-moon-req').value = state.settings.moon_requirement;
  document.getElementById('input-overlay-scale').value = state.settings.overlay_scale;
  refreshBrowserSourceScaleField();
  const wsUrlInput = document.getElementById('input-ws-url');
  if (wsUrlInput) wsUrlInput.value = loadWsUrl();
  document.getElementById('input-notes-scroll').value = state.settings.notes_scroll_px;

  // Moon Updater location (segmented) + message count (select)
  const loc = state.settings.updater_location || 'top';
  document.querySelectorAll('#seg-updater-location .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === loc);
  });
  const countSel = document.getElementById('select-updater-count');
  if (countSel) countSel.value = String(Math.min(5, Math.max(1, state.settings.updater_count || 3)));

  // Side Panel mode (segmented) - Off / Notes / Map / Abilities & Captures
  const panelMode = getPanelMode();
  document.querySelectorAll('#seg-panel-mode .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === panelMode);
  });

  // Side Panel location (segmented)
  const panelLoc = state.settings.panel_location === 'vertical' ? 'vertical' : 'horizontal';
  document.querySelectorAll('#seg-panel-location .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === panelLoc);
  });

  // Populate rebind button labels
  document.getElementById('rebind-scroll-left').textContent = bindingLabel(state.settings.scroll_left_binding);
  document.getElementById('rebind-scroll-right').textContent = bindingLabel(state.settings.scroll_right_binding);

  updateSettingsEnablement();
  modal.classList.remove('hidden');
}

// Enable/disable and show/hide sub-controls based on their parent toggle:
//  • Jump / Cap Bounce rows are dimmed while Ability Lock is off.
//  • Updater Location / Message Count rows are dimmed while the updater is off.
//  • The "Show Moon/Cap Kingdom on OBS" rows are hidden entirely while their
//    parent kingdom is off (each is a sub-option of its kingdom toggle).
function updateSettingsEnablement() {
  const s = state.settings;

  const jumpRow = document.getElementById('toggle-ability-jump')?.closest('.settings-row');
  const capRow  = document.getElementById('toggle-ability-cap')?.closest('.settings-row');
  [jumpRow, capRow].forEach(r => r && r.classList.toggle('row-disabled', !s.show_ability_lock));

  const updOn = !!s.show_moon_updater;
  const locRow = document.getElementById('seg-updater-location')?.closest('.settings-row');
  const cntRow = document.getElementById('select-updater-count')?.closest('.settings-row');
  [locRow, cntRow].forEach(r => r && r.classList.toggle('row-disabled', !updOn));

  const moonObsRow = document.getElementById('row-moon-obs');
  if (moonObsRow) moonObsRow.classList.toggle('row-gone', !s.show_kingdom_moon);

  const capObsRow = document.getElementById('row-cap-obs');
  if (capObsRow) capObsRow.classList.toggle('row-gone', !s.show_kingdom_cap);

  const panelOn = getPanelMode() !== 'none';
  const panelLocRow = document.getElementById('seg-panel-location')?.closest('.settings-row');
  if (panelLocRow) panelLocRow.classList.toggle('row-disabled', !panelOn);
}

function applyAllSettings() {
  const s = state.settings;
  syncLegacyPanelFlags();

  // Icon colors
  document.querySelectorAll('.kingdom-icon').forEach(img => {
    img.classList.toggle('icon-white', !s.show_icon_colors);
  });

  // Save buttons
  document.querySelectorAll('.save-btn').forEach(btn => {
    btn.classList.toggle('hidden', !s.show_save_buttons);
  });

  // Capture section
  document.getElementById('capture-section').classList.toggle('hidden', !s.show_captures);

  // Ability icons: toggle class on section so icons hide without shifting layout
  document.getElementById('ability-section').classList.toggle('abilities-hidden', !s.show_ability_lock);

  // Individual Jump / Cap Bounce visibility (default off = hidden). When both
  // are hidden the top row is removed so Wall centers on its own.
  const jumpBtn = document.querySelector('#ability-row .ability-icon[data-key="jump"]');
  const capBtn  = document.querySelector('#ability-row .ability-icon[data-key="cap"]');
  const abilityTop = document.querySelector('#ability-row .ability-top');
  if (jumpBtn) jumpBtn.classList.toggle('icon-off', !s.show_ability_jump);
  if (capBtn)  capBtn.classList.toggle('icon-off', !s.show_ability_cap);
  if (abilityTop) abilityTop.classList.toggle('row-gone', !s.show_ability_jump && !s.show_ability_cap);

  // Bottom-row arrangement, driven by how many of Jump / Cap are shown:
  //   both → .abilities-2x2 : [Jump][Cap] over [Bowser][Wall], a clean 2x2.
  //   one  → .abilities-3   : [Jump|Cap][Wall] on top, Bowser on its own row
  //          below and aligned under the LEFT column (not centered).
  //   none → neither class  : just Bowser + Wall stacked and centered.
  // See the .abilities-2x2 / .abilities-3 rules in style.css.
  const abilityRow = document.getElementById('ability-row');
  if (abilityRow) {
    const showJump = !!s.show_ability_jump;
    const showCap = !!s.show_ability_cap;
    abilityRow.classList.toggle('abilities-2x2', showJump && showCap);
    abilityRow.classList.toggle('abilities-3', showJump !== showCap); // exactly one
  }

  // Lock / Peace sign columns on the main tracker
  const moonRows = document.getElementById('moon-rows');
  if (moonRows) {
    moonRows.classList.toggle('hide-lock', !s.show_lock);
    moonRows.classList.toggle('hide-peace', !s.show_peace);
    moonRows.classList.toggle('hide-rock', !s.show_rock);
  }

  // Multi moon buttons
  document.querySelectorAll('.multi-moon-btn').forEach(btn => {
    btn.classList.toggle('hidden', !s.show_multi_moon);
  });

  // Min/max range stacks
  document.querySelectorAll('.range-stack').forEach(el => {
    el.classList.toggle('hidden', !s.show_moon_range);
  });

  // Refresh the min/max range hints (they scale with Total Moon Requirement)
  // and recompute green-when-complete for every row, since toggling settings
  // or changing N must take effect immediately.
  refreshMoonRangeLabels();
  KINGDOMS.forEach((_, i) => updateCountColor(i));

  updateMoonTotal();
  applySidePanel();
}

// ── Zone name overrides ───────────────────────────────────────────
// Custom loading-zone names live in settings.zone_names, keyed by kingdom then
// by the default zone key. Empty/missing → fall back to the default name. Shared
// with notes.html and map.html (they read the same tracker_state).
function zoneDisplayName(kingdom, zone) {
  const byKingdom = state.settings.zone_names && state.settings.zone_names[kingdom];
  const custom = byKingdom && byKingdom[zone];
  return (custom && String(custom).trim()) ? custom : zone;
}

// ── Tracker Moon Count box ────────────────────────────────────────
// counted = raw sum of every visible kingdom's moon count (may exceed the
// requirement, which is fine). left = requirement − Σ min(count, MAX); a kingdom
// with no MAX set contributes its raw count. left is clamped at 0 for display.
function computeMoonTotals() {
  let counted = 0, capped = 0;
  KINGDOMS.forEach((k, i) => {
    if (k.settingKey && !state.settings[k.settingKey]) return; // skip hidden kingdoms
    const m = state.moons[i];
    if (!m) return;
    const c = m.count || 0;
    counted += c;
    const userMax = (m.max !== null && m.max !== undefined) ? m.max : Infinity;
    const kMax = (k.max !== null && k.max !== undefined) ? k.max : Infinity;
    capped += Math.min(c, userMax, kMax);
  });
  const req = state.settings.moon_requirement || 0;
  return { counted, req, left: Math.max(0, req - capped) };
}

function updateMoonTotal() {
  const box = document.getElementById('moon-total-box');
  if (!box) return;
  const on = !!state.settings.show_tracker_moon_total;
  box.classList.toggle('hidden', !on);
  if (!on) return;
  const { counted, req, left } = computeMoonTotals();
  box.querySelector('.mt-counted').textContent = counted;
  box.querySelector('.mt-req').textContent = req;
  box.querySelector('.mt-left').textContent = left;
}

// ─────────────────────────────────────────────────────────────────────────────
// Side Panel (Notes / Map embed)
// ─────────────────────────────────────────────────────────────────────────────
// Shows notes.html or map.html in an iframe beside (Horizontal) or below
// (Vertical) the tracker, per the Location setting. Notes/Map are mutually
// exclusive (enforced wherever the settings are changed, see the
// TOGGLE_SETTINGS change listener and toggleSidePanel below). Horizontal
// needs room beside the tracker, so it's unavailable below MOBILE_BREAKPOINT;
// Vertical stacks below instead and stays available at any width. Either
// way the underlying show_*_panel setting is left alone when unavailable, so
// the panel reappears automatically once there's room for it again.
function applySidePanel() {
  const s = state.settings;
  const panel = document.getElementById('side-panel');
  const frame = document.getElementById('side-panel-frame');
  const title = document.getElementById('side-panel-title');
  const layoutRow = document.getElementById('layout-row');
  if (!panel || !frame || !title || !layoutRow) return;

  const location = s.panel_location === 'vertical' ? 'vertical' : 'horizontal';
  const locationAvailable = isPanelLocationAvailable();

  const mode = locationAvailable ? getPanelMode() : 'none';

  let src = null;
  if (mode === 'notes') {
    title.textContent = 'Loading Zone Notes';
    src = 'notes.html';
  } else if (mode === 'map') {
    title.textContent = 'Connection Map';
    src = 'map.html';
  } else if (mode === 'apc') {
    title.textContent = 'Abilities & Captures';
    // Version tag so a browser can't keep serving an older cached copy of the
    // panel. Bump it here and in index.html's script tags together.
    src = 'apc.html?v=4';
  }

  layoutRow.classList.toggle('location-horizontal', location === 'horizontal');
  layoutRow.classList.toggle('location-vertical', location === 'vertical');

  if (src) {
    // Only reassign src when it actually changes, so the embedded page
    // doesn't reload (and lose its own in-memory state) on every settings
    // change or window resize.
    if (frame.dataset.src !== src) {
      frame.src = src;
      frame.dataset.src = src;
    }
    panel.classList.remove('hidden');
    layoutRow.classList.add('panel-open');
    document.body.classList.add('panel-edges');
  } else {
    panel.classList.add('hidden');
    layoutRow.classList.remove('panel-open');
    document.body.classList.remove('panel-edges');
    if (frame.dataset.src) {
      frame.src = '';
      delete frame.dataset.src;
    }
  }
}

const PANEL_MODES = ['none', 'notes', 'map', 'apc'];

function getPanelMode() {
  const m = state.settings.panel_mode;
  return PANEL_MODES.includes(m) ? m : 'none';
}

// panel_mode is the real setting; these two older booleans are kept aligned
// with it so any code (or saved file) that still reads them stays correct.
function syncLegacyPanelFlags() {
  const m = getPanelMode();
  state.settings.show_notes_panel = (m === 'notes');
  state.settings.show_map_panel = (m === 'map');
}

// Switches the side panel to `which`, or back off if it's already showing.
// Used by the Settings segmented control and by the repurposed Loading Zone
// Notes / Connection Map buttons.
function setPanelMode(mode) {
  state.settings.panel_mode = PANEL_MODES.includes(mode) ? mode : 'none';
  syncLegacyPanelFlags();
  saveState();
  applyAllSettings();
  refreshPanelModeButtons();
}

function toggleSidePanel(which) {
  setPanelMode(getPanelMode() === which ? 'none' : which);
}

// True when a side panel is actually on screen right now: a mode is selected
// AND the chosen location has room to render it (Horizontal needs width beyond
// the mobile breakpoint; Vertical always fits). The tracker's Notes / Map /
// Ability + Capture buttons use this to decide between switching the open panel
// and falling back to a standalone view.
function sidePanelActive() {
  return isPanelLocationAvailable() && getPanelMode() !== 'none';
}

// Keeps the Settings segmented control in step when the mode changes from
// somewhere else (the panel's ✕, the Notes/Map buttons, a remote sync).
function refreshPanelModeButtons() {
  const mode = getPanelMode();
  document.querySelectorAll('#seg-panel-mode .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === mode);
  });
  updateSettingsEnablement();
}

// Rewrite each visible row's min/max hint from the current scaled ranges.
function refreshMoonRangeLabels() {
  KINGDOMS.forEach((k, i) => {
    const row = getMoonRow(i);
    if (!row) return;
    const r = rangeFor(i);
    const minV = row.querySelector('.range-min .range-value');
    const maxV = row.querySelector('.range-max .range-value');
    if (minV) minV.textContent = r.min;
    if (maxV) maxV.textContent = r.max;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Reset
// ─────────────────────────────────────────────────────────────────────────────
function resetAll() {
  if (!confirm('Clear all progress? Settings will be kept.')) return;
  const savedSettings = JSON.parse(JSON.stringify(state.settings)); // deep clone and avoid sharing nested binding objects
  savedSettings.kingdom_order = null; // restore the original kingdom order
  state = getDefaultState();
  state.settings = savedSettings;
  // Clearing progress is meant to wipe the panel too, so this write wins over
  // whatever is currently in storage. Hold back the generic "apc-changed" ping
  // and send one explicit "apc-reset" afterwards: that tells any open Abilities
  // & Captures panel to drop its short-lived edit protection so it can't
  // re-assert an entry that was just cleared here.
  authoritativeWrite = true;
  suppressApcNotify = true;
  saveState();
  suppressApcNotify = false;
  authoritativeWrite = false;
  if (apcChannel) apcChannel.post({ type: 'apc-reset' });
  buildAllMoonRows();
  buildCaptureRow();
  buildAbilityRow();
  applyAllSettings();
}

// ─────────────────────────────────────────────────────────────────────────────
// OBS Overlay
// ─────────────────────────────────────────────────────────────────────────────
let obsWindow = null;

// Browser Source (OBS) is always shown 3x the Popup Scale setting, rather than
// being independently adjustable, so they stay in sync automatically.
const BROWSER_SOURCE_MULTIPLIER = 3;

// ── OBS overlay unscaled base size ────────────────────────────────
// The overlay's natural (scale = 1) size. Width is fixed; height grows to make
// room for optional pieces: the extra Cap Kingdom row, the extra Moon Kingdom
// row, and the Moon Updater message strip. obs.html computes height with the
// IDENTICAL formula
// (keep OBS_* constants in sync across both files) so the OBS Browser Source
// dimensions we display here always match what the overlay actually renders.
const OBS_BASE_W = 315;
const OBS_BASE_H = 450;          // 11 kingdoms, no updater
const OBS_ROCK_COL_W = 23;       // extra body width when the Moon Rock column shows
const OBS_MOON_ROW_H = 40;       // added when Moon Kingdom shows on the overlay
const OBS_CAP_ROW_H = 40;        // added when Cap Kingdom shows on the overlay
const OBS_UPDATER_MSG_H = 24;    // per visible updater message
const OBS_UPDATER_PAD = 12;      // updater strip padding (top + bottom)

function getObsBaseSize(settings) {
  const s = settings || state.settings || {};
  let h = OBS_BASE_H;
  if (s.show_kingdom_moon && s.show_moon_obs !== false) h += OBS_MOON_ROW_H;
  if (s.show_kingdom_cap && s.show_cap_obs !== false) h += OBS_CAP_ROW_H;
  if (s.show_moon_updater) {
    const n = Math.min(5, Math.max(1, s.updater_count || 3));
    h += n * OBS_UPDATER_MSG_H + OBS_UPDATER_PAD;
  }
  // Width is the tracker-body width, which grows when the Moon Rock column is
  // shown so the extra sign icon doesn't get clipped on the overlay. The updater
  // only widens the popup further when its window is dragged out. The Browser
  // Source estimate is this width x the 3x browser scale.
  const w = OBS_BASE_W + (s.show_rock ? OBS_ROCK_COL_W : 0);
  return { w, h };
}

function getBrowserSourceScale() {
  return (state.settings.overlay_scale || 1) * BROWSER_SOURCE_MULTIPLIER;
}

function refreshBrowserSourceScaleField() {
  const el = document.getElementById('input-browser-source-scale');
  if (el) el.value = getBrowserSourceScale();
}

function openOBS() {
  const room = window.SMOSync ? window.SMOSync.getRoom() : null;
  const wsUrl = room ? encodeURIComponent(window.SMOSync.getWsUrl()) : '';
  const scale = state.settings.overlay_scale || 1;
  const base = getObsBaseSize();
  const width = Math.round(base.w * scale);
  const height = Math.round(base.h * scale);
  let url = 'obs.html?popup=1';
  if (room) {
    url += `&room=${room}&ws=${wsUrl}&scale=${scale}`;
  }
  const features = `width=${width},height=${height},resizable=yes,scrollbars=no,toolbar=no,menubar=no`;
  if (!obsWindow || obsWindow.closed) {
    obsWindow = window.open(url, 'MoonTrackerOBS', features);
  } else {
    obsWindow.location.href = url;
    obsWindow.focus();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync
// ─────────────────────────────────────────────────────────────────────────────
function loadWsUrl() {
  try {
    return localStorage.getItem(WS_URL_KEY) || '';
  } catch (e) { return ''; }
}

function saveWsUrl(url) {
  try {
    if (url) localStorage.setItem(WS_URL_KEY, url);
    else localStorage.removeItem(WS_URL_KEY);
  } catch (e) { console.error('Failed to save WS URL:', e); }
}

function getObsPageUrl(room, wsUrl) {
  const base = 'https://firerisingraging.github.io/Online_SMO_Randomizer_Tracker/obs.html';
  if (!room) return base;
  const scale = getBrowserSourceScale();
  return `${base}?room=${room}&ws=${encodeURIComponent(wsUrl || window.SMOSync.getWsUrl())}&scale=${scale}`;
}

function updateSyncUI() {
  const sync = window.SMOSync;
  const room = sync ? sync.getRoom() : null;
  const roomInput = document.getElementById('input-room-code');
  const connectBtn = document.getElementById('btn-connect-room');
  const statusEl = document.getElementById('sync-status');
  const urlRow = document.getElementById('sync-url-row');
  const urlInput = document.getElementById('input-obs-url');
  const sizeRow = document.getElementById('sync-size-row');
  const scale = getBrowserSourceScale();

  if (roomInput) roomInput.value = room || '';

  if (room) {
    connectBtn.textContent = 'Disconnect';
    if (urlRow) urlRow.classList.remove('hidden');
    if (sizeRow) sizeRow.classList.remove('hidden');
    if (urlInput) urlInput.value = getObsPageUrl(room);
    if (sizeRow) {
      const base = getObsBaseSize();
      sizeRow.innerHTML = `OBS size: <strong>${Math.round(base.w * scale)}</strong> × <strong>${Math.round(base.h * scale)}</strong>`;
    }
  } else {
    connectBtn.textContent = 'Connect';
    if (urlRow) urlRow.classList.add('hidden');
    if (sizeRow) sizeRow.classList.add('hidden');
    if (statusEl) statusEl.textContent = 'Offline enter a room code to sync';
  }
}

function applyRemoteState(remote) {
  if (!remote || typeof remote !== 'object') return;
  applyingRemote = true;

  // Merge settings
  if (remote.settings) {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (key in remote.settings) state.settings[key] = remote.settings[key];
    }
  }

  // Merge moons
  if (Array.isArray(remote.moons)) {
    remote.moons.forEach((m, i) => {
      if (state.moons[i]) Object.assign(state.moons[i], m);
    });
  }

  // Merge captures / abilities (main tracker icons + the full panel list)
  if (remote.captures) Object.assign(state.captures, remote.captures);
  if (remote.abilities) Object.assign(state.abilities, remote.abilities);
  if (remote.apc) {
    APC.ensure(state);
    if (remote.apc.captures) Object.assign(state.apc.captures, remote.apc.captures);
    if (remote.apc.abilities) Object.assign(state.apc.abilities, remote.apc.abilities);
  }

  // Merge loading zones
  if (remote.loading_zones) {
    for (const [kingdom, data] of Object.entries(state.loading_zones)) {
      if (!remote.loading_zones[kingdom]) continue;
      const savedKingdom = remote.loading_zones[kingdom];
      for (const zone of Object.keys(data.zones)) {
        if (savedKingdom.zones && savedKingdom.zones[zone]) {
          Object.assign(state.loading_zones[kingdom].zones[zone], savedKingdom.zones[zone]);
        }
      }
    }
  }

  // Merge collapsed state
  if (remote.kingdom_collapsed) {
    for (const k of Object.keys(state.kingdom_collapsed)) {
      if (k in remote.kingdom_collapsed) state.kingdom_collapsed[k] = remote.kingdom_collapsed[k];
    }
  }

  // A payload from another client is the newer truth, panel entries included.
  authoritativeWrite = true;
  saveState();
  authoritativeWrite = false;
  refreshAll();
  applyingRemote = false;
}

function refreshAll() {
  buildAllMoonRows();
  buildCaptureRow();
  buildAbilityRow();
  applyAllSettings();
  // Re-open settings to refresh values if visible
  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal && !settingsModal.classList.contains('hidden')) {
    openSettings();
  }
}

function connectRoom() {
  const roomInput = document.getElementById('input-room-code');
  const room = roomInput.value.trim();
  if (!room) return;

  const wsUrlInput = document.getElementById('input-ws-url');
  const wsUrl = wsUrlInput ? wsUrlInput.value.trim() : '';

  saveWsUrl(wsUrl);
  try {
    localStorage.setItem(ROOM_CODE_KEY, room);
  } catch (e) { }

  if (window.SMOSync) {
    window.SMOSync.connect(room, wsUrl);
  }
  // Same room code the player enters on the Switch's Tracker Live Testing
  // menu - this is what actually receives the mod's live moon/capture/
  // ability updates. Independent of whether the SMOSync connect above
  // succeeds (that's just for syncing this state between viewer windows/OBS).
  if (window.SMOFirebaseProgressSync) {
    window.SMOFirebaseProgressSync.connect(room);
  }
}

function disconnectRoom() {
  if (window.SMOSync) window.SMOSync.disconnect();
  if (window.SMOFirebaseProgressSync) window.SMOFirebaseProgressSync.disconnect();
  try {
    localStorage.removeItem(ROOM_CODE_KEY);
  } catch (e) { }
  updateSyncUI();
}

function generateAndConnectRoom() {
  if (!window.SMOSync) return;
  const code = window.SMOSync.generateRoomCode(12);
  const roomInput = document.getElementById('input-room-code');
  if (roomInput) roomInput.value = code;
  connectRoom();
}

function copyObsUrl() {
  const input = document.getElementById('input-obs-url');
  if (!input) return;
  input.select();
  navigator.clipboard.writeText(input.value).catch(() => { });
}

function toggleVisibility() {
  const roomInput = document.getElementById('input-room-code');
  const urlInput = document.getElementById('input-obs-url');
  const btn = document.getElementById('btn-toggle-visibility');
  if (!roomInput || !btn) return;

  const makeVisible = roomInput.type === 'password';
  const newType = makeVisible ? 'text' : 'password';
  roomInput.type = newType;
  if (urlInput) urlInput.type = newType;
  btn.textContent = makeVisible ? 'Hide' : 'Show';
}

function setupSyncUI() {
  if (!window.SMOSync) return;

  // Load saved server URL into settings field
  const savedWsUrl = loadWsUrl();
  const wsUrlInput = document.getElementById('input-ws-url');
  if (wsUrlInput && savedWsUrl) wsUrlInput.value = savedWsUrl;

  // Status listener
  window.SMOSync.onStatus((status) => {
    const statusEl = document.getElementById('sync-status');
    if (statusEl) {
      const labels = {
        connected: 'Connected - state is syncing',
        connecting: 'Connecting...',
        disconnected: 'Disconnected',
        error: 'Connection error - OBS overlay will not work'
      };
      statusEl.textContent = labels[status] || status;
    }
    updateSyncUI();
  });

  // Incoming state listener
  window.SMOSync.onState((remoteState) => {
    applyRemoteState(remoteState);
  });

  // Live moon/capture/ability updates straight from the mod (see
  // connectRoom()/disconnectRoom() for where this actually connects).
  if (window.SMOFirebaseProgressSync) {
    window.SMOFirebaseProgressSync.onProgress((data) => {
      applyProgressSnapshot(data);
    });
  }

  // Button wiring
  const connectBtn = document.getElementById('btn-connect-room');
  const generateBtn = document.getElementById('btn-generate-room');
  const copyBtn = document.getElementById('btn-copy-obs-url');
  const visibilityBtn = document.getElementById('btn-toggle-visibility');

  if (connectBtn) {
    connectBtn.addEventListener('click', () => {
      if (window.SMOSync.getRoom()) disconnectRoom();
      else connectRoom();
    });
  }
  if (generateBtn) generateBtn.addEventListener('click', generateAndConnectRoom);
  if (copyBtn) copyBtn.addEventListener('click', copyObsUrl);
  if (visibilityBtn) visibilityBtn.addEventListener('click', toggleVisibility);

  // Auto-connect from query param or saved room
  const params = new URLSearchParams(window.location.search);
  const roomFromUrl = params.get('room');
  let room = roomFromUrl;
  if (!room) {
    try { room = localStorage.getItem(ROOM_CODE_KEY); } catch (e) { }
  }
  if (room) {
    const roomInput = document.getElementById('input-room-code');
    if (roomInput) roomInput.value = room;
    connectRoom();
  }

  updateSyncUI();
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading Zones Modal
// ─────────────────────────────────────────────────────────────────────────────
let notesWindow = null;
let mapWindow = null;
let apcWindow = null;

function openMap() {
  // If the map tab is already open, refocus it instead of spawning another.
  if (mapWindow && !mapWindow.closed) {
    mapWindow.focus();
    return;
  }
  // No feature string → browsers open a real new tab (not a popup window); the
  // 'ConnectionMap' target name keeps repeat clicks to a single reused tab.
  mapWindow = window.open('map.html', 'ConnectionMap');
}

function openApc() {
  // If the Abilities & Captures tab is already open, refocus it instead of
  // spawning another. No feature string → a real new tab, not a popup window;
  // the 'AbilitiesCaptures' target name keeps repeat clicks to one reused tab.
  if (apcWindow && !apcWindow.closed) {
    apcWindow.focus();
    return;
  }
  apcWindow = window.open('apc.html?v=4', 'AbilitiesCaptures');
}

function openLoadingZones() {
  // If the standalone Notes window is already open, just bring it forward
  // instead of opening a second editable copy in-page.
  if (notesWindow && !notesWindow.closed) {
    notesWindow.focus();
    return;
  }
  // The popped-out notes.html writes directly to localStorage on every edit,
  // but this tab's in-memory `state` doesn't auto-refresh without this, the
  // modal would render stale data if notes.html was edited after this page loaded.
  resyncLoadingZonesFromStorage();
  // Modal must be visible before we build/measure content, or heights read as 0
  document.getElementById('lz-modal').classList.remove('hidden');
  ensureNotesToolbar();
  buildLoadingZonesContent();
  // layoutMasonryColumns();
}

// Pulls just loading_zones + kingdom_collapsed from localStorage into the live
// `state` object, using the same merge logic as loadState(). Settings/moons/
// captures/abilities are untouched here this only targets the Notes data
// that notes.html (a separate window) may have updated since our last load.
function resyncLoadingZonesFromStorage() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);

    if (saved.loading_zones) {
      for (const [kingdom, data] of Object.entries(state.loading_zones)) {
        if (!saved.loading_zones[kingdom]) continue;
        const savedKingdom = saved.loading_zones[kingdom];
        for (const zone of Object.keys(data.zones)) {
          if (savedKingdom.zones && savedKingdom.zones[zone]) {
            Object.assign(state.loading_zones[kingdom].zones[zone], savedKingdom.zones[zone]);
          }
        }
      }
    }
    if (saved.kingdom_collapsed) {
      for (const k of Object.keys(state.kingdom_collapsed)) {
        if (k in saved.kingdom_collapsed) state.kingdom_collapsed[k] = saved.kingdom_collapsed[k];
      }
    }
  } catch (e) {
    console.error('Failed to resync loading zones from storage:', e);
  }
}

function popOutNotes() {
  // If the Notes tab is already open, refocus it instead of spawning another.
  if (notesWindow && !notesWindow.closed) {
    notesWindow.focus();
  } else {
    // No feature string → a real new tab (not a popup window); the
    // 'MoonTrackerNotes' target name keeps repeat clicks to one reused tab.
    notesWindow = window.open('notes.html', 'MoonTrackerNotes');
  }
  document.getElementById('lz-modal').classList.add('hidden');
}

function buildLoadingZonesContent() {
  const container = document.getElementById('lz-content');
  container.innerHTML = '';
  if (state.settings.show_painting_notes) {
    container.appendChild(buildPaintingNotesColumn());
  }
  for (const [kingdom, data] of Object.entries(state.loading_zones)) {
    const settingKey = KINGDOM_VISIBILITY_SETTINGS[kingdom];
    if (settingKey && !state.settings[settingKey]) continue;
    container.appendChild(buildKingdomColumn(kingdom, data));
  }
  applyNotesLayout();
  autosizeNotes(container);
}

// Paintings notes column: one note box per kingdom, no moon icons.
function buildPaintingNotesColumn() {
  if (!state.painting_notes) state.painting_notes = {};
  const col = document.createElement('div');
  col.className = 'kingdom-col';

  const header = document.createElement('div');
  header.className = 'kingdom-col-header';

  const icon = document.createElement('img');
  icon.src = 'assets/Painting.png';
  icon.height = 20;
  icon.alt = 'Paintings';

  const title = document.createElement('span');
  title.className = 'col-title';
  title.textContent = 'Paintings';
  title.style.color = '#e6e6ee';

  const chevron = document.createElement('span');
  chevron.className = 'col-chevron';
  chevron.textContent = '▾';

  header.appendChild(icon);
  header.appendChild(title);
  header.appendChild(chevron);

  const zonesRoot = document.createElement('div');
  zonesRoot.className = 'zones-container';

  PAINTING_NOTE_KINGDOMS.forEach(kingdom => {
    if (!(kingdom in state.painting_notes)) state.painting_notes[kingdom] = '';
    const kd = LOADING_ZONES_TEMPLATE[kingdom] || { color: '#e6e6ee' };
    const row = document.createElement('div');
    row.className = 'zone-row';

    const top = document.createElement('div');
    top.className = 'zone-row-top';
    const nameLabel = document.createElement('span');
    nameLabel.className = 'zone-name';
    nameLabel.textContent = kingdom;
    nameLabel.style.color = kd.color;
    top.appendChild(nameLabel);
    row.appendChild(top);

    const noteArea = document.createElement('textarea');
    noteArea.className = 'zone-note';
    noteArea.value = state.painting_notes[kingdom] || '';
    noteArea.placeholder = 'Note…';
    noteArea.rows = 1;
    noteArea.addEventListener('input', () => {
      state.painting_notes[kingdom] = noteArea.value;
      saveState();
      requestAnimationFrame(() => {
        noteArea.style.height = 'auto';
        noteArea.style.height = noteArea.scrollHeight + 'px';
      });
    });
    row.appendChild(noteArea);
    zonesRoot.appendChild(row);
  });

  if (state.kingdom_collapsed[PAINTINGS_NOTES_KEY]) {
    zonesRoot.style.display = 'none';
    header.classList.add('collapsed');
  }
  header.addEventListener('click', () => {
    const willCollapse = zonesRoot.style.display !== 'none';
    zonesRoot.style.display = willCollapse ? 'none' : '';
    header.classList.toggle('collapsed', willCollapse);
    state.kingdom_collapsed[PAINTINGS_NOTES_KEY] = willCollapse;
    saveState();
  });

  col.appendChild(header);
  col.appendChild(zonesRoot);
  return col;
}

// ── Notes layout: orientation (horizontal/vertical) + column count + compact ──
// Everything is driven by classes on #lz-content, so switching is instant and
// never needs a rebuild. Settings persist and are shared with notes.html.
function normalizeNotesCols(v) {
  return (v === 1 || v === 3) ? v : 2;
}

function applyNotesLayout() {
  const content = document.getElementById('lz-content');
  if (!content) return;
  const s = state.settings;
  const vertical = s.notes_layout === 'vertical';
  const cols = normalizeNotesCols(s.notes_columns);
  content.classList.toggle('lz-layout-vertical', vertical);
  content.classList.toggle('lz-layout-horizontal', !vertical);
  content.classList.remove('lz-cols-1', 'lz-cols-2', 'lz-cols-3');
  content.classList.add('lz-cols-' + cols);
  content.classList.toggle('lz-compact', !!s.notes_compact);
  syncNotesToolbar();
}

function syncNotesToolbar() {
  const bar = document.querySelector('#lz-modal .lz-toolbar');
  if (!bar) return;
  const s = state.settings;
  const vertical = s.notes_layout === 'vertical';
  const cols = normalizeNotesCols(s.notes_columns);
  bar.classList.toggle('orient-vertical', vertical);
  bar.querySelectorAll('[data-orient]').forEach(b =>
    b.classList.toggle('active', (b.dataset.orient === 'vertical') === vertical));
  bar.querySelectorAll('[data-cols]').forEach(b =>
    b.classList.toggle('active', Number(b.dataset.cols) === cols));
  const compactBtn = bar.querySelector('[data-compact]');
  if (compactBtn) compactBtn.classList.toggle('active', !!s.notes_compact);
}

// Grow each visible note textarea to fit its saved text so column packing
// measures real heights (and long notes aren't clipped to one line).
//
// Perf: only boxes that actually contain text need measuring - an empty note
// is already the correct single-row height. And the work is batched into three
// phases (reset all heights, read all scrollHeights, then apply all heights) so
// we don't interleave writes and reads. Interleaving forces a full synchronous
// reflow of the whole notes masonry on every box, which is what made opening
// the notes view (modal, side panel, and notes.html) feel slow.
function autosizeNotes(root) {
  const nodes = Array.from((root || document).querySelectorAll('.zone-note'))
    .filter(t => t.style.display !== 'none' && t.value.trim() !== '');
  if (!nodes.length) return;
  nodes.forEach(t => { t.style.height = 'auto'; });
  const heights = nodes.map(t => t.scrollHeight);
  nodes.forEach((t, i) => { t.style.height = heights[i] + 'px'; });
}

// Build the toolbar once and insert it above the scroll area in the modal.
function ensureNotesToolbar() {
  const modal = document.getElementById('lz-modal');
  if (!modal) return;
  const scrollWrap = modal.querySelector('.lz-scroll-wrap');
  if (!scrollWrap || !scrollWrap.parentElement) return;
  if (modal.querySelector('.lz-toolbar')) return; // already built

  const bar = document.createElement('div');
  bar.className = 'lz-toolbar';
  bar.innerHTML =
    '<div class="lz-toolbar-group">' +
      '<span class="lz-toolbar-label">Layout</span>' +
      '<div class="segmented">' +
        '<button class="seg-btn" data-orient="horizontal">Horizontal</button>' +
        '<button class="seg-btn" data-orient="vertical">Vertical</button>' +
      '</div>' +
    '</div>' +
    '<div class="lz-toolbar-group lz-cols-group">' +
      '<span class="lz-toolbar-label">Columns</span>' +
      '<div class="segmented">' +
        '<button class="seg-btn" data-cols="1">1</button>' +
        '<button class="seg-btn" data-cols="2">2</button>' +
        '<button class="seg-btn" data-cols="3">3</button>' +
      '</div>' +
    '</div>' +
    '<div class="lz-toolbar-group">' +
      '<button class="lz-compact-btn" data-compact>Compact</button>' +
    '</div>';

  bar.querySelectorAll('[data-orient]').forEach(b =>
    b.addEventListener('click', () => {
      state.settings.notes_layout = b.dataset.orient;
      saveState();
      applyNotesLayout();
    }));
  bar.querySelectorAll('[data-cols]').forEach(b =>
    b.addEventListener('click', () => {
      state.settings.notes_columns = Number(b.dataset.cols);
      // Column count only has an effect in vertical mode, so flip into it.
      state.settings.notes_layout = 'vertical';
      saveState();
      applyNotesLayout();
    }));
  const compactBtn = bar.querySelector('[data-compact]');
  compactBtn.addEventListener('click', () => {
    state.settings.notes_compact = !state.settings.notes_compact;
    saveState();
    applyNotesLayout();
  });

  scrollWrap.parentElement.insertBefore(bar, scrollWrap);
}

// Clears the note text and resets icons back to default in every zone,
// leaving collapsed/expanded state untouched.
function clearAllNotes() {
  if (!confirm('Clear all loading zone notes? This cannot be undone.')) return;
  for (const kingdom of Object.values(state.loading_zones)) {
    for (const zone of Object.values(kingdom.zones)) {
      zone.note = '';
      zone.icon = 'Moon.png';
      zone.icon2 = 'Moon.png';
    }
  }
  if (state.painting_notes) {
    for (const k of Object.keys(state.painting_notes)) state.painting_notes[k] = '';
  }
  saveState();
  buildLoadingZonesContent();
}

// ─────────────────────────────────────────────────────────────────────────────
// Zone Names editor
// ─────────────────────────────────────────────────────────────────────────────
// In-game (destination) names for each loading zone, keyed by kingdom then by
// the default zone key. The small gray line above each Zone Names box reads from
// this map, and the "Use In-Game Names" button copies these into the inputs.
const IN_GAME_ZONE_NAMES = {
  // ── Verified ──────────────────────────────────────────────
  'Cap': {
    'Orange': 'Push Block Platforming',
    'Paragoomba': 'Flying over the Posion Tide',
    'Frog': 'The Frog Pond',
    'Rolling On': 'Rolling On and On',
  },
  'Cascade': {
    'Dino': 'Dinosaur Nest',
    '2D': '2D Chasm Platforming',
    'Chain Chomp': 'Chain Chomp Shooting',
    'Swings': 'The Mysterious Clouds',
    'Windy': 'The Gusty Bridges',
  },
  'Sand': {
    'Icy Cave': 'Ice Cave',
    'Moe-eye': 'Invisible Maze',
    'Shop': 'Crazy Cap',
    'Employees': 'Employees Only!',
    'Slots': 'Slots',
    'Rumble': 'Rumble',
    'Outfit': 'Costume Room',
    'Jaxi Ruins': 'Jaxi Driver Course',
    'Bullet Bill': 'Bullet Bill Maze',
    'Gushen': 'Freezing Waterway',
    'Sphynx': 'Sphynx Treasure Room',
    'Moving Platform': 'Transparent Platforms',
    'Rocket': 'The Strange Neighborhood',
    'Colossal Ruins': 'Colossal Ruins',
  },
  // ── Best-effort (hand-check before relying on) ────────────
  'Lake': {
    'Poison Waves': 'Waves of Poison',
    'Zipper': 'Zipper Chasm',
    'Grab Climb': 'Platforming Playground',
    'Shop': 'Crazy Cap',
    'Puzzle': 'Stone Block Puzzle Stage',
  },
  'Wooded': {
    'DW Odyssey': 'Deep Woods: Odyssey Area',
    'DW Red Maze': 'Deep Woods: Red Leaf Maze',
    'DW Pond': 'Deep Woods: Pond Area',
    'DW Treasure': 'Deep Woods: Treasure Chest',
    'DW Outfit': 'Deep Woods: Costume',
    'Rocket': 'In the Fog',
    'Sheep': 'Herding Sheep Bridge',
    'Tank': 'Tank Elevator',
    'Vine Clouds': 'The Clouds',
    'Breakdown': 'Breakdown Road',
    'Invisible': 'Invisible Road',
    'Flooded Pipes': 'Flooded Pipeway',
    'Flower Road': 'Flower Road',
    'Treasure Room': 'Forest Kingdom Bonus Stage',
  },
  'Lost': {
    'Wiggler': 'Poison Swamp',
    'Shop': 'Crazy Cap',
    'Klepto': "Klepto's Hot Nest",
  },
  'Metro': {
    'Yellow Shop': 'Crazy Cap (Yellow)',
    'Purple Shop': 'Crazy Cap (Purple)',
    'Dino': 'Escape!',
    'Bullet Billding': 'Pole Challenge',
    'Taxi': 'Under Siege',
    'Notes': 'Private Room',
    '2D': 'Big Screen',
    'Slots': 'Slots',
    'People': 'The Crowd',
    'Outfit': 'Wire Station',
    'Rocket': 'High Rise',
    'Dark': 'Pitch-Black Island',
    'Scaffolding': 'Swinging Scaffolding',
    'Scooter': 'Motor Scooter Stuntdriving',
    'Rotating Maze': 'Rotating Maze',
    'RC Car': 'RC Car',
  },
  'Snow': {
    'Puzzle': 'Typhoo Challenge',
    'Capless': 'Freezing Water Platforming',
    'Rocket Flower': 'Cold Water Track',
    'Iceburn Circuit': 'Iceburn Circuit',
    'Flower Road': 'Flower Road',
    'Tracewalking': 'Tracewalking',
    'Clouds': 'High-Altitude Flowers',
    'Outfit': 'Cold Room',
    'Shop': 'Crazy Cap',
  },
  'Seaside': {
    'Well Enter': 'Sea Cave (Enter)',
    'Well Exit': 'Sea Cave (Exit)',
    'Rumble': 'Rumble Room',
    'Rocket': 'Cloud Sea',
    'Outfit': 'Costume Room',
    'Gushen': 'Narrow Valley',
    'Sphynx': 'Sphynx Treasure Room',
    'Pokio': "Bomb Valley",
    'Lava Rising': 'Sinking Lava Island',
    'Sandy Bottom': 'Sandy Bottom',
    'Spinning Maze': 'Spinning Maze',
  },
  'Luncheon': {
    'Magma Swamp': 'Magma Swamp',
    'Forks': 'Fork Flickin',
    'Cheese Rocks': 'Cheese Rocks',
    'Veggie Room': 'Luncheon Kingdom Bonus',
    'Slots': 'Slots',
    'Shop': 'Crazy Cap',
    'Outfit': 'Simmer Room',
    'Spinning Athletics': 'Spinning Athletics',
    'Lava Islands': 'Lava Islands',
    'Volcano Cave': 'Volcano Cave',
    'Gears': 'Gear Steps',
    'Magma Path': 'Narrow Magma Path',
  },
  'Ruined': {
    "Chargin' Chuck": "Mummy Army",
    'Rocket': 'Roullete Tower',
  },
  "Bowser's": {
    'Jizo': "Jizo's Stupid Challenge",
    'Shop': 'Crazy Cap',
    'Outfit': "Folding Screen",
    'Treasure Room': 'Bowser Bonus Stage',
    'Spinning Tower': 'Spinning Tower',
    'Vine Clouds': 'Cloud Dash Track',
    'Hexagon Tower': 'Hexagon Tower',
    'Wooden Tower': 'Wooden Tower',
  },
  'Mushroom': {
    'Shop': 'Crazy Cap',
    'Castle Door': "Peach's Castle Interior",
    'Outfit': 'Classical Room',
    'Cloud Sea': 'Sea of Clouds',
    'Well': '2D Moving Wall',
    'Knucklotec': 'Knucklotec Rematch',
    'Torkdrift': 'Torkdrift Rematch',
    'Mechawiggler': 'Mechawiggler Rematch',
    'Octopus': 'Mollusque-Lanceur Rematch',
    'Cookatiel': 'Cookatiel Rematch',
    'Dragon': 'Lord of Lightning Rematch',
    'Rocket': 'Mario Picture match',
  },
  'Darkside': {
    'Breakdown': 'Revisiting Breakdown Road',
    'Invisible': 'Revisiting Invisible Road ',
    'Vanishing': 'Revisiting Vanishing Road',
    'Yoshi Siege': 'Yoshi Under Siege',
    'Lava Rising': "Yoshi's Sinking Island",
    'Magma Swamp': 'Yoshi in Magma Swamp',
  },
  'Moon': {
    '2D Snowman': '2D Galaxy',
    'Shop': 'Crazy Cap',
    'Swings': 'Giant Swings',
    'Sphynx': 'Sphynx Treasure Room',
  },
  'Cloud': {
    '2D Cube': 'The Cube',
    'Picture Match': 'Goomba Picture Match',
  },
};

function inGameZoneName(kingdom, zone) {
  const byKingdom = IN_GAME_ZONE_NAMES[kingdom];
  return (byKingdom && byKingdom[zone]) ? byKingdom[zone] : '';
}

function buildZoneNamesBody() {
  const body = document.getElementById('zone-names-body');
  if (!body) return;
  body.innerHTML = '';
  for (const [kingdom, data] of Object.entries(LOADING_ZONES_TEMPLATE)) {
    const block = document.createElement('div');
    block.className = 'zn-kingdom';

    const header = document.createElement('div');
    header.className = 'zn-kingdom-header';
    header.style.color = data.color;
    const icon = document.createElement('img');
    icon.src = `assets/${data.icon}`;
    icon.alt = '';
    const name = document.createElement('span');
    name.textContent = kingdom;
    header.appendChild(icon);
    header.appendChild(name);
    block.appendChild(header);

    for (const zone of Object.keys(data.zones)) {
      const wrap = document.createElement('div');
      wrap.className = 'zn-zone';

      // Small gray in-game-name line above the box.
      const ig = document.createElement('span');
      ig.className = 'zn-ingame';
      ig.textContent = inGameZoneName(kingdom, zone); // TODO: real in-game names (see IN_GAME_ZONE_NAMES)
      if (ig.textContent) wrap.appendChild(ig);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'zn-input';
      input.dataset.kingdom = kingdom;
      input.dataset.zone = zone;
      // Placeholder shows the default zone name; value holds any existing custom
      // override so it can be edited (clearing it reverts that zone to default).
      input.placeholder = zone;
      const existing = state.settings.zone_names?.[kingdom]?.[zone];
      input.value = (existing && String(existing).trim()) ? existing : '';
      wrap.appendChild(input);

      block.appendChild(wrap);
    }
    body.appendChild(block);
  }
}

function openZoneNames() {
  buildZoneNamesBody();
  document.getElementById('zone-names-modal').classList.remove('hidden');
  const body = document.getElementById('zone-names-body');
  if (body) body.scrollTop = 0;
}

function saveZoneNames() {
  const overrides = {};
  document.querySelectorAll('#zone-names-body .zn-input').forEach(input => {
    const val = input.value.trim();
    if (!val) return; // empty → default (no override stored)
    const k = input.dataset.kingdom, z = input.dataset.zone;
    (overrides[k] || (overrides[k] = {}))[z] = val;
  });
  state.settings.zone_names = overrides;
  saveState();
  // Reflect the new names anywhere already rendered in this tab (notes modal /
  // side panel is a separate document that updates via the storage event).
  const lzModal = document.getElementById('lz-modal');
  if (lzModal && !lzModal.classList.contains('hidden')) buildLoadingZonesContent();
  document.getElementById('zone-names-modal').classList.add('hidden');
}

// "Use In-Game Names": fill every editable box with its in-game name (where one
// is known). Doesn't save on its own - the user reviews/tweaks, then hits Save -
// so it's non-destructive until then. Boxes with no known in-game name are left
// as-is.
function useInGameNames() {
  if (!confirm('Fill every box with its in-game name? This replaces what\'s currently typed. Nothing is saved until you press Save.')) return;
  document.querySelectorAll('#zone-names-body .zn-input').forEach(input => {
    const nm = inGameZoneName(input.dataset.kingdom, input.dataset.zone);
    if (nm) input.value = nm;
  });
}

function revertZoneNames() {
  if (!confirm('Revert every loading zone name back to its default?')) return;
  state.settings.zone_names = {};
  saveState();
  buildZoneNamesBody(); // repopulate the (now empty) boxes
  const lzModal = document.getElementById('lz-modal');
  if (lzModal && !lzModal.classList.contains('hidden')) buildLoadingZonesContent();
}

// ─────────────────────────────────────────────────────────────────────────────
// Save State download / load
// ─────────────────────────────────────────────────────────────────────────────
// Every localStorage key that makes up a full save, EXCLUDING connection info
// (room code + WS URL), which is intentionally left out of exports/imports.
const SAVE_STATE_KEYS = [
  STATE_KEY,              // tracker + notes
  'smo_map_state', 'smo_map_positions', 'smo_map_sizes', 'smo_map_grid',
  'smo_map_settings', 'smo_edge_chains', 'smo_chain_meta', 'smo_map_notes',   // map
];

function downloadSaveState() {
  const payload = { _type: 'smo-tracker-save', _version: 1, saved_at: new Date().toISOString(), keys: {} };
  SAVE_STATE_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if (v !== null) payload.keys[k] = v; // keep raw JSON strings
  });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smo-tracker-save-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function loadSaveStateFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try { parsed = JSON.parse(reader.result); }
    catch (e) { alert("That file isn't valid JSON, so it can't be loaded as a save state."); return; }
    const keys = parsed && parsed.keys;
    if (!keys || typeof keys !== 'object') {
      alert("That file doesn't look like a tracker save state.");
      return;
    }
    if (!confirm('Load this save state? It overwrites the tracker, notes, and map data on this device (your room/connection settings are left as-is).')) return;
    SAVE_STATE_KEYS.forEach(k => {
      if (Object.prototype.hasOwnProperty.call(keys, k)) {
        try { localStorage.setItem(k, keys[k]); } catch (e) { /* quota / ignore */ }
      }
    });
    // Reload so the tracker, the notes iframe, and the map all re-read fresh data.
    location.reload();
  };
  reader.readAsText(file);
}

function buildKingdomColumn(kingdom, data) {
  const col = document.createElement('div');
  col.className = 'kingdom-col';

  // Header
  const header = document.createElement('div');
  header.className = 'kingdom-col-header';

  const icon = document.createElement('img');
  icon.src = `assets/${data.icon}`;
  icon.height = 20;
  icon.alt = kingdom;

  const title = document.createElement('span');
  title.className = 'col-title';
  title.textContent = kingdom;
  title.style.color = data.color;

  const chevron = document.createElement('span');
  chevron.className = 'col-chevron';
  chevron.textContent = '▾';

  header.appendChild(icon);
  header.appendChild(title);
  header.appendChild(chevron);

  // Build zone entries
  const zoneEntries = Object.entries(data.zones);
  const needsSplit = zoneEntries.length > ZONE_SPLIT_THRESHOLD;

  let zonesRoot; // the element that collapses

  if (needsSplit) {
    const mid = Math.ceil(zoneEntries.length / 2);
    zonesRoot = document.createElement('div');
    zonesRoot.className = 'zones-split-wrap';

    const col1 = document.createElement('div');
    col1.className = 'zones-container';
    const col2 = document.createElement('div');
    col2.className = 'zones-container';

    zoneEntries.slice(0, mid).forEach(([zone, zd]) =>
      col1.appendChild(buildZoneRow(kingdom, zone, zd, data.color)));
    zoneEntries.slice(mid).forEach(([zone, zd]) =>
      col2.appendChild(buildZoneRow(kingdom, zone, zd, data.color)));

    zonesRoot.appendChild(col1);
    zonesRoot.appendChild(col2);
  } else {
    zonesRoot = document.createElement('div');
    zonesRoot.className = 'zones-container';
    zoneEntries.forEach(([zone, zd]) =>
      zonesRoot.appendChild(buildZoneRow(kingdom, zone, zd, data.color)));
  }

  // Apply persisted collapsed state
  if (state.kingdom_collapsed[kingdom]) {
    zonesRoot.style.display = 'none';
    header.classList.add('collapsed');
  }

  // Collapse / expand on header click: persists and triggers a masonry re-layout
  header.addEventListener('click', () => {
    const willCollapse = zonesRoot.style.display !== 'none';
    zonesRoot.style.display = willCollapse ? 'none' : '';
    header.classList.toggle('collapsed', willCollapse);
    state.kingdom_collapsed[kingdom] = willCollapse;
    saveState();
    // layoutMasonryColumns();
  });

  // for (const [zone, zoneData] of Object.entries(data.zones)) {
  //   zonesWrap.appendChild(buildZoneRow(kingdom, zone, zoneData, data.color));
  // }

  col.appendChild(header);
  col.appendChild(zonesRoot);
  return col;
}

function buildZoneRow(kingdom, zone, zoneData, color) {
  const zs = state.loading_zones[kingdom].zones[zone];
  const row = document.createElement('div');
  row.className = 'zone-row';

  // Top row: icon(s) + name
  const top = document.createElement('div');
  top.className = 'zone-row-top';

  function makeZoneIcon(iconKey) {
    const img = document.createElement('img');
    img.className = 'zone-icon';
    img.src = `assets/${zs[iconKey] || 'Moon.png'}`;
    img.alt = 'zone icon';
    img.addEventListener('click', (e) => {
      openIconPicker(e, (chosen) => {
        zs[iconKey] = chosen;
        img.src = `assets/${chosen}`;
        saveState();
      });
      e.stopPropagation();
    });
    return img;
  }

  top.appendChild(makeZoneIcon('icon'));
  if (zoneData.num > 1) top.appendChild(makeZoneIcon('icon2'));

  const nameLabel = document.createElement('span');
  nameLabel.className = 'zone-name';
  nameLabel.textContent = zoneDisplayName(kingdom, zone);
  nameLabel.style.color = zs.collapsed ? '#888' : color;

  top.appendChild(nameLabel);
  row.appendChild(top);

  // Note textarea (hidden when collapsed)
  const noteArea = document.createElement('textarea');
  noteArea.className = 'zone-note';
  noteArea.value = zs.note || '';
  noteArea.placeholder = 'Note…';
  noteArea.rows = 1;
  if (zs.collapsed) noteArea.style.display = 'none';

  // Auto-resize textarea (deferred to the next frame so it can't race
  // the browser's own keystroke/focus handling and kick focus out of
  // the box - see the matching handler in notes.html)
  noteArea.addEventListener('input', () => {
    zs.note = noteArea.value;
    saveState();
    requestAnimationFrame(() => {
      noteArea.style.height = 'auto';
      noteArea.style.height = noteArea.scrollHeight + 'px';
    });
  });

  // Click name to collapse/expand
  nameLabel.addEventListener('click', () => {
    zs.collapsed = !zs.collapsed;
    nameLabel.style.color = zs.collapsed ? '#888' : color;
    noteArea.style.display = zs.collapsed ? 'none' : '';
    saveState();
  });

  row.appendChild(noteArea);
  return row;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notes Horizontal Scroll
// ─────────────────────────────────────────────────────────────────────────────
function isLzOpen() {
  const modal = document.getElementById('lz-modal');
  return modal && !modal.classList.contains('hidden');
}

function setupNotesScroll() {
  const scrollWrap = document.querySelector('.lz-scroll-wrap');
  if (!scrollWrap) return;

  // Mouse wheel → horizontal scroll
  scrollWrap.addEventListener('wheel', (e) => {
    // Only intercept when there is actually horizontal overflow to scroll
    if (scrollWrap.scrollWidth <= scrollWrap.clientWidth) return;
    e.preventDefault();
    const px = state.settings.notes_scroll_px || 500;
    scrollWrap.scrollTo({ left: scrollWrap.scrollLeft + (e.deltaY > 0 ? px : -px), behavior: 'smooth' });
  }, { passive: false });

  // MB4 (back, button=3) → scroll left; MB5 (forward, button=4) → scroll right
  // Block default back/forward navigation when over the scroll wrap
  scrollWrap.addEventListener('mousedown', (e) => {
    const lb = state.settings.scroll_left_binding;
    const rb = state.settings.scroll_right_binding;
    if ((lb && lb.type === 'mouse' && e.button === lb.code) ||
      (rb && rb.type === 'mouse' && e.button === rb.code)) {
      e.preventDefault();
    }
  });
  scrollWrap.addEventListener('mouseup', (e) => {
    const px = state.settings.notes_scroll_px || 500;
    const lb = state.settings.scroll_left_binding;
    const rb = state.settings.scroll_right_binding;
    if (lb && lb.type === 'mouse' && e.button === lb.code) {
      e.preventDefault();
      scrollWrap.scrollTo({ left: scrollWrap.scrollLeft - px, behavior: 'smooth' });
    } else if (rb && rb.type === 'mouse' && e.button === rb.code) {
      e.preventDefault();
      scrollWrap.scrollTo({ left: scrollWrap.scrollLeft + px, behavior: 'smooth' });
    }
  });

  // Configurable keyboard bindings active while the Notes modal is open
  document.addEventListener('keydown', (e) => {
    if (!isLzOpen()) return;
    // Don't hijack typing/cursor movement inside a note textarea
    if (e.target && e.target.classList && e.target.classList.contains('zone-note')) return;

    const px = state.settings.notes_scroll_px || 500;
    const lb = state.settings.scroll_left_binding;
    const rb = state.settings.scroll_right_binding;
    if (lb && lb.type === 'key' && e.code === lb.code) {
      e.preventDefault();
      scrollWrap.scrollTo({ left: scrollWrap.scrollLeft - px, behavior: 'smooth' });
    } else if (rb && rb.type === 'key' && e.code === rb.code) {
      e.preventDefault();
      scrollWrap.scrollTo({ left: scrollWrap.scrollLeft + px, behavior: 'smooth' });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Scroll Button Rebinding
// ─────────────────────────────────────────────────────────────────────────────
function setupRebindButtons() {
  const leftBtn = document.getElementById('rebind-scroll-left');
  const rightBtn = document.getElementById('rebind-scroll-right');

  leftBtn.addEventListener('click', () => startRebind('scroll_left_binding', leftBtn));
  rightBtn.addEventListener('click', () => startRebind('scroll_right_binding', rightBtn));
}

function startRebind(settingKey, btnEl) {
  btnEl.textContent = 'Press any button…';
  btnEl.classList.add('listening');

  function onMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    apply({ type: 'mouse', code: e.button });
  }
  function onKeyDown(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.code === 'Escape') { cancel(); return; }
    apply({ type: 'key', code: e.code });
  }
  function apply(binding) {
    cleanup();
    state.settings[settingKey] = binding;
    btnEl.textContent = bindingLabel(binding);
    btnEl.classList.remove('listening');
    saveState();
  }
  function cancel() {
    cleanup();
    btnEl.textContent = bindingLabel(state.settings[settingKey]);
    btnEl.classList.remove('listening');
  }
  function cleanup() {
    window.removeEventListener('mousedown', onMouseDown, true);
    window.removeEventListener('keydown', onKeyDown, true);
  }

  // Capture phase so this intercepts the input before any other handler
  // (e.g. the notes scrollWrap's own mousedown listener, or page navigation).
  window.addEventListener('mousedown', onMouseDown, true);
  window.addEventListener('keydown', onKeyDown, true);
}

// ─────────────────────────────────────────────────────────────────────────────
// Kingdom Hotkeys
// ─────────────────────────────────────────────────────────────────────────────
// Off by default. With them on:
//   Key          -> add a moon to that kingdom
//   Shift + Key  -> remove one (never below 0)
//   Ctrl + Key   -> multi moon, i.e. +3, same as the multi-moon button
//
// Bindings are KeyboardEvent.code values, which ignore modifiers - so the
// Bowser/Moon defaults ("-" and "+") keep working even though "+" is normally
// typed with Shift.
//
// Note this only works while the tracker tab is focused. Browsers have no way
// to read the keyboard while another window is in front; that needs a real
// desktop app or an AutoHotkey-style script feeding the sync server.

// True while the user is typing somewhere, in which case hotkeys must stay out
// of the way - most importantly the Total Moon Requirement box, but the same
// goes for every note, zone name, room code and scale field.
function isTypingTarget(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function handleHotkey(e) {
  if (!state.settings.hotkeys_enabled) return;
  if (e.altKey || e.metaKey || e.repeat) return;
  if (isTypingTarget(document.activeElement) || isTypingTarget(e.target)) return;

  // Don't fire underneath an open modal - Settings, Hotkeys, Zone Names, etc.
  const modalOpen = Array.from(document.querySelectorAll('.modal-backdrop'))
    .some(m => !m.classList.contains('hidden'));
  if (modalOpen) return;

  const binds = getHotkeys();
  const idx = KINGDOMS.findIndex(k => binds[k.name] === e.code);
  if (idx === -1) return;

  // A kingdom that's switched off in Settings has no row to update.
  const kingdom = KINGDOMS[idx];
  if (kingdom.settingKey && !state.settings[kingdom.settingKey]) return;

  e.preventDefault();
  if (e.ctrlKey) addMulti(idx);
  else if (e.shiftKey) decrement(idx);
  else increment(idx);
  saveState();
}

// ── Hotkeys modal ─────────────────────────────────────────────────
function buildHotkeysList() {
  const list = document.getElementById('hotkeys-list');
  if (!list) return;
  list.innerHTML = '';

  const binds = getHotkeys();
  KINGDOMS.forEach(k => {
    const row = document.createElement('div');
    row.className = 'settings-row hotkey-row';

    const label = document.createElement('span');
    label.textContent = k.name;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rebind-btn hotkey-btn';
    btn.textContent = keyCodeLabel(binds[k.name]);
    btn.addEventListener('click', () => startHotkeyRebind(k.name, btn));

    row.appendChild(label);
    row.appendChild(btn);
    list.appendChild(row);
  });

  updateHotkeysEnablement();
}

// Grey out the bindings while the master toggle is off, so it's obvious they
// aren't doing anything yet (they're still editable).
function updateHotkeysEnablement() {
  const on = !!state.settings.hotkeys_enabled;
  const list = document.getElementById('hotkeys-list');
  if (list) list.classList.toggle('hotkeys-off', !on);
}

function startHotkeyRebind(kingdomName, btnEl) {
  btnEl.textContent = 'Press a key…';
  btnEl.classList.add('listening');

  function onKeyDown(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.code === 'Escape') { finish(null); return; }
    finish(e.code);
  }
  function finish(code) {
    window.removeEventListener('keydown', onKeyDown, true);
    btnEl.classList.remove('listening');
    if (code) {
      const before = getHotkeys();
      if (!state.settings.hotkeys) state.settings.hotkeys = {};
      // A code can only drive one kingdom, so clear it off any other first.
      for (const name of Object.keys(before)) {
        if (name !== kingdomName && before[name] === code) {
          state.settings.hotkeys[name] = '';
        }
      }
      state.settings.hotkeys[kingdomName] = code;
      saveState();
      buildHotkeysList();   // redraw so a stolen binding shows as Not Set
    } else {
      btnEl.textContent = keyCodeLabel(getHotkeys()[kingdomName]);
    }
  }

  window.addEventListener('keydown', onKeyDown, true);
}

function openHotkeys() {
  document.getElementById('toggle-hotkeys').checked = !!state.settings.hotkeys_enabled;
  buildHotkeysList();
  document.getElementById('hotkeys-modal').classList.remove('hidden');
}

// ─────────────────────────────────────────────────────────────────────────────
// Icon Picker
// ─────────────────────────────────────────────────────────────────────────────
function openIconPicker(event, onSelect) {
  document.querySelectorAll('.icon-picker-popup').forEach(p => p.remove());

  const picker = document.createElement('div');
  picker.className = 'icon-picker-popup';

  PICKER_ICONS.forEach(iconFile => {
    const img = document.createElement('img');
    img.src = `assets/${iconFile}`;
    img.alt = iconFile;
    img.title = iconFile.replace('.png', '');
    img.addEventListener('click', (e) => {
      onSelect(iconFile);
      picker.remove();
      e.stopPropagation();
    });
    picker.appendChild(img);
  });

  document.body.appendChild(picker);

  // Position clamp to viewport
  const pw = 170, ph = 90;
  let x = event.clientX, y = event.clientY;
  if (x + pw > window.innerWidth) x = window.innerWidth - pw - 8;
  if (y + ph > window.innerHeight) y = window.innerHeight - ph - 8;
  picker.style.left = `${Math.max(8, x)}px`;
  picker.style.top = `${Math.max(8, y)}px`;

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closePicker(e) {
      if (!picker.contains(e.target)) {
        picker.remove();
        document.removeEventListener('click', closePicker);
      }
    });
  }, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Init wire up all static event listeners once
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Version stamp. If this doesn't appear in the console, or the number is
  // lower than the one apc-data.js prints, the browser is serving a cached
  // copy of a file - hard-refresh with Ctrl+F5.
  console.log('SMO tracker app.js v2');
  loadState();
  buildAllMoonRows();
  buildCaptureRow();
  buildAbilityRow();
  applyAllSettings();
  setupNotesScroll();
  setupRebindButtons();

  // ── Abilities & Captures panel link ────────────
  // apc.html writes to the same localStorage state, then pings this channel so
  // the tracker's icon row (and, through saveState, OBS) follows along.
  if (window.APC) {
    apcLastSignature = apcSignature();
    // apc-data.js delivers over three routes at once (BroadcastChannel,
    // postMessage, storage event) since not every one of them works on every
    // setup, which means a single panel toggle can arrive here as two or
    // three messages back to back. Each one triggers a full rebuild of the
    // capture/ability icon rows, and stacking several of those right after
    // each other (right when the panel is right next to this window) can eat
    // a click the user makes on this side. Coalesce into one rebuild per
    // frame instead.
    let apcRebuildPending = false;
    apcChannel = APC.makeChannel(() => {
      if (apcRebuildPending) return;
      apcRebuildPending = true;
      requestAnimationFrame(() => {
        apcRebuildPending = false;
        onApcChanged();
      });
    });
  }

  // ── Kingdom hotkeys ────────────────────────────
  // Not in capture phase: an input's own handlers should win, and
  // isTypingTarget() bails out for text fields anyway.
  window.addEventListener('keydown', handleHotkey);

  document.getElementById('btn-hotkeys').addEventListener('click', openHotkeys);
  document.getElementById('hotkeys-close').addEventListener('click', () => {
    document.getElementById('hotkeys-modal').classList.add('hidden');
  });
  document.getElementById('toggle-hotkeys').addEventListener('change', (e) => {
    state.settings.hotkeys_enabled = e.target.checked;
    saveState();
    updateHotkeysEnablement();
  });
  document.getElementById('hotkeys-reset').addEventListener('click', () => {
    if (!confirm('Reset every kingdom hotkey back to its default key?')) return;
    state.settings.hotkeys = null;
    saveState();
    buildHotkeysList();
  });

  // ── Main buttons ───────────────────────────────
  document.getElementById('btn-obs').addEventListener('click', openOBS);
  document.getElementById('btn-clear').addEventListener('click', resetAll);
  document.getElementById('btn-settings').addEventListener('click', openSettings);

  // ── Sync UI ────────────────────────────────────
  setupSyncUI();

  // ── OBS Info modal ─────────────────────────────
  document.getElementById('btn-obs-info').addEventListener('click', () => {
    document.getElementById('obs-info-modal').classList.remove('hidden');
  });
  document.getElementById('obs-info-close').addEventListener('click', () => {
    document.getElementById('obs-info-modal').classList.add('hidden');
  });

  // ── Settings modal ─────────────────────────────
  document.getElementById('settings-close').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.add('hidden');
  });

  // ── System tab: Zone Names + Save State ────────
  document.getElementById('btn-zone-names').addEventListener('click', openZoneNames);
  document.getElementById('zn-save').addEventListener('click', saveZoneNames);
  document.getElementById('zn-use-ingame').addEventListener('click', useInGameNames);
  document.getElementById('zn-revert').addEventListener('click', revertZoneNames);
  document.getElementById('btn-download-save').addEventListener('click', downloadSaveState);
  const loadInput = document.getElementById('input-load-save');
  document.getElementById('btn-load-save').addEventListener('click', () => loadInput.click());
  loadInput.addEventListener('change', (e) => {
    loadSaveStateFromFile(e.target.files && e.target.files[0]);
    e.target.value = ''; // allow re-selecting the same file later
  });

  // Toggle switches (data-driven)
  TOGGLE_SETTINGS.forEach(({ id, key }) => {
    document.getElementById(id).addEventListener('change', (e) => {
      state.settings[key] = e.target.checked;

      applyAllSettings();
      saveState();

      // Kingdom show/hide toggles add or remove entire rows/columns rather
      // than just flipping a CSS class, so those need an explicit rebuild.
      if (KINGDOM_ROW_SETTING_KEYS.has(key) ||
          Object.values(KINGDOM_VISIBILITY_SETTINGS).includes(key)) {
        buildAllMoonRows();
        applyAllSettings();
        const lzModal = document.getElementById('lz-modal');
        if (lzModal && !lzModal.classList.contains('hidden')) {
          buildLoadingZonesContent();
        }
      }

      // Painting notes column is added/removed, so rebuild the notes if open.
      if (key === 'show_painting_notes') {
        const lzModal = document.getElementById('lz-modal');
        if (lzModal && !lzModal.classList.contains('hidden')) buildLoadingZonesContent();
      }

      // Some toggles change the OBS overlay's height (Moon-on-OBS, updater) or
      // gate sub-controls, so refresh the size readout and the enable states.
      updateSettingsEnablement();
      updateSyncUI();
    });
  });

  // ── Settings tabs ──────────────────────────────
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      document.querySelectorAll('.settings-tab').forEach(t =>
        t.classList.toggle('active', t === tab));
      document.querySelectorAll('.settings-panel').forEach(p =>
        p.classList.toggle('active', p.dataset.panel === name));
      // Reset scroll so each tab opens at the top
      const body = document.querySelector('#settings-modal .settings-body');
      if (body) body.scrollTop = 0;
    });
  });

  // ── Moon Updater location (segmented) ──────────
  document.querySelectorAll('#seg-updater-location .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#seg-updater-location .seg-btn').forEach(b =>
        b.classList.toggle('active', b === btn));
      state.settings.updater_location = btn.dataset.value;
      saveState();
    });
  });

  // ── Side Panel mode (segmented) ────────────────
  // Off / Notes / Map / Abilities & Captures - only one panel at a time.
  document.querySelectorAll('#seg-panel-mode .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => setPanelMode(btn.dataset.value));
  });

  // ── Side Panel location (segmented) ────────────
  document.querySelectorAll('#seg-panel-location .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#seg-panel-location .seg-btn').forEach(b =>
        b.classList.toggle('active', b === btn));
      state.settings.panel_location = btn.dataset.value;
      saveState();
      applySidePanel(); // Horizontal vs Vertical changes mobile availability too
    });
  });

  // ── Moon Updater message count (select) ────────
  const updaterCountSel = document.getElementById('select-updater-count');
  if (updaterCountSel) {
    updaterCountSel.addEventListener('change', () => {
      const v = parseInt(updaterCountSel.value);
      if (!isNaN(v)) {
        state.settings.updater_count = Math.min(5, Math.max(1, v));
        saveState();
        updateSyncUI(); // count affects overlay height
      }
    });
  }

  // Moon requirement Save
  document.getElementById('save-moon-req').addEventListener('click', () => {
    const v = parseInt(document.getElementById('input-moon-req').value);
    if (!isNaN(v) && v > 0) {
      state.settings.moon_requirement = v;
      saveState();
      // Rescale every kingdom's min/max hint (and green-complete threshold).
      refreshMoonRangeLabels();
      KINGDOMS.forEach((_, i) => updateCountColor(i));
    }
  });

  // Popup scale Save (Browser Source Scale is always derived as 3x this)
  document.getElementById('save-overlay-scale').addEventListener('click', () => {
    const v = parseFloat(document.getElementById('input-overlay-scale').value);
    if (!isNaN(v) && v > 0) {
      state.settings.overlay_scale = v;
      refreshBrowserSourceScaleField(); // update this first so it's never skipped
      saveState();
      updateSyncUI();
    }
  });

  // Live-preview the derived Browser Source Scale as the Popup Scale field
  // is typed into, before it's actually saved.
  document.getElementById('input-overlay-scale').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('input-browser-source-scale').value =
      (!isNaN(v) && v > 0) ? v * BROWSER_SOURCE_MULTIPLIER : getBrowserSourceScale();
  });

  // Sync server URL Save
  document.getElementById('save-ws-url').addEventListener('click', () => {
    const v = document.getElementById('input-ws-url').value.trim();
    saveWsUrl(v);
    // Reconnect if already in a room so the new URL takes effect
    if (window.SMOSync && window.SMOSync.getRoom()) {
      connectRoom();
    }
  });

  // Notes scroll speed Save
  document.getElementById('save-notes-scroll').addEventListener('click', () => {
    const v = parseInt(document.getElementById('input-notes-scroll').value);
    if (!isNaN(v) && v >= 10) {
      state.settings.notes_scroll_px = v;
      saveState();
    }
  });

  // Revert Default Settings
  document.getElementById('btn-revert-settings').addEventListener('click', () => {
    if (!confirm('Revert all settings to default? This will not affect your moon progress, captures, abilities, or notes.')) return;
    state.settings = cloneDefaultSettings();
    saveState();
    applyAllSettings();
    buildAllMoonRows();
    applyAllSettings();
    const lzModal = document.getElementById('lz-modal');
    if (lzModal && !lzModal.classList.contains('hidden')) {
      buildLoadingZonesContent();
    }
    openSettings(); // refresh the visible fields/labels to reflect the reset
  });

  // ── Loading zones modal ────────────────────────
  document.getElementById('lz-close').addEventListener('click', () => {
    document.getElementById('lz-modal').classList.add('hidden');
  });
  document.getElementById('lz-popout').addEventListener('click', popOutNotes);
  document.getElementById('lz-clear-notes').addEventListener('click', clearAllNotes);

  // Close any modal on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.add('hidden');
    });
  });

  // ── Side panel ──────────────────────────────────
  const sidePanelClose = document.getElementById('side-panel-close');
  if (sidePanelClose) {
    sidePanelClose.addEventListener('click', () => setPanelMode('none'));
  }

  // Re-evaluate the panel on resize (debounced) so crossing the mobile
  // breakpoint shows/hides it without needing a settings change.
  let panelResizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(panelResizeTimer);
    panelResizeTimer = setTimeout(applySidePanel, 150);
  });
});