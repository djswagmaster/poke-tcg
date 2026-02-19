// ============================================================
// Preservation Property Tests: Quick Claw with Normal Attacks and Other Behaviors
// ============================================================
// **Validates: Requirements 3.3, 3.4, 3.6, 3.7**
//
// IMPORTANT: These tests verify behavior we want to PRESERVE when fixing the bug.
// They should PASS on unfixed code and continue to pass after the fix.
//
// These tests follow the observation-first methodology:
// - Observe behavior on UNFIXED code for non-buggy inputs
// - Write property-based tests capturing observed behavior patterns
// - Run tests on UNFIXED code
// - EXPECTED OUTCOME: Tests PASS (confirms baseline behavior to preserve)
// ============================================================

const fc = require('fast-check');
const GameLogic = require('./game-logic');
const PokemonDB = require('./pokemon-db');

describe('Preservation Property Tests: Quick Claw with Normal Attacks and Other Behaviors', () => {
  /**
   * Property 2a: Preservation - Quick Claw SHOULD reduce normal (non-copied) attack costs by 2
   * 
   * This property tests the PRESERVATION requirement (PR4):
   * - Requirement 3.4: When a Pokemon with Quick Claw uses its own attacks (not copied),
   *   the system SHALL CONTINUE TO reduce the energy cost by 2
   * 
   * This test should PASS on unfixed code and continue to pass after the fix.
   */
  test('Property 2a: Quick Claw SHOULD reduce normal attack energy cost by 2', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Test various Pokemon with attacks that cost 2+ energy
          { pokemon: 'Charizard', attackIdx: 0, attackName: 'Claw Slash', originalCost: 2, energyNeeded: 0 },
          { pokemon: 'Charizard', attackIdx: 1, attackName: 'Inferno Burst', originalCost: 4, energyNeeded: 2 },
          { pokemon: 'Chansey', attackIdx: 0, attackName: 'Double Edge', originalCost: 4, energyNeeded: 2 },
          { pokemon: 'Gengar', attackIdx: 1, attackName: 'Shadow Ball', originalCost: 3, energyNeeded: 1 }
        ),
        (testCase) => {
          // Setup: Create a game with Pokemon with Quick Claw
          const G = GameLogic.createGame();
          G.phase = 'battle';
          G.currentPlayer = 1;
          G.turn = 1;
          
          const player = G.players[1];
          const opponent = G.players[2];
          
          // Setup Pokemon with Quick Claw as active
          player.active = GameLogic.makePokemon(testCase.pokemon, 'Quick Claw');
          opponent.active = GameLogic.makePokemon('Cleffa', null);
          
          // Give Pokemon exactly (originalCost - 2) energy
          // This means: with Quick Claw, attack should succeed; without it, should fail
          player.active.energy = testCase.energyNeeded;
          player.mana = 5;
          
          // Verify Quick Claw is active
          if (!player.active.quickClawActive) {
            throw new Error('Test setup error: Quick Claw should be active');
          }
          
          // Clear events
          G.events = [];
          
          // ACTION: Use the normal attack
          const attackResult = GameLogic.processAction(G, 1, {
            type: 'attack',
            attackIndex: testCase.attackIdx
          });
          
          // EXPECTED BEHAVIOR (Requirement 3.4):
          // 1. The attack SHOULD succeed because Quick Claw reduces cost by 2
          // 2. Quick Claw should be consumed (quickClawActive = false, heldItem = null)
          // 3. An item_proc event should be generated for Quick Claw
          
          const quickClawConsumed = !player.active.quickClawActive && player.active.heldItem === null;
          const quickClawEventGenerated = G.events.some(e => 
            e.type === 'item_proc' && e.item === 'Quick Claw' && e.effect === 'costReduction'
          );
          
          // ASSERTION: Attack should succeed with Quick Claw
          if (!attackResult) {
            throw new Error(
              `PRESERVATION FAILURE: ${testCase.pokemon} with Quick Claw failed to use normal attack "${testCase.attackName}" ` +
              `(original cost: ${testCase.originalCost}, energy: ${testCase.energyNeeded}). ` +
              `With Quick Claw, the cost should be ${Math.max(0, testCase.originalCost - 2)}, ` +
              `so the attack should succeed. (Requirement 3.4)`
            );
          }
          
          if (!quickClawConsumed) {
            throw new Error(
              `PRESERVATION FAILURE: Quick Claw was not consumed after ${testCase.pokemon} used normal attack. ` +
              `quickClawActive: ${player.active.quickClawActive}, heldItem: ${player.active.heldItem}. ` +
              `Quick Claw should be discarded after use. (Requirement 3.6)`
            );
          }
          
          if (!quickClawEventGenerated) {
            throw new Error(
              `PRESERVATION FAILURE: No item_proc event generated for Quick Claw when ${testCase.pokemon} used normal attack. ` +
              `Quick Claw activation should generate an event.`
            );
          }
          
          // If we reach here, Quick Claw correctly reduced the normal attack cost
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 2b: Preservation - Ditto's Improvised Attack SHOULD work without Quick Claw
   * 
   * This property tests the PRESERVATION requirement (PR3):
   * - Requirement 3.3: When Ditto uses "Improvised Attack" without Quick Claw equipped,
   *   the system SHALL CONTINUE TO calculate energy costs normally
   * 
   * This test should PASS on unfixed code and continue to pass after the fix.
   */
  test('Property 2b: Ditto Improvised Attack SHOULD work without Quick Claw', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Test various opponent Pokemon with attacks
          { pokemon: 'Charizard', attackIdx: 0, attackName: 'Claw Slash', originalCost: 2 },
          { pokemon: 'Charizard', attackIdx: 1, attackName: 'Inferno Burst', originalCost: 4 },
          { pokemon: 'Chansey', attackIdx: 0, attackName: 'Double Edge', originalCost: 4 }
        ),
        (testCase) => {
          // Setup: Create a game with Ditto WITHOUT Quick Claw
          const G = GameLogic.createGame();
          G.phase = 'battle';
          G.currentPlayer = 1;
          G.turn = 1;
          
          const player = G.players[1];
          const opponent = G.players[2];
          
          // Setup Ditto WITHOUT Quick Claw as active
          player.active = GameLogic.makePokemon('Ditto', null);
          opponent.active = GameLogic.makePokemon(testCase.pokemon, null);
          
          // Give Ditto enough energy for Improvised Attack (1) + the copied attack (originalCost)
          player.active.energy = 1 + testCase.originalCost;
          player.mana = 5;
          
          // ACTION 1: Activate Improvised Attack
          const improviseResult = GameLogic.processAction(G, 1, {
            type: 'useAbility',
            key: 'improvise',
            sourceBenchIdx: -1
          });
          
          if (!improviseResult || !player.active.improviseActive) {
            throw new Error('Test setup error: Improvised Attack failed to activate');
          }
          
          // After Improvised Attack, Ditto should have exactly originalCost energy left
          if (player.active.energy !== testCase.originalCost) {
            throw new Error(`Test setup error: Expected ${testCase.originalCost} energy after Improvised Attack, got ${player.active.energy}`);
          }
          
          // Clear events
          G.events = [];
          
          // ACTION 2: Use the copied attack
          const attackResult = GameLogic.processAction(G, 1, {
            type: 'copiedAttack',
            sourceName: testCase.pokemon,
            attackIndex: testCase.attackIdx
          });
          
          // EXPECTED BEHAVIOR (Requirement 3.3):
          // 1. The attack SHOULD succeed because Ditto has enough energy (no Quick Claw reduction)
          // 2. No Quick Claw event should be generated
          
          const quickClawEventGenerated = G.events.some(e => 
            e.type === 'item_proc' && e.item === 'Quick Claw'
          );
          
          // ASSERTION: Attack should succeed without Quick Claw
          if (!attackResult) {
            throw new Error(
              `PRESERVATION FAILURE: Ditto without Quick Claw failed to use copied attack "${testCase.attackName}" ` +
              `(original cost: ${testCase.originalCost}, Ditto energy: ${testCase.originalCost}). ` +
              `Without Quick Claw, the cost should be ${testCase.originalCost}, ` +
              `so the attack should succeed. (Requirement 3.3)`
            );
          }
          
          if (quickClawEventGenerated) {
            throw new Error(
              `PRESERVATION FAILURE: Quick Claw event generated when Ditto doesn't have Quick Claw. ` +
              `No Quick Claw event should be generated.`
            );
          }
          
          // If we reach here, Ditto's Improvised Attack works correctly without Quick Claw
          return true;
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property 2c: Preservation - Mew's Versatility SHOULD work without Quick Claw
   * 
   * This property tests the PRESERVATION requirement (PR3):
   * - Requirement 3.3: When Mew uses "Versatility" without Quick Claw equipped,
   *   the system SHALL CONTINUE TO calculate energy costs normally
   * 
   * This test should PASS on unfixed code and continue to pass after the fix.
   */
  test('Property 2c: Mew Versatility SHOULD work without Quick Claw', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Test various bench ally Pokemon with attacks
          { pokemon: 'Charizard', attackIdx: 0, attackName: 'Claw Slash', originalCost: 2 },
          { pokemon: 'Charizard', attackIdx: 1, attackName: 'Inferno Burst', originalCost: 4 },
          { pokemon: 'Chansey', attackIdx: 0, attackName: 'Double Edge', originalCost: 4 }
        ),
        fc.integer({ min: 0, max: 4 }), // Bench position
        (testCase, benchIdx) => {
          // Setup: Create a game with Mew WITHOUT Quick Claw
          const G = GameLogic.createGame();
          G.phase = 'battle';
          G.currentPlayer = 1;
          G.turn = 1;
          
          const player = G.players[1];
          const opponent = G.players[2];
          
          // Setup Mew WITHOUT Quick Claw as active
          player.active = GameLogic.makePokemon('Mew', null);
          opponent.active = GameLogic.makePokemon('Cleffa', null);
          
          // Place bench ally with the attack to copy
          player.bench[benchIdx] = GameLogic.makePokemon(testCase.pokemon, null);
          
          // Give Mew exactly originalCost energy
          player.active.energy = testCase.originalCost;
          player.mana = 5;
          
          // Clear events
          G.events = [];
          
          // ACTION: Use the copied attack via Versatility
          const attackResult = GameLogic.processAction(G, 1, {
            type: 'copiedAttack',
            sourceName: testCase.pokemon,
            attackIndex: testCase.attackIdx
          });
          
          // EXPECTED BEHAVIOR (Requirement 3.3):
          // 1. The attack SHOULD succeed because Mew has enough energy (no Quick Claw reduction)
          // 2. No Quick Claw event should be generated
          
          const quickClawEventGenerated = G.events.some(e => 
            e.type === 'item_proc' && e.item === 'Quick Claw'
          );
          
          // ASSERTION: Attack should succeed without Quick Claw
          if (!attackResult) {
            throw new Error(
              `PRESERVATION FAILURE: Mew without Quick Claw failed to use copied attack "${testCase.attackName}" ` +
              `from bench ally ${testCase.pokemon} (original cost: ${testCase.originalCost}, Mew energy: ${testCase.originalCost}). ` +
              `Without Quick Claw, the cost should be ${testCase.originalCost}, ` +
              `so the attack should succeed. (Requirement 3.3)`
            );
          }
          
          if (quickClawEventGenerated) {
            throw new Error(
              `PRESERVATION FAILURE: Quick Claw event generated when Mew doesn't have Quick Claw. ` +
              `No Quick Claw event should be generated.`
            );
          }
          
          // If we reach here, Mew's Versatility works correctly without Quick Claw
          return true;
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property 2d: Preservation - Quick Claw SHOULD be consumed after use
   * 
   * This property tests the PRESERVATION requirement (PR6):
   * - Requirement 3.6: When Quick Claw is consumed after use,
   *   the system SHALL CONTINUE TO discard it and prevent further cost reductions
   * 
   * This test should PASS on unfixed code and continue to pass after the fix.
   */
  test('Property 2d: Quick Claw SHOULD be consumed after use and prevent further reductions', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Test Pokemon with multiple attacks
          { 
            pokemon: 'Charizard', 
            attack1: { idx: 0, name: 'Claw Slash', cost: 2 },
            attack2: { idx: 1, name: 'Inferno Burst', cost: 4 }
          }
        ),
        (testCase) => {
          // Setup: Create a game with Pokemon with Quick Claw
          const G = GameLogic.createGame();
          G.phase = 'battle';
          G.currentPlayer = 1;
          G.turn = 1;
          
          const player = G.players[1];
          const opponent = G.players[2];
          
          // Setup Pokemon with Quick Claw as active
          player.active = GameLogic.makePokemon(testCase.pokemon, 'Quick Claw');
          opponent.active = GameLogic.makePokemon('Cleffa', null);
          
          // Give Pokemon enough energy for first attack with Quick Claw (cost - 2)
          // But NOT enough for second attack without Quick Claw
          player.active.energy = testCase.attack1.cost; // Enough for first attack with Quick Claw (2 - 2 = 0)
          player.mana = 5;
          
          // Verify Quick Claw is active
          if (!player.active.quickClawActive) {
            throw new Error('Test setup error: Quick Claw should be active');
          }
          
          // ACTION 1: Use the first attack (should consume Quick Claw)
          const attack1Result = GameLogic.processAction(G, 1, {
            type: 'attack',
            attackIndex: testCase.attack1.idx
          });
          
          if (!attack1Result) {
            throw new Error('Test setup error: First attack should succeed with Quick Claw');
          }
          
          // EXPECTED BEHAVIOR (Requirement 3.6):
          // 1. Quick Claw should be consumed (quickClawActive = false, heldItem = null)
          
          const quickClawConsumed = !player.active.quickClawActive && player.active.heldItem === null;
          
          if (!quickClawConsumed) {
            throw new Error(
              `PRESERVATION FAILURE: Quick Claw was not consumed after first attack. ` +
              `quickClawActive: ${player.active.quickClawActive}, heldItem: ${player.active.heldItem}. ` +
              `Quick Claw should be discarded after use. (Requirement 3.6)`
            );
          }
          
          // End turn to reset for second attack test
          GameLogic.processAction(G, 1, { type: 'endTurn' });
          GameLogic.processAction(G, 2, { type: 'endTurn' });
          
          // Give Pokemon energy for second attack WITHOUT Quick Claw reduction
          // (cost - 1) is NOT enough without Quick Claw
          player.active.energy = testCase.attack2.cost - 1;
          
          // ACTION 2: Try to use second attack (should fail because Quick Claw is consumed)
          const attack2Result = GameLogic.processAction(G, 1, {
            type: 'attack',
            attackIndex: testCase.attack2.idx
          });
          
          // EXPECTED BEHAVIOR (Requirement 3.6):
          // 2. The second attack should FAIL because Quick Claw is no longer active
          
          if (attack2Result) {
            throw new Error(
              `PRESERVATION FAILURE: Second attack succeeded after Quick Claw was consumed. ` +
              `With ${testCase.attack2.cost - 1} energy and no Quick Claw, ` +
              `the attack (cost ${testCase.attack2.cost}) should fail. (Requirement 3.6)`
            );
          }
          
          // If we reach here, Quick Claw consumption behavior is correct
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 2e: Preservation - Other held items (Thick Aroma) SHOULD work correctly
   * 
   * This property tests the PRESERVATION requirement (PR7):
   * - Requirement 3.7: When other held items interact with attack costs (e.g., Thick Aroma),
   *   the system SHALL CONTINUE TO apply their effects correctly
   * 
   * This test should PASS on unfixed code and continue to pass after the fix.
   */
  test('Property 2e: Other held items (Thick Aroma) SHOULD work correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Test various Pokemon with attacks
          { pokemon: 'Charizard', attackIdx: 0, attackName: 'Claw Slash', originalCost: 2 }
        ),
        (testCase) => {
          // Setup: Create a game with opponent having Thick Aroma
          const G = GameLogic.createGame();
          G.phase = 'battle';
          G.currentPlayer = 1;
          G.turn = 1;
          
          const player = G.players[1];
          const opponent = G.players[2];
          
          // Setup attacker without Quick Claw
          player.active = GameLogic.makePokemon(testCase.pokemon, null);
          
          // Setup opponent with Thick Aroma (increases attack cost by 1)
          opponent.active = GameLogic.makePokemon('Slaking', null);
          
          // Give attacker exactly (originalCost + 1) energy
          // This is the cost WITH Thick Aroma effect
          player.active.energy = testCase.originalCost + 1;
          player.mana = 5;
          
          // Clear events
          G.events = [];
          
          // ACTION: Use the attack
          const attackResult = GameLogic.processAction(G, 1, {
            type: 'attack',
            attackIndex: testCase.attackIdx
          });
          
          // EXPECTED BEHAVIOR (Requirement 3.7):
          // 1. The attack SHOULD succeed because attacker has enough energy for increased cost
          
          // ASSERTION: Attack should succeed with Thick Aroma
          if (!attackResult) {
            throw new Error(
              `PRESERVATION FAILURE: ${testCase.pokemon} failed to use attack "${testCase.attackName}" ` +
              `against opponent with Thick Aroma (original cost: ${testCase.originalCost}, energy: ${testCase.originalCost + 1}). ` +
              `With Thick Aroma, the cost should be ${testCase.originalCost + 1}, ` +
              `so the attack should succeed. (Requirement 3.7)`
            );
          }
          
          // If we reach here, Thick Aroma works correctly
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 2 (Combined): Preservation - All Quick Claw preservation requirements together
   * 
   * This property tests all preservation requirements together:
   * - PR3: Copying works without Quick Claw (Requirement 3.3)
   * - PR4: Quick Claw works for normal attacks (Requirement 3.4)
   * - PR6: Quick Claw consumption behavior (Requirement 3.6)
   * - PR7: Other held items work correctly (Requirement 3.7)
   */
  test('Property 2: Preservation - Quick Claw with normal attacks, copying without Quick Claw, and other behaviors', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Quick Claw with normal attacks
          { 
            scenario: 'quickClawNormal',
            pokemon: 'Charizard',
            attackIdx: 0,
            attackName: 'Claw Slash',
            originalCost: 2,
            heldItem: 'Quick Claw',
            energyNeeded: 0,
            requirement: '3.4',
            verifyFn: (G, player, opponent, attackResult) => {
              const quickClawConsumed = !player.active.quickClawActive && player.active.heldItem === null;
              const quickClawEventGenerated = G.events.some(e => 
                e.type === 'item_proc' && e.item === 'Quick Claw' && e.effect === 'costReduction'
              );
              
              if (!attackResult) {
                throw new Error(
                  `PRESERVATION FAILURE: Quick Claw did not reduce normal attack cost. (Requirement 3.4)`
                );
              }
              
              if (!quickClawConsumed) {
                throw new Error(
                  `PRESERVATION FAILURE: Quick Claw was not consumed. (Requirement 3.6)`
                );
              }
              
              if (!quickClawEventGenerated) {
                throw new Error(
                  `PRESERVATION FAILURE: No Quick Claw event generated.`
                );
              }
            }
          },
          // Ditto without Quick Claw
          { 
            scenario: 'dittoNoQuickClaw',
            pokemon: 'Ditto',
            copierSetup: true,
            targetPokemon: 'Charizard',
            attackIdx: 0,
            attackName: 'Claw Slash',
            originalCost: 2,
            heldItem: null,
            energyNeeded: 3, // 1 for Improvise + 2 for attack
            requirement: '3.3',
            verifyFn: (G, player, opponent, attackResult) => {
              const quickClawEventGenerated = G.events.some(e => 
                e.type === 'item_proc' && e.item === 'Quick Claw'
              );
              
              if (!attackResult) {
                throw new Error(
                  `PRESERVATION FAILURE: Ditto without Quick Claw failed to use copied attack. (Requirement 3.3)`
                );
              }
              
              if (quickClawEventGenerated) {
                throw new Error(
                  `PRESERVATION FAILURE: Quick Claw event generated when Ditto doesn't have Quick Claw.`
                );
              }
            }
          },
          // Mew without Quick Claw
          { 
            scenario: 'mewNoQuickClaw',
            pokemon: 'Mew',
            copierSetup: true,
            targetPokemon: 'Charizard',
            attackIdx: 0,
            attackName: 'Claw Slash',
            originalCost: 2,
            heldItem: null,
            energyNeeded: 2, // Just the attack cost
            requirement: '3.3',
            verifyFn: (G, player, opponent, attackResult) => {
              const quickClawEventGenerated = G.events.some(e => 
                e.type === 'item_proc' && e.item === 'Quick Claw'
              );
              
              if (!attackResult) {
                throw new Error(
                  `PRESERVATION FAILURE: Mew without Quick Claw failed to use copied attack. (Requirement 3.3)`
                );
              }
              
              if (quickClawEventGenerated) {
                throw new Error(
                  `PRESERVATION FAILURE: Quick Claw event generated when Mew doesn't have Quick Claw.`
                );
              }
            }
          }
        ),
        (testCase) => {
          // Setup: Create a game
          const G = GameLogic.createGame();
          G.phase = 'battle';
          G.currentPlayer = 1;
          G.turn = 1;
          
          const player = G.players[1];
          const opponent = G.players[2];
          
          // Setup Pokemon with or without Quick Claw
          player.active = GameLogic.makePokemon(testCase.pokemon, testCase.heldItem);
          
          if (testCase.copierSetup) {
            // For Ditto/Mew, setup opponent or bench ally
            if (testCase.pokemon === 'Ditto') {
              opponent.active = GameLogic.makePokemon(testCase.targetPokemon, null);
            } else if (testCase.pokemon === 'Mew') {
              opponent.active = GameLogic.makePokemon('Cleffa', null);
              player.bench[0] = GameLogic.makePokemon(testCase.targetPokemon, null);
            }
          } else {
            opponent.active = GameLogic.makePokemon('Cleffa', null);
          }
          
          player.active.energy = testCase.energyNeeded;
          player.mana = 5;
          
          // For Ditto, activate Improvised Attack first
          if (testCase.pokemon === 'Ditto' && testCase.copierSetup) {
            const improviseResult = GameLogic.processAction(G, 1, {
              type: 'useAbility',
              key: 'improvise',
              sourceBenchIdx: -1
            });
            
            if (!improviseResult || !player.active.improviseActive) {
              throw new Error('Test setup error: Improvised Attack failed');
            }
          }
          
          // Clear events
          G.events = [];
          
          // ACTION: Use the attack
          let attackResult;
          if (testCase.copierSetup) {
            attackResult = GameLogic.processAction(G, 1, {
              type: 'copiedAttack',
              sourceName: testCase.targetPokemon,
              attackIndex: testCase.attackIdx
            });
          } else {
            attackResult = GameLogic.processAction(G, 1, {
              type: 'attack',
              attackIndex: testCase.attackIdx
            });
          }
          
          // Run test-specific verification
          testCase.verifyFn(G, player, opponent, attackResult);
          
          return true;
        }
      ),
      { numRuns: 30 } // Run 30 test cases across all scenarios
    );
  });
});
