// ============================================================
// POKEMON TCG - Animation Queue System (Client)
// ============================================================
// Replaces the manual G.animating flag with a sequential queue.
// Game events from shared/game-logic.js are translated into
// animation sequences and played back in order.
//
// No more missed G.animating clears = no more softlocks.
// ============================================================

var AnimQueue = (function() {
  'use strict';

  var queue = [];
  var running = false;
  var onDrain = null; // Callback when queue fully empties

  function push(animFn) {
    queue.push(animFn);
    flush();
  }

  function pushMultiple(animFns) {
    for (var i = 0; i < animFns.length; i++) {
      queue.push(animFns[i]);
    }
    flush();
  }

  async function flush() {
    if (running) return;
    running = true;
    while (queue.length > 0) {
      var anim = queue.shift();
      try {
        await anim();
      } catch (e) {
        console.error('[AnimQueue] Error in animation:', e);
      }
    }
    running = false;
    if (onDrain) { var cb = onDrain; onDrain = null; cb(); }
  }

  function isRunning() { return running; }
  function clear() { queue = []; running = false; }
  function setOnDrain(cb) {
    if (onDrain) {
      var prev = onDrain;
      onDrain = function() { prev(); cb(); };
    } else {
      onDrain = cb;
    }
  }

  // ============================================================
  // EVENT REPLAY: Translate game events into animations
  // ============================================================
  // This maps event types from game-logic to visual animations.
  // The client passes its animation helper functions in `animCtx`.
  //
  // animCtx = {
  //   renderBattle, delay, animateEl, spawnParticlesAtEl,
  //   showDamagePopup, showDamagePopupAt, showEnergyPopup, showManaPopup,
  //   showTurnOverlay, focusOnActives,
  //   getPokemonSelector, findPokemonSelector,
  //   TYPE_PARTICLE_COLORS
  // }
  // ============================================================

  // Helper: find a pokemon object in window.G.
  // Prefer owner+benchIdx when available (precise), fall back to name (legacy).
  function _findPokemonObj(name, owner, benchIdx) {
    if (typeof window === 'undefined' || !window.G) return null;
    // Precise lookup: use owner + benchIdx if provided
    if (owner && window.G.players[owner]) {
      var p = window.G.players[owner];
      if (benchIdx !== undefined && benchIdx !== null && benchIdx >= 0) {
        return p.bench[benchIdx] || null;
      }
      // benchIdx === -1 or not provided: try active first
      if (p.active && (!name || p.active.name === name)) return p.active;
      // If active is null (KO'd), search bench by name within this owner
      if (name) {
        for (var i = 0; i < p.bench.length; i++) {
          if (p.bench[i] && p.bench[i].name === name) return p.bench[i];
        }
      }
      return null;
    }
    // Fallback: search all players by name
    if (!name) return null;
    for (var pNum = 1; pNum <= 2; pNum++) {
      var pl = window.G.players[pNum];
      if (pl.active && pl.active.name === name) return pl.active;
      for (var j = 0; j < pl.bench.length; j++) {
        if (pl.bench[j] && pl.bench[j].name === name) return pl.bench[j];
      }
    }
    return null;
  }

  function replayEvents(events, animCtx) {
    if (!events || events.length === 0) return;

    var anims = [];
    for (var i = 0; i < events.length; i++) {
      (function(evt) {
        anims.push(function() {
          return replayOneEvent(evt, animCtx);
        });
      })(events[i]);
    }
    pushMultiple(anims);
  }

  async function replayOneEvent(evt, ctx) {
    switch (evt.type) {
      case 'log':
        // Logs are already in G.log — just render
        ctx.renderBattle();
        break;

      case 'attack_declare':
        ctx.renderBattle();
        ctx.focusOnActives();
        await ctx.delay(300);
        // Use getPokemonSelector which respects _replayPov via meNum()
        var atkSel = ctx.getPokemonSelector(evt.player || (window.G ? window.G.currentPlayer : 1), -1);
        ctx.animateEl(atkSel, 'attacking', 400);
        await ctx.delay(400);
        break;

      case 'damage':
        // Capture HP state BEFORE applying damage so animateHpBars sees the change
        if (ctx.captureHpState) ctx.captureHpState();
        var dmgBenchIdx = (evt.benchIdx !== undefined && evt.benchIdx !== null) ? evt.benchIdx : -1;
        var dmgSel = null;
        if (evt.targetOwner) dmgSel = ctx.getPokemonSelector(evt.targetOwner, dmgBenchIdx);
        if (!dmgSel && ctx.findPokemonSelector && evt.target) dmgSel = ctx.findPokemonSelector(evt.target);
        ctx.showDamagePopup(evt.amount, evt.mult, dmgSel);
        var shakeClass = evt.amount >= 100 ? 'heavy-shake' : evt.amount >= 50 ? 'hit-shake' : 'light-shake';
        var shakeDur = evt.amount >= 100 ? 700 : evt.amount >= 50 ? 500 : 300;
        ctx.animateEl(dmgSel, shakeClass, shakeDur);
        if (ctx.TYPE_PARTICLE_COLORS && evt.attackerType) {
          var color = ctx.TYPE_PARTICLE_COLORS[evt.attackerType] || '#ef4444';
          var count = evt.amount >= 100 ? 22 : evt.amount >= 50 ? 18 : 14;
          ctx.spawnParticlesAtEl(dmgSel, color, count, { spread: evt.amount >= 100 ? 75 : 55 });
        }
        // Progressively apply damage to snapshot state so HP bars update
        if (typeof window !== 'undefined' && window.G) {
          var dmgTarget = null;
          if (evt.targetOwner) {
            var dmgOwner = window.G.players[evt.targetOwner];
            dmgTarget = dmgBenchIdx === -1 ? dmgOwner.active : dmgOwner.bench[dmgBenchIdx];
          }
          if (!dmgTarget && evt.target) dmgTarget = _findPokemonObj(evt.target);
          if (dmgTarget) {
            dmgTarget.damage = (dmgTarget.damage || 0) + evt.amount;
            dmgTarget.hp = Math.max(0, dmgTarget.maxHp - dmgTarget.damage);
          }
        }
        ctx.renderBattle();
        await ctx.delay(evt.amount >= 100 ? 1400 : evt.amount >= 50 ? 1100 : 900);
        break;

      case 'selfDamage':
        if (ctx.captureHpState) ctx.captureHpState();
        var selfSel = null;
        if (evt.owner) selfSel = ctx.getPokemonSelector(evt.owner, -1);
        if (!selfSel && ctx.findPokemonSelector && evt.pokemon) selfSel = ctx.findPokemonSelector(evt.pokemon);
        if (!selfSel) selfSel = '#youField .active-slot';
        if (selfSel) {
          ctx.showDamagePopupAt(evt.amount, selfSel, false);
          ctx.animateEl(selfSel, 'hit-shake', 500);
        }
        // Progressively apply self damage
        if (typeof window !== 'undefined' && window.G && evt.amount) {
          var sdPk = _findPokemonObj(evt.pokemon, evt.owner);
          if (sdPk) { sdPk.damage = (sdPk.damage || 0) + evt.amount; sdPk.hp = Math.max(0, sdPk.maxHp - sdPk.damage); }
        }
        ctx.renderBattle();
        await ctx.delay(500);
        break;

      case 'statusDamage':
      case 'status_tick':
        if (ctx.captureHpState) ctx.captureHpState();
        var statusOwnerNum = evt.owner || evt.targetOwner;
        var statusSel = ctx.getPokemonSelector(statusOwnerNum, -1);
        var statusColor = evt.status === 'poison' ? '#A33EA1' : '#EE8130';
        ctx.spawnParticlesAtEl(statusSel, statusColor, 10, { spread: 40, size: 5 });
        ctx.animateEl(statusSel, 'status-apply', 500);
        var statusDmgAmt = evt.damage || evt.amount;
        ctx.showDamagePopupAt(statusDmgAmt, statusSel, false);
        // Progressively apply status damage to snapshot state
        if (typeof window !== 'undefined' && window.G && statusOwnerNum && statusDmgAmt) {
          var stOwner = window.G.players[statusOwnerNum];
          var stTarget = stOwner.active;
          if (stTarget) {
            stTarget.damage = (stTarget.damage || 0) + statusDmgAmt;
            stTarget.hp = Math.max(0, stTarget.maxHp - stTarget.damage);
          }
        }
        ctx.renderBattle();
        await ctx.delay(600);
        break;

      case 'ko':
        // Use isActive/benchIdx from event when available (precise), else infer from state
        var koIsActive = evt.isActive !== undefined ? evt.isActive : true;
        var koBenchIdx = evt.benchIdx !== undefined ? evt.benchIdx : -1;
        if (koIsActive === true && koBenchIdx === -1) {
          // Double check: if active doesn't match name, search bench
          if (typeof window !== 'undefined' && window.G && evt.owner) {
            var koCheck = window.G.players[evt.owner];
            if (!koCheck.active || koCheck.active.name !== evt.pokemon) {
              for (var ki = 0; ki < koCheck.bench.length; ki++) {
                if (koCheck.bench[ki] && koCheck.bench[ki].name === evt.pokemon && koCheck.bench[ki].hp <= 0) {
                  koIsActive = false; koBenchIdx = ki; break;
                }
              }
            }
          }
        }
        var koSel = ctx.getPokemonSelector(evt.owner, koIsActive ? -1 : koBenchIdx);
        ctx.animateEl(koSel, 'ko-fall', 600);
        ctx.spawnParticlesAtEl(koSel, '#ef4444', 20, { spread: 70, size: 4 });
        await ctx.delay(600);
        // Remove the KO'd pokemon from snapshot state so re-render shows it gone
        if (typeof window !== 'undefined' && window.G && evt.owner) {
          var koOwner = window.G.players[evt.owner];
          if (koIsActive && koOwner.active) {
            koOwner.active = null;
          } else if (!koIsActive && koBenchIdx >= 0 && koOwner.bench[koBenchIdx]) {
            koOwner.bench.splice(koBenchIdx, 1);
          } else if (koOwner.active && koOwner.active.name === evt.pokemon) {
            koOwner.active = null;
          } else {
            var koFallbackIdx = koOwner.bench.findIndex(function(p) { return p && p.name === evt.pokemon; });
            if (koFallbackIdx >= 0) koOwner.bench.splice(koFallbackIdx, 1);
          }
          // Update KO counter
          var scorerNum = evt.owner === 1 ? 2 : 1;
          if (evt.scorerKOs !== undefined) {
            window.G.players[scorerNum].kos = evt.scorerKOs;
          }
        }
        ctx.renderBattle();
        await ctx.delay(400);
        break;

      case 'statusApplied':
        var statApplySel = null;
        if (evt.owner) statApplySel = ctx.getPokemonSelector(evt.owner, -1);
        if (!statApplySel && ctx.findPokemonSelector && evt.pokemon) statApplySel = ctx.findPokemonSelector(evt.pokemon);
        if (!statApplySel) statApplySel = '#oppField .active-slot';
        var statColor = { poison: '#A33EA1', burn: '#EE8130', sleep: '#6b7280', confusion: '#eab308' };
        if (statApplySel) {
          ctx.animateEl(statApplySel, 'status-apply', 500);
          ctx.spawnParticlesAtEl(statApplySel, statColor[evt.status] || '#999', 10, { spread: 40 });
        }
        // Progressively apply status to snapshot state
        if (typeof window !== 'undefined' && window.G && evt.status) {
          var saPk = _findPokemonObj(evt.pokemon, evt.owner);
          if (saPk && saPk.status) {
            if (saPk.status.indexOf(evt.status) === -1) saPk.status.push(evt.status);
          }
        }
        ctx.renderBattle();
        await ctx.delay(500);
        break;

      case 'status_cure':
        var cureSel = null;
        if (evt.owner) cureSel = ctx.getPokemonSelector(evt.owner, -1);
        if (!cureSel && ctx.findPokemonSelector && evt.pokemon) cureSel = ctx.findPokemonSelector(evt.pokemon);
        if (cureSel) {
          ctx.animateEl(cureSel, 'status-cure', 500);
        }
        // Progressively clear status from snapshot state
        if (typeof window !== 'undefined' && window.G) {
          var scPk = _findPokemonObj(evt.pokemon, evt.owner);
          if (scPk && scPk.status) {
            if (evt.status) {
              scPk.status = scPk.status.filter(function(s) { return s !== evt.status; });
            } else {
              scPk.status = [];
            }
          }
        }
        ctx.renderBattle();
        await ctx.delay(400);
        break;

      case 'heal':
      case 'ability_heal':
      case 'item_heal':
        if (ctx.captureHpState) ctx.captureHpState();
        var healTarget = evt.target || evt.pokemon;
        var healSel = null;
        if (evt.owner) healSel = ctx.getPokemonSelector(evt.owner, -1);
        if (!healSel && ctx.findPokemonSelector && healTarget) healSel = ctx.findPokemonSelector(healTarget);
        if (healSel) {
          ctx.showDamagePopupAt(evt.amount, healSel, true);
          ctx.animateEl(healSel, 'heal-pulse', 500);
        }
        // Progressively apply heal to snapshot state
        if (typeof window !== 'undefined' && window.G && evt.amount) {
          var healPk = _findPokemonObj(healTarget, evt.owner);
          if (healPk) {
            healPk.damage = Math.max(0, (healPk.damage || 0) - evt.amount);
            healPk.hp = healPk.maxHp - healPk.damage;
          }
        }
        ctx.renderBattle();
        await ctx.delay(500);
        break;

      case 'item_proc':
      case 'itemProc':
        var ipSel = ctx.findPokemonSelector ? ctx.findPokemonSelector(evt.pokemon) : null;
        if (ipSel) {
          ctx.animateEl(ipSel, 'item-proc', 600);
          if (evt.effect === 'energyGain' && evt.amount) {
            ctx.showEnergyPopup(ipSel, '+' + evt.amount + ' ⚡');
          }
          if (evt.effect === 'heal' && evt.amount) {
            ctx.showDamagePopupAt(evt.amount, ipSel, true);
          }
          if (evt.effect === 'focusSash') {
            ctx.showDamagePopupAt(0, ipSel, true);
          }
        }
        ctx.renderBattle();
        await ctx.delay(500);
        break;

      case 'reactiveDamage':
        if (ctx.captureHpState) ctx.captureHpState();
        var rdSel = null;
        if (evt.targetOwner) rdSel = ctx.getPokemonSelector(evt.targetOwner, -1);
        if (!rdSel && ctx.findPokemonSelector && evt.target) rdSel = ctx.findPokemonSelector(evt.target);
        if (rdSel) {
          ctx.showDamagePopupAt(evt.amount, rdSel, false);
          ctx.animateEl(rdSel, 'hit-shake', 500);
        }
        // Progressively apply reactive damage
        if (typeof window !== 'undefined' && window.G && evt.amount) {
          var rdPk = _findPokemonObj(evt.target, evt.targetOwner);
          if (rdPk) { rdPk.damage = (rdPk.damage || 0) + evt.amount; rdPk.hp = Math.max(0, rdPk.maxHp - rdPk.damage); }
        }
        ctx.renderBattle();
        await ctx.delay(400);
        break;

      case 'recoilDamage':
        if (ctx.captureHpState) ctx.captureHpState();
        var rcSel = null;
        if (evt.owner) rcSel = ctx.getPokemonSelector(evt.owner, -1);
        if (!rcSel && ctx.findPokemonSelector && evt.pokemon) rcSel = ctx.findPokemonSelector(evt.pokemon);
        if (!rcSel) rcSel = '#youField .active-slot';
        if (rcSel) ctx.showDamagePopupAt(evt.amount, rcSel, false);
        // Progressively apply recoil damage
        if (typeof window !== 'undefined' && window.G && evt.amount) {
          var rcPk = _findPokemonObj(evt.pokemon, evt.owner);
          if (rcPk) { rcPk.damage = (rcPk.damage || 0) + evt.amount; rcPk.hp = Math.max(0, rcPk.maxHp - rcPk.damage); }
        }
        ctx.renderBattle();
        await ctx.delay(300);
        break;

      case 'energy_gain':
      case 'energyGain':
        var egSel = null;
        if (evt.owner) egSel = ctx.getPokemonSelector(evt.owner, evt.benchIdx !== undefined ? evt.benchIdx : -1);
        if (!egSel && ctx.findPokemonSelector && evt.pokemon) egSel = ctx.findPokemonSelector(evt.pokemon);
        if (egSel) {
          ctx.showEnergyPopup(egSel, '+' + (evt.amount || 1) + ' ⚡');
          ctx.animateEl(egSel, 'energy-gain', 400);
          ctx.spawnParticlesAtEl(egSel, '#F7D02C', 6, { spread: 30, size: 4 });
        }
        // Progressively apply energy gain to snapshot state
        if (typeof window !== 'undefined' && window.G) {
          var egPk = _findPokemonObj(evt.pokemon, evt.owner, evt.benchIdx);
          if (egPk) egPk.energy = (egPk.energy || 0) + (evt.amount || 1);
        }
        ctx.renderBattle();
        await ctx.delay(400);
        break;

      case 'mana_gain':
      case 'manaGain':
        if (ctx.showManaPopupForPlayer && evt.player) ctx.showManaPopupForPlayer(evt.player, evt.amount);
        else ctx.showManaPopup(evt.amount);
        // Progressively apply mana gain to snapshot state
        if (typeof window !== 'undefined' && window.G && evt.player) {
          window.G.players[evt.player].mana += evt.amount;
        }
        ctx.renderBattle();
        await ctx.delay(300);
        break;

      case 'switch_turn':
        ctx.showTurnOverlay(evt.playerName || ('Player ' + evt.player + "'s Turn"));
        await ctx.delay(1000);
        // Flip the hot-seat POV to the new player right when this event fires,
        // so the re-render shows the board from the new player's perspective.
        if (typeof window !== 'undefined' && window._replayPov != null) {
          window._replayPov = evt.player;
        }
        // Progressively update turn state in snapshot
        if (typeof window !== 'undefined' && window.G) {
          window.G.currentPlayer = evt.player;
          if (evt.turn) window.G.turn = evt.turn;
        }
        ctx.renderBattle();
        break;

      case 'extra_turn_start':
        ctx.showTurnOverlay((evt.playerName || ('Player ' + evt.player)) + ' gets an extra turn!');
        await ctx.delay(1000);
        if (typeof window !== 'undefined' && window._replayPov != null) {
          window._replayPov = evt.player;
        }
        if (typeof window !== 'undefined' && window.G) {
          window.G.currentPlayer = evt.player;
          if (evt.turn) window.G.turn = evt.turn;
        }
        ctx.renderBattle();
        break;

      case 'switch_active':
        if (typeof window !== 'undefined' && window.G && evt.player) {
          var swOwner = window.G.players[evt.player];
          if (swOwner) {
            var fromBenchIdx = (evt.benchIdx !== undefined && evt.benchIdx !== null) ? evt.benchIdx : null;
            if (fromBenchIdx !== null && swOwner.bench[fromBenchIdx]) {
              var incoming = swOwner.bench.splice(fromBenchIdx, 1)[0];
              if (swOwner.active && swOwner.active.hp > 0) swOwner.bench.push(swOwner.active);
              swOwner.active = incoming;
            }
          }
        }
        var switchSide = '#youField';
        if (typeof window !== 'undefined' && window.G && evt.player !== window.G.currentPlayer) switchSide = '#oppField';
        ctx.renderBattle();
        ctx.animateEl(switchSide + ' .active-slot', 'slide-in', 350);
        await ctx.delay(500);
        break;

      case 'retreat_pending':
        ctx.renderBattle();
        break;

      case 'forceSwitch':
        ctx.renderBattle();
        await ctx.delay(500);
        break;

      case 'win':
        // Win is handled by caller
        ctx.renderBattle();
        break;

      case 'needNewActive':
        ctx.renderBattle();
        break;

      case 'phase_change':
        ctx.renderBattle();
        break;

      case 'play_pokemon':
        ctx.renderBattle();
        await ctx.delay(300);
        break;

      case 'ability_effect':
      case 'ability_targeting':
        ctx.renderBattle();
        await ctx.delay(400);
        break;

      case 'ability_damage':
        if (ctx.captureHpState) ctx.captureHpState();
        var abSel = null;
        if (evt.owner) abSel = ctx.getPokemonSelector(evt.owner, -1);
        if (!abSel && ctx.findPokemonSelector && evt.target) abSel = ctx.findPokemonSelector(evt.target);
        if (abSel) {
          ctx.showDamagePopupAt(evt.amount, abSel, false);
          ctx.animateEl(abSel, 'hit-shake', 450);
        }
        if (typeof window !== 'undefined' && window.G && evt.amount) {
          var adPk = _findPokemonObj(evt.target, evt.owner);
          if (adPk) {
            adPk.damage = (adPk.damage || 0) + evt.amount;
            adPk.hp = Math.max(0, adPk.maxHp - adPk.damage);
          }
        }
        ctx.renderBattle();
        await ctx.delay(450);
        break;

      case 'discard_item':
        ctx.renderBattle();
        break;

      case 'confusion_fail':
        ctx.renderBattle();
        await ctx.delay(500);
        break;

      case 'filtered':
        ctx.renderBattle();
        await ctx.delay(500);
        break;

      case 'noDamage':
        ctx.renderBattle();
        break;

      case 'energyStrip':
        // Progressively apply energy strip to defender
        var esSel = null;
        if (evt.targetOwner) esSel = ctx.getPokemonSelector(evt.targetOwner, -1);
        if (!esSel && ctx.findPokemonSelector && evt.pokemon) esSel = ctx.findPokemonSelector(evt.pokemon);
        if (esSel) {
          ctx.showEnergyPopup(esSel, '-' + (evt.amount || 1) + ' \u26A1');
          ctx.animateEl(esSel, 'hit-shake', 350);
        }
        if (typeof window !== 'undefined' && window.G) {
          var esPk = _findPokemonObj(evt.pokemon, evt.targetOwner);
          if (esPk) esPk.energy = Math.max(0, (esPk.energy || 0) - (evt.amount || 1));
        }
        ctx.renderBattle();
        await ctx.delay(400);
        break;

      case 'selfEnergyLoss':
        // Progressively apply self energy loss
        var selSel = null;
        if (evt.owner) selSel = ctx.getPokemonSelector(evt.owner, -1);
        if (!selSel && ctx.findPokemonSelector && evt.pokemon) selSel = ctx.findPokemonSelector(evt.pokemon);
        if (selSel) {
          ctx.showEnergyPopup(selSel, '-' + (evt.amount || 1) + ' \u26A1');
        }
        if (typeof window !== 'undefined' && window.G) {
          var selPk = _findPokemonObj(evt.pokemon, evt.owner);
          if (selPk) selPk.energy = Math.max(0, (selPk.energy || 0) - (evt.amount || 1));
        }
        ctx.renderBattle();
        await ctx.delay(350);
        break;

      case 'selfBenchDmg':
        // Progressively apply bench damage
        if (ctx.captureHpState) ctx.captureHpState();
        var sbdSel = null;
        if (evt.owner && evt.benchIdx !== undefined) sbdSel = ctx.getPokemonSelector(evt.owner, evt.benchIdx);
        if (!sbdSel && ctx.findPokemonSelector && evt.pokemon) sbdSel = ctx.findPokemonSelector(evt.pokemon);
        if (sbdSel) {
          ctx.showDamagePopupAt(evt.amount, sbdSel, false);
          ctx.animateEl(sbdSel, 'hit-shake', 400);
        }
        if (typeof window !== 'undefined' && window.G && evt.amount) {
          var sbdPk = _findPokemonObj(evt.pokemon, evt.owner, evt.benchIdx);
          if (sbdPk) {
            sbdPk.damage = (sbdPk.damage || 0) + evt.amount;
            sbdPk.hp = Math.max(0, sbdPk.maxHp - sbdPk.damage);
          }
        }
        ctx.renderBattle();
        await ctx.delay(450);
        break;

      case 'baton_pass':
        // Progressively apply baton pass energy gain
        var bpSel = null;
        if (evt.owner) bpSel = ctx.getPokemonSelector(evt.owner, -1);
        if (!bpSel && ctx.findPokemonSelector && evt.pokemon) bpSel = ctx.findPokemonSelector(evt.pokemon);
        if (bpSel) {
          ctx.showEnergyPopup(bpSel, '+' + (evt.energy || 0) + ' \u26A1');
          ctx.animateEl(bpSel, 'energy-gain', 400);
          ctx.spawnParticlesAtEl(bpSel, '#F7D02C', 6, { spread: 30, size: 4 });
        }
        if (typeof window !== 'undefined' && window.G) {
          var bpPk = _findPokemonObj(evt.pokemon, evt.owner);
          if (bpPk) bpPk.energy = Math.min((bpPk.energy || 0) + (evt.energy || 0), 5);
        }
        ctx.renderBattle();
        await ctx.delay(400);
        break;

      default:
        // Unknown event — just render
        ctx.renderBattle();
        break;
    }
  }

  return {
    push: push,
    pushMultiple: pushMultiple,
    flush: flush,
    isRunning: isRunning,
    clear: clear,
    setOnDrain: setOnDrain,
    replayEvents: replayEvents,
  };
})();
