// ============================================================
// POKEMON TCG - Item Database (Shared)
// ============================================================
// Single source of truth for all held items.
// Each item defines its behavior through HOOKS — no more
// scattered string checks. Adding a new item = adding one entry.
//
// Hook points (called by the damage pipeline / game logic):
//   onTakeDamage(ctx)       — modify incoming damage (return {reduction})
//   onDamagedByAttack(ctx)  — after taking attack damage (reactive items)
//   onAttack(ctx)           — when holder attacks (Shell Bell, Life Orb bonus)
//   onDealDamage(ctx)       — modify outgoing damage (return {bonusDmg})
//   onKO(ctx)               — when holder is KO'd (Rescue Scarf)
//   onGainEnergy(ctx)       — when holder gains energy (Healing Scarf)
//   onTurnStart(ctx)        — start of owner's turn (Leftovers heal)
//   onTurnEnd(ctx)          — end of turn (Leftovers)
//   onDeploy(ctx)           — when placed on field (Power Herb)
//   onEnergyLoss(ctx)       — when about to lose energy (White Herb)
//   onCalcWeakness(ctx)     — modify weakness multiplier (Expert Belt)
//   onCalcDamageBonus(ctx)  — add flat damage bonus (Muscle Band, Life Orb, Lucky Punch)
//   onResistCheck(ctx)      — Filter Shield immunity
//
// ctx always includes: { G, holder, events }
// Attack contexts add: { attacker, defender, mult, damage, attack, attackerTypes }
//
// Works in both browser (global) and Node.js (module.exports).
// ============================================================
(function(exports) {
'use strict';

var ITEM_DB = [
  // ---- Damage reduction ----
  {
    name: "Assault Vest", desc: "After attacking: -30 dmg next turn", key: "assaultVest",
    hooks: {
      onAttack: function(ctx) {
        // Set flag that this Pokemon attacked, granting reduction next turn
        ctx.holder.assaultVestActive = ctx.G.turn + 1;
        return null;
      },
      onTakeDamage: function(ctx) {
        // Check if Assault Vest is active (attacked last turn)
        if (ctx.holder.assaultVestActive && ctx.holder.assaultVestActive === ctx.G.turn) {
          return { reduction: 30 };
        }
        return null;
      }
    }
  },

  {
    name: "Eviolite", desc: "If holder cost <=3: -20 damage. Also grants +HP by cost (3:+10,2:+20,1:+30)", key: "eviolite",
    hooks: {
      onTakeDamage: function(ctx) {
        if (ctx.holderCost && ctx.holderCost <= 3) return { reduction: 20 };
        return null;
      }
    }
  },

  // ---- Reactive (on being attacked) ----
  {
    name: "Burn Scarf", desc: "Attacked: 10 dmg + Burn", key: "burnScarf",
    hooks: {
      onDamagedByAttack: function(ctx) {
        var events = [];
        if (ctx.attacker.hp > 0 && !(ctx.attacker.heldItem === 'Protect Goggles')) {
          events.push({ type: 'damage', target: ctx.attacker, amount: 10, source: 'Burn Scarf' });
          if (ctx.attacker.status.indexOf('burn') === -1) {
            events.push({ type: 'addStatus', target: ctx.attacker, status: 'burn', source: 'Burn Scarf' });
          }
        }
        return { events: events };
      }
    }
  },

  // ---- Weakness multiplier ----
  {
    name: "Expert Belt", desc: "2x weakness (not 1.5x)", key: "expertBelt",
    hooks: {
      onCalcWeakness: function(ctx) {
        // Only when attacking opponent's pokemon and mult is 1.5
        if (ctx.isOpponent && ctx.mult === 1.5) return { mult: 2.0 };
        return null;
      }
    }
  },

  // ---- Resistance immunity ----
  {
    name: "Filter Shield", desc: "Immune to resisted types", key: "filterShield",
    hooks: {
      onResistCheck: function(ctx) {
        if (ctx.mult < 1) return { immune: true };
        return null;
      }
    }
  },

  // ---- Retreat cost reduction ----
  {
    name: "Float Stone", desc: "Quick Retreat -1 energy", key: "floatStone",
    hooks: {
      onRetreat: function(ctx) { return { costReduction: 1 }; }
    }
  },

  // ---- Survive KO ----
  {
    name: "Focus Sash", desc: "Survive KO at 10 HP", key: "focusSash", oneTime: true,
    hooks: {
      onLethalDamage: function(ctx) {
        // Only proc if was above 100 HP before the hit
        var hpBefore = ctx.holder.maxHp - (ctx.holder.damage - ctx.damageAmount);
        if (hpBefore >= 100) {
          return { surviveAt: 10, discard: true };
        }
        return null;
      }
    }
  },

  // ---- Flat HP bonus ----
  {
    name: "Health Charm", desc: "+50 HP", key: "healthCharm",
    hooks: {
      onDeploy: function(ctx) { return { hpBonus: 50 }; }
    }
  },

  // ---- Heal on energy gain ----
  {
    name: "Healing Scarf", desc: "Heal 20 per energy gained", key: "healingScarf",
    hooks: {
      onGainEnergy: function(ctx) {
        if (ctx.holder.damage > 0 && ctx.amount > 0) {
          var heal = 20 * ctx.amount;
          return { heal: heal };
        }
        return null;
      }
    }
  },

  // ---- Per-turn healing ----
  {
    name: "Leftovers", desc: "Heal 10 per turn", key: "leftovers",
    hooks: {
      onTurnEnd: function(ctx) {
        if (ctx.holder.damage > 0 && ctx.holder.hp > 0) {
          return { heal: 10 };
        }
        return null;
      }
    }
  },

  // ---- Damage bonus + recoil ----
  {
    name: "Life Orb", desc: "+30 damage, 10 recoil", key: "lifeOrb",
    hooks: {
      onCalcDamageBonus: function(ctx) {
        if (ctx.isOppActive) return { bonusDmg: 30 };
        return null;
      },
      onAttack: function(ctx) {
        // Recoil after attacking
        if (ctx.didDamage) return { recoil: 10 };
        return null;
      }
    }
  },

  // ---- Reactive: damage + confuse ----
  {
    name: "Loud Bell", desc: "Attacked: 10 dmg + Confuse", key: "loudBell",
    hooks: {
      onDamagedByAttack: function(ctx) {
        var events = [];
        if (ctx.attacker.hp > 0 && !(ctx.attacker.heldItem === 'Protect Goggles')) {
          events.push({ type: 'damage', target: ctx.attacker, amount: 10, source: 'Loud Bell' });
          if (ctx.attacker.status.indexOf('confusion') === -1) {
            events.push({ type: 'addStatus', target: ctx.attacker, status: 'confusion', source: 'Loud Bell' });
          }
        }
        return { events: events };
      }
    }
  },

  // ---- Random damage bonus + Normal weakness ----
  {
    name: "Lucky Punch", desc: "50%: +20 dmg + Normal weak", key: "luckyPunch",
    hooks: {
      onCalcDamageBonus: function(ctx) {
        if (ctx.isOppActive) {
          // Roll once and store result on holder
          var proc = Math.random() < 0.5;
          ctx.holder._luckyPunchProc = proc;
          if (proc) {
            return { bonusDmg: 20, luckyProc: true };
          }
        }
        return null;
      },
      onCalcWeakness: function(ctx) {
        // Check if Lucky Punch proc'd in the damage bonus phase
        if (ctx.isOppActive && ctx.holder._luckyPunchProc) {
          // Clear the flag
          ctx.holder._luckyPunchProc = false;
          // If defender is not already weak to Normal, make them weak (1.5x)
          // If already weak, don't stack (keep existing mult)
          if (ctx.mult < 1.5) {
            return { mult: 1.5 };
          }
        }
        return null;
      }
    }
  },

  // ---- Status cure + heal ----
  {
    name: "Lum Berry", desc: "Cure status + heal 30", key: "lumBerry", oneTime: true,
    hooks: {
      onTurnStart: function(ctx) {
        if (ctx.holder.status && ctx.holder.status.length > 0) {
          return { cureStatus: true, heal: 30, discard: true };
        }
        return null;
      }
    }
  },

  // ---- Flat damage bonus ----
  {
    name: "Muscle Band", desc: "+20 damage", key: "muscleBand",
    hooks: {
      onCalcDamageBonus: function(ctx) {
        if (ctx.isOppActive) return { bonusDmg: 20 };
        return null;
      }
    }
  },

  {
    name: "Choice Band", desc: "+30 damage to opponent Active. After attacking, lock used attack next turn", key: "choiceBand",
    hooks: {
      onCalcDamageBonus: function(ctx) {
        if (ctx.isOppActive) return { bonusDmg: 30 };
        return null;
      },
      onAttack: function(ctx) {
        return { lockAttackName: ctx.attack && ctx.attack.name ? ctx.attack.name : null };
      }
    }
  },

  {
    name: "Choice Scarf", desc: "Attacks cost 1 less, +10 to opponent Active. Locks used attack next turn", key: "choiceScarf",
    hooks: {
      onAttackCost: function(ctx) { return { costReduction: 1 }; },
      onCalcDamageBonus: function(ctx) {
        if (ctx.isOppActive) return { bonusDmg: 10 };
        return null;
      },
      onAttack: function(ctx) {
        return { lockAttackName: ctx.attack && ctx.attack.name ? ctx.attack.name : null };
      }
    }
  },

  {
    name: "Wide Lens", desc: "Before damage, opponent bench gains your types as weaknesses this turn", key: "wideLens",
    hooks: {
      onCalcWeakness: function(ctx) {
        if (ctx.isOpponent && !ctx.isOppActive) return { mult: Math.max(ctx.mult, 1.5) };
        return null;
      }
    }
  },

  {
    name: "Metronome", desc: "On attack: +1 energy. If this Pokemon retreats from Active, discard this card", key: "metronome",
    hooks: {
      onAttack: function(ctx) { return { energyGain: 1 }; },
      onRetreat: function(ctx) { return { discard: true }; }
    }
  },

  {
    name: "Exp. Share", desc: "If active is KO'd, transfer up to 2 energy to chosen replacement", key: "expShare",
    hooks: {
      onKO: function(ctx) { return { transferEnergy: 2 }; }
    }
  },

  // ---- Pierce: Normal types become weak ----
  {
    name: "Pierce Scope", desc: "Normal=weak to your type", key: "pierceScope",
    hooks: {
      onCalcWeakness: function(ctx) {
        // If defender is Normal type and mult is 1.0 (neutral), treat as weak
        if (ctx.defenderTypes && ctx.defenderTypes.indexOf('Normal') !== -1 && ctx.mult === 1.0) {
          return { mult: 1.5 };
        }
        return null;
      }
    }
  },

  // ---- Reactive: damage + poison ----
  {
    name: "Poison Barb", desc: "Attacked: 10 dmg + Poison", key: "poisonBarb",
    hooks: {
      onDamagedByAttack: function(ctx) {
        var events = [];
        if (ctx.attacker.hp > 0 && !(ctx.attacker.heldItem === 'Protect Goggles')) {
          events.push({ type: 'damage', target: ctx.attacker, amount: 10, source: 'Poison Barb' });
          if (ctx.attacker.status.indexOf('poison') === -1) {
            events.push({ type: 'addStatus', target: ctx.attacker, status: 'poison', source: 'Poison Barb' });
          }
        }
        return { events: events };
      }
    }
  },

  // ---- Deploy: +1 energy ----
  {
    name: "Power Herb", desc: "Deploy: +1 energy", key: "powerHerb", oneTime: true,
    hooks: {
      onDeploy: function(ctx) { return { energyGain: 1, discard: true }; }
    }
  },

  // ---- Block non-damage effects ----
  {
    name: "Protect Goggles", desc: "Block non-dmg effects", key: "protectGoggles",
    // This is checked inline (not a hook) — it prevents status, energy strip, etc.
    hooks: {}
  },

  // ---- First attack cost reduction ----
  {
    name: "Quick Claw", desc: "1st attack -2 energy", key: "quickClaw", oneTime: true,
    hooks: {
      onAttackCost: function(ctx) { return { costReduction: 2, discard: true }; }
    }
  },

  // ---- Return to hand on KO ----
  {
    name: "Rescue Scarf", desc: "Return to hand on KO", key: "rescueScarf",
    hooks: {
      onKO: function(ctx) { return { returnToHand: true }; }
    }
  },

  // ---- Reactive: reflect damage ----
  {
    name: "Rocky Helmet", desc: "Attacked: 30 dmg back", key: "rockyHelmet",
    hooks: {
      onDamagedByAttack: function(ctx) {
        return { events: [{ type: 'damage', target: ctx.attacker, amount: 30, source: 'Rocky Helmet' }] };
      }
    }
  },

  // ---- Heal on attack ----
  {
    name: "Shell Bell", desc: "Heal 30 when attacking", key: "shellBell",
    hooks: {
      onAttack: function(ctx) {
        if (ctx.didDamage && ctx.attacker.damage > 0) return { heal: 30 };
        return null;
      }
    }
  },

  // ---- Threshold heal ----
  {
    name: "Sitrus Berry", desc: "At 100+ dmg: heal 60", key: "sitrusBerry", oneTime: true,
    hooks: {
      onDamaged: function(ctx) {
        if (ctx.holder.damage >= 100 && ctx.holder.hp > 0) {
          return { heal: 60, discard: true };
        }
        return null;
      }
    }
  },

  // ---- Weakness energy gain ----
  {
    name: "Weakness Policy", desc: "Weak hit: +2 energy, discard", key: "weaknessPolicy", oneTime: true,
    hooks: {
      onDamagedByAttack: function(ctx) {
        if (ctx.mult >= 1.5 && ctx.holder.hp > 0) {
          var maxGain = 5 - ctx.holder.energy;
          var gained = Math.min(2, maxGain);
          if (gained > 0) {
            return { energyGain: gained, discard: true };
          }
        }
        return null;
      }
    }
  },

  // ---- Prevent energy loss ----
  {
    name: "White Herb", desc: "Prevent 2 energy loss", key: "whiteHerb", oneTime: true,
    hooks: {
      onEnergyLoss: function(ctx) {
        var prevented = Math.min(ctx.amount, 2);
        return { prevented: prevented, discard: true };
      }
    }
  },

  // ---- Team damage reduction (when active) ----
  {
    name: "Wide Shield", desc: "Active: team -10 dmg", key: "wideShield",
    hooks: {
      // This is a team-wide passive checked during damage calc, not per-holder
      onTeamTakeDamage: function(ctx) {
        // Only applies if holder is the active pokemon
        if (ctx.holderIsActive) return { reduction: 10 };
        return null;
      }
    }
  },

  // ---- Heavy Boots: prevent retreat ----
  {
    name: "Heavy Boots", desc: "Cannot retreat", key: "heavyBoots",
    hooks: {
      onRetreat: function(ctx) { return { preventRetreat: true }; }
    }
  },

  // ---- Black Sludge: damage after each turn ----
  {
    name: "Black Sludge", desc: "Lose 10 HP after each turn", key: "blackSludge",
    hooks: {
      onTurnEnd: function(ctx) {
        if (ctx.holder.hp > 0) {
          return { selfDamage: 10 };
        }
        return null;
      }
    }
  },

  // ---- Techno Claws: activated ability (1 mana for 40 damage) ----
  {
    name: "Techno Claws", desc: "Active: 1 mana to deal 40 dmg", key: "technoClaws",
    hooks: {
      // This is an activated ability, handled in game logic
      // Hook is just for metadata
    }
  },

  // ---- Life Dew: activated ability (1 mana to heal 50) ----
  {
    name: "Life Dew", desc: "Active: 1 mana to heal 50", key: "lifeDew",
    hooks: {
      // This is an activated ability, handled in game logic
      // Hook is just for metadata
    }
  },

  // ---- Hard Charm: flat damage reduction ----
  {
    name: "Hard Charm", desc: "-20 damage taken", key: "hardCharm",
    hooks: {
      onTakeDamage: function(ctx) { return { reduction: 20 }; }
    }
  },

  // ---- Power Weight: HP bonus + damage bonus + energy loss ----
  {
    name: "Power Weight", desc: "+40 HP, +20 dmg, lose 1 energy on attack", key: "powerWeight",
    hooks: {
      onDeploy: function(ctx) { return { hpBonus: 40 }; },
      onCalcDamageBonus: function(ctx) {
        if (ctx.isOppActive) return { bonusDmg: 20 };
        return null;
      },
      onAttack: function(ctx) {
        if (ctx.holder.energy > 0) {
          return { energyLoss: 1 };
        }
        return null;
      }
    }
  },

  // ---- Retaliate Claw: reactive damage on being hit ----
  {
    name: "Retaliate Claw", desc: "Attacked: 50 dmg back, discard", key: "retaliateClaw", oneTime: true,
    hooks: {
      onDamagedByAttack: function(ctx) {
        return { 
          events: [{ type: 'damage', target: ctx.attacker, amount: 50, source: 'Retaliate Claw' }],
          discard: true
        };
      }
    }
  },

  // ---- Rage Belt: damage bonus when low HP ----
  {
    name: "Rage Belt", desc: "<=50 HP: +50 dmg", key: "rageBelt",
    hooks: {
      onCalcDamageBonus: function(ctx) {
        if (ctx.isOppActive && ctx.holder.hp <= 50) return { bonusDmg: 50 };
        return null;
      }
    }
  },
];

// ============================================================
// Lookup helpers
// ============================================================
var _itemMap = null;

function _buildItemMap() {
  if (_itemMap) return;
  _itemMap = {};
  for (var i = 0; i < ITEM_DB.length; i++) {
    _itemMap[ITEM_DB[i].key] = ITEM_DB[i];
    _itemMap[ITEM_DB[i].name] = ITEM_DB[i];
  }
}

/** Get item definition by key or name */
function getItemData(keyOrName) {
  _buildItemMap();
  return _itemMap[keyOrName] || null;
}

/** Run a specific hook on an item, returns hook result or null */
function runItemHook(hookName, itemName, ctx) {
  _buildItemMap();
  var item = _itemMap[itemName];
  if (!item || !item.hooks || !item.hooks[hookName]) return null;
  return item.hooks[hookName](ctx);
}

// ============================================================
// EXPORTS
// ============================================================
exports.ITEM_DB = ITEM_DB;
exports.getItemData = getItemData;
exports.runItemHook = runItemHook;

})(typeof module !== 'undefined' && module.exports ? module.exports : (this.ItemDB = {}));
