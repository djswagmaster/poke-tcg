# Multiplayer Poke-Mana Fix

## Issue
Poke-mana was displaying but not functioning in multiplayer mode because the `applyServerState` function in `game.js` was not applying the `pokeMana` field from the server state.

## What Was Wrong

When the server sent game state updates to clients, it included the `pokeMana` field. However, the client's `applyServerState` function was only applying `mana` and not `pokeMana`, so the client's local game state never received the pokeMana updates from the server.

## Solution

**FIXED**: Added `G.players[pNum].pokeMana = sp.pokeMana;` to the `applyServerState` function in `game.js`.

After pushing this fix to GitHub and redeploying on Render, poke-mana should work correctly in multiplayer mode.

## What Was Fixed

The following changes were made to support poke-mana in multiplayer:

1. **shared/game-logic.js**:
   - Added pokeMana initialization (25) in `createGame()`
   - Added pokeMana checks in `doPlayPokemon()` (battle phase)
   - Added pokeMana checks in `processSetupChoice()` (setup phase)
   - Added pokeMana deductions when playing pokemon

2. **game.js** (client):
   - Added pokeMana to snapshot/restore functions
   - Added pokeMana checks in setup selection functions
   - Added pokeMana display updates
   - Added pokeMana checks for affordability
   - **CRITICAL FIX**: Added pokeMana to `applyServerState` function

3. **index.html**:
   - Already had pokeMana display elements in place

4. **styles.css**:
   - Already had pokeMana styling in place

## Troubleshooting

### "Server error: Invalid action"

If you see this error in the console, it means:
1. The server hasn't been restarted yet (most common)
2. You're trying to play a pokemon without enough poke-mana
3. You're trying to play a pokemon without enough regular mana

**Solution**: Restart the server as described above.

### Softlock/Stuck Animation Issue

The console warnings about "Clearing stuck animating" are from the anti-softlock watchdog. This is working as intended - it detects when animations get stuck and automatically clears them after 4 seconds.

If you're seeing this frequently, it might indicate:
1. Network latency causing delayed responses
2. An action being rejected by the server (check for "Invalid action" errors)
3. An animation sequence that's taking too long

The watchdog prevents the game from becoming permanently stuck, so these warnings are actually a good sign that the safety mechanism is working.

### Poke-Mana Not Decreasing

If poke-mana displays but doesn't decrease:
1. **Server not restarted** - This is the most common cause. The server must be restarted!
2. Check the browser console for "Invalid action" errors
3. Try refreshing the page with a hard reload

## How It Works

The poke-mana system works as follows:

1. Both players start with 25 poke-mana
2. When you play a pokemon (during setup or battle), both regular mana AND poke-mana are deducted by the pokemon's cost
3. You cannot play a pokemon if you don't have enough of EITHER resource
4. Poke-mana never regenerates - it's a lifetime limit on how many pokemon you can play
5. The win condition is now "run out of pokemon" instead of "6 KOs"
