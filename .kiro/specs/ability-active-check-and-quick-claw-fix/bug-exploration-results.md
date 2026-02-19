# Bug Condition Exploration Results

## Test Execution Summary

**Test File:** `shared/ability-active-check.test.js`  
**Test Status:** ✅ PASSED (Test correctly detected the bug - failures are expected)  
**Date:** 2026-02-19

## Counterexamples Found

The property-based tests successfully identified the fault conditions described in the bugfix requirements:

### 1. Arceus "Creation" Ability (Requirement 1.1/2.1)

**Counterexample:** Arceus's "Creation" ability was activated from bench position 0

**Details:**
- Pokemon: Arceus
- Ability: Creation (key: "creation")
- Expected Behavior: Should only work when Pokemon is active
- Actual Behavior: Ability activates from bench position
- Impact: Player can spend 1 mana to gain 2 mana from bench, which should not be allowed

### 2. Kricketune "Befuddling Melody" Ability (Requirement 1.2/2.2)

**Counterexample:** Kricketune's "Befuddling Melody" ability was activated from bench position 0

**Details:**
- Pokemon: Kricketune
- Ability: Befuddling Melody (key: "lullaby")
- Expected Behavior: Should only work when Pokemon is active
- Actual Behavior: Ability activates from bench position and confuses opponent's active Pokemon
- Impact: Player can confuse opponent's active Pokemon from the bench, which should not be allowed

## Root Cause Analysis

The bug exists in `shared/game-logic.js` in the `doUseAbility` function (line 1059):

```javascript
if (fromBench && (data.ability.activeOnly || (data.ability.desc && /\(active\)/i.test(data.ability.desc)))) return false;
```

This check correctly prevents abilities with `activeOnly: true` from being used from the bench. However:

1. **Arceus** (line 24-25 in `shared/pokemon-db.js`): The "Creation" ability does NOT have `activeOnly: true`
2. **Kricketune** (line 146-147 in `shared/pokemon-db.js`): The "Befuddling Melody" ability does NOT have `activeOnly: true`

## Fix Required

Add `activeOnly: true` flag to both Pokemon abilities in `shared/pokemon-db.js`:

1. Arceus's "Creation" ability
2. Kricketune's "Befuddling Melody" ability

## Regression Prevention

The test suite includes regression tests that verify:
- ✅ Abilities work correctly when Pokemon IS active (Requirements 3.1, 3.2)
- ✅ Both Arceus and Kricketune can use their abilities when active
- ✅ The abilities produce the expected effects (mana gain, confusion)

## Test Coverage

The property-based tests cover:
- Multiple bench positions (0-4)
- Both Pokemon (Arceus and Kricketune)
- Expected behavior validation (ability blocked, no events, no state changes)
- Regression prevention (abilities work when active)

Total test runs: 40+ property-based test cases across 4 test properties
