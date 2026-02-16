// ============================================================
// NETWORK STATE
// ============================================================
let isOnline = false;
let ws = null;
let myPlayerNum = null;
let myToken = null;
let myRoomCode = null;
let serverState = null; // Last state from server
let isReplayingEvents = false;
// useOptBoostThisAttack removed — optBoost now handled by shared game-logic via action.useOptBoost


// TYPE_COLORS and TYPE_PARTICLE_COLORS now come from shared/constants.js (Constants global)
const TYPE_COLORS = Constants.TYPE_COLORS;
const TYPE_PARTICLE_COLORS = Constants.TYPE_PARTICLE_COLORS;


// POKEMON_DB and ITEM_DB now come from shared modules (PokemonDB, ItemDB globals)
// Merge pokemon-data.js overrides into the shared DB
if (window.POKEMON_DATA) PokemonDB.mergeStatOverrides(window.POKEMON_DATA);
const POKEMON_DB = PokemonDB.POKEMON_DB;
const ITEM_DB = ItemDB.ITEM_DB;

// Legacy: keep a few lines so line references don't shift too much
// (All original Pokemon/Item data removed — now in shared/pokemon-db.js and shared/item-db.js)
void 0; // placeholder


// ============================================================
// GAME ENGINE
// ============================================================
const G = {
  phase:'deckBuildP1', currentPlayer:1, turn:0,
  players: {
    1: { name:'Player 1', mana:0, kos:0, deck:[], hand:[], active:null, bench:[], usedAbilities:{}, maxBench:Constants.MAX_BENCH },
    2: { name:'Player 2', mana:0, kos:0, deck:[], hand:[], active:null, bench:[], usedAbilities:{}, maxBench:Constants.MAX_BENCH },
  },
  log: [],
  events: [], // Event array used by shared game-logic
  targeting: null,
  animating: false,
  pendingRetreats: [],
  selectedCard: null, // {playerNum, benchIdx} where benchIdx=-1 means active
};

// AnimQueue progressive replay mutates window.G during hot-seat animations.
// Ensure the shared singleton is exposed on window so HP/energy/status updates
// apply immediately instead of waiting until final-state restore.
if (typeof window !== 'undefined') window.G = G;

// Track previous HP percentages for smooth bar transitions
const prevHpPct = {};

// Anti-softlock watchdog: track when G.animating was last set true
let lastAnimatingSetAt = 0;
const ANIMATING_TIMEOUT_MS = 4000; // 4 seconds max for any animation sequence

// Override G.animating with a getter/setter to track timing
let _animating = false;
Object.defineProperty(G, 'animating', {
  get() { return _animating; },
  set(val) {
    _animating = val;
    if (val) lastAnimatingSetAt = Date.now();
  },
  enumerable: true, configurable: true
});

// Watchdog: runs every 2s, force-clears stuck animating state
setInterval(() => {
  if (G.phase !== 'battle' || G.winner) return;
  if (!_animating) return;
  const elapsed = Date.now() - lastAnimatingSetAt;
  if (elapsed > ANIMATING_TIMEOUT_MS && !G.targeting && G.pendingRetreats.length === 0) {
    console.warn('[Softlock watchdog] G.animating stuck for ' + elapsed + 'ms, force-clearing');
    _animating = false;
    renderBattle();
  }
}, 2000);

function getImg(name) {
  const b64 = CARD_IMAGES[name];
  if (b64) return 'data:image/png;base64,' + b64;
  if (!name) return '';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return 'cards/' + slug + '.png';
}

function getPokemonData(name) { return POKEMON_DB.find(p => p.name === name); }
function getItemData(name) { return ITEM_DB.find(i => i.name === name); }
function isNeutralizingGasActive() {
  // Check if any Pokemon in play has Neutralizing Gas
  const all = [G.players[1].active, ...G.players[1].bench, G.players[2].active, ...G.players[2].bench].filter(Boolean);
  return all.some(pk => { const d = getPokemonData(pk.name); return d.ability && d.ability.key === 'neutralizingGas'; });
}
function isPassiveBlocked() { return isNeutralizingGasActive(); }

// Delegate to shared module (adds types/weakness/resistance fields needed by game-logic)
function makePokemon(name, heldItem) { return GameLogic.makePokemon(name, heldItem); }

function opp(p) { return p === 1 ? 2 : 1; }
function cp() { return G.players[G.currentPlayer]; }
function op() { return G.players[opp(G.currentPlayer)]; }
// For rendering: me() is always the local player, them() is always the opponent
// _replayPov overrides the POV during offline animation replay so the view
// stays from the acting player's perspective until the switch_turn event fires.
window._replayPov = null;
function me() { return isOnline ? G.players[myPlayerNum] : G.players[window._replayPov || G.currentPlayer]; }
function them() { return isOnline ? G.players[opp(myPlayerNum)] : G.players[opp(window._replayPov || G.currentPlayer)]; }
function meNum() { return isOnline ? myPlayerNum : (window._replayPov || G.currentPlayer); }
function themNum() { return isOnline ? opp(myPlayerNum) : opp(window._replayPov || G.currentPlayer); }
function isMyTurn() { return !isOnline || G.currentPlayer === myPlayerNum; }

function addLog(text, cls='') {
  G.log.unshift({text, cls, turn: G.turn});
  if (G.log.length > 100) G.log.pop();
}

// ============================================================
// UTILITY / ANIMATION HELPERS
// ============================================================
const delay = ms => new Promise(r => setTimeout(r, ms));

function animateEl(selector, className, duration) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), duration);
}

function showTurnOverlay(text) {
  const overlay = document.createElement('div');
  overlay.className = 'turn-overlay';
  overlay.innerHTML = `<div class="turn-overlay-text">${text}</div>`;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 1000);
}

// Positioned damage popup near a target element
function showDamagePopupAt(amount, targetSelector, isHeal) {
  const target = document.querySelector(targetSelector);
  const el = document.createElement('div');
  el.className = 'damage-popup' + (isHeal ? ' heal' : '');
  el.textContent = (isHeal ? '+' : '-') + amount;
  if (target) {
    const rect = target.getBoundingClientRect();
    el.style.left = rect.left + rect.width / 2 + 'px';
    el.style.top = rect.top + rect.height * 0.3 + 'px';
  } else {
    el.style.left = '50%';
    el.style.top = '35%';
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

// Particle burst effect
function spawnParticles(x, y, color, count, opts = {}) {
  let container = document.querySelector('.particle-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'particle-container';
    document.body.appendChild(container);
  }
  const size = opts.size || 6;
  const spread = opts.spread || 60;
  const duration = opts.duration || 600;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const dx = (Math.random() - 0.5) * spread * 2;
    const dy = (Math.random() - 0.5) * spread * 2;
    p.style.cssText = `left:${x}px;top:${y}px;width:${size + Math.random()*4}px;height:${size + Math.random()*4}px;background:${color};--dx:${dx}px;--dy:${dy}px;animation:particleFly ${duration + Math.random()*200}ms ease-out forwards;animation-delay:${Math.random()*100}ms;`;
    container.appendChild(p);
    setTimeout(() => p.remove(), duration + 400);
  }
}

// Spawn particles at a DOM element
function spawnParticlesAtEl(selector, color, count, opts = {}) {
  const el = document.querySelector(selector);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, color, count, opts);
}

// Get selector for a pokemon's field slot
function getPokemonSelector(playerNum, benchIdx) {
  const side = playerNum === meNum() ? '#youField' : '#oppField';
  if (benchIdx === -1) return side + ' .active-slot';
  return side + ' .field-bench-row > :nth-child(' + (benchIdx + 1) + ')';
}

// Find which slot a pokemon is in, return CSS selector.
// Accepts either a pokemon object or a pokemon name string (events use name strings).
function findPokemonSelector(pokemon) {
  for (let pNum = 1; pNum <= 2; pNum++) {
    const p = G.players[pNum];
    if (p.active) {
      if (p.active === pokemon || p.active.name === pokemon) return getPokemonSelector(pNum, -1);
    }
    for (let i = 0; i < p.bench.length; i++) {
      if (p.bench[i] === pokemon || p.bench[i].name === pokemon) return getPokemonSelector(pNum, i);
    }
  }
  return null;
}

// Snapshot all pokemon HP% before render
let _hpPreCaptured = false; // Flag: true when replay pre-captured HP before damage
function captureHpState() {
  for (let pNum = 1; pNum <= 2; pNum++) {
    const p = G.players[pNum];
    if (p.active) prevHpPct[pNum + '-active'] = Math.max(0, (p.active.hp / p.active.maxHp) * 100);
    p.bench.forEach((pk, i) => { prevHpPct[pNum + '-bench-' + i] = Math.max(0, (pk.hp / pk.maxHp) * 100); });
  }
}

// After innerHTML rebuild, animate HP bars from old to new values
function animateHpBars() {
  for (let pNum = 1; pNum <= 2; pNum++) {
    const side = pNum === meNum() ? '#youField' : '#oppField';
    const p = G.players[pNum];
    if (p.active) {
      const key = pNum + '-active';
      const fill = document.querySelector(side + ' .active-slot .fp-hp-fill');
      if (fill && prevHpPct[key] !== undefined) {
        const newPct = Math.max(0, (p.active.hp / p.active.maxHp) * 100);
        if (Math.abs(prevHpPct[key] - newPct) > 0.5) {
          fill.style.width = prevHpPct[key] + '%';
          requestAnimationFrame(() => { requestAnimationFrame(() => { fill.style.width = newPct + '%'; }); });
        }
      }
    }
    p.bench.forEach((pk, i) => {
      const key = pNum + '-bench-' + i;
      const fill = document.querySelector(side + ' .field-bench-row > :nth-child(' + (i + 1) + ') .fp-hp-fill');
      if (fill && prevHpPct[key] !== undefined) {
        const newPct = Math.max(0, (pk.hp / pk.maxHp) * 100);
        if (Math.abs(prevHpPct[key] - newPct) > 0.5) {
          fill.style.width = prevHpPct[key] + '%';
          requestAnimationFrame(() => { requestAnimationFrame(() => { fill.style.width = newPct + '%'; }); });
        }
      }
    });
  }
}

