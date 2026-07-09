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
  { name: 'Lost Kingdom', img: 'assets/Lost.png', multi: 'assets/Lost_Multi.png', min: 5, max: 15 },
  { name: 'Metro Kingdom', img: 'assets/Metro.png', multi: 'assets/Metro_Multi.png', min: 15, max: 25 },
  { name: 'Snow Kingdom', img: 'assets/Snow.png', multi: 'assets/Snow_Multi.png', min: 5, max: 15 },
  { name: 'Seaside Kingdom', img: 'assets/Seaside.png', multi: 'assets/Seaside_Multi.png', min: 5, max: 15 },
  { name: 'Luncheon Kingdom', img: 'assets/Luncheon.png', multi: 'assets/Luncheon_Multi.png', min: 13, max: 23 },
  { name: 'Ruined Kingdom', img: 'assets/Ruin.png', multi: 'assets/Ruined_Multi.png', min: 1, max: 8 },
  { name: 'Bowser Kingdom', img: 'assets/Bowser.png', multi: 'assets/Bowser_Multi.png', min: 3, max: 13 },
  // Optional kingdoms: hidden unless their settingKey is turned on in Settings → Kingdoms.
  // To add another one later: give it a settingKey here, add a matching entry to
  // DEFAULT_SETTINGS (default false) and TOGGLE_SETTINGS, then copy a settings-row
  // in index.html's "Kingdoms" section using the same id.
  { name: 'Moon Kingdom', img: 'assets/MoonK.png', multi: 'assets/MoonK_Multi.png', min: 1, max: 1, settingKey: 'show_kingdom_moon' },
];

const CAPTURE_ICONS = [
  { key: 'parabones', locked: 'assets/Parabones_Capture_Locked.png', unlocked: 'assets/Parabones_Capture.png' },
  { key: 'banzai', locked: 'assets/Banzai_Bill_Capture_Locked.png', unlocked: 'assets/Banzai_Bill_Capture.png' },
  { key: 'wire', locked: 'assets/Spark_pylon_Capture_Locked.png', unlocked: 'assets/Spark_pylon_Capture.png' },
  { key: 'bowser', locked: 'assets/Bowser_Capture_Locked.png', unlocked: 'assets/Bowser_Capture.png' },
];

const ABILITY_ICONS = [
  { key: 'jump', locked: 'assets/Long_Jump_Locked.png', unlocked: 'assets/Long_Jump.png' },
  { key: 'cap', locked: 'assets/Cappy_Locked.png', unlocked: 'assets/Cappy.png' },
  { key: 'wall', locked: 'assets/Wall_Jump_Locked.png', unlocked: 'assets/Wall_Jump.png' },
];

const PICKER_ICONS = [
  'Cascade.png', 'Sand.png', 'Lake.png', 'Wooded.png', 'Lost.png', 'Metro.png',
  'Snow.png', 'Seaside.png', 'Luncheon.png', 'Ruin.png', 'Bowser.png',
  'Cap.png', 'Dark.png', 'Star.png','Cloud.png','MoonK.png', "Moon.png", "Moon_Dark.png", "checkmark.png", "xmark.png",
];

