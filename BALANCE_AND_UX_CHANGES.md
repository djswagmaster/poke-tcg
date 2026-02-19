# Balance and UX Changes

## Changes Made

### 1. Leafeon Energy Cost Fix
**Changed**: Leafeon's "Energy Blade" attack energy cost from 3 to 1
- **File**: `shared/pokemon-db.js`
- **Before**: `{name:"Energy Blade",energy:3,baseDmg:30,desc:"+20 per own energy",fx:"scaleOwn:20"}`
- **After**: `{name:"Energy Blade",energy:1,baseDmg:30,desc:"+20 per own energy",fx:"scaleOwn:20"}`

### 2. Dialga's Roar of Time Rework
**Changed**: Dialga's "Roar of Time" attack mechanics
- **File**: `shared/pokemon-db.js`
- **Before**: Lose 4 energy, take another turn
- **After**: Lose 2 energy, take another turn, but can't attack during your next turn
- **New FX**: `selfEnergyLoss:2,extraTurn,lockAttack`
- **New Description**: "Lose 2 energy. Take another turn after this one. Can't attack during your next turn"

This makes Roar of Time less punishing (only -2 energy instead of -4) but adds a strategic drawback where Dialga can't attack on the bonus turn.

### 3. Palkia's Dimension Expansion Buff
**Changed**: Palkia's "Dimension Expansion" ability now grants +2 bench slots instead of +1
- **Files**: `shared/pokemon-db.js`, `shared/game-logic.js`, `game.js`
- **Before**: `p.maxBench = (p.maxBench || Constants.MAX_BENCH) + 1;`
- **After**: `p.maxBench = (p.maxBench || Constants.MAX_BENCH) + 2;`
- **New Description**: "On play: permanently increase your max bench size by 2"
- **New Log Message**: "Palkia expands your bench capacity by 2!"

### 4. Mana Gain Popup - Online Mode Fix
**Changed**: Mana gain popups now only show for your own mana gains in online mode
- **File**: `client/animation.js`
- **Before**: Always showed mana popup for both players
- **After**: Only shows popup when it's your mana being gained
- **Logic**: Checks `isOnline` and `myPlayerNum` to determine if popup should show

This prevents confusing popups when your opponent gains mana at the start of their turn.

### 5. Pokemon Selection - No Deselect
**Changed**: Clicking on an already-selected pokemon no longer deselects it
- **File**: `game.js` - `selectCard()` function
- **Before**: Clicking the same card would toggle it off (deselect)
- **After**: Clicking any card always selects it (no deselect)
- **Reason**: Ensures there's always a pokemon info panel displayed

## Testing Checklist

- [ ] Leafeon's Energy Blade costs 1 energy
- [ ] Dialga's Roar of Time loses 2 energy (not 4)
- [ ] Dialga can't attack on the bonus turn after Roar of Time
- [ ] Palkia grants +2 bench slots when played
- [ ] In online mode, mana gain popups only show for your own mana
- [ ] Clicking a selected pokemon keeps it selected (doesn't deselect)
- [ ] Pokemon info panel is always visible during battle

## Notes

### Dialga's lockAttack FX
The `lockAttack` effect is already implemented in the game logic. It sets:
- `attacker.cantUseAttack = attack.name`
- `attacker.cantUseAttackUntilTurn = G.turn + 1`

This prevents the pokemon from using that specific attack until the specified turn. Since Roar of Time is Dialga's only attack, this effectively prevents Dialga from attacking on the bonus turn.

### Online Mode Detection
The mana popup fix uses `window.isOnline` and `window.myPlayerNum` which are global variables set when connecting to a multiplayer game. In offline (hot-seat) mode, `isOnline` is false, so popups show for both players as expected.
