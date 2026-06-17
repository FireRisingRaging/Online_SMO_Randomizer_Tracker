'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const STATE_KEY = 'tracker_state';

const KINGDOMS = [
  { name: 'Cascade Kingdom',  img: 'assets/Cascade.png',  multi: 'assets/Cascade_Multi.png'  },
  { name: 'Sand Kingdom',     img: 'assets/Sand.png',     multi: 'assets/Sand_Multi.png'     },
  { name: 'Lake Kingdom',     img: 'assets/Lake.png',     multi: 'assets/Lake_Multi.png'     },
  { name: 'Wooded Kingdom',   img: 'assets/Wooded.png',   multi: 'assets/Wooded_Multi.png'   },
  { name: 'Lost Kingdom',     img: 'assets/Lost.png',     multi: 'assets/Lost_Multi.png'     },
  { name: 'Metro Kingdom',    img: 'assets/Metro.png',    multi: 'assets/Metro_Multi.png'    },
  { name: 'Snow Kingdom',     img: 'assets/Snow.png',     multi: 'assets/Snow_Multi.png'     },
  { name: 'Seaside Kingdom',  img: 'assets/Seaside.png',  multi: 'assets/Seaside_Multi.png'  },
  { name: 'Luncheon Kingdom', img: 'assets/Luncheon.png', multi: 'assets/Luncheon_Multi.png' },
  { name: 'Ruined Kingdom',   img: 'assets/Ruin.png',     multi: 'assets/Ruined_Multi.png'     },
  { name: 'Bowser Kingdom',   img: 'assets/Bowser.png',   multi: 'assets/Bowser_Multi.png'   },
];

const CAPTURE_ICONS = [
  { key: 'parabones', locked: 'assets/Parabones_Capture_Locked.png', unlocked: 'assets/Parabones_Capture.png'      },
  { key: 'banzai',    locked: 'assets/Banzai_Bill_Capture_Locked.png', unlocked: 'assets/Banzai_Bill_Capture.png'  },
  { key: 'wire',      locked: 'assets/Spark_pylon_Capture_Locked.png', unlocked: 'assets/Spark_pylon_Capture.png'  },
  { key: 'bowser',    locked: 'assets/Bowser_Capture_Locked.png',      unlocked: 'assets/Bowser_Capture.png'       },
];

const ABILITY_ICONS = [
  { key: 'jump', locked: 'assets/Long_Jump_Locked.png', unlocked: 'assets/Long_Jump.png' },
  { key: 'cap',  locked: 'assets/Cappy_Locked.png',     unlocked: 'assets/Cappy.png'     },
  { key: 'wall', locked: 'assets/Wall_Jump_Locked.png', unlocked: 'assets/Wall_Jump.png' },
];

const PICKER_ICONS = [
  'Cascade.png','Sand.png','Lake.png','Wooded.png','Lost.png','Metro.png',
  'Snow.png','Seaside.png','Luncheon.png','Ruin.png','Bowser.png',
  'Cap.png','Dark.png','Star.png',"Moon.png","Moon_Dark.png","checkmark.png","xmark.png",
];

const DEFAULT_SETTINGS = {
  show_moon_total:   true,
  moon_requirement:  124,
  show_icon_colors:  true,
  show_ability_lock: true,
  show_captures:     true,
  show_save_buttons: true,
  show_multi_moon:   true,
  obs_bg_color:      '#00FF00',
  notes_scroll_px:   500,
};