const DEFAULT_SETTINGS = {
  show_moon_total: true,
  moon_requirement: 124,
  show_icon_colors: true,
  show_ability_lock: true,
  show_captures: true,
  show_save_buttons: false,
  show_multi_moon: true,
  show_moon_range: true,
  show_complete_color: false,
  show_kingdom_moon: false,
  show_lock: true,             // Lock sign column visible (tracker + overlay)
  show_peace: true,            // Peace sign column visible (tracker + overlay)
  show_ability_jump: false,    // false = Jump icon hidden (default). true = shown
  show_ability_cap: false,     // false = Cap Bounce icon hidden (default). true = shown
  show_moon_obs: true,         // Draw Moon Kingdom on the OBS overlay; only takes
                               // effect while show_kingdom_moon is also on
  show_moon_updater: false,    // Moon Updater message strip on the OBS overlay
  updater_location: 'top',     // 'top' | 'bottom' relative to the overlay body
  updater_count: 3,            // Visible messages (1-5); drives overlay height
  overlay_scale: 1, // Popup Scale default; Browser Source Scale is always 3x this (see getBrowserSourceScale)
  notes_scroll_px: 500,
  scroll_left_binding: { type: 'mouse', code: 3 },  // MB4 (back)
  scroll_right_binding: { type: 'mouse', code: 4 },  // MB5 (forward)
  
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

// ── Per-kingdom min/max scaling ───────────────────────────────────
// Each of the 11 core kingdoms has a "normal" moon count C (out of the default
// total of 124). When the Total Moon Requirement N changes, every normal scales
// by N/124 and its displayed range becomes normal ± 5 (min clamped to >= 1).
// The scaled normals are rounded with the largest-remainder method so they
// always sum to exactly N. The optional Moon Kingdom is left untouched.
const SCALE_KINGDOM_COUNT = 11;
const SCALE_DEFAULT_TOTAL = 124;
const SCALE_RANGE = 5;
// C for each core kingdom, derived from its default max (max = C + range).
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

// Settings toggle definitions for data-driven wiring
const TOGGLE_SETTINGS = [
  { id: 'toggle-moon-total', key: 'show_moon_total' },
  { id: 'toggle-icon-colors', key: 'show_icon_colors' },
  { id: 'toggle-lock', key: 'show_lock' },
  { id: 'toggle-peace', key: 'show_peace' },
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
  { id: 'toggle-moon-updater', key: 'show_moon_updater' },
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
    moons: KINGDOMS.map(() => ({ count: 0, max: null, lock: false, peace: false, multi: false })),
    captures: { parabones: false, banzai: false, wire: false, bowser: false },
    abilities: { jump: false, cap: false, wall: false },
    loading_zones: buildDefaultLoadingZones(),
    kingdom_collapsed: Object.fromEntries(Object.keys(LOADING_ZONES_TEMPLATE).map(k => [k, false])),
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
  } catch (e) {
    console.error('Failed to load state:', e);
    state = getDefaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
  if (!applyingRemote && window.SMOSync && window.SMOSync.getRoom()) {
    window.SMOSync.broadcast(state);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Moon Rows Build
// ─────────────────────────────────────────────────────────────────────────────
function buildAllMoonRows() {
  const container = document.getElementById('moon-rows');
  container.innerHTML = '';
  KINGDOMS.forEach((kingdom, i) => {
    if (kingdom.settingKey && !state.settings[kingdom.settingKey]) return;
    container.appendChild(buildMoonRow(i));
  });
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

  const kingdomImg = document.createElement('img');
  kingdomImg.src = kingdom.img;
  kingdomImg.alt = kingdom.name;
  kingdomImg.className = 'kingdom-icon';
  kingdomImg.title = kingdom.name;

  left.appendChild(lockBtn);
  left.appendChild(peaceBtn);
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

  // The Moon row has no fixed min/max range, but it still needs to reserve
  // the exact same min/max column space as every other row so its −, count,
  // and + land in the same spots. So we keep the identical structure here
  // and just make the min/max boxes invisible instead of removing them.
  if (kingdom.name === 'Moon Kingdom') {
    minStack.style.visibility = 'hidden';
    maxStack.style.visibility = 'hidden';
  }
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
}

// Green-when-complete: count label turns green once count >= max (only while
// a max is actually set), reverts to white if it drops back below.
function updateCountColor(i) {
  const row = getMoonRow(i);
  if (!row) return;
  const m = state.moons[i];
  const kingdom = KINGDOMS[i];
  const label = row.querySelector('.count-label');
  const isComplete = state.settings.show_complete_color && (
    (m.max !== null && m.count >= m.max) ||
    (m.count >= rangeFor(i).max)
  );
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
    const isMoonKingdom = !isNaN(parseInt(row.dataset.idx)) && KINGDOMS[parseInt(row.dataset.idx)]?.name === 'Moon Kingdom';
    // Collapse in sync with every other row when the setting is off, so all
    // entry-groups shrink together and stay aligned. But when the setting is
    // on, the Moon row still needs a multi-moon button-sized box (just
    // invisible) so its entry-group width - and therefore the + button
    // position - matches the other rows instead of expanding past them.
    multiBtn.classList.toggle('hidden', !state.settings.show_multi_moon);
    if (isMoonKingdom) {
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

  function makeAbilityBtn(ic) {
    const btn = document.createElement('button');
    btn.className = 'icon-toggle-btn ability-icon';
    btn.dataset.key = ic.key;
    btn.title = ic.key;
    const img = document.createElement('img');
    img.src = state.abilities[ic.key] ? ic.unlocked : ic.locked;
    img.alt = ic.key;
    btn.appendChild(img);
    btn.classList.toggle('active', state.abilities[ic.key]);
    btn.addEventListener('click', () => {
      state.abilities[ic.key] = !state.abilities[ic.key];
      img.src = state.abilities[ic.key] ? ic.unlocked : ic.locked;
      btn.classList.toggle('active', state.abilities[ic.key]);
      saveState();
    });
    return btn;
  }

  // Layout: [jump][cap] centered on top, [wall] centered below. Jump and Cap
  // can each be hidden independently (Show Jump / Show Cap Bounce settings);
  // applyAllSettings() handles their visibility and re-centering so Wall lines
  // up under whatever remains. ABILITY_ICONS = [jump, cap, wall].
  const top = document.createElement('div');
  top.className = 'ability-top';
  top.appendChild(makeAbilityBtn(ABILITY_ICONS[0])); // jump
  top.appendChild(makeAbilityBtn(ABILITY_ICONS[1])); // cap
  container.appendChild(top);
  container.appendChild(makeAbilityBtn(ABILITY_ICONS[2])); // wall

  // Build the standalone Notes button in #notes-section
  const notesSection = document.getElementById('notes-section');
  notesSection.innerHTML = '';
  const notesBtn = document.createElement('button');
  notesBtn.className = 'notes-btn';
  notesBtn.textContent = 'Loading Zone Notes';
  notesBtn.addEventListener('click', openLoadingZones);
  notesSection.appendChild(notesBtn);
  const mapBtn = document.createElement('button');
  mapBtn.className = 'map-btn';
  mapBtn.textContent = 'Connection Map';
  mapBtn.addEventListener('click', openMap);
  notesSection.appendChild(mapBtn);
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

  // Populate rebind button labels
  document.getElementById('rebind-scroll-left').textContent = bindingLabel(state.settings.scroll_left_binding);
  document.getElementById('rebind-scroll-right').textContent = bindingLabel(state.settings.scroll_right_binding);

  updateSettingsEnablement();
  modal.classList.remove('hidden');
}

// Enable/disable and show/hide sub-controls based on their parent toggle:
//  • Jump / Cap Bounce rows are dimmed while Ability Lock is off.
//  • Updater Location / Message Count rows are dimmed while the updater is off.
//  • The "Show Moon Kingdom on OBS" row is hidden entirely while Moon Kingdom
//    is off (it can only be turned on as a sub-option of Moon Kingdom).
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
}

function applyAllSettings() {
  const s = state.settings;

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

  // Lock / Peace sign columns on the main tracker
  const moonRows = document.getElementById('moon-rows');
  if (moonRows) {
    moonRows.classList.toggle('hide-lock', !s.show_lock);
    moonRows.classList.toggle('hide-peace', !s.show_peace);
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
  state = getDefaultState();
  state.settings = savedSettings;
  saveState();
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
// room for two optional pieces: the extra Moon Kingdom row and the Moon Updater
// message strip. obs.html computes its height with the IDENTICAL formula
// (keep OBS_* constants in sync across both files) so the OBS Browser Source
// dimensions we display here always match what the overlay actually renders.
const OBS_BASE_W = 315;
const OBS_BASE_H = 450;          // 11 kingdoms, no updater
const OBS_MOON_ROW_H = 40;       // added when Moon Kingdom shows on the overlay
const OBS_UPDATER_MSG_H = 24;    // per visible updater message
const OBS_UPDATER_PAD = 12;      // updater strip padding (top + bottom)

function getObsBaseSize(settings) {
  const s = settings || state.settings || {};
  let h = OBS_BASE_H;
  if (s.show_kingdom_moon && s.show_moon_obs !== false) h += OBS_MOON_ROW_H;
  if (s.show_moon_updater) {
    const n = Math.min(5, Math.max(1, s.updater_count || 3));
    h += n * OBS_UPDATER_MSG_H + OBS_UPDATER_PAD;
  }
  // Width is always the tracker-body width. The popup opens at OBS_BASE_W (the
  // updater only widens when the window is dragged out) and the Browser Source
  // estimate is OBS_BASE_W x the 3x browser scale.
  return { w: OBS_BASE_W, h };
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

  // Merge captures / abilities
  if (remote.captures) Object.assign(state.captures, remote.captures);
  if (remote.abilities) Object.assign(state.abilities, remote.abilities);

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

  saveState();
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
}

function disconnectRoom() {
  if (window.SMOSync) window.SMOSync.disconnect();
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

function openMap() {
  const features = 'resizable=yes,toolbar=no,menubar=no';
  mapWindow = window.open('map.html', 'ConnectionMap', features);
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
  const features = 'width=1150,height=750,resizable=yes,scrollbars=yes,toolbar=no,menubar=no';
  notesWindow = window.open('notes.html', 'MoonTrackerNotes', features);
  document.getElementById('lz-modal').classList.add('hidden');
}

function buildLoadingZonesContent() {
  const container = document.getElementById('lz-content');
  container.innerHTML = '';
  for (const [kingdom, data] of Object.entries(state.loading_zones)) {
    const settingKey = KINGDOM_VISIBILITY_SETTINGS[kingdom];
    if (settingKey && !state.settings[settingKey]) continue;
    container.appendChild(buildKingdomColumn(kingdom, data));
  }
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
  saveState();
  buildLoadingZonesContent();
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
  nameLabel.textContent = zone;
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

  // Auto-resize textarea
  noteArea.addEventListener('input', () => {
    noteArea.style.height = 'auto';
    noteArea.style.height = noteArea.scrollHeight + 'px';
    zs.note = noteArea.value;
    saveState();
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
    scrollWrap.scrollLeft += e.deltaY > 0 ? px : -px;
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
      scrollWrap.scrollLeft -= px;
    } else if (rb && rb.type === 'mouse' && e.button === rb.code) {
      e.preventDefault();
      scrollWrap.scrollLeft += px;
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
      scrollWrap.scrollLeft -= px;
    } else if (rb && rb.type === 'key' && e.code === rb.code) {
      e.preventDefault();
      scrollWrap.scrollLeft += px;
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
  loadState();
  buildAllMoonRows();
  buildCaptureRow();
  buildAbilityRow();
  applyAllSettings();
  setupNotesScroll();
  setupRebindButtons();

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

  // Toggle switches (data-driven)
  TOGGLE_SETTINGS.forEach(({ id, key }) => {
    document.getElementById(id).addEventListener('change', (e) => {
      state.settings[key] = e.target.checked;
      applyAllSettings();
      saveState();

      // Kingdom show/hide toggles add or remove entire rows/columns rather
      // than just flipping a CSS class, so those need an explicit rebuild.
      if (Object.values(KINGDOM_VISIBILITY_SETTINGS).includes(key)) {
        buildAllMoonRows();
        applyAllSettings();
        const lzModal = document.getElementById('lz-modal');
        if (lzModal && !lzModal.classList.contains('hidden')) {
          buildLoadingZonesContent();
        }
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
});