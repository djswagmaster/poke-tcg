// ============================================================
// POKEMON TCG - Shared Game Logic (Single Source of Truth)
// ============================================================
// ALL game rules live here. Both client and server use this.
// Functions are SYNCHRONOUS and return event arrays.
// The client replays events with animations; the server broadcasts them.
//
// Works in both browser (global) and Node.js (module.exports).
// ============================================================
(function(exports) {
'use strict';

var Constants, PokemonDB, ItemDB, DamagePipeline, FXHandlers;

function _deps() {
  if (typeof require !== 'undefined') {
    if (!Constants) Constants = require('./constants');
    if (!PokemonDB) PokemonDB = require('./pokemon-db');
    if (!ItemDB) ItemDB = require('./item-db');
    if (!DamagePipeline) DamagePipeline = require('./damage-pipeline');
    if (!FXHandlers) FXHandlers = require('./fx-handlers');
  } else {
    Constants = Constants || (typeof window !== 'undefined' && window.Constants) || {};
    PokemonDB = PokemonDB || (typeof window !== 'undefined' && window.PokemonDB) || {};
    ItemDB = ItemDB || (typeof window !== 'undefined' && window.ItemDB) || {};
    DamagePipeline = DamagePipeline || (typeof window !== 'undefined' && window.DamagePipeline) || {};
    FXHandlers = FXHandlers || (typeof window !== 'undefined' && window.FXHandlers) || {};
  }
}

// ============================================================
// SHORT HELPERS
// ============================================================
function opp(p) { return p === 1 ? 2 : 1; }
function cp(G) { return G.players[G.currentPlayer]; }
function op(G) { return G.players[opp(G.currentPlayer)]; }

function addLog(G, text, cls) {
  cls = cls || '';
  G.log.unshift({ text: text, cls: cls, turn: G.turn });
  if (G.log.length > 100) G.log.pop();
  G.events.push({ type: 'log', text: text, cls: cls });
}

function isPassiveBlocked(G) {
  return DamagePipeline.isPassiveBlocked(G);
}

// ============================================================
// POKEMON FACTORY
// ============================================================
function makePokemon(name, heldItem) {
  _deps();
  var data = PokemonDB.getPokemonData(name);
  var evioliteBonus = 0;
  if (heldItem === 'Eviolite') {
    if (data.cost === 1) evioliteBonus = 30;
    else if (data.cost === 2) evioliteBonus = 20;
    else if (data.cost === 3) evioliteBonus = 10;
  }
  var maxHp = data.hp + (heldItem === 'Health Charm' ? 50 : 0) + evioliteBonus;
  var energy = heldItem === 'Power Herb' ? 1 : 0;
  var actualItem = heldItem === 'Power Herb' ? null : heldItem;
  return {
    name: name, baseMaxHp: maxHp, maxHp: maxHp, hp: maxHp, energy: energy,
    heldItem: actualItem, heldItemUsed: heldItem === 'Power Herb',
    status: [], damage: 0, shields: [], sustained: false,
    attackedThisTurn: false, cantUseAttack: null,
    vulnerability: 0, quickClawActive: heldItem === 'Quick Claw',
    grassWeakUntil: 0, improviseActive: false,
    types: data.types, weakness: data.weakness, resistance: data.resistance,
  };
}

// ============================================================
// GAME STATE FACTORY
// ============================================================
function createGame() {
  _deps();
  return {
    phase: 'deckBuild',
    currentPlayer: 1,
    turn: 0,
    players: {
      1: { name: 'Player 1', mana: 0, kos: 0, deck: [], hand: [], active: null, bench: [], usedAbilities: {}, ready: false, maxBench: Constants.MAX_BENCH },
      2: { name: 'Player 2', mana: 0, kos: 0, deck: [], hand: [], active: null, bench: [], usedAbilities: {}, ready: false, maxBench: Constants.MAX_BENCH },
    },
    log: [],
    events: [],
    targeting: null,
    pendingRetreats: [],
    extraTurnFor: null,
    selectedCard: null,
    winner: null,
  };
}

function runOnPlayAbility(G, playerNum, pk) {
  var data = PokemonDB.getPokemonData(pk.name);
  if (!data || !data.ability || data.ability.type !== 'onPlay') return;
  if (data.ability.key === 'dimensionExpansion') {
    var p = G.players[playerNum];
    p.maxBench = (p.maxBench || Constants.MAX_BENCH) + 1;
    addLog(G, pk.name + ' expands your bench capacity by 1!', 'effect');
    G.events.push({ type: 'ability_effect', ability: 'dimensionExpansion', pokemon: pk.name, player: playerNum, maxBench: p.maxBench });
  }
}

function applyBloomingGardenAura(G) {
  _deps();
  var passivesBlocked = isPassiveBlocked(G);
  [1, 2].forEach(function(playerNum) {
    var p = G.players[playerNum];
    var inPlay = [p.active].concat(p.bench).filter(Boolean);
    var bloomingCount = 0;
    if (!passivesBlocked) {
      inPlay.forEach(function(pk) {
        var d = PokemonDB.getPokemonData(pk.name);
        if (d && d.ability && d.ability.key === 'bloomingGarden') bloomingCount++;
      });
    }
    var bonus = 20 * bloomingCount;
    inPlay.forEach(function(pk) {
      if (!pk.baseMaxHp) pk.baseMaxHp = pk.maxHp;
      var targetMax = pk.baseMaxHp + bonus;
      if (targetMax !== pk.maxHp) {
        var delta = targetMax - pk.maxHp;
        pk.maxHp = targetMax;
        if (pk.hp > 0) {
          pk.hp = Math.max(1, Math.min(pk.maxHp, pk.hp + delta));
          pk.damage = Math.max(0, pk.maxHp - pk.hp);
        }
      }
    });
  });
}

// ============================================================
// TURN MANAGEMENT
// ============================================================
function startTurn(G) {
  _deps();
  G.events = G.events || [];
  var p = cp(G);
  var oldMana = p.mana;
  p.mana = Math.min(Constants.MAX_MANA, p.mana + Constants.MANA_PER_TURN);
  var manaGained = p.mana - oldMana;
  if (manaGained > 0) {
    G.events.push({ type: 'mana_gain', player: G.currentPlayer, amount: manaGained });
  }
  p.usedAbilities = {};
  G.selectedCard = { playerNum: G.currentPlayer, benchIdx: -1 };

  // Clear Ditto improvise
  if (p.active) p.active.improviseActive = false;
  G.targeting = null;
  applyBloomingGardenAura(G);

  // Clear shields / vulnerability / locked attacks
  var allPokemon = [p.active].concat(p.bench).filter(Boolean);
  allPokemon.forEach(function(pk) {
    pk.shields = [];
    pk.vulnerability = 0;
    if (pk.cantUseAttack && pk.cantUseAttackUntilTurn && G.turn > pk.cantUseAttackUntilTurn) {
      pk.cantUseAttack = null;
      pk.cantUseAttackUntilTurn = 0;
    }
  });

  // Passive start-of-turn: Berry Juice Sip (Shuckle)
  allPokemon.forEach(function(pk) {
    var d = PokemonDB.getPokemonData(pk.name);
    if (d.ability && d.ability.key === 'berryJuice' && pk.damage > 0 && !isPassiveBlocked(G)) {
      pk.damage = Math.max(0, pk.damage - 20);
      pk.hp = pk.maxHp - pk.damage;
      addLog(G, 'Berry Juice heals ' + pk.name + ' 20', 'heal');
      G.events.push({ type: 'ability_heal', pokemon: pk.name, amount: 20, ability: 'berryJuice' });
    }
  });

  // Lum Berry auto-cure
  allPokemon.forEach(function(pk) {
    if (pk.heldItem === 'Lum Berry' && !pk.heldItemUsed && pk.status && pk.status.length > 0) {
      pk.status = [];
      pk.damage = Math.max(0, pk.damage - 30);
      pk.hp = pk.maxHp - pk.damage;
      pk.heldItemUsed = true;
      pk.heldItem = null;
      addLog(G, 'Lum Berry cures ' + pk.name + '! (Discarded)', 'heal');
      G.events.push({ type: 'item_proc', item: 'Lum Berry', pokemon: pk.name, effect: 'cureStatus', heal: 30 });
    }
  });

  addLog(G, '--- ' + p.name + ' Turn ' + G.turn + ' ---', 'info');
}

function endTurn(G) {
  _deps();
  var p = cp(G);
  var events = [];

  // Suicune Aqua Ring (strip from opp at end of owner's turn)
  var allMine = [p.active].concat(p.bench).filter(Boolean);
  allMine.forEach(function(pk) {
    var d = PokemonDB.getPokemonData(pk.name);
    if (d.ability && d.ability.key === 'aquaRing' && pk === p.active && !isPassiveBlocked(G)) {
      var target = op(G).active;
      if (target && target.energy > 0 && target.heldItem !== 'Protect Goggles') {
        target.energy = Math.max(0, target.energy - 1);
        addLog(G, 'Aqua Ring strips 1 energy from ' + target.name, 'effect');
        G.events.push({ type: 'ability_effect', ability: 'aquaRing', target: target.name, effect: 'stripEnergy' });
      }
    }
  });

  // Sustained tracking
  if (p.active) {
    p.active.sustained = p.active.attackedThisTurn;
    p.active.attackedThisTurn = false;
  }

  // Status ticks (both players' actives)
  var sides = [
    { player: p, pNum: G.currentPlayer },
    { player: op(G), pNum: opp(G.currentPlayer) }
  ];

  for (var si = 0; si < sides.length; si++) {
    var side = sides[si];
    var pk = side.player.active;
    if (!pk || pk.hp <= 0) continue;

    // Poison: 10 damage
    if (pk.status.indexOf('poison') !== -1) {
      var poisonResult = DamagePipeline.dealStatusDamage(G, pk, 10, side.pNum, 'poison');
      addLog(G, 'Poison deals 10 to ' + pk.name, 'damage');
      G.events.push({ type: 'status_tick', status: 'poison', pokemon: pk.name, damage: 10, owner: side.pNum });
      if (poisonResult.ko) {
        G.events = G.events.concat(poisonResult.events);
      }
    }

    // Burn: 20 damage, 50/50 cleanse
    if (pk.hp > 0 && pk.status.indexOf('burn') !== -1) {
      var burnResult = DamagePipeline.dealStatusDamage(G, pk, 20, side.pNum, 'burn');
      addLog(G, 'Burn deals 20 to ' + pk.name, 'damage');
      G.events.push({ type: 'status_tick', status: 'burn', pokemon: pk.name, damage: 20, owner: side.pNum });
      if (burnResult.ko) {
        G.events = G.events.concat(burnResult.events);
      }
      if (pk.hp > 0 && pk.status.indexOf('burn') !== -1 && Math.random() < 0.5) {
        pk.status = pk.status.filter(function(s) { return s !== 'burn'; });
        addLog(G, pk.name + "'s burn healed! (Heads)", 'heal');
        G.events.push({ type: 'status_cure', pokemon: pk.name, status: 'burn', reason: 'coinFlip' });
      } else if (pk.hp > 0 && pk.status.indexOf('burn') !== -1) {
        addLog(G, pk.name + ' is still Burned (Tails)', 'info');
      }
    }

    // Sleep: 50/50 cure
    if (pk.hp > 0 && pk.status.indexOf('sleep') !== -1) {
      if (Math.random() < 0.5) {
        pk.status = pk.status.filter(function(s) { return s !== 'sleep'; });
        addLog(G, pk.name + ' woke up! (Heads)', 'info');
        G.events.push({ type: 'status_cure', pokemon: pk.name, status: 'sleep', reason: 'coinFlip' });
      } else {
        addLog(G, pk.name + ' is still Asleep! (Tails)', 'info');
      }
    }
  }

  // Leftovers: heal 10 (both players' pokemon)
  for (var li = 0; li < sides.length; li++) {
    var lSide = sides[li];
    var allPk = [lSide.player.active].concat(lSide.player.bench).filter(Boolean);
    for (var pi = 0; pi < allPk.length; pi++) {
      var lpk = allPk[pi];
      if (lpk.heldItem === 'Leftovers' && lpk.damage > 0 && lpk.hp > 0) {
        lpk.damage = Math.max(0, lpk.damage - 10);
        lpk.hp = lpk.maxHp - lpk.damage;
        addLog(G, 'Leftovers heals ' + lpk.name + ' 10', 'heal');
        G.events.push({ type: 'item_heal', item: 'Leftovers', pokemon: lpk.name, amount: 10, owner: lSide.pNum });
      }
    }
  }

  // Check if status ticks caused KOs needing retreat
  if (G.pendingRetreats.length > 0) {
    G.pendingRetreats.forEach(function(pr) { pr.duringEndTurn = true; });
    return; // Caller must wait for retreat resolution, then call switchTurn
  }

  // Switch player
  switchTurn(G);
}

function switchTurn(G) {
  if (G.extraTurnFor && G.extraTurnFor === G.currentPlayer) {
    var p = G.players[G.currentPlayer];
    G.extraTurnFor = null;
    G.turn++;
    G.events.push({ type: 'extra_turn_start', player: G.currentPlayer, turn: G.turn, playerName: p.name });
    startTurn(G);
    return;
  }
  G.currentPlayer = opp(G.currentPlayer);
  G.turn++;
  G.events.push({ type: 'switch_turn', player: G.currentPlayer, turn: G.turn, playerName: G.players[G.currentPlayer].name });
  startTurn(G);
}

// ============================================================
// ACTIONS
// ============================================================

// --- Grant Energy ---
function doGrantEnergy(G, targetSlot, benchIdx) {
  _deps();
  var p = cp(G);
  var target;
  if (targetSlot === 'active') target = p.active;
  else target = p.bench[benchIdx];
  if (!target) return false;

  var data = PokemonDB.getPokemonData(target.name);
  var cost = (data.ability && data.ability.key === 'slowStart') ? 2 : 1;
  if (p.mana < cost || target.energy >= Constants.MAX_ENERGY) return false;

  p.mana -= cost;
  target.energy++;
  G.events.push({ type: 'energy_gain', pokemon: target.name, amount: 1, cost: cost, slot: targetSlot, benchIdx: benchIdx });
  addLog(G, 'Granted ' + target.name + ' +1 energy (' + cost + ' mana)', '');

  // Healing Scarf
  if (target.heldItem === 'Healing Scarf' && target.damage > 0) {
    target.damage = Math.max(0, target.damage - 20);
    target.hp = target.maxHp - target.damage;
    addLog(G, 'Healing Scarf heals ' + target.name + ' 20', 'heal');
    G.events.push({ type: 'item_heal', item: 'Healing Scarf', pokemon: target.name, amount: 20 });
  }

  // Biting Whirlpool (opponent's Arctozolt)
  var oppAll = [op(G).active].concat(op(G).bench).filter(Boolean);
  oppAll.forEach(function(pk) {
    var d = PokemonDB.getPokemonData(pk.name);
    if (d.ability && d.ability.key === 'bitingWhirlpool' && !isPassiveBlocked(G)) {
      var dmgResult = DamagePipeline.applyDamage(G, target, 10, G.currentPlayer);
      addLog(G, 'Biting Whirlpool deals 10 to ' + target.name, 'effect');
      G.events.push({ type: 'ability_damage', ability: 'bitingWhirlpool', target: target.name, amount: 10 });
      if (dmgResult.ko) {
        var koEvents = DamagePipeline.handleKO(G, target, G.currentPlayer);
        G.events = G.events.concat(koEvents);
      }
    }
  });

  return true;
}

// --- Attack ---
function doAttack(G, attackIndex, actionOpts) {
  _deps();
  var p = cp(G);
  var attacker = p.active;
  if (!attacker) return false;
  var data = PokemonDB.getPokemonData(attacker.name);

  // Defeatist check
  if (data.ability && data.ability.key === 'defeatist' && attacker.damage >= 120 && !isPassiveBlocked(G)) {
    addLog(G, attacker.name + " can't attack (Defeatist)!", 'info');
    return false;
  }

  // Status check (sleep / confusion)
  var statusResult = checkStatusBeforeAttack(G, attacker);
  if (statusResult === 'blocked') return false;
  if (statusResult === 'ended') return true;

  var attack = data.attacks[attackIndex];
  if (!attack) return false;

  // Energy cost + item cost mods + Thick Aroma
  var energyCost = attack.energy;
  if (attacker.quickClawActive) energyCost = Math.max(0, energyCost - 2);
  if (attacker.heldItem && attacker.heldItem !== 'Quick Claw') {
    var atkCostHook = ItemDB.runItemHook('onAttackCost', attacker.heldItem, { holder: attacker, attack: attack, G: G });
    if (atkCostHook && atkCostHook.costReduction) energyCost = Math.max(0, energyCost - atkCostHook.costReduction);
  }
  var oppActive = op(G).active;
  if (oppActive && !isPassiveBlocked(G)) {
    var oppData = PokemonDB.getPokemonData(oppActive.name);
    if (oppData.ability && oppData.ability.key === 'thickAroma') energyCost += 1;
  }
  if (attacker.energy < energyCost) return false;

  // Locked attack
  if (attacker.cantUseAttack === attack.name && (!attacker.cantUseAttackUntilTurn || attacker.cantUseAttackUntilTurn >= G.turn)) {
    addLog(G, "Can't use " + attack.name + ' this turn!', 'info');
    return false;
  }

  // Consume Quick Claw
  if (attacker.quickClawActive) {
    attacker.quickClawActive = false;
    attacker.heldItemUsed = true;
    attacker.heldItem = null;
    addLog(G, 'Quick Claw activated! (Discarded)', 'effect');
    G.events.push({ type: 'item_proc', item: 'Quick Claw', pokemon: attacker.name, effect: 'costReduction' });
  }

  var fx = attack.fx || '';
  var useOptBoost = (actionOpts && actionOpts.useOptBoost) || false;

  addLog(G, attacker.name + ' uses ' + attack.name + '!', 'info');
  G.events.push({ type: 'attack_declare', attacker: attacker.name, attack: attack.name, attackIndex: attackIndex, player: G.currentPlayer });

  // Guard id for one-shot attacker item hooks (e.g. Shell Bell/Life Orb)
  // so they only resolve once per attack action.
  G.attackSeq = (G.attackSeq || 0) + 1;

  // Execute full attack
  executeAttack(G, attacker, attack, data.types, fx, p, useOptBoost, G.attackSeq);
  return true;
}

// --- Copied Attack (Mew / Ditto) ---
function doCopiedAttack(G, sourceName, attackIndex, actionOpts) {
  _deps();
  var p = cp(G);
  var attacker = p.active;
  if (!attacker) return false;
  var attData = PokemonDB.getPokemonData(attacker.name);

  // Status check
  var statusResult = checkStatusBeforeAttack(G, attacker);
  if (statusResult === 'blocked') return false;
  if (statusResult === 'ended') return true;

  // Find the source attack
  var sourceData = PokemonDB.getPokemonData(sourceName);
  var attack = sourceData.attacks[attackIndex];
  if (!attack) return false;

  // Energy cost with item mods + Thick Aroma
  var energyCost = attack.energy;
  if (attacker.heldItem && attacker.heldItem !== 'Quick Claw') {
    var copiedCostHook = ItemDB.runItemHook('onAttackCost', attacker.heldItem, { holder: attacker, attack: attack, G: G });
    if (copiedCostHook && copiedCostHook.costReduction) energyCost = Math.max(0, energyCost - copiedCostHook.costReduction);
  }
  var oppActive = op(G).active;
  if (oppActive && !isPassiveBlocked(G)) {
    var oppData = PokemonDB.getPokemonData(oppActive.name);
    if (oppData.ability && oppData.ability.key === 'thickAroma') energyCost += 1;
  }
  if (attacker.energy < energyCost) return false;

  if (attacker.cantUseAttack === attack.name && (!attacker.cantUseAttackUntilTurn || attacker.cantUseAttackUntilTurn >= G.turn)) {
    addLog(G, "Can't use " + attack.name + ' this turn!', 'info');
    return false;
  }

  var fx = attack.fx || '';
  addLog(G, attacker.name + ' uses ' + attack.name + '! (copied)', 'info');
  G.events.push({ type: 'attack_declare', attacker: attacker.name, attack: attack.name, copied: true, source: sourceName, player: G.currentPlayer });

  G.attackSeq = (G.attackSeq || 0) + 1;

  // Use ATTACKER's types for damage, not source's
  var useOptBoost = (actionOpts && actionOpts.useOptBoost) || false;
  executeAttack(G, attacker, attack, attData.types, fx, p, useOptBoost, G.attackSeq);
  return true;
}

// --- Core Attack Execution ---
function executeAttack(G, attacker, attack, attackerTypes, fx, p, useOptBoost, attackSeq) {
  _deps();
  var defender = op(G).active;
  var oppPlayerNum = opp(G.currentPlayer);

  // Pre-damage effects (energy/mana gains)
  var preEvents = FXHandlers.processPreDamageEffects(G, fx, attacker, G.currentPlayer);
  G.events = G.events.concat(preEvents);

  // Snipe targeting (hit any Pokemon)
  if (fx.indexOf('snipe') !== -1 && fx.indexOf('sniperBench') === -1 && fx.indexOf('swarmSnipe') === -1) {
    var snipeResult = FXHandlers.processAll(G, 'snipe', attacker, defender, attack, useOptBoost);
    if (snipeResult.signal === 'pendingTarget') {
      G.targeting = { type: snipeResult.targetingInfo.type, validTargets: snipeResult.targetingInfo.validTargets, attackInfo: snipeResult.targetingInfo };
      G.targeting.attackInfo.attackSeq = attackSeq;
      G.events = G.events.concat(snipeResult.events);
      return;
    }
  }

  if (!defender) return;

  // Main damage
  var needsDmg = attack.baseDmg > 0 || /berserk|scaleDef|scaleBoth|scaleOwn|scaleBench|sustained|bonusDmg|fullHpBonus|payback|scaleDefNeg/.test(fx);
  if (needsDmg) {
    var damageResult = DamagePipeline.dealAttackDamage(G, attacker, defender, attack, attackerTypes, oppPlayerNum, { attackSeq: attackSeq });
    G.events = G.events.concat(damageResult.events);

    if (damageResult.result.mult > 1) addLog(G, 'Super Effective!', 'effect');
    if (damageResult.result.mult < 1) addLog(G, 'Not very effective...', 'info');
    if (damageResult.result.reduction > 0) {
      // Reduction info is in the damage event already
    }
  }

  // Process remaining FX (post-damage effects)
  var fxResult = FXHandlers.processAll(G, fx, attacker, defender, attack, useOptBoost);
  G.events = G.events.concat(fxResult.events);

  if (fxResult.signal === 'pendingTarget') {
    G.targeting = { type: fxResult.targetingInfo.type, validTargets: fxResult.targetingInfo.validTargets, attackInfo: fxResult.targetingInfo };
    G.targeting.attackInfo.attackSeq = attackSeq;
    return;
  }
  if (fxResult.signal === 'pendingRetreat') {
    return;
  }

  // Finalize attack
  finalizeAttack(G, attacker);
}

function finalizeAttack(G, attacker) {
  if (attacker) attacker.attackedThisTurn = true;
  if (attacker && attacker.hp <= 0) {
    var koEvents = DamagePipeline.handleKO(G, attacker, G.currentPlayer);
    G.events = G.events.concat(koEvents);
  }
  if (G.pendingRetreats.length === 0 && !G.targeting && !G.winner) {
    endTurn(G);
  }
}

// --- Select Target (snipe, sniperBench, swarmSnipe) ---
function doSelectTarget(G, targetPlayer, targetBenchIdx) {
  _deps();
  if (!G.targeting) return false;
  var side = G.players[targetPlayer];
  var targetPk = targetBenchIdx === -1 ? side.active : side.bench[targetBenchIdx];
  if (!targetPk) return false;

  var valid = G.targeting.validTargets.some(function(t) {
    return t.player === targetPlayer && t.idx === targetBenchIdx;
  });
  if (!valid) return false;

  var info = G.targeting.attackInfo;
  G.targeting = null;

  // Targeted bench energy grant (e.g. Twinkly Generator)
  if (info.type === 'benchEnergy') {
    if (targetPlayer !== G.currentPlayer || targetBenchIdx < 0) return false;
    var energyAmount = info.amount || 0;
    if (energyAmount <= 0 || targetPk.energy >= Constants.MAX_ENERGY) return false;

    var before = targetPk.energy;
    targetPk.energy = Math.min(Constants.MAX_ENERGY, targetPk.energy + energyAmount);
    var gained = targetPk.energy - before;
    if (gained > 0) {
      G.events.push({ type: 'energyGain', pokemon: targetPk.name, amount: gained, source: 'benchEnergy', benchIdx: targetBenchIdx });
      addLog(G, info.attacker.name + ' granted ' + gained + ' energy to ' + targetPk.name, 'effect');
    }

    // Process remaining FX from the original attack, excluding benchEnergy
    var benchFx = (info.attack && info.attack.fx) || '';
    var benchRemainFx = benchFx.replace(/benchEnergy:\d+/, '').trim();
    if (benchRemainFx) {
      var benchFxResult = FXHandlers.processAll(G, benchRemainFx, info.attacker, targetPk, info.attack, false);
      G.events = G.events.concat(benchFxResult.events);
      if (benchFxResult.signal === 'pendingRetreat') return true;
      if (benchFxResult.signal === 'pendingTarget') {
        G.targeting = { type: benchFxResult.targetingInfo.type, validTargets: benchFxResult.targetingInfo.validTargets, attackInfo: benchFxResult.targetingInfo };
        return true;
      }
    }

    finalizeAttack(G, info.attacker);
    return true;
  }


  // Targeted self bench damage (e.g. Collateral Crush)
  if (info.type === 'selfBenchDmg') {
    if (targetPlayer !== G.currentPlayer || targetBenchIdx < 0) return false;
    var selfBenchAtk = { baseDmg: info.baseDmg, fx: '' };
    var selfBenchResult = DamagePipeline.dealAttackDamage(G, info.attacker, targetPk, selfBenchAtk, info.attackerTypes, targetPlayer, {
      attackSeq: info.attackSeq
    });
    G.events.push({ type: 'selfBenchDmg', pokemon: targetPk.name, amount: info.baseDmg, benchIdx: targetBenchIdx });
    G.events = G.events.concat(selfBenchResult.events);

    var selfBenchFx = (info.attack && info.attack.fx) || '';
    var selfBenchRemainFx = selfBenchFx.replace(/selfBenchDmg:\d+/, '').trim();
    if (selfBenchRemainFx) {
      var selfBenchFxResult = FXHandlers.processAll(G, selfBenchRemainFx, info.attacker, targetPk, info.attack, false);
      G.events = G.events.concat(selfBenchFxResult.events);
      if (selfBenchFxResult.signal === 'pendingRetreat') return true;
      if (selfBenchFxResult.signal === 'pendingTarget') {
        G.targeting = { type: selfBenchFxResult.targetingInfo.type, validTargets: selfBenchFxResult.targetingInfo.validTargets, attackInfo: selfBenchFxResult.targetingInfo };
        return true;
      }
    }

    finalizeAttack(G, info.attacker);
    return true;
  }

  // Targeted strip from any opposing Pokemon (e.g. Shadow Chase)
  if (info.type === 'anyStrip') {
    if (targetPlayer === G.currentPlayer) return false;
    var stripAmount = info.amount || 0;
    if (stripAmount <= 0) return false;
    var actualStrip = Math.min(stripAmount, targetPk.energy);
    targetPk.energy = Math.max(0, targetPk.energy - actualStrip);
    G.events.push({ type: 'energyStrip', pokemon: targetPk.name, amount: actualStrip, source: 'anyStrip', targetOwner: targetPlayer });

    var anyStripFx = (info.attack && info.attack.fx) || '';
    var anyStripRemainFx = anyStripFx.replace(/anyStrip:\d+/, '').trim();
    if (anyStripRemainFx) {
      var anyStripFxResult = FXHandlers.processAll(G, anyStripRemainFx, info.attacker, targetPk, info.attack, false);
      G.events = G.events.concat(anyStripFxResult.events);
      if (anyStripFxResult.signal === 'pendingRetreat') return true;
      if (anyStripFxResult.signal === 'pendingTarget') {
        G.targeting = { type: anyStripFxResult.targetingInfo.type, validTargets: anyStripFxResult.targetingInfo.validTargets, attackInfo: anyStripFxResult.targetingInfo };
        return true;
      }
    }

    finalizeAttack(G, info.attacker);
    return true;
  }

  // Targeted multi-hit targeting (e.g. Split Sludge Bomb)
  if (info.type === 'multiTarget') {
    var multiAtk = { baseDmg: info.baseDmg, fx: '' };
    var multiResult = DamagePipeline.dealAttackDamage(G, info.attacker, targetPk, multiAtk, info.attackerTypes, targetPlayer, {
      attackSeq: info.attackSeq
    });
    G.events = G.events.concat(multiResult.events);

    info.remaining = Math.max(0, (info.remaining || 0) - 1);
    info.validTargets = info.validTargets.filter(function(t) {
      return !(t.player === targetPlayer && t.idx === targetBenchIdx);
    });

    if (info.remaining > 0 && info.validTargets.length > 0) {
      G.targeting = {
        type: 'multiTarget',
        validTargets: info.validTargets,
        attackInfo: info
      };
      return true;
    }

    var multiFx = (info.attack && info.attack.fx) || '';
    var multiRemainFx = multiFx.replace(/multiTarget:\d+:\d+/, '').trim();
    if (multiRemainFx) {
      var multiFxResult = FXHandlers.processAll(G, multiRemainFx, info.attacker, targetPk, info.attack, false);
      G.events = G.events.concat(multiFxResult.events);
      if (multiFxResult.signal === 'pendingRetreat') return true;
      if (multiFxResult.signal === 'pendingTarget') {
        G.targeting = { type: multiFxResult.targetingInfo.type, validTargets: multiFxResult.targetingInfo.validTargets, attackInfo: multiFxResult.targetingInfo };
        return true;
      }
    }

    finalizeAttack(G, info.attacker);
    return true;
  }

  // Calculate damage on target
  var sniperAtk = { baseDmg: info.baseDmg, fx: '' };
  var result = DamagePipeline.dealAttackDamage(G, info.attacker, targetPk, sniperAtk, info.attackerTypes, targetPlayer, {
    attackSeq: info.attackSeq
  });
  G.events = G.events.concat(result.events);

  if (result.result.mult > 1) addLog(G, 'Super Effective!', 'effect');
  if (result.result.mult < 1) addLog(G, 'Not very effective...', 'info');
  addLog(G, result.result.damage + ' snipe to ' + targetPk.name, 'damage');

  // Process remaining FX from the original attack
  var fx = info.attack.fx || '';
  var remainFx = fx.replace(/snipe|sniperBench:\d+|swarmSnipe/, '').trim();
  if (remainFx) {
    var fxResult = FXHandlers.processAll(G, remainFx, info.attacker, targetPk, info.attack, false);
    G.events = G.events.concat(fxResult.events);
    if (fxResult.signal === 'pendingRetreat') return true;
    if (fxResult.signal === 'pendingTarget') {
      G.targeting = { type: fxResult.targetingInfo.type, validTargets: fxResult.targetingInfo.validTargets, attackInfo: fxResult.targetingInfo };
      return true;
    }
  }

  finalizeAttack(G, info.attacker);
  return true;
}

// --- Retreat ---
function doRetreat(G) {
  _deps();
  var p = cp(G);
  if (!p.active || p.bench.length === 0) return false;

  // Sleep check
  if (p.active.status.indexOf('sleep') !== -1) {
    addLog(G, p.active.name + " is Asleep and can't retreat!", 'info');
    return false;
  }

  // Blockade check
  var oppActive = op(G).active;
  if (oppActive && !isPassiveBlocked(G)) {
    var oppData = PokemonDB.getPokemonData(oppActive.name);
    if (oppData.ability && oppData.ability.key === 'blockade' && p.active.heldItem !== 'Protect Goggles') {
      addLog(G, 'Blockade prevents retreat!', 'effect');
      return false;
    }
  }

  G.pendingRetreats.push({ player: G.currentPlayer, reason: 'retreat' });
  G.events.push({ type: 'retreat_pending', player: G.currentPlayer });
  return true;
}

// --- Quick Retreat ---
function doQuickRetreat(G) {
  _deps();
  var p = cp(G);
  if (!p.active || p.bench.length === 0) return false;
  if (p.active.status.indexOf('sleep') !== -1) {
    addLog(G, p.active.name + " is Asleep and can't retreat!", 'info');
    return false;
  }
  var cost = 2;
  if (p.active.heldItem) {
    var retreatHook = ItemDB.runItemHook('onRetreat', p.active.heldItem, { holder: p.active, reason: 'quick' });
    if (retreatHook && retreatHook.costReduction) cost = Math.max(0, cost - retreatHook.costReduction);
  }
  if (p.active.energy < cost) return false;

  // Blockade check
  var oppActive = op(G).active;
  if (oppActive && !isPassiveBlocked(G)) {
    var oppData = PokemonDB.getPokemonData(oppActive.name);
    if (oppData.ability && oppData.ability.key === 'blockade' && p.active.heldItem !== 'Protect Goggles') {
      addLog(G, 'Blockade prevents retreat!', 'effect');
      return false;
    }
  }

  p.active.energy -= cost;
  G.pendingRetreats.push({ player: G.currentPlayer, reason: 'quick' });
  addLog(G, 'Quick Retreat (' + cost + ' energy)', 'info');
  G.events.push({ type: 'retreat_pending', player: G.currentPlayer, cost: cost });
  return true;
}

// --- Select Bench for Retreat ---
function doSelectBenchForRetreat(G, benchIdx, playerNum) {
  if (G.pendingRetreats.length === 0) return false;
  var pr = G.pendingRetreats[0];

  // Only the retreat owner can select
  if (pr.player !== playerNum) return false;
  if (pr.reason === 'ko' && G.targeting) return false;

  var p = G.players[pr.player];
  var oldActiveName = p.active ? p.active.name : null;
  var oldActiveCard = p.active;
  var newActive = p.bench[benchIdx];
  if (!newActive) return false;

  p.bench.splice(benchIdx, 1);
  if (p.active && p.active.hp > 0) {
    p.active.sustained = false;
    p.active.attackedThisTurn = false;
    if (p.active.status.length > 0) {
      addLog(G, p.active.name + "'s " + p.active.status.join(', ') + ' was cured on bench!', 'heal');
      p.active.status = [];
    }
    p.bench.push(p.active);
  }
  if (oldActiveCard && oldActiveCard.heldItem) {
    var retreatItem = ItemDB.runItemHook('onRetreat', oldActiveCard.heldItem, { holder: oldActiveCard, reason: pr.reason });
    if (retreatItem && retreatItem.discard) {
      addLog(G, oldActiveCard.heldItem + ' was discarded from ' + oldActiveCard.name + ' on retreat!', 'info');
      G.events.push({ type: 'itemProc', item: oldActiveCard.heldItem, pokemon: oldActiveCard.name, effect: 'discardOnRetreat' });
      oldActiveCard.heldItemUsed = true;
      oldActiveCard.heldItem = null;
    }
  }

  p.active = newActive;
  addLog(G, newActive.name + ' is now Active!', 'info');
  G.events.push({
    type: 'switch_active',
    player: pr.player,
    newActive: newActive.name,
    oldActive: oldActiveName,
    benchIdx: benchIdx,
    reason: pr.reason
  });

  var reason = pr.reason;
  var afterEnd = pr.afterEndTurn;
  var duringEnd = pr.duringEndTurn;
  var transferEnergy = pr.transferEnergy || 0;
  var expShareTransfer = pr.expShareTransfer || 0;
  G.pendingRetreats.shift();

  // Baton Pass energy transfer
  if (reason === 'batonPass' && transferEnergy > 0) {
    var oldActive = p.bench[p.bench.length - 1];
    if (oldActive) oldActive.energy = 0;
    var gained = Math.min(transferEnergy, Constants.MAX_ENERGY - newActive.energy);
    newActive.energy += gained;
    addLog(G, 'Baton Pass: ' + newActive.name + ' gained ' + gained + ' energy!', 'effect');
    G.events.push({ type: 'baton_pass', pokemon: newActive.name, energy: gained });
  }

  // Exp. Share energy transfer on active KO
  if (reason === 'ko' && expShareTransfer > 0 && newActive) {
    var gainFromExpShare = Math.min(expShareTransfer, Constants.MAX_ENERGY - newActive.energy);
    if (gainFromExpShare > 0) {
      newActive.energy += gainFromExpShare;
      addLog(G, 'Exp. Share: ' + newActive.name + ' gained ' + gainFromExpShare + ' energy!', 'effect');
      G.events.push({ type: 'itemProc', item: 'Exp. Share', pokemon: newActive.name, effect: 'energyTransfer', amount: gainFromExpShare });
    }
  }

  // More pending retreats? Wait for those first
  if (G.pendingRetreats.length > 0) return true;

  // Resolve post-retreat flow
  if (duringEnd) {
    switchTurn(G);
  } else if (reason === 'retreat') {
    endTurn(G);
  } else if (reason === 'ko') {
    if (pr.endTurnAfterSwitch !== false) endTurn(G);
  } else if (reason === 'quick') {
    if (afterEnd) endTurn(G);
  } else if (reason === 'forced' || reason === 'batonPass') {
    if (afterEnd) endTurn(G);
  }

  return true;
}

// --- Play Pokemon from Hand ---
function doPlayPokemon(G, handIdx, itemHandIdx) {
  _deps();
  var p = cp(G);
  var card = p.hand[handIdx];
  if (!card || card.type !== 'pokemon') return false;
  var data = PokemonDB.getPokemonData(card.name);
  if (p.mana < data.cost || p.bench.length >= (p.maxBench || Constants.MAX_BENCH)) return false;

  var heldItem = card.heldItem || null;
  // Attach item from hand
  if (itemHandIdx !== null && itemHandIdx !== undefined) {
    var itemCard = p.hand[itemHandIdx];
    if (itemCard && itemCard.type === 'items') {
      heldItem = itemCard.name;
      if (itemHandIdx > handIdx) {
        p.hand.splice(itemHandIdx, 1);
        p.hand.splice(handIdx, 1);
      } else {
        p.hand.splice(handIdx, 1);
        p.hand.splice(itemHandIdx, 1);
      }
    } else {
      p.hand.splice(handIdx, 1);
    }
  } else {
    p.hand.splice(handIdx, 1);
  }

  p.mana -= data.cost;
  var pk = makePokemon(card.name, heldItem);
  p.bench.push(pk);
  runOnPlayAbility(G, G.currentPlayer, pk);
  addLog(G, 'Played ' + pk.name + (heldItem ? ' with ' + heldItem : '') + ' to bench', 'info');
  G.events.push({ type: 'play_pokemon', pokemon: pk.name, heldItem: heldItem, player: G.currentPlayer });

  // Shedinja: on-play strip energy
  if (data.ability && data.ability.key === 'soulDrain' && data.ability.type === 'onPlay') {
    var oppActive = op(G).active;
    if (oppActive && oppActive.energy > 0 && oppActive.heldItem !== 'Protect Goggles') {
      var stripped = Math.min(2, oppActive.energy);
      oppActive.energy -= stripped;
      addLog(G, 'Draining Vessel strips ' + stripped + ' energy from ' + oppActive.name + '!', 'effect');
      G.events.push({ type: 'ability_effect', ability: 'soulDrain', target: oppActive.name, stripped: stripped });
    }
  }

  return true;
}

// --- Use Active Ability ---
function doUseAbility(G, abilityKey, sourceBenchIdx) {
  _deps();
  var p = cp(G);
  var pk = p.active;
  if (typeof sourceBenchIdx === 'number') {
    if (sourceBenchIdx === -1) pk = p.active;
    else pk = p.bench[sourceBenchIdx] || null;
  } else if (G.selectedCard && G.selectedCard.playerNum === G.currentPlayer) {
    var selectedIdx = G.selectedCard.benchIdx;
    if (selectedIdx === -1) pk = p.active;
    else pk = p.bench[selectedIdx] || null;
  }
  if (!pk) return false;
  var data = PokemonDB.getPokemonData(pk.name);
  if (!data.ability || data.ability.type !== 'active') return false;
  if (abilityKey && data.ability.key !== abilityKey) return false;
  if (isPassiveBlocked(G)) { addLog(G, 'Neutralizing Gas blocks abilities!', 'info'); return false; }

  var key = data.ability.key;
  var fromBench = !!(pk !== p.active);
  if (fromBench && (data.ability.activeOnly || (data.ability.desc && /\(active\)/i.test(data.ability.desc)))) return false;

  // Check already used (except unlimited ones)
  if (key !== 'magicDrain' && key !== 'bubbleCleanse' && p.usedAbilities[key]) {
    addLog(G, 'Already used ' + data.ability.name + ' this turn!', 'info');
    return false;
  }

  switch (key) {
    case 'creation': // Arceus: spend 1 mana, gain 2
      if (p.mana < 1) return false;
      p.mana = Math.min(Constants.MAX_MANA, p.mana + 1); // net +1 (spend 1, gain 2)
      p.usedAbilities[key] = true;
      addLog(G, 'Creation: +2 mana (spent 1)', 'effect');
      G.events.push({ type: 'ability_effect', ability: key, pokemon: pk.name });
      break;

    case 'softTouch': // Chansey: heal 10 from any (need target selection)
      p.usedAbilities[key] = true;
      // Set up targeting for heal
      var healTargets = [];
      [G.currentPlayer, opp(G.currentPlayer)].forEach(function(pNum) {
        var side = G.players[pNum];
        if (side.active && side.active.damage > 0) healTargets.push({ player: pNum, idx: -1, pk: side.active });
        side.bench.forEach(function(bpk, bi) { if (bpk.damage > 0) healTargets.push({ player: pNum, idx: bi, pk: bpk }); });
      });
      if (healTargets.length > 0) {
        G.targeting = {
          type: 'softTouch', validTargets: healTargets,
          attackInfo: { sourceType: 'ability', type: 'softTouch', attacker: pk }
        };
        G.events.push({ type: 'ability_targeting', ability: key });
      }
      break;

    case 'improvise': // Ditto: spend 1 energy, gain opp's attacks
      if (pk.energy < 1) return false;
      if (!op(G).active) return false;
      pk.energy--;
      pk.improviseActive = true;
      p.usedAbilities[key] = true;
      addLog(G, pk.name + " copies opponent's attacks!", 'effect');
      G.events.push({ type: 'ability_effect', ability: key, pokemon: pk.name });
      break;

    case 'lullaby': // Kricketune: confuse opp active
      if (!op(G).active) return false;
      if (op(G).active.heldItem === 'Protect Goggles') {
        addLog(G, 'Protect Goggles blocks confusion!', 'effect');
        p.usedAbilities[key] = true;
        return true;
      }
      if (op(G).active.status.indexOf('confusion') === -1) {
        op(G).active.status.push('confusion');
        addLog(G, op(G).active.name + ' is Confused!', 'effect');
      }
      p.usedAbilities[key] = true;
      G.events.push({ type: 'ability_effect', ability: key, target: op(G).active.name });
      break;

    case 'healingTouch': // Mega Audino: 1 mana, heal 30 + cure status
      if (p.mana < 1) return false;
      p.mana--;
      // Target selection for heal
      var htTargets = [];
      var allMy = [p.active].concat(p.bench).filter(Boolean);
      allMy.forEach(function(mpk, i) {
        if (mpk.damage > 0 || (mpk.status && mpk.status.length > 0)) {
          htTargets.push({ player: G.currentPlayer, idx: mpk === p.active ? -1 : p.bench.indexOf(mpk), pk: mpk });
        }
      });
      if (htTargets.length > 0) {
        G.targeting = {
          type: 'healingTouch', validTargets: htTargets,
          attackInfo: { sourceType: 'ability', type: 'healingTouch', attacker: pk }
        };
      }
      p.usedAbilities[key] = true;
      G.events.push({ type: 'ability_effect', ability: key });
      break;

    case 'yummyDelivery': // Slurpuff: choose bench +1 energy free
      var ydTargets = [];
      p.bench.forEach(function(bpk, bi) {
        if (bpk.energy < Constants.MAX_ENERGY) ydTargets.push({ player: G.currentPlayer, idx: bi, pk: bpk });
      });
      if (ydTargets.length === 0) return false;
      p.usedAbilities[key] = true;
      G.targeting = {
        type: 'yummyDelivery',
        validTargets: ydTargets,
        attackInfo: { sourceType: 'ability', type: 'yummyDelivery', attacker: pk }
      };
      G.events.push({ type: 'ability_targeting', ability: key });
      break;

    case 'bubbleCleanse': // Vaporeon: unlimited self-heal by spending 1 energy
      if (pk.energy < 1) return false;
      if (pk.damage <= 0) return false;
      pk.energy--;
      pk.damage = Math.max(0, pk.damage - 30);
      pk.hp = pk.maxHp - pk.damage;
      addLog(G, 'Bubble Cleanse: ' + pk.name + ' healed 30 (spent 1 energy)', 'heal');
      G.events.push({ type: 'ability_heal', ability: key, target: pk.name, amount: 30, energySpent: 1 });
      break;

    case 'leafBoost': // Leafeon: target ally +1 energy then end turn
      var lbTargets = [];
      if (p.active && p.active.energy < Constants.MAX_ENERGY) lbTargets.push({ player: G.currentPlayer, idx: -1, pk: p.active });
      p.bench.forEach(function(bpk, bi) { if (bpk.energy < Constants.MAX_ENERGY) lbTargets.push({ player: G.currentPlayer, idx: bi, pk: bpk }); });
      if (lbTargets.length === 0) return false;
      p.usedAbilities[key] = true;
      G.targeting = {
        type: 'leafBoost', validTargets: lbTargets,
        attackInfo: { sourceType: 'ability', type: 'leafBoost', attacker: pk }
      };
      G.events.push({ type: 'ability_targeting', ability: key });
      break;

    case 'brilliantShining': // Espeon: both players +1 mana
      p.usedAbilities[key] = true;
      var myBefore = p.mana;
      var oppBefore = op(G).mana;
      p.mana = Math.min(Constants.MAX_MANA, p.mana + 1);
      op(G).mana = Math.min(Constants.MAX_MANA, op(G).mana + 1);
      addLog(G, 'Brilliant Shining: both players gain 1 mana!', 'effect');
      G.events.push({ type: 'ability_effect', ability: key, pokemon: pk.name, myGain: p.mana - myBefore, oppGain: op(G).mana - oppBefore });
      if (p.mana > myBefore) G.events.push({ type: 'mana_gain', player: G.currentPlayer, amount: p.mana - myBefore });
      if (op(G).mana > oppBefore) G.events.push({ type: 'mana_gain', player: opp(G.currentPlayer), amount: op(G).mana - oppBefore });
      break;

    case 'hiddenPower': // Unown: active +1 energy, turn ends
      if (p.active.energy >= Constants.MAX_ENERGY) return false;
      p.active.energy++;
      p.usedAbilities[key] = true;
      addLog(G, 'Ancient Energy: +1 energy to ' + p.active.name, 'effect');
      G.events.push({ type: 'ability_effect', ability: key, pokemon: p.active.name });

      // Healing Scarf
      if (p.active.heldItem === 'Healing Scarf' && p.active.damage > 0) {
        p.active.damage = Math.max(0, p.active.damage - 20);
        p.active.hp = p.active.maxHp - p.active.damage;
        addLog(G, 'Healing Scarf heals ' + p.active.name + ' 20', 'heal');
      }

      // End turn immediately
      endTurn(G);
      break;

    case 'gutsyGenerator': // Tyrogue: if damaged, gain 1 mana then end turn
      if (pk.damage <= 0) return false;
      var prevMana = p.mana;
      p.mana = Math.min(Constants.MAX_MANA, p.mana + 1);
      var manaGain = p.mana - prevMana;
      if (manaGain <= 0) return false;
      p.usedAbilities[key] = true;
      addLog(G, 'Gutsy Generator: +' + manaGain + ' mana. Turn ends.', 'effect');
      G.events.push({ type: 'ability_effect', ability: key, pokemon: pk.name, amount: manaGain });
      G.events.push({ type: 'mana_gain', player: G.currentPlayer, amount: manaGain });
      endTurn(G);
      break;

    case 'poisonFumes': // Vileplume: poison opp active
      if (!op(G).active) return false;
      if (op(G).active.heldItem === 'Protect Goggles') {
        addLog(G, 'Protect Goggles blocks poison!', 'effect');
        p.usedAbilities[key] = true;
        return true;
      }
      if (op(G).active.status.indexOf('poison') === -1) {
        op(G).active.status.push('poison');
        addLog(G, 'Poison Fumes: ' + op(G).active.name + ' is Poisoned!', 'effect');
      }
      p.usedAbilities[key] = true;
      G.events.push({ type: 'ability_effect', ability: key, target: op(G).active.name });
      break;

    case 'creepingChill': // Zoroark: 10 dmg to any (target selection)
      p.usedAbilities[key] = true;
      var ccTargets = [];
      [G.currentPlayer, opp(G.currentPlayer)].forEach(function(pNum) {
        var side = G.players[pNum];
        if (side.active && side.active.hp > 0) ccTargets.push({ player: pNum, idx: -1, pk: side.active });
        side.bench.forEach(function(bpk, bi) { if (bpk.hp > 0) ccTargets.push({ player: pNum, idx: bi, pk: bpk }); });
      });
      if (ccTargets.length > 0) {
        G.targeting = {
          type: 'creepingChill', validTargets: ccTargets,
          attackInfo: { sourceType: 'ability', type: 'creepingChill', attacker: pk, baseDmg: 10 }
        };
      }
      G.events.push({ type: 'ability_targeting', ability: key });
      break;

    case 'waterShuriken': // Greninja: 1 mana -> 50 to any (target selection)
      if (p.mana < 1) return false;
      p.mana--;
      p.usedAbilities[key] = true;
      var wsTargets = [];
      [G.currentPlayer, opp(G.currentPlayer)].forEach(function(pNum) {
        var side = G.players[pNum];
        if (side.active && side.active.hp > 0) wsTargets.push({ player: pNum, idx: -1, pk: side.active });
        side.bench.forEach(function(bpk, bi) { if (bpk.hp > 0) wsTargets.push({ player: pNum, idx: bi, pk: bpk }); });
      });
      if (wsTargets.length === 0) return false;
      G.targeting = {
        type: 'waterShuriken', validTargets: wsTargets,
        attackInfo: { sourceType: 'ability', type: 'waterShuriken', attacker: pk, baseDmg: 50 }
      };
      addLog(G, 'Water Shuriken primed: choose a target.', 'effect');
      G.events.push({ type: 'ability_targeting', ability: key });
      break;

    case 'phantomWalk': // Zorua: free retreat (active only)
      if (p.bench.length === 0) return false;
      // Same blockade check but free
      var oppAct = op(G).active;
      if (oppAct && !isPassiveBlocked(G)) {
        var oppD = PokemonDB.getPokemonData(oppAct.name);
        if (oppD.ability && oppD.ability.key === 'blockade' && pk.heldItem !== 'Protect Goggles') {
          addLog(G, 'Blockade prevents retreat!', 'effect');
          return false;
        }
      }
      G.pendingRetreats.push({ player: G.currentPlayer, reason: 'quick' });
      p.usedAbilities[key] = true;
      addLog(G, 'Illusory Getaway! Free retreat', 'effect');
      G.events.push({ type: 'retreat_pending', player: G.currentPlayer, free: true });
      break;

    case 'bloodthirsty': // Lycanroc: 1 mana, force opp switch
      if (p.mana < 1) return false;
      if (op(G).bench.length === 0) return false;
      p.mana--;
      G.pendingRetreats.push({ player: opp(G.currentPlayer), reason: 'forced' });
      p.usedAbilities[key] = true;
      addLog(G, 'Bloodthirsty: opponent must switch!', 'effect');
      G.events.push({ type: 'ability_effect', ability: key, target: opp(G.currentPlayer) });
      break;

    case 'electroCharge': // Jolteon: active +1 energy (1/turn)
      if (pk !== p.active) return false;
      if (pk.energy >= Constants.MAX_ENERGY) return false;
      pk.energy++;
      p.usedAbilities[key] = true;
      addLog(G, 'Electro Charge: ' + pk.name + ' +1 energy!', 'effect');
      G.events.push({ type: 'ability_effect', ability: key, pokemon: pk.name, amount: 1 });

      // Healing Scarf
      if (pk.heldItem === 'Healing Scarf' && pk.damage > 0) {
        pk.damage = Math.max(0, pk.damage - 20);
        pk.hp = pk.maxHp - pk.damage;
        addLog(G, 'Healing Scarf heals ' + pk.name + ' 20', 'heal');
      }
      break;

    case 'megaSpeed': // Mega Blaziken: +1 energy to self
      if (pk.energy >= Constants.MAX_ENERGY) return false;
      pk.energy++;
      p.usedAbilities[key] = true;
      addLog(G, 'Mega Speed: ' + pk.name + ' +1 energy!', 'effect');
      G.events.push({ type: 'ability_effect', ability: key, pokemon: pk.name });

      // Healing Scarf
      if (pk.heldItem === 'Healing Scarf' && pk.damage > 0) {
        pk.damage = Math.max(0, pk.damage - 20);
        pk.hp = pk.maxHp - pk.damage;
        addLog(G, 'Healing Scarf heals ' + pk.name + ' 20', 'heal');
      }
      break;

    case 'magicDrain': // Mismagius: spend 1 mana, opp loses 1 (unlimited)
      if (p.mana < 1) return false;
      p.mana--;
      op(G).mana = Math.max(0, op(G).mana - 1);
      // No usedAbilities tracking (unlimited)
      addLog(G, 'Magic Drain: opponent loses 1 mana!', 'effect');
      G.events.push({ type: 'ability_effect', ability: key });
      break;

    case 'sparkSurfer': // Alolan Raichu: free retreat once per turn
      if (p.bench.length === 0) return false;
      G.pendingRetreats.push({ player: G.currentPlayer, reason: 'quick' });
      p.usedAbilities[key] = true;
      addLog(G, 'Spark Surfer! Free retreat', 'effect');
      G.events.push({ type: 'retreat_pending', player: G.currentPlayer, free: true });
      break;

    default:
      return false;
  }

  return true;
}

// --- Discard Held Item ---
function doDiscardItem(G, slot, benchIdx) {
  var p = cp(G);
  var pk = slot === 'active' ? p.active : p.bench[benchIdx];
  if (!pk || !pk.heldItem) return false;
  addLog(G, 'Discarded ' + pk.heldItem + ' from ' + pk.name, 'info');
  G.events.push({ type: 'discard_item', pokemon: pk.name, item: pk.heldItem });
  pk.heldItem = null;
  return true;
}

// --- End Turn Action ---
function doEndTurnAction(G) {
  endTurn(G);
  return true;
}

// ============================================================
// STATUS CHECK BEFORE ATTACK
// ============================================================
function checkStatusBeforeAttack(G, attacker) {
  if (attacker.status.indexOf('sleep') !== -1) {
    addLog(G, attacker.name + " is Asleep and can't attack!", 'info');
    return 'blocked';
  }
  if (attacker.status.indexOf('confusion') !== -1) {
    if (Math.random() < 0.5) {
      attacker.status = attacker.status.filter(function(s) { return s !== 'confusion'; });
      addLog(G, attacker.name + ' snapped out of Confusion! (Heads)', 'info');
      G.events.push({ type: 'status_cure', pokemon: attacker.name, status: 'confusion', reason: 'coinFlip' });
      return 'ok';
    } else {
      addLog(G, attacker.name + ' is Confused! Attack failed (Tails)', 'info');
      G.events.push({ type: 'confusion_fail', pokemon: attacker.name });
      endTurn(G);
      return 'ended';
    }
  }
  return 'ok';
}

// ============================================================
// COPIED ATTACKS HELPER
// ============================================================
function getCopiedAttacks(G) {
  _deps();
  var p = cp(G);
  var pk = p.active;
  if (!pk) return [];
  var data = PokemonDB.getPokemonData(pk.name);
  var attacks = [];

  // Mew Versatility
  if (data.ability && data.ability.key === 'versatility' && !isPassiveBlocked(G)) {
    p.bench.forEach(function(benchPk) {
      var bd = PokemonDB.getPokemonData(benchPk.name);
      bd.attacks.forEach(function(atk, i) {
        attacks.push({ attack: atk, types: bd.types, source: benchPk.name, attackIndex: i });
      });
    });
  }

  // Ditto Improvise
  if (pk.improviseActive && op(G).active) {
    var oppData = PokemonDB.getPokemonData(op(G).active.name);
    oppData.attacks.forEach(function(atk, i) {
      attacks.push({ attack: atk, types: oppData.types, source: op(G).active.name, attackIndex: i });
    });
  }

  return attacks;
}

// ============================================================
// ABILITY TARGET RESOLUTION (softTouch, creepingChill, healingTouch)
// ============================================================
function doAbilityTarget(G, targetPlayer, targetBenchIdx) {
  if (!G.targeting) return false;
  var targetPk = targetBenchIdx === -1 ? G.players[targetPlayer].active : G.players[targetPlayer].bench[targetBenchIdx];
  if (!targetPk) return false;

  var valid = G.targeting.validTargets.some(function(t) {
    return t.player === targetPlayer && t.idx === targetBenchIdx;
  });
  if (!valid) return false;

  var info = G.targeting.attackInfo;
  G.targeting = null;

  switch (info.type) {
    case 'softTouch':
      targetPk.damage = Math.max(0, targetPk.damage - 10);
      targetPk.hp = targetPk.maxHp - targetPk.damage;
      addLog(G, 'Egg Drop Heal: ' + targetPk.name + ' healed 10', 'heal');
      G.events.push({ type: 'ability_heal', ability: 'softTouch', target: targetPk.name, amount: 10 });
      break;

    case 'healingTouch':
      targetPk.status = [];
      targetPk.damage = Math.max(0, targetPk.damage - 30);
      targetPk.hp = targetPk.maxHp - targetPk.damage;
      addLog(G, 'Mega Checkup: ' + targetPk.name + ' healed 30 + status cured!', 'heal');
      G.events.push({ type: 'ability_heal', ability: 'healingTouch', target: targetPk.name, amount: 30, cured: true });
      break;

    case 'creepingChill':
      var dmgResult = DamagePipeline.applyDamage(G, targetPk, 10, targetPlayer);
      addLog(G, 'Creeping Chill: 10 to ' + targetPk.name, 'effect');
      G.events.push({ type: 'ability_damage', ability: 'creepingChill', target: targetPk.name, amount: 10, owner: targetPlayer });
      if (dmgResult.ko) {
        var koEvents = DamagePipeline.handleKO(G, targetPk, targetPlayer, { endTurnAfterSwitch: false });
        G.events = G.events.concat(koEvents);
      }
      break;

    case 'waterShuriken':
      var shurikenResult = DamagePipeline.applyDamage(G, targetPk, 50, targetPlayer);
      addLog(G, 'Water Shuriken: 50 to ' + targetPk.name, 'effect');
      G.events.push({ type: 'ability_damage', ability: 'waterShuriken', target: targetPk.name, amount: 50, owner: targetPlayer });
      if (shurikenResult.ko) {
        var shurikenKo = DamagePipeline.handleKO(G, targetPk, targetPlayer, { endTurnAfterSwitch: false });
        G.events = G.events.concat(shurikenKo);
      }
      break;

    case 'yummyDelivery':
      if (targetPlayer !== G.currentPlayer || targetBenchIdx < 0) return false;
      if (targetPk.energy >= Constants.MAX_ENERGY) return false;
      targetPk.energy++;
      addLog(G, 'Yummy Delivery: ' + targetPk.name + ' +1 energy!', 'effect');
      G.events.push({ type: 'ability_effect', ability: 'yummyDelivery', target: targetPk.name, amount: 1, benchIdx: targetBenchIdx });

      // Healing Scarf on energy gain
      if (targetPk.heldItem === 'Healing Scarf' && targetPk.damage > 0) {
        targetPk.damage = Math.max(0, targetPk.damage - 20);
        targetPk.hp = targetPk.maxHp - targetPk.damage;
        addLog(G, 'Healing Scarf heals ' + targetPk.name + ' 20', 'heal');
        G.events.push({ type: 'item_heal', item: 'Healing Scarf', pokemon: targetPk.name, amount: 20 });
      }
      break;

    case 'leafBoost':
      if (targetPlayer !== G.currentPlayer) return false;
      if (targetPk.energy >= Constants.MAX_ENERGY) return false;
      targetPk.energy++;
      addLog(G, 'Leaf Boost: ' + targetPk.name + ' gained 1 energy. Turn ends.', 'effect');
      G.events.push({ type: 'ability_effect', ability: 'leafBoost', target: targetPk.name, amount: 1, benchIdx: targetBenchIdx });
      endTurn(G);
      break;
  }

  return true;
}

// --- Cancel targeting (safety valve) ---
function doCancelTargeting(G) {
  if (!G.targeting) return false;
  G.targeting = null;
  addLog(G, 'Target selection cancelled.', 'info');
  G.events.push({ type: 'ability_targeting', cancelled: true });
  return true;
}

// ============================================================
// DECK BUILD & SETUP
// ============================================================
function processDeckConfirm(G, playerNum, deckData) {
  _deps();
  var p = G.players[playerNum];
  if (p.ready) return false;

  // deckData = { pokemon: [{name, heldItem}], items: [{name}] }
  p.deck = deckData.pokemon.map(function(c) { return { name: c.name, type: 'pokemon', heldItem: c.heldItem || null }; });
  deckData.items.forEach(function(c) { p.deck.push({ name: c.name, type: 'items' }); });

  // Shuffle deck
  for (var i = p.deck.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = p.deck[i]; p.deck[i] = p.deck[j]; p.deck[j] = tmp;
  }

  // Give player all cards during setup (not a TCG draw)
  p.hand = p.deck.splice(0, p.deck.length);
  p.ready = true;

  if (G.players[1].ready && G.players[2].ready) {
    // Set setup mana (matches offline startSetupPhase)
    G.players[1].mana = 7;
    G.players[2].mana = 7;
    G.phase = 'setupActive';
    G.currentPlayer = 1;
    G.events.push({ type: 'phase_change', phase: 'setupActive' });
  }

  return true;
}

function processSetupChoice(G, playerNum, choices) {
  _deps();
  if (G.currentPlayer !== playerNum) return false;
  var p = G.players[playerNum];

  if (G.phase === 'setupActive') {
    // choices = { activeIdx, itemIdx (optional) }
    var card = p.hand[choices.activeIdx];
    if (!card || card.type !== 'pokemon') return false;

    var heldItem = null;
    if (choices.itemIdx !== null && choices.itemIdx !== undefined) {
      var itemCard = p.hand[choices.itemIdx];
      if (itemCard && itemCard.type === 'items') heldItem = itemCard.name;
    }

    var pokData = PokemonDB.getPokemonData(card.name);
    var cost = pokData ? pokData.cost : 0;
    if (p.mana < cost) return false;
    p.mana -= cost;

    p.active = makePokemon(card.name, heldItem);
    runOnPlayAbility(G, playerNum, p.active);

    // Remove from hand
    var indicesToRemove = [choices.activeIdx];
    if (choices.itemIdx !== null && choices.itemIdx !== undefined) indicesToRemove.push(choices.itemIdx);
    indicesToRemove.sort(function(a,b) { return b - a; });
    indicesToRemove.forEach(function(idx) { p.hand.splice(idx, 1); });

    // Next player or advance to bench phase
    if (playerNum === 1) {
      G.currentPlayer = 2;
    } else {
      G.phase = 'setupBench';
      G.currentPlayer = 1;
      G.events.push({ type: 'phase_change', phase: 'setupBench' });
    }
    return true;
  }

  if (G.phase === 'setupBench') {
    // choices = { benchSelections: [{handIdx, itemIdx}] }
    var selections = choices.benchSelections || [];

    // Resolve by descending card index so removals don't invalidate later picks.
    // This prevents setup-picked bench Pokemon/items from lingering in hand.
    var ordered = selections.slice().sort(function(a, b) { return b.handIdx - a.handIdx; });
    ordered.forEach(function(sel) {
      var maxBench = p.maxBench || Constants.MAX_BENCH;
      if (p.bench.length >= maxBench) return;
      var handIdx = sel.handIdx;
      if (handIdx === null || handIdx === undefined) return;
      if (handIdx < 0 || handIdx >= p.hand.length) return;

      var bcard = p.hand[handIdx];
      if (!bcard || bcard.type !== 'pokemon') return;

      var bPokData = PokemonDB.getPokemonData(bcard.name);
      var bCost = bPokData ? bPokData.cost : 0;
      if (p.mana < bCost) return;

      var itemIdx = sel.itemIdx;
      var bHeldItem = null;
      if (itemIdx !== null && itemIdx !== undefined && itemIdx >= 0 && itemIdx < p.hand.length && itemIdx !== handIdx) {
        var biCard = p.hand[itemIdx];
        if (biCard && biCard.type === 'items') {
          bHeldItem = biCard.name;
        }
      }

      p.mana -= bCost;
      var setupPk = makePokemon(bcard.name, bHeldItem);
      p.bench.push(setupPk);
      runOnPlayAbility(G, playerNum, setupPk);

      // Remove chosen cards directly by index (higher first to avoid shifts).
      if (itemIdx !== null && itemIdx !== undefined && itemIdx >= 0 && itemIdx < p.hand.length && itemIdx !== handIdx) {
        var hi = Math.max(handIdx, itemIdx);
        var lo = Math.min(handIdx, itemIdx);
        p.hand.splice(hi, 1);
        p.hand.splice(lo, 1);
      } else {
        p.hand.splice(handIdx, 1);
      }
    });

    // Advance
    if (playerNum === 1) {
      G.currentPlayer = 2;
    } else {
      G.phase = 'battle';
      G.currentPlayer = 1;
      G.turn = 1;
      G.players[1].mana = 0;
      G.players[2].mana = 0;
      G.events.push({ type: 'phase_change', phase: 'battle' });
      startTurn(G);
    }
    return true;
  }

  return false;
}

// ============================================================
// MAIN ACTION PROCESSOR
// ============================================================
function processAction(G, playerNum, action) {
  function finish(result) {
    applyBloomingGardenAura(G);
    return result;
  }

  if (G.winner) return finish(false);
  G.events = [];

  // Bench selection for retreat (can be non-current player for KO)
  if (action.type === 'selectBenchForRetreat') {
    return finish(doSelectBenchForRetreat(G, action.benchIdx, playerNum));
  }

  // Target selection (ability targets + attack targets)
  if (action.type === 'selectTarget') {
    if (!G.targeting) return finish(false);
    // Ability targets
    if (G.targeting.attackInfo && G.targeting.attackInfo.sourceType === 'ability') {
      return finish(doAbilityTarget(G, action.targetPlayer, action.targetBenchIdx));
    }
    // Attack targets (snipe, sniperBench, swarmSnipe, selfBenchDmg, anyStrip, multiTarget, benchEnergy)
    if (G.currentPlayer !== playerNum) return finish(false);
    return finish(doSelectTarget(G, action.targetPlayer, action.targetBenchIdx));
  }

  // All other actions require being current player in battle phase
  if (G.phase !== 'battle') return finish(false);
  if (G.currentPlayer !== playerNum) return finish(false);
  if (G.pendingRetreats.length > 0 || G.targeting) return finish(false);

  switch (action.type) {
    case 'attack': return finish(doAttack(G, action.attackIndex, action));
    case 'copiedAttack': return finish(doCopiedAttack(G, action.sourceName, action.attackIndex, action));
    case 'retreat': return finish(doRetreat(G));
    case 'quickRetreat': return finish(doQuickRetreat(G));
    case 'grantEnergy': return finish(doGrantEnergy(G, action.targetSlot, action.benchIdx));
    case 'playPokemon': return finish(doPlayPokemon(G, action.handIdx, action.itemHandIdx));
    case 'useAbility': return finish(doUseAbility(G, action.key, action.sourceBenchIdx));
    case 'discardItem': return finish(doDiscardItem(G, action.slot, action.benchIdx));
    case 'cancelTargeting': return finish(doCancelTargeting(G));
    case 'endTurn': return finish(doEndTurnAction(G));
    default: return finish(false);
  }
}

// ============================================================
// STATE FILTERING (for multiplayer — hide opponent hand/deck)
// ============================================================
function filterStateForPlayer(G, playerNum) {
  var state = JSON.parse(JSON.stringify(G));
  var oppNum = opp(playerNum);

  // Hide opponent hand/deck
  state.players[oppNum].handCount = state.players[oppNum].hand.length;
  state.players[oppNum].hand = [];
  state.players[oppNum].deckCount = state.players[oppNum].deck.length;
  state.players[oppNum].deck = [];
  state.myPlayerNum = playerNum;

  // Setup visibility rules
  if (G.phase === 'setupActive' && G.currentPlayer === oppNum) {
    state.players[oppNum].active = null;
    state.players[oppNum].mana = null;
  }
  if (G.phase === 'setupBench' && G.currentPlayer === oppNum) {
    state.players[oppNum].bench = [];
  }

  // Only show targeting if relevant
  if (G.targeting && G.currentPlayer !== playerNum) {
    state.targeting = null;
  }

  delete state.events;
  if (state.extraTurnFor == null) state.extraTurnFor = null;
  return state;
}

// ============================================================
// EXPORTS
// ============================================================
exports.createGame = createGame;
exports.makePokemon = makePokemon;
exports.startTurn = startTurn;
exports.endTurn = endTurn;
exports.switchTurn = switchTurn;
exports.processAction = processAction;
exports.processDeckConfirm = processDeckConfirm;
exports.processSetupChoice = processSetupChoice;
exports.filterStateForPlayer = filterStateForPlayer;
exports.getCopiedAttacks = getCopiedAttacks;
exports.doAbilityTarget = doAbilityTarget;
exports.addLog = addLog;
exports.isPassiveBlocked = isPassiveBlocked;
exports.opp = opp;

})(typeof module !== 'undefined' && module.exports ? module.exports : (this.GameLogic = {}));
