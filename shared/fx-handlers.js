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
  ctx.events.push({ type: 'statusApplied', pokemon: ctx.defender.name, status: 'poison', source: ctx.attack.name, owner: ctx.oppPlayerNum });
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
  ctx.events.push({ type: 'statusApplied', pokemon: ctx.defender.name, status: 'burn', source: ctx.attack.name, owner: ctx.oppPlayerNum });
  return null;
});

register('sleep', function(G, ctx, params) {
  if (!ctx.defender || ctx.defender.hp <= 0) return null;
  if (ctx.defender.heldItem === 'Protect Goggles') return null;
  if (ctx.defender.status.indexOf('sleep') !== -1) return null;
  ctx.defender.status.push('sleep');
  ctx.events.push({ type: 'statusApplied', pokemon: ctx.defender.name, status: 'sleep', source: ctx.attack.name, owner: ctx.oppPlayerNum });
  return null;
});

register('confuse', function(G, ctx, params) {
  if (!ctx.defender || ctx.defender.hp <= 0) return null;
  if (ctx.defender.heldItem === 'Protect Goggles') return null;
  if (ctx.defender.status.indexOf('confusion') !== -1) return null;
  ctx.defender.status.push('confusion');
  ctx.events.push({ type: 'statusApplied', pokemon: ctx.defender.name, status: 'confusion', source: ctx.attack.name, owner: ctx.oppPlayerNum });
  return null;
});

// --- Energy strip ---
register('stripEnergy', function(G, ctx, params) {
  _deps();
  if (!ctx.defender || ctx.defender.hp <= 0) return null;
  var v = params[0] || 1;
  var actual = Math.min(v, ctx.defender.energy);

  // White Herb check
  var defItems = DamagePipeline.getHeldItems(ctx.defender);
  if (defItems.indexOf('White Herb') !== -1 && !ctx.defender.heldItemUsed) {
    var whResult = ItemDB.runItemHook('onEnergyLoss', 'White Herb', { holder: ctx.defender, amount: actual });
    if (whResult) {
      var prevented = whResult.prevented || 0;
      actual = Math.max(0, actual - prevented);
      if (whResult.discard) {
        ctx.defender.heldItemUsed = true;
        if (ctx.defender.heldItem === 'White Herb') ctx.defender.heldItem = null;
        if (ctx.defender.heldItems) { var wi = ctx.defender.heldItems.indexOf('White Herb'); if (wi !== -1) ctx.defender.heldItems.splice(wi, 1); }
      }
      ctx.events.push({ type: 'itemProc', item: 'White Herb', pokemon: ctx.defender.name, effect: 'preventEnergyLoss', prevented: prevented });
    }
  }

  ctx.defender.energy = Math.max(0, ctx.defender.energy - actual);
  ctx.events.push({ type: 'energyStrip', pokemon: ctx.defender.name, amount: actual, targetOwner: ctx.oppPlayerNum });
  return null;
});

// --- Self damage ---
register('selfDmg', function(G, ctx, params) {
  _deps();
  var v = params[0] || 0;
  var selfAtk = { baseDmg: v, fx: '' };
  var result = DamagePipeline.dealAttackDamage(G, ctx.attacker, ctx.attacker, selfAtk, ctx.attackerTypes, ctx.currentPlayer);
  ctx.events.push({ type: 'selfDamage', pokemon: ctx.attacker.name, amount: result.result.damage, owner: ctx.currentPlayer });
  // Filter out the 'damage' event from pipeline results — selfDamage already shows the damage popup
  ctx.events = ctx.events.concat(result.events.filter(function(e) { return e.type !== 'damage'; }));
  return null;
});