// Matches Python tracker_withoutSaves loading_zones dict exactly
const LOADING_ZONES_TEMPLATE = {
  'Cap':        { color:'#fff500', icon:'Cap.png',      zones:{ 'Orange':{num:2},'Paragoomba':{num:2},'Frog':{num:2},'Rolling On':{num:2} }},
  'Cascade':    { color:'#ff9900', icon:'Cascade.png',  zones:{ 'Dino':{num:2},'2D':{num:2},'Chain Chomp':{num:2},'Swings':{num:2},'Windy':{num:2} }},
  'Sand':       { color:'#8bf12c', icon:'Sand.png',     zones:{ 'Icy Cave':{num:1},'Moe-eye':{num:2},'Shop':{num:1},'Employees':{num:1},'Slots':{num:1},'Rumble':{num:1},'Costume':{num:1},'Jaxi Ruins':{num:2},'Bullet Bill':{num:2},'Gushen':{num:2},'Sphynx':{num:1},'Poison':{num:2},'Rocket':{num:2},'Colossal Ruins':{num:2} }},
  'Lake':       { color:'#e46cab', icon:'Lake.png',     zones:{ 'Frog':{num:2},'Zipper':{num:2},'Grab Climb':{num:2},'Shop':{num:1},'Puzzle':{num:1} }},
  'Wooded':     { color:'#1e65e7', icon:'Wooded.png',   zones:{ 'Rocket':{num:2},'Sheep':{num:2},'Elevator':{num:2},'Poison':{num:2},'Clouds':{num:2},'Breakdown':{num:2},'Invisible':{num:2},'Costume':{num:2},'Flooded Pipes':{num:2},'Flower Road':{num:2} }},
  'Lost':       { color:'#e71edd', icon:'Lost.png',     zones:{ 'Wiggler':{num:2},'Shop':{num:1},'Klepto':{num:2} }},
  'Metro':      { color:'#de7d5e', icon:'Metro.png',    zones:{ 'Yellow Shop':{num:1},'Purple Shop':{num:1},'Dino':{num:2},'Bullet Billding':{num:2},'Shards':{num:2},'Notes':{num:1},'2D':{num:2},'Slots':{num:1},'People':{num:2},'Costume':{num:2},'Rocket':{num:2},'Dark':{num:2},'Scaffolding':{num:2},'Scooter':{num:2},'Rotating Maze':{num:2},'RC Car':{num:1} }},
  'Snow':       { color:'#e7930a', icon:'Snow.png',     zones:{ 'Puzzle':{num:1},'Capless':{num:2},'Rocket Flower':{num:2},'Iceburn':{num:2},'Flower Road':{num:2},'Tracewalking':{num:1},'Clouds':{num:2},'Costume':{num:2},'Shop':{num:1} }},
  'Seaside':    { color:'#b36fe9', icon:'Seaside.png',  zones:{ 'Well Enter':{num:1},'Well Exit':{num:1},'Rumble':{num:1},'Rocket':{num:2},'Costume':{num:1},'Gushen':{num:2},'Sphynx':{num:1},'Pokio':{num:2},'Lava Rising':{num:2},'Sandy Bottom':{num:1},'Spinning Maze':{num:2} }},
  'Luncheon':   { color:'#3fddbb', icon:'Luncheon.png', zones:{ 'Magma Swamp':{num:2},'Forks':{num:2},'Cheese Rocks':{num:2},'Veggie Room':{num:1},'Slots':{num:1},'Shop':{num:1},'Costume':{num:1},'Spinning Athletics':{num:2},'Lava Islands':{num:2},'Volcano Cave':{num:2},'Gears':{num:2},'Magma Path':{num:2} }},
  'Ruined':     { color:'#ffd7e2', icon:'Ruin.png',     zones:{ "Chargin' Chuck":{num:2},'Rocket':{num:2} }},
  "Bowser's":   { color:'#d3304c', icon:'Bowser.png',   zones:{ 'Jizo':{num:2},'Shop':{num:1},'Costume':{num:2},'Treasure Room':{num:1},'Spinning Tower':{num:2},'Clouds':{num:2},'Hexagon Tower':{num:2},'Wooden Tower':{num:2} }},
  'Mushroom':   { color:'#fff672', icon:'Star.png',     zones:{ 'Costume':{num:2},'Cloud Sea':{num:2},'Well':{num:2},'Knucklotec':{num:1},'Torkdrift':{num:1},'Mechawiggler':{num:1},'Octopus':{num:1},'Cookatiel':{num:1},'Dragon':{num:1},'Rocket':{num:2} }},
  'Darkside':   { color:'#fff2c6', icon:'Dark.png',     zones:{ 'Breakdown':{num:2},'Invisible':{num:2},'Vanishing':{num:2},'Yoshi Siege':{num:2},'Lava Rising':{num:2},'Magma Swamp':{num:2} }},
  'Darkerside': { color:'#fff2c6', icon:'Dark.png',     zones:{ 'End':{num:1} }},
};

// Number of zones above which a kingdom column auto-splits into two side-by-side columns
const ZONE_SPLIT_THRESHOLD = 10;

// Settings toggle definitions for data-driven wiring
const TOGGLE_SETTINGS = [
  { id: 'toggle-moon-total',   key: 'show_moon_total'   },
  { id: 'toggle-icon-colors',  key: 'show_icon_colors'  },
  { id: 'toggle-ability-lock', key: 'show_ability_lock' },
  { id: 'toggle-captures',     key: 'show_captures'     },
  { id: 'toggle-save-buttons', key: 'show_save_buttons' },
  { id: 'toggle-multi-moon',   key: 'show_multi_moon'   },
];

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────
let state = {};