// Energy gain popup (yellow)
function showEnergyPopup(targetSelector, text) {
  const target = document.querySelector(targetSelector);
  const el = document.createElement('div');
  el.className = 'damage-popup energy-popup';
  el.textContent = text;
  if (target) {
    const rect = target.getBoundingClientRect();
    el.style.left = (rect.left + rect.width / 2) + 'px';
    el.style.top = (rect.top + rect.height * 0.3) + 'px';
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

// Mana gain popup (cyan)
function showManaPopup(amount) {
  const manaEl = document.querySelector('.mana-display');
  const el = document.createElement('div');
  el.className = 'damage-popup mana-popup';
  el.textContent = '+' + amount + ' Mana';
  if (manaEl) {
    const rect = manaEl.getBoundingClientRect();
    el.style.left = (rect.left + rect.width / 2) + 'px';
    el.style.top = (rect.top - 20) + 'px';
  } else {
    el.style.left = '50%';
    el.style.top = '80%';
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

function showManaPopupForPlayer(playerNum, amount) {
  const side = playerNum === meNum() ? '#youField' : '#oppField';
  const target = document.querySelector(side + ' .fp-name');
  const el = document.createElement('div');
  el.className = 'damage-popup mana-popup';
  el.textContent = '+' + amount + ' ⬡';
  if (target) {
    const rect = target.getBoundingClientRect();
    el.style.left = (rect.left + rect.width / 2) + 'px';
    el.style.top = (rect.top + rect.height * 0.4) + 'px';
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

// TYPE_PARTICLE_COLORS now imported from shared/constants.js at top of file

// ============================================================
// ANIMATION CONTEXT & ACTION DISPATCH BRIDGE
// ============================================================
// This bridges the shared game-logic (event-driven, no DOM) with
// the client's animation system. All offline actions go through
// dispatchAction() which calls GameLogic.processAction() then
// replays events through AnimQueue.
// ============================================================

const animCtx = {
  renderBattle: () => renderBattle(),
  delay: ms => new Promise(r => setTimeout(r, ms)),
  animateEl,
  spawnParticlesAtEl,
  showDamagePopup: (amount, mult, sel) => showDamagePopup(amount, mult, sel),
  showDamagePopupAt,
  showEnergyPopup,
  showManaPopup,
  showManaPopupForPlayer,
  showTurnOverlay,
  focusOnActives,
  getPokemonSelector,
  findPokemonSelector,
  captureHpState: () => { captureHpState(); _hpPreCaptured = true; },
  TYPE_PARTICLE_COLORS,
};

/**
 * Central dispatch for offline (hot-seat) actions.
 * Calls GameLogic.processAction(), collects events, replays them with animations.
 * Returns a Promise that resolves when all animations are done.
 */
function dispatchAction(action) {
  if (G.animating) return;
  G.animating = true;
  G.events = [];
  const playerNum = action._playerNum || G.currentPlayer;

  // Lock the POV to the acting player so animations render from their
  // perspective. The switch_turn animation handler will update _replayPov
  // to the new player when it fires (see animation.js).
  if (!isOnline) window._replayPov = playerNum;

  // Snapshot the game state BEFORE processing so we can render from the
  // pre-action state during animation replay. processAction mutates G
  // synchronously (deals damage, KOs, switches turns) but we want the
  // animations to show those changes progressively.
  const snapshot = snapshotGameState();

  const result = GameLogic.processAction(G, playerNum, action);
  const events = G.events.slice(); // copy
  G.events = [];

  if (!result && events.length === 0) {
    window._replayPov = null;
    G.animating = false;
    return;
  }

  // Save the final (post-action) state, restore the pre-action snapshot
  // so animations render progressively. The online replayEvents path
  // does the same thing (defers state update until after replay).
  const finalState = snapshotGameState();
  restoreGameState(snapshot);

  // Replay events through animation queue
  AnimQueue.replayEvents(events, animCtx);
  AnimQueue.setOnDrain(() => {
    // Restore the real final state now that animations are done
    restoreGameState(finalState);
    window._replayPov = null;
    G.animating = false;
    // Check win
    if (G.winner) {
      showWin(G.winner);
    }
    renderBattle();
  });
}

// Snapshot/restore helpers for animation replay.
// Only captures the fields that change during processAction and affect rendering.
function snapshotGameState() {
  const snap = {
    currentPlayer: G.currentPlayer,
    turn: G.turn,
    winner: G.winner,
    extraTurnFor: G.extraTurnFor,
    targeting: G.targeting,
    pendingRetreats: G.pendingRetreats.slice(),
    log: G.log.slice(),
    players: {}
  };
  for (let pNum = 1; pNum <= 2; pNum++) {
    const p = G.players[pNum];
    snap.players[pNum] = {
      mana: p.mana,
      kos: p.kos,
      maxBench: p.maxBench,
      active: p.active ? Object.assign({}, p.active) : null,
      bench: p.bench.map(pk => Object.assign({}, pk)),
      hand: p.hand.slice(),
      usedAbilities: Object.assign({}, p.usedAbilities),
    };
  }
  return snap;
}

function restoreGameState(snap) {
  G.currentPlayer = snap.currentPlayer;
  G.turn = snap.turn;
  G.winner = snap.winner;
  G.extraTurnFor = snap.extraTurnFor;
  G.targeting = snap.targeting;
  G.pendingRetreats = snap.pendingRetreats;
  G.log = snap.log;
  for (let pNum = 1; pNum <= 2; pNum++) {
    const sp = snap.players[pNum];
    G.players[pNum].mana = sp.mana;
    G.players[pNum].kos = sp.kos;
    G.players[pNum].maxBench = sp.maxBench || Constants.MAX_BENCH;
    G.players[pNum].active = sp.active;
    G.players[pNum].bench = sp.bench;
    G.players[pNum].hand = sp.hand;
    G.players[pNum].usedAbilities = sp.usedAbilities;
  }
}

// Get shake class based on damage amount
function getShakeClass(damage) {
  if (damage >= 100) return 'hit-shake-massive';
  if (damage >= 50) return 'hit-shake-heavy';
  return 'hit-shake';
}
function getShakeDuration(damage) {
  if (damage >= 100) return 900;
  if (damage >= 50) return 700;
  return 500;
}

// Get damage popup size class
function getDmgPopupClass(damage) {
  if (damage >= 100) return 'dmg-massive';
  if (damage >= 50) return 'dmg-heavy';
  return '';
}

// Center the battle field view on both active Pokemon
function focusOnActives() {
  const field = document.querySelector('.battle-field');
  if (!field) return;
  const oppSlot = document.querySelector('#oppField .active-slot');
  const youSlot = document.querySelector('#youField .active-slot');
  if (!oppSlot || !youSlot) return;
  const fieldRect = field.getBoundingClientRect();
  const oppRect = oppSlot.getBoundingClientRect();
  const youRect = youSlot.getBoundingClientRect();
  // Midpoint between the two actives relative to the field
  const midY = ((oppRect.top + oppRect.bottom) / 2 + (youRect.top + youRect.bottom) / 2) / 2;
  const fieldMidY = fieldRect.top + fieldRect.height / 2;
  const scrollAdjust = midY - fieldMidY;
  field.scrollBy({ top: scrollAdjust, behavior: 'smooth' });
}


// ============================================================
// GAME LOGIC NOW HANDLED BY SHARED MODULES
// ============================================================
// calcDamage, dealDamage, handleKO, checkWeaknessPolicy,
// calcWeaknessResistance, startTurn, endTurn, switchTurn
// All now live in shared/game-logic.js and shared/damage-pipeline.js.
// The dispatchAction() function above calls GameLogic.processAction()
// and replays returned events through AnimQueue.replayEvents().
// ============================================================


// ============================================================
// ACTIONS
// ============================================================
function actionGrantEnergy(target) {
  if (G.animating) return;
  // Find target slot info
  const myP = isOnline ? me() : cp();
  let targetSlot, benchIdx;
  if (target === myP.active) { targetSlot = 'active'; benchIdx = null; }
  else { targetSlot = 'bench'; benchIdx = myP.bench.indexOf(target); }
  if (isOnline) { sendAction({ actionType: 'grantEnergy', targetSlot, benchIdx }); return; }
  dispatchAction({ type: 'grantEnergy', targetSlot, benchIdx });
}

// ============================================================
// OFFLINE ACTION DISPATCHERS
// ============================================================
// These thin wrappers handle online vs offline routing.
// Online: sendAction() to server. Offline: dispatchAction() to shared game-logic.
// ============================================================


// Copied attacks list (populated by renderActionPanel for offline Mew/Ditto)
let copiedAttacks = [];

function getOptBoostMeta(attack) {
  if (!attack || !attack.fx || !attack.fx.includes('optBoost:')) return null;
  const parts = attack.fx.split('optBoost:')[1].split(':');
  const extraDmg = parseInt(parts[0], 10);
  const energyCost = parseInt(parts[1], 10);
  if (Number.isNaN(extraDmg) || Number.isNaN(energyCost)) return null;
  return { extraDmg, energyCost };
}

async function actionAttack(attackIndex, forceOptBoost = null) {
  if (G.animating) return;
  const myP = isOnline ? me() : cp();
  const attacker = myP.active;
  if (!attacker) return;
  const data = getPokemonData(attacker.name);
  const attack = data.attacks[attackIndex];

  // Choice-based attacks (e.g. optBoost) are selected from separate buttons
  // in the action panel; no blocking confirm() popup.
  const opt = getOptBoostMeta(attack);
  let useOptBoost = forceOptBoost === true;
  if (opt && useOptBoost && attacker.energy < opt.energyCost) useOptBoost = false;

  if (isOnline) {
    sendAction({ actionType: 'attack', attackIndex, useOptBoost });
    return;
  }
  dispatchAction({ type: 'attack', attackIndex, useOptBoost });
}

function actionRetreat() {
  if (G.animating) return;
  if (isOnline) { sendAction({ actionType: 'retreat' }); return; }
  dispatchAction({ type: 'retreat' });
}

function actionQuickRetreat() {
  if (G.animating) return;
  if (isOnline) { sendAction({ actionType: 'quickRetreat' }); return; }
  dispatchAction({ type: 'quickRetreat' });
}

function selectBenchForRetreat(idx) {
  if (isOnline) { sendAction({ actionType: 'selectBenchForRetreat', benchIdx: idx }); return; }
  if (G.pendingRetreats.length === 0) return;
  const pr = G.pendingRetreats[0];
  dispatchAction({ type: 'selectBenchForRetreat', benchIdx: idx, _playerNum: pr.player });
}

function discardHeldItem(slot, benchIdx) {
  if (isOnline) { sendAction({ actionType: 'discardItem', slot, benchIdx }); return; }
  dispatchAction({ type: 'discardItem', slot, benchIdx });
}

function selectTarget(playerNum, benchIdx) {
  if (!G.targeting) return;
  if (isOnline) { sendAction({ actionType: 'selectTarget', targetPlayer: playerNum, targetBenchIdx: benchIdx }); return; }
  dispatchAction({ type: 'selectTarget', targetPlayer: playerNum, targetBenchIdx: benchIdx });
}

function cancelTargetingAction() {
  if (!G.targeting) return;
  if (isOnline) {
    if (!isMyTurn()) return;
    sendAction({ actionType: 'cancelTargeting' });
    return;
  }
  dispatchAction({ type: 'cancelTargeting' });
}

async function actionCopiedAttack(copiedIdx, forceOptBoost = null) {
  if (G.animating) return;
  const copied = copiedAttacks[copiedIdx];
  if (!copied) return;
  const myP = isOnline ? me() : cp();
  const attacker = myP.active;
  const opt = copied.attack ? getOptBoostMeta(copied.attack) : null;
  let useOptBoost = forceOptBoost === true;
  if (opt && useOptBoost && attacker && attacker.energy < opt.energyCost) useOptBoost = false;
  if (isOnline) {
    sendAction({ actionType: 'copiedAttack', sourceName: copied.source, attackIndex: copied.attackIndex !== undefined ? copied.attackIndex : copiedIdx, useOptBoost });
    return;
  }
  dispatchAction({ type: 'copiedAttack', sourceName: copied.source, attackIndex: copied.attackIndex !== undefined ? copied.attackIndex : copiedIdx, useOptBoost });
}

function actionPlayPokemon(handIdx) {
  if (G.animating) return;
  const myP = isOnline ? me() : cp();
  const card = myP.hand[handIdx];
  if (!card) return;
  const itemsInHand = myP.hand.filter(c => c.type === 'items');
  if (itemsInHand.length > 0 && !card.heldItem && !G.pendingPlayPokemon) {
    G.pendingPlayPokemon = { handIdx };
    renderItemAttachPrompt(handIdx, itemsInHand);
    return;
  }
  if (isOnline) {
    sendAction({ actionType: 'playPokemon', handIdx, itemHandIdx: null });
    return;
  }
  dispatchAction({ type: 'playPokemon', handIdx, itemHandIdx: null });
}

function renderItemAttachPrompt(handIdx, items) {
  const panel = document.getElementById('apActions');
  const myP = isOnline ? me() : cp();
  let html = `<div class="ap-section-label" style="color:#a855f7">ATTACH A HELD ITEM?</div>`;
  items.forEach((item, i) => {
    const realIdx = myP.hand.indexOf(item);
    html += '<button class="ap-btn ap-btn-ability" onclick="finishPlayPokemon(' + handIdx + ', ' + realIdx + ')">' +
      '<span class="atk-name">' + item.name + '</span></button>';
  });
  html += '<button class="ap-btn ap-btn-end" onclick="finishPlayPokemon(' + handIdx + ', null)">' +
    '<span class="atk-name">No Item</span></button>';
  panel.innerHTML = html;
}

function finishPlayPokemon(handIdx, itemHandIdx) {
  G.pendingPlayPokemon = null;
  if (isOnline) {
    sendAction({ actionType: 'playPokemon', handIdx, itemHandIdx });
    return;
  }
  dispatchAction({ type: 'playPokemon', handIdx, itemHandIdx });
}

function useAbility(key) {
  if (G.animating) return;
  const sourceBenchIdx = (G.selectedCard && G.selectedCard.playerNum === meNum())
    ? G.selectedCard.benchIdx
    : -1;
  if (isOnline) { sendAction({ actionType: 'useAbility', key, sourceBenchIdx }); return; }
  dispatchAction({ type: 'useAbility', key, sourceBenchIdx });
}


function getAbilityMetaByKey(key) {
  if (!key) return null;
  for (const c of POKEMON_DB) {
    if (c.ability && c.ability.key === key) return c.ability;
  }
  return null;
}

function abilityRequiresActivePosition(key) {
  const ability = getAbilityMetaByKey(key);
  return !!(ability && ability.activeOnly);
}

function canUseAbilityFromSelection(abilityKey, used, benchIdx) {
  const notSpent = !used || abilityKey === 'healingTouch' || abilityKey === 'magicDrain';
  const positionOk = !abilityRequiresActivePosition(abilityKey) || benchIdx === -1;
  return notSpent && positionOk;
}


// ============================================================
// DAMAGE POPUP
// ============================================================
function showDamagePopup(amount, mult, targetSelector) {
  const el = document.createElement('div');
  const sizeClass = getDmgPopupClass(amount);
  el.className = 'damage-popup' + (mult > 1 ? ' se' : mult < 1 ? ' nve' : '') + (sizeClass ? ' ' + sizeClass : '');
  el.textContent = '-' + amount;
  const target = targetSelector ? document.querySelector(targetSelector) : document.querySelector('#oppField .active-slot');
  if (target) {
    const rect = target.getBoundingClientRect();
    el.style.left = (rect.left + rect.width / 2) + 'px';
    el.style.top = (rect.top + rect.height * 0.3) + 'px';
  } else {
    el.style.left = '50%';
    el.style.top = '35%';
  }
  document.body.appendChild(el);
  const removeDelay = amount >= 100 ? 2000 : amount >= 50 ? 1400 : 1000;
  setTimeout(() => el.remove(), removeDelay);

  if (mult > 1) {
    const eff = document.createElement('div');
    eff.className = 'eff-text se';
    eff.textContent = 'Super Effective!';
    eff.style.left = el.style.left; eff.style.top = (parseInt(el.style.top) - 30) + 'px';
    document.body.appendChild(eff);
    setTimeout(() => eff.remove(), 1500);
  } else if (mult < 1) {
    const eff = document.createElement('div');
    eff.className = 'eff-text nve';
    eff.textContent = 'Resisted...';
    eff.style.left = el.style.left; eff.style.top = (parseInt(el.style.top) - 30) + 'px';
    document.body.appendChild(eff);
    setTimeout(() => eff.remove(), 1500);
  }
}

function showWin(name) {
  document.getElementById('winName').textContent = name;
  document.getElementById('winOverlay').classList.add('visible');
}


// ============================================================
// RENDERING
// ============================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ---------- DECK BUILD ----------
let dbSelection = [];
let dbTab = 'pokemon';

function initDeckBuild(playerNum) {
  if (playerNum === 1) {
    for (let p = 1; p <= 2; p++) {
      G.players[p].maxBench = Constants.MAX_BENCH;
      G.players[p].active = null;
      G.players[p].bench = [];
      G.players[p].kos = 0;
      G.players[p].mana = 0;
    }
    G.extraTurnFor = null;
    G.winner = null;
    G.turn = 0;
    G.currentPlayer = 1;
  }
  G.phase = 'deckBuild';
  dbSelection = [];
  dbTab = 'pokemon';
  showScreen('deckBuildScreen');
  document.getElementById('dbPlayerTag').textContent = G.players[playerNum].name;
  renderDeckBuild();
}

function renderDeckBuild() {
  const grid = document.getElementById('dbCardGrid');
  const selNames = new Set(dbSelection.map(c => c.name));
  const list = dbTab === 'pokemon' ? POKEMON_DB : ITEM_DB;

  grid.innerHTML = list.map((card, i) => {
    const selected = selNames.has(card.name);
    return `<div class="db-card ${selected?'selected':''}" onclick="toggleDeckCard('${card.name.replace(/'/g,"\\'")}','${dbTab}')">
      <img src="${getImg(card.name)}" alt="${card.name}">
      <div class="db-zoom-btn" onclick="event.stopPropagation();zoomCard('${card.name.replace(/'/g,"\\'")}')">🔍</div>
    </div>`;
  }).join('');

  // Sidebar
  const sidebar = document.getElementById('dbSidebarList');
  sidebar.innerHTML = dbSelection.map(c => `<div class="db-sidebar-item"><img src="${getImg(c.name)}"><span>${c.name}</span></div>`).join('');
  document.getElementById('dbCount').textContent = `${dbSelection.length}/15 cards`;

  // Tabs
  document.querySelectorAll('.db-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(dbTab === 'pokemon' ? 'dbTabPokemon' : 'dbTabItems').classList.add('active');

  // Confirm button
  const btn = document.getElementById('dbConfirmBtn');
  if (dbSelection.length === 15) { btn.className = 'db-confirm-btn ready'; btn.textContent = '✓ CONFIRM DECK'; }
  else { btn.className = 'db-confirm-btn disabled'; btn.textContent = `${dbSelection.length}/15 selected`; }
}

function toggleDeckCard(name, type) {
  const idx = dbSelection.findIndex(c => c.name === name);
  if (idx >= 0) { dbSelection.splice(idx, 1); }
  else if (dbSelection.length < 15) { dbSelection.push({name, type}); }
  renderDeckBuild();
}

function switchDbTab(tab) { dbTab = tab; renderDeckBuild(); }

function randomizeDeckSelection() {
  const pool = [
    ...POKEMON_DB.map(c => ({ name: c.name, type: 'pokemon' })),
    ...ITEM_DB.map(c => ({ name: c.name, type: 'items' })),
  ];

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  dbSelection = pool.slice(0, 15);
  renderDeckBuild();
}

function confirmDeck() {
  if (dbSelection.length !== 15) return;
  if (isOnline) { onlineConfirmDeck(); return; }
  const playerNum = G.phase === 'deckBuild' ? (G.players[1].deck.length === 0 ? 1 : 2) : 1;
  G.players[playerNum].deck = [...dbSelection];

  // Create hand (all cards available)
  G.players[playerNum].hand = dbSelection.map(c => ({
    name: c.name,
    type: c.type,
    heldItem: null,
  }));

  if (playerNum === 1) {
    showPassScreen(2, 'Build your deck', () => initDeckBuild(2));
  } else {
    startSetupPhase();
  }
}

// ---------- PASS SCREEN ----------
function showPassScreen(playerNum, subtitle, callback) {
  showScreen('passScreen');
  document.getElementById('passTitle').textContent = G.players[playerNum].name;
  document.getElementById('passSub').textContent = subtitle;
  document.getElementById('passBtn').onclick = callback;
}

// ---------- SETUP PHASE ----------
let setupStep = 0; // 0=P1 active, 1=P2 active, 2=P1 bench, 3=P2 bench
let setupSelected = []; // {name, heldItem}
let setupItemFor = null; // pokemon name being assigned item

function startSetupPhase() {
  setupStep = 0;
  G.players[1].mana = 7;
  G.players[2].mana = 7;
  showPassScreen(1, 'Choose your Active Pokémon', () => showSetupScreen());
}

function showSetupScreen() {
  const playerNum = (setupStep < 2) ? (setupStep === 0 ? 1 : 2) : (setupStep === 2 ? 1 : 2);
  const isActivePhase = setupStep < 2;
  const p = G.players[playerNum];
  G.currentPlayer = playerNum;

  setupSelected = [];
  showScreen('setupScreen');

  const phaseText = isActivePhase ? `${p.name}: Choose Active Pokémon + Item` : `${p.name}: Choose Bench Pokémon + Items`;
  document.getElementById('setupPhaseText').textContent = phaseText;
  document.getElementById('setupMana').textContent = `Mana: ${p.mana}`;

  renderSetup();
}

function renderSetup() {
  const playerNum = (setupStep < 2) ? (setupStep === 0 ? 1 : 2) : (setupStep === 2 ? 1 : 2);
  const isActivePhase = setupStep < 2;
  const p = G.players[playerNum];

  const hand = document.getElementById('setupHand');
  const placedNames = new Set();
  if (p.active) placedNames.add(p.active.name);
  p.bench.forEach(pk => placedNames.add(pk.name));
  setupSelected.forEach(s => placedNames.add(s.name));

  // Show pokemon from hand
  const pokemonHand = p.hand.filter(c => c.type === 'pokemon' && !placedNames.has(c.name));
  const itemHand = p.hand.filter(c => c.type === 'items');

  let html = '';
  if (setupItemFor) {
    // Show items to pick
    html += `<div style="width:100%;font-size:12px;color:#f59e0b;font-weight:700;margin-bottom:8px;">Choose item for ${setupItemFor} (or skip):</div>`;
    html += `<div class="setup-card" onclick="assignSetupItem(null)" style="width:100px;border:2px dashed rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;min-height:60px;"><span style="color:#666;font-size:11px">No Item</span></div>`;
    html += `<div class="setup-card" onclick="cancelSetupItem()" style="width:100px;border:2px dashed rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;min-height:60px;"><span style="color:#666;font-size:11px">Cancel</span></div>`;
    itemHand.forEach(c => {
      const used = setupSelected.some(s => s.heldItem === c.name);
      html += `<div class="setup-card ${used?'placed':''}" onclick="assignSetupItem('${c.name.replace(/'/g,"\\'")}')">
        <img src="${getImg(c.name)}" alt="${c.name}">
        <div class="db-zoom-btn" onclick="event.stopPropagation();zoomCard('${c.name.replace(/'/g,"\\'")}')">🔍</div>
      </div>`;
    });
  } else {
    pokemonHand.forEach(c => {
      const data = getPokemonData(c.name);
      const canAfford = p.mana >= data.cost;
      html += `<div class="setup-card ${!canAfford?'placed':''}" onclick="${canAfford ? `selectSetupPokemon('${c.name.replace(/'/g,"\\'")}')` : ''}">
        <img src="${getImg(c.name)}" alt="${c.name}">
        <span class="cost-badge">${data.cost}⬡</span>
        <div class="db-zoom-btn" onclick="event.stopPropagation();zoomCard('${c.name.replace(/'/g,"\\'")}')">🔍</div>
      </div>`;
    });
  }
  hand.innerHTML = html;

  // Preview slots
  const preview = document.getElementById('setupPreview');
  let previewHtml = '';

  if (isActivePhase) {
    const sel = setupSelected[0];
    previewHtml += `<div class="setup-slot ${sel?'filled':''}" ${sel ? 'onclick="unselectSetup(0)" style="cursor:pointer"' : ''}>
      ${sel ? `<img src="${getImg(sel.name)}" onclick="event.stopPropagation();zoomCard('${sel.name.replace(/'/g,"\\'")}')" style="cursor:zoom-in"><div><div class="setup-slot-name">${sel.name}</div><div class="setup-slot-label">${sel.heldItem||'No item'}</div><div class="setup-slot-label" style="color:#888">(click to remove)</div><button class="setup-view-btn" onclick="event.stopPropagation();zoomCard('${sel.name.replace(/'/g,"\\'")}')">🔍 View</button></div>` : '<div class="setup-slot-label">ACTIVE SLOT</div>'}
    </div>`;
  } else {
    const maxBench = p.maxBench || Constants.MAX_BENCH;
    for (let i = 0; i < maxBench; i++) {
      const sel = setupSelected[i];
      previewHtml += `<div class="setup-slot ${sel?'filled':''}" ${sel ? `onclick="unselectSetup(${i})" style="cursor:pointer"` : ''}>
        ${sel ? `<img src="${getImg(sel.name)}" onclick="event.stopPropagation();zoomCard('${sel.name.replace(/'/g,"\\'")}')" style="cursor:zoom-in"><div><div class="setup-slot-name">${sel.name}</div><div class="setup-slot-label">${sel.heldItem||'No item'}</div><div class="setup-slot-label" style="color:#888">(click to remove)</div><button class="setup-view-btn" onclick="event.stopPropagation();zoomCard('${sel.name.replace(/'/g,"\\'")}')">🔍 View</button></div>` : `<div class="setup-slot-label">BENCH ${i+1}</div>`}
      </div>`;
    }
  }
  // For bench phase, always allow confirming with 0 selected (skip bench)
  const canConfirmBench = !isActivePhase && !setupItemFor;
  const canConfirm = (setupSelected.length > 0 && !setupItemFor) || canConfirmBench;
  const benchBtnText = isActivePhase ? 'Confirm Active' : (setupSelected.length === 0 ? 'Skip Bench' : 'Confirm Bench');
  preview.innerHTML = previewHtml + `<button class="setup-confirm-btn ${canConfirm ? 'db-confirm-btn ready' : 'db-confirm-btn disabled'}" onclick="confirmSetup()" ${canConfirm ? '' : 'disabled'}>${benchBtnText}</button>`;

  document.getElementById('setupMana').textContent = `Mana: ${p.mana}`;
}

function selectSetupPokemon(name) {
  const isActivePhase = setupStep < 2;
  const playerNum = (setupStep < 2) ? (setupStep === 0 ? 1 : 2) : (setupStep === 2 ? 1 : 2);
  const p = G.players[playerNum];
  if (isActivePhase && setupSelected.length >= 1) return;
  if (!isActivePhase && setupSelected.length >= (p.maxBench || Constants.MAX_BENCH)) return;

  const data = getPokemonData(name);
  if (p.mana < data.cost) return;

  p.mana -= data.cost;
  setupItemFor = name;
  renderSetup();
}

function cancelSetupItem() {
  if (!setupItemFor) return;
  const playerNum = (setupStep < 2) ? (setupStep === 0 ? 1 : 2) : (setupStep === 2 ? 1 : 2);
  const p = G.players[playerNum];
  const data = getPokemonData(setupItemFor);
  if (data) p.mana += data.cost;
  setupItemFor = null;
  renderSetup();
}

function unselectSetup(idx) {
  if (setupItemFor) return;
  if (idx < 0 || idx >= setupSelected.length) return;
  const removed = setupSelected.splice(idx, 1)[0];
  const playerNum = (setupStep < 2) ? (setupStep === 0 ? 1 : 2) : (setupStep === 2 ? 1 : 2);
  const p = G.players[playerNum];
  const data = getPokemonData(removed.name);
  if (data) p.mana += data.cost;
  renderSetup();
}

function assignSetupItem(itemName) {
  const usedItems = new Set(setupSelected.map(s => s.heldItem).filter(Boolean));
  if (itemName && usedItems.has(itemName)) return;

  setupSelected.push({ name: setupItemFor, heldItem: itemName });
  setupItemFor = null;
  renderSetup();
}

function confirmSetup() {
  const playerNum2 = (setupStep < 2) ? (setupStep === 0 ? 1 : 2) : (setupStep === 2 ? 1 : 2);
  const p2 = G.players[playerNum2];
  const isActivePhase2 = setupStep < 2;
  const canSkipBench = !isActivePhase2 && !setupItemFor;
  if (setupItemFor) return;
  if (setupSelected.length === 0 && !canSkipBench) return;
  const playerNum = (setupStep < 2) ? (setupStep === 0 ? 1 : 2) : (setupStep === 2 ? 1 : 2);
  const isActivePhase = setupStep < 2;
  const p = G.players[playerNum];

  if (isActivePhase) {
    const sel = setupSelected[0];
    p.active = makePokemon(sel.name, sel.heldItem);
    _onPlayAbilityLocal(playerNum, p.active);
    // Remove from hand
    p.hand = p.hand.filter(c => c.name !== sel.name);
    if (sel.heldItem) p.hand = p.hand.filter(c => c.name !== sel.heldItem);
  } else {
    setupSelected.forEach(sel => {
      const setupPk = makePokemon(sel.name, sel.heldItem);
      p.bench.push(setupPk);
      _onPlayAbilityLocal(playerNum, setupPk);
      p.hand = p.hand.filter(c => c.name !== sel.name);
      if (sel.heldItem) p.hand = p.hand.filter(c => c.name !== sel.heldItem);
    });
  }

  setupStep++;
  if (setupStep === 1) {
    showPassScreen(2, 'Choose your Active Pokémon', () => showSetupScreen());
  } else if (setupStep === 2) {
    showPassScreen(1, 'Choose your Bench Pokémon', () => showSetupScreen());
  } else if (setupStep === 3) {
    showPassScreen(2, 'Choose your Bench Pokémon', () => showSetupScreen());
  } else {
    // Setup complete! Start battle
    G.phase = 'battle';
    G.currentPlayer = 1;
    G.turn = 1;
    G.players[1].mana = 0;
    G.players[2].mana = 0;
    showScreen('battleScreen');
    // Use shared game logic for start of turn
    G.events = [];
    GameLogic.startTurn(G);
    const startEvents = G.events.slice();
    G.events = [];
    AnimQueue.replayEvents(startEvents, animCtx);
    AnimQueue.setOnDrain(() => { G.animating = false; renderBattle(); });
    renderBattle();
  }
}

// ---------- BATTLE RENDERING ----------
function renderBattle() {
  // Anti-softlock: if animating has been stuck too long during render, clear it
  if (_animating && !G.targeting && G.pendingRetreats.length === 0 && !G.winner) {
    const elapsed = Date.now() - lastAnimatingSetAt;
    if (elapsed > ANIMATING_TIMEOUT_MS) {
      console.warn('[renderBattle] Clearing stuck animating (' + elapsed + 'ms)');
      _animating = false;
    }
  }
  // Skip capture if replay already pre-captured HP before damage
  if (_hpPreCaptured) {
    _hpPreCaptured = false;
  } else {
    captureHpState();
  }
  const myP = me();
  const theirP = them();

  // Top bar
  document.getElementById('btP1Name').textContent = G.players[1].name;
  document.getElementById('btP2Name').textContent = G.players[2].name;
  document.getElementById('btP1Mana').textContent = G.players[1].mana + '⬡';
  document.getElementById('btP2Mana').textContent = G.players[2].mana + '⬡';
  let turnText = `Turn ${G.turn} — ${cp().name}`;
  if (G.pendingRetreats.length > 0 && G.pendingRetreats[0].reason === 'ko') {
    const prPlayer = G.players[G.pendingRetreats[0].player];
    turnText = `Turn ${G.turn} — ${prPlayer.name} must choose new Active`;
  } else if (isOnline && !isMyTurn()) {
    turnText += ' (Waiting...)';
  }
  document.getElementById('btTurn').textContent = turnText;

  for (let p = 1; p <= 2; p++) {
    const kosEl = document.getElementById(`btP${p}Kos`);
    kosEl.innerHTML = Array(Constants.KOS_TO_WIN).fill(0).map((_, i) => `<div class="bt-ko ${i < G.players[p].kos ? 'filled' : ''}"></div>`).join('');
  }

  // Render fields - "you" is always me, "opp" is always them
  renderFieldSide('oppField', theirP, themNum());
  renderFieldSide('youField', myP, meNum());

  // Update mana display
  const manaEl = document.getElementById('manaCurrent');
  if (manaEl) manaEl.textContent = myP.mana;

  // Action panel
  renderActionPanel();
  renderHandPanel();
  renderLogPanel();

  // Animate HP bars (must be after innerHTML rebuild)
  animateHpBars();
}

function renderFieldSide(containerId, player, playerNum) {
  const el = document.getElementById(containerId);
  if (!el) return;
  let activeHtml = '';
  let benchHtml = '';

  // Active (center, near divider)
  if (player.active) {
    activeHtml = renderPokemonSlot(player.active, 'active-slot', playerNum, -1, false);
  }

  // Bench (row on the outside edge)
  const benchSlots = player.maxBench || Constants.MAX_BENCH;
  for (let i = 0; i < benchSlots; i++) {
    const pk = player.bench[i];
    if (pk) {
      const retreatOwner = G.pendingRetreats.length > 0 ? G.pendingRetreats[0].player : null;
      const isRetreatTarget = retreatOwner === playerNum && (!isOnline || playerNum === myPlayerNum);
      benchHtml += renderPokemonSlot(pk, 'bench-slot', playerNum, i, isRetreatTarget);
    } else {
      benchHtml += '<div class="bench-empty"></div>';
    }
  }

  // For "you" side: CSS flex-direction:column-reverse puts first child at bottom
  // So active (first) goes to bottom (near divider), bench (second) goes to top (outside)
  // For "opp" side: CSS flex-direction:column puts first child at top
  // So bench (first) goes to top (outside), active (second) goes to bottom (near divider)
  if (containerId === 'oppField') {
    el.innerHTML = `<div class="field-bench-row">${benchHtml}</div><div class="field-active-row">${activeHtml}</div>`;
  } else {
    el.innerHTML = `<div class="field-active-row">${activeHtml}</div><div class="field-bench-row">${benchHtml}</div>`;
  }
}

function _onPlayAbilityLocal(playerNum, pk) {
  const data = getPokemonData(pk.name);
  if (!data || !data.ability || data.ability.type !== 'onPlay') return;
  if (data.ability.key === 'dimensionExpansion') {
    const p = G.players[playerNum];
    p.maxBench = (p.maxBench || Constants.MAX_BENCH) + 1;
    addLog(pk.name + ' expands your bench capacity by 1!', 'effect');
    G.events.push({ type: 'ability_effect', ability: 'dimensionExpansion', pokemon: pk.name, player: playerNum, maxBench: p.maxBench });
  }
}

function renderPokemonSlot(pk, slotClass, playerNum, benchIdx, isRetreatTarget) {
  const isTarget = G.targeting && G.targeting.validTargets.some(t => t.player === playerNum && t.idx === benchIdx);
  const hpPct = Math.max(0, (pk.hp / pk.maxHp) * 100);
  const hpColor = hpPct > 50 ? '#4ade80' : hpPct > 25 ? '#fbbf24' : '#ef4444';

  // Determine click behavior: targeting/retreat takes priority, then card selection
  let clickAction, imgClass;
  if (isRetreatTarget) {
    clickAction = `onclick="selectBenchForRetreat(${benchIdx})"`;
    imgClass = 'targetable';
  } else if (isTarget) {
    clickAction = `onclick="selectTarget(${playerNum},${benchIdx})"`;
    imgClass = 'targetable';
  } else {
    clickAction = `onclick="event.stopPropagation();selectCard(${playerNum},${benchIdx})"`;
    imgClass = 'clickable';
  }

  // Determine glow: yellow for active that can attack, green for usable ability
  const isMine = playerNum === meNum();
  const isMyTurnNow = isOnline ? isMyTurn() : true;
  let glowClass = '';
  if (isMine && isMyTurnNow && !G.animating && G.pendingRetreats.length === 0 && !G.targeting) {
    const data = getPokemonData(pk.name);
    const me = isOnline ? G.players[myPlayerNum] : cp();
    // Yellow glow: active pokemon that has an affordable attack
    if (benchIdx === -1 && data.attacks && data.attacks.some(atk => pk.energy >= atk.energy && !pk.status.includes('sleep'))) {
      glowClass = 'glow-attack';
    }
    // Green glow: has usable active ability
    if (data.ability && data.ability.type === 'active') {
      const used = me.usedAbilities[data.ability.key];
      const canUse = canUseAbilityFromSelection(data.ability.key, used, benchIdx);
      if (canUse) glowClass += (glowClass ? ' ' : '') + 'glow-ability';
    }
  }

  // Selected state
  const isSelected = G.selectedCard && G.selectedCard.playerNum === playerNum && G.selectedCard.benchIdx === benchIdx;
  const selectedClass = isSelected ? 'selected-card' : '';

  let statusHtml = '';
  if (pk.status.length > 0) statusHtml = pk.status.map(s => `<span class="fp-status ${s}">${s.toUpperCase()}</span>`).join(' ');

  return `<div class="field-pokemon ${slotClass} ${glowClass} ${selectedClass}">
    <div class="fp-img-wrap">
      <img class="fp-img ${imgClass}" src="${getImg(pk.name)}" alt="${pk.name}" ${clickAction}>
      ${pk.heldItem ? `<img class="fp-held-item" src="${getImg(pk.heldItem)}" alt="${pk.heldItem}" title="${pk.heldItem}" onclick="event.stopPropagation();zoomCard('${pk.heldItem.replace(/'/g,"\\'")}')" style="cursor:pointer">` : ''}
    </div>
    <div class="fp-info">
      <div class="fp-name">${pk.name}</div>
      <div class="fp-hp-bar"><div class="fp-hp-fill" style="width:${hpPct}%;background:${hpColor}"></div></div>
      <div class="fp-stats">
        <span class="fp-hp-text">${pk.hp}/${pk.maxHp}</span>
        <span class="fp-energy">${'⚡'.repeat(pk.energy)}</span>
        ${statusHtml}
      </div>
    </div>
  </div>`;
}

function renderActionPanel() {
  const panel = document.getElementById('apActions');
  const info = document.getElementById('apPokemonInfo');
  const retreatOwner = G.pendingRetreats.length > 0 ? G.pendingRetreats[0].player : null;
  const myPendingRetreat = retreatOwner !== null && (isOnline ? retreatOwner === myPlayerNum : true);
  const oppPendingRetreat = isOnline && retreatOwner !== null && retreatOwner !== myPlayerNum;
  const hasActionableTargeting = !!(G.targeting && G.targeting.validTargets && G.targeting.validTargets.length > 0);
  if (isOnline && !hasActionableTargeting && ((!isMyTurn() && !myPendingRetreat) || oppPendingRetreat)) {
    info.innerHTML = '';
    panel.innerHTML = '<div style="color:#888;padding:20px;text-align:center">Waiting for opponent...</div>';
    return;
  }
  const me = isOnline ? G.players[myPlayerNum] : cp();

  // Targeting mode - override everything
  if (G.targeting) {
    info.innerHTML = '';
    const canCancelTargeting = !isOnline || isMyTurn();
    const cancelBtn = canCancelTargeting
      ? `<button onclick="cancelTargetingAction()" style="margin-left:8px;padding:2px 10px;border:none;border-radius:6px;background:rgba(255,255,255,0.1);color:#aaa;cursor:pointer;font-size:10px">Cancel</button>`
      : '';
    panel.innerHTML = `<div class="ap-section-label" style="color:#f59e0b">SELECT A TARGET ${cancelBtn}</div>`;
    return;
  }

  // Pending retreat - override everything
  if (G.pendingRetreats.length > 0) {
    const retreatPlayerName = G.players[retreatOwner].name;
    info.innerHTML = '';
    panel.innerHTML = `<div class="ap-section-label" style="color:#f59e0b">${retreatPlayerName}: SELECT A BENCH POKÉMON TO BECOME ACTIVE</div>`;
    return;
  }

  // Determine which card is selected
  const sel = G.selectedCard;
  const myNum = meNum();

  // If nothing selected, show prompt
  if (!sel) {
    info.innerHTML = '';
    let html = '<div style="color:#555;padding:20px;text-align:center;font-size:13px">Click a Pokémon to see info & actions</div>';
    // Still show End Turn and copiedAttacks reset
    copiedAttacks = [];
    html += renderEndTurnButton(me);
    panel.innerHTML = html;
    return;
  }

  // Get the selected pokemon
  const selPlayer = G.players[sel.playerNum];
  const selPk = sel.benchIdx === -1 ? selPlayer.active : selPlayer.bench[sel.benchIdx];
  if (!selPk) { G.selectedCard = null; info.innerHTML = ''; panel.innerHTML = ''; return; }
  const selData = getPokemonData(selPk.name);
  const isMine = sel.playerNum === myNum;
  const isActive = sel.benchIdx === -1;

  // Show card info (always)
  const discardBtn = isMine && selPk.heldItem
    ? `<button onclick="discardHeldItem('${isActive ? 'active' : 'bench'}',${isActive ? null : sel.benchIdx})" style="font-size:9px;background:#ef4444;color:#fff;border:none;border-radius:4px;padding:1px 6px;cursor:pointer;margin-left:4px">Discard</button>`
    : '';
  const zoomBtn = `<button onclick="zoomCard('${selPk.name.replace(/'/g,"\\'")}')" style="font-size:9px;background:rgba(129,140,248,0.3);color:#a5b4fc;border:1px solid rgba(129,140,248,0.3);border-radius:4px;padding:2px 8px;cursor:pointer;margin-left:6px">🔍 View</button>`;
  const itemZoomBtn = selPk.heldItem ? `<button onclick="zoomCard('${selPk.heldItem.replace(/'/g,"\\'")}')" style="font-size:9px;background:rgba(168,85,247,0.2);color:#c4b5fd;border:1px solid rgba(168,85,247,0.3);border-radius:4px;padding:1px 6px;cursor:pointer;margin-left:4px">🔍</button>` : '';
  info.innerHTML = `
    <div class="ap-pokemon-name">${selPk.name}${!isMine ? ' <span style="color:#ef4444;font-size:10px">(Enemy)</span>' : ''} ${zoomBtn}</div>
    <div class="ap-pokemon-types">${selData.types.map(t => `<span class="ap-type-badge" style="background:${TYPE_COLORS[t]}">${t}</span>`).join('')}</div>
    <div class="ap-pokemon-hp">HP: ${selPk.hp}/${selPk.maxHp} | Energy: ${selPk.energy}/5</div>
    ${selPk.heldItem ? `<div style="font-size:10px;color:#a855f7">🎒 ${selPk.heldItem} ${itemZoomBtn} ${discardBtn}</div>` : ''}
    ${selPk.status.length > 0 ? `<div style="font-size:10px;color:#f59e0b">Status: ${selPk.status.join(', ')}</div>` : ''}
    ${selData.ability ? `<div style="font-size:10px;color:#c4b5fd">✦ ${selData.ability.name}: ${selData.ability.desc} <span style="opacity:0.6">[${selData.ability.type}]</span></div>` : ''}
    <div style="font-size:10px;color:#888;margin-top:2px">${selData.attacks.map(a => `${a.name} (${a.energy}⚡${a.baseDmg ? ', ' + a.baseDmg + 'dmg' : ''})`).join(' · ')}</div>
  `;

  let html = '';
  copiedAttacks = [];

  // If enemy card, just show info (no actions)
  if (!isMine) {
    html += '<div style="color:#888;padding:8px;font-size:11px;text-align:center">Enemy Pokémon — info only</div>';
    html += renderEndTurnButton(me);
    panel.innerHTML = html;
    return;
  }

  // Check if opponent's Active has Thick Aroma
  let thickAromaCost = 0;
  const them = isOnline ? G.players[isOnline ? (myPlayerNum === 1 ? 2 : 1) : opp(G.currentPlayer)] : op();
  if (them.active && !isPassiveBlocked()) {
    const themData = getPokemonData(them.active.name);
    if (themData.ability && themData.ability.key === 'thickAroma') thickAromaCost = 1;
  }

  // === MY ACTIVE POKEMON SELECTED ===
  if (isActive && me.active === selPk) {
    const pk = selPk;
    const data = selData;

    // Attacks
    html += '<div class="ap-section-label">ATTACKS</div>';
    data.attacks.forEach((atk, i) => {
      let cost = atk.energy;
      if (pk.quickClawActive) cost = Math.max(0, cost - 2);
      cost += thickAromaCost;
      const canUse = pk.energy >= cost && !pk.status.includes('sleep') && !(data.ability?.key === 'defeatist' && pk.damage >= 120 && !isPassiveBlocked()) && pk.cantUseAttack !== atk.name;
      const dmgLabel = atk.baseDmg > 0 ? ` | ${atk.baseDmg} dmg` : '';
      const costLabel = thickAromaCost > 0 ? `${atk.energy}+${thickAromaCost}⚡` : `${atk.energy}⚡`;
      html += `<button class="ap-btn ap-btn-attack" onclick="actionAttack(${i}, false)" ${canUse?'':'disabled'}>
        <span class="atk-name">${atk.name}${dmgLabel}</span>
        <span class="atk-detail">${costLabel}${atk.desc ? ' | ' + atk.desc : ''}</span>
      </button>`;

      const opt = getOptBoostMeta(atk);
      if (opt) {
        const canUseBoost = canUse && pk.energy >= (cost + opt.energyCost);
        html += `<button class="ap-btn ap-btn-attack" onclick="actionAttack(${i}, true)" ${canUseBoost?'':'disabled'} style="border-color:rgba(251,191,36,0.45)">
          <span class="atk-name">${atk.name} ★ Boost${dmgLabel ? ` (+${opt.extraDmg})` : ''}</span>
          <span class="atk-detail">${costLabel} + ${opt.energyCost}⚡ | ${atk.desc || ''}</span>
        </button>`;
      }
    });

    // Mew Versatility - show bench allies' attacks
    if (data.ability && data.ability.key === 'versatility' && !isPassiveBlocked()) {
      me.bench.forEach(benchPk => {
        const bd = getPokemonData(benchPk.name);
        bd.attacks.forEach((atk, atkIdx) => {
          const idx = copiedAttacks.length;
          copiedAttacks.push({ attack: atk, types: bd.types, source: benchPk.name, attackIndex: atkIdx });
          const canUse = pk.energy >= (atk.energy + thickAromaCost) && !pk.status.includes('sleep');
          const cdmg = atk.baseDmg > 0 ? ` | ${atk.baseDmg} dmg` : '';
          const cCostLabel = thickAromaCost > 0 ? `${atk.energy}+${thickAromaCost}⚡` : `${atk.energy}⚡`;
          html += `<button class="ap-btn ap-btn-attack" onclick="actionCopiedAttack(${idx}, false)" ${canUse?'':'disabled'} style="border-color:rgba(168,85,247,0.3)">
            <span class="atk-name">${atk.name}${cdmg}</span>
            <span class="atk-detail">${cCostLabel} | from ${benchPk.name}</span>
          </button>`;
          const opt = getOptBoostMeta(atk);
          if (opt) {
            const canUseBoost = canUse && pk.energy >= ((atk.energy + thickAromaCost) + opt.energyCost);
            html += `<button class="ap-btn ap-btn-attack" onclick="actionCopiedAttack(${idx}, true)" ${canUseBoost?'':'disabled'} style="border-color:rgba(251,191,36,0.45)">
              <span class="atk-name">${atk.name} ★ Boost (+${opt.extraDmg})</span>
              <span class="atk-detail">${cCostLabel} + ${opt.energyCost}⚡ | from ${benchPk.name}</span>
            </button>`;
          }
        });
      });
    }

    // Ditto Improvise
    if (pk.improviseActive && op().active) {
      const oppData = getPokemonData(op().active.name);
      html += '<div class="ap-section-label" style="color:#c4b5fd">COPIED ATTACKS</div>';
      oppData.attacks.forEach((atk, atkIdx) => {
        const idx = copiedAttacks.length;
        copiedAttacks.push({ attack: atk, types: oppData.types, source: op().active.name, attackIndex: atkIdx });
        const canUse = pk.energy >= (atk.energy + thickAromaCost) && !pk.status.includes('sleep');
        const cdmg2 = atk.baseDmg > 0 ? ` | ${atk.baseDmg} dmg` : '';
        const dCostLabel = thickAromaCost > 0 ? `${atk.energy}+${thickAromaCost}⚡` : `${atk.energy}⚡`;
        html += `<button class="ap-btn ap-btn-attack" onclick="actionCopiedAttack(${idx}, false)" ${canUse?'':'disabled'} style="border-color:rgba(168,85,247,0.3)">
          <span class="atk-name">${atk.name}${cdmg2}</span>
          <span class="atk-detail">${dCostLabel} | from ${op().active.name}</span>
        </button>`;
        const opt = getOptBoostMeta(atk);
        if (opt) {
          const canUseBoost = canUse && pk.energy >= ((atk.energy + thickAromaCost) + opt.energyCost);
          html += `<button class="ap-btn ap-btn-attack" onclick="actionCopiedAttack(${idx}, true)" ${canUseBoost?'':'disabled'} style="border-color:rgba(251,191,36,0.45)">
            <span class="atk-name">${atk.name} ★ Boost (+${opt.extraDmg})</span>
            <span class="atk-detail">${dCostLabel} + ${opt.energyCost}⚡ | from ${op().active.name}</span>
          </button>`;
        }
      });
    }

    // Ability (only this pokemon's)
    if (data.ability) {
      if (data.ability.type === 'active') {
        const used = me.usedAbilities[data.ability.key];
        const canUse = canUseAbilityFromSelection(data.ability.key, used, -1);
        html += '<div class="ap-section-label">ABILITY</div>';
        html += `<button class="ap-btn ap-btn-ability" onclick="useAbility('${data.ability.key}')" ${canUse?'':'disabled'}>
          <span class="atk-name">${data.ability.name}</span>
          <span class="atk-detail">${data.ability.desc}</span>
        </button>`;
      } else if (data.ability.type === 'passive') {
        html += '<div class="ap-section-label">ABILITY</div>';
        html += `<div class="ap-btn" style="opacity:0.6;cursor:default;border-left:3px solid #6366f1">
          <span class="atk-name">${data.ability.name}</span>
          <span class="atk-detail" style="color:#a5b4fc">${data.ability.desc} [Passive]</span>
        </div>`;
      }
    }

    // Energy grant for this pokemon
    html += '<div class="ap-section-label">ENERGY</div>';
    const myPN = isOnline ? myPlayerNum : G.currentPlayer;
    const isSlowStart = getPokemonData(pk.name).ability?.key === 'slowStart' && !isPassiveBlocked();
    const cost = isSlowStart ? 2 : 1;
    const canGrant = me.mana >= cost && pk.energy < 5;
    html += `<button class="ap-btn ap-btn-energy" onclick="actionGrantEnergy(G.players[${myPN}].active)" ${canGrant?'':'disabled'}>
      <span class="atk-name">+1 Energy → ${pk.name}</span>
      <span class="atk-detail">${cost} mana${isSlowStart?' (Slow Start)':''} | ${pk.energy}/5</span>
    </button>`;

    // Retreat
    html += '<div class="ap-section-label">MOVEMENT</div>';
    const qrCost = pk.heldItem === 'Float Stone' ? 1 : 2;
    html += `<button class="ap-btn ap-btn-retreat" onclick="actionQuickRetreat()" ${me.bench.length > 0 && pk.energy >= qrCost ? '' : 'disabled'}>
      <span class="atk-name">Quick Retreat</span><span class="atk-detail">${qrCost} energy, don't end turn</span>
    </button>`;
    html += `<button class="ap-btn ap-btn-retreat" onclick="actionRetreat()" ${me.bench.length > 0 ? '' : 'disabled'}>
      <span class="atk-name">Retreat</span><span class="atk-detail">Ends turn</span>
    </button>`;

    // Held item discard
    if (pk.heldItem) {
      html += '<div class="ap-section-label">ITEM</div>';
      html += `<button class="ap-btn" onclick="discardHeldItem('active',null)" style="background:rgba(168,85,247,0.1);border-color:rgba(168,85,247,0.3)">
        <span class="atk-name">${pk.heldItem}</span><span class="atk-detail">Click to discard</span>
      </button>`;
    }
  }
  // === MY BENCH POKEMON SELECTED ===
  else if (!isActive && me.bench.includes(selPk)) {
    const bIdx = sel.benchIdx;
    const data = selData;

    // Energy grant
    html += '<div class="ap-section-label">ENERGY</div>';
    const myPN = isOnline ? myPlayerNum : G.currentPlayer;
    const isSlowStart = data.ability?.key === 'slowStart' && !isPassiveBlocked();
    const cost = isSlowStart ? 2 : 1;
    const canGrant = me.mana >= cost && selPk.energy < 5;
    html += `<button class="ap-btn ap-btn-energy" onclick="actionGrantEnergy(G.players[${myPN}].bench[${bIdx}])" ${canGrant?'':'disabled'}>
      <span class="atk-name">+1 Energy → ${selPk.name}</span>
      <span class="atk-detail">${cost} mana${isSlowStart?' (Slow Start)':''} | ${selPk.energy}/5</span>
    </button>`;

    // Ability (if this bench pokemon has an active ability)
    if (data.ability && data.ability.type === 'active' && data.ability.key !== 'improvise') {
      const used = me.usedAbilities[data.ability.key];
      const canUse = canUseAbilityFromSelection(data.ability.key, used, sel);
      html += '<div class="ap-section-label">ABILITY</div>';
      html += `<button class="ap-btn ap-btn-ability" onclick="useAbility('${data.ability.key}')" ${canUse?'':'disabled'}>
        <span class="atk-name">${data.ability.name}</span>
        <span class="atk-detail">${data.ability.desc}</span>
      </button>`;
    } else if (data.ability && data.ability.type === 'passive') {
      html += '<div class="ap-section-label">ABILITY</div>';
      html += `<div class="ap-btn" style="opacity:0.6;cursor:default;border-left:3px solid #6366f1">
        <span class="atk-name">${data.ability.name}</span>
        <span class="atk-detail" style="color:#a5b4fc">${data.ability.desc} [Passive]</span>
      </div>`;
    }

    // Held item discard
    if (selPk.heldItem) {
      html += '<div class="ap-section-label">ITEM</div>';
      html += `<button class="ap-btn" onclick="discardHeldItem('bench',${bIdx})" style="background:rgba(168,85,247,0.1);border-color:rgba(168,85,247,0.3)">
        <span class="atk-name">${selPk.heldItem}</span><span class="atk-detail">Click to discard</span>
      </button>`;
    }

    // Show attacks (info-only, can't use from bench)
    if (data.attacks.length > 0) {
      html += '<div class="ap-section-label" style="opacity:0.5">ATTACKS (must be Active)</div>';
      data.attacks.forEach(atk => {
        const dmgLabel = atk.baseDmg > 0 ? ` | ${atk.baseDmg} dmg` : '';
        html += `<div class="ap-btn ap-btn-attack" style="opacity:0.35;cursor:default">
          <span class="atk-name">${atk.name}${dmgLabel}</span>
          <span class="atk-detail">${atk.energy}⚡${atk.desc ? ' | ' + atk.desc : ''}</span>
        </div>`;
      });
    }
  }

  // End turn button always shown
  html += renderEndTurnButton(me);
  panel.innerHTML = html;
}

function renderEndTurnButton(me) {
  let html = '<div class="ap-section-label" style="margin-top:8px">TURN</div>';
  if (isOnline) {
    html += `<button class="ap-btn ap-btn-end" onclick="sendAction({actionType:'endTurn'})" ${isMyTurn()?'':'disabled'}>
      <span class="atk-name">End Turn</span>
    </button>`;
  } else {
    html += `<button class="ap-btn ap-btn-end" onclick="if(!G.animating){dispatchAction({type:'endTurn'})}">
      <span class="atk-name">End Turn</span>
    </button>`;
  }
  return html;
}

function renderHandPanel() {
  const panel = document.getElementById('apHand');
  const me = isOnline ? G.players[myPlayerNum] : cp();
  const pokemonHand = me.hand.filter(c => c.type === 'pokemon');
  const itemHand = me.hand.filter(c => c.type === 'items');

  let html = `<div class="ap-hand-title">HAND (${me.hand.length})</div>`;
  pokemonHand.forEach((c, i) => {
    const realIdx = me.hand.indexOf(c);
    const data = getPokemonData(c.name);
    const canAfford = me.mana >= data.cost && me.bench.length < (me.maxBench || Constants.MAX_BENCH);
    html += `<div class="ap-hand-card ${canAfford?'':'cant-afford'}" onclick="actionPlayPokemon(${realIdx})">
      <img src="${getImg(c.name)}">
      <div><div class="hc-name">${c.name}</div><div class="hc-cost">${data.cost}⬡ · ${data.hp}HP</div></div>
      <button class="hc-view-btn" onclick="event.stopPropagation();zoomCard('${c.name.replace(/'/g,"\\'")}')">🔍 View</button>
    </div>`;
  });
  if (itemHand.length > 0) {
    html += `<div class="ap-hand-title" style="margin-top:8px">ITEMS (${itemHand.length})</div>`;
    itemHand.forEach(c => {
      html += `<div class="ap-hand-card" style="cursor:pointer" onclick="zoomCard('${c.name.replace(/'/g,"\\'")}')"><img src="${getImg(c.name)}"><div><div class="hc-name">${c.name}</div></div></div>`;
    });
  }
  panel.innerHTML = html;
}

function renderLogPanel() {
  const panel = document.getElementById('apLog');
  panel.innerHTML = `<div class="ap-log-title">BATTLE LOG</div>` +
    G.log.slice(0, 30).map(e => `<div class="log-entry ${e.cls}">${e.text}</div>`).join('');
}

// ---------- ZOOM ----------
function zoomCard(name) {
  document.getElementById('zoomImg').src = getImg(name);
  document.getElementById('zoomOverlay').classList.add('visible');
}
function closeZoom() { document.getElementById('zoomOverlay').classList.remove('visible'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeZoom(); });

// ---------- CARD SELECTION ----------
function selectCard(playerNum, benchIdx) {
  // If targeting or pending retreat, don't change selection
  if (G.targeting || G.pendingRetreats.length > 0) return;
  // Toggle off if re-clicking same card
  if (G.selectedCard && G.selectedCard.playerNum === playerNum && G.selectedCard.benchIdx === benchIdx) {
    G.selectedCard = null;
  } else {
    G.selectedCard = { playerNum, benchIdx };
  }
  renderBattle();
}

// ---------- DRAG TO PAN ----------
function enableDragPan(el) {
  let isDragging = false, startX, startY, scrollLeft, scrollTop;
  // Mouse events
  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('button, .fp-img.targetable, .fp-img.clickable, .db-zoom-btn, .fp-held-item')) return;
    isDragging = true;
    startX = e.pageX - el.offsetLeft;
    startY = e.pageY - el.offsetTop;
    scrollLeft = el.scrollLeft;
    scrollTop = el.scrollTop;
    el.style.cursor = 'grabbing';
  });
  el.addEventListener('mouseleave', () => { isDragging = false; el.style.cursor = ''; });
  el.addEventListener('mouseup', () => { isDragging = false; el.style.cursor = ''; });
  el.addEventListener('mousemove', e => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const y = e.pageY - el.offsetTop;
    el.scrollLeft = scrollLeft - (x - startX);
    el.scrollTop = scrollTop - (y - startY);
  });
  // Touch events for mobile
  el.addEventListener('touchstart', e => {
    if (e.target.closest('button, .fp-img.targetable, .fp-img.clickable, .db-zoom-btn, .fp-held-item')) return;
    const t = e.touches[0];
    isDragging = true;
    startX = t.pageX - el.offsetLeft;
    startY = t.pageY - el.offsetTop;
    scrollLeft = el.scrollLeft;
    scrollTop = el.scrollTop;
  }, { passive: true });
  el.addEventListener('touchend', () => { isDragging = false; });
  el.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const t = e.touches[0];
    const x = t.pageX - el.offsetLeft;
    const y = t.pageY - el.offsetTop;
    el.scrollLeft = scrollLeft - (x - startX);
    el.scrollTop = scrollTop - (y - startY);
  }, { passive: true });
}

// Selectors for all scrollable areas that should support drag-pan
const PAN_SELECTORS = ['.battle-field', '.db-cards', '.db-sidebar-list', '.setup-hand', '.ap-actions', '.ap-hand', '.ap-log', '.ap-pokemon-info'];

// Apply drag-pan to all scrollable areas once they exist
const observer = new MutationObserver(() => {
  PAN_SELECTORS.forEach(sel => {
    const el = document.querySelector(sel);
    if (el && !el.dataset.panInit) { enableDragPan(el); el.dataset.panInit = '1'; }
  });
});
observer.observe(document.body, { childList: true, subtree: true });

// ============================================================
// NETWORK CLIENT
// ============================================================
function sendMsg(msg) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

function sendAction(action) {
  sendMsg({ type: 'action', actionType: action.actionType, ...action });
}

function connectToServer(name, mode, code) {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = protocol + '//' + location.host;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    updateLobbyStatus('Connected!', 'ok');
    if (mode === 'create') {
      sendMsg({ type: 'createRoom', name });
    } else if (mode === 'join') {
      sendMsg({ type: 'joinRoom', code, name });
    }
  };

  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch(err) { return; }
    handleServerMessage(msg);
  };

  ws.onclose = () => {
    updateLobbyStatus('Disconnected. Refresh to retry.', 'error');
  };

  ws.onerror = () => {
    updateLobbyStatus('Connection error.', 'error');
  };
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'roomCreated':
      myPlayerNum = msg.playerNum;
      myToken = msg.token;
      myRoomCode = msg.code;
      sessionStorage.setItem('tcg_token', msg.token);
      sessionStorage.setItem('tcg_room', msg.code);
      showWaitingScreen(msg.code);
      break;

    case 'joined':
      myPlayerNum = msg.playerNum;
      myToken = msg.token;
      myRoomCode = sessionStorage.getItem('tcg_room') || '';
      sessionStorage.setItem('tcg_token', msg.token);
      updateLobbyStatus('Joined! Opponent: ' + msg.oppName, 'ok');
      break;

    case 'oppJoined':
      updateLobbyStatus('Opponent joined: ' + msg.oppName, 'ok');
      break;

    case 'reconnected':
      myPlayerNum = msg.playerNum;
      updateLobbyStatus('Reconnected!', 'ok');
      break;

    case 'gameState':
      handleGameState(msg.state, msg.events || []);
      break;

    case 'deckConfirmed': {
      const btn = document.getElementById('dbConfirmBtn');
      if (btn) { btn.textContent = 'Waiting for opponent...'; btn.className = 'db-confirm-btn disabled'; }
      break;
    }

    case 'oppDeckConfirmed': {
      const btn = document.getElementById('dbConfirmBtn');
      if (btn && btn.textContent.includes('Waiting')) btn.textContent = 'Waiting for opponent... (they\'re ready!)';
      break;
    }

    case 'setupConfirmed':
      // showOnlineSetupScreen will show "waiting" on next gameState
      break;

    case 'oppSetupConfirmed':
      break;

    case 'oppDisconnected':
      showTurnOverlay('Opponent disconnected...');
      break;

    case 'oppReconnected':
      showTurnOverlay('Opponent reconnected!');
      break;

    case 'error':
      console.warn('Server error:', msg.message);
      break;

    case 'pong':
      break;
  }
}

