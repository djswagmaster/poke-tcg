# Implementation Plan

## Bug 1: Active-Only Abilities Usable from Bench

- [x] 1. Write bug condition exploration test for active-only abilities
  - **Property 1: Fault Condition** - Active-Only Abilities Usable from Bench
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate abilities work from bench when they shouldn't
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: Arceus on bench using "Creation", Kricketune on bench using "Befuddling Melody"
  - Test that attempting to activate these abilities from bench is prevented (from Fault Condition in design)
  - The test assertions should match the Expected Behavior Properties from design (abilityActivated == FALSE, appropriate error message, game state unchanged)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (abilities are incorrectly allowed from bench - this proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. Write preservation property tests for active-only abilities (BEFORE implementing fix)
  - **Property 2: Preservation** - Active-Only Abilities When Active and Bench-Usable Abilities
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Arceus using "Creation" when active
    - Kricketune using "Befuddling Melody" when active
    - Other bench-usable abilities (e.g., Slurpuff's "Yummy Delivery") working from bench
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements (PR1-PR5)
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.5_

- [x] 3. Fix active-only ability enforcement

  - [x] 3.1 Add activeOnly flag to ability definitions
    - Locate ability definitions for Arceus's "Creation" ability
    - Add `activeOnly: true` flag to "Creation" ability definition
    - Locate ability definitions for Kricketune's "Befuddling Melody" ability
    - Add `activeOnly: true` flag to "Befuddling Melody" ability definition
    - Verify the game engine's ability activation logic respects the activeOnly flag
    - _Bug_Condition: pokemon IN {Arceus, Kricketune} AND ability IN {"Creation", "Befuddling Melody"} AND position == BENCH_
    - _Expected_Behavior: abilityActivated == FALSE AND errorMessage displayed AND gameState unchanged_
    - _Preservation: PR1-PR5 from design (abilities work when active, bench-usable abilities unaffected)_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Active-Only Abilities Prevented from Bench
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms abilities are now prevented from bench)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Active-Only Abilities When Active and Bench-Usable Abilities
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (abilities work when active, other abilities unaffected)

- [x] 4. Checkpoint - Ensure all Bug 1 tests pass
  - Verify exploration test passes (abilities prevented from bench)
  - Verify preservation tests pass (no regressions)
  - Ask user if questions arise

## Bug 2: Quick Claw Not Applying to Copied Attacks

- [x] 5. Write bug condition exploration test for Quick Claw with copied attacks
  - **Property 1: Fault Condition** - Quick Claw Not Reducing Copied Attack Costs
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate Quick Claw doesn't reduce copied attack costs
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: Ditto with Quick Claw using "Improvised Attack", Mew with Quick Claw using "Versatility"
  - Test that Quick Claw reduces copied attack energy cost by 2 (from Fault Condition in design)
  - The test assertions should match the Expected Behavior Properties from design (energyCost == max(0, original - 2), quickClawApplied == TRUE)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (cost reduction not applied - this proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.3, 1.4, 2.3, 2.4_

- [x] 6. Write preservation property tests for Quick Claw (BEFORE implementing fix)
  - **Property 2: Preservation** - Quick Claw with Normal Attacks and Other Behaviors
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Quick Claw reducing cost for normal (non-copied) attacks
    - Ditto's "Improvised Attack" working without Quick Claw
    - Mew's "Versatility" working without Quick Claw
    - Quick Claw consumption behavior
    - Other held items (e.g., Thick Aroma) working correctly
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements (PR1-PR7)
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.3, 3.4, 3.6, 3.7_

- [x] 7. Fix Quick Claw application to copied attacks

  - [x] 7.1 Apply Quick Claw cost reduction to copied attacks
    - Locate the attack copying logic for Ditto's "Improvised Attack" ability
    - Ensure Quick Claw's cost reduction is applied to the copied attack's energy cost
    - Locate the attack copying logic for Mew's "Versatility" ability
    - Ensure Quick Claw's cost reduction is applied to the copied attack's energy cost
    - Verify cost reduction happens before attack execution check
    - Verify Quick Claw is properly consumed after use
    - Ensure minimum energy cost is 0 (cannot go negative)
    - _Bug_Condition: pokemon IN {Ditto, Mew} AND heldItem == QuickClaw AND ability IN {"Improvised Attack", "Versatility"}_
    - _Expected_Behavior: energyCost == max(0, original - 2) AND quickClawApplied == TRUE_
    - _Preservation: PR1-PR7 from design (Quick Claw works for normal attacks, copying works without Quick Claw, other items unaffected)_
    - _Requirements: 1.3, 1.4, 2.3, 2.4, 3.3, 3.4, 3.6, 3.7_

  - [x] 7.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Quick Claw Reduces Copied Attack Costs
    - **IMPORTANT**: Re-run the SAME test from task 5 - do NOT write a new test
    - The test from task 5 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 5
    - **EXPECTED OUTCOME**: Test PASSES (confirms Quick Claw now reduces copied attack costs)
    - _Requirements: 2.3, 2.4_

  - [x] 7.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Quick Claw with Normal Attacks and Other Behaviors
    - **IMPORTANT**: Re-run the SAME tests from task 6 - do NOT write new tests
    - Run preservation property tests from step 6
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (Quick Claw works for normal attacks, other behaviors unaffected)

- [x] 8. Final Checkpoint - Ensure all tests pass
  - Verify all Bug 1 tests pass
  - Verify all Bug 2 tests pass
  - Verify no regressions in existing functionality
  - Ask user if questions arise