// --- Self energy loss ---
register('selfEnergyLoss', function(G, ctx, params) {
  _deps();
  var v = params[0] || 1;
  if (v >= 99) v = ctx.attacker.energy;

  // White Herb on self
  var atkItems = DamagePipeline.getHeldItems(ctx.attacker);
  if (atkItems.indexOf('White Herb') !== -1 && !ctx.attacker.heldItemUsed) {
    var whResult = ItemDB.runItemHook('onEnergyLoss', 'White Herb', { holder: ctx.attacker, amount: v });
    if (whResult) {
      v = Math.max(0, v - (whResult.prevented || 0));
      if (whResult.discard) {
        ctx.attacker.heldItemUsed = true;
        if (ctx.attacker.heldItem === 'White Herb') ctx.attacker.heldItem = null;
        if (ctx.attacker.heldItems) { var wi = ctx.attacker.heldItems.indexOf('White Herb'); if (wi !== -1) ctx.attacker.heldItems.splice(wi, 1); }
      }
      ctx.events.push({ type: 'itemProc', item: 'White Herb', pokemon: ctx.attacker.name, effect: 'preventEnergyLoss', prevented: whResult.prevented });
    }
  }

  ctx.attacker.energy = Math.max(0, ctx.attacker.energy - v);
  ctx.events.push({ type: 'selfEnergyLoss', pokemon: ctx.attacker.name, amount: v, owner: ctx.currentPlayer });
  return null;
});

// --- Mutual energy loss (both actives lose energy) ---
register('mutualEnergyLoss', function(G, ctx, params) {
  _deps();
  var v = params[0] || 1;
  
  // Attacker loses energy
  var atkItems = DamagePipeline.getHeldItems(ctx.attacker);
  var atkLoss = v;
  if (atkItems.indexOf('White Herb') !== -1 && !ctx.attacker.heldItemUsed) {
    var whResult = ItemDB.runItemHook('onEnergyLoss', 'White Herb', { holder: ctx.attacker, amount: atkLoss });
    if (whResult) {
      atkLoss = Math.max(0, atkLoss - (whResult.prevented || 0));
      if (whResult.discard) {
        ctx.attacker.heldItemUsed = true;
        if (ctx.attacker.heldItem === 'White Herb') ctx.attacker.heldItem = null;
        if (ctx.attacker.heldItems) { var wi = ctx.attacker.heldItems.indexOf('White Herb'); if (wi !== -1) ctx.attacker.heldItems.splice(wi, 1); }
      }
      ctx.events.push({ type: 'itemProc', item: 'White Herb', pokemon: ctx.attacker.name, effect: 'preventEnergyLoss', prevented: whResult.prevented });
    }
  }
  ctx.attacker.energy = Math.max(0, ctx.attacker.energy - atkLoss);
  if (atkLoss > 0) {
    ctx.events.push({ type: 'selfEnergyLoss', pokemon: ctx.attacker.name, amount: atkLoss, owner: ctx.currentPlayer });
  }

  // Defender loses energy
  if (ctx.defender && ctx.defender.hp > 0) {
    var defItems = DamagePipeline.getHeldItems(ctx.defender);
    var defLoss = v;
    if (defItems.indexOf('White Herb') !== -1 && !ctx.defender.heldItemUsed) {
      var whDefResult = ItemDB.runItemHook('onEnergyLoss', 'White Herb', { holder: ctx.defender, amount: defLoss });
      if (whDefResult) {
        defLoss = Math.max(0, defLoss - (whDefResult.prevented || 0));
        if (whDefResult.discard) {
          ctx.defender.heldItemUsed = true;
          if (ctx.defender.heldItem === 'White Herb') ctx.defender.heldItem = null;
          if (ctx.defender.heldItems) { var wi = ctx.defender.heldItems.indexOf('White Herb'); if (wi !== -1) ctx.defender.heldItems.splice(wi, 1); }
        }
        ctx.events.push({ type: 'itemProc', item: 'White Herb', pokemon: ctx.defender.name, effect: 'preventEnergyLoss', prevented: whDefResult.prevented });
      }
    }
    ctx.defender.energy = Math.max(0, ctx.defender.energy - defLoss);
    if (defLoss > 0) {
      ctx.events.push({ type: 'energyStrip', pokemon: ctx.defender.name, amount: defLoss, targetOwner: ctx.oppPlayerNum });
    }
  }
  
  return null;
});

