// ============================================================
// POKEMON TCG - Shared Constants
// ============================================================
// Type colors, type chart, and small helpers used everywhere.
// Works in both browser (global) and Node.js (module.exports).
// ============================================================
(function(exports) {
'use strict';

var TYPE_COLORS = {
  Normal:'#A8A77A', Fire:'#EE8130', Water:'#6390F0', Grass:'#7AC74C',
  Electric:'#F7D02C', Ground:'#E2BF65', Ice:'#96D9D6', Fighting:'#C22E28',
  Poison:'#A33EA1', Flying:'#A98FF3', Psychic:'#F95587', Bug:'#A6B91A',
  Rock:'#B6A136', Ghost:'#735797', Dragon:'#6F35FC', Dark:'#705746',
  Steel:'#B7B7CE', Fairy:'#D685AD'
};

var TYPE_PARTICLE_COLORS = {
  Normal:'#A8A77A', Fire:'#EE8130', Water:'#6390F0', Grass:'#7AC74C',
  Electric:'#F7D02C', Ground:'#E2BF65', Ice:'#96D9D6', Fighting:'#C22E28',
  Poison:'#A33EA1', Flying:'#A98FF3', Psychic:'#F95587', Bug:'#A6B91A',
  Rock:'#B6A136', Ghost:'#735797', Dragon:'#6F35FC', Dark:'#705746',
  Steel:'#B7B7CE', Fairy:'#D685AD'
};

// Official simplified TCG type chart
var TYPE_CHART = {
  Normal:   { weakTo:['Fighting'],       resists:['Ghost'] },
  Fire:     { weakTo:['Water','Ground'], resists:['Fire','Grass','Ice','Bug','Steel','Fairy'] },
  Water:    { weakTo:['Electric','Grass'], resists:['Fire','Water','Ice','Steel'] },
  Grass:    { weakTo:['Fire','Ice','Poison','Flying','Bug'], resists:['Water','Electric','Grass','Ground'] },
  Electric: { weakTo:['Ground'],         resists:['Electric','Flying','Steel'] },
  Ground:   { weakTo:['Water','Grass','Ice'], resists:['Poison','Rock','Electric'] },
  Ice:      { weakTo:['Fire','Fighting','Rock','Steel'], resists:['Ice'] },
  Fighting: { weakTo:['Flying','Psychic','Fairy'], resists:['Bug','Rock','Dark'] },
  Poison:   { weakTo:['Ground','Psychic'], resists:['Fighting','Poison','Bug','Grass','Fairy'] },
  Flying:   { weakTo:['Electric','Ice','Rock'], resists:['Fighting','Bug','Grass','Ground'] },
  Psychic:  { weakTo:['Bug','Ghost','Dark'], resists:['Fighting','Psychic'] },
  Bug:      { weakTo:['Fire','Flying','Rock'], resists:['Fighting','Grass','Ground'] },
  Rock:     { weakTo:['Water','Grass','Fighting','Ground','Steel'], resists:['Normal','Fire','Poison','Flying'] },
  Ghost:    { weakTo:['Ghost','Dark'],   resists:['Poison','Bug','Normal','Fighting'] },
  Dragon:   { weakTo:['Ice','Dragon','Fairy'], resists:['Fire','Water','Electric','Grass'] },
  Dark:     { weakTo:['Fighting','Bug','Fairy'], resists:['Ghost','Dark','Psychic'] },
  Steel:    { weakTo:['Fire','Fighting','Ground'], resists:['Normal','Grass','Ice','Flying','Psychic','Bug','Rock','Dragon','Steel','Fairy','Poison'] },
  Fairy:    { weakTo:['Poison','Steel'], resists:['Fighting','Bug','Dark','Dragon'] }
};

// Max bench size, max energy, KOs to win
var MAX_BENCH = 4;
var MAX_ENERGY = 5;
var KOS_TO_WIN = 6;
var MAX_MANA = 10;
var MANA_PER_TURN = 2;
var STARTING_MANA = 7;

// ============================================================
// HELPERS
// ============================================================
function opp(p) { return p === 1 ? 2 : 1; }

// Clone a plain object (shallow is fine for attack/item defs)
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

// ============================================================
// EXPORTS
// ============================================================
exports.TYPE_COLORS = TYPE_COLORS;
exports.TYPE_PARTICLE_COLORS = TYPE_PARTICLE_COLORS;
exports.TYPE_CHART = TYPE_CHART;
exports.MAX_BENCH = MAX_BENCH;
exports.MAX_ENERGY = MAX_ENERGY;
exports.KOS_TO_WIN = KOS_TO_WIN;
exports.MAX_MANA = MAX_MANA;
exports.MANA_PER_TURN = MANA_PER_TURN;
exports.STARTING_MANA = STARTING_MANA;
exports.opp = opp;
exports.clone = clone;

})(typeof module !== 'undefined' && module.exports ? module.exports : (this.Constants = {}));