function buildDefaultLoadingZones() {
  const result = {};
  for (const [kingdom, data] of Object.entries(LOADING_ZONES_TEMPLATE)) {
    result[kingdom] = { color: data.color, icon: data.icon, zones: {} };
    for (const [zone, zd] of Object.entries(data.zones)) {
      result[kingdom].zones[zone] = { note:'', icon:'Moon.png', icon2:'Moon.png', collapsed:false, num: zd.num };
    }
  }
  return result;
}

function getDefaultState() {
  return {
    settings:      { ...DEFAULT_SETTINGS },
    moons:         KINGDOMS.map(() => ({ count:0, max:null, lock:false, peace:false, multi:false })),
    captures:      { parabones:false, banzai:false, wire:false, bowser:false },
    abilities:     { jump:false, cap:false, wall:false },
    loading_zones: buildDefaultLoadingZones(),
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
    if (saved.captures)  Object.assign(state.captures,  saved.captures);
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Moon Rows Build
// ─────────────────────────────────────────────────────────────────────────────
function buildAllMoonRows() {
  const container = document.getElementById('moon-rows');
  container.innerHTML = '';
  KINGDOMS.forEach((_, i) => container.appendChild(buildMoonRow(i)));
}

function buildMoonRow(i) {
  const kingdom = KINGDOMS[i];
  const row = document.createElement('div');
  row.className = 'moon-row';
  row.dataset.idx = i;

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

  // ── Counter group: − label + ──
  const counter = document.createElement('div');
  counter.className = 'moon-row-counter';

  const decrBtn = document.createElement('button');
  decrBtn.className = 'count-btn decr-btn';
  decrBtn.textContent = '−';
  decrBtn.addEventListener('click', () => { decrement(i); saveState(); });

  const countLabel = document.createElement('span');
  countLabel.className = 'count-label';

  const incrBtn = document.createElement('button');
  incrBtn.className = 'count-btn incr-btn';
  incrBtn.textContent = '+';
  incrBtn.addEventListener('click', () => { increment(i); saveState(); });

  counter.appendChild(decrBtn);
  counter.appendChild(countLabel);
  counter.appendChild(incrBtn);

  // ── Entry group: max field + save ──
  const entryGroup = document.createElement('div');
  entryGroup.className = 'moon-row-entry';

  // Multi-moon toggle — sits right after + before the entry field
  const multiBtn = document.createElement('button');
  multiBtn.className = 'multi-moon-btn';
  multiBtn.title = `Multi Moon (+3 / −3)`;
  const multiImg = document.createElement('img');
  multiImg.src = kingdom.multi;
  multiImg.alt = 'Multi Moon';
  multiBtn.appendChild(multiImg);
  // Apply initial off state
  if (!state.moons[i].multi) multiBtn.classList.add('multi-off');
  // Apply settings visibility
  if (!state.settings.show_multi_moon) multiBtn.classList.add('hidden');
  multiBtn.addEventListener('click', () => { toggleMulti(i); saveState(); });

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

  // Multi moon button state
  const multiBtn = row.querySelector('.multi-moon-btn');
  multiBtn.classList.toggle('multi-off', !m.multi);
  multiBtn.classList.toggle('hidden', !state.settings.show_multi_moon);

  // Save button visibility
  row.querySelector('.save-btn').classList.toggle('hidden', !state.settings.show_save_buttons);
}

// ── Moon actions ──────────────────────────────────────────────────
function increment(i) { state.moons[i].count++; refreshCountLabel(i); }
function decrement(i) { state.moons[i].count = Math.max(0, state.moons[i].count - 1); refreshCountLabel(i); }

function toggleMulti(i) {
  const m = state.moons[i];
  if (m.multi) {
    // Turning off — subtract 3 (can't go below 0)
    m.count = Math.max(0, m.count - 3);
    m.multi = false;
  } else {
    // Turning on — add 3
    m.count += 3;
    m.multi = true;
  }
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

  // Grid order mirrors Python: [jump][cap] / [notes][wall]
  const slots = [
    { type: 'ability', def: ABILITY_ICONS[0] },  // jump  - row 0, col 0
    { type: 'ability', def: ABILITY_ICONS[1] },  // cap   - row 0, col 1
    { type: 'notes'  },                          // notes - row 1, col 0
    { type: 'ability', def: ABILITY_ICONS[2] },  // wall  - row 1, col 1
  ];

  slots.forEach(slot => {
    if (slot.type === 'notes') {
      const btn = document.createElement('button');
      btn.className = 'notes-btn';
      btn.textContent = 'Notes';
      btn.addEventListener('click', openLoadingZones);
      container.appendChild(btn);
    } else {
      const ic = slot.def;
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
      container.appendChild(btn);
    }
  });
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
  document.getElementById('input-obs-color').value = state.settings.obs_bg_color;
  document.getElementById('input-notes-scroll').value = state.settings.notes_scroll_px;
  modal.classList.remove('hidden');
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

  // Ability icons (Notes button stays)
  document.querySelectorAll('.ability-icon').forEach(btn => {
    btn.classList.toggle('hidden', !s.show_ability_lock);
  });

  // Multi moon buttons
  document.querySelectorAll('.multi-moon-btn').forEach(btn => {
    btn.classList.toggle('hidden', !s.show_multi_moon);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Reset
// ─────────────────────────────────────────────────────────────────────────────
function resetAll() {
  if (!confirm('Clear all progress? Settings will be kept.')) return;
  const savedSettings = { ...state.settings };
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

function openOBS() {
  const features = 'width=315,height=450,resizable=yes,scrollbars=no,toolbar=no,menubar=no';
  if (!obsWindow || obsWindow.closed) {
    obsWindow = window.open('obs.html', 'MoonTrackerOBS', features);
  } else {
    obsWindow.focus();
  }
}

function toggleOBSBg() {
  // obs.html listens for this storage event to toggle its background
  localStorage.setItem('obs_bg_toggle', Date.now().toString());
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading Zones Modal
// ─────────────────────────────────────────────────────────────────────────────
function openLoadingZones() {
  buildLoadingZonesContent();
  document.getElementById('lz-modal').classList.remove('hidden');
}

function buildLoadingZonesContent() {
  const container = document.getElementById('lz-content');
  container.innerHTML = '';
  for (const [kingdom, data] of Object.entries(state.loading_zones)) {
    container.appendChild(buildKingdomColumn(kingdom, data));
  }
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
  const needsSplit  = zoneEntries.length > ZONE_SPLIT_THRESHOLD;

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

  header.addEventListener('click', () => {
    const isCollapsed = zonesRoot.style.display === 'none';
    zonesRoot.style.display = isCollapsed ? '' : 'none';
    header.classList.toggle('collapsed', !isCollapsed);
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
    if (e.button === 3 || e.button === 4) e.preventDefault();
  });
  scrollWrap.addEventListener('mouseup', (e) => {
    const px = state.settings.notes_scroll_px || 500;
    if (e.button === 3) {
      e.preventDefault();
      scrollWrap.scrollLeft -= px;
    } else if (e.button === 4) {
      e.preventDefault();
      scrollWrap.scrollLeft += px;
    }
  });
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
  if (x + pw > window.innerWidth)  x = window.innerWidth - pw - 8;
  if (y + ph > window.innerHeight) y = window.innerHeight - ph - 8;
  picker.style.left = `${Math.max(8, x)}px`;
  picker.style.top  = `${Math.max(8, y)}px`;

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

  // ── Main buttons ───────────────────────────────
  document.getElementById('btn-obs').addEventListener('click', openOBS);
  document.getElementById('btn-toggle-obs-bg').addEventListener('click', toggleOBSBg);
  document.getElementById('btn-clear').addEventListener('click', resetAll);
  document.getElementById('btn-settings').addEventListener('click', openSettings);

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
    });
  });

  // Moon requirement Save
  document.getElementById('save-moon-req').addEventListener('click', () => {
    const v = parseInt(document.getElementById('input-moon-req').value);
    if (!isNaN(v) && v > 0) {
      state.settings.moon_requirement = v;
      saveState();
    }
  });

  // OBS BG color Save
  document.getElementById('save-obs-color').addEventListener('click', () => {
    const v = document.getElementById('input-obs-color').value.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
      state.settings.obs_bg_color = v;
      saveState();
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

  // ── Loading zones modal ────────────────────────
  document.getElementById('lz-close').addEventListener('click', () => {
    document.getElementById('lz-modal').classList.add('hidden');
  });

  // Close any modal on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.add('hidden');
    });
  });
});