// --- Extra turn ---
register('extraTurn', function(G, ctx, params) {
  G.extraTurnFor = ctx.currentPlayer;
  ctx.events.push({ type: 'extra_turn', player: ctx.currentPlayer, pokemon: ctx.attacker.name });
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
    ctx.events.push({ type: 'statusApplied', pokemon: ctx.attacker.name, status: 'sleep', source: 'self', owner: ctx.currentPlayer });
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
    G.pendingRetreats.push({ player: ctx.oppPlayerNum, reason: 'forced', afterEndTurn: true });
    ctx.events.push({ type: 'retreat_pending', player: ctx.oppPlayerNum, reason: 'forcedSwitch' });
    return 'pendingRetreat';
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

// --- ALL bench damage (both sides) ---
register('allBenchDmg', function(G, ctx, params) {
  _deps();
  var v = params[0] || 0;
  var benchAtk = { baseDmg: v, fx: '' };
  // Damage opponent's bench
  ctx.oppPlayer.bench.forEach(function(pk) {
    var result = DamagePipeline.dealAttackDamage(G, ctx.attacker, pk, benchAtk, ctx.attackerTypes, ctx.oppPlayerNum);
    ctx.events = ctx.events.concat(result.events);
  });
  // Damage own bench
  ctx.myPlayer.bench.forEach(function(pk) {
    var result = DamagePipeline.dealAttackDamage(G, ctx.attacker, pk, benchAtk, ctx.attackerTypes, ctx.currentPlayer);
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

// --- Self bench damage (choose one of your bench Pokemon) ---
register('selfBenchDmg', function(G, ctx, params) {
  _deps();
  var v = params[0] || 0;
  if (v <= 0) return null;
  var validTargets = [];
  ctx.myPlayer.bench.forEach(function(pk, bi) {
    if (pk && pk.hp > 0) validTargets.push({ player: ctx.currentPlayer, idx: bi, pk: pk });
  });

  if (validTargets.length > 0) {
    ctx.targetingInfo = {
      type: 'selfBenchDmg',
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

// --- Heal all allies ---
register('healAll', function(G, ctx, params) {
  var v = params[0] || 0;
  if (v <= 0) return null;
  var allies = [ctx.myPlayer.active].concat(ctx.myPlayer.bench).filter(Boolean);
  allies.forEach(function(pk) {
    if (pk.damage > 0) {
      var before = pk.damage;
      pk.damage = Math.max(0, pk.damage - v);
      var healed = before - pk.damage;
      if (healed > 0) {
        pk.hp = pk.maxHp - pk.damage;
        ctx.events.push({ type: 'heal', pokemon: pk.name, amount: healed, source: 'healAll' });
      }
    }
  });
  return null;
});

// --- Lock attack ---
register('lockAttack', function(G, ctx, params) {
  ctx.attacker.cantUseAttack = ctx.attack.name;
  ctx.attacker.cantUseAttackUntilTurn = G.turn + 2;
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
      ctx.events.push({ type: 'statusApplied', pokemon: ctx.defender.name, status: 'burn', source: 'Hex Burn', owner: ctx.oppPlayerNum });
    }
  }
  return null;
});

// --- Confuse both ---
register('confuseBoth', function(G, ctx, params) {
  if (ctx.attacker.hp > 0 && ctx.attacker.heldItem !== 'Protect Goggles' && ctx.attacker.status.indexOf('confusion') === -1) {
    ctx.attacker.status.push('confusion');
    ctx.events.push({ type: 'statusApplied', pokemon: ctx.attacker.name, status: 'confusion', source: 'Confusion Wave', owner: ctx.currentPlayer });
  }
  if (ctx.defender && ctx.defender.hp > 0 && ctx.defender.heldItem !== 'Protect Goggles' && ctx.defender.status.indexOf('confusion') === -1) {
    ctx.defender.status.push('confusion');
    ctx.events.push({ type: 'statusApplied', pokemon: ctx.defender.name, status: 'confusion', source: 'Confusion Wave', owner: ctx.oppPlayerNum });
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

// --- Conditional bench damage (target one bench Pokemon if threshold met) ---
register('condBench', function(G, ctx, params) {
  _deps();
  var threshold = params[0] || 0;
  var dmg = params[1] || 0;
  if (ctx.attacker.energy >= threshold && ctx.oppPlayer.bench.length > 0) {
    var validTargets = [];
    ctx.oppPlayer.bench.forEach(function(pk, bi) {
      if (pk.hp > 0) validTargets.push({ player: ctx.oppPlayerNum, idx: bi, pk: pk });
    });
    
    if (validTargets.length > 0) {
      ctx.targetingInfo = {
        type: 'condBench',
        validTargets: validTargets,
        baseDmg: dmg,
        attackerTypes: ctx.attackerTypes,
        attacker: ctx.attacker,
        attack: ctx.attack,
        threshold: threshold
      };
      return 'pendingTarget';
    }
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

// --- Any strip (pick any opponent Pokemon with energy) ---
register('anyStrip', function(G, ctx, params) {
  var v = params[0] || 1;
  if (v <= 0) return null;
  var validTargets = [];
  if (ctx.oppPlayer.active && ctx.oppPlayer.active.energy > 0 && ctx.oppPlayer.active.heldItem !== 'Protect Goggles') {
    validTargets.push({ player: ctx.oppPlayerNum, idx: -1, pk: ctx.oppPlayer.active });
  }
  ctx.oppPlayer.bench.forEach(function(pk, bi) {
    if (pk && pk.energy > 0 && pk.heldItem !== 'Protect Goggles') {
      validTargets.push({ player: ctx.oppPlayerNum, idx: bi, pk: pk });
    }
  });

  if (validTargets.length > 0) {
    ctx.targetingInfo = {
      type: 'anyStrip',
      validTargets: validTargets,
      amount: v,
      attacker: ctx.attacker,
      attackerTypes: ctx.attackerTypes,
      attack: ctx.attack
    };
    return 'pendingTarget';
  }

  return null;
});

// --- Multi-target (pick targets one-by-one) ---
register('multiTarget', function(G, ctx, params) {
  _deps();
  var dmg = params[0] || 0;
  var count = params[1] || 1;
  if (dmg <= 0 || count <= 0) return null;

  var validTargets = [];
  if (ctx.oppPlayer.active && ctx.oppPlayer.active.hp > 0) {
    validTargets.push({ player: ctx.oppPlayerNum, idx: -1, pk: ctx.oppPlayer.active });
  }
  ctx.oppPlayer.bench.forEach(function(pk, bi) {
    if (pk && pk.hp > 0) validTargets.push({ player: ctx.oppPlayerNum, idx: bi, pk: pk });
  });

  if (validTargets.length > 0) {
    ctx.attacker.energy = Math.max(0, ctx.attacker.energy - 2);
    ctx.events.push({ type: 'multiTarget', dmg: dmg, count: count });
    ctx.targetingInfo = {
      type: 'multiTarget',
      validTargets: validTargets,
      baseDmg: dmg,
      remaining: Math.min(count, validTargets.length),
      attacker: ctx.attacker,
      attackerTypes: ctx.attackerTypes,
      attack: ctx.attack
    };
    return 'pendingTarget';
  }

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

// --- Bench energy target (choose one of your bench Pokémon) ---
register('benchEnergy', function(G, ctx, params) {
  _deps();
  var amount = params[0] || 0;
  if (amount <= 0) return null;

  var validTargets = [];
  ctx.myPlayer.bench.forEach(function(pk, bi) {
    if (pk && pk.hp > 0 && pk.energy < Constants.MAX_ENERGY) {
      validTargets.push({ player: ctx.currentPlayer, idx: bi, pk: pk });
    }
  });

  if (validTargets.length > 0) {
    ctx.targetingInfo = {
      type: 'benchEnergy',
      validTargets: validTargets,
      amount: amount,
      attacker: ctx.attacker,
      attackerTypes: ctx.attackerTypes,
      attack: ctx.attack
    };
    return 'pendingTarget';
  }

  return null;
});

// --- Pre-damage effects (processed before main damage) ---
// selfEnergy, gainMana, benchEnergyAll
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

    events.push({ type: 'energyGain', pokemon: attacker.name, amount: gained, source: 'selfEnergy', owner: currentPlayer });
  }

  if (fx.indexOf('gainMana:') !== -1) {
    var v = parseInt(fx.split('gainMana:')[1]);
    p.mana = Math.min(Constants.MAX_MANA, p.mana + v);
    events.push({ type: 'manaGain', player: currentPlayer, amount: v });
  }

  if (fx.indexOf('doubleMana') !== -1) {
    var beforeMana = p.mana;
    p.mana = Math.min(Constants.MAX_MANA, p.mana * 2);
    var manaGained = p.mana - beforeMana;
    if (manaGained > 0) {
      events.push({ type: 'manaGain', player: currentPlayer, amount: manaGained });
    }
  }

  if (fx.indexOf('benchEnergyAll') !== -1) {
    p.bench.forEach(function(pk, i) {
      if (pk.energy < Constants.MAX_ENERGY) {
        pk.energy++;
        events.push({ type: 'energyGain', pokemon: pk.name, amount: 1, source: 'benchEnergyAll', benchIdx: i, owner: currentPlayer });
      }
    });
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
