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
    if (onDrain) onDrain();
  }

  function isRunning() { return running; }
  function clear() { queue = []; running = false; }
  function setOnDrain(cb) { onDrain = cb; }

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

  // Helper: find a pokemon object in window.G by name string
  function _findPokemonObj(name) {
    if (typeof window === 'undefined' || !window.G) return null;
    for (var pNum = 1; pNum <= 2; pNum++) {
      var p = window.G.players[pNum];
      if (p.active && p.active.name === name) return p.active;
      for (var i = 0; i < p.bench.length; i++) {
        if (p.bench[i].name === name) return p.bench[i];
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
        var selfSel = ctx.findPokemonSelector ? ctx.findPokemonSelector(evt.pokemon) : '#youField .active-slot';
        if (selfSel) {
          ctx.showDamagePopupAt(evt.amount, selfSel, false);
          ctx.animateEl(selfSel, 'hit-shake', 500);
        }
        // Progressively apply self damage
        if (typeof window !== 'undefined' && window.G && evt.pokemon && evt.amount) {
          var sdPk = _findPokemonObj(evt.pokemon);
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
        var koSel = ctx.getPokemonSelector(evt.owner, -1);
        ctx.animateEl(koSel, 'ko-fall', 600);
        ctx.spawnParticlesAtEl(koSel, '#ef4444', 20, { spread: 70, size: 4 });
        await ctx.delay(600);
        // Remove the KO'd pokemon from snapshot state so re-render shows it gone
        if (typeof window !== 'undefined' && window.G && evt.owner) {
          var koOwner = window.G.players[evt.owner];
          if (koOwner.active && koOwner.active.name === evt.pokemon) {
            koOwner.active = null;
          } else {
            var koBIdx = koOwner.bench.findIndex(function(p) { return p.name === evt.pokemon; });
            if (koBIdx >= 0) koOwner.bench.splice(koBIdx, 1);
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
        var statApplySel = ctx.findPokemonSelector ? ctx.findPokemonSelector(evt.pokemon) : '#oppField .active-slot';
        var statColor = { poison: '#A33EA1', burn: '#EE8130', sleep: '#6b7280', confusion: '#eab308' };
        if (statApplySel) {
          ctx.animateEl(statApplySel, 'status-apply', 500);
          ctx.spawnParticlesAtEl(statApplySel, statColor[evt.status] || '#999', 10, { spread: 40 });
        }
        // Progressively apply status to snapshot state
        if (typeof window !== 'undefined' && window.G && evt.pokemon && evt.status) {
          var saPk = _findPokemonObj(evt.pokemon);
          if (saPk) saPk.status = evt.status;
        }
        ctx.renderBattle();
        await ctx.delay(500);
        break;

      case 'status_cure':
        var cureSel = ctx.findPokemonSelector ? ctx.findPokemonSelector(evt.pokemon) : null;
        if (cureSel) {
          ctx.animateEl(cureSel, 'status-cure', 500);
        }
        // Progressively clear status from snapshot state
        if (typeof window !== 'undefined' && window.G && evt.pokemon) {
          var scPk = _findPokemonObj(evt.pokemon);
          if (scPk) scPk.status = null;
        }
        ctx.renderBattle();
        await ctx.delay(400);
        break;

      case 'heal':
      case 'ability_heal':
      case 'item_heal':
        if (ctx.captureHpState) ctx.captureHpState();
        var healTarget = evt.target || evt.pokemon;
        var healSel = ctx.findPokemonSelector ? ctx.findPokemonSelector(healTarget) : null;
        if (healSel) {
          ctx.showDamagePopupAt(evt.amount, healSel, true);
          ctx.animateEl(healSel, 'heal-pulse', 500);
        }
        // Progressively apply heal to snapshot state
        if (typeof window !== 'undefined' && window.G && healTarget && evt.amount) {
          var healPk = _findPokemonObj(healTarget);
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
        var rdSel = ctx.findPokemonSelector ? ctx.findPokemonSelector(evt.target) : null;
        if (rdSel) {
          ctx.showDamagePopupAt(evt.amount, rdSel, false);
          ctx.animateEl(rdSel, 'hit-shake', 500);
        }
        // Progressively apply reactive damage
        if (typeof window !== 'undefined' && window.G && evt.target && evt.amount) {
          var rdPk = _findPokemonObj(evt.target);
          if (rdPk) { rdPk.damage = (rdPk.damage || 0) + evt.amount; rdPk.hp = Math.max(0, rdPk.maxHp - rdPk.damage); }
        }
        ctx.renderBattle();
        await ctx.delay(400);
        break;

      case 'recoilDamage':
        if (ctx.captureHpState) ctx.captureHpState();
        var rcSel = ctx.findPokemonSelector ? ctx.findPokemonSelector(evt.pokemon) : '#youField .active-slot';
        if (rcSel) ctx.showDamagePopupAt(evt.amount, rcSel, false);
        // Progressively apply recoil damage
        if (typeof window !== 'undefined' && window.G && evt.pokemon && evt.amount) {
          var rcPk = _findPokemonObj(evt.pokemon);
          if (rcPk) { rcPk.damage = (rcPk.damage || 0) + evt.amount; rcPk.hp = Math.max(0, rcPk.maxHp - rcPk.damage); }
        }
        ctx.renderBattle();
        await ctx.delay(300);
        break;

      case 'energy_gain':
      case 'energyGain':
        var egSel = ctx.findPokemonSelector ? ctx.findPokemonSelector(evt.pokemon) : null;
        if (egSel) {
          ctx.showEnergyPopup(egSel, '+' + (evt.amount || 1) + ' ⚡');
          ctx.animateEl(egSel, 'energy-gain', 400);
          ctx.spawnParticlesAtEl(egSel, '#F7D02C', 6, { spread: 30, size: 4 });
        }
        // Progressively apply energy gain to snapshot state
        if (typeof window !== 'undefined' && window.G && evt.pokemon) {
          var egPk = ctx.findPokemonSelector ? _findPokemonObj(evt.pokemon) : null;
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
        if (evt.player !== window.G.currentPlayer) switchSide = '#oppField';
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
      case 'ability_damage':
        ctx.renderBattle();
        await ctx.delay(400);
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