function applyServerState(state) {
  G.phase = state.phase;
  G.currentPlayer = state.currentPlayer;
  G.turn = state.turn;
  G.log = state.log || [];
  G.targeting = state.targeting || null;
  G.pendingRetreats = state.pendingRetreats || (state.pendingRetreat ? [state.pendingRetreat] : []);
  G.winner = state.winner || null;
  G.extraTurnFor = state.extraTurnFor || null;

  // Auto-select active card when it's my turn (online)
  if (state.currentPlayer === myPlayerNum && !G.selectedCard) {
    G.selectedCard = { playerNum: myPlayerNum, benchIdx: -1 };
  }

  for (let pNum = 1; pNum <= 2; pNum++) {
    const sp = state.players[pNum];
    G.players[pNum].name = sp.name;
    G.players[pNum].mana = sp.mana;
    G.players[pNum].kos = sp.kos;
    G.players[pNum].maxBench = sp.maxBench || Constants.MAX_BENCH;
    G.players[pNum].active = sp.active;
    G.players[pNum].bench = sp.bench || [];
    G.players[pNum].usedAbilities = sp.usedAbilities || {};
    G.players[pNum].ready = sp.ready || false;
    if (pNum === myPlayerNum) {
      G.players[pNum].hand = sp.hand || [];
      G.players[pNum].deck = sp.deck || [];
    } else {
      G.players[pNum].hand = [];
      G.players[pNum].handCount = sp.handCount || 0;
      G.players[pNum].deckCount = sp.deckCount || 0;
    }
  }

  if (state.copiedAttacks) {
    copiedAttacks = state.copiedAttacks.map((ca, i) => ({
      attack: ca.attack,
      types: ca.types,
      source: ca.source,
      attackIndex: ca.attackIndex !== undefined ? ca.attackIndex : i,
    }));
  }

  G.animating = false;
}

