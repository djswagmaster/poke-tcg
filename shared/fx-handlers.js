// ============================================================
// POKEMON TCG - Attack Effect (FX) Handler Registry (Shared)
// ============================================================
// Replaces the ~300-line if/else chain in processAttackFx.
// Each effect registers a handler function. Adding a new effect
// = one FX.register() call. No touching the core attack loop.
//
// Handlers receive (G, ctx, params) where:
//   G = game state
//   ctx = { attacker, defender, attack, attackerData, attackerTypes,
//           currentPlayer, oppPlayer, events }
//   params = parsed from fx string (e.g. "selfDmg:50" → [50])
//
// Handlers MUST be synchronous. They push to ctx.events and
// return a control signal or null:
//   null          — continue processing
//   'pendingTarget' — needs target selection (snipe, etc.)
//   'pendingRetreat'— needs bench selection (selfRetreat, batonPass)
//
// Works in both browser (global) and Node.js (module.exports).
// ============================================================
(function(exports) {
'use strict';

var Constants, PokemonDB, ItemDB, DamagePipeline;

function _deps() {
  if (typeof require !== 'undefined') {
    if (!Constants) Constants = require('./constants');
    if (!PokemonDB) PokemonDB = require('./pokemon-db');
    if (!ItemDB) ItemDB = require('./item-db');
    if (!DamagePipeline) DamagePipeline = require('./damage-pipeline');
  } else {
    Constants = Constants || (typeof window !== 'undefined' && window.Constants) || {};
    PokemonDB = PokemonDB || (typeof window !== 'undefined' && window.PokemonDB) || {};
    ItemDB = ItemDB || (typeof window !== 'undefined' && window.ItemDB) || {};
    DamagePipeline = DamagePipeline || (typeof window !== 'undefined' && window.DamagePipeline) || {};
  }
}

// ============================================================
// REGISTRY
// ============================================================
var _handlers = {};

function register(key, handler) {
  _handlers[key] = handler;
}

/**
 * Process all FX in an fx string for a given attack.
 * Returns { signal, events, targetingInfo }
 *   signal: null | 'pendingTarget' | 'pendingRetreat'
 *   events: accumulated event objects
 *   targetingInfo: if signal='pendingTarget', describes what targets are valid
 */
function processAll(G, fx, attacker, defender, attack, useOptBoost) {
  _deps();
  var currentPlayer = G.currentPlayer;
  var oppPlayerNum = Constants.opp(currentPlayer);
  var p = G.players[currentPlayer];
  var op = G.players[oppPlayerNum];
  var attackerData = PokemonDB.getPokemonData(attacker.name);

  var ctx = {
    G: G,
    attacker: attacker,
    defender: defender,
    attack: attack,
    attackerData: attackerData,
    attackerTypes: attackerData.types,
    currentPlayer: currentPlayer,
    oppPlayerNum: oppPlayerNum,
    myPlayer: p,
    oppPlayer: op,
    events: [],
    useOptBoost: useOptBoost || false
  };

  // Process each registered handler that matches the fx string
  for (var key in _handlers) {
    if (fx.indexOf(key) !== -1) {
      // Parse params from fx string: "key:param1:param2" → [param1, param2]
      var params = [];
      var fxMatch = fx.match(new RegExp(key + ':([^,]+)'));
      if (fxMatch) {
        params = fxMatch[1].split(':').map(function(v) { return isNaN(v) ? v : parseInt(v); });
      }
      // Some FX like 'poison', 'burn' have no params
      var signal = _handlers[key](G, ctx, params);
      if (signal === 'pendingTarget' || signal === 'pendingRetreat') {
        return { signal: signal, events: ctx.events, targetingInfo: ctx.targetingInfo };
      }
    }
  }

  // Always reset optBoost after processing
  ctx.useOptBoost = false;

  return { signal: null, events: ctx.events, targetingInfo: null };
}

// ============================================================
// BUILT-IN FX HANDLERS
// ============================================================

// --- Status effects ---
register('poison', function(G, ctx, params) {
  if (!ctx.defender || ctx.defender.hp <= 0) return null;
  if (ctx.defender.heldItem === 'Protect Goggles') return null;
  if (ctx.defender.status.indexOf('poison') !== -1) return null;
  ctx.defender.status.push('poison');
  ctx.events.push({ type: 'statusApplied', pokemon: ctx.defender.name, status: 'poison', source: ctx.attack.name });
  return null;
});

register('burn', function(G, ctx, params) {
  if (!ctx.defender || ctx.defender.hp <= 0) return null;
  if (ctx.defender.heldItem === 'Protect Goggles') return null;
  if (ctx.defender.status.indexOf('burn') !== -1) return null;
  // Don't trigger from hexBurn (has its own handler)
  var fx = ctx.attack.fx || '';
  if (fx === 'hexBurn') return null;
  ctx.defender.status.push('burn');
  ctx.events.push({ type: 'statusApplied', pokemon: ctx.defender.name, status: 'burn', source: ctx.attack.name });
  return null;
});

register('sleep', function(G, ctx, params) {
  if (!ctx.defender || ctx.defender.hp <= 0) return null;
  if (ctx.defender.heldItem === 'Protect Goggles') return null;
  if (ctx.defender.status.indexOf('sleep') !== -1) return null;
  ctx.defender.status.push('sleep');
  ctx.events.push({ type: 'statusApplied', pokemon: ctx.defender.name, status: 'sleep', source: ctx.attack.name });
  return null;
});

// --- Energy strip ---
register('stripEnergy', function(G, ctx, params) {
  if (!ctx.defender || ctx.defender.hp <= 0) return null;
  var v = params[0] || 1;
  var actual = Math.min(v, ctx.defender.energy);

  // White Herb check
  if (ctx.defender.heldItem === 'White Herb' && !ctx.defender.heldItemUsed) {
    var whResult = ItemDB.runItemHook('onEnergyLoss', 'White Herb', { holder: ctx.defender, amount: actual });
    if (whResult) {
      var prevented = whResult.prevented || 0;
      actual = Math.max(0, actual - prevented);
      if (whResult.discard) { ctx.defender.heldItemUsed = true; ctx.defender.heldItem = null; }
      ctx.events.push({ type: 'itemProc', item: 'White Herb', pokemon: ctx.defender.name, effect: 'preventEnergyLoss', prevented: prevented });
    }
  }

  ctx.defender.energy = Math.max(0, ctx.defender.energy - (params[0] || 1));
  ctx.events.push({ type: 'energyStrip', pokemon: ctx.defender.name, amount: params[0] || 1 });
  return null;
});

// --- Self damage ---
register('selfDmg', function(G, ctx, params) {
  _deps();
  var v = params[0] || 0;
  var selfAtk = { baseDmg: v, fx: '' };
  var result = DamagePipeline.dealAttackDamage(G, ctx.attacker, ctx.attacker, selfAtk, ctx.attackerTypes, ctx.currentPlayer);
  ctx.events.push({ type: 'selfDamage', pokemon: ctx.attacker.name, amount: v });
  ctx.events = ctx.events.concat(result.events);
  return null;
});

// --- Self energy loss ---
register('selfEnergyLoss', function(G, ctx, params) {
  var v = params[0] || 1;
  if (v >= 99) v = ctx.attacker.energy;

  // White Herb on self
  if (ctx.attacker.heldItem === 'White Herb' && !ctx.attacker.heldItemUsed) {
    var whResult = ItemDB.runItemHook('onEnergyLoss', 'White Herb', { holder: ctx.attacker, amount: v });
    if (whResult) {
      v = Math.max(0, v - (whResult.prevented || 0));
      if (whResult.discard) { ctx.attacker.heldItemUsed = true; ctx.attacker.heldItem = null; }
      ctx.events.push({ type: 'itemProc', item: 'White Herb', pokemon: ctx.attacker.name, effect: 'preventEnergyLoss', prevented: whResult.prevented });
    }
  }

  ctx.attacker.energy = Math.max(0, ctx.attacker.energy - v);
  ctx.events.push({ type: 'selfEnergyLoss', pokemon: ctx.attacker.name, amount: v });
  return null;
});

// --- Self shield ---
register('selfShield', function(G, ctx, params) {
  var v = params[0] || 0;
  ctx.attacker.shields.push(v);
  ctx.events.push({ type: 'shield', pokemon: ctx.attacker.name, amount: v });
  return null;
});

// --- Self vulnerability ---
register('selfVuln', function(G, ctx, params) {
  var v = params[0] || 0;
  ctx.attacker.vulnerability = v;
  ctx.events.push({ type: 'vulnerability', pokemon: ctx.attacker.name, amount: v });
  return null;
});

// --- Self sleep ---
register('selfSleep', function(G, ctx, params) {
  if (ctx.attacker.status.indexOf('sleep') === -1) {
    ctx.attacker.status.push('sleep');
    ctx.events.push({ type: 'statusApplied', pokemon: ctx.attacker.name, status: 'sleep', source: 'self' });
  }
  return null;
});

// --- Self retreat (forced) ---
register('selfRetreat', function(G, ctx, params) {
  if (ctx.myPlayer.bench.length > 0) {
    G.pendingRetreats.push({ player: ctx.currentPlayer, reason: 'forced', afterEndTurn: true });
    ctx.events.push({ type: 'forcedRetreat', player: ctx.currentPlayer });
    return 'pendingRetreat';
  }
  return null;
});

// --- Force opponent switch ---
register('forceSwitch', function(G, ctx, params) {
  if (ctx.oppPlayer.bench.length > 0 && ctx.defender && ctx.defender.hp > 0) {
    var newActive = ctx.oppPlayer.bench.shift();
    if (ctx.oppPlayer.active.status.length > 0) {
      ctx.events.push({ type: 'statusCured', pokemon: ctx.oppPlayer.active.name, reason: 'bench' });
      ctx.oppPlayer.active.status = [];
    }
    ctx.oppPlayer.bench.push(ctx.oppPlayer.active);
    ctx.oppPlayer.active = newActive;
    ctx.events.push({ type: 'forceSwitch', oldActive: ctx.defender.name, newActive: newActive.name });
  }
  return null;
});

// --- Bench damage to ALL benches ---
register('benchAll', function(G, ctx, params) {
  _deps();
  var v = params[0] || 0;
  var benchAllAtk = { baseDmg: v, fx: '' };
  var allBench = [];
  ctx.myPlayer.bench.forEach(function(pk) { allBench.push({ pk: pk, owner: ctx.currentPlayer }); });
  ctx.oppPlayer.bench.forEach(function(pk) { allBench.push({ pk: pk, owner: ctx.oppPlayerNum }); });
  allBench.forEach(function(entry) {
    var result = DamagePipeline.dealAttackDamage(G, ctx.attacker, entry.pk, benchAllAtk, ctx.attackerTypes, entry.owner);
    ctx.events = ctx.events.concat(result.events);
  });
  return null;
});

// --- Opp bench damage ---
register('oppBenchDmg', function(G, ctx, params) {
  _deps();
  var v = params[0] || 0;
  var benchAtk = { baseDmg: v, fx: '' };
  ctx.oppPlayer.bench.forEach(function(pk) {
    var result = DamagePipeline.dealAttackDamage(G, ctx.attacker, pk, benchAtk, ctx.attackerTypes, ctx.oppPlayerNum);
    ctx.events = ctx.events.concat(result.events);
  });
  return null;
});

// --- Sniper bench (choose any bench target) ---
register('sniperBench', function(G, ctx, params) {
  _deps();
  var v = params[0] || 0;
  var validTargets = [];
  ctx.oppPlayer.bench.forEach(function(pk, bi) { if (pk.hp > 0) validTargets.push({ player: ctx.oppPlayerNum, idx: bi, pk: pk }); });
  ctx.myPlayer.bench.forEach(function(pk, bi) { if (pk.hp > 0) validTargets.push({ player: ctx.currentPlayer, idx: bi, pk: pk }); });

  if (validTargets.length > 0) {
    ctx.targetingInfo = {
      type: 'sniperBench',
      validTargets: validTargets,
      baseDmg: v,
      attackerTypes: ctx.attackerTypes,
      attacker: ctx.attacker,
      attack: ctx.attack
    };
    return 'pendingTarget';
  }
  return null;
});

// --- Self bench damage ---
register('selfBenchDmg', function(G, ctx, params) {
  _deps();
  var v = params[0] || 0;
  if (ctx.myPlayer.bench.length > 0) {
    var target = ctx.myPlayer.bench[0];
    var sbAtk = { baseDmg: v, fx: '' };
    var result = DamagePipeline.dealAttackDamage(G, ctx.attacker, target, sbAtk, ctx.attackerTypes, ctx.currentPlayer);
    ctx.events.push({ type: 'selfBenchDmg', pokemon: target.name, amount: v });
    ctx.events = ctx.events.concat(result.events);
  }
  return null;
});

// --- Grass weakness (Forest's Curse) ---
register('grassWeakness', function(G, ctx, params) {
  var oppPokemon = [ctx.oppPlayer.active].concat(ctx.oppPlayer.bench).filter(Boolean);
  oppPokemon.forEach(function(pk) { pk.grassWeakUntil = G.turn + 2; });
  ctx.events.push({ type: 'grassWeakness' });
  return null;
});

// --- Opponent mana loss ---
register('oppMana', function(G, ctx, params) {
  var v = params[0] || 0;
  ctx.oppPlayer.mana = Math.max(0, ctx.oppPlayer.mana + v);
  ctx.events.push({ type: 'manaChange', player: ctx.oppPlayerNum, amount: v });
  return null;
});

// --- Heal self ---
register('healSelf', function(G, ctx, params) {
  var v = params[0] || 0;
  ctx.attacker.damage = Math.max(0, ctx.attacker.damage - v);
  ctx.attacker.hp = ctx.attacker.maxHp - ctx.attacker.damage;
  ctx.events.push({ type: 'heal', pokemon: ctx.attacker.name, amount: v });
  return null;
});

// --- Lock attack ---
register('lockAttack', function(G, ctx, params) {
  ctx.attacker.cantUseAttack = ctx.attack.name;
  ctx.events.push({ type: 'lockAttack', pokemon: ctx.attacker.name, attack: ctx.attack.name });
  return null;
});

// --- Mad Party ---
register('madParty', function(G, ctx, params) {
  _deps();
  if (!ctx.defender) return null;
  var total = [ctx.myPlayer.active, ctx.oppPlayer.active].concat(ctx.myPlayer.bench).concat(ctx.oppPlayer.bench).filter(Boolean).length;
  var madAtk = { baseDmg: total * 10, fx: '' };
  var result = DamagePipeline.dealAttackDamage(G, ctx.attacker, ctx.defender, madAtk, ctx.attackerTypes, ctx.oppPlayerNum);
  ctx.events.push({ type: 'madParty', count: total });
  ctx.events = ctx.events.concat(result.events);
  return null;
});

// --- Finishing Fang ---
register('finishingFang', function(G, ctx, params) {
  _deps();
  if (!ctx.defender || ctx.defender.hp <= 0) return null;
  if (ctx.defender.hp <= 120) {
    var fangAtk = { baseDmg: 60, fx: '' };
    var result = DamagePipeline.dealAttackDamage(G, ctx.attacker, ctx.defender, fangAtk, ctx.attackerTypes, ctx.oppPlayerNum);
    ctx.events.push({ type: 'finishingFang', bonusDamage: true });
    ctx.events = ctx.events.concat(result.events);
  }
  return null;
});

// --- Hex Burn ---
register('hexBurn', function(G, ctx, params) {
  if (!ctx.defender || ctx.defender.hp <= 0) return null;
  if (ctx.defender.status.length > 0 && ctx.defender.heldItem !== 'Protect Goggles') {
    if (ctx.defender.status.indexOf('burn') === -1) {
      ctx.defender.status.push('burn');
      ctx.events.push({ type: 'statusApplied', pokemon: ctx.defender.name, status: 'burn', source: 'Hex Burn' });
    }
  }
  return null;
});

// --- Confuse both ---
register('confuseBoth', function(G, ctx, params) {
  if (ctx.attacker.hp > 0 && ctx.attacker.heldItem !== 'Protect Goggles' && ctx.attacker.status.indexOf('confusion') === -1) {
    ctx.attacker.status.push('confusion');
    ctx.events.push({ type: 'statusApplied', pokemon: ctx.attacker.name, status: 'confusion', source: 'Confusion Wave' });
  }
  if (ctx.defender && ctx.defender.hp > 0 && ctx.defender.heldItem !== 'Protect Goggles' && ctx.defender.status.indexOf('confusion') === -1) {
    ctx.defender.status.push('confusion');
    ctx.events.push({ type: 'statusApplied', pokemon: ctx.defender.name, status: 'confusion', source: 'Confusion Wave' });
  }
  return null;
});

// --- Swarm Snipe ---
register('swarmSnipe', function(G, ctx, params) {
  _deps();
  var myCount = [ctx.myPlayer.active].concat(ctx.myPlayer.bench).filter(Boolean).length;
  var swarmBaseDmg = myCount * 10;
  var validTargets = [];
  [ctx.currentPlayer, ctx.oppPlayerNum].forEach(function(pNum) {
    var side = G.players[pNum];
    if (side.active && side.active.hp > 0) validTargets.push({ player: pNum, idx: -1, pk: side.active });
    side.bench.forEach(function(pk, bi) { if (pk.hp > 0) validTargets.push({ player: pNum, idx: bi, pk: pk }); });
  });

  if (validTargets.length > 0) {
    ctx.targetingInfo = {
      type: 'swarmSnipe',
      validTargets: validTargets,
      baseDmg: swarmBaseDmg,
      attackerTypes: ctx.attackerTypes,
      attacker: ctx.attacker,
      attack: ctx.attack
    };
    return 'pendingTarget';
  }
  return null;
});

// --- Conditional bench damage ---
register('condBench', function(G, ctx, params) {
  _deps();
  var threshold = params[0] || 0;
  var dmg = params[1] || 0;
  if (ctx.attacker.energy >= threshold && ctx.oppPlayer.bench.length > 0) {
    var condAtk = { baseDmg: dmg, fx: '' };
    ctx.oppPlayer.bench.forEach(function(pk) {
      var result = DamagePipeline.dealAttackDamage(G, ctx.attacker, pk, condAtk, ctx.attackerTypes, ctx.oppPlayerNum);
      ctx.events = ctx.events.concat(result.events);
    });
    ctx.events.push({ type: 'condBench', threshold: threshold, dmg: dmg });
  }
  return null;
});

// --- Optional boost (optBoost:extraDmg:energyCost) ---
register('optBoost', function(G, ctx, params) {
  _deps();
  if (!ctx.useOptBoost) return null;
  var extraDmg = params[0] || 0;
  var energyCost = params[1] || 0;
  if (!ctx.defender || ctx.defender.hp <= 0) return null;
  if (ctx.attacker.energy >= energyCost) {
    ctx.attacker.energy -= energyCost;
    var boostAtk = { baseDmg: extraDmg, fx: '' };
    var result = DamagePipeline.dealAttackDamage(G, ctx.attacker, ctx.defender, boostAtk, ctx.attackerTypes, ctx.oppPlayerNum);
    ctx.events.push({ type: 'optBoost', extraDmg: extraDmg, energyCost: energyCost });
    ctx.events = ctx.events.concat(result.events);
  }
  return null;
});

// --- Any strip (strip from any opp pokemon with energy) ---
register('anyStrip', function(G, ctx, params) {
  var v = params[0] || 1;
  var oppAll = [ctx.oppPlayer.active].concat(ctx.oppPlayer.bench).filter(function(pk) {
    return pk && pk.energy > 0 && pk.heldItem !== 'Protect Goggles';
  });
  if (oppAll.length > 0) {
    var target = oppAll[0];
    var actual = Math.min(v, target.energy);
    target.energy = Math.max(0, target.energy - actual);
    ctx.events.push({ type: 'energyStrip', pokemon: target.name, amount: actual, source: 'anyStrip' });
  }
  return null;
});

// --- Multi-target ---
register('multiTarget', function(G, ctx, params) {
  _deps();
  var dmg = params[0] || 0;
  var count = params[1] || 1;
  var targets = [ctx.oppPlayer.active].concat(ctx.oppPlayer.bench).filter(Boolean).slice(0, count);
  var multiAtk = { baseDmg: dmg, fx: '' };
  targets.forEach(function(target) {
    var result = DamagePipeline.dealAttackDamage(G, ctx.attacker, target, multiAtk, ctx.attackerTypes, ctx.oppPlayerNum);
    ctx.events = ctx.events.concat(result.events);
  });
  ctx.attacker.energy = Math.max(0, ctx.attacker.energy - 2);
  ctx.events.push({ type: 'multiTarget', dmg: dmg, count: count });
  return null;
});

// --- Baton Pass ---
register('batonPass', function(G, ctx, params) {
  if (ctx.myPlayer.bench.length > 0) {
    G.pendingRetreats.push({
      player: ctx.currentPlayer, reason: 'batonPass', afterEndTurn: true,
      transferEnergy: ctx.attacker.energy
    });
    ctx.attacker.attackedThisTurn = true;
    ctx.events.push({ type: 'batonPass', pokemon: ctx.attacker.name });
    return 'pendingRetreat';
  }
  return null;
});

// --- Snipe (hit any Pokemon) ---
register('snipe', function(G, ctx, params) {
  _deps();
  var validTargets = [];
  [ctx.currentPlayer, ctx.oppPlayerNum].forEach(function(pNum) {
    var side = G.players[pNum];
    if (side.active && side.active.hp > 0) validTargets.push({ player: pNum, idx: -1, pk: side.active });
    side.bench.forEach(function(pk, bi) { if (pk.hp > 0) validTargets.push({ player: pNum, idx: bi, pk: pk }); });
  });

  if (validTargets.length > 0) {
    ctx.targetingInfo = {
      type: 'snipe',
      validTargets: validTargets,
      baseDmg: ctx.attack.baseDmg,
      attackerTypes: ctx.attackerTypes,
      attacker: ctx.attacker,
      attack: ctx.attack
    };
    return 'pendingTarget';
  }
  return null;
});

// --- Pre-damage effects (processed before main damage) ---
// selfEnergy, gainMana, benchEnergyAll, benchEnergy
// These are handled separately in processPreDamageEffects

/**
 * Process pre-damage effects (energy/mana gains that happen before damage).
 * Returns events array.
 */
function processPreDamageEffects(G, fx, attacker, currentPlayer) {
  _deps();
  var events = [];
  var p = G.players[currentPlayer];

  if (fx.indexOf('selfEnergy:') !== -1) {
    var v = parseInt(fx.split('selfEnergy:')[1]);
    var oldEnergy = attacker.energy;
    attacker.energy = Math.min(Constants.MAX_ENERGY, attacker.energy + v);
    var gained = attacker.energy - oldEnergy;

    // Healing Scarf
    if (attacker.heldItem === 'Healing Scarf' && attacker.damage > 0 && gained > 0) {
      var heal = 20 * gained;
      attacker.damage = Math.max(0, attacker.damage - heal);
      attacker.hp = attacker.maxHp - attacker.damage;
      events.push({ type: 'itemProc', item: 'Healing Scarf', pokemon: attacker.name, effect: 'heal', amount: heal });
    }

    events.push({ type: 'energyGain', pokemon: attacker.name, amount: gained, source: 'selfEnergy' });
  }

  if (fx.indexOf('gainMana:') !== -1) {
    var v = parseInt(fx.split('gainMana:')[1]);
    p.mana = Math.min(Constants.MAX_MANA, p.mana + v);
    events.push({ type: 'manaGain', player: currentPlayer, amount: v });
  }

  if (fx.indexOf('benchEnergyAll') !== -1) {
    p.bench.forEach(function(pk, i) {
      if (pk.energy < Constants.MAX_ENERGY) {
        pk.energy++;
        events.push({ type: 'energyGain', pokemon: pk.name, amount: 1, source: 'benchEnergyAll', benchIdx: i });
      }
    });
  }

  if (fx.indexOf('benchEnergy:') !== -1) {
    var target = p.bench.find(function(pk) { return pk.energy < Constants.MAX_ENERGY; });
    if (target) {
      target.energy++;
      events.push({ type: 'energyGain', pokemon: target.name, amount: 1, source: 'benchEnergy', benchIdx: p.bench.indexOf(target) });
    }
  }

  return events;
}

// ============================================================
// SUSTAINED TRACKING
// ============================================================
// The 'sustained' fx doesn't need a handler because it's handled
// in calcDamage (via the scaling). The tracking is in endTurn.

// ============================================================
// EXPORTS
// ============================================================
exports.register = register;
exports.processAll = processAll;
exports.processPreDamageEffects = processPreDamageEffects;

})(typeof module !== 'undefined' && module.exports ? module.exports : (this.FXHandlers = {}));
