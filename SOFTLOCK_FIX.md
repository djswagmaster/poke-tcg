# Softlock Fix

## The Problem

You were getting stuck mid-turn where you couldn't interact with anything. The console showed "[renderBattle] Clearing stuck animating" warnings, which meant the watchdog was detecting that `G.animating` was stuck at `true` for more than 4 seconds.

## Root Causes

### Issue 1: AnimQueue Not Calling onDrain for Empty Events

When the server sent a gameState with an empty events array, the client would:
1. Check `if (events.length > 0)` - FALSE
2. Go to else branch - no problem
3. BUT if somehow `replayEvents` was called with empty array, it would return early without calling `onDrain`

This meant if `G.animating = true` was set and then `replayEvents([])` was called, the onDrain callback would never fire, leaving `G.animating` stuck at true forever.

### Issue 2: No Error Handling in onDrain Callback

If an error occurred inside the onDrain callback (in `applyServerState` or `renderBattle`), the callback would throw and `G.animating` would never get cleared.

### Issue 3: No Timeout Fallback

If the AnimQueue got stuck for any reason (network issue, race condition, etc.), there was no fallback to force-clear the animating state besides the global watchdog.

## The Fixes

### Fix 1: AnimQueue Always Calls onDrain

Modified `client/animation.js` to ensure `replayEvents` always calls onDrain, even for empty events:

```javascript
function replayEvents(events, animCtx) {
  if (!events || events.length === 0) {
    // Empty events - immediately trigger onDrain if set
    if (onDrain) {
      var cb = onDrain;
      onDrain = null;
      setTimeout(cb, 0);  // Async like normal flush
    }
    return;
  }
  // ... rest of function
}
```

### Fix 2: Error Handling in onDrain

Added try-catch in the onDrain callback in `game.js`:

```javascript
AnimQueue.setOnDrain(() => {
  try {
    applyServerState(state);
    G.animating = false;
    renderBattle();
    if (G.winner) showWin(G.winner);
  } catch (e) {
    console.error('[handleGameState] Error in onDrain:', e);
    G.animating = false;
    renderBattle();
  }
});
```

### Fix 3: Timeout Fallback

Added a 5-second timeout fallback in `game.js`:

```javascript
// Fallback: if onDrain doesn't fire within 5 seconds, force clear
setTimeout(() => {
  if (G.animating) {
    console.warn('[handleGameState] onDrain timeout, force clearing animating');
    G.animating = false;
    applyServerState(state);
    renderBattle();
  }
}, 5000);
```

## Result

With these fixes:
1. The AnimQueue will always call onDrain, even for empty events
2. Errors in the onDrain callback won't leave you stuck
3. If something goes wrong, the 5-second timeout will force-clear the stuck state
4. The existing 4-second watchdog in renderBattle provides an additional safety net

You should no longer get stuck mid-turn unable to interact with anything.

## Testing

After deploying these changes:
1. Play a multiplayer game
2. Try various actions (attacks, retreats, playing pokemon)
3. Check if you ever get stuck unable to click anything
4. The console warnings should be much less frequent or gone entirely