function handleGameState(state, events) {
  const prevPhase = G.phase;

  // Handle phase transitions
  if (state.phase === 'deckBuild') {
    applyServerState(state);
    showScreen('deckBuildScreen');
    document.getElementById('dbPlayerTag').textContent = G.players[myPlayerNum].name;
    renderDeckBuild();
  } else if (state.phase === 'setupActive' || state.phase === 'setupBench') {
    applyServerState(state);
    showOnlineSetupScreen(state.phase);
  } else if (state.phase === 'battle') {
    showScreen('battleScreen');
    if (events.length > 0) {
      // Defer full state update until after event replay so animations
      // (like ko-fall) can render against the pre-event DOM state.
      // Only update log so new log entries appear during replay.
      G.log = state.log || [];
      replayEvents(events).then(() => {
        applyServerState(state);
        renderBattle();
        if (G.winner) showWin(G.winner);
      });
    } else {
      applyServerState(state);
      renderBattle();
      if (G.winner) showWin(G.winner);
    }
  } else {
    applyServerState(state);
  }
}

// ============================================================
// EVENT REPLAY
// ============================================================
async function replayEvents(events) {
  isReplayingEvents = true;
  renderBattle(); // Render initial state

  for (const event of events) {
    // Helper: find a pokemon's selector from event fields.
    // Events now use shared game-logic format: targetOwner/benchIdx/pokemon (name string).
    const evtSel = (pNum, bIdx) => pNum != null ? getPokemonSelector(pNum, bIdx != null ? bIdx : -1) : null;
    const findSel = (name) => name ? findPokemonSelector(name) : null;

    switch (event.type) {
      case 'attack_declare': {
        const atkSel = getPokemonSelector(event.player || G.currentPlayer, -1);
        animateEl(atkSel, 'attacking', 400);
        await delay(400);
        break;
      }
      case 'damage': {
        captureHpState(); _hpPreCaptured = true; // Snapshot HP BEFORE applying damage so animateHpBars sees the delta
        const dmgSel = evtSel(event.targetOwner, event.benchIdx);
        showDamagePopup(event.amount, event.mult, dmgSel);
        animateEl(dmgSel, getShakeClass(event.amount), getShakeDuration(event.amount));
        const attackColor = (TYPE_PARTICLE_COLORS && event.attackerType) ? (TYPE_PARTICLE_COLORS[event.attackerType] || '#ef4444') : '#ef4444';
        spawnParticlesAtEl(dmgSel, attackColor, event.amount >= 100 ? 22 : 14, {spread: event.amount >= 100 ? 75 : 55});
        // Apply damage to local state so HP bars update during replay
        if (event.targetOwner) {
          const dmgOwner = G.players[event.targetOwner];
          const bIdx = event.benchIdx != null ? event.benchIdx : -1;
          const dmgTarget = bIdx === -1 ? dmgOwner.active : dmgOwner.bench[bIdx];
          if (dmgTarget) {
            dmgTarget.damage = (dmgTarget.damage || 0) + event.amount;
            dmgTarget.hp = Math.max(0, dmgTarget.maxHp - dmgTarget.damage);
          }
        }
        renderBattle();
        await delay(event.amount >= 100 ? 1200 : event.amount >= 50 ? 900 : 700);
        break;
      }
      case 'selfDamage': {
        captureHpState(); _hpPreCaptured = true;
        const selfSel = findSel(event.pokemon);
        if (selfSel) {
          showDamagePopupAt(event.amount, selfSel, false);
          animateEl(selfSel, 'hit-shake', 500);
        }
        // Apply self-damage to local state
        if (event.pokemon) {
          for (let pNum = 1; pNum <= 2; pNum++) {
            const p = G.players[pNum];
            if (p.active && p.active.name === event.pokemon) {
              p.active.damage = (p.active.damage || 0) + event.amount;
              p.active.hp = Math.max(0, p.active.maxHp - p.active.damage);
              break;
            }
          }
        }
        renderBattle();
        await delay(500);
        break;
      }
      case 'ko': {
        const koSel = evtSel(event.owner, -1);
        animateEl(koSel, 'ko-fall', 600);
        spawnParticlesAtEl(koSel, '#ef4444', 20, {spread:70, size:4});
        await delay(600);
        // Remove the KO'd pokemon from local state so re-render shows it gone
        if (event.owner) {
          const koOwner = G.players[event.owner];
          // Find by name since we don't have targetIdx anymore
          if (koOwner.active && koOwner.active.name === event.pokemon) {
            koOwner.active = null;
          } else {
            const koBIdx = koOwner.bench.findIndex(p => p.name === event.pokemon);
            if (koBIdx >= 0) koOwner.bench.splice(koBIdx, 1);
          }
        }
        renderBattle();
        await delay(400);
        break;
      }
      case 'statusApplied': {
        const statSel = findSel(event.pokemon);
        const statusColors = { poison: '#A33EA1', burn: '#EE8130', sleep: '#6b7280', confusion: '#eab308' };
        if (statSel) {
          animateEl(statSel, 'status-apply', 500);
          spawnParticlesAtEl(statSel, statusColors[event.status] || '#fff', 10, {spread:40});
        }
        renderBattle();
        await delay(500);
        break;
      }
      case 'status_cure': {
        const cureSel = findSel(event.pokemon);
        if (cureSel) animateEl(cureSel, 'status-cure', 500);
        renderBattle();
        await delay(400);
        break;
      }
      case 'statusDamage':
      case 'status_tick': {
        captureHpState(); _hpPreCaptured = true;
        const tickOwnerNum = event.owner || event.targetOwner;
        const tickSel = evtSel(tickOwnerNum, -1);
        const tickColors = { poison: '#A33EA1', burn: '#EE8130' };
        spawnParticlesAtEl(tickSel, tickColors[event.status] || '#fff', 10, {spread:40, size:5});
        animateEl(tickSel, 'status-apply', 500);
        const tickDmg = event.damage || event.amount;
        if (tickDmg && tickOwnerNum) {
          const tickOwner = G.players[tickOwnerNum];
          const tickTarget = tickOwner.active; // status damage always on active
          if (tickTarget) {
            tickTarget.damage = (tickTarget.damage || 0) + tickDmg;
            tickTarget.hp = Math.max(0, tickTarget.maxHp - tickTarget.damage);
          }
        }
        renderBattle();
        await delay(600);
        break;
      }
      case 'heal':
      case 'ability_heal':
      case 'item_heal': {
        captureHpState(); _hpPreCaptured = true;
        const healName = event.target || event.pokemon;
        const healSel = findSel(healName);
        if (healSel) {
          animateEl(healSel, 'heal-pulse', 500);
          spawnParticlesAtEl(healSel, '#4ade80', 8, {spread:30});
          showDamagePopupAt(event.amount, healSel, true);
        }
        // Apply heal to local state
        if (healName) {
          for (let pNum = 1; pNum <= 2; pNum++) {
            const p = G.players[pNum];
            const allPk = [p.active, ...p.bench].filter(Boolean);
            const target = allPk.find(pk => pk.name === healName);
            if (target) {
              target.damage = Math.max(0, (target.damage || 0) - (event.amount || 0));
              target.hp = Math.min(target.maxHp, target.maxHp - target.damage);
              break;
            }
          }
        }
        renderBattle();
        await delay(500);
        break;
      }
      case 'energy_gain':
      case 'energyGain': {
        const enSel = findSel(event.pokemon);
        if (enSel) {
          animateEl(enSel, 'energy-gain', 400);
          spawnParticlesAtEl(enSel, '#F7D02C', 6, {spread:30, size:4});
          showEnergyPopup(enSel, '+' + (event.amount || 1) + ' ⚡');
        }
        renderBattle();
        await delay(400);
        break;
      }
      case 'mana_gain':
      case 'manaGain': {
        if (event.player) showManaPopupForPlayer(event.player, event.amount);
        else showManaPopup(event.amount);
        renderBattle();
        await delay(300);
        break;
      }
      case 'switch_active':
      case 'retreat': {
        const actSel = event.player ? getPokemonSelector(event.player, -1) : '#youField .active-slot';
        animateEl(actSel, 'slide-out', 320);
        await delay(320);
        if (event.player) {
          const swOwner = G.players[event.player];
          const fromBenchIdx = event.benchIdx != null ? event.benchIdx : null;
          if (swOwner && fromBenchIdx != null && swOwner.bench[fromBenchIdx]) {
            const incoming = swOwner.bench.splice(fromBenchIdx, 1)[0];
            if (swOwner.active && swOwner.active.hp > 0) swOwner.bench.push(swOwner.active);
            swOwner.active = incoming;
          }
        }
        renderBattle();
        animateEl(actSel, 'slide-in', 320);
        await delay(320);
        break;
      }
      case 'retreat_pending': {
        renderBattle();
        break;
      }
      case 'play_pokemon': {
        renderBattle();
        await delay(300);
        break;
      }
      case 'item_proc':
      case 'itemProc': {
        const ipSel = findSel(event.pokemon);
        if (ipSel) {
          animateEl(ipSel, 'item-proc', 600);
          if (event.effect === 'energyGain' && event.amount) showEnergyPopup(ipSel, '+' + event.amount + ' ⚡');
          if (event.effect === 'heal' && event.amount) showDamagePopupAt(event.amount, ipSel, true);
          if (event.effect === 'focusSash') showDamagePopupAt(0, ipSel, true);
        }
        renderBattle();
        await delay(400);
        break;
      }
      case 'reactiveDamage': {
        captureHpState(); _hpPreCaptured = true;
        const rdSel = findSel(event.target);
        if (rdSel) {
          showDamagePopupAt(event.amount, rdSel, false);
          animateEl(rdSel, 'hit-shake', 500);
        }
        // Apply reactive damage to local state
        if (event.target) {
          for (let pNum = 1; pNum <= 2; pNum++) {
            const p = G.players[pNum];
            if (p.active && p.active.name === event.target) {
              p.active.damage = (p.active.damage || 0) + event.amount;
              p.active.hp = Math.max(0, p.active.maxHp - p.active.damage);
              break;
            }
          }
        }
        renderBattle();
        await delay(400);
        break;
      }
      case 'recoilDamage': {
        captureHpState(); _hpPreCaptured = true;
        const rcSel = findSel(event.pokemon);
        if (rcSel) showDamagePopupAt(event.amount, rcSel, false);
        // Apply recoil damage to local state
        if (event.pokemon) {
          for (let pNum = 1; pNum <= 2; pNum++) {
            const p = G.players[pNum];
            if (p.active && p.active.name === event.pokemon) {
              p.active.damage = (p.active.damage || 0) + event.amount;
              p.active.hp = Math.max(0, p.active.maxHp - p.active.damage);
              break;
            }
          }
        }
        renderBattle();
        await delay(300);
        break;
      }
      case 'switch_turn': {
        showTurnOverlay(event.playerName || ('Player ' + event.player + "'s Turn"));
        await delay(1000);
        renderBattle();
        break;
      }
      case 'extra_turn_start': {
        showTurnOverlay((event.playerName || ('Player ' + event.player)) + ' gets an extra turn!');
        await delay(1000);
        renderBattle();
        break;
      }
      case 'confusion_fail': {
        renderBattle();
        await delay(500);
        break;
      }
      case 'filtered':
      case 'noDamage': {
        renderBattle();
        await delay(500);
        break;
      }
      case 'forceSwitch': {
        renderBattle();
        await delay(500);
        break;
      }
      case 'ability_effect':
      case 'ability_targeting': {
        renderBattle();
        await delay(400);
        break;
      }
      case 'ability_damage': {
        captureHpState(); _hpPreCaptured = true;
        const abSel = findSel(event.target);
        if (abSel) {
          showDamagePopupAt(event.amount, abSel, false);
          animateEl(abSel, 'hit-shake', 450);
        }
        if (event.target && event.amount) {
          for (let pNum = 1; pNum <= 2; pNum++) {
            const p = G.players[pNum];
            const allPk = [p.active, ...p.bench].filter(Boolean);
            const target = allPk.find(pk => pk.name === event.target);
            if (!target) continue;
            target.damage = (target.damage || 0) + event.amount;
            target.hp = Math.max(0, target.maxHp - target.damage);
            break;
          }
        }
        renderBattle();
        await delay(450);
        break;
      }
      case 'discard_item': {
        renderBattle();
        break;
      }
      case 'needNewActive': {
        renderBattle();
        break;
      }
      case 'win': {
        // Handled after replay
        renderBattle();
        break;
      }
      case 'log': {
        // Already in G.log, just re-render
        break;
      }
      case 'phase_change': {
        // Handled in handleGameState
        renderBattle();
        break;
      }
      default: {
        // Unknown event type — just render
        renderBattle();
        break;
      }
    }
  }

  isReplayingEvents = false;
}

