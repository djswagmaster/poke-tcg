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

// Get all held items for a Pokemon (supports Klefki multi-item)
function getHeldItems(pk) {
  if (pk.heldItems && pk.heldItems.length > 0) return pk.heldItems.filter(Boolean);
  if (pk.heldItem) return [pk.heldItem];
  return [];
}

// Run an item hook across ALL held items (for multi-item Pokemon like Klefki).
// Returns the combined/merged result, or null if no hooks fired.
function runItemHookAll(hookName, pk, ctx) {
  _deps();
  var items = getHeldItems(pk);
  var combined = null;
  for (var i = 0; i < items.length; i++) {
    var r = ItemDB.runItemHook(hookName, items[i], ctx);
    if (r) {
      if (!combined) combined = {};
      for (var k in r) { if (r.hasOwnProperty(k)) {
        if (typeof r[k] === 'number' && combined[k]) combined[k] += r[k];
        else combined[k] = r[k];
      }}
    }
  }
  return combined;
}

// ============================================================
// WEAKNESS / RESISTANCE
// ============================================================
function calcWeaknessResistance(attackerTypes, defender, currentTurn) {
  _deps();
  var weakness = defender.weakness || [];
  var resistance = defender.resistance || [];

  // Temporary grass weakness (from Forest's Curse)
  // grassWeakUntil stores the turn number when the effect expires.
  if (defender.grassWeakUntil && defender.grassWeakUntil > (currentTurn || 0)) {
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
function isPassiveBlocked(G, pokemon) {
  // Neutralizing Gas blocks passives if any Pokemon in play has it
  // BUT it only blocks ACTIVE Pokemon abilities, not benched ones
  _deps();
  var hasNeutralizingGas = false;
  for (var pNum = 1; pNum <= 2; pNum++) {
    var side = G.players[pNum];
    var all = [side.active].concat(side.bench).filter(Boolean);
    for (var i = 0; i < all.length; i++) {
      var d = PokemonDB.getPokemonData(all[i].name);
      if (d.ability && d.ability.key === 'neutralizingGas') {
        hasNeutralizingGas = true;
        break;
      }
    }
    if (hasNeutralizingGas) break;
  }
  
  if (!hasNeutralizingGas) return false;
  
  // If pokemon parameter provided, check if it's active
  if (pokemon) {
    for (var pNum = 1; pNum <= 2; pNum++) {
      var side = G.players[pNum];
      if (side.active === pokemon) return true; // Active pokemon abilities are blocked
    }
    return false; // Bench pokemon abilities are NOT blocked
  }
  
  // If no pokemon specified, return true (for general checks)
  return true;
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
  var fxVal;
  if (fx.indexOf('scaleDef:') !== -1) { fxVal = parseInt(fx.split('scaleDef:')[1]); baseDmg += fxVal * defender.energy; }
  if (fx.indexOf('scaleBoth:') !== -1) { fxVal = parseInt(fx.split('scaleBoth:')[1]); baseDmg += fxVal * (attacker.energy + defender.energy); }
  if (fx.indexOf('scaleOwn:') !== -1) { fxVal = parseInt(fx.split('scaleOwn:')[1]); baseDmg += fxVal * attacker.energy; }
  if (fx.indexOf('scaleOppAll:') !== -1) {
    fxVal = parseInt(fx.split('scaleOppAll:')[1]);
    var oppAll = [defPlayer.active].concat(defPlayer.bench).filter(Boolean);
    var totalOppEnergy = 0;
    oppAll.forEach(function(pk) { totalOppEnergy += (pk.energy || 0); });
    baseDmg += fxVal * totalOppEnergy;
  }
  if (fx.indexOf('scaleBench:') !== -1) {
    fxVal = parseInt(fx.split('scaleBench:')[1]);
    var myBench = G.players[currentPlayer].bench;
    baseDmg += fxVal * myBench.length;
  }
  if (fx.indexOf('scaleBenchAll:') !== -1) {
    fxVal = parseInt(fx.split('scaleBenchAll:')[1]);
    var myBench = G.players[currentPlayer].bench;
    baseDmg += fxVal * myBench.length;
  }
  if (fx.indexOf('sustained:') !== -1 && attacker.sustained) { baseDmg += parseInt(fx.split('sustained:')[1]); }
  if (fx.indexOf('berserk') !== -1) { baseDmg += attacker.damage; }
  if (fx.indexOf('bonusDmg:') !== -1) { var bdParts = fx.split('bonusDmg:')[1].split(':'); if (defender.damage >= parseInt(bdParts[0])) baseDmg += parseInt(bdParts[1]); }
  if (fx.indexOf('fullHpBonus:') !== -1) { fxVal = parseInt(fx.split('fullHpBonus:')[1]); if (defender.damage === 0) baseDmg += fxVal; }
  if (fx.indexOf('payback:') !== -1) { fxVal = parseInt(fx.split('payback:')[1]); if (attacker.damage >= 100) baseDmg += fxVal; }
  if (fx.indexOf('maxEnergyBonus:') !== -1) { fxVal = parseInt(fx.split('maxEnergyBonus:')[1]); if (attacker.energy >= Constants.MAX_ENERGY) baseDmg += fxVal; }
  if (fx.indexOf('scaleDefNeg:') !== -1) { fxVal = parseInt(fx.split('scaleDefNeg:')[1]); baseDmg -= fxVal * defender.energy; baseDmg = Math.max(0, baseDmg); }

  if (baseDmg <= 0) return { damage: 0, mult: 1, luckyProc: false, reduction: 0 };

  // --- Item damage bonuses (hooks: onCalcDamageBonus) ---
  var luckyProc = false;
  var bonusResult = runItemHookAll('onCalcDamageBonus', attacker, {
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

  // --- Flat damage reduction on defender ---
  var reduction = 0;
  var defAbility = PokemonDB.getPokemonData(defender.name).ability;

  if (!ignoreReduction) {
    // Ability-based reduction (damageReduce:N)
    if (defAbility && defAbility.key && defAbility.key.indexOf('damageReduce:') === 0 && !isPassiveBlocked(G, defender)) {
      reduction += parseInt(defAbility.key.split(':')[1]);
    }

    // Item-based reduction (hooks: onTakeDamage)
    var defItemResult = runItemHookAll('onTakeDamage', defender, {
      holder: defender,
      holderCost: PokemonDB.getPokemonData(defender.name).cost
    });
    if (defItemResult && defItemResult.reduction) reduction += defItemResult.reduction;

    // Aurora Veil (team-wide passive)
    var allDefPokemon = [defPlayer.active].concat(defPlayer.bench).filter(Boolean);
    for (var i = 0; i < allDefPokemon.length; i++) {
      var pData = PokemonDB.getPokemonData(allDefPokemon[i].name);
      if (pData.ability && pData.ability.key === 'auroraVeil' && !isPassiveBlocked(G, allDefPokemon[i])) { 
        reduction += 10; 
        break; 
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
  var mult = calcWeaknessResistance(attackerTypes, defender, G.turn);
  if (ignoreRes && mult < 1) mult = 1.0;

  // Item-based weakness modification (hooks: onCalcWeakness)
  var weakResult = runItemHookAll('onCalcWeakness', attacker, {
    holder: attacker, mult: mult, isOpponent: isOpponent, isOppActive: isOppActive, defenderTypes: defender.types || PokemonDB.getPokemonData(defender.name).types
  });
  if (weakResult && weakResult.mult !== undefined) mult = weakResult.mult;

  var totalDmg = Math.floor(baseDmg * mult);

  // Filter Shield: immune to resisted types (hooks: onResistCheck)
  var resistResult = runItemHookAll('onResistCheck', defender, { holder: defender, mult: mult });
  if (resistResult && resistResult.immune) totalDmg = 0;

  // Mega Aggron Filter: block any final damage <= 50
  if (!ignoreReduction && defAbility && defAbility.key === 'filter' && totalDmg > 0 && totalDmg <= 50 && !isPassiveBlocked(G, defender)) {
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
  var allItemsLethal = getHeldItems(pokemon);
  if (pokemon.hp <= 0 && allItemsLethal.length > 0) {
    for (var li = 0; li < allItemsLethal.length; li++) {
      var lethalResult = ItemDB.runItemHook('onLethalDamage', allItemsLethal[li], {
        holder: pokemon, damageAmount: amount, G: G
      });
      if (lethalResult && lethalResult.surviveAt) {
        pokemon.damage = pokemon.maxHp - lethalResult.surviveAt;
        pokemon.hp = lethalResult.surviveAt;
        events.push({
          type: 'itemProc', item: allItemsLethal[li], pokemon: pokemon.name,
          effect: 'focusSash', hpLeft: lethalResult.surviveAt
        });
        if (lethalResult.discard) {
          pokemon.heldItemUsed = true;
          if (pokemon.heldItem === allItemsLethal[li]) pokemon.heldItem = null;
          if (pokemon.heldItems) {
            var lIdx = pokemon.heldItems.indexOf(allItemsLethal[li]);
            if (lIdx !== -1) pokemon.heldItems.splice(lIdx, 1);
          }
        }
        return { ko: false, events: events };
      }
    }
  }

  // Sitrus Berry (hooks: onDamaged)
  var allItemsDmg = getHeldItems(pokemon);
  if (allItemsDmg.length > 0 && !pokemon.heldItemUsed && pokemon.hp > 0) {
    for (var di = 0; di < allItemsDmg.length; di++) {
      var dmgResult = ItemDB.runItemHook('onDamaged', allItemsDmg[di], {
        holder: pokemon, G: G
      });
      if (dmgResult && dmgResult.heal) {
        pokemon.damage = Math.max(0, pokemon.damage - dmgResult.heal);
        pokemon.hp = pokemon.maxHp - pokemon.damage;
        events.push({
          type: 'itemProc', item: allItemsDmg[di], pokemon: pokemon.name,
          effect: 'heal', amount: dmgResult.heal
        });
        if (dmgResult.discard) {
          pokemon.heldItemUsed = true;
          if (pokemon.heldItem === allItemsDmg[di]) pokemon.heldItem = null;
          if (pokemon.heldItems) {
            var dIdx = pokemon.heldItems.indexOf(allItemsDmg[di]);
            if (dIdx !== -1) pokemon.heldItems.splice(dIdx, 1);
          }
        }
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
function handleKO(G, pokemon, ownerPlayerNum, options) {
  _deps();
  var opp = Constants.opp;
  var events = [];
  options = options || {};
  var owner = G.players[ownerPlayerNum];
  var scorerNum = opp(ownerPlayerNum);
  var scorer = G.players[scorerNum];
  scorer.kos++;

  var koIsActive = owner.active === pokemon;
  var koBenchIdx = -1;
  if (!koIsActive) {
    for (var bi = 0; bi < owner.bench.length; bi++) {
      if (owner.bench[bi] === pokemon) { koBenchIdx = bi; break; }
    }
  }
  events.push({
    type: 'ko', pokemon: pokemon.name, owner: ownerPlayerNum,
    scorerKOs: scorer.kos, scorerName: scorer.name,
    isActive: koIsActive, benchIdx: koBenchIdx
  });

  // Clear card selection if KO'd pokemon was selected
  if (G.selectedCard) {
    var selP = G.players[G.selectedCard.playerNum];
    var selPk = G.selectedCard.benchIdx === -1 ? selP.active : selP.bench[G.selectedCard.benchIdx];
    if (selPk === pokemon) G.selectedCard = null;
  }

  // Item onKO hook (Rescue Scarf: return to hand, Exp. Share: transfer energy)
  var koItemResult = null;
  var allItemsKO = getHeldItems(pokemon);
  for (var ki = 0; ki < allItemsKO.length; ki++) {
    var koRes = ItemDB.runItemHook('onKO', allItemsKO[ki], {
      holder: pokemon, owner: owner, G: G
    });
    if (koRes) {
      if (!koItemResult) koItemResult = {};
      for (var kk in koRes) { if (koRes.hasOwnProperty(kk)) {
        if (typeof koRes[kk] === 'number' && koItemResult[kk]) koItemResult[kk] += koRes[kk];
        else koItemResult[kk] = koRes[kk];
      }}
      if (koRes.returnToHand) {
        owner.hand.push({ name: pokemon.name, type: 'pokemon', heldItem: null });
        events.push({ type: 'itemProc', item: allItemsKO[ki], pokemon: pokemon.name, effect: 'returnToHand' });
      }
    }
  }

  // Azurill: Bouncy Generator (active KO grants 1 mana)
  var ownerActiveData = PokemonDB.getPokemonData(pokemon.name);
  if (owner.active === pokemon && ownerActiveData.ability && ownerActiveData.ability.key === 'bouncyGenerator' && !isPassiveBlocked(G, pokemon)) {
    var prevMana = owner.mana;
    owner.mana = Math.min(Constants.MAX_MANA, owner.mana + 1);
    var gained = owner.mana - prevMana;
    if (gained > 0) {
      events.push({ type: 'ability_effect', ability: 'bouncyGenerator', pokemon: pokemon.name, player: ownerPlayerNum, amount: gained });
      events.push({ type: 'mana_gain', player: ownerPlayerNum, amount: gained });
    }
  }

  // Check win - removed KO count win condition, only check for no pokemon left
  // if (scorer.kos >= Constants.KOS_TO_WIN) {
  //   G.winner = scorer.name;
  //   events.push({ type: 'win', winner: scorer.name });
  //   return events;
  // }

  // If Active was KO'd, need to promote from bench
  if (owner.active === pokemon) {
    owner.active = null;
    if (owner.bench.length > 0) {
      // Reuse the cached onKO result for Exp. Share energy transfer
      var expShareTransfer = 0;
      if (koItemResult && koItemResult.transferEnergy) {
        expShareTransfer = Math.min(koItemResult.transferEnergy, pokemon.energy || 0);
        if (expShareTransfer > 0) {
          events.push({ type: 'itemProc', item: 'Exp. Share', pokemon: pokemon.name, effect: 'expSharePrimed', amount: expShareTransfer });
        }
      }
      G.pendingRetreats.push({
        player: ownerPlayerNum,
        reason: 'ko',
        endTurnAfterSwitch: options.endTurnAfterSwitch !== false,
        expShareTransfer: expShareTransfer
      });
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

  // Reactive items should only trigger when the holder is the active pokemon
  var defenderPlayer = G.players[defenderOwner];
  var isDefenderActive = defenderPlayer.active === defender;
  if (!isDefenderActive) return events;

  // Reactive on-damaged items should still trigger even if the holder was
  // KO'd by the hit (e.g. Rocky Helmet retaliation on lethal contact).
  var reactiveItems = getHeldItems(defender);
  if (reactiveItems.length === 0) return events;

  for (var ri = 0; ri < reactiveItems.length; ri++) {
    var riName = reactiveItems[ri];
    var wpResult = ItemDB.runItemHook('onDamagedByAttack', riName, {
      holder: defender, attacker: attacker, mult: attackResult.mult,
      damage: attackResult.damage, G: G
    });

    if (wpResult) {
      if (wpResult.energyGain) {
        defender.energy = Math.min(5, defender.energy + wpResult.energyGain);
        events.push({
          type: 'itemProc', item: riName, pokemon: defender.name,
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
                type: 'statusApplied', pokemon: evt.target.name, status: evt.status, source: evt.source, owner: attackerOwner
              });
            }
          }
        }
      }
      if (wpResult.discard) {
        defender.heldItemUsed = true;
        if (defender.heldItem === riName) defender.heldItem = null;
        if (defender.heldItems) {
          var rIdx = defender.heldItems.indexOf(riName);
          if (rIdx !== -1) defender.heldItems.splice(rIdx, 1);
        }
      }
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
  var atkItems = getHeldItems(attacker);
  if (atkItems.length > 0) {
    // One-shot per declared attack action: avoid repeated Shell Bell / Life Orb
    // procs when a single attack applies damage multiple times (multi-target FX,
    // self-damage FX that uses the same pipeline, etc.).
    var attackSeq = options.attackSeq || G.attackSeq || 0;
    if (attacker._lastOnAttackItemSeq !== attackSeq) {
      attacker._lastOnAttackItemSeq = attackSeq;
      var atkResult = runItemHookAll('onAttack', attacker, {
        holder: attacker, attacker: attacker, defender: defender,
        didDamage: result.damage > 0, attack: attack, G: G
      });
      if (atkResult) {
        if (atkResult.heal && attacker.damage > 0) {
          attacker.damage = Math.max(0, attacker.damage - atkResult.heal);
          attacker.hp = attacker.maxHp - attacker.damage;
          events.push({
            type: 'itemProc', item: atkItems[0], pokemon: attacker.name,
            effect: 'heal', amount: atkResult.heal
          });
        }
        if (atkResult.recoil) {
          var recoilResult = applyDamage(G, attacker, atkResult.recoil, attackerOwner);
          events.push({
            type: 'recoilDamage', source: atkItems[0], pokemon: attacker.name,
            amount: atkResult.recoil, owner: attackerOwner
          });
          events = events.concat(recoilResult.events);
          if (recoilResult.ko) {
            var recoilKO = handleKO(G, attacker, attackerOwner);
            events = events.concat(recoilKO);
          }
        }
        if (atkResult.energyGain) {
          var beforeEnergy = attacker.energy;
          attacker.energy = Math.min(Constants.MAX_ENERGY, attacker.energy + atkResult.energyGain);
          var gained = attacker.energy - beforeEnergy;
          if (gained > 0) {
            events.push({ type: 'energyGain', pokemon: attacker.name, amount: gained, source: atkItems[0], owner: attackerOwner });
          }
        }
        if (atkResult.lockAttackName) {
          attacker.cantUseAttack = atkResult.lockAttackName;
          attacker.cantUseAttackUntilTurn = G.turn + 2;
          events.push({ type: 'lockAttack', pokemon: attacker.name, attack: atkResult.lockAttackName, source: atkItems[0] });
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
exports.getHeldItems = getHeldItems;
exports.runItemHookAll = runItemHookAll;

})(typeof module !== 'undefined' && module.exports ? module.exports : (this.DamagePipeline = {}));
