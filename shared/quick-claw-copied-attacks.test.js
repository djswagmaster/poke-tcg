// ============================================================
// Bug Condition Exploration Test: Quick Claw with Copied Attacks
// ============================================================
// **Validates: Requirements 1.3, 1.4, 2.3, 2.4**
//
// CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
// DO NOT attempt to fix the test or the code when it fails
//
// This test encodes the expected behavior - it will validate the fix when it passes
// after implementation.
//
// GOAL: Surface counterexamples that demonstrate Quick Claw doesn't reduce copied attack costs
// ============================================================

const fc = require('fast-check');
const GameLogic = require('./game-logic');
const PokemonDB = require('./pokemon-db');

describe('Bug Condition Exploration: Quick Claw Not Reducing Copied Attack Costs', () => {
  /**
   * Property 1a: Fault Condition - Quick Claw Not Reducing Ditto's Improvised Attack Costs
   * 
   * This property tests the FAULT CONDITION described in the bugfix requirements:
   * - Requirement 1.3: When Ditto has Quick Claw equipped and uses "Improvised Attack" 
   *   to copy an opponent's attack, the system does not reduce the copied attack's energy cost by 2
   * 
   * Expected behavior (Requirement 2.3):
   * - When Ditto has Quick Claw equipped and uses "Improvised Attack" to copy an opponent's attack,
   *   the system SHALL reduce the copied attack's energy cost by 2 (minimum 0)
   * 
   * This test will FAIL on unfixed code because Quick Claw is not applied to copied attacks.
   * 
   * Test strategy: Give Ditto exactly enough energy to use the attack WITH Quick Claw reduction,
   * but NOT enough without it. If Quick Claw works, the attack succeeds. If not, it fails.
   */
  test('Property 1a: Ditto with Quick Claw should reduce copied attack energy cost by 2', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Test various opponent Pokemon with attacks that cost 2+ energy
          // We give Ditto (original cost - 2) energy, so it can only attack if Quick Claw works
          { pokemon: 'Charizard', attackIdx: 0, attackName: 'Claw Slash', originalCost: 2, dittoEnergy: 0 },
          { pokemon: 'Charizard', attackIdx: 1, attackName: 'Inferno Burst', originalCost: 4, dittoEnergy: 2 },
          { pokemon: 'Chansey', attackIdx: 0, attackName: 'Double Edge', originalCost: 4, dittoEnergy: 2 }
        ),
        (testCase) => {
          // Setup: Create a game with Ditto (with Quick Claw) vs opponent
          const G = GameLogic.createGame();
          G.phase = 'battle';
          G.currentPlayer = 1;
          G.turn = 1;
          
          const player = G.players[1];
          const opponent = G.players[2];
          
          // Setup Ditto with Quick Claw as active
          player.active = GameLogic.makePokemon('Ditto', 'Quick Claw');
          opponent.active = GameLogic.makePokemon(testCase.pokemon, null);
          
          // Give Ditto enough energy to activate Improvised Attack (costs 1)
          // Plus exactly (originalCost - 2) energy for the attack
          // This means: with Quick Claw, attack should succeed; without it, should fail
          player.active.energy = 1 + testCase.dittoEnergy;
          player.mana = 5;
          
          // Verify Quick Claw is active
          if (!player.active.quickClawActive) {
            throw new Error('Test setup error: Quick Claw should be active on Ditto');
          }
          
          // ACTION 1: Activate Improvised Attack to copy opponent's attacks
          const improviseResult = GameLogic.processAction(G, 1, {
            type: 'useAbility',
            key: 'improvise',
            sourceBenchIdx: -1
          });
          
          if (!improviseResult || !player.active.improviseActive) {
            throw new Error('Test setup error: Improvised Attack failed to activate');
          }
          
          // After Improvised Attack, Ditto should have exactly dittoEnergy left
          if (player.active.energy !== testCase.dittoEnergy) {
            throw new Error(`Test setup error: Expected ${testCase.dittoEnergy} energy after Improvised Attack, got ${player.active.energy}`);
          }
          
          // Clear events
          G.events = [];
          
          // ACTION 2: Use the copied attack
          const attackResult = GameLogic.processAction(G, 1, {
            type: 'copiedAttack',
            sourceName: testCase.pokemon,
            attackIndex: testCase.attackIdx
          });
          
          // EXPECTED BEHAVIOR (from Requirements 2.3):
          // 1. The attack SHOULD succeed because Quick Claw reduces cost by 2
          // 2. Quick Claw should be consumed (quickClawActive = false, heldItem = null)
          // 3. An item_proc event should be generated for Quick Claw
          
          const quickClawConsumed = !player.active.quickClawActive && player.active.heldItem === null;
          const quickClawEventGenerated = G.events.some(e => 
            e.type === 'item_proc' && e.item === 'Quick Claw' && e.effect === 'costReduction'
          );
          
          // ASSERTION: Attack should succeed with Quick Claw
          // This will FAIL on unfixed code because Quick Claw doesn't reduce copied attack costs
          if (!attackResult) {
            throw new Error(
              `FAULT CONDITION DETECTED: Ditto with Quick Claw failed to use copied attack "${testCase.attackName}" ` +
              `(original cost: ${testCase.originalCost}, Ditto energy: ${testCase.dittoEnergy}). ` +
              `With Quick Claw, the cost should be ${Math.max(0, testCase.originalCost - 2)}, ` +
              `so the attack should succeed. ` +
              `Quick Claw is not reducing copied attack costs! (Requirement 1.3/2.3)`
            );
          }
          
          if (!quickClawConsumed) {
            throw new Error(
              `FAULT CONDITION DETECTED: Quick Claw was not consumed after Ditto used copied attack. ` +
              `quickClawActive: ${player.active.quickClawActive}, heldItem: ${player.active.heldItem}. ` +
              `Quick Claw should be discarded after use.`
            );
          }
          
          if (!quickClawEventGenerated) {
            throw new Error(
              `FAULT CONDITION DETECTED: No item_proc event generated for Quick Claw when Ditto used copied attack. ` +
              `Quick Claw activation should generate an event.`
            );
          }
          
          // If we reach here, Quick Claw correctly reduced the copied attack cost
          return true;
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property 1b: Fault Condition - Quick Claw Not Reducing Mew's Versatility Attack Costs
   * 
   * This property tests the FAULT CONDITION described in the bugfix requirements:
   * - Requirement 1.4: When Mew has Quick Claw equipped and uses "Versatility" 
   *   to copy a bench ally's attack, the system may not reduce the copied attack's energy cost by 2
   * 
   * Expected behavior (Requirement 2.4):
   * - When Mew has Quick Claw equipped and uses "Versatility" to copy a bench ally's attack,
   *   the system SHALL reduce the copied attack's energy cost by 2 (minimum 0)
   * 
   * This test will FAIL on unfixed code because Quick Claw is not applied to copied attacks.
   * 
   * Test strategy: Give Mew exactly enough energy to use the attack WITH Quick Claw reduction,
   * but NOT enough without it. If Quick Claw works, the attack succeeds. If not, it fails.
   */
  test('Property 1b: Mew with Quick Claw should reduce copied attack energy cost by 2', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Test various bench ally Pokemon with attacks that cost 2+ energy
          { pokemon: 'Charizard', attackIdx: 0, attackName: 'Claw Slash', originalCost: 2, mewEnergy: 0 },
          { pokemon: 'Charizard', attackIdx: 1, attackName: 'Inferno Burst', originalCost: 4, mewEnergy: 2 },
          { pokemon: 'Chansey', attackIdx: 0, attackName: 'Double Edge', originalCost: 4, mewEnergy: 2 }
        ),
        fc.integer({ min: 0, max: 4 }), // Bench position
        (testCase, benchIdx) => {
          // Setup: Create a game with Mew (with Quick Claw) and bench ally
          const G = GameLogic.createGame();
          G.phase = 'battle';
          G.currentPlayer = 1;
          G.turn = 1;
          
          const player = G.players[1];
          const opponent = G.players[2];
          
          // Setup Mew with Quick Claw as active
          player.active = GameLogic.makePokemon('Mew', 'Quick Claw');
          opponent.active = GameLogic.makePokemon('Cleffa', null);
          
          // Place bench ally with the attack to copy
          player.bench[benchIdx] = GameLogic.makePokemon(testCase.pokemon, null);
          
          // Give Mew exactly (originalCost - 2) energy
          // This means: with Quick Claw, attack should succeed; without it, should fail
          player.active.energy = testCase.mewEnergy;
          player.mana = 5;
          
          // Verify Quick Claw is active
          if (!player.active.quickClawActive) {
            throw new Error('Test setup error: Quick Claw should be active on Mew');
          }
          
          // Clear events
          G.events = [];
          
          // ACTION: Use the copied attack via Versatility
          const attackResult = GameLogic.processAction(G, 1, {
            type: 'copiedAttack',
            sourceName: testCase.pokemon,
            attackIndex: testCase.attackIdx
          });
          
          // EXPECTED BEHAVIOR (from Requirements 2.4):
          // 1. The attack SHOULD succeed because Quick Claw reduces cost by 2
          // 2. Quick Claw should be consumed (quickClawActive = false, heldItem = null)
          // 3. An item_proc event should be generated for Quick Claw
          
          const quickClawConsumed = !player.active.quickClawActive && player.active.heldItem === null;
          const quickClawEventGenerated = G.events.some(e => 
            e.type === 'item_proc' && e.item === 'Quick Claw' && e.effect === 'costReduction'
          );
          
          // ASSERTION: Attack should succeed with Quick Claw
          // This will FAIL on unfixed code because Quick Claw doesn't reduce copied attack costs
          if (!attackResult) {
            throw new Error(
              `FAULT CONDITION DETECTED: Mew with Quick Claw failed to use copied attack "${testCase.attackName}" ` +
              `from bench ally ${testCase.pokemon} (original cost: ${testCase.originalCost}, Mew energy: ${testCase.mewEnergy}). ` +
              `With Quick Claw, the cost should be ${Math.max(0, testCase.originalCost - 2)}, ` +
              `so the attack should succeed. ` +
              `Quick Claw is not reducing copied attack costs! (Requirement 1.4/2.4)`
            );
          }
          
          if (!quickClawConsumed) {
            throw new Error(
              `FAULT CONDITION DETECTED: Quick Claw was not consumed after Mew used copied attack. ` +
              `quickClawActive: ${player.active.quickClawActive}, heldItem: ${player.active.heldItem}. ` +
              `Quick Claw should be discarded after use.`
            );
          }
          
          if (!quickClawEventGenerated) {
            throw new Error(
              `FAULT CONDITION DETECTED: No item_proc event generated for Quick Claw when Mew used copied attack. ` +
              `Quick Claw activation should generate an event.`
            );
          }
          
          // If we reach here, Quick Claw correctly reduced the copied attack cost
          return true;
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property 1 (Combined): Fault Condition - Quick Claw Not Reducing Copied Attack Costs
   * 
   * This property tests both Ditto and Mew together with random selection.
   * 
   * Test strategy: Give the copier exactly enough energy to use the attack WITH Quick Claw reduction,
   * but NOT enough without it. If Quick Claw works, the attack succeeds. If not, it fails.
   */
  test('Property 1: Quick Claw should reduce copied attack energy costs by 2 for Ditto and Mew', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Ditto test cases
          { 
            copier: 'Ditto', 
            setupFn: (G, player, opponent, targetPokemon, benchIdx, energyAmount) => {
              // Activate Improvised Attack (costs 1 energy)
              player.active.energy = 1 + energyAmount; // 1 for Improvise + energyAmount for attack
              const improviseResult = GameLogic.processAction(G, 1, {
                type: 'useAbility',
                key: 'improvise',
                sourceBenchIdx: -1
              });
              if (!improviseResult || !player.active.improviseActive) {
                throw new Error('Test setup error: Improvised Attack failed');
              }
              // After Improvise, should have exactly energyAmount left
              if (player.active.energy !== energyAmount) {
                throw new Error(`Test setup error: Expected ${energyAmount} energy after Improvise, got ${player.active.energy}`);
              }
            }
          },
          // Mew test cases
          { 
            copier: 'Mew',
            setupFn: (G, player, opponent, targetPokemon, benchIdx, energyAmount) => {
              // Place bench ally for Versatility
              player.bench[benchIdx] = GameLogic.makePokemon(targetPokemon, null);
              player.active.energy = energyAmount;
            }
          }
        ),
        fc.constantFrom(
          { pokemon: 'Charizard', attackIdx: 0, attackName: 'Claw Slash', originalCost: 2, energyNeeded: 0 },
          { pokemon: 'Charizard', attackIdx: 1, attackName: 'Inferno Burst', originalCost: 4, energyNeeded: 2 },
          { pokemon: 'Chansey', attackIdx: 0, attackName: 'Double Edge', originalCost: 4, energyNeeded: 2 }
        ),
        fc.integer({ min: 0, max: 4 }), // Bench position (for Mew)
        (copierCase, attackCase, benchIdx) => {
          // Setup: Create a game
          const G = GameLogic.createGame();
          G.phase = 'battle';
          G.currentPlayer = 1;
          G.turn = 1;
          
          const player = G.players[1];
          const opponent = G.players[2];
          
          // Setup copier Pokemon with Quick Claw as active
          player.active = GameLogic.makePokemon(copierCase.copier, 'Quick Claw');
          opponent.active = GameLogic.makePokemon(attackCase.pokemon, null);
          
          player.mana = 5;
          
          // Verify Quick Claw is active
          if (!player.active.quickClawActive) {
            throw new Error('Test setup error: Quick Claw should be active');
          }
          
          // Run copier-specific setup
          copierCase.setupFn(G, player, opponent, attackCase.pokemon, benchIdx, attackCase.energyNeeded);
          
          // Clear events
          G.events = [];
          
          // ACTION: Use the copied attack
          const attackResult = GameLogic.processAction(G, 1, {
            type: 'copiedAttack',
            sourceName: attackCase.pokemon,
            attackIndex: attackCase.attackIdx
          });
          
          // EXPECTED BEHAVIOR (from Requirements 2.3, 2.4):
          // 1. The attack SHOULD succeed because Quick Claw reduces cost by 2
          // 2. Quick Claw should be consumed
          // 3. An item_proc event should be generated
          
          const quickClawConsumed = !player.active.quickClawActive && player.active.heldItem === null;
          const quickClawEventGenerated = G.events.some(e => 
            e.type === 'item_proc' && e.item === 'Quick Claw' && e.effect === 'costReduction'
          );
          
          // ASSERTION: Attack should succeed with Quick Claw
          if (!attackResult) {
            throw new Error(
              `FAULT CONDITION DETECTED: ${copierCase.copier} with Quick Claw failed to use copied attack "${attackCase.attackName}" ` +
              `(original cost: ${attackCase.originalCost}, energy: ${attackCase.energyNeeded}). ` +
              `With Quick Claw, the cost should be ${Math.max(0, attackCase.originalCost - 2)}, ` +
              `so the attack should succeed. ` +
              `Quick Claw is not reducing copied attack costs! ` +
              `(Requirement ${copierCase.copier === 'Ditto' ? '1.3/2.3' : '1.4/2.4'})`
            );
          }
          
          if (!quickClawConsumed) {
            throw new Error(
              `FAULT CONDITION DETECTED: Quick Claw was not consumed after ${copierCase.copier} used copied attack.`
            );
          }
          
          if (!quickClawEventGenerated) {
            throw new Error(
              `FAULT CONDITION DETECTED: No item_proc event generated for Quick Claw when ${copierCase.copier} used copied attack.`
            );
          }
          
          return true;
        }
      ),
      { numRuns: 30 } // Run 30 test cases across both Pokemon and various attacks
    );
  });
});
