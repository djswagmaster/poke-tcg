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
        // Use attacker's player number to determine correct side
        var atkSide = (evt.player && evt.player !== (window.G ? window.G.currentPlayer : 1)) ? '#oppField' : '#youField';
        ctx.animateEl(atkSide + ' .active-slot', 'attacking', 400);
        await ctx.delay(400);
        break;

      case 'damage':
        var dmgSel = ctx.getPokemonSelector(evt.targetOwner, evt.benchIdx !== undefined ? evt.benchIdx : -1);
        ctx.showDamagePopup(evt.amount, evt.mult, dmgSel);
        var shakeClass = evt.amount >= 100 ? 'heavy-shake' : evt.amount >= 50 ? 'hit-shake' : 'light-shake';
        var shakeDur = evt.amount >= 100 ? 700 : evt.amount >= 50 ? 500 : 300;
        ctx.animateEl(dmgSel, shakeClass, shakeDur);
        if (ctx.TYPE_PARTICLE_COLORS && evt.attackerType) {
          var color = ctx.TYPE_PARTICLE_COLORS[evt.attackerType] || '#ef4444';
          var count = evt.amount >= 100 ? 22 : evt.amount >= 50 ? 18 : 14;
          ctx.spawnParticlesAtEl(dmgSel, color, count, { spread: evt.amount >= 100 ? 75 : 55 });
        }
        ctx.renderBattle();
        await ctx.delay(evt.amount >= 100 ? 1400 : evt.amount >= 50 ? 1100 : 900);
        break;

      case 'selfDamage':
        var selfSel = ctx.findPokemonSelector ? ctx.findPokemonSelector(evt.pokemon) : '#youField .active-slot';
        if (selfSel) {
          ctx.showDamagePopupAt(evt.amount, selfSel, false);
          ctx.animateEl(selfSel, 'hit-shake', 500);
        }
        ctx.renderBattle();
        await ctx.delay(500);
        break;

      case 'statusDamage':
      case 'status_tick':
        var statusSel = ctx.getPokemonSelector(evt.owner || evt.targetOwner, -1);
        var statusColor = evt.status === 'poison' ? '#A33EA1' : '#EE8130';
        ctx.spawnParticlesAtEl(statusSel, statusColor, 10, { spread: 40, size: 5 });
        ctx.animateEl(statusSel, 'status-apply', 500);
        ctx.showDamagePopupAt(evt.damage || evt.amount, statusSel, false);
        ctx.renderBattle();
        await ctx.delay(600);
        break;

      case 'ko':
        var koSel = ctx.getPokemonSelector(evt.owner, -1);
        ctx.animateEl(koSel, 'ko-fall', 600);
        ctx.spawnParticlesAtEl(koSel, '#ef4444', 20, { spread: 70, size: 4 });
        await ctx.delay(600);
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
        ctx.renderBattle();
        await ctx.delay(500);
        break;

      case 'status_cure':
        var cureSel = ctx.findPokemonSelector ? ctx.findPokemonSelector(evt.pokemon) : null;
        if (cureSel) {
          ctx.animateEl(cureSel, 'status-cure', 500);
        }
        ctx.renderBattle();
        await ctx.delay(400);
        break;

      case 'heal':
      case 'ability_heal':
      case 'item_heal':
        var healTarget = evt.target || evt.pokemon;
        var healSel = ctx.findPokemonSelector ? ctx.findPokemonSelector(healTarget) : null;
        if (healSel) {
          ctx.showDamagePopupAt(evt.amount, healSel, true);
          ctx.animateEl(healSel, 'heal-pulse', 500);
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
        var rdSel = ctx.findPokemonSelector ? ctx.findPokemonSelector(evt.target) : null;
        if (rdSel) {
          ctx.showDamagePopupAt(evt.amount, rdSel, false);
          ctx.animateEl(rdSel, 'hit-shake', 500);
        }
        ctx.renderBattle();
        await ctx.delay(400);
        break;

      case 'recoilDamage':
        var rcSel = ctx.findPokemonSelector ? ctx.findPokemonSelector(evt.pokemon) : '#youField .active-slot';
        if (rcSel) ctx.showDamagePopupAt(evt.amount, rcSel, false);
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
        ctx.renderBattle();
        await ctx.delay(400);
        break;

      case 'mana_gain':
      case 'manaGain':
        ctx.showManaPopup(evt.amount);
        ctx.renderBattle();
        await ctx.delay(300);
        break;

      case 'switch_turn':
        ctx.showTurnOverlay(evt.playerName || ('Player ' + evt.player + "'s Turn"));
        await ctx.delay(1000);
        ctx.renderBattle();
        break;

      case 'switch_active':
        var switchSide = '#youField';
        if (evt.player !== window.G.currentPlayer) switchSide = '#oppField';
        ctx.animateEl(switchSide + ' .active-slot', 'slide-in', 350);
        ctx.renderBattle();
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
