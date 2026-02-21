// ============================================================
// POKEMON TCG - Pokemon Database (Shared)
// ============================================================
// Single source of truth for all Pokemon definitions.
// Contains stats, attacks, and ability descriptors.
// Works in both browser (global) and Node.js (module.exports).
//
// NOTE: Stat overrides from pokemon-data.js are merged at load
//       time by the consumer (client or server).
// ============================================================
(function(exports) {
'use strict';

var POKEMON_DB = [
  {name:"Alolan Ninetales",types:["Ice","Fairy"],cost:4,hp:190,weakness:["Steel","Poison"],resistance:["Dragon","Ice"],
    ability:{name:"Aurora Veil",desc:"All your Pokemon take 10 less damage",type:"passive",key:"auroraVeil"},
    attacks:[{name:"Frost Over",energy:3,baseDmg:50,desc:"+10 per energy on defender",fx:"scaleDef:10"}]},

  {name:"Alolan Raichu",types:["Electric","Psychic"],cost:4,hp:150,weakness:["Ground","Dark"],resistance:["Steel","Fighting"],
    ability:{name:"Spark Surfer",desc:"Free retreat once per turn",type:"active",key:"sparkSurfer"},
    attacks:[{name:"Psychic",energy:3,baseDmg:20,desc:"+20 per energy on defender",fx:"scaleDef:20"}]},

  {name:"Arceus",types:["Normal"],cost:6,hp:300,weakness:[],resistance:["Ghost"],
    ability:{name:"Creation",desc:"Spend 1 mana -> gain 2 mana",type:"active",key:"creation",activeOnly:true},
    attacks:[{name:"Judgement",energy:3,baseDmg:120,desc:"",fx:""}]},

  {name:"Archeops",types:["Rock","Flying"],cost:5,hp:240,weakness:["Water","Electric"],resistance:["Fire","Grass"],
    ability:{name:"Defeatist",desc:"Can't attack if 120+ damage",type:"passive",key:"defeatist"},
    attacks:[{name:"Wild Flailing",energy:2,baseDmg:150,desc:"+20 to ALL benched",fx:"benchAll:20"}]},

  {name:"Arctozolt",types:["Electric","Ice"],cost:4,hp:230,weakness:["Ground","Fire"],resistance:["Steel","Ice"],
    ability:{name:"Biting Whirlpool",desc:"10 dmg when opp gains energy",type:"passive",key:"bitingWhirlpool"},
    attacks:[{name:"Electro Ball",energy:2,baseDmg:70,desc:"",fx:""}]},

  {name:"Baxcalibur",types:["Dragon","Ice"],cost:5,hp:260,weakness:["Dragon","Rock"],resistance:["Grass","Ice"],
    attacks:[{name:"Dragon Dance",energy:1,baseDmg:0,desc:"Gain +2 energy",fx:"selfEnergy:2"},
             {name:"Glaive Rush",energy:3,baseDmg:160,desc:"Take 60 more dmg next turn",fx:"selfVuln:60"}]},

  {name:"Beedrill",types:["Bug","Poison"],cost:3,hp:180,weakness:["Fire","Ground"],resistance:["Grass","Fairy"],
    attacks:[{name:"Swarm Snipe",energy:1,baseDmg:0,desc:"10 to target per your Pokemon",fx:"swarmSnipe"},
             {name:"Poison Pierce",energy:3,baseDmg:60,desc:"Poison",fx:"poison"}]},

  {name:"Chansey",types:["Normal"],cost:4,hp:320,weakness:[],resistance:["Ghost"],
    ability:{name:"Egg Drop Heal",desc:"Heal 10 from any (1/turn)",type:"active",key:"softTouch",targeted:true},
    attacks:[{name:"Double Edge",energy:4,baseDmg:80,desc:"40 to self",fx:"selfDmg:40"}]},

  {name:"Charizard",types:["Fire","Flying"],cost:4,hp:200,weakness:["Water","Ice"],resistance:["Fairy","Ground"],
    attacks:[{name:"Claw Slash",energy:2,baseDmg:90,desc:"",fx:""},
             {name:"Inferno Burst",energy:4,baseDmg:180,desc:"Lose 2 energy",fx:"selfEnergyLoss:2"}]},

  {name:"Clodsire",types:["Poison","Ground"],cost:3,hp:240,weakness:["Water","Grass"],resistance:["Grass","Electric"],
    attacks:[{name:"Sludge Slap",energy:2,baseDmg:20,desc:"Poison",fx:"poison"},
             {name:"Muddy Crash",energy:4,baseDmg:100,desc:"Lose 1 energy",fx:"selfEnergyLoss:1"}]},

  {name:"Delibird",types:["Ice","Flying"],cost:2,hp:120,weakness:["Fire"],resistance:["Ground"],
    attacks:[{name:"Gift Delivery",energy:2,baseDmg:0,desc:"Each bench +1 energy",fx:"benchEnergyAll"}]},

  {name:"Dialga",types:["Steel","Dragon"],cost:6,hp:280,weakness:["Fighting","Dragon"],resistance:["Ghost","Grass"],
    ability:{name:"Time Dilation",desc:"Whenever this Pokemon attacks, it loses 2 Energy",type:"passive",key:"timeDilation"},
    attacks:[{name:"Roar of Time",energy:4,baseDmg:100,desc:"Take another turn after this one. Can't attack during your next turn",fx:"extraTurn,lockAttack"}]},

  {name:"Ditto",types:["Normal"],cost:2,hp:130,weakness:[],resistance:["Ghost"],
    ability:{name:"Improvised Attack",desc:"Spend 1 energy: gain opp's attacks this turn",type:"active",key:"improvise",activeOnly:true},
    attacks:[{name:"Slap",energy:2,baseDmg:30,desc:"",fx:""}]},

  {name:"Drednaw",types:["Water","Rock"],cost:4,hp:200,weakness:["Electric","Water"],resistance:["Water","Flying"],
    ability:{name:"Tough Shell",desc:"Takes 30 less damage",type:"passive",key:"damageReduce:30"},
    attacks:[{name:"Hefty Crunch",energy:3,baseDmg:80,desc:"Lose 1 energy",fx:"selfEnergyLoss:1"}]},

  {name:"Eevee",types:["Normal"],cost:2,hp:150,weakness:[],resistance:["Ghost"],
    attacks:[{name:"Cheer Tackle",energy:1,baseDmg:20,desc:"+1 energy",fx:"selfEnergy:1"},
             {name:"Baton Pass",energy:3,baseDmg:0,desc:"Retreat + transfer energy",fx:"batonPass"}]},

  {name:"Entei",types:["Fire"],cost:5,hp:250,weakness:["Water"],resistance:["Fairy"],
    attacks:[{name:"Flame Charge",energy:1,baseDmg:40,desc:"+1 energy",fx:"selfEnergy:1"},
             {name:"Heated Eruption",energy:3,baseDmg:100,desc:"Burn",fx:"burn"}]},

  {name:"Flareon",types:["Fire"],cost:4,hp:200,weakness:["Water"],resistance:["Fairy"],
    attacks:[{name:"Fire Breath",energy:1,baseDmg:40,desc:"Burn",fx:"burn"},
             {name:"Flare Blitz",energy:3,baseDmg:150,desc:"50 to self",fx:"selfDmg:50"}]},

  {name:"Flygon",types:["Ground","Dragon"],cost:4,hp:200,weakness:["Dragon"],resistance:["Electric"],
    attacks:[{name:"Dragon Tail",energy:1,baseDmg:60,desc:"Opp switches Active",fx:"forceSwitch"},
             {name:"Super Dusty Flapping",energy:3,baseDmg:100,desc:"+10 to all benches",fx:"benchAll:10"}]},

  {name:"Galarian Weezing",types:["Poison","Fairy"],cost:4,hp:210,weakness:["Fire","Psychic"],resistance:["Grass","Water"],
    ability:{name:"Neutralizing Gas",desc:"Prevent all Active abilities",type:"passive",key:"neutralizingGas"},
    attacks:[{name:"Smog",energy:2,baseDmg:20,desc:"Poison",fx:"poison"}]},

  {name:"Gengar",types:["Ghost","Poison"],cost:4,hp:180,weakness:["Dark","Ground"],resistance:["Normal","Fairy"],
    attacks:[{name:"Cursed Look",energy:1,baseDmg:0,desc:"Strip 2 energy",fx:"stripEnergy:2"},
             {name:"Shadow Ball",energy:3,baseDmg:120,desc:"",fx:""}]},

  {name:"Giratina",types:["Ghost","Dragon"],cost:6,hp:300,weakness:["Ghost","Dragon"],resistance:["Normal","Grass"],
    ability:{name:"Dimension Door",desc:"This Pokemon can attack even while it is on your Bench",type:"passive",key:"dimensionDoor"},
    attacks:[{name:"Broken-Space Blow",energy:4,baseDmg:100,desc:"+10 per benched Pokemon",fx:"scaleBenchAll:10"}]},

  {name:"Glaceon",types:["Ice"],cost:4,hp:230,weakness:["Fire"],resistance:["Ice"],
    attacks:[{name:"Ice Shard",energy:1,baseDmg:40,desc:"Hit any Pokemon",fx:"snipe"},
             {name:"Crystal Wall",energy:3,baseDmg:80,desc:"30 less dmg next turn",fx:"selfShield:30"}]},

  {name:"Golisopod",types:["Bug","Water"],cost:4,hp:260,weakness:["Electric"],resistance:["Fighting"],
    attacks:[{name:"U-Turn",energy:1,baseDmg:50,desc:"Forced self-retreat",fx:"selfRetreat"},
             {name:"Aqua Lunge",energy:3,baseDmg:100,desc:"Can't use next turn",fx:"lockAttack"}]},

  {name:"Gothorita",types:["Psychic"],cost:3,hp:210,weakness:["Dark"],resistance:["Fighting"],
    attacks:[{name:"Mad Party",energy:2,baseDmg:0,desc:"10 per Pokemon in play",fx:"madParty"}]},

  {name:"Groudon",types:["Ground"],cost:6,hp:300,weakness:["Grass"],resistance:["Electric"],
    attacks:[{name:"Magma Wreck",energy:2,baseDmg:70,desc:"Strip 1 energy",fx:"stripEnergy:1"},
             {name:"Precipice Purge",energy:4,baseDmg:140,desc:"Or 210 (lose 2 energy)",fx:"optBoost:70:2"}]},

  {name:"Greninja",types:["Water","Dark"],cost:4,hp:180,weakness:["Electric","Fairy"],resistance:["Fire","Dark"],
    ability:{name:"Water Shuriken",desc:"Once during your turn, spend 1 mana: 50 damage to any Pokemon",type:"active",key:"waterShuriken",targeted:true},
    attacks:[{name:"Mist Slash",energy:1,baseDmg:50,desc:"Damage is unaffected by resistance",fx:"ignoreRes"}]},

  {name:"Guzzlord",types:["Dark","Dragon"],cost:5,hp:300,weakness:["Fairy","Dragon"],resistance:["Ghost","Grass"],
    attacks:[{name:"Tyrannical Hole",energy:4,baseDmg:140,desc:"",fx:""}]},

  {name:"Gyarados",types:["Water","Flying"],cost:4,hp:230,weakness:["Electric","Ice"],resistance:["Fire","Rock"],
    attacks:[{name:"Thrash",energy:2,baseDmg:80,desc:"",fx:""},
             {name:"Berserk Splash",energy:4,baseDmg:10,desc:"+damage on self",fx:"berserk"}]},

  {name:"Hitmontop",types:["Fighting"],cost:4,hp:250,weakness:["Psychic"],resistance:["Flying"],
    attacks:[{name:"Flying Spinkick",energy:2,baseDmg:50,desc:"+30 to bench",fx:"sniperBench:30"}]},

  {name:"Jolteon",types:["Electric"],cost:4,hp:200,weakness:["Ground"],resistance:["Steel"],
    ability:{name:"Electro Charge",desc:"Once during your turn, if this is your Active Pokemon, grant this Pokemon +1 Energy",type:"active",key:"electroCharge",activeOnly:true},
    attacks:[{name:"Thunderbolt",energy:3,baseDmg:70,desc:"May do +70 damage. If you do, this Pokemon loses 2 energy",fx:"optBoost:70:2"}]},

  {name:"Vaporeon",types:["Water"],cost:4,hp:240,weakness:["Electric"],resistance:["Fire"],
    ability:{name:"Bubble Cleanse",desc:"As often as you like during your turn, spend 1 energy to heal 30 from this Pokemon",type:"active",key:"bubbleCleanse"},
    attacks:[{name:"Hydro Splash",energy:3,baseDmg:80,desc:"",fx:""}]},

  {name:"Leafeon",types:["Grass"],cost:4,hp:220,weakness:["Bug"],resistance:["Water"],
    ability:{name:"Leaf Boost",desc:"Once during your turn, grant 1 of your Pokemon +1 energy. If you do, your turn ends",type:"active",key:"leafBoost",targeted:true},
    attacks:[{name:"Energy Blade",energy:1,baseDmg:30,desc:"+20 per own energy",fx:"scaleOwn:20"}]},

  {name:"Espeon",types:["Psychic"],cost:4,hp:190,weakness:["Dark"],resistance:["Psychic"],
    ability:{name:"Brilliant Shining",desc:"Once during your turn, both players gain 1 mana",type:"active",key:"brilliantShining"},
    attacks:[{name:"Energy Crush",energy:1,baseDmg:0,desc:"10x total opponent energy",fx:"scaleOppAll:10"}]},

  {name:"Kartana",types:["Grass","Steel"],cost:5,hp:210,weakness:["Fighting","Poison"],resistance:["Water","Poison"],
    attacks:[{name:"Beast Blade",energy:2,baseDmg:130,desc:"",fx:""}]},

  {name:"Koraidon",types:["Fighting","Dragon"],cost:6,hp:290,weakness:["Flying","Dragon"],resistance:["Grass"],
    attacks:[{name:"Wild Slash",energy:2,baseDmg:150,desc:"50 to self",fx:"selfDmg:50"},
             {name:"Payback Impact",energy:4,baseDmg:100,desc:"200 if 100+ damage",fx:"payback:100"}]},

  {name:"Kricketune",types:["Bug"],cost:3,hp:170,weakness:["Fire"],resistance:["Fighting"],
    ability:{name:"Befuddling Melody",desc:"Confuse Opp Active",type:"active",key:"lullaby",activeOnly:true},
    attacks:[{name:"Excited Buzz",energy:1,baseDmg:30,desc:"+10 per own energy",fx:"scaleOwn:10"}]},

  {name:"Klefki",types:["Fairy","Steel"],cost:4,hp:200,weakness:["Fire"],resistance:["Dragon"],
    ability:{name:"Keyring",desc:"When you put this Pokemon into play, you may attach up to 3 Held Items to it",type:"onPlay",key:"keyring"},
    attacks:[{name:"Fairy Wind",energy:3,baseDmg:70,desc:"",fx:""}]},

  {name:"Kyogre",types:["Water"],cost:6,hp:300,weakness:["Electric"],resistance:["Fire"],
    attacks:[{name:"Aqua Boost",energy:2,baseDmg:60,desc:"+1 energy",fx:"selfEnergy:1"},
             {name:"Origin Pulse",energy:4,baseDmg:120,desc:"+20 each opp bench",fx:"oppBenchDmg:20"}]},

  {name:"Ledian",types:["Bug","Flying"],cost:3,hp:210,weakness:["Water","Ice"],resistance:["Fire","Ground"],
    ability:{name:"Swift Strikes",desc:"Whenever this Pokemon attacks, it gains +1 Energy",type:"passive",key:"swiftStrikes"},
    attacks:[{name:"Five Star Punch",energy:2,baseDmg:50,desc:"If exactly 5 Energy: +50 damage",fx:"maxEnergyBonus:50"}]},

  {name:"Lucario",types:["Fighting","Steel"],cost:4,hp:180,weakness:["Flying","Psychic"],resistance:["Poison","Rock"],
    attacks:[{name:"Jet Jab",energy:1,baseDmg:60,desc:"Ignores resistance",fx:"ignoreRes"},
             {name:"Aura Sphere",energy:3,baseDmg:90,desc:"+30 to bench",fx:"sniperBench:30"}]},

  {name:"Lycanroc",types:["Rock"],cost:4,hp:210,weakness:["Steel"],resistance:["Flying"],
    ability:{name:"Bloodthirsty",desc:"1 mana: force opp to switch Active",type:"active",key:"bloodthirsty",activeOnly:true},
    attacks:[{name:"Finishing Fang",energy:3,baseDmg:60,desc:"+60 if defender <=120 HP",fx:"finishingFang"}]},

  {name:"Magmar",types:["Fire"],cost:4,hp:190,weakness:["Water"],resistance:["Fairy"],
    ability:{name:"Magma Sear",desc:"Opp burn recovery coin always tails; deal 10 extra damage",type:"passive",key:"magmaSear"},
    attacks:[{name:"Lava Toss",energy:3,baseDmg:70,desc:"Burn",fx:"burn"}]},

  {name:"Malamar",types:["Dark","Psychic"],cost:4,hp:200,weakness:["Fairy","Dark"],resistance:["Ghost","Fighting"],
    ability:{name:"Topsy Turvy",desc:"Opp confused coin flip always treated as tails",type:"passive",key:"topsyTurvy"},
    attacks:[{name:"Psychic Jumble",energy:3,baseDmg:50,desc:"Confuse",fx:"confuse"}]},

  {name:"Mamoswine",types:["Ice","Ground"],cost:4,hp:220,weakness:["Grass","Water"],resistance:["Ice","Electric"],
    attacks:[{name:"Icicle Shard",energy:2,baseDmg:80,desc:"",fx:""},
             {name:"Huge Earthquake",energy:4,baseDmg:100,desc:"30 to ALL bench (both sides)",fx:"allBenchDmg:30"}]},

  {name:"Marowak",types:["Ground"],cost:3,hp:200,weakness:["Grass"],resistance:["Electric"],
    attacks:[{name:"Bonemerang",energy:2,baseDmg:50,desc:"100 sustained",fx:"sustained:50"}]},

  {name:"Mawile",types:["Steel","Fairy"],cost:3,hp:180,weakness:["Fire"],resistance:["Dragon"],
    attacks:[{name:"Second Bite",energy:3,baseDmg:60,desc:"120 if 60+ dmg",fx:"bonusDmg:60:60"}]},

  {name:"Medicham",types:["Fighting","Psychic"],cost:3,hp:190,weakness:["Flying","Ghost"],resistance:["Poison","Fighting"],
    attacks:[{name:"Channel Ki",energy:1,baseDmg:0,desc:"+2 energy",fx:"selfEnergy:2"},
             {name:"Kinetic Blast",energy:3,baseDmg:80,desc:"",fx:""}]},

  {name:"Mega Absol",types:["Dark"],cost:5,hp:190,weakness:["Fairy"],resistance:["Ghost"],
    ability:{name:"Magic Coat",desc:"Takes 20 less damage",type:"passive",key:"damageReduce:20"},
    attacks:[{name:"Disaster Claw",energy:2,baseDmg:80,desc:"Opp loses 1 mana",fx:"oppMana:-1"}]},

  {name:"Mega Absol Z",types:["Dark","Psychic"],cost:5,hp:190,weakness:["Fairy","Dark"],resistance:["Ghost","Fighting"],
    attacks:[{name:"Baneful Hand",energy:3,baseDmg:150,desc:"+50 if full HP",fx:"fullHpBonus:50"}]},

  {name:"Mega Aggron",types:["Steel"],cost:5,hp:310,weakness:["Fighting"],resistance:["Poison"],
    ability:{name:"Filter",desc:"Block damage <=50",type:"passive",key:"filter"},
    attacks:[{name:"Steel Force",energy:4,baseDmg:80,desc:"-30 dmg next turn",fx:"selfShield:30"}]},

  {name:"Mega Audino",types:["Normal","Fairy"],cost:4,hp:260,weakness:["Poison"],resistance:["Ghost","Dragon"],
    ability:{name:"Mega Checkup",desc:"1 mana: heal 30 + clear status on Active",type:"active",key:"healingTouch"},
    attacks:[{name:"Careful Hearing",energy:3,baseDmg:0,desc:"Gain 1 mana",fx:"gainMana:1"}]},

  {name:"Mega Blaziken",types:["Fire","Fighting"],cost:5,hp:210,weakness:["Water","Flying"],resistance:["Grass","Steel"],
    ability:{name:"Mega Speed",desc:"Grant self +1 energy (1/turn)",type:"active",key:"megaSpeed",activeOnly:true},
    attacks:[{name:"Inferno Kick",energy:2,baseDmg:110,desc:"Lose 1 energy, Burn",fx:"selfEnergyLoss:1,burn"}]},

  {name:"Mega Mewtwo X",types:["Psychic","Fighting"],cost:7,hp:270,weakness:["Ghost","Flying"],resistance:["Fighting","Flying"],
    attacks:[{name:"Vanishing Strike",energy:3,baseDmg:190,desc:"Ignores resistance",fx:"ignoreRes"}]},

  {name:"Meowth",types:["Normal"],cost:2,hp:130,weakness:[],resistance:["Ghost"],
    attacks:[{name:"Pay Day",energy:2,baseDmg:20,desc:"Gain 1 mana",fx:"gainMana:1"}]},

  {name:"Mew",types:["Psychic"],cost:5,hp:230,weakness:["Ghost"],resistance:["Fighting"],
    ability:{name:"Versatility",desc:"Can use bench allies' attacks",type:"passive",key:"versatility"},
    attacks:[{name:"Psy Ball",energy:2,baseDmg:10,desc:"+10 per energy both actives",fx:"scaleBoth:10"}]},

  {name:"Mewtwo",types:["Psychic"],cost:6,hp:250,weakness:["Ghost"],resistance:["Fighting"],
    attacks:[{name:"X Ball",energy:1,baseDmg:20,desc:"+20 per energy both actives",fx:"scaleBoth:20"},
             {name:"Psystrike",energy:3,baseDmg:160,desc:"",fx:""}]},

  {name:"Mismagius",types:["Ghost"],cost:4,hp:200,weakness:["Dark"],resistance:["Normal"],
    ability:{name:"Magic Drain",desc:"Spend 1 mana: opp loses 1 mana (unlimited)",type:"active",key:"magicDrain"},
    attacks:[{name:"Hex Burn",energy:2,baseDmg:70,desc:"Burn if defender has status",fx:"hexBurn"}]},

  {name:"Muk",types:["Poison"],cost:4,hp:250,weakness:["Ground"],resistance:["Fairy"],
    attacks:[{name:"Nasty Goop",energy:2,baseDmg:10,desc:"Strip 1 energy + Poison",fx:"stripEnergy:1,poison"},
             {name:"Split Sludge Bomb",energy:4,baseDmg:0,desc:"60 to 2 Pokemon, lose 2 energy",fx:"multiTarget:60:2"}]},

  {name:"Obstagoon",types:["Dark","Normal"],cost:4,hp:230,weakness:["Fairy"],resistance:["Ghost","Dark"],
    ability:{name:"Blockade",desc:"Opp Active can't retreat",type:"passive",key:"blockade"},
    attacks:[{name:"Obstruct",energy:3,baseDmg:50,desc:"Strip 1 energy",fx:"stripEnergy:1"}]},

  {name:"Oinkologne",types:["Normal"],cost:4,hp:240,weakness:[],resistance:["Ghost"],
    ability:{name:"Thick Aroma",desc:"Opp attacks cost +1 energy",type:"passive",key:"thickAroma"},
    attacks:[{name:"Heavy Stomp",energy:3,baseDmg:80,desc:"",fx:""}]},

  {name:"Pichu",types:["Electric"],cost:1,hp:80,weakness:["Ground"],resistance:["Steel"],
    attacks:[{name:"Sparky Generator",energy:1,baseDmg:0,desc:"Gain 1 mana",fx:"gainMana:1"}]},

  {name:"Palkia",types:["Water","Dragon"],cost:6,hp:280,weakness:["Electric","Dragon"],resistance:["Fire","Grass"],
    ability:{name:"Dimension Expansion",desc:"On play: permanently increase your max bench size by 2",type:"onPlay",key:"dimensionExpansion"},
    attacks:[{name:"Spacial Rend",energy:4,baseDmg:100,desc:"Damage ignores resistance/reduction and defensive effects",fx:"ignoreReduction"}]},

  {name:"Porygon2",types:["Normal"],cost:4,hp:220,weakness:[],resistance:["Ghost"],
    attacks:[{name:"Power of 2",energy:2,baseDmg:0,desc:"Double your current Mana",fx:"doubleMana"}]},

  {name:"Psyduck",types:["Water"],cost:2,hp:140,weakness:["Electric"],resistance:["Fire"],
    attacks:[{name:"Confusion Wave",energy:2,baseDmg:60,desc:"Both actives confused",fx:"confuseBoth"}]},

  {name:"Raikou",types:["Electric"],cost:5,hp:240,weakness:["Ground"],resistance:["Steel"],
    attacks:[{name:"Charge Lance",energy:2,baseDmg:100,desc:"+50 bench if 4+ energy",fx:"condBench:4:50"}]},

  {name:"Regigigas",types:["Normal"],cost:6,hp:330,weakness:[],resistance:["Ghost"],
    ability:{name:"Slow Start",desc:"Energy costs 2 mana",type:"passive",key:"slowStart"},
    attacks:[{name:"Colossal Crush",energy:3,baseDmg:180,desc:"",fx:""}]},

  {name:"Reshiram",types:["Dragon","Fire"],cost:6,hp:280,weakness:["Water","Dragon"],resistance:["Fairy","Grass"],
    attacks:[{name:"Glinting Claw",energy:2,baseDmg:100,desc:"",fx:""},
             {name:"Blue Flare Blaze",energy:4,baseDmg:250,desc:"Lose 2 energy",fx:"selfEnergyLoss:2"}]},

  {name:"Rotom",types:["Electric","Ghost"],cost:3,hp:180,
    attacks:[{name:"Trick",energy:1,baseDmg:0,desc:"Both Active Pokemon swap Held Items",fx:"trick"},
             {name:"Poltergeist",energy:3,baseDmg:100,desc:"Does nothing if defender has no Held Item",fx:"poltergeist"}]},

  {name:"Rhydon",types:["Ground","Rock"],cost:4,hp:250,weakness:["Grass","Water"],resistance:["Electric","Flying"],
    attacks:[{name:"Horn Drill",energy:2,baseDmg:70,desc:"",fx:""},
             {name:"Collateral Crush",energy:4,baseDmg:140,desc:"50 to your bench",fx:"selfBenchDmg:50"}]},

  {name:"Sceptile",types:["Grass"],cost:4,hp:190,weakness:["Fire"],resistance:["Water"],
    attacks:[{name:"Bloom Blade",energy:1,baseDmg:40,desc:"Bench +1 energy",fx:"benchEnergy:1"},
             {name:"Slime Slicer",energy:3,baseDmg:90,desc:"Poison",fx:"poison"}]},

  {name:"Salazzle",types:["Poison","Fire"],cost:4,hp:180,weakness:["Psychic","Water"],resistance:["Bug","Fairy"],
    attacks:[{name:"Corro-Burn",energy:1,baseDmg:40,desc:"Burn and Poison",fx:"burn,poison"}]},

  {name:"Scovillain",types:["Grass","Fire"],cost:4,hp:180,weakness:["Poison"],resistance:["Water","Fairy"],
    attacks:[{name:"Chili Bite",energy:1,baseDmg:40,desc:"Burn",fx:"burn"},
             {name:"Spicy Rage",energy:3,baseDmg:40,desc:"+dmg on self",fx:"berserk"}]},

  {name:"Seviper",types:["Poison"],cost:4,hp:190,weakness:["Psychic"],resistance:["Grass"],
    ability:{name:"Deadly Slice",desc:"Deal 30 damage to opp Active if it is Poisoned",type:"active",key:"deadlySlice"},
    attacks:[{name:"Toxic Blade",energy:3,baseDmg:70,desc:"Poison",fx:"poison"}]},

  {name:"Shedinja",types:["Bug","Ghost"],cost:1,hp:60,weakness:["Fire","Dark"],resistance:["Fighting","Normal"],
    ability:{name:"Draining Vessel",desc:"On play: strip 2 from opp Active",type:"onPlay",key:"soulDrain"},
    attacks:[{name:"Tackle",energy:1,baseDmg:30,desc:"",fx:""}]},

  {name:"Shaymin",types:["Grass"],cost:5,hp:220,weakness:["Bug"],resistance:["Water"],
    ability:{name:"Blooming Garden",desc:"While this Pokemon is in play, your Pokemon get +20 HP",type:"passive",key:"bloomingGarden"},
    attacks:[{name:"Flower Grace",energy:3,baseDmg:0,desc:"Each bench +1 energy. Heal 10 from each ally",fx:"benchEnergyAll,healAll:10"}]},

  {name:"Shuckle",types:["Bug","Rock"],cost:4,hp:300,weakness:["Water","Electric"],resistance:["Fighting","Flying"],
    ability:{name:"Berry Juice Sip",desc:"Heal 20 each turn",type:"passive",key:"berryJuice"},
    attacks:[{name:"Slap",energy:2,baseDmg:30,desc:"",fx:""}]},

  {name:"Skarmory",types:["Steel","Flying"],cost:4,hp:260,weakness:["Fighting","Ice"],resistance:["Poison","Ground"],
    attacks:[{name:"Steel Wing",energy:1,baseDmg:50,desc:"",fx:""},
             {name:"Brave Bird",energy:3,baseDmg:130,desc:"50 to self",fx:"selfDmg:50"}]},

  {name:"Slurpuff",types:["Fairy"],cost:4,hp:230,weakness:["Steel"],resistance:["Dragon"],
    ability:{name:"Yummy Delivery",desc:"Bench +1 energy free/turn",type:"active",key:"yummyDelivery",targeted:true,activeOnly:true},
    attacks:[{name:"Slurp it Up",energy:4,baseDmg:70,desc:"Heal 30",fx:"healSelf:30"}]},

  {name:"Snorlax",types:["Normal"],cost:4,hp:270,weakness:[],resistance:["Ghost"],
    attacks:[{name:"Smack",energy:2,baseDmg:60,desc:"",fx:""},
             {name:"Heavy Snore",energy:4,baseDmg:120,desc:"Fall asleep",fx:"selfSleep"}]},

  {name:"Sudowoodo",types:["Rock"],cost:3,hp:220,weakness:["Water"],resistance:["Flying"],
    attacks:[{name:"Hard Head Smash",energy:3,baseDmg:120,desc:"50 to self",fx:"selfDmg:50"}]},

  {name:"Suicune",types:["Water"],cost:5,hp:280,weakness:["Electric"],resistance:["Fire"],
    ability:{name:"Freezing Winds",desc:"Strip 1 energy from opp Active",type:"passive",key:"aquaRing"},
    attacks:[{name:"Crystal Shimmer",energy:3,baseDmg:60,desc:"+20 per bench",fx:"scaleBench:20"}]},

  {name:"Sylveon",types:["Fairy"],cost:4,hp:250,weakness:["Steel"],resistance:["Dragon"],
    attacks:[{name:"Magical Gift",energy:1,baseDmg:0,desc:"Gain 1 mana",fx:"gainMana:1"},
             {name:"Hyper Voice",energy:3,baseDmg:90,desc:"",fx:""}]},


  {name:"Tyrogue",types:["Fighting"],cost:1,hp:100,weakness:["Flying"],resistance:["Rock"],
    ability:{name:"Gutsy Generator",desc:"If this Pokemon has any damage on it, gain 1 mana. If you do, your turn ends.",type:"active",key:"gutsyGenerator"},
    attacks:[{name:"Crash Kick",energy:2,baseDmg:40,desc:"This Pokemon also does 20 damage to itself",fx:"selfDmg:20"}]},

  {name:"Tyranitar",types:["Rock","Dark"],cost:5,hp:280,weakness:["Steel","Fairy"],resistance:["Flying","Dark"],
    ability:{name:"Sand Stream",desc:"At the end of your turn, if this is your Active Pokemon, deal 10 damage to each of your opponent's Pokemon",type:"passive",key:"sandStream"},
    attacks:[{name:"Mega Crush",energy:4,baseDmg:120,desc:"Both Active Pokemon lose 2 Energy",fx:"mutualEnergyLoss:2"}]},

  {name:"Cleffa",types:["Fairy"],cost:1,hp:130,weakness:["Poison"],resistance:["Water"],
    attacks:[{name:"Twinkly Generator",energy:1,baseDmg:0,desc:"Grant 1 of your Benched Pokemon +1 energy",fx:"benchEnergy:1"}]},

  {name:"Azurill",types:["Normal","Fairy"],cost:1,hp:130,weakness:["Poison"],resistance:["Ghost","Dragon"],
    ability:{name:"Bouncy Generator",desc:"If this is your Active Pokemon and is Knocked Out, gain 1 mana.",type:"passive",key:"bouncyGenerator"},
    attacks:[{name:"Squish",energy:2,baseDmg:10,desc:"Heal 10 damage from this Pokemon",fx:"healSelf:10"}]},

  {name:"Trevenant",types:["Grass","Ghost"],cost:4,hp:230,weakness:["Dark","Poison"],resistance:["Normal","Water"],
    attacks:[{name:"Forest's Curse",energy:1,baseDmg:30,desc:"All opp Grass-weak",fx:"grassWeakness"},
             {name:"Wood Hammer",energy:3,baseDmg:120,desc:"Lose 1 energy",fx:"selfEnergyLoss:1"}]},

  {name:"Umbreon",types:["Dark"],cost:4,hp:280,weakness:["Fairy"],resistance:["Ghost"],
    attacks:[{name:"Shadow Chase",energy:1,baseDmg:0,desc:"Strip 1 from any",fx:"anyStrip:1"},
             {name:"Moonlit Blade",energy:3,baseDmg:90,desc:"-10 per def energy",fx:"scaleDefNeg:10"}]},

  {name:"Unown",types:["Psychic"],cost:2,hp:130,weakness:["Dark"],resistance:["Fighting"],
    ability:{name:"Ancient Energy",desc:"Active +1 energy, turn ends",type:"active",key:"hiddenPower"},
    attacks:[{name:"Psy Pulse",energy:1,baseDmg:40,desc:"",fx:""}]},

  {name:"Vileplume",types:["Grass","Poison"],cost:4,hp:200,weakness:["Ground"],resistance:["Water"],
    ability:{name:"Poison Fumes",desc:"Poison opp Active (1/turn)",type:"active",key:"poisonFumes"},
    attacks:[{name:"Sleepy Bloom",energy:3,baseDmg:50,desc:"Sleep",fx:"sleep"}]},

  {name:"Zeraora",types:["Electric"],cost:5,hp:220,weakness:["Ground"],resistance:["Steel"],
    attacks:[{name:"Volt Switch",energy:1,baseDmg:80,desc:"Force self-retreat",fx:"selfRetreat"},
             {name:"Plasma Discharge",energy:3,baseDmg:220,desc:"Lose ALL energy",fx:"selfEnergyLoss:99"}]},

  {name:"Zoroark",types:["Dark"],cost:4,hp:170,weakness:[],resistance:["Normal"],
    ability:{name:"Creeping Chill",desc:"10 dmg to any (1/turn)",type:"active",key:"creepingChill",targeted:true},
    attacks:[{name:"Bitter Malice",energy:3,baseDmg:90,desc:"Strip 1 energy",fx:"stripEnergy:1"}]},

  {name:"Zorua",types:["Dark"],cost:2,hp:110,weakness:["Fairy"],resistance:["Dark"],
    ability:{name:"Illusory Getaway",desc:"Free retreat (Active)",type:"active",key:"phantomWalk",activeOnly:true},
    attacks:[{name:"Night Slash",energy:2,baseDmg:50,desc:"",fx:""}]},
];

// ============================================================
// Lookup helpers
// ============================================================

var TYPE_WEAK_RES = {
  Normal: ['none', 'Ghost'],
  Fire: ['Water', 'Fairy'],
  Water: ['Electric', 'Fire'],
  Electric: ['Ground', 'Steel'],
  Grass: ['Bug', 'Water'],
  Ice: ['Rock', 'Ice'],
  Fighting: ['Flying', 'Rock'],
  Poison: ['Psychic', 'Bug'],
  Ground: ['Grass', 'Electric'],
  Flying: ['Ice', 'Ground'],
  Psychic: ['Dark', 'Psychic'],
  Bug: ['Fire', 'Fighting'],
  Rock: ['Steel', 'Flying'],
  Ghost: ['Ghost', 'Normal'],
  Dragon: ['Dragon', 'Grass'],
  Dark: ['Fairy', 'Dark'],
  Steel: ['Fighting', 'Poison'],
  Fairy: ['Poison', 'Dragon']
};

function deriveWeakRes(types) {
  var weakSet = {};
  var resistSet = {};
  if (!types || !types.length) types = ['Normal'];
  for (var i = 0; i < types.length; i++) {
    var t = types[i];
    var wr = TYPE_WEAK_RES[t] || ['none', 'none'];
    if (wr[0] && wr[0] !== 'none') weakSet[wr[0]] = true;
    if (wr[1] && wr[1] !== 'none') resistSet[wr[1]] = true;
  }
  // Cancel overlap in both directions.
  var k;
  for (k in weakSet) {
    if (resistSet[k]) {
      delete weakSet[k];
      delete resistSet[k];
    }
  }
  var weakness = [];
  var resistance = [];
  for (k in weakSet) weakness.push(k);
  for (k in resistSet) resistance.push(k);
  return { weakness: weakness, resistance: resistance };
}

function normalizeWeakResForEntry(entry) {
  var wr = deriveWeakRes(entry.types);
  entry.weakness = wr.weakness;
  entry.resistance = wr.resistance;
}

function applyTypeChartRulesToAll() {
  for (var i = 0; i < POKEMON_DB.length; i++) {
    normalizeWeakResForEntry(POKEMON_DB[i]);
  }
}

var _pokemonMap = null;

applyTypeChartRulesToAll();

function _buildMap() {
  if (_pokemonMap) return;
  _pokemonMap = {};
  for (var i = 0; i < POKEMON_DB.length; i++) {
    _pokemonMap[POKEMON_DB[i].name] = POKEMON_DB[i];
  }
}

/** Get a Pokemon definition by name. Returns the DB entry or a stub. */
function getPokemonData(name) {
  _buildMap();
  return _pokemonMap[name] || { name: name, types: ['Normal'], attacks: [], cost: 1, hp: 100, weakness: [], resistance: [] };
}

/**
 * Merge external stat overrides (from pokemon-data.js).
 * Overwrites types, cost, hp, weakness, resistance for matching names.
 */
function mergeStatOverrides(overrides) {
  if (!overrides || !overrides.length) return;
  _buildMap();
  for (var i = 0; i < overrides.length; i++) {
    var ext = overrides[i];
    var entry = _pokemonMap[ext.name];
    if (entry) {
      entry.types = ext.types;
      entry.cost = ext.cost;
      entry.hp = ext.hp;
      normalizeWeakResForEntry(entry);
    }
  }
}

// ============================================================
// EXPORTS
// ============================================================
exports.POKEMON_DB = POKEMON_DB;
exports.getPokemonData = getPokemonData;
exports.mergeStatOverrides = mergeStatOverrides;

})(typeof module !== 'undefined' && module.exports ? module.exports : (this.PokemonDB = {}));
