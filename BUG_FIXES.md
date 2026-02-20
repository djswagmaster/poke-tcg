# Bug Fixes

## Bugs Fixed

### 1. Reactive Items Working on Bench Pokemon
**Bug**: Reactive items like Burn Scarf were triggering even when the holder was on the bench taking snipe damage.

**Root Cause**: The `runReactiveItems` function in `shared/damage-pipeline.js` didn't check if the defender was the active pokemon before triggering reactive item effects.

**Fix**: Added a check at the start of `runReactiveItems` to ensure the defender is the active pokemon:

```javascript
// Reactive items should only trigger when the holder is the active pokemon
var defenderPlayer = G.players[defenderOwner];
var isDefenderActive = defenderPlayer.active === defender;
if (!isDefenderActive) return events;
```

**Result**: Reactive items (Burn Scarf, Rocky Helmet, Weakness Policy, etc.) now only trigger when the holder is attacked while active, not when taking snipe damage on the bench.

---

### 2. Bloodthirsty Not Letting User Choose
**Bug**: When Lycanroc's Bloodthirsty ability was used, it was supposed to let the player who used it choose which of the opponent's bench pokemon becomes active, but instead it let the opponent choose.

**Root Cause**: Bloodthirsty was using `pendingRetreats` with `reason: 'forced'`, which made the opponent select their own replacement. The ability should use targeting instead, allowing the current player to choose from the opponent's bench.

**Fix**: Changed bloodthirsty to use the targeting system:

1. In the ability activation (`shared/game-logic.js`):
```javascript
// Set up targeting so the current player chooses which opponent bench pokemon becomes active
var btTargets = [];
for (var bti = 0; bti < op(G).bench.length; bti++) {
  btTargets.push({ player: opp(G.currentPlayer), idx: bti, pk: op(G).bench[bti] });
}
G.targeting = {
  type: 'bloodthirsty',
  validTargets: btTargets,
  attackInfo: { sourceType: 'ability', type: 'bloodthirsty', attacker: pk }
};
```

2. In the target resolution (`doAbilityTarget` function):
```javascript
case 'bloodthirsty':
  // Force opponent to switch to the chosen bench pokemon
  var oppPlayer = G.players[targetPlayer];
  var oldActive = oppPlayer.active;
  oppPlayer.active = targetPk;
  oppPlayer.bench[targetBenchIdx] = oldActive;
```

**Result**: When Bloodthirsty is used, the player who used it can click on any of the opponent's bench pokemon to force that pokemon to become active. The opponent's old active goes to the bench.

---

### 3. Victory Screen Text
**Bug**: The victory overlay showed "First to 6 KOs!" which is no longer accurate since the win condition was changed to running out of pokemon (poke-mana system).

**Fix**: Removed the `<div class="win-sub">First to 6 KOs!</div>` line from `index.html`.

**Result**: The victory screen now just shows "🏆 [Player Name] Wins!" without the outdated KO reference.

---

## Testing Checklist

- [ ] Burn Scarf only triggers when holder is active (not on bench)
- [ ] Rocky Helmet only triggers when holder is active (not on bench)
- [ ] Weakness Policy only triggers when holder is active (not on bench)
- [ ] Bloodthirsty lets YOU choose which opponent bench pokemon becomes active
- [ ] Bloodthirsty shows opponent's bench as clickable targets
- [ ] Victory screen doesn't mention "6 KOs"

## Notes

### Reactive Items
The fix applies to ALL reactive items that use the `onDamagedByAttack` hook:
- Burn Scarf
- Rocky Helmet
- Weakness Policy
- Any future reactive items

These items will now only trigger when the holder is the active pokemon taking damage, which is the intended behavior for reactive "when attacked" effects.

### Forced Retreats vs Bloodthirsty
Previously, bloodthirsty used `reason: 'forced'` which made the opponent choose their own replacement. Now it uses the targeting system, which allows the player who used bloodthirsty to choose.

Other forced retreat effects (like certain attacks) still use `pendingRetreats` with `reason: 'forced'` and let the affected player choose their own replacement, which is the correct behavior for those effects.
