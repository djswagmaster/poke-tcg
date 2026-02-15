// ============================================================
// POKEMON TCG - Server Game Engine (Thin Wrapper)
// ============================================================
// This file is now a thin wrapper around the shared modules.
// All game logic lives in shared/*.js files.
// This module re-exports everything the server needs.
// ============================================================
(function(exports) {
'use strict';

// Load shared modules
var Constants = require('../shared/constants');
var PokemonDB = require('../shared/pokemon-db');
var ItemDB = require('../shared/item-db');
var DamagePipeline = require('../shared/damage-pipeline');
var FXHandlers = require('../shared/fx-handlers');
var GameLogic = require('../shared/game-logic');

// ============================================================
// RE-EXPORTS (same API that server.js expects)
// ============================================================
exports.createGame = GameLogic.createGame;
exports.processAction = GameLogic.processAction;
exports.processDeckConfirm = GameLogic.processDeckConfirm;
exports.processSetupChoice = GameLogic.processSetupChoice;
exports.filterStateForPlayer = GameLogic.filterStateForPlayer;
exports.getCopiedAttacks = GameLogic.getCopiedAttacks;
exports.makePokemon = GameLogic.makePokemon;
exports.oppPlayer = GameLogic.opp;

// Data access (for server.js Pokemon data loading)
exports.POKEMON_DB = PokemonDB.POKEMON_DB;
exports.ITEM_DB = ItemDB.ITEM_DB;
exports.getPokemonData = PokemonDB.getPokemonData;
exports.getItemData = ItemDB.getItemData;

/**
 * Merge external stat data from pokemon-data.js.
 * Called by server.js at startup after loading the data file.
 */
exports.mergeExternalData = function(externalData) {
  PokemonDB.mergeStatOverrides(externalData);
};

})(typeof module !== 'undefined' && module.exports ? module.exports : (this.GameEngine = {}));