// ============================================================
// ONLINE SETUP SCREEN
// ============================================================
let onlineSetupSelected = [];
let onlineSetupItemFor = null;

function showOnlineSetupScreen(phase) {
  onlineSetupSelected = [];
  onlineSetupItemFor = null;
  showScreen('setupScreen');
  const myP = G.players[myPlayerNum];
  const isActive = phase === 'setupActive';
  const phaseText = isActive ? `${myP.name}: Choose Active Pokémon + Item` : `${myP.name}: Choose Bench Pokémon + Items`;
  document.getElementById('setupPhaseText').textContent = phaseText;
  document.getElementById('setupMana').textContent = `Mana: ${myP.mana}`;

  // Turn-based online setup: if it's not your turn, show a waiting screen.
  if (G.currentPlayer !== myPlayerNum) {
    document.getElementById('setupHand').innerHTML = '<div style="color:#888;padding:20px;text-align:center">Waiting for opponent...</div>';
    // Show whatever info has already been revealed (server-side filtered).
    const preview = document.getElementById('setupPreview');
    const myConfirmed = `<div style="margin-bottom:10px;padding:8px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
        <div style="font-weight:800;font-size:12px;margin-bottom:6px;">Your Field</div>
        ${myP.active ? `<div style="display:flex;gap:10px;align-items:center;">
            <img src="${getImg(myP.active.name)}" alt="${myP.active.name}" style="width:54px;height:54px;object-fit:contain;border-radius:10px;cursor:zoom-in;" onclick="zoomCard('${myP.active.name.replace(/'/g,"\\'")}')" />
            <div style="display:flex;flex-direction:column;gap:2px;">
              <div style="font-size:12px;">${myP.active.name}</div>
              <div style="font-size:11px;color:#888;">${myP.active.heldItem || 'No item'}</div>
            </div>
          </div>` : '<div style="color:#888;font-size:12px;">(no active yet)</div>'}
        ${myP.bench && myP.bench.length ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
            ${myP.bench.map(pk => `<img src="${getImg(pk.name)}" alt="${pk.name}" style="width:40px;height:40px;object-fit:contain;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:2px;cursor:zoom-in;" onclick="zoomCard('${pk.name.replace(/'/g,"\\'")}')" />`).join('')}
          </div>` : ''}
      </div>`;
    // Use same opponent rendering logic as renderOnlineSetup.
    const oppP = G.players[opp(myPlayerNum)];
    let oppPanel = '';
    if (oppP && (oppP.active || (oppP.bench && oppP.bench.length))) {
      const oppActive = oppP.active ? `<div style="display:flex;gap:10px;align-items:center;">
          <img src="${getImg(oppP.active.name)}" alt="${oppP.active.name}" style="width:54px;height:54px;object-fit:contain;border-radius:10px;cursor:zoom-in;" onclick="zoomCard('${oppP.active.name.replace(/'/g,"\\'")}')" />
          <div style="display:flex;flex-direction:column;gap:2px;">
            <div style="font-weight:800;font-size:12px;">Opponent Active</div>
            <div style="font-size:12px;">${oppP.active.name}</div>
            <div style="font-size:11px;color:#888;">${oppP.active.heldItem || 'No item'}</div>
          </div>
        </div>` : '';
      const oppBench = (oppP.bench && oppP.bench.length) ? `<div style="margin-top:8px;">
          <div style="font-weight:800;font-size:12px;margin-bottom:6px;">Opponent Bench</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${oppP.bench.map(pk => `<img src="${getImg(pk.name)}" alt="${pk.name}" style="width:40px;height:40px;object-fit:contain;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:2px;cursor:zoom-in;" onclick="zoomCard('${pk.name.replace(/'/g,"\\'")}')" />`).join('')}
          </div>
        </div>` : '';
      oppPanel = `<div style="margin-bottom:10px;padding:8px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;">${oppActive}${oppBench}</div>`;
    }
    preview.innerHTML = oppPanel + myConfirmed;
    return;
  }

  renderOnlineSetup();
}

function renderOnlineSetup() {
  const phase = G.phase;
  const isActive = phase === 'setupActive';
  const myP = G.players[myPlayerNum];
  const hand = document.getElementById('setupHand');

  // Virtual remaining mana while selecting (server only decrements on confirm).
  const spent = onlineSetupSelected.reduce((sum, s) => sum + (getPokemonData(s.name)?.cost || 0), 0);
  const remainingMana = Math.max(0, (myP.mana || 0) - spent);

  const placedNames = new Set();
  if (myP.active) placedNames.add(myP.active.name);
  myP.bench.forEach(pk => placedNames.add(pk.name));
  onlineSetupSelected.forEach(s => placedNames.add(s.name));

  const pokemonHand = myP.hand.filter(c => c.type === 'pokemon' && !placedNames.has(c.name));
  const itemHand = myP.hand.filter(c => c.type === 'items');

  let html = '';
  if (onlineSetupItemFor) {
    html += `<div style="width:100%;font-size:12px;color:#f59e0b;font-weight:700;margin-bottom:8px;">Choose item for ${onlineSetupItemFor} (or skip):</div>`;
    html += `<div class="setup-card" onclick="onlineAssignSetupItem(null)" style="width:100px;border:2px dashed rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;min-height:60px;"><span style="color:#666;font-size:11px">No Item</span></div>`;
    html += `<div class="setup-card" onclick="onlineCancelSetupItem()" style="width:100px;border:2px dashed rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;min-height:60px;"><span style="color:#666;font-size:11px">Cancel</span></div>`;
    itemHand.forEach(c => {
      const used = onlineSetupSelected.some(s => s.heldItem === c.name);
      html += `<div class="setup-card ${used?'placed':''}" onclick="onlineAssignSetupItem('${c.name.replace(/'/g,"\\'")}')">
        <img src="${getImg(c.name)}" alt="${c.name}">
        <div class="db-zoom-btn" onclick="event.stopPropagation();zoomCard('${c.name.replace(/'/g,"\\'")}')">🔍</div>
      </div>`;
    });
  } else {
    pokemonHand.forEach(c => {
      const data = getPokemonData(c.name);
      const canAfford = remainingMana >= data.cost;
      html += `<div class="setup-card ${!canAfford?'placed':''}" onclick="${canAfford ? `onlineSelectSetupPokemon('${c.name.replace(/'/g,"\\'")}')` : ''}">
        <img src="${getImg(c.name)}" alt="${c.name}">
        <span class="cost-badge">${data.cost}⬡</span>
        <div class="db-zoom-btn" onclick="event.stopPropagation();zoomCard('${c.name.replace(/'/g,"\\'")}')">🔍</div>
      </div>`;
    });
  }
  hand.innerHTML = html;

  const preview = document.getElementById('setupPreview');
  let previewHtml = '';

  // Opponent info panel (server filterStateForPlayer already hides anything that
  // should not be visible yet in setup).
  const oppP = G.players[opp(myPlayerNum)];
  if (oppP) {
    const oppActive = oppP.active ? `<div style="display:flex;gap:10px;align-items:center;">
        <img src="${getImg(oppP.active.name)}" alt="${oppP.active.name}" style="width:54px;height:54px;object-fit:contain;border-radius:10px;cursor:zoom-in;" onclick="zoomCard('${oppP.active.name.replace(/'/g,"\\'")}')" />
        <div style="display:flex;flex-direction:column;gap:2px;">
          <div style="font-weight:800;font-size:12px;">Opponent Active</div>
          <div style="font-size:12px;">${oppP.active.name}</div>
          <div style="font-size:11px;color:#888;">${oppP.active.heldItem || 'No item'}</div>
        </div>
      </div>` : '';
    const oppBench = (oppP.bench && oppP.bench.length) ? `<div style="margin-top:8px;">
        <div style="font-weight:800;font-size:12px;margin-bottom:6px;">Opponent Bench</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${oppP.bench.map(pk => `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px;border:1px solid rgba(255,255,255,0.06);border-radius:10px;min-width:64px;">
              <img src="${getImg(pk.name)}" alt="${pk.name}" style="width:40px;height:40px;object-fit:contain;cursor:zoom-in;" onclick="zoomCard('${pk.name.replace(/'/g,"\\'")}')" />
              <div style="font-size:10px;text-align:center;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${pk.name}</div>
            </div>`).join('')}
        </div>
      </div>` : '';
    if (oppActive || oppBench) {
      previewHtml += `<div style="margin-bottom:10px;padding:8px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;">${oppActive}${oppBench}</div>`;
    }
  }
  if (isActive) {
    const sel = onlineSetupSelected[0];
    previewHtml += `<div class="setup-slot ${sel?'filled':''}" ${sel ? 'onclick="onlineUnselectSetup(0)" style="cursor:pointer"' : ''}>
      ${sel ? `<img src="${getImg(sel.name)}" onclick="event.stopPropagation();zoomCard('${sel.name.replace(/'/g,"\\'")}')" style="cursor:zoom-in"><div><div class="setup-slot-name">${sel.name}</div><div class="setup-slot-label">${sel.heldItem||'No item'}</div><div class="setup-slot-label" style="color:#888">(click to remove)</div><button class="setup-view-btn" onclick="event.stopPropagation();zoomCard('${sel.name.replace(/'/g,"\\'")}')">🔍 View</button></div>` : '<div class="setup-slot-label">ACTIVE SLOT</div>'}
    </div>`;
  } else {
    const maxBench = myP.maxBench || Constants.MAX_BENCH;
    for (let i = 0; i < maxBench; i++) {
      const sel = onlineSetupSelected[i];
      previewHtml += `<div class="setup-slot ${sel?'filled':''}" ${sel ? `onclick="onlineUnselectSetup(${i})" style="cursor:pointer"` : ''}>
        ${sel ? `<img src="${getImg(sel.name)}" onclick="event.stopPropagation();zoomCard('${sel.name.replace(/'/g,"\\'")}')" style="cursor:zoom-in"><div><div class="setup-slot-name">${sel.name}</div><div class="setup-slot-label">${sel.heldItem||'No item'}</div><div class="setup-slot-label" style="color:#888">(click to remove)</div><button class="setup-view-btn" onclick="event.stopPropagation();zoomCard('${sel.name.replace(/'/g,"\\'")}')">🔍 View</button></div>` : `<div class="setup-slot-label">BENCH ${i+1}</div>`}
      </div>`;
    }
  }
  const canConfirmBench = !isActive && onlineSetupSelected.length === 0 && !onlineSetupItemFor && pokemonHand.every(c => remainingMana < getPokemonData(c.name).cost);
  const canConfirm = (onlineSetupSelected.length > 0 && !onlineSetupItemFor) || canConfirmBench;
  previewHtml += `<button class="setup-confirm-btn ${canConfirm ? 'db-confirm-btn ready' : 'db-confirm-btn disabled'}" onclick="onlineConfirmSetup()" ${canConfirm ? '' : 'disabled'}>${isActive ? 'Confirm Active' : (canConfirmBench ? 'Skip Bench (no mana)' : 'Confirm Bench')}</button>`;
  preview.innerHTML = previewHtml;

  document.getElementById('setupMana').textContent = `Mana: ${remainingMana}`;
}

function onlineSelectSetupPokemon(name) {
  const myP = G.players[myPlayerNum];
  const isActive = G.phase === 'setupActive';
  if (isActive && onlineSetupSelected.length >= 1) return;
  if (!isActive && onlineSetupSelected.length >= (myP.maxBench || Constants.MAX_BENCH)) return;
  // Enforce remaining mana client-side.
  const spent = onlineSetupSelected.reduce((sum, s) => sum + (getPokemonData(s.name)?.cost || 0), 0);
  const remainingMana = Math.max(0, (myP.mana || 0) - spent);
  const data = getPokemonData(name);
  if (!data || remainingMana < data.cost) return;
  onlineSetupItemFor = name;
  renderOnlineSetup();
}

function onlineCancelSetupItem() {
  onlineSetupItemFor = null;
  renderOnlineSetup();
}

function onlineUnselectSetup(idx) {
  if (onlineSetupItemFor) return;
  if (idx < 0 || idx >= onlineSetupSelected.length) return;
  onlineSetupSelected.splice(idx, 1);
  renderOnlineSetup();
}

function onlineAssignSetupItem(itemName) {
  const usedItems = new Set(onlineSetupSelected.map(s => s.heldItem).filter(Boolean));
  if (itemName && usedItems.has(itemName)) return;
  onlineSetupSelected.push({ name: onlineSetupItemFor, heldItem: itemName });
  onlineSetupItemFor = null;
  renderOnlineSetup();
}

function onlineConfirmSetup() {
  if (onlineSetupItemFor) return;
  const myP = G.players[myPlayerNum];
  const isActive = G.phase === 'setupActive';

  if (isActive) {
    // processSetupChoice expects { activeIdx, itemIdx }
    const sel = onlineSetupSelected[0];
    if (!sel) return;
    const activeIdx = myP.hand.findIndex(c => c.type === 'pokemon' && c.name === sel.name);
    if (activeIdx === -1) return;
    let itemIdx = null;
    if (sel.heldItem) {
      itemIdx = myP.hand.findIndex(c => c.type === 'items' && c.name === sel.heldItem);
      if (itemIdx === -1) itemIdx = null;
    }
    sendMsg({ type: 'setupChoice', choices: { activeIdx, itemIdx } });
  } else {
    // processSetupChoice expects { benchSelections: [{handIdx, itemIdx}] }
    const benchSelections = onlineSetupSelected.map(sel => {
      const handIdx = myP.hand.findIndex(c => c.type === 'pokemon' && c.name === sel.name);
      let itemIdx = null;
      if (sel.heldItem) {
        itemIdx = myP.hand.findIndex(c => c.type === 'items' && c.name === sel.heldItem);
        if (itemIdx === -1) itemIdx = null;
      }
      return { handIdx, itemIdx };
    }).filter(s => s.handIdx !== -1);
    sendMsg({ type: 'setupChoice', choices: { benchSelections } });
  }
}

// ============================================================
// ONLINE DECK CONFIRM
// ============================================================
function onlineConfirmDeck() {
  if (dbSelection.length !== 15) return;
  // processDeckConfirm expects { pokemon: [{name, heldItem}], items: [{name}] }
  const pokemon = dbSelection.filter(c => c.type === 'pokemon').map(c => ({ name: c.name, heldItem: null }));
  const items = dbSelection.filter(c => c.type === 'items').map(c => ({ name: c.name }));
  sendMsg({ type: 'confirmDeck', deck: { pokemon, items } });
}

// ============================================================
// LOBBY UI
// ============================================================
function showLobby() {
  showScreen('lobbyScreen');
}

function showWaitingScreen(code) {
  const el = document.getElementById('lobbyContent');
  el.innerHTML = `
    <div class="lobby-title">Room Code</div>
    <div class="lobby-code">${code}</div>
    <div class="lobby-status" id="lobbyStatus">Waiting for opponent to join...</div>
  `;
}

function updateLobbyStatus(text, type) {
  const el = document.getElementById('lobbyStatus');
  if (el) {
    el.textContent = text;
    el.className = 'lobby-status ' + (type || '');
  }
}

function lobbyCreateRoom() {
  const name = document.getElementById('lobbyName').value.trim() || 'Player';
  isOnline = true;
  connectToServer(name, 'create');
}

function lobbyJoinRoom() {
  const name = document.getElementById('lobbyName').value.trim() || 'Player';
  const code = document.getElementById('lobbyCode').value.trim().toUpperCase();
  if (!code || code.length !== 4) {
    updateLobbyStatus('Enter a 4-character room code', 'error');
    return;
  }
  isOnline = true;
  connectToServer(name, 'join', code);
}

function lobbyLocalPlay() {
  isOnline = false;
  myPlayerNum = null;
  initDeckBuild(1);
}

// ============================================================
// KEEPALIVE
// ============================================================
setInterval(() => {
  if (ws && ws.readyState === 1) {
    sendMsg({ type: 'ping' });
  }
}, 30000);

// ---------- INIT ----------
function init() {
  showLobby();
  // Init drag-pan for all visible scrollable areas
  PAN_SELECTORS.forEach(sel => {
    const el = document.querySelector(sel);
    if (el && !el.dataset.panInit) { enableDragPan(el); el.dataset.panInit = '1'; }
  });
}

init();


// --- Back-compat handlers for lobby buttons (HTML onclick=...) ---
(() => {
  try {
    if (typeof window.lobbyCreateRoom !== 'function') {
      window.lobbyCreateRoom = function () {
        if (typeof lobbyCreateRoom === 'function') return lobbyCreateRoom();
        if (typeof createRoom === 'function') return createRoom();
        if (typeof lobbyCreate === 'function') return lobbyCreate();
        if (typeof onlineCreateRoom === 'function') return onlineCreateRoom();
        if (typeof hostRoom === 'function') return hostRoom();
        if (typeof connectOnline === 'function') return connectOnline(true);
        if (typeof connectToServer === 'function') return connectToServer('host');
        console.error('No create-room function found in game.js');
        alert('Create-room function missing. Check game.js lobby functions.');
      };
    }
    if (typeof window.lobbyJoinRoom !== 'function') {
      window.lobbyJoinRoom = function () {
        if (typeof lobbyJoinRoom === 'function') return lobbyJoinRoom();
        if (typeof joinRoom === 'function') return joinRoom();
        if (typeof lobbyJoin === 'function') return lobbyJoin();
        if (typeof onlineJoinRoom === 'function') return onlineJoinRoom();
        if (typeof connectOnline === 'function') return connectOnline(false);
        if (typeof connectToServer === 'function') return connectToServer('join');
        console.error('No join-room function found in game.js');
        alert('Join-room function missing. Check game.js lobby functions.');
      };
    }
  } catch (e) {
    console.error('Lobby shim init failed:', e);
  }
})();
