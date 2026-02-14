// ============================================================
// POKEMON TCG - Server Game Engine (No DOM)
// ============================================================
// Pure game logic extracted from game.js. Works in Node.js and browser.
// All animations replaced with event accumulation.
// ============================================================
(function(exports) {
'use strict';

const POKEMON_DB = [
  {name:"Alolan Ninetales",types:["Ice","Fairy"],cost:4,hp:190,weakness:["Steel","Poison"],resistance:["Dragon","Ice"],
    ability:{name:"Aurora Veil",desc:"All your Pokémon take 10 less damage",type:"passive",key:"auroraVeil"},
    attacks:[{name:"Frost Over",energy:3,baseDmg:50,desc:"+10 per energy on defender",fx:"scaleDef:10"}]},
  {name:"Alolan Raichu",types:["Electric","Psychic"],cost:4,hp:150,weakness:["Ground","Dark"],resistance:["Steel","Fighting"],
    ability:{name:"Spark Surfer",desc:"Free retreat once per turn",type:"passive",key:"sparkSurfer"},
    attacks:[{name:"Psychic",energy:3,baseDmg:20,desc:"+20 per energy on defender",fx:"scaleDef:20"}]},
  {name:"Arceus",types:["Normal"],cost:6,hp:300,weakness:[],resistance:["Ghost"],
    ability:{name:"Creation",desc:"Spend 1 mana → gain 2 mana",type:"active",key:"creation"},
    attacks:[{name:"Judgement",energy:3,baseDmg:120,desc:"",fx:""}]},
  {name:"Archeops",types:["Rock","Flying"],cost:5,hp:240,weakness:["Water","Electric"],resistance:["Fire","Grass"],
    ability:{name:"Defeatist",desc:"Can't attack if 120+ damage",type:"passive",key:"defeatist"},
    attacks:[{name:"Wild Flailing",energy:2,baseDmg:150,desc:"+20 to ALL benched",fx:"benchAll:20"}]},
  {name:"Arctozolt",types:["Electric","Ice"],cost:4,hp:230,weakness:["Ground","Fire"],resistance:["Steel","Ice"],
    ability:{name:"Biting Whirlpool",desc:"10 dmg when opp gains energy",type:"passive",key:"bitingWhirlpool"},
    attacks:[{name:"Electro Ball",energy:2,baseDmg:70,desc:"",fx:""}]},
  {name:"Baxcalibur",types:["Dragon","Ice"],cost:5,hp:260,weakness:["Fairy","Fire"],resistance:["Grass","Ice"],
    attacks:[{name:"Dragon Dance",energy:1,baseDmg:0,desc:"Gain +2 energy",fx:"selfEnergy:2"},
             {name:"Glaive Rush",energy:3,baseDmg:160,desc:"Take 60 more dmg next turn",fx:"selfVuln:60"}]},
  {name:"Beedrill",types:["Bug","Poison"],cost:3,hp:180,weakness:["Fire","Ground"],resistance:["Grass","Fairy"],
    attacks:[{name:"Swarm Snipe",energy:1,baseDmg:0,desc:"10 to target per your Pokémon",fx:"swarmSnipe"},
             {name:"Poison Pierce",energy:3,baseDmg:60,desc:"Poison",fx:"poison"}]},
  {name:"Chansey",types:["Normal"],cost:4,hp:320,weakness:[],resistance:["Ghost"],
    ability:{name:"Egg Drop Heal",desc:"Heal 10 from any (1/turn)",type:"active",key:"softTouch"},
    attacks:[{name:"Double Edge",energy:4,baseDmg:80,desc:"40 to self",fx:"selfDmg:40"}]},
  {name:"Charizard",types:["Fire","Flying"],cost:4,hp:200,weakness:["Water","Ice"],resistance:["Fairy","Ground"],
    attacks:[{name:"Claw Slash",energy:2,baseDmg:90,desc:"",fx:""},
             {name:"Inferno Burst",energy:4,baseDmg:180,desc:"Lose 2 energy",fx:"selfEnergyLoss:2"}]},
  {name:"Clodsire",types:["Poison","Ground"],cost:3,hp:240,weakness:["Water","Grass"],resistance:["Grass","Electric"],
    attacks:[{name:"Sludge Slap",energy:2,baseDmg:20,desc:"Poison",fx:"poison"},
             {name:"Muddy Crash",energy:4,baseDmg:100,desc:"Lose 1 energy",fx:"selfEnergyLoss:1"}]},
  {name:"Delibird",types:["Ice","Flying"],cost:2,hp:120,weakness:["Fire"],resistance:["Ground"],
    attacks:[{name:"Gift Delivery",energy:2,baseDmg:0,desc:"Each bench +1 energy",fx:"benchEnergyAll"}]},
  {name:"Ditto",types:["Normal"],cost:2,hp:130,weakness:[],resistance:["Ghost"],
    ability:{name:"Improvised Attack",desc:"Spend 1 energy: gain opp's attacks this turn",type:"active",key:"improvise"},
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
  {name:"Gengar",types:["Ghost","Poison"],cost:4,hp:180,weakness:["Dark","Ground"],resistance:["Normal","Fairy"],
    attacks:[{name:"Cursed Look",energy:1,baseDmg:0,desc:"Strip 2 energy",fx:"stripEnergy:2"},
             {name:"Shadow Ball",energy:3,baseDmg:120,desc:"",fx:""}]},
  {name:"Glaceon",types:["Ice"],cost:4,hp:230,weakness:["Fire"],resistance:["Ice"],
    attacks:[{name:"Ice Shard",energy:1,baseDmg:40,desc:"Hit any Pokémon",fx:"snipe"},
             {name:"Crystal Wall",energy:3,baseDmg:80,desc:"30 less dmg next turn",fx:"selfShield:30"}]},
  {name:"Golisopod",types:["Bug","Water"],cost:4,hp:260,weakness:["Electric"],resistance:["Fighting"],
    attacks:[{name:"U-Turn",energy:1,baseDmg:50,desc:"Forced self-retreat",fx:"selfRetreat"},
             {name:"Aqua Lunge",energy:3,baseDmg:100,desc:"Can't use next turn",fx:"lockAttack"}]},
  {name:"Groudon",types:["Ground"],cost:6,hp:300,weakness:["Grass"],resistance:["Electric"],
    attacks:[{name:"Magma Wreck",energy:2,baseDmg:70,desc:"Strip 1 energy",fx:"stripEnergy:1"},
             {name:"Precipice Purge",energy:4,baseDmg:140,desc:"Or 210 (lose 2 energy)",fx:"optBoost:70:2"}]},
  {name:"Guzzlord",types:["Dark","Dragon"],cost:5,hp:300,weakness:["Fairy","Dragon"],resistance:["Ghost","Grass"],
    attacks:[{name:"Tyrannical Hole",energy:4,baseDmg:140,desc:"",fx:""}]},
  {name:"Gyarados",types:["Water","Flying"],cost:4,hp:230,weakness:["Electric","Ice"],resistance:["Fire","Rock"],
    attacks:[{name:"Thrash",energy:2,baseDmg:80,desc:"",fx:""},
             {name:"Berserk Splash",energy:4,baseDmg:10,desc:"+damage on self",fx:"berserk"}]},
  {name:"Hitmontop",types:["Fighting"],cost:4,hp:250,weakness:["Psychic"],resistance:["Flying"],
    attacks:[{name:"Flying Spinkick",energy:2,baseDmg:50,desc:"+30 to bench",fx:"sniperBench:30"}]},
  {name:"Kartana",types:["Grass","Steel"],cost:5,hp:210,weakness:["Fighting","Poison"],resistance:["Water","Poison"],
    attacks:[{name:"Beast Blade",energy:2,baseDmg:130,desc:"",fx:""}]},
  {name:"Koraidon",types:["Fighting","Dragon"],cost:6,hp:290,weakness:["Flying","Dragon"],resistance:["Grass"],
    attacks:[{name:"Wild Slash",energy:2,baseDmg:150,desc:"50 to self",fx:"selfDmg:50"},
             {name:"Payback Impact",energy:4,baseDmg:100,desc:"200 if 100+ damage",fx:"payback:100"}]},
  {name:"Kricketune",types:["Bug"],cost:3,hp:170,weakness:["Fire"],resistance:["Fighting"],
    ability:{name:"Befuddling Melody",desc:"Confuse Opp Active",type:"active",key:"lullaby"},
    attacks:[{name:"Excited Buzz",energy:1,baseDmg:30,desc:"+10 per own energy",fx:"scaleOwn:10"}]},
  {name:"Kyogre",types:["Water"],cost:6,hp:300,weakness:["Electric"],resistance:["Fire"],
    attacks:[{name:"Aqua Boost",energy:2,baseDmg:60,desc:"+1 energy",fx:"selfEnergy:1"},
             {name:"Origin Pulse",energy:4,baseDmg:120,desc:"+20 each opp bench",fx:"oppBenchDmg:20"}]},
  {name:"Lucario",types:["Fighting","Steel"],cost:4,hp:180,weakness:["Flying","Psychic"],resistance:["Poison","Rock"],
    attacks:[{name:"Jet Jab",energy:1,baseDmg:60,desc:"Ignores resistance",fx:"ignoreRes"},
             {name:"Aura Sphere",energy:3,baseDmg:90,desc:"+30 to bench",fx:"sniperBench:30"}]},
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
    ability:{name:"Filter",desc:"Block damage ≤50",type:"passive",key:"filter"},
    attacks:[{name:"Steel Force",energy:4,baseDmg:80,desc:"-30 dmg next turn",fx:"selfShield:30"}]},
  {name:"Mega Audino",types:["Normal","Fairy"],cost:4,hp:260,weakness:["Poison"],resistance:["Ghost","Dragon"],
    ability:{name:"Mega Checkup",desc:"1 mana: heal 30 + clear status",type:"active",key:"healingTouch"},
    attacks:[{name:"Careful Hearing",energy:3,baseDmg:0,desc:"Gain 1 mana",fx:"gainMana:1"}]},
  {name:"Mega Mewtwo X",types:["Psychic","Fighting"],cost:7,hp:270,weakness:["Ghost","Flying"],resistance:["Fighting","Flying"],
    attacks:[{name:"Vanishing Strike",energy:3,baseDmg:190,desc:"Ignores resistance",fx:"ignoreRes"}]},
  {name:"Mew",types:["Psychic"],cost:5,hp:230,weakness:["Ghost"],resistance:["Fighting"],
    ability:{name:"Versatility",desc:"Can use bench allies' attacks",type:"passive",key:"versatility"},
    attacks:[{name:"Psy Ball",energy:2,baseDmg:10,desc:"+10 per energy both actives",fx:"scaleBoth:10"}]},
  {name:"Mewtwo",types:["Psychic"],cost:6,hp:250,weakness:["Ghost"],resistance:["Fighting"],
    attacks:[{name:"X Ball",energy:1,baseDmg:20,desc:"+20 per energy both actives",fx:"scaleBoth:20"},
             {name:"Psystrike",energy:3,baseDmg:160,desc:"",fx:""}]},
  {name:"Muk",types:["Poison"],cost:4,hp:250,weakness:["Ground"],resistance:["Fairy"],
    attacks:[{name:"Nasty Goop",energy:2,baseDmg:10,desc:"Strip 1 energy + Poison",fx:"stripEnergy:1,poison"},
             {name:"Split Sludge Bomb",energy:5,baseDmg:0,desc:"60 to 2 Pokémon, lose 2 energy",fx:"multiTarget:60:2"}]},
  {name:"Obstagoon",types:["Dark","Normal"],cost:4,hp:230,weakness:["Fairy"],resistance:["Ghost","Dark"],
    ability:{name:"Blockade",desc:"Opp Active can't retreat",type:"passive",key:"blockade"},
    attacks:[{name:"Obstruct",energy:3,baseDmg:50,desc:"Strip 1 energy",fx:"stripEnergy:1"}]},
  {name:"Oinkologne",types:["Normal"],cost:4,hp:240,weakness:[],resistance:["Ghost"],
    ability:{name:"Thick Aroma",desc:"Opp attacks cost +1 energy",type:"passive",key:"thickAroma"},
    attacks:[{name:"Heavy Stomp",energy:3,baseDmg:80,desc:"",fx:""}]},
  {name:"Pichu",types:["Electric"],cost:1,hp:80,weakness:["Ground"],resistance:["Steel"],
    attacks:[{name:"Sparky Generator",energy:1,baseDmg:0,desc:"Gain 1 mana",fx:"gainMana:1"}]},
  {name:"Raikou",types:["Electric"],cost:5,hp:240,weakness:["Ground"],resistance:["Steel"],
    attacks:[{name:"Charge Lance",energy:2,baseDmg:100,desc:"+50 bench if 4+ energy",fx:"condBench:4:50"}]},
  {name:"Regigigas",types:["Normal"],cost:6,hp:330,weakness:[],resistance:["Ghost"],
    ability:{name:"Slow Start",desc:"Energy costs 2 mana",type:"passive",key:"slowStart"},
    attacks:[{name:"Colossal Crush",energy:3,baseDmg:180,desc:"",fx:""}]},
  {name:"Reshiram",types:["Dragon","Fire"],cost:6,hp:280,weakness:["Water","Dragon"],resistance:["Fairy","Grass"],
    attacks:[{name:"Glinting Claw",energy:2,baseDmg:100,desc:"",fx:""},
             {name:"Blue Flare Blaze",energy:4,baseDmg:250,desc:"Lose 2 energy",fx:"selfEnergyLoss:2"}]},
  {name:"Rhydon",types:["Ground","Rock"],cost:4,hp:250,weakness:["Grass","Water"],resistance:["Electric","Flying"],
    attacks:[{name:"Horn Drill",energy:2,baseDmg:70,desc:"",fx:""},
             {name:"Collateral Crush",energy:4,baseDmg:140,desc:"50 to your bench",fx:"selfBenchDmg:50"}]},
  {name:"Sceptile",types:["Grass"],cost:4,hp:190,weakness:["Fire"],resistance:["Water"],
    attacks:[{name:"Bloom Blade",energy:1,baseDmg:40,desc:"Bench +1 energy",fx:"benchEnergy:1"},
             {name:"Slime Slicer",energy:3,baseDmg:90,desc:"Poison",fx:"poison"}]},
  {name:"Scovillain",types:["Grass","Fire"],cost:4,hp:180,weakness:["Poison"],resistance:["Water","Fairy"],
    attacks:[{name:"Chili Bite",energy:1,baseDmg:40,desc:"Burn",fx:"burn"},
             {name:"Spicy Rage",energy:3,baseDmg:40,desc:"+dmg on self",fx:"berserk"}]},
  {name:"Shedinja",types:["Bug","Ghost"],cost:1,hp:60,weakness:["Fire","Dark"],resistance:["Fighting","Normal"],
    ability:{name:"Draining Vessel",desc:"On play: strip 2 from opp Active",type:"onPlay",key:"soulDrain"},
    attacks:[{name:"Tackle",energy:1,baseDmg:30,desc:"",fx:""}]},
  {name:"Shuckle",types:["Bug","Rock"],cost:4,hp:300,weakness:["Water","Electric"],resistance:["Fighting","Flying"],
    ability:{name:"Berry Juice Sip",desc:"Heal 20 each turn",type:"passive",key:"berryJuice"},
    attacks:[{name:"Slap",energy:2,baseDmg:30,desc:"",fx:""}]},
  {name:"Skarmory",types:["Steel","Flying"],cost:4,hp:260,weakness:["Fighting","Ice"],resistance:["Poison","Ground"],
    attacks:[{name:"Steel Wing",energy:1,baseDmg:50,desc:"",fx:""},
             {name:"Brave Bird",energy:3,baseDmg:130,desc:"50 to self",fx:"selfDmg:50"}]},
  {name:"Slurpuff",types:["Fairy"],cost:4,hp:230,weakness:["Steel"],resistance:["Dragon"],
    ability:{name:"Yummy Delivery",desc:"Bench +1 energy free/turn",type:"active",key:"yummyDelivery"},
    attacks:[{name:"Slurp it Up",energy:4,baseDmg:70,desc:"Heal 30",fx:"healSelf:30"}]},
  {name:"Snorlax",types:["Normal"],cost:4,hp:270,weakness:[],resistance:["Ghost"],
    attacks:[{name:"Smack",energy:2,baseDmg:60,desc:"",fx:""},
             {name:"Heavy Snore",energy:4,baseDmg:120,desc:"Fall asleep",fx:"selfSleep"}]},
  {name:"Sudowoodo",types:["Rock"],cost:3,hp:220,weakness:["Water"],resistance:["Flying"],
    attacks:[{name:"Hard Head Smash",energy:3,baseDmg:120,desc:"50 to self",fx:"selfDmg:50"}]},
  {name:"Suicune",types:["Water"],cost:5,hp:280,weakness:["Electric"],resistance:["Fire"],
    ability:{name:"Freezing Winds",desc:"Strip 1 energy from opp Active",type:"passive",key:"aquaRing"},
    attacks:[{name:"Crystal Shimmer",energy:3,baseDmg:60,desc:"+20 per bench (max 140)",fx:"scaleBench:20"}]},
  {name:"Sylveon",types:["Fairy"],cost:4,hp:250,weakness:["Steel"],resistance:["Dragon"],
    attacks:[{name:"Magical Gift",energy:1,baseDmg:0,desc:"Gain 1 mana",fx:"gainMana:1"},
             {name:"Hyper Voice",energy:3,baseDmg:90,desc:"",fx:""}]},
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
    attacks:[{name:"Sleepy Bloom",energy:4,baseDmg:50,desc:"Sleep",fx:"sleep"}]},
  {name:"Zeraora",types:["Electric"],cost:5,hp:220,weakness:["Ground"],resistance:["Steel"],
    attacks:[{name:"Volt Switch",energy:1,baseDmg:80,desc:"Force self-retreat",fx:"selfRetreat"},
             {name:"Plasma Discharge",energy:3,baseDmg:220,desc:"Lose ALL energy",fx:"selfEnergyLoss:99"}]},
  {name:"Zoroark",types:["Dark","Normal"],cost:4,hp:170,weakness:[],resistance:["Normal"],
    ability:{name:"Creeping Chill",desc:"10 dmg to any (1/turn)",type:"active",key:"creepingChill"},
    attacks:[{name:"Bitter Malice",energy:3,baseDmg:90,desc:"Strip 1 energy",fx:"stripEnergy:1"}]},
  {name:"Zorua",types:["Dark","Normal"],cost:2,hp:110,weakness:["Fairy"],resistance:["Dark"],
    ability:{name:"Illusory Getaway",desc:"Free retreat (Active)",type:"active",key:"phantomWalk"},
    attacks:[{name:"Night Slash",energy:2,baseDmg:50,desc:"",fx:""}]},
  {name:"Galarian Weezing",types:["Poison","Fairy"],cost:4,hp:210,weakness:["Fire","Psychic"],resistance:["Grass","Water"],
    ability:{name:"Neutralizing Gas",desc:"Prevent all Active abilities",type:"passive",key:"neutralizingGas"},
    attacks:[{name:"Smog",energy:2,baseDmg:20,desc:"Poison",fx:"poison"}]},
  {name:"Gothorita",types:["Psychic"],cost:3,hp:210,weakness:["Dark"],resistance:["Fighting"],
    attacks:[{name:"Mad Party",energy:2,baseDmg:0,desc:"10 per Pokémon in play",fx:"madParty"}]},
  {name:"Lycanroc",types:["Rock"],cost:4,hp:210,weakness:["Steel"],resistance:["Flying"],
    ability:{name:"Bloodthirsty",desc:"1 mana: force opp to switch Active",type:"active",key:"bloodthirsty"},
    attacks:[{name:"Finishing Fang",energy:3,baseDmg:60,desc:"+60 if defender ≤120 HP",fx:"finishingFang"}]},
  {name:"Mega Blaziken",types:["Fire","Fighting"],cost:5,hp:210,weakness:["Water","Flying"],resistance:["Grass","Steel"],
    ability:{name:"Mega Speed",desc:"Grant self +1 energy (1/turn)",type:"active",key:"megaSpeed"},
    attacks:[{name:"Inferno Kick",energy:2,baseDmg:110,desc:"Lose 1 energy, Burn",fx:"selfEnergyLoss:1,burn"}]},
  {name:"Meowth",types:["Normal"],cost:2,hp:130,weakness:[],resistance:["Ghost"],
    attacks:[{name:"Pay Day",energy:2,baseDmg:20,desc:"Gain 1 mana",fx:"gainMana:1"}]},
  {name:"Mismagius",types:["Ghost"],cost:4,hp:200,weakness:["Dark"],resistance:["Normal"],
    ability:{name:"Magic Drain",desc:"Spend 1 mana: opp loses 1 mana (unlimited)",type:"active",key:"magicDrain"},
    attacks:[{name:"Hex Burn",energy:2,baseDmg:70,desc:"Burn if defender has status",fx:"hexBurn"}]},
  {name:"Psyduck",types:["Water"],cost:2,hp:140,weakness:["Electric"],resistance:["Fire"],
    attacks:[{name:"Confusion Wave",energy:2,baseDmg:60,desc:"Both actives confused",fx:"confuseBoth"}]},
];

const ITEM_DB = [
  {name:"Assault Vest",desc:"-20 damage taken",key:"assaultVest"},
  {name:"Burn Scarf",desc:"Attacked: 10 dmg + Burn",key:"burnScarf"},
  {name:"Expert Belt",desc:"2× weakness (not 1.5×)",key:"expertBelt"},
  {name:"Filter Shield",desc:"Immune to resisted types",key:"filterShield"},
  {name:"Float Stone",desc:"Quick Retreat -1 energy",key:"floatStone"},
  {name:"Focus Sash",desc:"Survive KO at 10 HP",key:"focusSash",oneTime:true},
  {name:"Health Charm",desc:"+50 HP",key:"healthCharm"},
  {name:"Healing Scarf",desc:"Heal 20 per energy gained",key:"healingScarf"},
  {name:"Leftovers",desc:"Heal 10 per turn",key:"leftovers"},
  {name:"Life Orb",desc:"+30 damage, 10 recoil",key:"lifeOrb"},
  {name:"Loud Bell",desc:"Attacked: 10 dmg + Confuse",key:"loudBell"},
  {name:"Lucky Punch",desc:"50%: +20 dmg + Normal weak",key:"luckyPunch"},
  {name:"Lum Berry",desc:"Cure status + heal 30",key:"lumBerry",oneTime:true},
  {name:"Muscle Band",desc:"+20 damage",key:"muscleBand"},
  {name:"Pierce Scope",desc:"Normal=weak to your type",key:"pierceScope"},
  {name:"Poison Barb",desc:"Attacked: 10 dmg + Poison",key:"poisonBarb"},
  {name:"Power Herb",desc:"Deploy: +1 energy",key:"powerHerb",oneTime:true},
  {name:"Protect Goggles",desc:"Block non-dmg effects",key:"protectGoggles"},
  {name:"Quick Claw",desc:"1st attack -2 energy",key:"quickClaw",oneTime:true},
  {name:"Rescue Scarf",desc:"Return to hand on KO",key:"rescueScarf"},
  {name:"Rocky Helmet",desc:"Attacked: 30 dmg back",key:"rockyHelmet"},
  {name:"Shell Bell",desc:"Heal 30 when attacking",key:"shellBell"},
  {name:"Sitrus Berry",desc:"At 100+ dmg: heal 60",key:"sitrusBerry",oneTime:true},
  {name:"White Herb",desc:"Prevent 2 energy loss",key:"whiteHerb",oneTime:true},
  {name:"Wide Shield",desc:"Active: team -10 dmg",key:"wideShield"},
];

function mergeExternalData(externalData) {
  if (!externalData) return;
  externalData.forEach(function(ext) {
    var entry = POKEMON_DB.find(function(p) { return p.name === ext.name; });
    if (entry) {
      entry.types = ext.types;
      entry.cost = ext.cost;
      entry.hp = ext.hp;
      entry.weakness = ext.weakness;
      entry.resistance = ext.resistance;
    }
  });
}

// ============================================================
// HELPERS
// ============================================================
function getPokemonData(name) { return POKEMON_DB.find(function(p) { return p.name === name; }); }
function getItemData(name) { return ITEM_DB.find(function(i) { return i.name === name; }); }
function oppPlayer(p) { return p === 1 ? 2 : 1; }
function cp(G) { return G.players[G.currentPlayer]; }
function op(G) { return G.players[oppPlayer(G.currentPlayer)]; }

function addLog(G, text, cls) {
  cls = cls || '';
  G.log.unshift({ text: text, cls: cls, turn: G.turn });
  if (G.log.length > 100) G.log.pop();
  G.events.push({ type: 'log', text: text, cls: cls });
}

function isNeutralizingGasActive(G) {
  var all = [G.players[1].active, G.players[2].active]
    .concat(G.players[1].bench).concat(G.players[2].bench).filter(Boolean);
  return all.some(function(pk) {
    var d = getPokemonData(pk.name);
    return d.ability && d.ability.key === 'neutralizingGas';
  });
}
function isPassiveBlocked(G) { return isNeutralizingGasActive(G); }

function makePokemon(name, heldItem) {
  var data = getPokemonData(name);
  var maxHp = data.hp + (heldItem === 'Health Charm' ? 50 : 0);
  var energy = heldItem === 'Power Herb' ? 1 : 0;
  var actualItem = heldItem === 'Power Herb' ? null : heldItem;
  return {
    name: name, maxHp: maxHp, hp: maxHp, energy: energy,
    heldItem: actualItem, heldItemUsed: heldItem === 'Power Herb',
    status: [], damage: 0, shields: [], sustained: false, attackedThisTurn: false, cantUseAttack: null,
    vulnerability: 0, quickClawActive: heldItem === 'Quick Claw',
    grassWeakUntil: 0, improviseActive: false,
  };
}

// ============================================================
// GAME STATE
// ============================================================
function createGame() {
  return {
    phase: 'deckBuild',
    currentPlayer: 1,
    turn: 0,
    players: {
      1: { name: 'Player 1', mana: 0, kos: 0, deck: [], hand: [], active: null, bench: [], usedAbilities: {}, ready: false },
      2: { name: 'Player 2', mana: 0, kos: 0, deck: [], hand: [], active: null, bench: [], usedAbilities: {}, ready: false },
    },
    log: [],
    events: [],
    targeting: null,
    pendingRetreats: [],
    winner: null,
  };
}

// ============================================================
// DAMAGE CALC
// ============================================================
function calcWeaknessResistance(G, attackerTypes, defender) {
  var defData = getPokemonData(defender.name);
  var weaknesses = defData.weakness.slice();
  var resistances = defData.resistance.slice();

  if (defender.grassWeakUntil > G.turn) {
    if (weaknesses.indexOf('Grass') === -1) weaknesses.push('Grass');
  }

  // Pierce Scope
  var p = cp(G);
  if (p.active && p.active.heldItem === 'Pierce Scope') {
    if (defData.types.indexOf('Normal') >= 0) {
      var attData = getPokemonData(p.active.name);
      attData.types.forEach(function(t) { if (weaknesses.indexOf(t) === -1) weaknesses.push(t); });
    }
  }

  var hasWeak = false, hasResist = false;
  attackerTypes.forEach(function(atkType) {
    if (weaknesses.indexOf(atkType) >= 0) hasWeak = true;
    if (resistances.indexOf(atkType) >= 0) hasResist = true;
  });

  if (hasWeak && hasResist) return 1.0;
  if (hasWeak) return 1.5;
  if (hasResist) return 0.5;
  return 1.0;
}

function calcDamage(G, attacker, defender, attack, attackerTypes, defenderOwner) {
  // Derive relationship from defender's owner
  var isOpponent = defenderOwner !== G.currentPlayer;
  var isOppActive = isOpponent && defender === op(G).active;

  var baseDmg = attack.baseDmg;
  var fx = attack.fx || '';

  if (fx.indexOf('scaleDef:') >= 0) { baseDmg += parseInt(fx.split('scaleDef:')[1]) * defender.energy; }
  if (fx.indexOf('scaleBoth:') >= 0) { baseDmg += parseInt(fx.split('scaleBoth:')[1]) * (attacker.energy + defender.energy); }
  if (fx.indexOf('scaleOwn:') >= 0) { baseDmg += parseInt(fx.split('scaleOwn:')[1]) * attacker.energy; }
  if (fx.indexOf('scaleBench:') >= 0) { baseDmg += parseInt(fx.split('scaleBench:')[1]) * cp(G).bench.length; baseDmg = Math.min(baseDmg, 140); }
  if (fx.indexOf('sustained:') >= 0 && attacker.sustained) { baseDmg += parseInt(fx.split('sustained:')[1]); }
  if (fx.indexOf('berserk') >= 0) { baseDmg += attacker.damage; }
  if (fx.indexOf('bonusDmg:') >= 0) { var parts = fx.split('bonusDmg:')[1].split(':'); if (defender.damage >= parseInt(parts[0])) baseDmg += parseInt(parts[1]); }
  if (fx.indexOf('fullHpBonus:') >= 0) { if (defender.damage === 0) baseDmg += parseInt(fx.split('fullHpBonus:')[1]); }
  if (fx.indexOf('payback:') >= 0) { if (attacker.damage >= 100) baseDmg += parseInt(fx.split('payback:')[1]); }
  if (fx.indexOf('scaleDefNeg:') >= 0) { baseDmg -= parseInt(fx.split('scaleDefNeg:')[1]) * defender.energy; baseDmg = Math.max(0, baseDmg); }

  if (baseDmg <= 0) return { damage: 0, mult: 1 };

  // Item damage bonuses - Muscle Band/Life Orb/Lucky Punch only vs opponent's active
  var luckyProc = false;
  if (isOppActive) {
    if (attacker.heldItem === 'Muscle Band') baseDmg += 20;
    if (attacker.heldItem === 'Life Orb') baseDmg += 30;
    if (attacker.heldItem === 'Lucky Punch' && Math.random() < 0.5) { baseDmg += 20; luckyProc = true; }
  }

  var ignoreRes = fx.indexOf('ignoreRes') >= 0;
  // Lucky Punch: add Normal type for weakness calc
  var effectiveTypes = attackerTypes;
  if (luckyProc && attackerTypes.indexOf('Normal') < 0) effectiveTypes = attackerTypes.concat(['Normal']);
  var mult = calcWeaknessResistance(G, effectiveTypes, defender);
  if (ignoreRes && mult < 1) mult = 1.0;
  // Expert Belt: 2x instead of 1.5x - applies to ALL opponent's Pokemon
  if (isOpponent && attacker.heldItem === 'Expert Belt' && mult === 1.5) mult = 2.0;

  var totalDmg = Math.floor(baseDmg * mult);

  var reduction = 0;
  var defAbility = getPokemonData(defender.name).ability;
  if (defAbility && defAbility.key && defAbility.key.indexOf('damageReduce:') === 0 && !isPassiveBlocked(G))
    reduction += parseInt(defAbility.key.split(':')[1]);
  if (defender.heldItem === 'Assault Vest') reduction += 20;

  var defPlayerObj = op(G);
  var allDefPokemon = [defPlayerObj.active].concat(defPlayerObj.bench).filter(Boolean);
  if (!isPassiveBlocked(G) && allDefPokemon.some(function(p2) {
    var d = getPokemonData(p2.name);
    return d.ability && d.ability.key === 'auroraVeil';
  })) reduction += 10;

  if (defPlayerObj.active && defPlayerObj.active.heldItem === 'Wide Shield') reduction += 10;
  if (defender.shields.length > 0) { reduction += defender.shields.reduce(function(s,v){return s+v;}, 0); }

  totalDmg = Math.max(0, totalDmg - reduction);
  if (defender.heldItem === 'Filter Shield' && mult < 1) totalDmg = 0;
  if (defAbility && defAbility.key === 'filter' && totalDmg > 0 && totalDmg <= 50 && !isPassiveBlocked(G))
    return { damage: 0, mult: mult, filtered: true };

  return { damage: totalDmg, mult: mult, luckyProc: luckyProc, reduction: reduction };
}

// ============================================================
// DEAL DAMAGE & KO
// ============================================================
function dealDamage(G, pokemon, amount, playerNum) {
  if (amount <= 0) return false;
  pokemon.damage += amount;
  pokemon.hp = pokemon.maxHp - pokemon.damage;

  if (pokemon.hp <= 0 && pokemon.heldItem === 'Focus Sash' && !pokemon.heldItemUsed && (pokemon.maxHp - (pokemon.damage - amount)) >= 100) {
    pokemon.damage = pokemon.maxHp - 10;
    pokemon.hp = 10;
    pokemon.heldItemUsed = true;
    pokemon.heldItem = null;
    addLog(G, 'Focus Sash saves ' + pokemon.name + '! (Discarded)', 'effect');
    return false;
  }

  if (!pokemon.heldItemUsed && pokemon.heldItem === 'Sitrus Berry' && pokemon.damage >= 100 && pokemon.hp > 0) {
    pokemon.damage = Math.max(0, pokemon.damage - 60);
    pokemon.hp = pokemon.maxHp - pokemon.damage;
    pokemon.heldItemUsed = true;
    pokemon.heldItem = null;
    addLog(G, 'Sitrus Berry heals ' + pokemon.name + ' for 60! (Discarded)', 'heal');
  }

  if (pokemon.hp <= 0) {
    pokemon.hp = 0;
    return true;
  }
  return false;
}

function handleKO(G, pokemon, ownerPlayerNum) {
  var owner = G.players[ownerPlayerNum];
  var scorer = G.players[oppPlayer(ownerPlayerNum)];
  scorer.kos++;
  addLog(G, pokemon.name + ' is KO\'d! (' + scorer.name + ': ' + scorer.kos + '/5 KOs)', 'ko');
  G.events.push({ type: 'ko', targetPlayer: ownerPlayerNum, targetIdx: -1, pokemonName: pokemon.name });

  if (pokemon.heldItem === 'Rescue Scarf') {
    owner.hand.push({ name: pokemon.name, type: 'pokemon', heldItem: null });
    addLog(G, 'Rescue Scarf returns ' + pokemon.name + ' to hand!', 'effect');
  }

  if (scorer.kos >= 5) {
    G.winner = scorer.name;
    G.events.push({ type: 'win', player: scorer.name });
    return;
  }

  if (owner.active === pokemon) {
    owner.active = null;
    if (owner.bench.length > 0) {
      G.pendingRetreats.push({ player: ownerPlayerNum, reason: 'ko' });
      addLog(G, owner.name + ' must choose new Active!', 'info');
    }
  } else {
    owner.bench = owner.bench.filter(function(p2) { return p2 !== pokemon; });
  }
}

// Find which bench idx a pokemon is at, or -1 for active
function findPokemonIdx(G, pokemon, playerNum) {
  var p = G.players[playerNum];
  if (p.active === pokemon) return -1;
  return p.bench.indexOf(pokemon);
}

// ============================================================
// TURN MANAGEMENT
// ============================================================
function startTurn(G) {
  var p = cp(G);
  p.mana = Math.min(10, p.mana + 2);
  p.usedAbilities = {};
  if (p.active) p.active.improviseActive = false;
  G.targeting = null;

  var allPokemon = [p.active].concat(p.bench).filter(Boolean);
  allPokemon.forEach(function(pk) { pk.shields = []; pk.vulnerability = 0; pk.cantUseAttack = null; });

  // Berry Juice Sip
  allPokemon.forEach(function(pk) {
    var d = getPokemonData(pk.name);
    if (d.ability && d.ability.key === 'berryJuice' && pk.damage > 0 && !isPassiveBlocked(G)) {
      pk.damage = Math.max(0, pk.damage - 20);
      pk.hp = pk.maxHp - pk.damage;
      addLog(G, 'Berry Juice heals ' + pk.name + ' 20', 'heal');
    }
  });

  // Lum Berry
  allPokemon.forEach(function(pk) {
    if (pk.heldItem === 'Lum Berry' && !pk.heldItemUsed && pk.status.length > 0) {
      pk.status = [];
      pk.damage = Math.max(0, pk.damage - 30);
      pk.hp = pk.maxHp - pk.damage;
      pk.heldItemUsed = true;
      pk.heldItem = null;
      addLog(G, 'Lum Berry cures ' + pk.name + '! (Discarded)', 'heal');
    }
  });

  // (Vileplume Poison Fumes is now an active ability, triggered by player)

  addLog(G, '--- ' + p.name + ' Turn ' + G.turn + ' ---', 'info');
  G.events.push({ type: 'turn_start', player: G.currentPlayer, turn: G.turn });
}

function endTurn(G) {
  var p = cp(G);

  // Suicune Aqua Ring
  var allMine = [p.active].concat(p.bench).filter(Boolean);
  allMine.forEach(function(pk) {
    var d = getPokemonData(pk.name);
    if (d.ability && d.ability.key === 'aquaRing' && pk === p.active && !isPassiveBlocked(G)) {
      var target = op(G).active;
      if (target && target.energy > 0 && !(target.heldItem === 'Protect Goggles')) {
        target.energy = Math.max(0, target.energy - 1);
        addLog(G, 'Aqua Ring strips 1 energy from ' + target.name, 'effect');
      }
    }
  });

  // Sustained tracking: copy attackedThisTurn into sustained, then clear it
  // This way sustained is only true if the pokemon attacked on THIS turn,
  // giving the bonus on the NEXT turn's attack only
  if (p.active) {
    p.active.sustained = p.active.attackedThisTurn;
    p.active.attackedThisTurn = false;
  }

  // Status ticks for both players' actives
  var sides = [
    { side: p, num: G.currentPlayer },
    { side: op(G), num: oppPlayer(G.currentPlayer) }
  ];
  for (var si = 0; si < sides.length; si++) {
    var entry = sides[si];
    var pk = entry.side.active;
    if (!pk) continue;
    if (pk.hp <= 0) continue; // Skip dead pokemon (e.g. double KO)
    var ownerNum = entry.num;

    // Poison
    if (pk.status.includes('poison')) {
      var ko = dealDamage(G, pk, 10, ownerNum);
      addLog(G, 'Poison deals 10 to ' + pk.name, 'damage');
      G.events.push({ type: 'status_tick', targetPlayer: ownerNum, targetIdx: -1, status: 'poison', damage: 10 });
      if (ko) handleKO(G, pk, ownerNum);
    }

    // Burn
    if (pk.hp > 0 && pk.status.includes('burn')) {
      var ko2 = dealDamage(G, pk, 20, ownerNum);
      addLog(G, 'Burn deals 20 to ' + pk.name, 'damage');
      G.events.push({ type: 'status_tick', targetPlayer: ownerNum, targetIdx: -1, status: 'burn', damage: 20 });
      if (ko2) handleKO(G, pk, ownerNum);
      if (pk.hp > 0 && pk.status.includes('burn') && Math.random() < 0.5) {
        pk.status = pk.status.filter(function(s) { return s !== 'burn'; });
        addLog(G, pk.name + '\'s burn healed! (Heads)', 'heal');
        G.events.push({ type: 'status_cure', targetPlayer: ownerNum, targetIdx: -1 });
      } else if (pk.hp > 0 && pk.status.includes('burn')) {
        addLog(G, pk.name + ' is still Burned (Tails)', 'info');
      }
    }

    // Sleep (only if alive)
    if (pk.hp > 0 && pk.status.includes('sleep')) {
      if (Math.random() < 0.5) {
        pk.status = pk.status.filter(function(s) { return s !== 'sleep'; });
        addLog(G, pk.name + ' woke up! (Heads)', 'info');
        G.events.push({ type: 'status_cure', targetPlayer: ownerNum, targetIdx: -1 });
      } else {
        addLog(G, pk.name + ' is still Asleep! (Tails)', 'info');
      }
    }
  }

  // Leftovers: heal 10 after each player's turn (both players' pokemon)
  var allPokemonBoth = [p.active].concat(p.bench).concat([op(G).active]).concat(op(G).bench).filter(Boolean);
  for (var li = 0; li < allPokemonBoth.length; li++) {
    var lpk = allPokemonBoth[li];
    if (lpk.heldItem === 'Leftovers' && lpk.damage > 0 && lpk.hp > 0) {
      lpk.damage = Math.max(0, lpk.damage - 10);
      lpk.hp = lpk.maxHp - lpk.damage;
      addLog(G, 'Leftovers heals ' + lpk.name + ' 10', 'heal');
    }
  }

  // If status ticks caused KOs that need retreat selection, mark them so endTurn resumes after
  if (G.pendingRetreats.length > 0) {
    for (var ri = 0; ri < G.pendingRetreats.length; ri++) {
      G.pendingRetreats[ri].duringEndTurn = true;
    }
    return;
  }

  // Switch player
  switchTurn(G);
}

function switchTurn(G) {
  G.currentPlayer = oppPlayer(G.currentPlayer);
  G.turn++;
  G.events.push({ type: 'turn_overlay', text: G.players[G.currentPlayer].name + "'s Turn" });
  startTurn(G);
}

// ============================================================
// ATTACK EFFECTS (processAttackFx equivalent - sync, no DOM)
// ============================================================
function processAttackFx(G, fx, attacker, defender, attack, attackerTypes, action) {
  var attackerData = getPokemonData(attacker.name);
  if (!attackerTypes) attackerTypes = attackerData.types;
  var p = cp(G);

  // Status effects
  if (fx.indexOf('poison') >= 0 && defender && defender.hp > 0 && !(defender.heldItem === 'Protect Goggles') && !defender.status.includes('poison')) {
    defender.status.push('poison');
    addLog(G, defender.name + ' is Poisoned!', 'effect');
    G.events.push({ type: 'status_apply', targetPlayer: oppPlayer(G.currentPlayer), targetIdx: -1, status: 'poison' });
  }
  if (fx.indexOf('burn') >= 0 && fx.indexOf('hexBurn') < 0 && defender && defender.hp > 0 && !(defender.heldItem === 'Protect Goggles') && !defender.status.includes('burn')) {
    defender.status.push('burn');
    addLog(G, defender.name + ' is Burned!', 'effect');
    G.events.push({ type: 'status_apply', targetPlayer: oppPlayer(G.currentPlayer), targetIdx: -1, status: 'burn' });
  }
  if (fx.indexOf('sleep') >= 0 && defender && defender.hp > 0 && !(defender.heldItem === 'Protect Goggles') && !defender.status.includes('sleep')) {
    defender.status.push('sleep');
    addLog(G, defender.name + ' fell Asleep!', 'effect');
    G.events.push({ type: 'status_apply', targetPlayer: oppPlayer(G.currentPlayer), targetIdx: -1, status: 'sleep' });
  }

  // Energy strip
  if (fx.indexOf('stripEnergy:') >= 0 && defender && defender.hp > 0) {
    var v = parseInt(fx.split('stripEnergy:')[1]);
    var actual = Math.min(v, defender.energy);
    if (defender.heldItem === 'White Herb' && !defender.heldItemUsed) {
      var prevented = Math.min(actual, 2);
      defender.energy -= Math.max(0, actual - prevented);
      defender.heldItemUsed = true; defender.heldItem = null;
      addLog(G, 'White Herb prevents energy loss! (Discarded)', 'effect');
    } else {
      defender.energy = Math.max(0, defender.energy - v);
    }
    addLog(G, 'Stripped ' + actual + ' energy from ' + defender.name, 'effect');
  }

  // Self damage (no item bonuses since not hitting opp active)
  if (fx.indexOf('selfDmg:') >= 0) {
    var sv = parseInt(fx.split('selfDmg:')[1]);
    var selfAtk = Object.assign({}, attack, { baseDmg: sv });
    var selfRes = calcDamage(G, attacker, attacker, selfAtk, attackerData.types, G.currentPlayer);
    if (selfRes.filtered) { addLog(G, attacker.name + '\'s Filter blocks the recoil!', 'effect'); }
    else if (selfRes.damage > 0) { dealDamage(G, attacker, selfRes.damage, G.currentPlayer); }
  }
  if (fx.indexOf('selfEnergyLoss:') >= 0) {
    var elv = parseInt(fx.split('selfEnergyLoss:')[1]);
    if (elv >= 99) elv = attacker.energy;
    if (attacker.heldItem === 'White Herb' && !attacker.heldItemUsed) {
      elv = Math.max(0, elv - 2); attacker.heldItemUsed = true; attacker.heldItem = null;
      addLog(G, 'White Herb saves 2 energy! (Discarded)', 'effect');
    }
    attacker.energy = Math.max(0, attacker.energy - elv);
  }

  if (fx.indexOf('selfShield:') >= 0) { attacker.shields.push(parseInt(fx.split('selfShield:')[1])); }
  if (fx.indexOf('selfVuln:') >= 0) { attacker.vulnerability = parseInt(fx.split('selfVuln:')[1]); }
  if (fx.indexOf('selfSleep') >= 0 && !attacker.status.includes('sleep')) { attacker.status.push('sleep'); addLog(G, attacker.name + ' fell asleep!', 'effect'); }

  // Self retreat
  if (fx.indexOf('selfRetreat') >= 0 && p.bench.length > 0) {
    G.pendingRetreats.push({ player: G.currentPlayer, reason: 'forced', afterEndTurn: true });
    return 'pendingRetreat';
  }

  // Force switch opponent
  if (fx.indexOf('forceSwitch') >= 0 && op(G).bench.length > 0 && defender && defender.hp > 0) {
    var newActive = op(G).bench.shift();
    if (op(G).active.status.length > 0) { addLog(G, op(G).active.name + '\'s ' + op(G).active.status.join(', ') + ' was cured on bench!', 'heal'); op(G).active.status = []; }
    op(G).bench.push(op(G).active);
    op(G).active = newActive;
    addLog(G, defender.name + ' was forced to switch!', 'info');
    G.events.push({ type: 'retreat', player: oppPlayer(G.currentPlayer) });
  }

  // Bench damage
  if (fx.indexOf('benchAll:') >= 0) {
    var bav = parseInt(fx.split('benchAll:')[1]);
    var benchAllAtk = Object.assign({}, attack, { baseDmg: bav });
    p.bench.concat(op(G).bench).forEach(function(bpk) {
      var ownerNum = p.bench.indexOf(bpk) >= 0 ? G.currentPlayer : oppPlayer(G.currentPlayer);
      var res = calcDamage(G, attacker, bpk, benchAllAtk, attackerData.types, ownerNum);
      if (res.filtered) { addLog(G, bpk.name + '\'s Filter blocks the damage!', 'effect'); return; }
      if (res.damage > 0) {
        var bko = dealDamage(G, bpk, res.damage, ownerNum);
        if (bko) handleKO(G, bpk, ownerNum);
      }
    });
    addLog(G, 'Bench damage to all benches', 'damage');
  }
  if (fx.indexOf('oppBenchDmg:') >= 0) {
    var obv = parseInt(fx.split('oppBenchDmg:')[1]);
    var oppBenchAtk = Object.assign({}, attack, { baseDmg: obv });
    op(G).bench.slice().forEach(function(bpk) {
      var res = calcDamage(G, attacker, bpk, oppBenchAtk, attackerData.types, oppPlayer(G.currentPlayer));
      if (res.filtered) { addLog(G, bpk.name + '\'s Filter blocks the damage!', 'effect'); return; }
      if (res.damage > 0) {
        var bko = dealDamage(G, bpk, res.damage, oppPlayer(G.currentPlayer));
        if (bko) handleKO(G, bpk, oppPlayer(G.currentPlayer));
      }
    });
  }

  // Sniper bench targeting
  if (fx.indexOf('sniperBench:') >= 0) {
    var sbv = parseInt(fx.split('sniperBench:')[1]);
    var allTargets = [];
    op(G).bench.forEach(function(bpk, bi) { if (bpk.hp > 0) allTargets.push({ player: oppPlayer(G.currentPlayer), idx: bi, pk: bpk }); });
    cp(G).bench.forEach(function(bpk, bi) { if (bpk.hp > 0) allTargets.push({ player: G.currentPlayer, idx: bi, pk: bpk }); });
    if (allTargets.length > 0) {
      G.targeting = {
        type: 'sniperBench',
        validTargets: allTargets.map(function(t) { return { player: t.player, idx: t.idx }; }),
        context: { attack: Object.assign({}, attack, { baseDmg: sbv }), attackerTypes: attackerTypes }
      };
      return 'pendingTarget';
    }
  }

  if (fx.indexOf('selfBenchDmg:') >= 0) {
    var sbdv = parseInt(fx.split('selfBenchDmg:')[1]);
    if (p.bench.length > 0) {
      var sbTarget = p.bench[0];
      var sbAtk = Object.assign({}, attack, { baseDmg: sbdv });
      var sbRes = calcDamage(G, attacker, sbTarget, sbAtk, attackerData.types, G.currentPlayer);
      if (sbRes.filtered) { addLog(G, sbTarget.name + '\'s Filter blocks the damage!', 'effect'); }
      else if (sbRes.damage > 0) {
        dealDamage(G, sbTarget, sbRes.damage, G.currentPlayer);
        addLog(G, 'Collateral: ' + sbRes.damage + ' to ' + sbTarget.name, 'damage');
      }
    }
  }

  // Grass weakness
  if (fx.indexOf('grassWeakness') >= 0) {
    addLog(G, 'Forest\'s Curse: all opponents gain Grass weakness!', 'effect');
    var oppPokemon = [op(G).active].concat(op(G).bench).filter(Boolean);
    oppPokemon.forEach(function(opk) { opk.grassWeakUntil = G.turn + 2; });
  }

  if (fx.indexOf('oppMana:') >= 0) {
    var omv = parseInt(fx.split('oppMana:')[1]);
    op(G).mana = Math.max(0, op(G).mana + omv);
    addLog(G, 'Opponent lost ' + Math.abs(omv) + ' mana', 'effect');
  }

  if (fx.indexOf('healSelf:') >= 0) {
    var hsv = parseInt(fx.split('healSelf:')[1]);
    attacker.damage = Math.max(0, attacker.damage - hsv);
    attacker.hp = attacker.maxHp - attacker.damage;
    addLog(G, attacker.name + ' healed ' + hsv, 'heal');
  }

  if (fx.indexOf('lockAttack') >= 0) { attacker.cantUseAttack = attack.name; }

  // Mad Party
  if (fx === 'madParty' && defender) {
    var totalPokemon = [p.active].concat(p.bench).concat([op(G).active]).concat(op(G).bench).filter(Boolean).length;
    var madAtk = Object.assign({}, attack, { baseDmg: totalPokemon * 10 });
    var madResult = calcDamage(G, attacker, defender, madAtk, attackerData.types, oppPlayer(G.currentPlayer));
    if (madResult.filtered) {
      addLog(G, defender.name + '\'s Filter blocks the damage!', 'effect');
    } else if (madResult.damage > 0) {
      var madKo = dealDamage(G, defender, madResult.damage, oppPlayer(G.currentPlayer));
      addLog(G, 'Mad Party: ' + totalPokemon + ' Pokémon = ' + madResult.damage + ' damage!', 'damage');
      G.events.push({ type: 'damage', targetPlayer: oppPlayer(G.currentPlayer), targetIdx: -1, amount: madResult.damage, mult: madResult.mult });
      if (madKo) handleKO(G, defender, oppPlayer(G.currentPlayer));
    }
  }

  // Finishing Fang
  if (fx === 'finishingFang' && defender && defender.hp > 0 && defender.hp <= 120) {
    var fangAtk = Object.assign({}, attack, { baseDmg: 60 });
    var fangResult = calcDamage(G, attacker, defender, fangAtk, attackerData.types, oppPlayer(G.currentPlayer));
    if (fangResult.filtered) {
      addLog(G, defender.name + '\'s Filter blocks the bonus damage!', 'effect');
    } else if (fangResult.damage > 0) {
      var fko = dealDamage(G, defender, fangResult.damage, oppPlayer(G.currentPlayer));
      addLog(G, 'Finishing Fang bonus: +' + fangResult.damage + ' (target low HP)!', 'damage');
      if (fko) handleKO(G, defender, oppPlayer(G.currentPlayer));
    }
  }

  // Hex Burn
  if (fx === 'hexBurn' && defender && defender.hp > 0 && defender.status.length > 0 && !(defender.heldItem === 'Protect Goggles')) {
    if (!defender.status.includes('burn')) defender.status.push('burn');
    addLog(G, 'Hex Burn: ' + defender.name + ' is now Burned!', 'effect');
  }

  // Confusion Wave
  if (fx === 'confuseBoth') {
    if (attacker.hp > 0 && !(attacker.heldItem === 'Protect Goggles') && !attacker.status.includes('confusion')) { attacker.status.push('confusion'); addLog(G, attacker.name + ' is Confused!', 'effect'); }
    if (defender && defender.hp > 0 && !(defender.heldItem === 'Protect Goggles') && !defender.status.includes('confusion')) { defender.status.push('confusion'); addLog(G, defender.name + ' is Confused!', 'effect'); }
  }

  // Swarm Snipe targeting
  if (fx === 'swarmSnipe') {
    var myCount = [p.active].concat(p.bench).filter(Boolean).length;
    var swarmBaseDmg = myCount * 10;
    var validTargets = [];
    [G.currentPlayer, oppPlayer(G.currentPlayer)].forEach(function(pNum) {
      var side = G.players[pNum];
      if (side.active && side.active.hp > 0) validTargets.push({ player: pNum, idx: -1 });
      side.bench.forEach(function(bpk, bi) { if (bpk.hp > 0) validTargets.push({ player: pNum, idx: bi }); });
    });
    if (validTargets.length > 0) {
      G.targeting = {
        type: 'swarmSnipe',
        validTargets: validTargets,
        context: { attack: Object.assign({}, attack, { baseDmg: swarmBaseDmg }), attackerTypes: attackerTypes }
      };
      return 'pendingTarget';
    }
  }

  // Conditional bench damage
  if (fx.indexOf('condBench:') >= 0 && op(G).bench.length > 0) {
    var cbParts = fx.split('condBench:')[1].split(':');
    var threshold = parseInt(cbParts[0]);
    var cbDmg = parseInt(cbParts[1]);
    if (attacker.energy >= threshold) {
      var condAtk = Object.assign({}, attack, { baseDmg: cbDmg });
      op(G).bench.slice().forEach(function(bpk) {
        var res = calcDamage(G, attacker, bpk, condAtk, attackerData.types, oppPlayer(G.currentPlayer));
        if (res.filtered) { addLog(G, bpk.name + '\'s Filter blocks the damage!', 'effect'); return; }
        if (res.damage > 0) {
          var cbko = dealDamage(G, bpk, res.damage, oppPlayer(G.currentPlayer));
          if (cbko) handleKO(G, bpk, oppPlayer(G.currentPlayer));
        }
      });
      addLog(G, 'Bench damage to each opponent bench (' + attacker.energy + ' energy)!', 'damage');
    }
  }

  // Optional boost (choice)
  if (action && action.useOptBoost && fx.indexOf('optBoost:') >= 0 && defender && defender.hp > 0) {
    var obParts = fx.split('optBoost:')[1].split(':');
    var extraDmg = parseInt(obParts[0]);
    var energyCost = parseInt(obParts[1]);
    if (attacker.energy >= energyCost) {
      attacker.energy -= energyCost;
      var boostAtk = Object.assign({}, attack, { baseDmg: extraDmg });
      var boostResult = calcDamage(G, attacker, defender, boostAtk, attackerData.types, oppPlayer(G.currentPlayer));
      if (boostResult.filtered) {
        addLog(G, defender.name + '\'s Filter blocks the bonus damage!', 'effect');
      } else if (boostResult.damage > 0) {
        var boko = dealDamage(G, defender, boostResult.damage, oppPlayer(G.currentPlayer));
        addLog(G, 'Boosted: +' + boostResult.damage + ' damage (lost ' + energyCost + ' energy)!', 'damage');
        if (boko) handleKO(G, defender, oppPlayer(G.currentPlayer));
      }
    }
  }

  // Any strip
  if (fx.indexOf('anyStrip:') >= 0) {
    var asv = parseInt(fx.split('anyStrip:')[1]);
    var asTargets = [op(G).active].concat(op(G).bench).filter(function(pk2) { return pk2 && pk2.energy > 0 && !(pk2.heldItem === 'Protect Goggles'); });
    if (asTargets.length > 0) {
      var asTarget = asTargets[0];
      var asActual = Math.min(asv, asTarget.energy);
      asTarget.energy = Math.max(0, asTarget.energy - asActual);
      addLog(G, 'Stripped ' + asActual + ' energy from ' + asTarget.name, 'effect');
    }
  }

  // Multi-target
  if (fx.indexOf('multiTarget:') >= 0) {
    var mtParts = fx.split('multiTarget:')[1].split(':');
    var mtDmg = parseInt(mtParts[0]);
    var mtCount = parseInt(mtParts[1]);
    var mtTargets = [op(G).active].concat(op(G).bench).filter(Boolean).slice(0, mtCount);
    var multiAtk = Object.assign({}, attack, { baseDmg: mtDmg });
    mtTargets.forEach(function(mtTarget) {
      var res = calcDamage(G, attacker, mtTarget, multiAtk, attackerData.types, oppPlayer(G.currentPlayer));
      if (res.filtered) { addLog(G, mtTarget.name + '\'s Filter blocks the damage!', 'effect'); return; }
      if (res.damage > 0) {
        var mtko = dealDamage(G, mtTarget, res.damage, oppPlayer(G.currentPlayer));
        addLog(G, res.damage + ' to ' + mtTarget.name, 'damage');
        if (mtko) handleKO(G, mtTarget, oppPlayer(G.currentPlayer));
      }
    });
    attacker.energy = Math.max(0, attacker.energy - 2);
  }

  // Baton Pass
  if (fx === 'batonPass' && p.bench.length > 0) {
    G.pendingRetreats.push({ player: G.currentPlayer, reason: 'batonPass', afterEndTurn: true, transferEnergy: attacker.energy });
    attacker.attackedThisTurn = true;
    return 'pendingRetreat';
  }

  return null;
}

// ============================================================
// ACTION HANDLERS
// ============================================================

// Pre-damage effects (selfEnergy, gainMana, benchEnergyAll, benchEnergy)
function processPreDamageEffects(G, fx, attacker, p) {
  if (fx.indexOf('selfEnergy:') >= 0) {
    var v = parseInt(fx.split('selfEnergy:')[1]);
    attacker.energy = Math.min(5, attacker.energy + v);
    if (attacker.heldItem === 'Healing Scarf' && attacker.damage > 0 && v > 0) {
      attacker.damage = Math.max(0, attacker.damage - 20 * v);
      attacker.hp = attacker.maxHp - attacker.damage;
      addLog(G, 'Healing Scarf heals ' + attacker.name + ' ' + (20*v), 'heal');
    }
  }
  if (fx.indexOf('gainMana:') >= 0) { var mv = parseInt(fx.split('gainMana:')[1]); p.mana = Math.min(10, p.mana + mv); addLog(G, 'Gained ' + mv + ' mana', 'info'); }
  if (fx.indexOf('benchEnergyAll') >= 0) {
    p.bench.forEach(function(pk) { if (pk.energy < 5) pk.energy++; });
    addLog(G, 'Gift Delivery: bench +1 energy each', 'info');
  }
  if (fx.indexOf('benchEnergy:') >= 0) {
    var beTarget = p.bench.find(function(pk) { return pk.energy < 5; });
    if (beTarget) { beTarget.energy++; addLog(G, beTarget.name + ' gained +1 energy', 'info'); }
  }
}

// Deal attack damage to defender + reactive items
function dealAttackDamageToDefender(G, attacker, defender, attack, attackerTypes, fx) {
  if (!defender) return false;
  var attackerData = getPokemonData(attacker.name);
  var needsDmg = attack.baseDmg > 0 || fx.indexOf('berserk') >= 0 || fx.indexOf('scaleDef') >= 0 ||
    fx.indexOf('scaleBoth') >= 0 || fx.indexOf('scaleOwn') >= 0 || fx.indexOf('scaleBench') >= 0 ||
    fx.indexOf('sustained') >= 0 || fx.indexOf('bonusDmg') >= 0 || fx.indexOf('fullHpBonus') >= 0 ||
    fx.indexOf('payback') >= 0 || fx.indexOf('scaleDefNeg') >= 0;

  if (!needsDmg) return false;

  var result = calcDamage(G, attacker, defender, attack, attackerTypes, oppPlayer(G.currentPlayer));
  var ko = false;

  if (result.filtered) {
    addLog(G, defender.name + '\'s Filter blocks the damage!', 'effect');
  } else if (result.damage > 0) {
    ko = dealDamage(G, defender, result.damage, oppPlayer(G.currentPlayer));
    var effText = '';
    if (result.mult > 1) effText = ' (Super Effective!)';
    if (result.mult < 1) effText = ' (Resisted)';
    var redText = result.reduction > 0 ? ' (-' + result.reduction + ' reduced)' : '';
    addLog(G, attack.name + ' deals ' + result.damage + ' to ' + defender.name + effText + redText, 'damage');
    G.events.push({ type: 'damage', targetPlayer: oppPlayer(G.currentPlayer), targetIdx: -1, amount: result.damage, mult: result.mult, attackName: attack.name });

    // Reactive items
    if (defender.heldItem === 'Rocky Helmet') {
      dealDamage(G, attacker, 30, G.currentPlayer);
      addLog(G, 'Rocky Helmet deals 30 back!', 'damage');
      G.events.push({ type: 'item_proc', item: 'Rocky Helmet', targetPlayer: oppPlayer(G.currentPlayer), targetIdx: -1 });
    }
    if (defender.heldItem === 'Burn Scarf' && !(attacker.heldItem === 'Protect Goggles')) {
      dealDamage(G, attacker, 10, G.currentPlayer);
      if (!attacker.status.includes('burn')) attacker.status.push('burn');
      addLog(G, 'Burn Scarf: 10 damage + Burn!', 'effect');
    }
    if (defender.heldItem === 'Poison Barb' && !(attacker.heldItem === 'Protect Goggles')) {
      dealDamage(G, attacker, 10, G.currentPlayer);
      if (!attacker.status.includes('poison')) attacker.status.push('poison');
      addLog(G, 'Poison Barb: 10 damage + Poison!', 'effect');
    }
    if (defender.heldItem === 'Loud Bell' && !(attacker.heldItem === 'Protect Goggles')) {
      dealDamage(G, attacker, 10, G.currentPlayer);
      if (!attacker.status.includes('confusion')) attacker.status.push('confusion');
      addLog(G, 'Loud Bell: 10 damage + Confusion!', 'effect');
    }

    // Shell Bell
    if (attacker.heldItem === 'Shell Bell') {
      attacker.damage = Math.max(0, attacker.damage - 30);
      attacker.hp = attacker.maxHp - attacker.damage;
      addLog(G, 'Shell Bell heals ' + attacker.name + ' 30', 'heal');
    }

    // Life Orb recoil
    if (attacker.heldItem === 'Life Orb') {
      dealDamage(G, attacker, 10, G.currentPlayer);
      addLog(G, 'Life Orb recoil: 10 to ' + attacker.name, 'damage');
    }

    if (ko) {
      G.events.push({ type: 'ko', targetPlayer: oppPlayer(G.currentPlayer), targetIdx: -1, pokemonName: defender.name });
      handleKO(G, defender, oppPlayer(G.currentPlayer));
    }
  } else {
    addLog(G, attack.name + ' dealt 0 damage', '');
  }
  return ko;
}

// Shared status check before any attack (regular or copied)
function checkStatusBeforeAttack(G, attacker) {
  if (attacker.status.includes('sleep')) {
    addLog(G, attacker.name + ' is Asleep and can\'t attack!', 'info');
    return 'blocked';
  }
  if (attacker.status.includes('confusion')) {
    if (Math.random() < 0.5) {
      attacker.status = attacker.status.filter(function(s) { return s !== 'confusion'; });
      addLog(G, attacker.name + ' snapped out of Confusion! (Heads)', 'info');
      return 'ok';
    } else {
      addLog(G, attacker.name + ' is Confused! Attack failed (Tails)', 'info');
      endTurn(G);
      return 'ended';
    }
  }
  return 'ok';
}

// Shared attack execution core — used by both doAttack and doCopiedAttack
function executeAttack(G, attacker, attack, attackerTypes, fx, action, logSuffix) {
  var p = cp(G);
  var defender = op(G).active;

  processPreDamageEffects(G, fx, attacker, p);

  addLog(G, attacker.name + ' uses ' + attack.name + '!' + (logSuffix || ''), 'info');
  G.events.push({ type: 'attack_declare', player: G.currentPlayer, attackName: attack.name });

  // Snipe targeting
  if (fx.indexOf('snipe') >= 0 && fx.indexOf('sniperBench') < 0 && fx.indexOf('swarmSnipe') < 0) {
    var validTargets = getAllValidTargets(G);
    if (validTargets.length > 0) {
      G.targeting = {
        type: 'snipe',
        validTargets: validTargets,
        context: { attack: Object.assign({}, attack), attackerTypes: attackerTypes, fx: fx }
      };
      return true;
    }
  }

  if (!defender) return false;

  // Deal damage
  dealAttackDamageToDefender(G, attacker, defender, attack, attackerTypes, fx);

  // Process fx
  var fxResult = processAttackFx(G, fx, attacker, defender, attack, attackerTypes, action);
  if (fxResult === 'pendingRetreat' || fxResult === 'pendingTarget') return true;

  attacker.attackedThisTurn = true;
  if (attacker.hp <= 0) handleKO(G, attacker, G.currentPlayer);

  if (G.pendingRetreats.length === 0 && !G.targeting && !G.winner) {
    endTurn(G);
  }
  return true;
}

function doAttack(G, attackIndex, action) {
  var p = cp(G);
  var attacker = p.active;
  if (!attacker) return false;
  var data = getPokemonData(attacker.name);

  // Defeatist check
  if (data.ability && data.ability.key === 'defeatist' && attacker.damage >= 120 && !isPassiveBlocked(G)) {
    addLog(G, attacker.name + ' can\'t attack (Defeatist)!', 'info');
    return false;
  }

  var statusResult = checkStatusBeforeAttack(G, attacker);
  if (statusResult === 'blocked') return false;
  if (statusResult === 'ended') return true;

  var attack = data.attacks[attackIndex];
  if (!attack) return false;

  // Energy cost with Quick Claw + Thick Aroma
  var energyCost = attack.energy;
  if (attacker.quickClawActive) energyCost = Math.max(0, energyCost - 2);
  var oppActive = op(G).active;
  if (oppActive && !isPassiveBlocked(G)) {
    var oppData = getPokemonData(oppActive.name);
    if (oppData.ability && oppData.ability.key === 'thickAroma') energyCost += 1;
  }
  if (attacker.energy < energyCost) return false;

  // Locked attack check
  if (attacker.cantUseAttack === attack.name) {
    addLog(G, 'Can\'t use ' + attack.name + ' this turn!', 'info');
    return false;
  }

  // Consume Quick Claw
  if (attacker.quickClawActive) {
    attacker.quickClawActive = false;
    attacker.heldItemUsed = true;
    attacker.heldItem = null;
    addLog(G, 'Quick Claw activated! (Discarded)', 'effect');
  }

  return executeAttack(G, attacker, attack, data.types, attack.fx || '', action);
}

function doCopiedAttack(G, sourceName, attackIndex, action) {
  var p = cp(G);
  var attacker = p.active;
  if (!attacker) return false;
  var attData = getPokemonData(attacker.name);

  // Validate source
  var sourceData = getPokemonData(sourceName);
  if (!sourceData) return false;

  var isVersatility = attData.ability && attData.ability.key === 'versatility' && !isPassiveBlocked(G);
  var isImprovise = attacker.improviseActive;

  if (isVersatility) {
    var onBench = p.bench.some(function(bpk) { return bpk.name === sourceName; });
    if (!onBench) return false;
  } else if (isImprovise) {
    if (!op(G).active || op(G).active.name !== sourceName) return false;
  } else {
    return false;
  }

  var attack = sourceData.attacks[attackIndex];
  if (!attack) return false;

  var statusResult = checkStatusBeforeAttack(G, attacker);
  if (statusResult === 'blocked') return false;
  if (statusResult === 'ended') return true;

  // Energy check with Thick Aroma (no Quick Claw for copied attacks)
  var energyCost = attack.energy;
  var oppActive = op(G).active;
  if (oppActive && !isPassiveBlocked(G)) {
    var oppData = getPokemonData(oppActive.name);
    if (oppData.ability && oppData.ability.key === 'thickAroma') energyCost += 1;
  }
  if (attacker.energy < energyCost) return false;

  // Use ATTACKER's types for weakness/resistance, not source's
  return executeAttack(G, attacker, attack, attData.types, attack.fx || '', action, ' (copied)');
}

function getAllValidTargets(G) {
  var targets = [];
  [G.currentPlayer, oppPlayer(G.currentPlayer)].forEach(function(pNum) {
    var side = G.players[pNum];
    if (side.active && side.active.hp > 0) targets.push({ player: pNum, idx: -1 });
    side.bench.forEach(function(pk, bi) { if (pk.hp > 0) targets.push({ player: pNum, idx: bi }); });
  });
  return targets;
}

function doSelectTarget(G, targetPlayer, targetBenchIdx) {
  if (!G.targeting) return false;
  var side = G.players[targetPlayer];
  var targetPk = targetBenchIdx === -1 ? side.active : side.bench[targetBenchIdx];
  if (!targetPk) return false;

  var valid = G.targeting.validTargets.some(function(t) { return t.player === targetPlayer && t.idx === targetBenchIdx; });
  if (!valid) return false;

  var ctx = G.targeting.context;
  var tType = G.targeting.type;
  G.targeting = null;

  var attacker = cp(G).active;
  if (!attacker) return false;
  var attackerData = getPokemonData(attacker.name);
  var attackerTypes = ctx.attackerTypes || attackerData.types;

  if (tType === 'snipe') {
    var snipeResult = calcDamage(G, attacker, targetPk, ctx.attack, attackerTypes, targetPlayer);
    if (snipeResult.filtered) {
      addLog(G, targetPk.name + '\'s Filter blocks the damage!', 'effect');
    } else if (snipeResult.damage > 0) {
      var sko = dealDamage(G, targetPk, snipeResult.damage, targetPlayer);
      addLog(G, ctx.attack.name + ' hits ' + targetPk.name + ' for ' + snipeResult.damage + '!', 'damage');
      if (snipeResult.mult > 1) addLog(G, 'Super Effective!', 'effect');
      if (snipeResult.mult < 1) addLog(G, 'Not very effective...', 'info');
      G.events.push({ type: 'damage', targetPlayer: targetPlayer, targetIdx: targetBenchIdx, amount: snipeResult.damage, mult: snipeResult.mult });
      if (sko) {
        G.events.push({ type: 'ko', targetPlayer: targetPlayer, targetIdx: targetBenchIdx, pokemonName: targetPk.name });
        handleKO(G, targetPk, targetPlayer);
      }
    }
    // Process remaining fx
    var fxResult = processAttackFx(G, ctx.fx, attacker, targetPk, ctx.attack, attackerTypes);
    if (fxResult === 'pendingRetreat' || fxResult === 'pendingTarget') return true;
  } else if (tType === 'sniperBench' || tType === 'swarmSnipe') {
    var result = calcDamage(G, attacker, targetPk, ctx.attack, attackerTypes, targetPlayer);
    if (result.filtered) {
      addLog(G, targetPk.name + '\'s Filter blocks the damage!', 'effect');
    } else if (result.damage > 0) {
      var tko = dealDamage(G, targetPk, result.damage, targetPlayer);
      addLog(G, result.damage + ' snipe to ' + targetPk.name, 'damage');
      if (result.mult > 1) addLog(G, 'Super Effective!', 'effect');
      if (result.mult < 1) addLog(G, 'Not very effective...', 'info');
      G.events.push({ type: 'damage', targetPlayer: targetPlayer, targetIdx: targetBenchIdx, amount: result.damage, mult: result.mult });
      if (tko) {
        G.events.push({ type: 'ko', targetPlayer: targetPlayer, targetIdx: targetBenchIdx, pokemonName: targetPk.name });
        handleKO(G, targetPk, targetPlayer);
      }
    }
  } else if (tType === 'softTouch') {
    targetPk.damage = Math.max(0, targetPk.damage - 10);
    targetPk.hp = targetPk.maxHp - targetPk.damage;
    cp(G).usedAbilities['softTouch'] = true;
    addLog(G, 'Egg Drop Heal: healed ' + targetPk.name + ' 10!', 'heal');
    G.events.push({ type: 'heal', targetPlayer: targetPlayer, targetIdx: targetBenchIdx, amount: 10 });
    return true; // No endTurn for abilities
  } else if (tType === 'creepingChill') {
    dealDamage(G, targetPk, 10, targetPlayer);
    cp(G).usedAbilities['creepingChill'] = true;
    addLog(G, 'Creeping Chill: 10 to ' + targetPk.name, 'damage');
    G.events.push({ type: 'damage', targetPlayer: targetPlayer, targetIdx: targetBenchIdx, amount: 10, mult: 1 });
    if (targetPk.hp <= 0) handleKO(G, targetPk, targetPlayer);
    return true; // No endTurn for abilities
  } else if (tType === 'yummyDelivery') {
    targetPk.energy++;
    cp(G).usedAbilities['yummyDelivery'] = true;
    addLog(G, 'Yummy Delivery: ' + targetPk.name + ' +1 energy', 'effect');
    G.events.push({ type: 'energy_gain', targetPlayer: targetPlayer, targetSlot: 'bench', benchIdx: targetBenchIdx });
    return true; // No endTurn for abilities
  } else if (tType === 'poisonFumes') {
    if (!targetPk.status.includes('poison') && !(targetPk.heldItem === 'Protect Goggles')) {
      targetPk.status.push('poison');
      cp(G).usedAbilities['poisonFumes'] = true;
      addLog(G, 'Poison Fumes poisons ' + targetPk.name + '!', 'effect');
      G.events.push({ type: 'status_apply', targetPlayer: targetPlayer, targetIdx: targetBenchIdx, status: 'poison' });
    } else {
      if (targetPk.heldItem === 'Protect Goggles') addLog(G, targetPk.name + '\'s Protect Goggles block it!', 'effect');
      else addLog(G, targetPk.name + ' already has a status!', 'info');
    }
    return true; // No endTurn for abilities
  }

  // Finalize attack
  attacker.attackedThisTurn = true;
  if (attacker.hp <= 0) handleKO(G, attacker, G.currentPlayer);

  if (G.pendingRetreats.length === 0 && !G.targeting && !G.winner) {
    endTurn(G);
  }
  return true;
}

function doRetreat(G) {
  var p = cp(G);
  if (!p.active || p.bench.length === 0) return false;
  if (p.active.status.includes('sleep')) { addLog(G, p.active.name + ' is Asleep and can\'t retreat!', 'info'); return false; }

  var oppAll = [op(G).active].concat(op(G).bench).filter(Boolean);
  var blocked = oppAll.some(function(pk) { return getPokemonData(pk.name).ability && getPokemonData(pk.name).ability.key === 'blockade' && pk === op(G).active && !isPassiveBlocked(G); });
  if (blocked && !(p.active.heldItem === 'Protect Goggles')) {
    addLog(G, 'Blockade prevents retreat!', 'effect');
    return false;
  }

  G.pendingRetreats.push({ player: G.currentPlayer, reason: 'retreat' });
  return true;
}

function doQuickRetreat(G) {
  var p = cp(G);
  if (!p.active || p.bench.length === 0) return false;
  if (p.active.status.includes('sleep')) { addLog(G, p.active.name + ' is Asleep and can\'t retreat!', 'info'); return false; }
  var cost = p.active.heldItem === 'Float Stone' ? 1 : 2;
  if (p.active.energy < cost) return false;

  var blocked = op(G).active && getPokemonData(op(G).active.name).ability && getPokemonData(op(G).active.name).ability.key === 'blockade';
  if (blocked && !(p.active.heldItem === 'Protect Goggles')) {
    addLog(G, 'Blockade prevents retreat!', 'effect');
    return false;
  }

  p.active.energy -= cost;
  G.pendingRetreats.push({ player: G.currentPlayer, reason: 'quick' });
  addLog(G, 'Quick Retreat (' + cost + ' energy)', 'info');
  return true;
}

function doSelectBenchForRetreat(G, benchIdx, playerNum) {
  if (G.pendingRetreats.length === 0) return false;
  var pr = G.pendingRetreats[0];
  // Allow the correct player to select (could be non-current player for KO)
  if (playerNum !== undefined && playerNum !== pr.player) return false;
  var p = G.players[pr.player];
  var newActive = p.bench[benchIdx];
  if (!newActive) return false;

  p.bench.splice(benchIdx, 1);
  if (p.active && p.active.hp > 0) {
    p.active.sustained = false;
    p.active.attackedThisTurn = false;
    if (p.active.status.length > 0) { addLog(G, p.active.name + '\'s ' + p.active.status.join(', ') + ' was cured on bench!', 'heal'); p.active.status = []; }
    p.bench.push(p.active);
  }
  p.active = newActive;
  addLog(G, newActive.name + ' is now Active!', 'info');
  G.events.push({ type: 'retreat', player: pr.player });

  var reason = pr.reason;
  var afterEnd = pr.afterEndTurn;
  var transferEnergy = pr.transferEnergy || 0;
  G.pendingRetreats.shift(); // Remove the resolved retreat

  if (reason === 'batonPass' && transferEnergy > 0) {
    var oldActive = p.bench[p.bench.length - 1];
    if (oldActive) oldActive.energy = 0;
    var gained = Math.min(transferEnergy, 5 - newActive.energy);
    newActive.energy += gained;
    addLog(G, 'Baton Pass: ' + newActive.name + ' gained ' + gained + ' energy!', 'effect');
  }

  // If more pending retreats remain (e.g. double KO), let the next one resolve first
  if (G.pendingRetreats.length > 0) {
    return true;
  }

  // If this retreat was triggered during endTurn (status tick KO), just switch turns
  if (pr.duringEndTurn) {
    switchTurn(G);
    return true;
  }

  if (reason === 'retreat') {
    endTurn(G);
  } else if (reason === 'ko') {
    endTurn(G);
  } else if (afterEnd) {
    endTurn(G);
  }
  return true;
}

function doGrantEnergy(G, targetSlot, benchIdx) {
  var p = cp(G);
  var target;
  if (targetSlot === 'active') {
    target = p.active;
  } else {
    target = p.bench[benchIdx];
  }
  if (!target) return false;

  var cost = (getPokemonData(target.name).ability && getPokemonData(target.name).ability.key === 'slowStart' && !isPassiveBlocked(G)) ? 2 : 1;
  if (p.mana < cost || target.energy >= 5) return false;
  p.mana -= cost;
  target.energy++;

  if (target.heldItem === 'Healing Scarf' && target.damage > 0) {
    target.damage = Math.max(0, target.damage - 20);
    target.hp = target.maxHp - target.damage;
    addLog(G, 'Healing Scarf heals ' + target.name + ' 20', 'heal');
  }

  // Biting Whirlpool
  var oppAll = [op(G).active].concat(op(G).bench).filter(Boolean);
  oppAll.forEach(function(pk) {
    var d = getPokemonData(pk.name);
    if (d.ability && d.ability.key === 'bitingWhirlpool' && !isPassiveBlocked(G)) {
      dealDamage(G, target, 10, G.currentPlayer);
      addLog(G, 'Biting Whirlpool deals 10 to ' + target.name, 'effect');
    }
  });

  addLog(G, 'Granted ' + target.name + ' +1 energy (' + cost + ' mana)', '');
  G.events.push({ type: 'energy_gain', targetPlayer: G.currentPlayer, targetSlot: targetSlot, benchIdx: benchIdx });
  return true;
}

function doPlayPokemon(G, handIdx, itemHandIdx) {
  var p = cp(G);
  var card = p.hand[handIdx];
  if (!card || card.type !== 'pokemon') return false;
  var data = getPokemonData(card.name);
  if (p.mana < data.cost || p.bench.length >= 4) return false;

  var heldItem = card.heldItem || null;
  if (itemHandIdx !== null && itemHandIdx !== undefined) {
    var itemCard = p.hand[itemHandIdx];
    if (itemCard && itemCard.type === 'items') {
      heldItem = itemCard.name;
      if (itemHandIdx > handIdx) {
        p.hand.splice(itemHandIdx, 1);
        p.hand.splice(handIdx, 1);
      } else {
        p.hand.splice(handIdx, 1);
        p.hand.splice(itemHandIdx, 1);
      }
    } else {
      p.hand.splice(handIdx, 1);
    }
  } else {
    p.hand.splice(handIdx, 1);
  }

  p.mana -= data.cost;
  var pk = makePokemon(card.name, heldItem);
  p.bench.push(pk);

  addLog(G, 'Played ' + pk.name + ' to bench' + (heldItem ? ' with ' + heldItem : '') + ' (' + data.cost + ' mana)', 'info');

  // On-play abilities
  if (data.ability && data.ability.type === 'onPlay' && data.ability.key === 'soulDrain') {
    if (op(G).active && op(G).active.energy > 0) {
      var stripped = Math.min(2, op(G).active.energy);
      op(G).active.energy -= stripped;
      addLog(G, 'Soul Drain strips ' + stripped + ' energy!', 'effect');
    }
  }

  G.events.push({ type: 'play_pokemon', player: G.currentPlayer, pokemon: pk.name, benchIdx: p.bench.length - 1 });
  return true;
}

function doUseAbility(G, key) {
  var p = cp(G);
  if (isNeutralizingGasActive(G)) { addLog(G, 'Neutralizing Gas blocks abilities!', 'effect'); return false; }
  if (p.usedAbilities[key] && key !== 'magicDrain' && key !== 'healingTouch') return false;

  if (key === 'creation' && p.active && getPokemonData(p.active.name).ability && getPokemonData(p.active.name).ability.key === 'creation') {
    if (p.mana < 1) return false;
    p.mana = Math.min(10, p.mana + 1);
    p.usedAbilities[key] = true;
    addLog(G, 'Creation: +1 net mana', 'effect');
  }
  else if (key === 'lullaby') {
    if (!op(G).active) { addLog(G, 'No opponent active!', 'info'); return false; }
    if (op(G).active.status.includes('confusion')) { addLog(G, op(G).active.name + ' is already Confused!', 'info'); return false; }
    if (op(G).active.heldItem === 'Protect Goggles') { addLog(G, op(G).active.name + '\'s Protect Goggles block it!', 'effect'); return false; }
    p.usedAbilities[key] = true;
    op(G).active.status.push('confusion');
    addLog(G, 'Befuddling Melody confuses ' + op(G).active.name + '!', 'effect');
    G.events.push({ type: 'status_apply', targetPlayer: oppPlayer(G.currentPlayer), targetIdx: -1, status: 'confusion' });
  }
  else if (key === 'softTouch') {
    var validTargets = [];
    [G.currentPlayer, oppPlayer(G.currentPlayer)].forEach(function(pNum) {
      var side = G.players[pNum];
      if (side.active && side.active.damage > 0) validTargets.push({ player: pNum, idx: -1 });
      side.bench.forEach(function(pk, bi) { if (pk.damage > 0) validTargets.push({ player: pNum, idx: bi }); });
    });
    if (validTargets.length > 0) {
      G.targeting = { type: 'softTouch', validTargets: validTargets, context: {} };
      return true;
    }
    return false;
  }
  else if (key === 'healingTouch') {
    if (p.mana < 1 || !p.active) return false;
    p.mana--;
    if (p.active.damage > 0) {
      p.active.damage = Math.max(0, p.active.damage - 30);
      p.active.hp = p.active.maxHp - p.active.damage;
    }
    p.active.status = [];
    addLog(G, 'Healing Touch: heal 30, clear status', 'heal');
  }
  else if (key === 'yummyDelivery') {
    if (!p.active || !(getPokemonData(p.active.name).ability && getPokemonData(p.active.name).ability.key === 'yummyDelivery')) return false;
    var ydTargets = [];
    p.bench.forEach(function(bpk, i) { if (bpk.energy < 5) ydTargets.push({ player: G.currentPlayer, idx: i }); });
    if (ydTargets.length === 0) return false;
    G.targeting = { type: 'yummyDelivery', validTargets: ydTargets, context: {} };
    return true;
  }
  else if (key === 'poisonFumes') {
    if (!op(G).active) { addLog(G, 'No opponent active!', 'info'); return false; }
    if (op(G).active.status.includes('poison')) { addLog(G, op(G).active.name + ' is already Poisoned!', 'info'); return false; }
    if (op(G).active.heldItem === 'Protect Goggles') { addLog(G, op(G).active.name + '\'s Protect Goggles block it!', 'effect'); return false; }
    p.usedAbilities[key] = true;
    op(G).active.status.push('poison');
    addLog(G, 'Poison Fumes poisons ' + op(G).active.name + '!', 'effect');
    G.events.push({ type: 'status_apply', targetPlayer: oppPlayer(G.currentPlayer), targetIdx: -1, status: 'poison' });
  }
  else if (key === 'hiddenPower') {
    if (p.active && p.active.energy < 5) {
      p.active.energy++;
      p.usedAbilities[key] = true;
      addLog(G, 'Hidden Power: Active +1 energy, turn ends', 'effect');
      endTurn(G);
      return true;
    }
    return false;
  }
  else if (key === 'creepingChill') {
    var ccTargets = getAllValidTargets(G);
    if (ccTargets.length === 0) { addLog(G, 'No valid targets!', 'info'); return false; }
    G.targeting = { type: 'creepingChill', validTargets: ccTargets, context: {} };
    return true;
  }
  else if (key === 'bloodthirsty') {
    if (p.mana < 1 || !p.active || !(getPokemonData(p.active.name).ability && getPokemonData(p.active.name).ability.key === 'bloodthirsty')) return false;
    if (op(G).bench.length === 0) { addLog(G, 'No opponent bench to switch!', 'info'); return false; }
    p.mana--;
    p.usedAbilities[key] = true;
    var btNewActive = op(G).bench.shift();
    if (op(G).active.status.length > 0) { addLog(G, op(G).active.name + '\'s ' + op(G).active.status.join(', ') + ' was cured on bench!', 'heal'); op(G).active.status = []; }
    op(G).bench.push(op(G).active);
    op(G).active = btNewActive;
    addLog(G, 'Bloodthirsty: forced ' + btNewActive.name + ' to become Active!', 'effect');
  }
  else if (key === 'megaSpeed') {
    if (!p.active || !(getPokemonData(p.active.name).ability && getPokemonData(p.active.name).ability.key === 'megaSpeed')) return false;
    if (p.active.energy >= 5) return false;
    p.active.energy++;
    p.usedAbilities[key] = true;
    addLog(G, 'Mega Speed: ' + p.active.name + ' +1 energy', 'effect');
  }
  else if (key === 'magicDrain') {
    if (p.mana < 1) return false;
    if (op(G).mana <= 0) { addLog(G, 'Opponent has no mana!', 'info'); return false; }
    p.mana--;
    op(G).mana = Math.max(0, op(G).mana - 1);
    addLog(G, 'Magic Drain: opponent loses 1 mana', 'effect');
  }
  else if (key === 'improvise') {
    if (!p.active || !(getPokemonData(p.active.name).ability && getPokemonData(p.active.name).ability.key === 'improvise')) {
      addLog(G, 'Improvise only works while active!', 'info'); return false;
    }
    if (p.active.energy < 1) return false;
    var oppData = op(G).active ? getPokemonData(op(G).active.name) : null;
    if (!oppData || !oppData.attacks.length) { addLog(G, 'No opponent attacks to copy!', 'info'); return false; }
    p.active.energy--;
    p.usedAbilities[key] = true;
    p.active.improviseActive = true;
    addLog(G, 'Ditto transforms! Gained ' + op(G).active.name + '\'s attacks!', 'effect');
  }
  else if (key === 'phantomWalk') {
    if (!p.active || p.bench.length === 0) return false;
    if (!(getPokemonData(p.active.name).ability && getPokemonData(p.active.name).ability.key === 'phantomWalk')) return false;
    p.usedAbilities[key] = true;
    G.pendingRetreats.push({ player: G.currentPlayer, reason: 'quick' });
    addLog(G, 'Illusory Getaway: free retreat!', 'effect');
    return true;
  }
  else {
    return false;
  }

  return true;
}

function doDiscardItem(G, slot, benchIdx) {
  var p = cp(G);
  var pk = slot === 'active' ? p.active : p.bench[benchIdx];
  if (!pk || !pk.heldItem) return false;
  addLog(G, 'Discarded ' + pk.heldItem + ' from ' + pk.name, 'info');
  pk.heldItem = null;
  return true;
}

function doEndTurnAction(G) {
  endTurn(G);
  return true;
}

// ============================================================
// PHASE MANAGEMENT (Deck Build, Setup)
// ============================================================
function processDeckConfirm(G, playerNum, deck) {
  if (G.phase !== 'deckBuild') return false;
  if (deck.length !== 15) return false;
  var p = G.players[playerNum];
  if (p.ready) return false;

  // Validate deck contents
  for (var i = 0; i < deck.length; i++) {
    var card = deck[i];
    if (card.type === 'pokemon') {
      if (!getPokemonData(card.name)) return false;
    } else if (card.type === 'items') {
      if (!getItemData(card.name)) return false;
    } else {
      return false;
    }
  }

  p.deck = deck.slice();
  p.hand = deck.map(function(c) { return { name: c.name, type: c.type, heldItem: null }; });
  p.ready = true;

  // Check if both players ready
  if (G.players[1].ready && G.players[2].ready) {
    G.phase = 'setupActive';
    // Turn-based setup (multiplayer): player 1 selects first.
    G.currentPlayer = 1;
    G.players[1].mana = 7;
    G.players[2].mana = 7;
    // ready flags are not used for setup sequencing anymore, but keep them false.
    G.players[1].ready = false;
    G.players[2].ready = false;
    G.events.push({ type: 'phase_change', phase: 'setupActive' });
  }
  return true;
}

function processSetupChoice(G, playerNum, choices) {
  var p = G.players[playerNum];

  // During setup, enforce strict turn order via G.currentPlayer.
  if (G.phase === 'setupActive' || G.phase === 'setupBench') {
    if (G.currentPlayer !== playerNum) return false;
  }

  if (G.phase === 'setupActive') {
    if (!choices || choices.length !== 1) return false;
    var sel = choices[0];
    var data = getPokemonData(sel.name);
    if (!data) return false;
    if (p.mana < data.cost) return false;

    // Check card is in hand
    var handIdx = p.hand.findIndex(function(c) { return c.name === sel.name && c.type === 'pokemon'; });
    if (handIdx < 0) return false;

    p.mana -= data.cost;
    p.active = makePokemon(sel.name, sel.heldItem || null);
    p.hand = p.hand.filter(function(c) { return c.name !== sel.name; });
    if (sel.heldItem) p.hand = p.hand.filter(function(c) { return c.name !== sel.heldItem; });
    // Advance turn: P1 -> P2, then phase change to setupBench.
    if (playerNum === 1) {
      G.currentPlayer = 2;
    } else {
      G.phase = 'setupBench';
      G.currentPlayer = 1;
      G.events.push({ type: 'phase_change', phase: 'setupBench' });
    }
    return true;
  }

  if (G.phase === 'setupBench') {
    if (!choices) choices = [];
    // Limit bench to 4.
    if (p.bench.length + choices.length > 4) return false;

    // Validate each selection
    for (var i = 0; i < choices.length; i++) {
      var bsel = choices[i];
      var bdata = getPokemonData(bsel.name);
      if (!bdata) return false;
      if (p.mana < bdata.cost) return false;

      p.mana -= bdata.cost;
      p.bench.push(makePokemon(bsel.name, bsel.heldItem || null));
      p.hand = p.hand.filter(function(c) { return c.name !== bsel.name; });
      if (bsel.heldItem) p.hand = p.hand.filter(function(c) { return c.name !== bsel.heldItem; });
    }

    // Advance turn: P1 -> P2, then enter battle.
    if (playerNum === 1) {
      G.currentPlayer = 2;
    } else {
      G.phase = 'battle';
      G.currentPlayer = 1;
      G.turn = 1;
      G.players[1].mana = 0;
      G.players[2].mana = 0;
      G.events.push({ type: 'phase_change', phase: 'battle' });
      startTurn(G);
    }
    return true;
  }

  return false;
}

// ============================================================
// MAIN ENTRY POINT
// ============================================================
function processAction(G, playerNum, action) {
  if (G.winner) return false;
  G.events = [];

  // Allow the pending retreat owner to select bench (even if not current player - KO case)
  if (action.type === 'selectBenchForRetreat') {
    return doSelectBenchForRetreat(G, action.benchIdx, playerNum);
  }

  // selectTarget must come from current player
  if (action.type === 'selectTarget') {
    if (G.currentPlayer !== playerNum) return false;
    return doSelectTarget(G, action.targetPlayer, action.targetBenchIdx);
  }

  // All other actions require being the current player
  if (G.phase !== 'battle') return false;
  if (G.currentPlayer !== playerNum) return false;
  if (G.pendingRetreats.length > 0 || G.targeting) return false; // Must resolve pending state first

  switch (action.type) {
    case 'attack': return doAttack(G, action.attackIndex, action);
    case 'copiedAttack': return doCopiedAttack(G, action.sourceName, action.attackIndex, action);
    case 'retreat': return doRetreat(G);
    case 'quickRetreat': return doQuickRetreat(G);
    case 'grantEnergy': return doGrantEnergy(G, action.targetSlot, action.benchIdx);
    case 'playPokemon': return doPlayPokemon(G, action.handIdx, action.itemHandIdx);
    case 'useAbility': return doUseAbility(G, action.key);
    case 'discardItem': return doDiscardItem(G, action.slot, action.benchIdx);
    case 'endTurn': return doEndTurnAction(G);
    default: return false;
  }
}

// ============================================================
// STATE FILTERING
// ============================================================
function filterStateForPlayer(G, playerNum) {
  var state = JSON.parse(JSON.stringify(G));
  var oppNum = oppPlayer(playerNum);

  // Hide opponent hand - just count
  state.players[oppNum].handCount = state.players[oppNum].hand.length;
  state.players[oppNum].hand = [];
  state.players[oppNum].deckCount = state.players[oppNum].deck.length;
  state.players[oppNum].deck = [];

  state.myPlayerNum = playerNum;

  // ----------------------------------------------------------
  // Setup-phase visibility rules (multiplayer fairness)
  // ----------------------------------------------------------
  // In setupActive: the waiting player should not see the chooser's active/item.
  if (G.phase === 'setupActive') {
    if (G.currentPlayer === oppNum) {
      state.players[oppNum].active = null;
      state.players[oppNum].mana = null;
    }
  }

  // In setupBench: active selections are public, but the waiting player
  // should not see the chooser's bench until it is confirmed.
  if (G.phase === 'setupBench') {
    if (G.currentPlayer === oppNum) {
      state.players[oppNum].bench = [];
    }
  }

  // --- Setup information hiding (multiplayer) ---
  // While a player is choosing in setupActive, the waiting player should not see
  // any of the chooser's selection.
  if (G.phase === 'setupActive' && G.currentPlayer === oppNum) {
    state.players[oppNum].active = null;
  }
  // During setupBench, the waiting player should not see the chooser's bench-in-progress.
  // (Bench is only revealed once confirmed, which on the server happens at submission.)
  if (G.phase === 'setupBench' && G.currentPlayer === oppNum) {
    state.players[oppNum].bench = state.players[oppNum].bench || [];
    // The chooser's bench is already committed on submit; however, we still hide it
    // while it's the chooser's turn to match the "waiting screen" behavior.
    state.players[oppNum].bench = [];
  }

  // Only show targeting if relevant to this player
  if (G.targeting && G.currentPlayer !== playerNum) {
    state.targeting = null;
  }

  // Remove events from state (sent separately)
  delete state.events;

  return state;
}

// Get available copied attacks for action panel
function getCopiedAttacks(G) {
  var p = cp(G);
  var pk = p.active;
  if (!pk) return [];
  var data = getPokemonData(pk.name);
  var attacks = [];

  // Mew Versatility
  if (data.ability && data.ability.key === 'versatility' && !isPassiveBlocked(G)) {
    p.bench.forEach(function(benchPk) {
      var bd = getPokemonData(benchPk.name);
      bd.attacks.forEach(function(atk, i) {
        attacks.push({ attack: atk, types: bd.types, source: benchPk.name, attackIndex: i });
      });
    });
  }

  // Ditto Improvise
  if (pk.improviseActive && op(G).active) {
    var oppData = getPokemonData(op(G).active.name);
    oppData.attacks.forEach(function(atk, i) {
      attacks.push({ attack: atk, types: oppData.types, source: op(G).active.name, attackIndex: i });
    });
  }

  return attacks;
}

// ============================================================
// EXPORTS
// ============================================================
exports.POKEMON_DB = POKEMON_DB;
exports.ITEM_DB = ITEM_DB;
exports.mergeExternalData = mergeExternalData;
exports.getPokemonData = getPokemonData;
exports.getItemData = getItemData;
exports.createGame = createGame;
exports.processAction = processAction;
exports.processDeckConfirm = processDeckConfirm;
exports.processSetupChoice = processSetupChoice;
exports.filterStateForPlayer = filterStateForPlayer;
exports.getCopiedAttacks = getCopiedAttacks;
exports.makePokemon = makePokemon;
exports.oppPlayer = oppPlayer;

})(typeof module !== 'undefined' && module.exports ? module.exports : (this.GameEngine = {}));