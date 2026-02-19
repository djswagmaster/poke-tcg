// ============================================================
// Bug Condition Exploration Test: Active-Only Abilities
// ============================================================
// **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
//
// CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
// DO NOT attempt to fix the test or the code when it fails
//
// This test encodes the expected behavior - it will validate the fix when it passes
// after implementation.
//
// GOAL: Surface counterexamples that demonstrate abilities work from bench when they shouldn't
// ============================================================

const fc = require('fast-check');
const GameLogic = require('./game-logic');
const PokemonDB = require('./pokemon-db');

describe('Bug Condition Exploration: Active-Only Abilities Usable from Bench', () => {
  /**
   * Property 1: Fault Condition - Active-Only Abilities Usable from Bench
   * 
   * This property tests the FAULT CONDITION described in the bugfix requirements:
   * - Requirement 1.1: Arceus on bench can activate "Creation" ability (BUG)
   * - Requirement 1.2: Kricketune on bench can activate "Befuddling Melody" ability (BUG)
   * 
   * Expected behavior (Requirements 2.1, 2.2):
   * - When Arceus is on the bench, the system SHALL prevent "Creation" from being activated
   * - When Kricketune is on the bench, the system SHALL prevent "Befuddling Melody" from being activated
   * 
   * This test will FAIL on unfixed code because the abilities are currently allowed from bench.
   */
  test('Property 1a: Arceus Creation ability should NOT be usable from bench', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }), // Bench position (0-4)
        (benchIdx) => {
          const testCase = { pokemon: 'Arceus', ability: 'creation', abilityName: 'Creation' };
          
          // Setup: Create a game with the Pokemon on the bench
          const G = GameLogic.createGame();
          G.phase = 'battle';
          G.currentPlayer = 1;
          G.turn = 1;
          
          const player = G.players[1];
          const opponent = G.players[2];
          
          // Give player enough mana to use abilities
          player.mana = 5;
          
          // Setup active Pokemon (not the one we're testing)
          player.active = GameLogic.makePokemon('Cleffa', null);
          opponent.active = GameLogic.makePokemon('Cleffa', null);
          
          // Place the test Pokemon on the bench
          player.bench[benchIdx] = GameLogic.makePokemon(testCase.pokemon, null);
          
          // Clear events array before the test action
          G.events = [];
          
          // ACTION: Attempt to use the ability from the bench
          const result = GameLogic.processAction(G, 1, {
            type: 'useAbility',
            key: testCase.ability,
            sourceBenchIdx: benchIdx
          });
          
          // EXPECTED BEHAVIOR (from Requirements 2.1, 2.2):
          // 1. The ability activation should be PREVENTED (result should be false)
          // 2. No ability_effect event should be generated
          // 3. Game state should remain unchanged (mana should not change)
          
          const abilityActivated = result === true;
          const abilityEventGenerated = G.events.some(e => e.type === 'ability_effect' && e.ability === testCase.ability);
          const manaChanged = player.mana !== 5;
          
          // ASSERTION: Ability should NOT be activated from bench
          // This will FAIL on unfixed code because the bug allows these abilities from bench
          if (abilityActivated) {
            throw new Error(
              `FAULT CONDITION DETECTED: ${testCase.pokemon}'s "${testCase.abilityName}" ability ` +
              `was activated from bench position ${benchIdx}. ` +
              `This ability should only work when the Pokemon is active. ` +
              `(Requirement 1.1/2.1)`
            );
          }
          
          if (abilityEventGenerated) {
            throw new Error(
              `FAULT CONDITION DETECTED: ${testCase.pokemon}'s "${testCase.abilityName}" ability ` +
              `generated an ability_effect event from bench position ${benchIdx}. ` +
              `No event should be generated when ability is blocked.`
            );
          }
          
          if (manaChanged) {
            throw new Error(
              `FAULT CONDITION DETECTED: ${testCase.pokemon}'s "${testCase.abilityName}" ability ` +
              `changed mana from bench position ${benchIdx}. ` +
              `Game state should remain unchanged when ability is blocked.`
            );
          }
          
          // If we reach here, the ability was correctly prevented
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property 1b: Kricketune Befuddling Melody ability should NOT be usable from bench', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }), // Bench position (0-4)
        (benchIdx) => {
          const testCase = { pokemon: 'Kricketune', ability: 'lullaby', abilityName: 'Befuddling Melody' };
          
          // Setup: Create a game with the Pokemon on the bench
          const G = GameLogic.createGame();
          G.phase = 'battle';
          G.currentPlayer = 1;
          G.turn = 1;
          
          const player = G.players[1];
          const opponent = G.players[2];
          
          // Give player enough mana to use abilities
          player.mana = 5;
          
          // Setup active Pokemon (not the one we're testing)
          player.active = GameLogic.makePokemon('Cleffa', null);
          opponent.active = GameLogic.makePokemon('Cleffa', null);
          
          // Place the test Pokemon on the bench
          player.bench[benchIdx] = GameLogic.makePokemon(testCase.pokemon, null);
          
          // Clear events array before the test action
          G.events = [];
          
          // ACTION: Attempt to use the ability from the bench
          const result = GameLogic.processAction(G, 1, {
            type: 'useAbility',
            key: testCase.ability,
            sourceBenchIdx: benchIdx
          });
          
          // EXPECTED BEHAVIOR (from Requirements 2.1, 2.2):
          // 1. The ability activation should be PREVENTED (result should be false)
          // 2. No ability_effect event should be generated
          // 3. Opponent should NOT be confused
          
          const abilityActivated = result === true;
          const abilityEventGenerated = G.events.some(e => e.type === 'ability_effect' && e.ability === testCase.ability);
          const opponentConfused = opponent.active.status.includes('confusion');
          
          // ASSERTION: Ability should NOT be activated from bench
          // This will FAIL on unfixed code because the bug allows these abilities from bench
          if (abilityActivated) {
            throw new Error(
              `FAULT CONDITION DETECTED: ${testCase.pokemon}'s "${testCase.abilityName}" ability ` +
              `was activated from bench position ${benchIdx}. ` +
              `This ability should only work when the Pokemon is active. ` +
              `(Requirement 1.2/2.2)`
            );
          }
          
          if (abilityEventGenerated) {
            throw new Error(
              `FAULT CONDITION DETECTED: ${testCase.pokemon}'s "${testCase.abilityName}" ability ` +
              `generated an ability_effect event from bench position ${benchIdx}. ` +
              `No event should be generated when ability is blocked.`
            );
          }
          
          if (opponentConfused) {
            throw new Error(
              `FAULT CONDITION DETECTED: ${testCase.pokemon}'s "${testCase.abilityName}" ability ` +
              `confused opponent from bench position ${benchIdx}. ` +
              `Game state should remain unchanged when ability is blocked.`
            );
          }
          
          // If we reach here, the ability was correctly prevented
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 1 (Combined): Fault Condition - Active-Only Abilities Usable from Bench
   * 
   * This property tests both Pokemon together with random selection.
   */
  test('Property 1: Active-only abilities (Creation, Befuddling Melody) should NOT be usable from bench', () => {
    fc.assert(
      fc.property(
        // Generator: Create test cases for both Arceus and Kricketune on bench
        fc.constantFrom(
          { pokemon: 'Arceus', ability: 'creation', abilityName: 'Creation' },
          { pokemon: 'Kricketune', ability: 'lullaby', abilityName: 'Befuddling Melody' }
        ),
        fc.integer({ min: 0, max: 4 }), // Bench position (0-4)
        (testCase, benchIdx) => {
          // Setup: Create a game with the Pokemon on the bench
          const G = GameLogic.createGame();
          G.phase = 'battle';
          G.currentPlayer = 1;
          G.turn = 1;
          
          const player = G.players[1];
          const opponent = G.players[2];
          
          // Give player enough mana to use abilities
          player.mana = 5;
          
          // Setup active Pokemon (not the one we're testing)
          player.active = GameLogic.makePokemon('Cleffa', null);
          opponent.active = GameLogic.makePokemon('Cleffa', null);
          
          // Place the test Pokemon on the bench
          player.bench[benchIdx] = GameLogic.makePokemon(testCase.pokemon, null);
          
          // Clear events array before the test action
          G.events = [];
          
          // ACTION: Attempt to use the ability from the bench
          const result = GameLogic.processAction(G, 1, {
            type: 'useAbility',
            key: testCase.ability,
            sourceBenchIdx: benchIdx
          });
          
          // EXPECTED BEHAVIOR (from Requirements 2.1, 2.2):
          // 1. The ability activation should be PREVENTED (result should be false)
          // 2. No ability_effect event should be generated
          // 3. Game state should remain unchanged (mana should not change)
          
          const abilityActivated = result === true;
          const abilityEventGenerated = G.events.some(e => e.type === 'ability_effect' && e.ability === testCase.ability);
          const manaChanged = player.mana !== 5;
          
          // ASSERTION: Ability should NOT be activated from bench
          // This will FAIL on unfixed code because the bug allows these abilities from bench
          if (abilityActivated) {
            throw new Error(
              `FAULT CONDITION DETECTED: ${testCase.pokemon}'s "${testCase.abilityName}" ability ` +
              `was activated from bench position ${benchIdx}. ` +
              `This ability should only work when the Pokemon is active. ` +
              `(Requirement ${testCase.pokemon === 'Arceus' ? '1.1/2.1' : '1.2/2.2'})`
            );
          }
          
          if (abilityEventGenerated) {
            throw new Error(
              `FAULT CONDITION DETECTED: ${testCase.pokemon}'s "${testCase.abilityName}" ability ` +
              `generated an ability_effect event from bench position ${benchIdx}. ` +
              `No event should be generated when ability is blocked.`
            );
          }
          
          if (manaChanged && testCase.pokemon === 'Arceus') {
            throw new Error(
              `FAULT CONDITION DETECTED: ${testCase.pokemon}'s "${testCase.abilityName}" ability ` +
              `changed mana from bench position ${benchIdx}. ` +
              `Game state should remain unchanged when ability is blocked.`
            );
          }
          
          // If we reach here, the ability was correctly prevented
          return true;
        }
      ),
      { numRuns: 20 } // Run 20 test cases (10 for each Pokemon across different bench positions)
    );
  });
  
  /**
   * Regression Prevention: Verify abilities work correctly when Pokemon IS active
   * 
   * This ensures that fixing the bug doesn't break the normal functionality.
   * (Requirements 3.1, 3.2)
   */
  test('Regression: Active-only abilities SHOULD work when Pokemon is active', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { pokemon: 'Arceus', ability: 'creation', abilityName: 'Creation', expectedMana: 6 },
          { pokemon: 'Kricketune', ability: 'lullaby', abilityName: 'Befuddling Melody', expectedMana: 5 }
        ),
        (testCase) => {
          // Setup: Create a game with the Pokemon as active
          const G = GameLogic.createGame();
          G.phase = 'battle';
          G.currentPlayer = 1;
          G.turn = 1;
          
          const player = G.players[1];
          const opponent = G.players[2];
          
          player.mana = 5;
          
          // Place the test Pokemon as ACTIVE
          player.active = GameLogic.makePokemon(testCase.pokemon, null);
          opponent.active = GameLogic.makePokemon('Cleffa', null);
          
          G.events = [];
          
          // ACTION: Use the ability from active position
          const result = GameLogic.processAction(G, 1, {
            type: 'useAbility',
            key: testCase.ability,
            sourceBenchIdx: -1
          });
          
          // EXPECTED: Ability SHOULD work when Pokemon is active
          const abilityActivated = result === true;
          const abilityEventGenerated = G.events.some(e => e.type === 'ability_effect' && e.ability === testCase.ability);
          
          if (!abilityActivated) {
            throw new Error(
              `REGRESSION: ${testCase.pokemon}'s "${testCase.abilityName}" ability ` +
              `failed to activate when Pokemon is active. This should work! ` +
              `(Requirement ${testCase.pokemon === 'Arceus' ? '3.1' : '3.2'})`
            );
          }
          
          if (!abilityEventGenerated) {
            throw new Error(
              `REGRESSION: ${testCase.pokemon}'s "${testCase.abilityName}" ability ` +
              `did not generate an ability_effect event when active. This should work!`
            );
          }
          
          // Verify specific effects
          if (testCase.pokemon === 'Arceus') {
            if (player.mana !== testCase.expectedMana) {
              throw new Error(
                `REGRESSION: Arceus's Creation ability did not change mana correctly. ` +
                `Expected ${testCase.expectedMana}, got ${player.mana}`
              );
            }
          } else if (testCase.pokemon === 'Kricketune') {
            const opponentConfused = opponent.active.status.includes('confusion');
            if (!opponentConfused) {
              throw new Error(
                `REGRESSION: Kricketune's Befuddling Melody did not confuse opponent. ` +
                `Opponent should be confused.`
              );
            }
          }
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});


// ============================================================
// Preservation Property Tests: Active-Only Abilities
// ============================================================
// **Validates: Requirements 3.1, 3.2, 3.5**
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

describe('Preservation Property Tests: Active-Only Abilities When Active and Bench-Usable Abilities', () => {
  /**
   * Property 2a: Preservation - Arceus Creation ability SHOULD work when active
   * 
   * This property tests the PRESERVATION requirement (PR1):
   * - Requirement 3.1: When Arceus is the active Pokemon, the system SHALL CONTINUE TO 
   *   allow the "Creation" ability to be activated
   * 
   * This test should PASS on unfixed code and continue to pass after the fix.
   */
  test('Property 2a: Arceus Creation ability SHOULD work when active', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }), // Initial mana (1-9, not 10 to avoid MAX_MANA cap)
        (initialMana) => {
          // Setup: Create a game with Arceus as active
          const G = GameLogic.createGame();
          G.phase = 'battle';
          G.currentPlayer = 1;
          G.turn = 1;
          
          const player = G.players[1];
          const opponent = G.players[2];
          
          player.mana = initialMana;
          
          // Place Arceus as ACTIVE
          player.active = GameLogic.makePokemon('Arceus', null);
          opponent.active = GameLogic.makePokemon('Cleffa', null);
          
          G.events = [];
          
          // ACTION: Use the Creation ability from active position
          const result = GameLogic.processAction(G, 1, {
            type: 'useAbility',
            key: 'creation',
            sourceBenchIdx: -1
          });
          
          // EXPECTED BEHAVIOR (Requirement 3.1):
          // 1. The ability SHOULD be activated (result should be true)
          // 2. An ability_effect event should be generated
          // 3. Mana should change: spend 1, gain 2 (net +1), capped at MAX_MANA (10)
          
          const abilityActivated = result === true;
          const abilityEventGenerated = G.events.some(e => e.type === 'ability_effect' && e.ability === 'creation');
          const expectedMana = Math.min(10, initialMana + 1); // Spend 1, gain 2 = net +1, capped at 10
          const manaCorrect = player.mana === expectedMana;
          
          // ASSERTION: Ability SHOULD work when Pokemon is active
          if (!abilityActivated) {
            throw new Error(
              `PRESERVATION FAILURE: Arceus's "Creation" ability failed to activate when active. ` +
              `This should work! (Requirement 3.1)`
            );
          }
          
          if (!abilityEventGenerated) {
            throw new Error(
              `PRESERVATION FAILURE: Arceus's "Creation" ability did not generate an ability_effect event. ` +
              `This should work!`
            );
          }
          
          if (!manaCorrect) {
            throw new Error(
              `PRESERVATION FAILURE: Arceus's "Creation" ability did not change mana correctly. ` +
              `Expected ${expectedMana}, got ${player.mana}. Initial was ${initialMana}.`
            );
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 2b: Preservation - Kricketune Befuddling Melody ability SHOULD work when active
   * 
   * This property tests the PRESERVATION requirement (PR2):
   * - Requirement 3.2: When Kricketune is the active Pokemon, the system SHALL CONTINUE TO 
   *   allow the "Befuddling Melody" ability to be activated
   * 
   * This test should PASS on unfixed code and continue to pass after the fix.
   */
  test('Property 2b: Kricketune Befuddling Melody ability SHOULD work when active', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // Initial mana (1-10)
        (initialMana) => {
          // Setup: Create a game with Kricketune as active
          const G = GameLogic.createGame();
          G.phase = 'battle';
          G.currentPlayer = 1;
          G.turn = 1;
          
          const player = G.players[1];
          const opponent = G.players[2];
          
          player.mana = initialMana;
          
          // Place Kricketune as ACTIVE
          player.active = GameLogic.makePokemon('Kricketune', null);
          opponent.active = GameLogic.makePokemon('Cleffa', null);
          
          G.events = [];
          
          // ACTION: Use the Befuddling Melody ability from active position
          const result = GameLogic.processAction(G, 1, {
            type: 'useAbility',
            key: 'lullaby',
            sourceBenchIdx: -1
          });
          
          // EXPECTED BEHAVIOR (Requirement 3.2):
          // 1. The ability SHOULD be activated (result should be true)
          // 2. An ability_effect event should be generated
          // 3. Opponent should be confused
          
          const abilityActivated = result === true;
          const abilityEventGenerated = G.events.some(e => e.type === 'ability_effect' && e.ability === 'lullaby');
          const opponentConfused = opponent.active.status.includes('confusion');
          
          // ASSERTION: Ability SHOULD work when Pokemon is active
          if (!abilityActivated) {
            throw new Error(
              `PRESERVATION FAILURE: Kricketune's "Befuddling Melody" ability failed to activate when active. ` +
              `This should work! (Requirement 3.2)`
            );
          }
          
          if (!abilityEventGenerated) {
            throw new Error(
              `PRESERVATION FAILURE: Kricketune's "Befuddling Melody" ability did not generate an ability_effect event. ` +
              `This should work!`
            );
          }
          
          if (!opponentConfused) {
            throw new Error(
              `PRESERVATION FAILURE: Kricketune's "Befuddling Melody" ability did not confuse opponent. ` +
              `Opponent should be confused.`
            );
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 2c: Preservation - Bench-usable abilities SHOULD work from bench
   * 
   * This property tests the PRESERVATION requirement (PR5):
   * - Requirement 3.5: When abilities that are correctly marked as bench-usable 
   *   (e.g., Espeon's "Brilliant Shining", Mismagius's "Magic Drain") are used from the bench, 
   *   the system SHALL CONTINUE TO function normally
   * 
   * This test should PASS on unfixed code and continue to pass after the fix.
   */
  test('Property 2c: Bench-usable abilities (Espeon Brilliant Shining, Mismagius Magic Drain) SHOULD work from bench', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { 
            pokemon: 'Espeon', 
            ability: 'brilliantShining', 
            abilityName: 'Brilliant Shining',
            setupFn: (G, player, opponent) => {
              // Espeon gives both players +1 mana
              player.mana = 5;
              opponent.mana = 5;
              return { initialPlayerMana: 5, initialOpponentMana: 5 };
            },
            verifyFn: (G, player, opponent, setupData) => {
              // Verify both players gained mana
              const playerManaIncreased = player.mana > setupData.initialPlayerMana;
              const opponentManaIncreased = opponent.mana > setupData.initialOpponentMana;
              if (!playerManaIncreased || !opponentManaIncreased) {
                throw new Error(
                  `PRESERVATION FAILURE: Espeon's "Brilliant Shining" did not increase mana for both players. ` +
                  `Player: ${setupData.initialPlayerMana} -> ${player.mana}, Opponent: ${setupData.initialOpponentMana} -> ${opponent.mana}.`
                );
              }
            }
          },
          { 
            pokemon: 'Mismagius', 
            ability: 'magicDrain', 
            abilityName: 'Magic Drain',
            setupFn: (G, player, opponent) => {
              // Mismagius spends 1 mana to make opponent lose 1 mana
              player.mana = 5;
              opponent.mana = 5;
              return { initialPlayerMana: 5, initialOpponentMana: 5 };
            },
            verifyFn: (G, player, opponent, setupData) => {
              // Verify player spent 1 mana and opponent lost 1 mana
              const playerManaDecreased = player.mana < setupData.initialPlayerMana;
              const opponentManaDecreased = opponent.mana < setupData.initialOpponentMana;
              if (!playerManaDecreased || !opponentManaDecreased) {
                throw new Error(
                  `PRESERVATION FAILURE: Mismagius's "Magic Drain" did not work correctly. ` +
                  `Player: ${setupData.initialPlayerMana} -> ${player.mana}, Opponent: ${setupData.initialOpponentMana} -> ${opponent.mana}.`
                );
              }
            }
          }
        ),
        fc.integer({ min: 0, max: 4 }), // Bench position (0-4)
        (testCase, benchIdx) => {
          // Setup: Create a game with the Pokemon on the bench
          const G = GameLogic.createGame();
          G.phase = 'battle';
          G.currentPlayer = 1;
          G.turn = 1;
          
          const player = G.players[1];
          const opponent = G.players[2];
          
          // Setup active Pokemon (not the one we're testing)
          player.active = GameLogic.makePokemon('Cleffa', null);
          opponent.active = GameLogic.makePokemon('Cleffa', null);
          
          // Place the test Pokemon on the bench
          player.bench[benchIdx] = GameLogic.makePokemon(testCase.pokemon, null);
          
          // Run test-specific setup
          const setupData = testCase.setupFn(G, player, opponent);
          
          G.events = [];
          
          // ACTION: Use the ability from the bench
          const result = GameLogic.processAction(G, 1, {
            type: 'useAbility',
            key: testCase.ability,
            sourceBenchIdx: benchIdx
          });
          
          // EXPECTED BEHAVIOR (Requirement 3.5):
          // 1. The ability SHOULD be activated (result should be true)
          // 2. An ability_effect event should be generated
          // 3. The ability's effect should occur (verified by test-specific function)
          
          const abilityActivated = result === true;
          const abilityEventGenerated = G.events.some(e => e.type === 'ability_effect' && e.ability === testCase.ability);
          
          // ASSERTION: Ability SHOULD work from bench
          if (!abilityActivated) {
            throw new Error(
              `PRESERVATION FAILURE: ${testCase.pokemon}'s "${testCase.abilityName}" ability ` +
              `failed to activate from bench position ${benchIdx}. ` +
              `This bench-usable ability should work from bench! (Requirement 3.5)`
            );
          }
          
          if (!abilityEventGenerated) {
            throw new Error(
              `PRESERVATION FAILURE: ${testCase.pokemon}'s "${testCase.abilityName}" ability ` +
              `did not generate an ability_effect event from bench position ${benchIdx}. ` +
              `This should work!`
            );
          }
          
          // Run test-specific verification
          testCase.verifyFn(G, player, opponent, setupData);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 2 (Combined): Preservation - All preservation requirements together
   * 
   * This property tests all preservation requirements together:
   * - PR1: Arceus Creation works when active (Requirement 3.1)
   * - PR2: Kricketune Befuddling Melody works when active (Requirement 3.2)
   * - PR5: Bench-usable abilities work from bench (Requirement 3.5)
   */
  test('Property 2: Preservation - Active-only abilities work when active, bench-usable abilities work from bench', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Active-only abilities that should work when active
          { 
            pokemon: 'Arceus', 
            ability: 'creation', 
            abilityName: 'Creation',
            position: 'active',
            requirement: '3.1',
            setupFn: (G, player, opponent, initialMana) => {
              // Ensure mana is not at max so we can test the increase
              player.mana = Math.min(initialMana, 9);
              return { initialMana: player.mana };
            },
            verifyFn: (G, player, opponent, setupData) => {
              const expectedMana = Math.min(10, setupData.initialMana + 1);
              if (player.mana !== expectedMana) {
                throw new Error(
                  `PRESERVATION FAILURE: Arceus's "Creation" ability did not change mana correctly. ` +
                  `Expected ${expectedMana}, got ${player.mana}. Initial was ${setupData.initialMana}.`
                );
              }
            }
          },
          { 
            pokemon: 'Kricketune', 
            ability: 'lullaby', 
            abilityName: 'Befuddling Melody',
            position: 'active',
            requirement: '3.2',
            setupFn: (G, player, opponent, initialMana) => {
              return {};
            },
            verifyFn: (G, player, opponent, setupData) => {
              const opponentConfused = opponent.active.status.includes('confusion');
              if (!opponentConfused) {
                throw new Error(
                  `PRESERVATION FAILURE: Kricketune's "Befuddling Melody" ability did not confuse opponent.`
                );
              }
            }
          },
          // Bench-usable abilities that should work from bench
          { 
            pokemon: 'Espeon', 
            ability: 'brilliantShining', 
            abilityName: 'Brilliant Shining',
            position: 'bench',
            requirement: '3.5',
            setupFn: (G, player, opponent, initialMana) => {
              player.mana = 5;
              opponent.mana = 5;
              return { initialPlayerMana: 5, initialOpponentMana: 5 };
            },
            verifyFn: (G, player, opponent, setupData) => {
              const playerManaIncreased = player.mana > setupData.initialPlayerMana;
              const opponentManaIncreased = opponent.mana > setupData.initialOpponentMana;
              if (!playerManaIncreased || !opponentManaIncreased) {
                throw new Error(
                  `PRESERVATION FAILURE: Espeon's "Brilliant Shining" did not increase mana for both players.`
                );
              }
            }
          },
          { 
            pokemon: 'Mismagius', 
            ability: 'magicDrain', 
            abilityName: 'Magic Drain',
            position: 'bench',
            requirement: '3.5',
            setupFn: (G, player, opponent, initialMana) => {
              player.mana = 5;
              opponent.mana = 5;
              return { initialPlayerMana: 5, initialOpponentMana: 5 };
            },
            verifyFn: (G, player, opponent, setupData) => {
              const playerManaDecreased = player.mana < setupData.initialPlayerMana;
              const opponentManaDecreased = opponent.mana < setupData.initialOpponentMana;
              if (!playerManaDecreased || !opponentManaDecreased) {
                throw new Error(
                  `PRESERVATION FAILURE: Mismagius's "Magic Drain" did not work correctly.`
                );
              }
            }
          }
        ),
        fc.integer({ min: 0, max: 4 }), // Bench position (0-4) - only used for bench abilities
        fc.integer({ min: 1, max: 10 }), // Initial mana (1-10)
        (testCase, benchIdx, initialMana) => {
          // Setup: Create a game
          const G = GameLogic.createGame();
          G.phase = 'battle';
          G.currentPlayer = 1;
          G.turn = 1;
          
          const player = G.players[1];
          const opponent = G.players[2];
          
          player.mana = initialMana;
          
          // Setup Pokemon positions based on test case
          if (testCase.position === 'active') {
            // Place test Pokemon as active
            player.active = GameLogic.makePokemon(testCase.pokemon, null);
            opponent.active = GameLogic.makePokemon('Cleffa', null);
          } else {
            // Place test Pokemon on bench
            player.active = GameLogic.makePokemon('Cleffa', null);
            opponent.active = GameLogic.makePokemon('Cleffa', null);
            player.bench[benchIdx] = GameLogic.makePokemon(testCase.pokemon, null);
          }
          
          // Run test-specific setup
          const setupData = testCase.setupFn(G, player, opponent, initialMana);
          
          G.events = [];
          
          // ACTION: Use the ability
          const actionParams = {
            type: 'useAbility',
            key: testCase.ability,
            sourceBenchIdx: testCase.position === 'active' ? -1 : benchIdx
          };
          
          const result = GameLogic.processAction(G, 1, actionParams);
          
          // EXPECTED BEHAVIOR: Ability should work
          const abilityActivated = result === true;
          const abilityEventGenerated = G.events.some(e => e.type === 'ability_effect' && e.ability === testCase.ability);
          
          // ASSERTION: Ability SHOULD work
          if (!abilityActivated) {
            throw new Error(
              `PRESERVATION FAILURE: ${testCase.pokemon}'s "${testCase.abilityName}" ability ` +
              `failed to activate from ${testCase.position}. ` +
              `This should work! (Requirement ${testCase.requirement})`
            );
          }
          
          if (!abilityEventGenerated) {
            throw new Error(
              `PRESERVATION FAILURE: ${testCase.pokemon}'s "${testCase.abilityName}" ability ` +
              `did not generate an ability_effect event. This should work!`
            );
          }
          
          // Run test-specific verification
          testCase.verifyFn(G, player, opponent, setupData);
          
          return true;
        }
      ),
      { numRuns: 40 } // Run 40 test cases across all scenarios
    );
  });
});
