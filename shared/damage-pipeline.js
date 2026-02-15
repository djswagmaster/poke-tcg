// ============================================================
// POKEMON TCG - Unified Damage Pipeline (Shared)
// ============================================================
// Single entry point for ALL damage in the game.
// Replaces the scattered calcDamage/dealDamage/checkItem calls.
//
// Pipeline:
//   1. calcDamage()         — compute base, modifiers, weakness/resistance
//   2. applyDamage()        — subtract HP, check Focus Sash, Sitrus Berry
//   3. runReactiveItems()   — Rocky Helmet, Burn Scarf, etc.
//   4. checkKO()            — handle KO if hp <= 0
//
// All functions are SYNCHRONOUS and return events arrays.
// The client replays events with animations; the server broadcasts them.
//
// Works in both browser (global) and Node.js (module.exports).
// ============================================================
(function(exports) {
'use strict';

// Dependencies — resolved at runtime
var Constants, PokemonDB, ItemDB;

function _deps() {
  if (typeof require !== 'undefined') {
    if (!Constants) Constants = require('./constants');
    if (!PokemonDB) PokemonDB = require('./pokemon-db');
    if (!ItemDB) ItemDB = require('./item-db');
  } else {
    Constants = Constants || (typeof window !== 'undefined' && window.Constants) || {};
    PokemonDB = PokemonDB || (typeof window !== 'undefined' && window.PokemonDB) || {};
    ItemDB = ItemDB || (typeof window !== 'undefined' && window.ItemDB) || {};
  }
}

// ============================================================
// WEAKNESS / RESISTANCE
// ============================================================
function calcWeaknessResistance(attackerTypes, defender) {
  _deps();
  var weakness = defender.weakness || [];
  var resistance = defender.resistance || [];

  // Temporary grass weakness (from Forest's Curse)
  if (defender.grassWeakUntil && defender.grassWeakUntil > 0) {
    if (weakness.indexOf('Grass') === -1) weakness = weakness.concat(['Grass']);
  }

  var isWeak = false, isResist = false;
  for (var i = 0; i < attackerTypes.length; i++) {
    if (weakness.indexOf(attackerTypes[i]) !== -1) isWeak = true;
    if (resistance.indexOf(attackerTypes[i]) !== -1) isResist = true;
  }

  if (isWeak && isResist) return 1.0;
  if (isWeak) return 1.5;
  if (isResist) return 0.5;
  return 1.0;
}

// ============================================================
// PASSIVE BLOCKED CHECK
// ============================================================
function isPassiveBlocked(G) {
  // Neutralizing Gas blocks passives on both actives
  var p1Active = G.players[1].active;
  var p2Active = G.players[2].active;
  _deps();
  if (p1Active) {
    var d1 = PokemonDB.getPokemonData(p1Active.name);
    if (d1.ability && d1.ability.key === 'neutralizingGas') return true;
  }
  if (p2Active) {
    var d2 = PokemonDB.getPokemonData(p2Active.name);
    if (d2.ability && d2.ability.key === 'neutralizingGas') return true;
  }
  return false;
}

// ============================================================
// FIND POKEMON OWNER
// ============================================================
function findPokemonOwner(G, pokemon) {
  for (var pNum = 1; pNum <= 2; pNum++) {
    var player = G.players[pNum];
    if (player.active === pokemon) return { playerNum: pNum, benchIdx: -1 };
    for (var i = 0; i < player.bench.length; i++) {
      if (player.bench[i] === pokemon) return { playerNum: pNum, benchIdx: i };
    }
  }
  return null;
}

// ============================================================
// CALC DAMAGE
// ============================================================
/**
 * Calculate damage for an attack hit.
 *
 * @param {Object} G - Game state
 * @param {Object} attacker - Attacking pokemon instance
 * @param {Object} defender - Defending pokemon instance
 * @param {Object} attack - Attack definition {baseDmg, fx, ...}
 * @param {string[]} attackerTypes - Attacker's type array
 * @param {number} defenderOwner - Player number who owns defender
 * @returns {Object} { damage, mult, luckyProc, reduction, filtered }
 */
function calcDamage(G, attacker, defender, attack, attackerTypes, defenderOwner) {
  _deps();

  var currentPlayer = G.currentPlayer;
  var isOpponent = defenderOwner !== currentPlayer;
  var defPlayer = G.players[defenderOwner];
  var isOppActive = isOpponent && defender === defPlayer.active;

  var baseDmg = attack.baseDmg;
  var fx = attack.fx || '';
  var ignoreReduction = fx.indexOf('ignoreReduction') !== -1;

  // --- Attack-specific scaling (from fx string) ---
  if (fx.indexOf('scaleDef:') !== -1) { var v = parseInt(fx.split('scaleDef:')[1]); baseDmg += v * defender.energy; }
  if (fx.indexOf('scaleBoth:') !== -1) { var v = parseInt(fx.split('scaleBoth:')[1]); baseDmg += v * (attacker.energy + defender.energy); }
  if (fx.indexOf('scaleOwn:') !== -1) { var v = parseInt(fx.split('scaleOwn:')[1]); baseDmg += v * attacker.energy; }
  if (fx.indexOf('scaleBench:') !== -1) {
    var v = parseInt(fx.split('scaleBench:')[1]);
    var myBench = G.players[currentPlayer].bench;
    baseDmg += v * myBench.length;
    baseDmg = Math.min(baseDmg, 140);
  }
  if (fx.indexOf('sustained:') !== -1 && attacker.sustained) { baseDmg += parseInt(fx.split('sustained:')[1]); }
  if (fx.indexOf('berserk') !== -1) { baseDmg += attacker.damage; }
  if (fx.indexOf('bonusDmg:') !== -1) { var parts = fx.split('bonusDmg:')[1].split(':'); if (defender.damage >= parseInt(parts[0])) baseDmg += parseInt(parts[1]); }
  if (fx.indexOf('fullHpBonus:') !== -1) { var v = parseInt(fx.split('fullHpBonus:')[1]); if (defender.damage === 0) baseDmg += v; }
  if (fx.indexOf('payback:') !== -1) { var v = parseInt(fx.split('payback:')[1]); if (attacker.damage >= 100) baseDmg += v; }
  if (fx.indexOf('scaleDefNeg:') !== -1) { var v = parseInt(fx.split('scaleDefNeg:')[1]); baseDmg -= v * defender.energy; baseDmg = Math.max(0, baseDmg); }

  if (baseDmg <= 0) return { damage: 0, mult: 1, luckyProc: false, reduction: 0 };

  // --- Item damage bonuses (hooks: onCalcDamageBonus) ---
  var luckyProc = false;
  if (attacker.heldItem) {
    var bonusResult = ItemDB.runItemHook('onCalcDamageBonus', attacker.heldItem, {
      holder: attacker, defender: defender, isOppActive: isOppActive, isOpponent: isOpponent
    });
    if (bonusResult) {
      if (bonusResult.bonusDmg) baseDmg += bonusResult.bonusDmg;
      if (bonusResult.addType) {
        luckyProc = true;
        if (attackerTypes.indexOf(bonusResult.addType) === -1) {
          attackerTypes = attackerTypes.concat([bonusResult.addType]);
        }
      }
    }
  }

  // --- Flat damage reduction on defender ---
  var reduction = 0;
  var defAbility = PokemonDB.getPokemonData(defender.name).ability;

  if (!ignoreReduction) {
    // Ability-based reduction (damageReduce:N)
    if (defAbility && defAbility.key && defAbility.key.indexOf('damageReduce:') === 0 && !isPassiveBlocked(G)) {
      reduction += parseInt(defAbility.key.split(':')[1]);
    }

    // Item-based reduction (hooks: onTakeDamage)
    if (defender.heldItem) {
      var defItemResult = ItemDB.runItemHook('onTakeDamage', defender.heldItem, { holder: defender });
      if (defItemResult && defItemResult.reduction) reduction += defItemResult.reduction;
    }

    // Aurora Veil (team-wide passive)
    var allDefPokemon = [defPlayer.active].concat(defPlayer.bench).filter(Boolean);
    if (!isPassiveBlocked(G)) {
      for (var i = 0; i < allDefPokemon.length; i++) {
        var pData = PokemonDB.getPokemonData(allDefPokemon[i].name);
        if (pData.ability && pData.ability.key === 'auroraVeil') { reduction += 10; break; }
      }
    }

    // Wide Shield (team-wide item: onTeamTakeDamage)
    if (defPlayer.active && defPlayer.active.heldItem === 'Wide Shield') {
      var wsResult = ItemDB.runItemHook('onTeamTakeDamage', 'Wide Shield', {
        holder: defPlayer.active, holderIsActive: true
      });
      if (wsResult && wsResult.reduction) reduction += wsResult.reduction;
    }

    // Shields (temporary from selfShield fx)
    if (defender.shields && defender.shields.length > 0) {
      for (var i = 0; i < defender.shields.length; i++) reduction += defender.shields[i];
    }

    // Vulnerability (from selfVuln fx)
    if (defender.vulnerability && defender.vulnerability > 0) {
      reduction -= defender.vulnerability;
    }
  }

  baseDmg = Math.max(0, baseDmg - reduction);

  // --- Weakness/Resistance multiplier (after flat mods) ---
  var ignoreRes = fx.indexOf('ignoreRes') !== -1 || ignoreReduction;
  var mult = calcWeaknessResistance(attackerTypes, defender);
  if (ignoreRes && mult < 1) mult = 1.0;

  // Item-based weakness modification (hooks: onCalcWeakness)
  if (attacker.heldItem) {
    var weakResult = ItemDB.runItemHook('onCalcWeakness', attacker.heldItem, {
      holder: attacker, mult: mult, isOpponent: isOpponent, defenderTypes: defender.types || PokemonDB.getPokemonData(defender.name).types
    });
    if (weakResult && weakResult.mult !== undefined) mult = weakResult.mult;
  }

  // Pierce Scope on defender side check (when attacker has it)
  // Already handled above via onCalcWeakness hook

  var totalDmg = Math.floor(baseDmg * mult);

  // Filter Shield: immune to resisted types (hooks: onResistCheck)
  if (defender.heldItem) {
    var resistResult = ItemDB.runItemHook('onResistCheck', defender.heldItem, { holder: defender, mult: mult });
    if (resistResult && resistResult.immune) totalDmg = 0;
  }

  // Mega Aggron Filter: block any final damage <= 50
  if (!ignoreReduction && defAbility && defAbility.key === 'filter' && totalDmg > 0 && totalDmg <= 50 && !isPassiveBlocked(G)) {
    return { damage: 0, mult: mult, filtered: true, luckyProc: luckyProc, reduction: reduction };
  }

  return { damage: totalDmg, mult: mult, luckyProc: luckyProc, reduction: reduction };
}

// ============================================================
// APPLY DAMAGE
// ============================================================
/**
 * Apply damage to a pokemon. Checks Focus Sash and Sitrus Berry.
 * Returns { ko: boolean, events: [] }
 */
function applyDamage(G, pokemon, amount, ownerPlayerNum) {
  _deps();
  var events = [];

  if (amount <= 0) return { ko: false, events: events };

  pokemon.damage += amount;
  pokemon.hp = pokemon.maxHp - pokemon.damage;

  // Focus Sash (hooks: onLethalDamage)
  if (pokemon.hp <= 0 && pokemon.heldItem) {
    var lethalResult = ItemDB.runItemHook('onLethalDamage', pokemon.heldItem, {
      holder: pokemon, damageAmount: amount, G: G
    });
    if (lethalResult && lethalResult.surviveAt) {
      pokemon.damage = pokemon.maxHp - lethalResult.surviveAt;
      pokemon.hp = lethalResult.surviveAt;
      events.push({
        type: 'itemProc', item: pokemon.heldItem, pokemon: pokemon.name,
        effect: 'focusSash', hpLeft: lethalResult.surviveAt
      });
      if (lethalResult.discard) {
        pokemon.heldItemUsed = true;
        pokemon.heldItem = null;
      }
      return { ko: false, events: events };
    }
  }

  // Sitrus Berry (hooks: onDamaged)
  if (pokemon.heldItem && !pokemon.heldItemUsed && pokemon.hp > 0) {
    var dmgResult = ItemDB.runItemHook('onDamaged', pokemon.heldItem, {
      holder: pokemon, G: G
    });
    if (dmgResult && dmgResult.heal) {
      pokemon.damage = Math.max(0, pokemon.damage - dmgResult.heal);
      pokemon.hp = pokemon.maxHp - pokemon.damage;
      events.push({
        type: 'itemProc', item: pokemon.heldItem, pokemon: pokemon.name,
        effect: 'heal', amount: dmgResult.heal
      });
      if (dmgResult.discard) {
        pokemon.heldItemUsed = true;
        pokemon.heldItem = null;
      }
    }
  }

  if (pokemon.hp <= 0) {
    pokemon.hp = 0;
    return { ko: true, events: events };
  }

  return { ko: false, events: events };
}

// ============================================================
// HANDLE KO
// ============================================================
/**
 * Process a KO — increment scorer's KOs, handle Rescue Scarf, check win, etc.
 * Returns events array.
 */
function handleKO(G, pokemon, ownerPlayerNum) {
  _deps();
  var opp = Constants.opp;
  var events = [];
  var owner = G.players[ownerPlayerNum];
  var scorerNum = opp(ownerPlayerNum);
  var scorer = G.players[scorerNum];
  scorer.kos++;

  events.push({
    type: 'ko', pokemon: pokemon.name, owner: ownerPlayerNum,
    scorerKOs: scorer.kos, scorerName: scorer.name
  });

  // Clear card selection if KO'd pokemon was selected
  if (G.selectedCard) {
    var selP = G.players[G.selectedCard.playerNum];
    var selPk = G.selectedCard.benchIdx === -1 ? selP.active : selP.bench[G.selectedCard.benchIdx];
    if (selPk === pokemon) G.selectedCard = null;
  }

  // Rescue Scarf (hooks: onKO)
  if (pokemon.heldItem) {
    var koResult = ItemDB.runItemHook('onKO', pokemon.heldItem, {
      holder: pokemon, owner: owner, G: G
    });
    if (koResult && koResult.returnToHand) {
      owner.hand.push({ name: pokemon.name, type: 'pokemon', heldItem: null });
      events.push({ type: 'itemProc', item: 'Rescue Scarf', pokemon: pokemon.name, effect: 'returnToHand' });
    }
  }

  // Check win
  if (scorer.kos >= Constants.KOS_TO_WIN) {
    G.winner = scorer.name;
    events.push({ type: 'win', winner: scorer.name });
    return events;
  }

  // If Active was KO'd, need to promote from bench
  if (owner.active === pokemon) {
    owner.active = null;
    if (owner.bench.length > 0) {
      G.pendingRetreats.push({ player: ownerPlayerNum, reason: 'ko' });
      events.push({ type: 'needNewActive', player: ownerPlayerNum, reason: 'ko' });
    } else {
      // No bench left — auto-lose
      G.winner = scorer.name;
      events.push({ type: 'win', winner: scorer.name, reason: 'noPokemonLeft' });
      return events;
    }
  } else {
    // Remove from bench
    owner.bench = owner.bench.filter(function(p) { return p !== pokemon; });
  }

  return events;
}

// ============================================================
// RUN REACTIVE ITEMS (after attack damage)
// ============================================================
/**
 * Run all reactive item hooks after an attack damages a defender.
 * Returns events array.
 */
function runReactiveItems(G, attacker, defender, attackResult, attackerOwner, defenderOwner) {
  _deps();
  var events = [];

  // Reactive on-damaged items should still trigger even if the holder was
  // KO'd by the hit (e.g. Rocky Helmet retaliation on lethal contact).
  if (!defender.heldItem) return events;

  // Weakness Policy (special: energy gain on super-effective)
  var wpResult = ItemDB.runItemHook('onDamagedByAttack', defender.heldItem, {
    holder: defender, attacker: attacker, mult: attackResult.mult,
    damage: attackResult.damage, G: G
  });

  if (wpResult) {
    if (wpResult.energyGain) {
      defender.energy = Math.min(5, defender.energy + wpResult.energyGain);
      events.push({
        type: 'itemProc', item: defender.heldItem, pokemon: defender.name,
        effect: 'energyGain', amount: wpResult.energyGain
      });
    }
    if (wpResult.events) {
      for (var i = 0; i < wpResult.events.length; i++) {
        var evt = wpResult.events[i];
        if (evt.type === 'damage' && evt.target) {
          var dmgRes = applyDamage(G, evt.target, evt.amount, attackerOwner);
          events.push({
            type: 'reactiveDamage', source: evt.source, target: evt.target.name,
            amount: evt.amount, targetOwner: attackerOwner
          });
          events = events.concat(dmgRes.events);
          if (dmgRes.ko) {
            var koEvents = handleKO(G, evt.target, attackerOwner);
            events = events.concat(koEvents);
          }
        }
        if (evt.type === 'addStatus' && evt.target) {
          if (evt.target.status.indexOf(evt.status) === -1) {
            evt.target.status.push(evt.status);
            events.push({
              type: 'statusApplied', pokemon: evt.target.name, status: evt.status, source: evt.source
            });
          }
        }
      }
    }
    if (wpResult.discard) {
      defender.heldItemUsed = true;
      defender.heldItem = null;
    }
  }

  return events;
}

// ============================================================
// FULL ATTACK DAMAGE PIPELINE
// ============================================================
/**
 * Complete pipeline: calc → apply → reactive items → KO.
 * Single function called for ALL attack damage in the game.
 *
 * @param {Object} G - Game state
 * @param {Object} attacker - Attacking pokemon
 * @param {Object} defender - Target pokemon
 * @param {Object} attack - Attack definition
 * @param {string[]} attackerTypes - Attacker's types
 * @param {number} defenderOwner - Player number owning defender
 * @returns {Object} { result: calcResult, ko: boolean, events: [] }
 */
function dealAttackDamage(G, attacker, defender, attack, attackerTypes, defenderOwner, options) {
  _deps();
  options = options || {};
  var attackerOwner = Constants.opp(defenderOwner);
  var events = [];

  // 1. Calculate damage
  var result = calcDamage(G, attacker, defender, attack, attackerTypes, defenderOwner);

  if (result.filtered) {
    events.push({
      type: 'filtered', pokemon: defender.name,
      ability: 'Filter'
    });
    return { result: result, ko: false, events: events };
  }

  if (result.damage <= 0) {
    events.push({ type: 'noDamage', attack: attack.name });
    return { result: result, ko: false, events: events };
  }

  // 2. Apply damage (Focus Sash, Sitrus Berry)
  var applyResult = applyDamage(G, defender, result.damage, defenderOwner);
  var defLoc = findPokemonOwner(G, defender);
  events.push({
    type: 'damage', target: defender.name, amount: result.damage,
    mult: result.mult, luckyProc: result.luckyProc, reduction: result.reduction,
    attack: attack.name, targetOwner: defenderOwner,
    benchIdx: defLoc ? defLoc.benchIdx : -1,
    attackerType: attackerTypes && attackerTypes.length > 0 ? attackerTypes[0] : null
  });
  events = events.concat(applyResult.events);

  // 3. Run reactive items (Rocky Helmet, Burn Scarf, Weakness Policy, etc.)
  var reactiveEvents = runReactiveItems(G, attacker, defender, result, attackerOwner, defenderOwner);
  events = events.concat(reactiveEvents);

  // 4. Attacker-side item effects (Shell Bell heal, Life Orb recoil)
  if (attacker.heldItem) {
    // One-shot per declared attack action: avoid repeated Shell Bell / Life Orb
    // procs when a single attack applies damage multiple times (multi-target FX,
    // self-damage FX that uses the same pipeline, etc.).
    var attackSeq = options.attackSeq || G.attackSeq || 0;
    if (attacker._lastOnAttackItemSeq !== attackSeq) {
      attacker._lastOnAttackItemSeq = attackSeq;
      var atkResult = ItemDB.runItemHook('onAttack', attacker.heldItem, {
        holder: attacker, attacker: attacker, defender: defender,
        didDamage: result.damage > 0, G: G
      });
      if (atkResult) {
        if (atkResult.heal && attacker.damage > 0) {
          attacker.damage = Math.max(0, attacker.damage - atkResult.heal);
          attacker.hp = attacker.maxHp - attacker.damage;
          events.push({
            type: 'itemProc', item: attacker.heldItem, pokemon: attacker.name,
            effect: 'heal', amount: atkResult.heal
          });
        }
        if (atkResult.recoil) {
          var recoilResult = applyDamage(G, attacker, atkResult.recoil, attackerOwner);
          events.push({
            type: 'recoilDamage', source: attacker.heldItem, pokemon: attacker.name,
            amount: atkResult.recoil
          });
          events = events.concat(recoilResult.events);
          if (recoilResult.ko) {
            var recoilKO = handleKO(G, attacker, attackerOwner);
            events = events.concat(recoilKO);
          }
        }
      }
    }
  }

  // 5. Handle KO if defender was KO'd
  if (applyResult.ko) {
    var koEvents = handleKO(G, defender, defenderOwner);
    events = events.concat(koEvents);
  }

  return { result: result, ko: applyResult.ko, events: events };
}

// ============================================================
// STATUS DAMAGE (poison, burn — not attack damage, no reactive items)
// ============================================================
function dealStatusDamage(G, pokemon, amount, ownerPlayerNum, statusType) {
  var events = [];
  var applyResult = applyDamage(G, pokemon, amount, ownerPlayerNum);

  events.push({
    type: 'statusDamage', target: pokemon.name, amount: amount,
    status: statusType, targetOwner: ownerPlayerNum
  });
  events = events.concat(applyResult.events);

  if (applyResult.ko) {
    var koEvents = handleKO(G, pokemon, ownerPlayerNum);
    events = events.concat(koEvents);
  }

  return { ko: applyResult.ko, events: events };
}

// ============================================================
// EXPORTS
// ============================================================
exports.calcWeaknessResistance = calcWeaknessResistance;
exports.isPassiveBlocked = isPassiveBlocked;
exports.findPokemonOwner = findPokemonOwner;
exports.calcDamage = calcDamage;
exports.applyDamage = applyDamage;
exports.handleKO = handleKO;
exports.runReactiveItems = runReactiveItems;
exports.dealAttackDamage = dealAttackDamage;
exports.dealStatusDamage = dealStatusDamage;

})(typeof module !== 'undefined' && module.exports ? module.exports : (this.DamagePipeline = {}));
