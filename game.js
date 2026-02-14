// ============================================================
// NETWORK STATE
// ============================================================
let isOnline = false;
let ws = null;
let myPlayerNum = null;
let myToken = null;
let myRoomCode = null;
let serverState = null; // Last state from server
let isReplayingEvents = false;
let useOptBoostThisAttack = false; // offline only; online uses server flag


const TYPE_COLORS = {
  Normal:"#A8A77A",Fire:"#EE8130",Water:"#6390F0",Grass:"#7AC74C",Electric:"#F7D02C",
  Ground:"#E2BF65",Ice:"#96D9D6",Fighting:"#C22E28",Poison:"#A33EA1",Flying:"#A98FF3",
  Psychic:"#F95587",Bug:"#A6B91A",Rock:"#B6A136",Ghost:"#735797",Dragon:"#6F35FC",
  Dark:"#705746",Steel:"#B7B7CE",Fairy:"#D685AD"
};


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
    attacks:[{name:"Bloom Blade",energy:1,baseDmg:40,desc:"Bench +1 energy",fx:"benchEnergy:1"},{name:"Slime Slicer",energy:3,baseDmg:90,desc:"Poison",fx:"poison"}]},
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


// Merge external pokemon-data.js stats into POKEMON_DB
if (window.POKEMON_DATA) {
  window.POKEMON_DATA.forEach(ext => {
    const entry = POKEMON_DB.find(p => p.name === ext.name);
    if (entry) {
      entry.types = ext.types;
      entry.cost = ext.cost;
      entry.hp = ext.hp;
      entry.weakness = ext.weakness;
      entry.resistance = ext.resistance;
    }
  });
}
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


// ============================================================
// GAME ENGINE
// ============================================================
const G = {
  phase:'deckBuildP1', currentPlayer:1, turn:0,
  players: {
    1: { name:'Player 1', mana:0, kos:0, deck:[], hand:[], active:null, bench:[], usedAbilities:{} },
    2: { name:'Player 2', mana:0, kos:0, deck:[], hand:[], active:null, bench:[], usedAbilities:{} },
  },
  log: [],
  targeting: null, // {type,callback}
  animating: false,
  pendingRetreats: [],
  selectedCard: null, // {playerNum, benchIdx} where benchIdx=-1 means active
};

// Track previous HP percentages for smooth bar transitions
const prevHpPct = {};

function getImg(name) {
  const b64 = CARD_IMAGES[name];
  return b64 ? 'data:image/png;base64,' + b64 : '';
}

function getPokemonData(name) { return POKEMON_DB.find(p => p.name === name); }
function getItemData(name) { return ITEM_DB.find(i => i.name === name); }
function isNeutralizingGasActive() {
  // Check if any Pokemon in play has Neutralizing Gas
  const all = [G.players[1].active, ...G.players[1].bench, G.players[2].active, ...G.players[2].bench].filter(Boolean);
  return all.some(pk => { const d = getPokemonData(pk.name); return d.ability && d.ability.key === 'neutralizingGas'; });
}
function isPassiveBlocked() { return isNeutralizingGasActive(); }

function makePokemon(name, heldItem) {
  const data = getPokemonData(name);
  const maxHp = data.hp + (heldItem === 'Health Charm' ? 50 : 0);
  const energy = heldItem === 'Power Herb' ? 1 : 0;
  const actualItem = heldItem === 'Power Herb' ? null : heldItem;
  return {
    name, maxHp, hp: maxHp, energy, heldItem: actualItem, heldItemUsed: heldItem === 'Power Herb',
    status: [], damage: 0, shields: [], sustained: false, attackedThisTurn: false, cantUseAttack: null,
    vulnerability: 0, quickClawActive: heldItem === 'Quick Claw',
    grassWeakUntil: 0, improviseActive: false,
  };
}

function opp(p) { return p === 1 ? 2 : 1; }
function cp() { return G.players[G.currentPlayer]; }
function op() { return G.players[opp(G.currentPlayer)]; }
// For rendering: me() is always the local player, them() is always the opponent
function me() { return isOnline ? G.players[myPlayerNum] : G.players[G.currentPlayer]; }
function them() { return isOnline ? G.players[opp(myPlayerNum)] : G.players[opp(G.currentPlayer)]; }
function meNum() { return isOnline ? myPlayerNum : G.currentPlayer; }
function themNum() { return isOnline ? opp(myPlayerNum) : opp(G.currentPlayer); }
function isMyTurn() { return !isOnline || G.currentPlayer === myPlayerNum; }

function addLog(text, cls='') {
  G.log.unshift({text, cls, turn: G.turn});
  if (G.log.length > 100) G.log.pop();
}

// ============================================================
// UTILITY / ANIMATION HELPERS
// ============================================================
const delay = ms => new Promise(r => setTimeout(r, ms));

function animateEl(selector, className, duration) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), duration);
}

function showTurnOverlay(text) {
  const overlay = document.createElement('div');
  overlay.className = 'turn-overlay';
  overlay.innerHTML = `<div class="turn-overlay-text">${text}</div>`;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 1000);
}

// Positioned damage popup near a target element
function showDamagePopupAt(amount, targetSelector, isHeal) {
  const target = document.querySelector(targetSelector);
  const el = document.createElement('div');
  el.className = 'damage-popup' + (isHeal ? ' heal' : '');
  el.textContent = (isHeal ? '+' : '-') + amount;
  if (target) {
    const rect = target.getBoundingClientRect();
    el.style.left = rect.left + rect.width / 2 + 'px';
    el.style.top = rect.top + rect.height * 0.3 + 'px';
  } else {
    el.style.left = '50%';
    el.style.top = '35%';
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

// Particle burst effect
function spawnParticles(x, y, color, count, opts = {}) {
  let container = document.querySelector('.particle-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'particle-container';
    document.body.appendChild(container);
  }
  const size = opts.size || 6;
  const spread = opts.spread || 60;
  const duration = opts.duration || 600;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const dx = (Math.random() - 0.5) * spread * 2;
    const dy = (Math.random() - 0.5) * spread * 2;
    p.style.cssText = `left:${x}px;top:${y}px;width:${size + Math.random()*4}px;height:${size + Math.random()*4}px;background:${color};--dx:${dx}px;--dy:${dy}px;animation:particleFly ${duration + Math.random()*200}ms ease-out forwards;animation-delay:${Math.random()*100}ms;`;
    container.appendChild(p);
    setTimeout(() => p.remove(), duration + 400);
  }
}

// Spawn particles at a DOM element
function spawnParticlesAtEl(selector, color, count, opts = {}) {
  const el = document.querySelector(selector);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, color, count, opts);
}

// Get selector for a pokemon's field slot
function getPokemonSelector(playerNum, benchIdx) {
  const side = playerNum === meNum() ? '#youField' : '#oppField';
  if (benchIdx === -1) return side + ' .active-slot';
  return side + ' .field-bench-row > :nth-child(' + (benchIdx + 1) + ')';
}

// Find which slot a pokemon is in, return CSS selector
function findPokemonSelector(pokemon) {
  for (let pNum = 1; pNum <= 2; pNum++) {
    const p = G.players[pNum];
    if (p.active === pokemon) return getPokemonSelector(pNum, -1);
    const bIdx = p.bench.indexOf(pokemon);
    if (bIdx >= 0) return getPokemonSelector(pNum, bIdx);
  }
  return null;
}

// Snapshot all pokemon HP% before render
function captureHpState() {
  for (let pNum = 1; pNum <= 2; pNum++) {
    const p = G.players[pNum];
    if (p.active) prevHpPct[pNum + '-active'] = Math.max(0, (p.active.hp / p.active.maxHp) * 100);
    p.bench.forEach((pk, i) => { prevHpPct[pNum + '-bench-' + i] = Math.max(0, (pk.hp / pk.maxHp) * 100); });
  }
}

// After innerHTML rebuild, animate HP bars from old to new values
function animateHpBars() {
  for (let pNum = 1; pNum <= 2; pNum++) {
    const side = pNum === meNum() ? '#youField' : '#oppField';
    const p = G.players[pNum];
    if (p.active) {
      const key = pNum + '-active';
      const fill = document.querySelector(side + ' .active-slot .fp-hp-fill');
      if (fill && prevHpPct[key] !== undefined) {
        const newPct = Math.max(0, (p.active.hp / p.active.maxHp) * 100);
        if (Math.abs(prevHpPct[key] - newPct) > 0.5) {
          fill.style.width = prevHpPct[key] + '%';
          requestAnimationFrame(() => { requestAnimationFrame(() => { fill.style.width = newPct + '%'; }); });
        }
      }
    }
    p.bench.forEach((pk, i) => {
      const key = pNum + '-bench-' + i;
      const fill = document.querySelector(side + ' .field-bench-row > :nth-child(' + (i + 1) + ') .fp-hp-fill');
      if (fill && prevHpPct[key] !== undefined) {
        const newPct = Math.max(0, (pk.hp / pk.maxHp) * 100);
        if (Math.abs(prevHpPct[key] - newPct) > 0.5) {
          fill.style.width = prevHpPct[key] + '%';
          requestAnimationFrame(() => { requestAnimationFrame(() => { fill.style.width = newPct + '%'; }); });
        }
      }
    });
  }
}

// Energy gain popup (yellow)
function showEnergyPopup(targetSelector, text) {
  const target = document.querySelector(targetSelector);
  const el = document.createElement('div');
  el.className = 'damage-popup energy-popup';
  el.textContent = text;
  if (target) {
    const rect = target.getBoundingClientRect();
    el.style.left = (rect.left + rect.width / 2) + 'px';
    el.style.top = (rect.top + rect.height * 0.3) + 'px';
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

// Mana gain popup (cyan)
function showManaPopup(amount) {
  const manaEl = document.querySelector('.mana-display');
  const el = document.createElement('div');
  el.className = 'damage-popup mana-popup';
  el.textContent = '+' + amount + ' Mana';
  if (manaEl) {
    const rect = manaEl.getBoundingClientRect();
    el.style.left = (rect.left + rect.width / 2) + 'px';
    el.style.top = (rect.top - 20) + 'px';
  } else {
    el.style.left = '50%';
    el.style.top = '80%';
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

// Type-based particle colors
const TYPE_PARTICLE_COLORS = {
  Normal:'#A8A77A', Fire:'#EE8130', Water:'#6390F0', Grass:'#7AC74C',
  Electric:'#F7D02C', Ground:'#E2BF65', Ice:'#96D9D6', Fighting:'#C22E28',
  Poison:'#A33EA1', Flying:'#A98FF3', Psychic:'#F95587', Bug:'#A6B91A',
  Rock:'#B6A136', Ghost:'#735797', Dragon:'#6F35FC', Dark:'#705746',
  Steel:'#B7B7CE', Fairy:'#D685AD'
};

// Get shake class based on damage amount
function getShakeClass(damage) {
  if (damage >= 100) return 'hit-shake-massive';
  if (damage >= 50) return 'hit-shake-heavy';
  return 'hit-shake';
}
function getShakeDuration(damage) {
  if (damage >= 100) return 900;
  if (damage >= 50) return 700;
  return 500;
}

// Get damage popup size class
function getDmgPopupClass(damage) {
  if (damage >= 100) return 'dmg-massive';
  if (damage >= 50) return 'dmg-heavy';
  return '';
}

// Center the battle field view on both active Pokemon
function focusOnActives() {
  const field = document.querySelector('.battle-field');
  if (!field) return;
  const oppSlot = document.querySelector('#oppField .active-slot');
  const youSlot = document.querySelector('#youField .active-slot');
  if (!oppSlot || !youSlot) return;
  const fieldRect = field.getBoundingClientRect();
  const oppRect = oppSlot.getBoundingClientRect();
  const youRect = youSlot.getBoundingClientRect();
  // Midpoint between the two actives relative to the field
  const midY = ((oppRect.top + oppRect.bottom) / 2 + (youRect.top + youRect.bottom) / 2) / 2;
  const fieldMidY = fieldRect.top + fieldRect.height / 2;
  const scrollAdjust = midY - fieldMidY;
  field.scrollBy({ top: scrollAdjust, behavior: 'smooth' });
}

// ============================================================
// TYPE / DAMAGE CALC
// ============================================================
function calcWeaknessResistance(attackerTypes, defender) {
  const defData = getPokemonData(defender.name);
  let weaknesses = [...defData.weakness];
  let resistances = [...defData.resistance];

  // Grass weakness from Trevenant's Forest's Curse
  if (defender.grassWeakUntil > G.turn) {
    if (!weaknesses.includes('Grass')) weaknesses.push('Grass');
  }

  // Pierce Scope: if attacker Active has Pierce Scope, Normal types gain attacker's types as weakness
  const attPlayer = cp();
  if (attPlayer.active && attPlayer.active.heldItem === 'Pierce Scope') {
    if (defData.types.includes('Normal')) {
      const attData = getPokemonData(attPlayer.active.name);
      attData.types.forEach(t => { if (!weaknesses.includes(t)) weaknesses.push(t); });
    }
  }

  let hasWeak = false, hasResist = false;
  for (const atkType of attackerTypes) {
    if (weaknesses.includes(atkType)) hasWeak = true;
    if (resistances.includes(atkType)) hasResist = true;
  }

  if (hasWeak && hasResist) return 1.0;
  if (hasWeak) return 1.5;
  if (hasResist) return 0.5;
  return 1.0;
}

function calcDamage(attacker, defender, attack, attackerTypes, defenderOwner) {
  // Derive relationship from defender's owner
  const isOpponent = defenderOwner !== G.currentPlayer;
  const isOppActive = isOpponent && defender === op().active;

  let baseDmg = attack.baseDmg;
  const fx = attack.fx || '';

  // Attack-specific scaling
  if (fx.includes('scaleDef:')) { const v = parseInt(fx.split('scaleDef:')[1]); baseDmg += v * defender.energy; }
  if (fx.includes('scaleBoth:')) { const v = parseInt(fx.split('scaleBoth:')[1]); baseDmg += v * (attacker.energy + defender.energy); }
  if (fx.includes('scaleOwn:')) { const v = parseInt(fx.split('scaleOwn:')[1]); baseDmg += v * attacker.energy; }
  if (fx.includes('scaleBench:')) { const v = parseInt(fx.split('scaleBench:')[1]); baseDmg += v * cp().bench.length; baseDmg = Math.min(baseDmg, 140); }
  if (fx.includes('sustained:') && attacker.sustained) { baseDmg += parseInt(fx.split('sustained:')[1]); }
  if (fx.includes('berserk')) { baseDmg += attacker.damage; }
  if (fx.includes('bonusDmg:')) { const parts = fx.split('bonusDmg:')[1].split(':'); if (defender.damage >= parseInt(parts[0])) baseDmg += parseInt(parts[1]); }
  if (fx.includes('fullHpBonus:')) { const v = parseInt(fx.split('fullHpBonus:')[1]); if (defender.damage === 0) baseDmg += v; }
  if (fx.includes('payback:')) { const v = parseInt(fx.split('payback:')[1]); if (attacker.damage >= 100) baseDmg += v; }
  if (fx.includes('scaleDefNeg:')) { const v = parseInt(fx.split('scaleDefNeg:')[1]); baseDmg -= v * defender.energy; baseDmg = Math.max(0, baseDmg); }

  if (baseDmg <= 0) return { damage: 0, mult: 1 };

  // Item damage bonuses - Muscle Band/Life Orb/Lucky Punch only vs opponent's active
  let luckyProc = false;
  if (isOppActive) {
    if (attacker.heldItem === 'Muscle Band') baseDmg += 20;
    if (attacker.heldItem === 'Life Orb') baseDmg += 30;
    if (attacker.heldItem === 'Lucky Punch' && Math.random() < 0.5) { baseDmg += 20; luckyProc = true; }
  }

  // Weakness/Resistance multiplier
  let ignoreRes = fx.includes('ignoreRes');
  // Lucky Punch: add Normal type for weakness calc
  let effectiveTypes = attackerTypes;
  if (luckyProc && !attackerTypes.includes('Normal')) effectiveTypes = [...attackerTypes, 'Normal'];
  let mult = calcWeaknessResistance(effectiveTypes, defender);
  if (ignoreRes && mult < 1) mult = 1.0;

  // Expert Belt: 2x instead of 1.5x - applies to ALL opponent's Pokemon
  if (isOpponent && attacker.heldItem === 'Expert Belt' && mult === 1.5) mult = 2.0;

  let totalDmg = Math.floor(baseDmg * mult);

  // Damage reduction on defender
  let reduction = 0;
  const defAbility = getPokemonData(defender.name).ability;
  if (defAbility && defAbility.key && defAbility.key.startsWith('damageReduce:') && !isPassiveBlocked()) reduction += parseInt(defAbility.key.split(':')[1]);
  if (defender.heldItem === 'Assault Vest') reduction += 20;

  // Alolan Ninetales Aurora Veil (team-wide)
  const defPlayer = op();
  const allDefPokemon = [defPlayer.active, ...defPlayer.bench].filter(Boolean);
  if (!isPassiveBlocked() && allDefPokemon.some(p => getPokemonData(p.name).ability && getPokemonData(p.name).ability.key === 'auroraVeil')) reduction += 10;

  // Wide Shield
  if (defPlayer.active && defPlayer.active.heldItem === 'Wide Shield') reduction += 10;

  // Shields (temporary)
  if (defender.shields.length > 0) { reduction += defender.shields.reduce((s,v) => s+v, 0); }

  totalDmg = Math.max(0, totalDmg - reduction);

  // Filter Shield: immune to resisted types
  if (defender.heldItem === 'Filter Shield' && mult < 1) totalDmg = 0;

  // Mega Aggron Filter: block any final damage that is 50 or less
  if (defAbility && defAbility.key === 'filter' && totalDmg > 0 && totalDmg <= 50 && !isPassiveBlocked()) return { damage: 0, mult, filtered: true };

  return { damage: totalDmg, mult, luckyProc, reduction };
}

// ============================================================
// APPLY DAMAGE & CHECK KO
// ============================================================
function dealDamage(pokemon, amount, player) {
  if (amount <= 0) return false;
  pokemon.damage += amount;
  pokemon.hp = pokemon.maxHp - pokemon.damage;

  // Focus Sash check
  if (pokemon.hp <= 0 && pokemon.heldItem === 'Focus Sash' && !pokemon.heldItemUsed && (pokemon.maxHp - (pokemon.damage - amount)) >= 100) {
    pokemon.damage = pokemon.maxHp - 10;
    pokemon.hp = 10;
    pokemon.heldItemUsed = true;
    pokemon.heldItem = null;
    const sashSel = findPokemonSelector(pokemon);
    if (sashSel) { showDamagePopupAt(0, sashSel, true); animateEl(sashSel, 'item-proc', 600); }
    addLog(`Focus Sash saves ${pokemon.name} at 10 HP! (Discarded)`, 'effect');
    return false;
  }

  // Sitrus Berry check
  if (!pokemon.heldItemUsed && pokemon.heldItem === 'Sitrus Berry' && pokemon.damage >= 100 && pokemon.hp > 0) {
    pokemon.damage = Math.max(0, pokemon.damage - 60);
    pokemon.hp = pokemon.maxHp - pokemon.damage;
    pokemon.heldItemUsed = true;
    pokemon.heldItem = null;
    const sitSel = findPokemonSelector(pokemon);
    if (sitSel) { showDamagePopupAt(60, sitSel, true); animateEl(sitSel, 'heal-pulse', 500); animateEl(sitSel, 'item-proc', 600); }
    addLog(`Sitrus Berry heals ${pokemon.name} for 60! (Discarded)`, 'heal');
  }

  if (pokemon.hp <= 0) {
    pokemon.hp = 0;
    return true; // KO
  }
  return false;
}

function handleKO(pokemon, ownerPlayerNum) {
  const owner = G.players[ownerPlayerNum];
  const scorer = G.players[opp(ownerPlayerNum)];
  scorer.kos++;
  addLog(`${pokemon.name} is KO'd! (${scorer.name}: ${scorer.kos}/5 KOs)`, 'ko');

  // Clear card selection if the KO'd pokemon was selected
  if (G.selectedCard) {
    const selP = G.players[G.selectedCard.playerNum];
    const selPk = G.selectedCard.benchIdx === -1 ? selP.active : selP.bench[G.selectedCard.benchIdx];
    if (selPk === pokemon) G.selectedCard = null;
  }

  // Rescue Scarf
  if (pokemon.heldItem === 'Rescue Scarf') {
    owner.hand.push({name: pokemon.name, type:'pokemon', heldItem: null});
    addLog(`Rescue Scarf returns ${pokemon.name} to hand!`, 'effect');
  }

  // Check win
  if (scorer.kos >= 5) {
    setTimeout(() => showWin(scorer.name), 500);
    renderBattle();
    return;
  }

  // If Active was KO'd, need to promote
  if (owner.active === pokemon) {
    owner.active = null;
    if (owner.bench.length > 0) {
      G.pendingRetreats.push({ player: ownerPlayerNum, reason: 'ko' });
      addLog(`${owner.name} must choose new Active!`, 'info');
    }
  } else {
    // Remove from bench
    owner.bench = owner.bench.filter(p => p !== pokemon);
  }
  renderBattle();
}

// ============================================================
// TURN MANAGEMENT
// ============================================================
function startTurn() {
  const p = cp();
  const oldMana = p.mana;
  p.mana = Math.min(10, p.mana + 2);
  const manaGained = p.mana - oldMana;
  if (manaGained > 0) showManaPopup(manaGained);
  p.usedAbilities = {};
  // Auto-select active at start of turn
  G.selectedCard = { playerNum: G.currentPlayer, benchIdx: -1 };
  // Clear Ditto's improvise at start of new turn
  if (p.active) p.active.improviseActive = false;
  G.targeting = null;

  // Clear shields
  const allPokemon = [p.active, ...p.bench].filter(Boolean);
  allPokemon.forEach(pk => { pk.shields = []; pk.vulnerability = 0; pk.cantUseAttack = null; });

  // Passive start-of-turn effects
  // Berry Juice Sip (Shuckle)
  allPokemon.forEach(pk => {
    const d = getPokemonData(pk.name);
    if (d.ability && d.ability.key === 'berryJuice' && pk.damage > 0 && !isPassiveBlocked()) {
      pk.damage = Math.max(0, pk.damage - 20);
      pk.hp = pk.maxHp - pk.damage;
      const sel = getPokemonSelector(G.currentPlayer, pk === p.active ? -1 : p.bench.indexOf(pk));
      showDamagePopupAt(20, sel, true);
      animateEl(sel, 'heal-pulse', 500);
      addLog(`Berry Juice heals ${pk.name} 20`, 'heal');
    }
  });

  // Lum Berry auto
  allPokemon.forEach(pk => {
    if (pk.heldItem === 'Lum Berry' && !pk.heldItemUsed && pk.status.length > 0) {
      pk.status = [];
      pk.damage = Math.max(0, pk.damage - 30);
      pk.hp = pk.maxHp - pk.damage;
      pk.heldItemUsed = true;
      pk.heldItem = null;
      const sel = getPokemonSelector(G.currentPlayer, pk === p.active ? -1 : p.bench.indexOf(pk));
      showDamagePopupAt(30, sel, true);
      animateEl(sel, 'heal-pulse', 500);
      addLog(`Lum Berry cures ${pk.name}! (Discarded)`, 'heal');
    }
  });

  // (Vileplume Poison Fumes is now an active ability, triggered by player)


  // Suicune Aqua Ring
  if (p.active) {  // on OUR turn, check if OPP has aqua ring passive
    // Actually Aqua Ring triggers at end of Suicune's owner's turn
    // Let's handle it at end of turn instead
  }

  addLog(`--- ${p.name} Turn ${G.turn} ---`, 'info');
  renderBattle();
}

async function endTurn() {
  const p = cp();

  // End-of-turn: Suicune Aqua Ring (strip from opp)
  const allMine = [p.active, ...p.bench].filter(Boolean);
  allMine.forEach(pk => {
    const d = getPokemonData(pk.name);
    if (d.ability && d.ability.key === 'aquaRing' && pk === p.active && !isPassiveBlocked()) {
      const target = op().active;
      if (target && target.energy > 0 && !(target.heldItem === 'Protect Goggles')) {
        target.energy = Math.max(0, target.energy - 1);
        addLog(`Aqua Ring strips 1 energy from ${target.name}`, 'effect');
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

  // Status conditions tick after EVERY player's turn (both players' actives)
  for (const side of [p, op()]) {
    const pk = side.active;
    if (!pk) continue;
    const ownerNum = side === p ? G.currentPlayer : opp(G.currentPlayer);
    const sideSelector = side === p ? '#youField .active-slot' : '#oppField .active-slot';

    if (pk.hp <= 0) continue; // Skip dead pokemon (e.g. double KO)

    // Poison: 10 damage
    if (pk.status.includes('poison')) {
      spawnParticlesAtEl(sideSelector, '#A33EA1', 10, {spread:40, size:5});
      animateEl(sideSelector, 'status-apply', 500);
      const ko = dealDamage(pk, 10, ownerNum);
      showDamagePopupAt(10, sideSelector, false);
      addLog(`Poison deals 10 to ${pk.name}`, 'damage');
      renderBattle();
      await delay(600);
      if (ko) {
        animateEl(sideSelector, 'ko-fall', 600);
        await delay(600);
        handleKO(pk, ownerNum);
        await delay(400);
      }
    }

    // Burn: 20 damage, 50/50 cleanse
    if (pk.hp > 0 && pk.status.includes('burn')) {
      spawnParticlesAtEl(sideSelector, '#EE8130', 12, {spread:45, size:5});
      animateEl(sideSelector, 'status-apply', 500);
      const ko = dealDamage(pk, 20, ownerNum);
      showDamagePopupAt(20, sideSelector, false);
      addLog(`Burn deals 20 to ${pk.name}`, 'damage');
      renderBattle();
      await delay(600);
      if (ko) {
        animateEl(sideSelector, 'ko-fall', 600);
        await delay(600);
        handleKO(pk, ownerNum);
        await delay(400);
      }
      if (pk.hp > 0 && pk.status.includes('burn') && Math.random() < 0.5) {
        pk.status = pk.status.filter(s => s !== 'burn');
        addLog(`${pk.name}'s burn healed! (Heads)`, 'heal');
        animateEl(sideSelector, 'status-cure', 500);
        renderBattle();
        await delay(400);
      } else if (pk.hp > 0 && pk.status.includes('burn')) {
        addLog(`${pk.name} is still Burned (Tails)`, 'info');
      }
    }

    // Sleep: 50/50 coin flip to cure (only if alive)
    if (pk.hp > 0 && pk.status.includes('sleep')) {
      if (Math.random() < 0.5) {
        pk.status = pk.status.filter(s => s !== 'sleep');
        addLog(`${pk.name} woke up! (Heads)`, 'info');
        animateEl(sideSelector, 'status-cure', 500);
        renderBattle();
        await delay(400);
      } else {
        addLog(`${pk.name} is still Asleep! (Tails)`, 'info');
      }
    }
  }

  // Leftovers: heal 10 after each player's turn (both players' pokemon)
  for (const [pNum, pObj] of [[G.currentPlayer, p], [opp(G.currentPlayer), op()]]) {
    const allPk = [pObj.active, ...pObj.bench].filter(Boolean);
    for (const pk of allPk) {
      if (pk.heldItem === 'Leftovers' && pk.damage > 0 && pk.hp > 0) {
        pk.damage = Math.max(0, pk.damage - 10);
        pk.hp = pk.maxHp - pk.damage;
        const sel = getPokemonSelector(pNum, pk === pObj.active ? -1 : pObj.bench.indexOf(pk));
        showDamagePopupAt(10, sel, true);
        animateEl(sel, 'heal-pulse', 500);
        addLog(`Leftovers heals ${pk.name} 10`, 'heal');
      }
    }
  }

  // If status ticks caused KOs that need retreat selection, mark them so endTurn resumes after
  if (G.pendingRetreats.length > 0) {
    G.pendingRetreats.forEach(pr => { pr.duringEndTurn = true; });
    G.animating = false;
    renderBattle();
    return;
  }

  // Switch player
  renderBattle();
  await delay(500);
  switchTurn();
}

async function switchTurn() {
  G.currentPlayer = opp(G.currentPlayer);
  G.turn++;
  G.animating = false;
  showTurnOverlay(G.players[G.currentPlayer].name + "'s Turn");
  await delay(1000);
  startTurn();
}

// ============================================================
// ACTIONS
// ============================================================
function actionGrantEnergy(target) {
  if (G.animating) return;
  if (isOnline) {
    // Find target slot info
    const myP = me();
    let targetSlot, benchIdx;
    if (target === myP.active) { targetSlot = 'active'; benchIdx = null; }
    else { targetSlot = 'bench'; benchIdx = myP.bench.indexOf(target); }
    sendAction({ actionType: 'grantEnergy', targetSlot, benchIdx });
    return;
  }
  const p = cp();
  const cost = (target.name === 'Regigigas' || (getPokemonData(target.name).ability && getPokemonData(target.name).ability.key === 'slowStart')) ? 2 : 1;
  if (p.mana < cost || target.energy >= 5) return;
  p.mana -= cost;
  target.energy++;
  const enSel = findPokemonSelector(target);
  if (enSel) { showEnergyPopup(enSel, '+1 ⚡'); animateEl(enSel, 'energy-gain', 400); }

  // Healing Scarf
  if (target.heldItem === 'Healing Scarf' && target.damage > 0) {
    target.damage = Math.max(0, target.damage - 20);
    target.hp = target.maxHp - target.damage;
    const hsSel = findPokemonSelector(target);
    if (hsSel) { showDamagePopupAt(20, hsSel, true); animateEl(hsSel, 'heal-pulse', 500); }
    addLog(`Healing Scarf heals ${target.name} 20`, 'heal');
  }

  // Biting Whirlpool (opponent check)
  const oppAll = [op().active, ...op().bench].filter(Boolean);
  oppAll.forEach(pk => {
    const d = getPokemonData(pk.name);
    if (d.ability && d.ability.key === 'bitingWhirlpool' && !isPassiveBlocked()) {
      dealDamage(target, 10, G.currentPlayer);
      addLog(`Biting Whirlpool deals 10 to ${target.name}`, 'effect');
    }
  });

  addLog(`Granted ${target.name} +1 energy (${cost} mana)`, '');

  // Determine which slot this target is in for animation
  const meP = cp();
  if (target === meP.active) {
    animateEl('#youField .active-slot', 'energy-gain', 400);
    spawnParticlesAtEl('#youField .active-slot', '#F7D02C', 6, {spread:30, size:4});
  } else {
    const bIdx = meP.bench.indexOf(target);
    if (bIdx >= 0) {
      const sel = `#youField .field-bench-row .bench-slot:nth-child(${bIdx + 1})`;
      animateEl(sel, 'energy-gain', 400);
      spawnParticlesAtEl(sel, '#F7D02C', 6, {spread:25, size:4});
    }
  }
  renderBattle();
}

// Shared fx processing for attack effects (used by both actionAttack and actionCopiedAttack)
async function processAttackFx(fx, attacker, defender, attack, p) {
  // Attacker metadata is used by multiple effect handlers.
  const attackerData = getPokemonData(attacker.name);
  // Status effects from attack
  if (fx.includes('poison') && defender && defender.hp > 0 && !(defender.heldItem === 'Protect Goggles') && !defender.status.includes('poison')) {
    defender.status.push('poison'); addLog(`${defender.name} is Poisoned!`, 'effect');
    animateEl("#oppField .active-slot", "status-apply", 500);
    spawnParticlesAtEl("#oppField .active-slot", '#A33EA1', 10, {spread:40});
    renderBattle(); await delay(500);
  }
  if (fx.includes('burn') && !fx.includes('hexBurn') && defender && defender.hp > 0 && !(defender.heldItem === 'Protect Goggles') && !defender.status.includes('burn')) {
    defender.status.push('burn'); addLog(`${defender.name} is Burned!`, 'effect');
    animateEl("#oppField .active-slot", "status-apply", 500);
    spawnParticlesAtEl("#oppField .active-slot", '#EE8130', 10, {spread:40});
    renderBattle(); await delay(500);
  }
  if (fx.includes('sleep') && defender && defender.hp > 0 && !(defender.heldItem === 'Protect Goggles') && !defender.status.includes('sleep')) {
    defender.status.push('sleep'); addLog(`${defender.name} fell Asleep!`, 'effect');
    animateEl("#oppField .active-slot", "status-apply", 500);
    spawnParticlesAtEl("#oppField .active-slot", '#6b7280', 10, {spread:40});
    renderBattle(); await delay(500);
  }

  // Energy strip
  if (fx.includes('stripEnergy:') && defender && defender.hp > 0) {
    const v = parseInt(fx.split('stripEnergy:')[1]);
    const actual = Math.min(v, defender.energy);
    if (defender.heldItem === 'White Herb' && !defender.heldItemUsed) {
      const prevented = Math.min(actual, 2);
      defender.energy -= Math.max(0, actual - prevented);
      defender.heldItemUsed = true; defender.heldItem = null;
      addLog(`White Herb prevents energy loss! (Discarded)`, 'effect');
    } else {
      defender.energy = Math.max(0, defender.energy - v);
    }
    addLog(`Stripped ${actual} energy from ${defender.name}`, 'effect');
  }

  // Self damage (no item bonuses since not hitting opp active)
  if (fx.includes('selfDmg:')) {
    const v = parseInt(fx.split('selfDmg:')[1]);
    const selfAtk = {...attack, baseDmg: v};
    const selfRes = calcDamage(attacker, attacker, selfAtk, attackerData.types, G.currentPlayer);
    if (selfRes.filtered) { addLog(`${attacker.name}'s Filter blocks the recoil!`, 'effect'); }
    else if (selfRes.damage > 0) {
      dealDamage(attacker, selfRes.damage, G.currentPlayer);
      showDamagePopupAt(selfRes.damage, getPokemonSelector(meNum(), -1), false);
    }
  }
  if (fx.includes('selfEnergyLoss:')) {
    let v = parseInt(fx.split('selfEnergyLoss:')[1]);
    if (v >= 99) v = attacker.energy;
    if (attacker.heldItem === 'White Herb' && !attacker.heldItemUsed) {
      v = Math.max(0, v - 2); attacker.heldItemUsed = true; attacker.heldItem = null;
      addLog(`White Herb saves 2 energy! (Discarded)`, 'effect');
    }
    attacker.energy = Math.max(0, attacker.energy - v);
  }

  // Self shield
  if (fx.includes('selfShield:')) { const v = parseInt(fx.split('selfShield:')[1]); attacker.shields.push(v); }

  // Self vulnerability
  if (fx.includes('selfVuln:')) { const v = parseInt(fx.split('selfVuln:')[1]); attacker.vulnerability = v; }

  // Self sleep
  if (fx.includes('selfSleep') && !attacker.status.includes('sleep')) { attacker.status.push('sleep'); addLog(`${attacker.name} fell asleep!`, 'effect'); }

  // Self retreat
  if (fx.includes('selfRetreat') && p.bench.length > 0) {
    G.pendingRetreats.push({ player: G.currentPlayer, reason: 'forced', afterEndTurn: true });
    renderBattle();
    return 'pendingRetreat';
  }

  // Force switch opponent
  if (fx.includes('forceSwitch') && op().bench.length > 0 && defender && defender.hp > 0) {
    const newActive = op().bench.shift();
    if (op().active.status.length > 0) { addLog(`${op().active.name}'s ${op().active.status.join(', ')} was cured on bench!`, 'heal'); op().active.status = []; }
    op().bench.push(op().active);
    op().active = newActive;
    addLog(`${defender.name} was forced to switch!`, 'info');
  }

  // Bench damage (runs through full damage calc)
  if (fx.includes('benchAll:')) {
    const v = parseInt(fx.split('benchAll:')[1]);
    const benchAllAtk = {...attack, baseDmg: v};
    [...p.bench, ...op().bench].forEach(pk => {
      const ownerNum = p.bench.includes(pk) ? G.currentPlayer : opp(G.currentPlayer);
      const res = calcDamage(attacker, pk, benchAllAtk, attackerData.types, ownerNum);
      if (res.filtered) { addLog(`${pk.name}'s Filter blocks the damage!`, 'effect'); return; }
      if (res.damage > 0) {
        const benchIdx = p.bench.includes(pk) ? p.bench.indexOf(pk) : op().bench.indexOf(pk);
        const sel = getPokemonSelector(ownerNum, benchIdx);
        showDamagePopupAt(res.damage, sel, false);
        animateEl(sel, 'hit-shake', 500);
        const ko = dealDamage(pk, res.damage, ownerNum);
        if (ko) handleKO(pk, ownerNum);
      }
    });
    addLog(`Bench damage to all benches`, 'damage');
  }
  if (fx.includes('oppBenchDmg:')) {
    const v = parseInt(fx.split('oppBenchDmg:')[1]);
    const oppBenchAtk = {...attack, baseDmg: v};
    op().bench.forEach(pk => {
      const res = calcDamage(attacker, pk, oppBenchAtk, attackerData.types, opp(G.currentPlayer));
      if (res.filtered) { addLog(`${pk.name}'s Filter blocks the damage!`, 'effect'); return; }
      if (res.damage > 0) {
        const sel = getPokemonSelector(opp(G.currentPlayer), op().bench.indexOf(pk));
        showDamagePopupAt(res.damage, sel, false);
        animateEl(sel, 'hit-shake', 500);
        const ko = dealDamage(pk, res.damage, opp(G.currentPlayer));
        if (ko) handleKO(pk, opp(G.currentPlayer));
      }
    });
  }
  if (fx.includes('sniperBench:')) {
    const v = parseInt(fx.split('sniperBench:')[1]);
    const allTargets = [];
    op().bench.forEach((pk,bi) => { if (pk.hp > 0) allTargets.push({player:opp(G.currentPlayer),idx:bi,pk:pk}); });
    cp().bench.forEach((pk,bi) => { if (pk.hp > 0) allTargets.push({player:G.currentPlayer,idx:bi,pk:pk}); });
    if (allTargets.length > 0) {
      const sniperAttack = {...attack, baseDmg: v};
      G.targeting = { type:"sniperBench", validTargets:allTargets, callback:async function(tPk,tOwner){
        const result = calcDamage(attacker, tPk, sniperAttack, attackerData.types, tOwner);
        const targetSel = getPokemonSelector(tOwner, allTargets.find(t => t.pk === tPk)?.idx ?? -1);
        if (result.filtered) {
          addLog(`${tPk.name}'s Filter blocks the damage!`, 'effect');
        } else {
          showDamagePopup(result.damage, result.mult, targetSel);
          animateEl(targetSel, getShakeClass(result.damage), getShakeDuration(result.damage));
          const attackerColor = TYPE_PARTICLE_COLORS[attackerData.types[0]] || '#ef4444';
          spawnParticlesAtEl(targetSel, attackerColor, result.damage >= 50 ? 14 : 8, {spread: result.damage >= 50 ? 55 : 40});
          const ko = dealDamage(tPk, result.damage, tOwner);
          addLog(result.damage+" snipe to "+tPk.name, "damage");
          if (result.mult > 1) addLog("Super Effective!", "effect");
          if (result.mult < 1) addLog("Not very effective...", "info");
          renderBattle();
          await delay(600);
          if (ko) handleKO(tPk, tOwner);
          await delay(400);
        }
        finalizeAttack();
      }};
      renderBattle();
      return 'pendingTarget';
    }
  }
  if (fx.includes('selfBenchDmg:')) {
    const v = parseInt(fx.split('selfBenchDmg:')[1]);
    if (p.bench.length > 0) {
      const target = p.bench[0];
      const sbAtk = {...attack, baseDmg: v};
      const sbRes = calcDamage(attacker, target, sbAtk, attackerData.types, G.currentPlayer);
      if (sbRes.filtered) { addLog(`${target.name}'s Filter blocks the damage!`, 'effect'); }
      else if (sbRes.damage > 0) {
        const sel = getPokemonSelector(meNum(), 0);
        showDamagePopupAt(sbRes.damage, sel, false);
        animateEl(sel, 'hit-shake', 500);
        dealDamage(target, sbRes.damage, G.currentPlayer);
        addLog(`Collateral: ${sbRes.damage} to ${target.name}`, 'damage');
      }
    }
  }

  // Grass weakness
  if (fx.includes('grassWeakness')) {
    addLog(`Forest's Curse: all opponents gain Grass weakness!`, 'effect');
    const oppPokemon = [op().active, ...op().bench].filter(Boolean);
    oppPokemon.forEach(pk => { pk.grassWeakUntil = G.turn + 2; });
  }

  // Opponent mana loss
  if (fx.includes('oppMana:')) {
    const v = parseInt(fx.split('oppMana:')[1]);
    op().mana = Math.max(0, op().mana + v);
    addLog(`Opponent lost ${Math.abs(v)} mana`, 'effect');
  }

  // Heal self
  if (fx.includes('healSelf:')) {
    const v = parseInt(fx.split('healSelf:')[1]);
    attacker.damage = Math.max(0, attacker.damage - v);
    attacker.hp = attacker.maxHp - attacker.damage;
    showDamagePopupAt(v, getPokemonSelector(meNum(), -1), true);
    animateEl(getPokemonSelector(meNum(), -1), 'heal-pulse', 500);
    addLog(`${attacker.name} healed ${v}`, 'heal');
  }

  // Lock next use
  if (fx.includes('lockAttack')) { attacker.cantUseAttack = attack.name; }

  // Mad Party (full damage calc)
  if (fx === 'madParty' && defender) {
    const totalPokemon = [p.active, ...p.bench, op().active, ...op().bench].filter(Boolean).length;
    const madAtk = {...attack, baseDmg: totalPokemon * 10};
    const madResult = calcDamage(attacker, defender, madAtk, attackerData.types, opp(G.currentPlayer));
    if (madResult.filtered) {
      addLog(`${defender.name}'s Filter blocks the damage!`, 'effect');
    } else if (madResult.damage > 0) {
      const ko = dealDamage(defender, madResult.damage, opp(G.currentPlayer));
      addLog(`Mad Party: ${totalPokemon} Pokémon = ${madResult.damage} damage!`, 'damage');
      showDamagePopup(madResult.damage, madResult.mult);
      if (ko) handleKO(defender, opp(G.currentPlayer));
    }
  }

  // Finishing Fang (full damage calc on bonus)
  if (fx === 'finishingFang' && defender && defender.hp > 0) {
    if (defender.hp <= 120) {
      const fangAtk = {...attack, baseDmg: 60};
      const fangResult = calcDamage(attacker, defender, fangAtk, attackerData.types, opp(G.currentPlayer));
      if (fangResult.filtered) {
        addLog(`${defender.name}'s Filter blocks the bonus damage!`, 'effect');
      } else if (fangResult.damage > 0) {
        const ko = dealDamage(defender, fangResult.damage, opp(G.currentPlayer));
        addLog(`Finishing Fang bonus: +${fangResult.damage} (target low HP)!`, 'damage');
        if (ko) handleKO(defender, opp(G.currentPlayer));
      }
    }
  }

  // Hex Burn
  if (fx === 'hexBurn' && defender && defender.hp > 0 && defender.status.length > 0 && !(defender.heldItem === 'Protect Goggles')) {
    if (!defender.status.includes('burn')) defender.status.push('burn');
    addLog(`Hex Burn: ${defender.name} is now Burned!`, 'effect');
  }

  // Confusion Wave
  if (fx === 'confuseBoth') {
    if (attacker.hp > 0 && !(attacker.heldItem === 'Protect Goggles') && !attacker.status.includes('confusion')) { attacker.status.push('confusion'); addLog(`${attacker.name} is Confused!`, 'effect'); }
    if (defender && defender.hp > 0 && !(defender.heldItem === 'Protect Goggles') && !defender.status.includes('confusion')) { defender.status.push('confusion'); addLog(`${defender.name} is Confused!`, 'effect'); }
  }

  // Swarm Snipe — choose any target, 10 per your Pokémon, full damage calc
  if (fx === 'swarmSnipe') {
    const myCount = [p.active, ...p.bench].filter(Boolean).length;
    const swarmBaseDmg = myCount * 10;
    const validTargets = [];
    [G.currentPlayer, opp(G.currentPlayer)].forEach(pNum => {
      const side = G.players[pNum];
      if (side.active && side.active.hp > 0) validTargets.push({player:pNum,idx:-1,pk:side.active});
      side.bench.forEach((pk,bi) => { if (pk.hp > 0) validTargets.push({player:pNum,idx:bi,pk:pk}); });
    });
    if (validTargets.length > 0) {
      const swarmAttack = {...attack, baseDmg: swarmBaseDmg};
      G.targeting = { type:"swarmSnipe", validTargets:validTargets, callback:async function(tPk,tOwner){
        const result = calcDamage(attacker, tPk, swarmAttack, attackerData.types, tOwner);
        const targetSel = getPokemonSelector(tOwner, validTargets.find(t => t.pk === tPk)?.idx ?? -1);
        if (result.filtered) {
          addLog(`${tPk.name}'s Filter blocks the damage!`, 'effect');
        } else {
          showDamagePopup(result.damage, result.mult, targetSel);
          animateEl(targetSel, getShakeClass(result.damage), getShakeDuration(result.damage));
          spawnParticlesAtEl(targetSel, '#A6B91A', 10, {spread:45});
          const ko = dealDamage(tPk, result.damage, tOwner);
          addLog(`Swarm Snipe: ${myCount} Pokémon = ${result.damage} to ${tPk.name}!`, 'damage');
          if (result.mult > 1) addLog("Super Effective!", "effect");
          if (result.mult < 1) addLog("Not very effective...", "info");
          renderBattle();
          await delay(600);
          if (ko) handleKO(tPk, tOwner);
          await delay(400);
        }
        finalizeAttack();
      }};
      renderBattle();
      return 'pendingTarget';
    }
  }

  // Conditional bench damage (full damage calc)
  if (fx.includes('condBench:') && op().bench.length > 0) {
    const parts = fx.split('condBench:')[1].split(':');
    const threshold = parseInt(parts[0]);
    const dmg = parseInt(parts[1]);
    if (attacker.energy >= threshold) {
      const condAtk = {...attack, baseDmg: dmg};
      op().bench.forEach(pk => {
        const res = calcDamage(attacker, pk, condAtk, attackerData.types, opp(G.currentPlayer));
        if (res.filtered) { addLog(`${pk.name}'s Filter blocks the damage!`, 'effect'); return; }
        if (res.damage > 0) {
          const sel = getPokemonSelector(opp(G.currentPlayer), op().bench.indexOf(pk));
          showDamagePopupAt(res.damage, sel, false);
          animateEl(sel, 'hit-shake', 500);
          const ko = dealDamage(pk, res.damage, opp(G.currentPlayer));
          if (ko) handleKO(pk, opp(G.currentPlayer));
        }
      });
      addLog(`Bench damage to each opponent bench (${attacker.energy} energy)!`, 'damage');
    }
  }

  // Optional boost (full damage calc) — requires player choice (offline)
  if (useOptBoostThisAttack && fx.includes('optBoost:') && defender && defender.hp > 0) {
    const parts = fx.split('optBoost:')[1].split(':');
    const extraDmg = parseInt(parts[0]);
    const energyCost = parseInt(parts[1]);
    if (attacker.energy >= energyCost) {
      attacker.energy -= energyCost;
      const boostAtk = {...attack, baseDmg: extraDmg};
      const boostResult = calcDamage(attacker, defender, boostAtk, attackerData.types, opp(G.currentPlayer));
      if (boostResult.filtered) {
        addLog(`${defender.name}'s Filter blocks the bonus damage!`, 'effect');
      } else if (boostResult.damage > 0) {
        const ko = dealDamage(defender, boostResult.damage, opp(G.currentPlayer));
        addLog(`Boosted: +${boostResult.damage} damage (lost ${energyCost} energy)!`, 'damage');
        if (ko) handleKO(defender, opp(G.currentPlayer));
      }
    }
  }
  // Always reset after processing optBoost
  useOptBoostThisAttack = false;

  // Any strip
  if (fx.includes('anyStrip:')) {
    const v = parseInt(fx.split('anyStrip:')[1]);
    const oppAll = [op().active, ...op().bench].filter(pk => pk && pk.energy > 0 && !(pk.heldItem === 'Protect Goggles'));
    if (oppAll.length > 0) {
      const target = oppAll[0];
      const actual = Math.min(v, target.energy);
      target.energy = Math.max(0, target.energy - actual);
      addLog(`Stripped ${actual} energy from ${target.name}`, 'effect');
    }
  }

  // Multi-target (full damage calc)
  if (fx.includes('multiTarget:')) {
    const parts = fx.split('multiTarget:')[1].split(':');
    const dmg = parseInt(parts[0]);
    const count = parseInt(parts[1]);
    const targets = [op().active, ...op().bench].filter(Boolean).slice(0, count);
    const multiAtk = {...attack, baseDmg: dmg};
    targets.forEach(target => {
      const res = calcDamage(attacker, target, multiAtk, attackerData.types, opp(G.currentPlayer));
      if (res.filtered) { addLog(`${target.name}'s Filter blocks the damage!`, 'effect'); return; }
      if (res.damage > 0) {
        const tIdx = target === op().active ? -1 : op().bench.indexOf(target);
        const sel = getPokemonSelector(opp(G.currentPlayer), tIdx);
        showDamagePopupAt(res.damage, sel, false);
        animateEl(sel, getShakeClass(res.damage), getShakeDuration(res.damage));
        const ko = dealDamage(target, res.damage, opp(G.currentPlayer));
        addLog(`${res.damage} to ${target.name}`, 'damage');
        if (ko) handleKO(target, opp(G.currentPlayer));
      }
    });
    attacker.energy = Math.max(0, attacker.energy - 2);
  }

  // Baton Pass
  if (fx === 'batonPass' && p.bench.length > 0) {
    G.pendingRetreats.push({ player: G.currentPlayer, reason: 'batonPass', afterEndTurn: true, transferEnergy: attacker.energy });
    attacker.attackedThisTurn = true;
    renderBattle();
    return 'pendingRetreat';
  }

  return null;
}

// ============================================================
// SHARED ATTACK HELPERS (used by both actionAttack & actionCopiedAttack)
// ============================================================

// Status check before any attack — returns 'blocked', 'ended', or 'ok'
async function checkStatusBeforeAttackClient(attacker) {
  if (attacker.status.includes('sleep')) {
    addLog(`${attacker.name} is Asleep and can't attack!`, 'info');
    return 'blocked';
  }
  if (attacker.status.includes('confusion')) {
    if (Math.random() < 0.5) {
      attacker.status = attacker.status.filter(s => s !== 'confusion');
      addLog(`${attacker.name} snapped out of Confusion! (Heads)`, 'info');
      return 'ok';
    } else {
      addLog(`${attacker.name} is Confused! Attack failed (Tails)`, 'info');
      await endTurn();
      return 'ended';
    }
  }
  return 'ok';
}

// Pre-damage effects (selfEnergy, gainMana, benchEnergyAll, benchEnergy)
function processPreDamageEffectsClient(fx, attacker, p) {
  if (fx.includes('selfEnergy:')) {
    const v = parseInt(fx.split('selfEnergy:')[1]);
    attacker.energy = Math.min(5, attacker.energy + v);
    showEnergyPopup(getPokemonSelector(meNum(), -1), '+' + v + ' ⚡');
    animateEl(getPokemonSelector(meNum(), -1), 'energy-gain', 400);
    if (attacker.heldItem === 'Healing Scarf' && attacker.damage > 0 && v > 0) {
      attacker.damage = Math.max(0, attacker.damage - 20 * v);
      attacker.hp = attacker.maxHp - attacker.damage;
      showDamagePopupAt(20*v, getPokemonSelector(meNum(), -1), true);
      animateEl(getPokemonSelector(meNum(), -1), 'heal-pulse', 500);
      addLog(`Healing Scarf heals ${attacker.name} ${20*v}`, 'heal');
    }
  }
  if (fx.includes('gainMana:')) { const v = parseInt(fx.split('gainMana:')[1]); p.mana = Math.min(10, p.mana + v); showManaPopup(v); addLog(`Gained ${v} mana`, 'info'); }
  if (fx.includes('benchEnergyAll')) {
    p.bench.forEach((pk, i) => { if (pk.energy < 5) { pk.energy++; const sel = getPokemonSelector(meNum(), i); showEnergyPopup(sel, '+1 ⚡'); animateEl(sel, 'energy-gain', 400); } });
    addLog(`Gift Delivery: bench +1 energy each`, 'info');
  }
  if (fx.includes('benchEnergy:')) {
    const target = p.bench.find(pk => pk.energy < 5);
    if (target) { target.energy++; const sel = getPokemonSelector(meNum(), p.bench.indexOf(target)); showEnergyPopup(sel, '+1 ⚡'); animateEl(sel, 'energy-gain', 400); addLog(`${target.name} gained +1 energy`, 'info'); }
  }
}

// Shared damage dealing + animation + reactive items + KO handling
async function performAttackDamage(attacker, defender, attack, attackerTypes, fx) {
  const needsDmg = attack.baseDmg > 0 || fx.includes('berserk') || fx.includes('scaleDef') || fx.includes('scaleBoth') || fx.includes('scaleOwn') || fx.includes('scaleBench') || fx.includes('sustained') || fx.includes('bonusDmg') || fx.includes('fullHpBonus') || fx.includes('payback') || fx.includes('scaleDefNeg');
  if (!needsDmg || !defender) return;

  const result = calcDamage(attacker, defender, attack, attackerTypes, opp(G.currentPlayer));

  if (result.filtered) {
    addLog(`${defender.name}'s Filter blocks the damage!`, 'effect');
    renderBattle();
    await delay(500);
  } else if (result.damage > 0) {
    const ko = dealDamage(defender, result.damage, opp(G.currentPlayer));
    let effText = '';
    if (result.mult > 1) effText = ' (Super Effective!)';
    if (result.mult < 1) effText = ' (Resisted)';
    const redText = result.reduction > 0 ? ` (-${result.reduction} reduced)` : '';
    addLog(`${attack.name} deals ${result.damage} to ${defender.name}${effText}${redText}`, 'damage');
    showDamagePopup(result.damage, result.mult);
    animateEl("#oppField .active-slot", getShakeClass(result.damage), getShakeDuration(result.damage));
    const attackerColor = TYPE_PARTICLE_COLORS[attackerTypes[0]] || '#ef4444';
    const particleCount = result.damage >= 100 ? 22 : result.damage >= 50 ? 18 : 14;
    spawnParticlesAtEl("#oppField .active-slot", attackerColor, particleCount, {spread: result.damage >= 100 ? 75 : 55});
    renderBattle();
    await delay(result.damage >= 100 ? 1400 : result.damage >= 50 ? 1100 : 900);

    // Reactive items on defender
    if (defender.heldItem === 'Rocky Helmet') {
      dealDamage(attacker, 30, G.currentPlayer);
      showDamagePopupAt(30, '#youField .active-slot', false);
      addLog(`Rocky Helmet deals 30 back!`, 'damage');
      animateEl("#oppField .active-slot", "item-proc", 600);
      spawnParticlesAtEl("#oppField .active-slot", '#B7B7CE', 8, {spread:40});
      await delay(400);
    }
    if (defender.heldItem === 'Burn Scarf' && !(attacker.heldItem === 'Protect Goggles')) {
      dealDamage(attacker, 10, G.currentPlayer);
      showDamagePopupAt(10, '#youField .active-slot', false);
      if (!attacker.status.includes('burn')) attacker.status.push('burn');
      addLog(`Burn Scarf: 10 damage + Burn!`, 'effect');
      animateEl("#oppField .active-slot", "item-proc", 600);
      spawnParticlesAtEl("#youField .active-slot", '#EE8130', 10, {spread:40});
      await delay(400);
    }
    if (defender.heldItem === 'Poison Barb' && !(attacker.heldItem === 'Protect Goggles')) {
      dealDamage(attacker, 10, G.currentPlayer);
      showDamagePopupAt(10, '#youField .active-slot', false);
      if (!attacker.status.includes('poison')) attacker.status.push('poison');
      addLog(`Poison Barb: 10 damage + Poison!`, 'effect');
      animateEl("#oppField .active-slot", "item-proc", 600);
      spawnParticlesAtEl("#youField .active-slot", '#A33EA1', 10, {spread:40});
      await delay(400);
    }
    if (defender.heldItem === 'Loud Bell' && !(attacker.heldItem === 'Protect Goggles')) {
      dealDamage(attacker, 10, G.currentPlayer);
      showDamagePopupAt(10, '#youField .active-slot', false);
      if (!attacker.status.includes('confusion')) attacker.status.push('confusion');
      addLog(`Loud Bell: 10 damage + Confusion!`, 'effect');
      animateEl("#oppField .active-slot", "item-proc", 600);
      spawnParticlesAtEl("#youField .active-slot", '#eab308', 10, {spread:40});
      await delay(400);
    }

    // Shell Bell heal
    if (attacker.heldItem === 'Shell Bell') {
      attacker.damage = Math.max(0, attacker.damage - 30);
      attacker.hp = attacker.maxHp - attacker.damage;
      showDamagePopupAt(30, '#youField .active-slot', true);
      addLog(`Shell Bell heals ${attacker.name} 30`, 'heal');
      animateEl("#youField .active-slot", "heal-pulse", 500);
      spawnParticlesAtEl("#youField .active-slot", '#4ade80', 8, {spread:35});
      renderBattle();
      await delay(400);
    }

    // Life Orb recoil
    if (attacker.heldItem === 'Life Orb') {
      dealDamage(attacker, 10, G.currentPlayer);
      showDamagePopupAt(10, '#youField .active-slot', false);
      addLog(`Life Orb recoil: 10 to ${attacker.name}`, 'damage');
      renderBattle();
      await delay(300);
    }

    await delay(300);
    if (ko) {
      animateEl("#oppField .active-slot", "ko-fall", 600);
      spawnParticlesAtEl("#oppField .active-slot", '#ef4444', 20, {spread:70, size:4});
      await delay(600);
      handleKO(defender, opp(G.currentPlayer));
    }
    await delay(400);
  } else {
    addLog(`${attack.name} dealt 0 damage`, '');
  }
}

// Shared snipe targeting callback
function createSnipeCallback(attacker, attack, attackerTypes, fx, validTargets, p) {
  return async function(tPk, tOwner) {
    const snipeResult = calcDamage(attacker, tPk, attack, attackerTypes, tOwner);
    const targetSel = getPokemonSelector(tOwner, validTargets.find(t => t.pk === tPk)?.idx ?? -1);
    if (snipeResult.filtered) {
      addLog(`${tPk.name}'s Filter blocks the damage!`, 'effect');
    } else {
      showDamagePopup(snipeResult.damage, snipeResult.mult, targetSel);
      animateEl(targetSel, getShakeClass(snipeResult.damage), getShakeDuration(snipeResult.damage));
      const attackerColor = TYPE_PARTICLE_COLORS[attackerTypes[0]] || '#fff';
      spawnParticlesAtEl(targetSel, attackerColor, 12, {spread:50});
      const ko = dealDamage(tPk, snipeResult.damage, tOwner);
      addLog(attack.name+" hits "+tPk.name+" for "+snipeResult.damage+"!", "damage");
      if (snipeResult.mult > 1) addLog("Super Effective!", "effect");
      if (snipeResult.mult < 1) addLog("Not very effective...", "info");
      renderBattle();
      await delay(600);
      if (ko) handleKO(tPk, tOwner);
      await delay(400);
    }
    const fxResult2 = await processAttackFx(fx, attacker, tPk, attack, p);
    if (fxResult2 === 'pendingRetreat' || fxResult2 === 'pendingTarget') return;
    finalizeAttack();
  };
}

// Shared attack execution core — handles damage, fx, sustained, endTurn
async function executeAttackClient(attacker, attack, attackerTypes, fx, p) {
  const defender = op().active;

  // Pre-damage effects
  processPreDamageEffectsClient(fx, attacker, p);

  // Snipe targeting
  if (fx.includes("snipe") && !fx.includes("sniperBench") && !fx.includes("swarmSnipe")) {
    const validTargets = [];
    [G.currentPlayer, opp(G.currentPlayer)].forEach(pNum => {
      const side = G.players[pNum];
      if (side.active && side.active.hp > 0) validTargets.push({player:pNum,idx:-1,pk:side.active});
      side.bench.forEach((pk,bi) => { if (pk.hp > 0) validTargets.push({player:pNum,idx:bi,pk:pk}); });
    });
    if (validTargets.length > 0) {
      G.targeting = { type:"snipe", validTargets, callback: createSnipeCallback(attacker, attack, attackerTypes, fx, validTargets, p) };
      renderBattle(); return;
    }
  }

  if (!defender) { G.animating = false; return; }

  // Deal damage
  await performAttackDamage(attacker, defender, attack, attackerTypes, fx);

  // Process fx
  const fxResult = await processAttackFx(fx, attacker, defender, attack, p);
  if (fxResult === 'pendingRetreat' || fxResult === 'pendingTarget') return;

  // Sustained + self-KO + endTurn
  attacker.attackedThisTurn = true;
  if (attacker.hp <= 0) handleKO(attacker, G.currentPlayer);
  if (G.pendingRetreats.length === 0 && !G.targeting && !G.winner) {
    await endTurn();
  }
}

// ============================================================
// ATTACK ENTRY POINTS
// ============================================================

async function actionAttack(attackIndex) {
  if (G.animating) return;
  if (isOnline) {
    const myP = me();
    const attacker = myP.active;
    if (!attacker) return;
    const data = getPokemonData(attacker.name);
    const attack = data.attacks[attackIndex];
    let useOptBoost = false;
    if (attack && attack.fx && attack.fx.includes('optBoost:')) {
      const parts = attack.fx.split('optBoost:')[1].split(':');
      const extraDmg = parseInt(parts[0]);
      const energyCost = parseInt(parts[1]);
      if (attacker.energy >= energyCost) {
        useOptBoost = confirm(`${attack.name}: Add +${extraDmg} damage by spending ${energyCost} energy?`);
      }
    }
    sendAction({ actionType: 'attack', attackIndex, useOptBoost });
    return;
  }
  G.animating = true;
  const p = cp();
  const attacker = p.active;
  if (!attacker) { G.animating = false; return; }
  const data = getPokemonData(attacker.name);

  // Defeatist check
  if (data.ability && data.ability.key === 'defeatist' && attacker.damage >= 120 && !isPassiveBlocked()) {
    addLog(`${attacker.name} can't attack (Defeatist)!`, 'info');
    G.animating = false; return;
  }

  const statusResult = await checkStatusBeforeAttackClient(attacker);
  if (statusResult === 'blocked') { G.animating = false; return; }
  if (statusResult === 'ended') return;

  const attack = data.attacks[attackIndex];

  // Optional boost choice (offline)
  if (attack && attack.fx && attack.fx.includes('optBoost:')) {
    const parts = attack.fx.split('optBoost:')[1].split(':');
    const extraDmg = parseInt(parts[0]);
    const energyCost = parseInt(parts[1]);
    if (attacker.energy >= energyCost) {
      useOptBoostThisAttack = confirm(`${attack.name}: Add +${extraDmg} damage by spending ${energyCost} energy?`);
    } else {
      useOptBoostThisAttack = false;
    }
  } else {
    useOptBoostThisAttack = false;
  }

  // Energy cost with Quick Claw + Thick Aroma
  let energyCost = attack.energy;
  if (attacker.quickClawActive) { energyCost = Math.max(0, energyCost - 2); }
  const oppActiveTA = op().active;
  if (oppActiveTA && !isPassiveBlocked()) {
    const oppDataTA = getPokemonData(oppActiveTA.name);
    if (oppDataTA.ability && oppDataTA.ability.key === 'thickAroma') energyCost += 1;
  }
  if (attacker.energy < energyCost) return;

  // Locked attack check
  if (attacker.cantUseAttack === attack.name) {
    addLog(`Can't use ${attack.name} this turn!`, 'info');
    G.animating = false; return;
  }

  // Consume Quick Claw
  if (attacker.quickClawActive) { attacker.quickClawActive = false; attacker.heldItemUsed = true; attacker.heldItem = null; addLog('Quick Claw activated! (Discarded)', 'effect'); }

  const fx = attack.fx || '';

  // Animation: attack declaration
  addLog(attacker.name + " uses " + attack.name + "!", "info");
  renderBattle();
  focusOnActives();
  await delay(300);
  animateEl("#youField .active-slot", "attacking", 400);
  await delay(400);

  await executeAttackClient(attacker, attack, data.types, fx, p);
}

function actionRetreat() {
  if (G.animating) return;
  if (isOnline) { sendAction({ actionType: 'retreat' }); return; }
  const p = cp();
  if (!p.active || p.bench.length === 0) return;

  // Sleep check - can't retreat while asleep
  if (p.active.status.includes('sleep')) { addLog(`${p.active.name} is Asleep and can't retreat!`, 'info'); return; }

  // Blockade check
  const oppAll = [op().active, ...op().bench].filter(Boolean);
  const blocked = oppAll.some(pk => getPokemonData(pk.name).ability && getPokemonData(pk.name).ability.key === 'blockade' && pk === op().active && !isPassiveBlocked());
  if (blocked && !(p.active.heldItem === 'Protect Goggles')) {
    addLog(`Blockade prevents retreat!`, 'effect');
    return;
  }

  G.pendingRetreats.push({ player: G.currentPlayer, reason: 'retreat' });
  renderBattle();
}

function actionQuickRetreat() {
  if (G.animating) return;
  if (isOnline) { sendAction({ actionType: 'quickRetreat' }); return; }
  const p = cp();
  if (!p.active || p.bench.length === 0) return;
  if (p.active.status.includes('sleep')) { addLog(`${p.active.name} is Asleep and can't retreat!`, 'info'); return; }
  const cost = p.active.heldItem === 'Float Stone' ? 1 : 2;
  if (p.active.energy < cost) return;

  // Blockade check
  const blocked = op().active && getPokemonData(op().active.name).ability && getPokemonData(op().active.name).ability.key === 'blockade';
  if (blocked && !(p.active.heldItem === 'Protect Goggles')) {
    addLog(`Blockade prevents retreat!`, 'effect');
    return;
  }

  p.active.energy -= cost;
  G.pendingRetreats.push({ player: G.currentPlayer, reason: 'quick' });
  addLog(`Quick Retreat (${cost} energy)`, 'info');
  renderBattle();
}

async function selectBenchForRetreat(idx) {
  if (isOnline) { sendAction({ actionType: 'selectBenchForRetreat', benchIdx: idx }); return; }
  if (G.pendingRetreats.length === 0) return;
  const pr = G.pendingRetreats[0];
  const p = G.players[pr.player];
  const newActive = p.bench[idx];
  if (!newActive) return;

  // Animate the swap: slide out current active, slide in new one
  const side = pr.player === G.currentPlayer ? '#youField' : '#oppField';
  if (p.active && p.active.hp > 0) {
    animateEl(side + ' .active-slot', 'slide-out', 350);
    await delay(350);
  }

  p.bench.splice(idx, 1);
  if (p.active && p.active.hp > 0) {
    p.active.sustained = false;
    p.active.attackedThisTurn = false;
    if (p.active.status.length > 0) { addLog(`${p.active.name}'s ${p.active.status.join(', ')} was cured on bench!`, 'heal'); p.active.status = []; }
    p.bench.push(p.active);
  }
  p.active = newActive;
  addLog(`${newActive.name} is now Active!`, 'info');
  renderBattle();
  animateEl(side + ' .active-slot', 'slide-in', 350);
  await delay(500);

  const reason = pr.reason;
  const afterEnd = pr.afterEndTurn;
  const transferEnergy = pr.transferEnergy || 0;
  G.pendingRetreats.shift(); // Remove the resolved retreat

  // Baton Pass energy transfer - move energy from old active to new active
  if (reason === 'batonPass' && transferEnergy > 0) {
    // Zero out old active's energy (it's now the last bench pokemon)
    const oldActive = p.bench[p.bench.length - 1];
    if (oldActive) oldActive.energy = 0;
    const gained = Math.min(transferEnergy, 5 - newActive.energy);
    newActive.energy += gained;
    addLog(`Baton Pass: ${newActive.name} gained ${gained} energy!`, 'effect');
  }

  // If more pending retreats remain (e.g. double KO), let the next one resolve first
  if (G.pendingRetreats.length > 0) {
    renderBattle();
    return;
  }

  // If this retreat was triggered during endTurn (status tick KO), just switch turns
  if (pr.duringEndTurn) {
    renderBattle();
    await delay(500);
    await switchTurn();
    return;
  }

  if (reason === 'retreat') {
  await endTurn();
  } else if (reason === 'ko') {
    renderBattle();
    await endTurn();
  } else if (reason === 'quick') {
    renderBattle();
    if (afterEnd) await endTurn();
  } else if (reason === 'forced' || reason === 'batonPass') {
    if (afterEnd) await endTurn();
    else renderBattle();
  }
}

function discardHeldItem(slot, benchIdx) {
  if (isOnline) { sendAction({ actionType: 'discardItem', slot, benchIdx }); return; }
  const p = cp();
  const pk = slot === 'active' ? p.active : p.bench[benchIdx];
  if (!pk || !pk.heldItem) return;
  addLog(`Discarded ${pk.heldItem} from ${pk.name}`, 'info');
  pk.heldItem = null;
  renderBattle();
}

function selectTarget(playerNum, benchIdx) {
  if (!G.targeting) return;
  if (isOnline) { sendAction({ actionType: 'selectTarget', targetPlayer: playerNum, targetBenchIdx: benchIdx }); return; }
  const side = G.players[playerNum];
  const targetPk = benchIdx === -1 ? side.active : side.bench[benchIdx];
  if (!targetPk) return;
  const valid = G.targeting.validTargets.some(t => t.player === playerNum && t.idx === benchIdx);
  if (!valid) return;
  const cb = G.targeting.callback;
  G.targeting = null;
  cb(targetPk, playerNum);
}

async function finalizeAttack() {
  const p = cp();
  const attacker = p.active;
  if (attacker) attacker.attackedThisTurn = true;
  if (attacker && attacker.hp <= 0) handleKO(attacker, G.currentPlayer);
  if (G.pendingRetreats.length === 0 && !G.targeting && !G.winner) {
    await endTurn();
  }
}

// Copied attack (Mew Versatility / Ditto Improvise) - stored globally for reference
let copiedAttacks = [];

async function actionCopiedAttack(copiedIdx) {
  if (G.animating) return;
  if (isOnline) {
    const copied = copiedAttacks[copiedIdx];
    if (!copied) return;
    sendAction({ actionType: 'copiedAttack', sourceName: copied.source, attackIndex: copied.attackIndex !== undefined ? copied.attackIndex : copiedIdx });
    return;
  }
  G.animating = true;
  const p = cp();
  const attacker = p.active;
  if (!attacker) { G.animating = false; return; }
  const copied = copiedAttacks[copiedIdx];
  if (!copied) { G.animating = false; return; }
  const attack = copied.attack;
  const attData = getPokemonData(attacker.name);

  // Status check (sleep / confusion)
  const statusResult = await checkStatusBeforeAttackClient(attacker);
  if (statusResult === 'blocked') { G.animating = false; return; }
  if (statusResult === 'ended') return;

  // Energy check with Thick Aroma
  let copiedEnergyCost = attack.energy;
  const oppActiveCA = op().active;
  if (oppActiveCA && !isPassiveBlocked()) {
    const oppDataCA = getPokemonData(oppActiveCA.name);
    if (oppDataCA.ability && oppDataCA.ability.key === 'thickAroma') copiedEnergyCost += 1;
  }
  if (attacker.energy < copiedEnergyCost) { G.animating = false; return; }

  const fx = attack.fx || '';

  // Animation: attack declaration
  addLog(`${attacker.name} uses ${attack.name}! (copied)`, 'info');
  renderBattle();
  focusOnActives();
  await delay(300);
  animateEl("#youField .active-slot", "attacking", 400);
  await delay(400);

  // Use shared attack core with ATTACKER's types (not source's)
  await executeAttackClient(attacker, attack, attData.types, fx, p);
}

function actionPlayPokemon(handIdx) {
  if (G.animating) return;
  if (isOnline && !G.pendingPlayPokemon) {
    // Check if items in hand - resolve locally, then send single message
    const myP = me();
    const card = myP.hand[handIdx];
    if (!card) return;
    const itemsInHand = myP.hand.filter(c => c.type === 'items');
    if (itemsInHand.length > 0 && !card.heldItem) {
      G.pendingPlayPokemon = { handIdx };
      renderItemAttachPrompt(handIdx, itemsInHand);
      return;
    }
    sendAction({ actionType: 'playPokemon', handIdx, itemHandIdx: null });
    return;
  }
  const p = cp();
  const card = p.hand[handIdx];
  if (!card || card.type !== 'pokemon') return;
  const data = getPokemonData(card.name);
  if (p.mana < data.cost || p.bench.length >= 4) return;

  // Check if there are items in hand to attach
  const itemsInHand = p.hand.filter(c => c.type === 'items');
  if (itemsInHand.length > 0 && !card.heldItem) {
    G.pendingPlayPokemon = { handIdx: handIdx };
    renderItemAttachPrompt(handIdx, itemsInHand);
    return;
  }

  finishPlayPokemon(handIdx, null);
}

function renderItemAttachPrompt(handIdx, items) {
  const panel = document.getElementById('apActions');
  let html = '<div class="ap-section-label" style="color:#a855f7">ATTACH A HELD ITEM?</div>';
  items.forEach((item, i) => {
    const realIdx = cp().hand.indexOf(item);
    html += `<button class="ap-btn ap-btn-ability" onclick="finishPlayPokemon(${handIdx}, ${realIdx})">
      <span class="atk-name">${item.name}</span>
    </button>`;
  });
  html += `<button class="ap-btn ap-btn-end" onclick="finishPlayPokemon(${handIdx}, null)">
    <span class="atk-name">No Item</span>
  </button>`;
  panel.innerHTML = html;
}

function finishPlayPokemon(handIdx, itemHandIdx) {
  if (isOnline) {
    G.pendingPlayPokemon = null;
    sendAction({ actionType: 'playPokemon', handIdx, itemHandIdx });
    return;
  }
  const p = cp();
  G.pendingPlayPokemon = null;
  const card = p.hand[handIdx];
  if (!card || card.type !== 'pokemon') return;
  const data = getPokemonData(card.name);
  if (p.mana < data.cost || p.bench.length >= 4) return;

  let heldItem = card.heldItem || null;
  // Remove item from hand if attaching one
  if (itemHandIdx !== null && itemHandIdx !== undefined) {
    const itemCard = p.hand[itemHandIdx];
    if (itemCard && itemCard.type === 'items') {
      heldItem = itemCard.name;
      // Remove higher index first to preserve lower index
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
  const pk = makePokemon(card.name, heldItem);
  p.bench.push(pk);

  addLog(`Played ${pk.name} to bench${heldItem ? ' with ' + heldItem : ''} (${data.cost} mana)`, 'info');

  // On-play abilities
  if (data.ability && data.ability.type === 'onPlay' && data.ability.key === 'soulDrain') {
    if (op().active && op().active.energy > 0) {
      const stripped = Math.min(2, op().active.energy);
      op().active.energy -= stripped;
      addLog(`Soul Drain strips ${stripped} energy!`, 'effect');
    }
  }

  renderBattle();
  // Animate the new bench Pokemon sliding in
  const benchIdx = p.bench.length - 1;
  const sel = '#youField .field-bench-row > :nth-child(' + (benchIdx + 1) + ')';
  animateEl(sel, 'slide-in', 350);
  spawnParticlesAtEl(sel, TYPE_PARTICLE_COLORS[data.types[0]] || '#fff', 8, {spread:30});
}

// ============================================================
// ABILITY ACTIONS
// ============================================================
async function useAbility(key) {
  if (G.animating) return;
  if (isOnline) { sendAction({ actionType: 'useAbility', key }); return; }
  const p = cp();
  if (isNeutralizingGasActive()) { addLog('Neutralizing Gas blocks abilities!', 'effect'); renderBattle(); return; }
  if (p.usedAbilities[key] && key !== 'magicDrain' && key !== 'healingTouch') return;

  if (key === 'creation' && p.active && getPokemonData(p.active.name).ability?.key === 'creation') {
    if (p.mana < 1) return;
    p.mana = Math.min(10, p.mana + 1); // spend 1, gain 2 = net +1
    p.usedAbilities[key] = true;
    addLog('Creation: +1 net mana', 'effect');
  }
  else if (key === 'lullaby') {
    // Kricketune: Confuse opponent's active
    if (!op().active) { addLog('No opponent active!', 'info'); renderBattle(); return; }
    if (op().active.status.includes('confusion')) { addLog(`${op().active.name} is already Confused!`, 'info'); renderBattle(); return; }
    if (op().active.heldItem === 'Protect Goggles') { addLog(`${op().active.name}'s Protect Goggles block it!`, 'effect'); renderBattle(); return; }
    p.usedAbilities[key] = true;
    op().active.status.push('confusion');
    addLog(`Befuddling Melody confuses ${op().active.name}!`, 'effect');
    animateEl("#oppField .active-slot", "status-apply", 500);
    spawnParticlesAtEl("#oppField .active-slot", '#eab308', 10, {spread:40});
  }
  else if (key === 'softTouch') {
    // Heal 10 from any pokemon - target selection
    const validTargets = [];
    [G.currentPlayer, opp(G.currentPlayer)].forEach(pNum => {
      const side = G.players[pNum];
      if (side.active && side.active.damage > 0) validTargets.push({player:pNum,idx:-1,pk:side.active});
      side.bench.forEach((pk,bi) => { if (pk.damage > 0) validTargets.push({player:pNum,idx:bi,pk:pk}); });
    });
    if (validTargets.length > 0) {
      G.targeting = { type:"softTouch", validTargets:validTargets, callback:function(tPk,tOwner){
        tPk.damage = Math.max(0, tPk.damage - 10);
        tPk.hp = tPk.maxHp - tPk.damage;
        p.usedAbilities[key] = true;
        const targetSel = getPokemonSelector(tOwner, validTargets.find(t => t.pk === tPk)?.idx ?? -1);
        showDamagePopupAt(10, targetSel, true);
        addLog("Egg Drop Heal: healed "+tPk.name+" 10!", "heal");
        animateEl(targetSel, 'heal-pulse', 500);
        spawnParticlesAtEl(targetSel, '#4ade80', 8, {spread:30});
        renderBattle();
      }};
      renderBattle();
    }
  }
  else if (key === 'healingTouch') {
    if (p.mana < 1 || !p.active) return;
    p.mana--;
    if (p.active.damage > 0) {
      p.active.damage = Math.max(0, p.active.damage - 30);
      p.active.hp = p.active.maxHp - p.active.damage;
    }
    p.active.status = [];
    showDamagePopupAt(30, getPokemonSelector(meNum(), -1), true);
    animateEl(getPokemonSelector(meNum(), -1), 'heal-pulse', 500);
    addLog(`Healing Touch: heal 30, clear status`, 'heal');
    // Don't mark as used - unlimited uses
  }
  else if (key === 'yummyDelivery') {
    if (!p.active || getPokemonData(p.active.name).ability?.key !== 'yummyDelivery') return;
    const myNum = isOnline ? myPlayerNum : G.currentPlayer;
    const validTargets = [];
    p.bench.forEach((bpk, i) => { if (bpk.energy < 5) validTargets.push({ player: myNum, idx: i }); });
    if (validTargets.length === 0) return;
    G.targeting = { type: 'yummyDelivery', validTargets, context: {}, callback: function(tPk) {
      tPk.energy++;
      const ydSel = findPokemonSelector(tPk);
      if (ydSel) { showEnergyPopup(ydSel, '+1 ⚡'); animateEl(ydSel, 'energy-gain', 400); }
      p.usedAbilities[key] = true;
      addLog(`Yummy Delivery: ${tPk.name} +1 energy`, 'effect');
      renderBattle();
    }};
    renderBattle();
    return;
  }
  else if (key === 'poisonFumes') {
    if (!op().active) { addLog('No opponent active!', 'info'); renderBattle(); return; }
    if (op().active.status.includes('poison')) { addLog(`${op().active.name} is already Poisoned!`, 'info'); renderBattle(); return; }
    if (op().active.heldItem === 'Protect Goggles') { addLog(`${op().active.name}'s Protect Goggles block it!`, 'effect'); renderBattle(); return; }
    p.usedAbilities[key] = true;
    op().active.status.push('poison');
    addLog(`Poison Fumes poisons ${op().active.name}!`, 'effect');
  }
  else if (key === 'hiddenPower') {
    if (p.active && p.active.energy < 5) {
      p.active.energy++;
      showEnergyPopup(getPokemonSelector(meNum(), -1), '+1 ⚡');
      animateEl(getPokemonSelector(meNum(), -1), 'energy-gain', 400);
      p.usedAbilities[key] = true;
      addLog(`Hidden Power: Active +1 energy, turn ends`, 'effect');
  await endTurn();
      return;
    }
  }
  else if (key === 'creepingChill') {
    // Deal 10 to any pokemon - target selection
    const validTargets = [];
    [G.currentPlayer, opp(G.currentPlayer)].forEach(pNum => {
      const side = G.players[pNum];
      if (side.active && side.active.hp > 0) validTargets.push({player:pNum,idx:-1,pk:side.active});
      side.bench.forEach((pk,bi) => { if (pk.hp > 0) validTargets.push({player:pNum,idx:bi,pk:pk}); });
    });
    if (validTargets.length === 0) { addLog('No valid targets!', 'info'); renderBattle(); return; }
    G.targeting = { type:"creepingChill", validTargets:validTargets, callback:function(tPk,tOwner){
      const targetSel = getPokemonSelector(tOwner, validTargets.find(t => t.pk === tPk)?.idx ?? -1);
      dealDamage(tPk, 10, tOwner);
      showDamagePopupAt(10, targetSel, false);
      p.usedAbilities[key] = true;
      addLog("Creeping Chill: 10 to "+tPk.name, "damage");
      animateEl(targetSel, 'hit-shake', 500);
      spawnParticlesAtEl(targetSel, '#96D9D6', 8, {spread:35});
      if (tPk.hp <= 0) handleKO(tPk, tOwner);
      renderBattle();
    }};
    renderBattle();
  }
  else if (key === 'bloodthirsty') {
    // Lycanroc: Spend 1 mana to force opponent to switch active with a bench Pokemon
    if (p.mana < 1 || !p.active || getPokemonData(p.active.name).ability?.key !== 'bloodthirsty') return;
    if (op().bench.length === 0) { addLog('No opponent bench to switch!', 'info'); renderBattle(); return; }
    p.mana--;
    p.usedAbilities[key] = true;
    // Force switch opponent - swap active with first bench
    const newActive = op().bench.shift();
    if (op().active.status.length > 0) { addLog(`${op().active.name}'s ${op().active.status.join(', ')} was cured on bench!`, 'heal'); op().active.status = []; }
    op().bench.push(op().active);
    op().active = newActive;
    addLog(`Bloodthirsty: forced ${newActive.name} to become Active!`, 'effect');
  }
  else if (key === 'megaSpeed') {
    // Mega Blaziken: Grant self +1 energy (free, 1/turn)
    if (!p.active || getPokemonData(p.active.name).ability?.key !== 'megaSpeed') return;
    if (p.active.energy >= 5) return;
    p.active.energy++;
    showEnergyPopup(getPokemonSelector(meNum(), -1), '+1 ⚡');
    animateEl(getPokemonSelector(meNum(), -1), 'energy-gain', 400);
    p.usedAbilities[key] = true;
    addLog(`Mega Speed: ${p.active.name} +1 energy`, 'effect');
  }
  else if (key === 'magicDrain') {
    // Mismagius: Spend 1 mana to make opponent lose 1 mana (unlimited uses)
    if (p.mana < 1) return;
    if (op().mana <= 0) { addLog('Opponent has no mana!', 'info'); renderBattle(); return; }
    p.mana--;
    op().mana = Math.max(0, op().mana - 1);
    // Don't mark as used - unlimited
    addLog(`Magic Drain: opponent loses 1 mana`, 'effect');
  }
  else if (key === 'improvise') {
    // Ditto: Only works while Ditto is the active Pokemon
    if (!p.active || getPokemonData(p.active.name).ability?.key !== 'improvise') { addLog('Improvise only works while active!', 'info'); renderBattle(); return; }
    if (p.active.energy < 1) return;
    const oppData = op().active ? getPokemonData(op().active.name) : null;
    if (!oppData || !oppData.attacks.length) { addLog('No opponent attacks to copy!', 'info'); renderBattle(); return; }
    p.active.energy--;
    p.usedAbilities[key] = true;
    p.active.improviseActive = true; // Flag to show opp attacks in action panel
    addLog(`Ditto transforms! Gained ${op().active.name}'s attacks!`, 'effect');
    animateEl("#youField .active-slot", "attacking", 400);
  }

  renderBattle();
}

// ============================================================
// DAMAGE POPUP
// ============================================================
function showDamagePopup(amount, mult, targetSelector) {
  const el = document.createElement('div');
  const sizeClass = getDmgPopupClass(amount);
  el.className = 'damage-popup' + (mult > 1 ? ' se' : mult < 1 ? ' nve' : '') + (sizeClass ? ' ' + sizeClass : '');
  el.textContent = '-' + amount;
  const target = targetSelector ? document.querySelector(targetSelector) : document.querySelector('#oppField .active-slot');
  if (target) {
    const rect = target.getBoundingClientRect();
    el.style.left = (rect.left + rect.width / 2) + 'px';
    el.style.top = (rect.top + rect.height * 0.3) + 'px';
  } else {
    el.style.left = '50%';
    el.style.top = '35%';
  }
  document.body.appendChild(el);
  const removeDelay = amount >= 100 ? 2000 : amount >= 50 ? 1400 : 1000;
  setTimeout(() => el.remove(), removeDelay);

  if (mult > 1) {
    const eff = document.createElement('div');
    eff.className = 'eff-text se';
    eff.textContent = 'Super Effective!';
    eff.style.left = el.style.left; eff.style.top = (parseInt(el.style.top) - 30) + 'px';
    document.body.appendChild(eff);
    setTimeout(() => eff.remove(), 1500);
  } else if (mult < 1) {
    const eff = document.createElement('div');
    eff.className = 'eff-text nve';
    eff.textContent = 'Resisted...';
    eff.style.left = el.style.left; eff.style.top = (parseInt(el.style.top) - 30) + 'px';
    document.body.appendChild(eff);
    setTimeout(() => eff.remove(), 1500);
  }
}

function showWin(name) {
  document.getElementById('winName').textContent = name;
  document.getElementById('winOverlay').classList.add('visible');
}


// ============================================================
// RENDERING
// ============================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ---------- DECK BUILD ----------
let dbSelection = [];
let dbTab = 'pokemon';

function initDeckBuild(playerNum) {
  G.phase = 'deckBuild';
  dbSelection = [];
  dbTab = 'pokemon';
  showScreen('deckBuildScreen');
  document.getElementById('dbPlayerTag').textContent = G.players[playerNum].name;
  renderDeckBuild();
}

function renderDeckBuild() {
  const grid = document.getElementById('dbCardGrid');
  const selNames = new Set(dbSelection.map(c => c.name));
  const list = dbTab === 'pokemon' ? POKEMON_DB : ITEM_DB;

  grid.innerHTML = list.map((card, i) => {
    const selected = selNames.has(card.name);
    return `<div class="db-card ${selected?'selected':''}" onclick="toggleDeckCard('${card.name.replace(/'/g,"\\'")}','${dbTab}')">
      <img src="${getImg(card.name)}" alt="${card.name}">
      <div class="db-zoom-btn" onclick="event.stopPropagation();zoomCard('${card.name.replace(/'/g,"\\'")}')">🔍</div>
    </div>`;
  }).join('');

  // Sidebar
  const sidebar = document.getElementById('dbSidebarList');
  sidebar.innerHTML = dbSelection.map(c => `<div class="db-sidebar-item"><img src="${getImg(c.name)}"><span>${c.name}</span></div>`).join('');
  document.getElementById('dbCount').textContent = `${dbSelection.length}/15 cards`;

  // Tabs
  document.querySelectorAll('.db-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(dbTab === 'pokemon' ? 'dbTabPokemon' : 'dbTabItems').classList.add('active');

  // Confirm button
  const btn = document.getElementById('dbConfirmBtn');
  if (dbSelection.length === 15) { btn.className = 'db-confirm-btn ready'; btn.textContent = '✓ CONFIRM DECK'; }
  else { btn.className = 'db-confirm-btn disabled'; btn.textContent = `${dbSelection.length}/15 selected`; }
}

function toggleDeckCard(name, type) {
  const idx = dbSelection.findIndex(c => c.name === name);
  if (idx >= 0) { dbSelection.splice(idx, 1); }
  else if (dbSelection.length < 15) { dbSelection.push({name, type}); }
  renderDeckBuild();
}

function switchDbTab(tab) { dbTab = tab; renderDeckBuild(); }

function confirmDeck() {
  if (dbSelection.length !== 15) return;
  if (isOnline) { onlineConfirmDeck(); return; }
  const playerNum = G.phase === 'deckBuild' ? (G.players[1].deck.length === 0 ? 1 : 2) : 1;
  G.players[playerNum].deck = [...dbSelection];

  // Create hand (all cards available)
  G.players[playerNum].hand = dbSelection.map(c => ({
    name: c.name,
    type: c.type,
    heldItem: null,
  }));

  if (playerNum === 1) {
    showPassScreen(2, 'Build your deck', () => initDeckBuild(2));
  } else {
    startSetupPhase();
  }
}

// ---------- PASS SCREEN ----------
function showPassScreen(playerNum, subtitle, callback) {
  showScreen('passScreen');
  document.getElementById('passTitle').textContent = G.players[playerNum].name;
  document.getElementById('passSub').textContent = subtitle;
  document.getElementById('passBtn').onclick = callback;
}

// ---------- SETUP PHASE ----------
let setupStep = 0; // 0=P1 active, 1=P2 active, 2=P1 bench, 3=P2 bench
let setupSelected = []; // {name, heldItem}
let setupItemFor = null; // pokemon name being assigned item

function startSetupPhase() {
  setupStep = 0;
  G.players[1].mana = 7;
  G.players[2].mana = 7;
  showPassScreen(1, 'Choose your Active Pokémon', () => showSetupScreen());
}

function showSetupScreen() {
  const playerNum = (setupStep < 2) ? (setupStep === 0 ? 1 : 2) : (setupStep === 2 ? 1 : 2);
  const isActivePhase = setupStep < 2;
  const p = G.players[playerNum];
  G.currentPlayer = playerNum;

  setupSelected = [];
  showScreen('setupScreen');

  const phaseText = isActivePhase ? `${p.name}: Choose Active Pokémon + Item` : `${p.name}: Choose Bench Pokémon + Items`;
  document.getElementById('setupPhaseText').textContent = phaseText;
  document.getElementById('setupMana').textContent = `Mana: ${p.mana}`;

  renderSetup();
}

function renderSetup() {
  const playerNum = (setupStep < 2) ? (setupStep === 0 ? 1 : 2) : (setupStep === 2 ? 1 : 2);
  const isActivePhase = setupStep < 2;
  const p = G.players[playerNum];

  const hand = document.getElementById('setupHand');
  const placedNames = new Set();
  if (p.active) placedNames.add(p.active.name);
  p.bench.forEach(pk => placedNames.add(pk.name));
  setupSelected.forEach(s => placedNames.add(s.name));

  // Show pokemon from hand
  const pokemonHand = p.hand.filter(c => c.type === 'pokemon' && !placedNames.has(c.name));
  const itemHand = p.hand.filter(c => c.type === 'items');

  let html = '';
  if (setupItemFor) {
    // Show items to pick
    html += `<div style="width:100%;font-size:12px;color:#f59e0b;font-weight:700;margin-bottom:8px;">Choose item for ${setupItemFor} (or skip):</div>`;
    html += `<div class="setup-card" onclick="assignSetupItem(null)" style="width:100px;border:2px dashed rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;min-height:60px;"><span style="color:#666;font-size:11px">No Item</span></div>`;
    html += `<div class="setup-card" onclick="cancelSetupItem()" style="width:100px;border:2px dashed rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;min-height:60px;"><span style="color:#666;font-size:11px">Cancel</span></div>`;
    itemHand.forEach(c => {
      const used = setupSelected.some(s => s.heldItem === c.name);
      html += `<div class="setup-card ${used?'placed':''}" onclick="assignSetupItem('${c.name.replace(/'/g,"\\'")}')">
        <img src="${getImg(c.name)}" alt="${c.name}">
      </div>`;
    });
  } else {
    pokemonHand.forEach(c => {
      const data = getPokemonData(c.name);
      const canAfford = p.mana >= data.cost;
      html += `<div class="setup-card ${!canAfford?'placed':''}" onclick="${canAfford ? `selectSetupPokemon('${c.name.replace(/'/g,"\\'")}')` : ''}">
        <img src="${getImg(c.name)}" alt="${c.name}">
        <span class="cost-badge">${data.cost}⬡</span>
      </div>`;
    });
  }
  hand.innerHTML = html;

  // Preview slots
  const preview = document.getElementById('setupPreview');
  let previewHtml = '';

  if (isActivePhase) {
    const sel = setupSelected[0];
    previewHtml += `<div class="setup-slot ${sel?'filled':''}" ${sel ? 'onclick="unselectSetup(0)" style="cursor:pointer"' : ''}>
      ${sel ? `<img src="${getImg(sel.name)}"><div><div class="setup-slot-name">${sel.name}</div><div class="setup-slot-label">${sel.heldItem||'No item'}</div><div class="setup-slot-label" style="color:#888">(click to remove)</div></div>` : '<div class="setup-slot-label">ACTIVE SLOT</div>'}
    </div>`;
  } else {
    for (let i = 0; i < 4; i++) {
      const sel = setupSelected[i];
      previewHtml += `<div class="setup-slot ${sel?'filled':''}" ${sel ? `onclick="unselectSetup(${i})" style="cursor:pointer"` : ''}>
        ${sel ? `<img src="${getImg(sel.name)}"><div><div class="setup-slot-name">${sel.name}</div><div class="setup-slot-label">${sel.heldItem||'No item'}</div><div class="setup-slot-label" style="color:#888">(click to remove)</div></div>` : `<div class="setup-slot-label">BENCH ${i+1}</div>`}
      </div>`;
    }
  }
  // For bench phase, allow confirming with 0 selected if no pokemon can be afforded
  const canConfirmBench = !isActivePhase && setupSelected.length === 0 && !setupItemFor && pokemonHand.every(c => p.mana < getPokemonData(c.name).cost);
  const canConfirm = (setupSelected.length > 0 && !setupItemFor) || canConfirmBench;
  preview.innerHTML = previewHtml + `<button class="setup-confirm-btn ${canConfirm ? 'db-confirm-btn ready' : 'db-confirm-btn disabled'}" onclick="confirmSetup()" ${canConfirm ? '' : 'disabled'}>${isActivePhase ? 'Confirm Active' : (canConfirmBench ? 'Skip Bench (no mana)' : 'Confirm Bench')}</button>`;

  document.getElementById('setupMana').textContent = `Mana: ${p.mana}`;
}

function selectSetupPokemon(name) {
  const isActivePhase = setupStep < 2;
  if (isActivePhase && setupSelected.length >= 1) return;
  if (!isActivePhase && setupSelected.length >= 4) return;

  const playerNum = (setupStep < 2) ? (setupStep === 0 ? 1 : 2) : (setupStep === 2 ? 1 : 2);
  const p = G.players[playerNum];
  const data = getPokemonData(name);
  if (p.mana < data.cost) return;

  p.mana -= data.cost;
  setupItemFor = name;
  renderSetup();
}

function cancelSetupItem() {
  if (!setupItemFor) return;
  const playerNum = (setupStep < 2) ? (setupStep === 0 ? 1 : 2) : (setupStep === 2 ? 1 : 2);
  const p = G.players[playerNum];
  const data = getPokemonData(setupItemFor);
  if (data) p.mana += data.cost;
  setupItemFor = null;
  renderSetup();
}

function unselectSetup(idx) {
  if (setupItemFor) return;
  if (idx < 0 || idx >= setupSelected.length) return;
  const removed = setupSelected.splice(idx, 1)[0];
  const playerNum = (setupStep < 2) ? (setupStep === 0 ? 1 : 2) : (setupStep === 2 ? 1 : 2);
  const p = G.players[playerNum];
  const data = getPokemonData(removed.name);
  if (data) p.mana += data.cost;
  renderSetup();
}

function assignSetupItem(itemName) {
  const usedItems = new Set(setupSelected.map(s => s.heldItem).filter(Boolean));
  if (itemName && usedItems.has(itemName)) return;

  setupSelected.push({ name: setupItemFor, heldItem: itemName });
  setupItemFor = null;
  renderSetup();
}

function confirmSetup() {
  const playerNum2 = (setupStep < 2) ? (setupStep === 0 ? 1 : 2) : (setupStep === 2 ? 1 : 2);
  const p2 = G.players[playerNum2];
  const isActivePhase2 = setupStep < 2;
  const placedNames2 = new Set(setupSelected.map(s => s.name));
  const pokemonHand2 = p2.hand.filter(c => c.type === 'pokemon' && !placedNames2.has(c.name));
  const canSkipBench = !isActivePhase2 && setupSelected.length === 0 && !setupItemFor && pokemonHand2.every(c => p2.mana < getPokemonData(c.name).cost);
  if (setupItemFor) return;
  if (setupSelected.length === 0 && !canSkipBench) return;
  const playerNum = (setupStep < 2) ? (setupStep === 0 ? 1 : 2) : (setupStep === 2 ? 1 : 2);
  const isActivePhase = setupStep < 2;
  const p = G.players[playerNum];

  if (isActivePhase) {
    const sel = setupSelected[0];
    p.active = makePokemon(sel.name, sel.heldItem);
    // Remove from hand
    p.hand = p.hand.filter(c => c.name !== sel.name);
    if (sel.heldItem) p.hand = p.hand.filter(c => c.name !== sel.heldItem);
  } else {
    setupSelected.forEach(sel => {
      p.bench.push(makePokemon(sel.name, sel.heldItem));
      p.hand = p.hand.filter(c => c.name !== sel.name);
      if (sel.heldItem) p.hand = p.hand.filter(c => c.name !== sel.heldItem);
    });
  }

  setupStep++;
  if (setupStep === 1) {
    showPassScreen(2, 'Choose your Active Pokémon', () => showSetupScreen());
  } else if (setupStep === 2) {
    showPassScreen(1, 'Choose your Bench Pokémon', () => showSetupScreen());
  } else if (setupStep === 3) {
    showPassScreen(2, 'Choose your Bench Pokémon', () => showSetupScreen());
  } else {
    // Setup complete! Start battle
    G.phase = 'battle';
    G.currentPlayer = 1;
    G.turn = 1;
    G.players[1].mana = 0;
    G.players[2].mana = 0;
    showScreen('battleScreen');
    startTurn();
  }
}

// ---------- BATTLE RENDERING ----------
function renderBattle() {
  captureHpState();
  const myP = me();
  const theirP = them();

  // Top bar
  document.getElementById('btP1Name').textContent = G.players[1].name;
  document.getElementById('btP2Name').textContent = G.players[2].name;
  document.getElementById('btP1Mana').textContent = G.players[1].mana + '⬡';
  document.getElementById('btP2Mana').textContent = G.players[2].mana + '⬡';
  let turnText = `Turn ${G.turn} — ${cp().name}`;
  if (G.pendingRetreats.length > 0 && G.pendingRetreats[0].reason === 'ko') {
    const prPlayer = G.players[G.pendingRetreats[0].player];
    turnText = `Turn ${G.turn} — ${prPlayer.name} must choose new Active`;
  } else if (isOnline && !isMyTurn()) {
    turnText += ' (Waiting...)';
  }
  document.getElementById('btTurn').textContent = turnText;

  for (let p = 1; p <= 2; p++) {
    const kosEl = document.getElementById(`btP${p}Kos`);
    kosEl.innerHTML = Array(5).fill(0).map((_, i) => `<div class="bt-ko ${i < G.players[p].kos ? 'filled' : ''}"></div>`).join('');
  }

  // Render fields - "you" is always me, "opp" is always them
  renderFieldSide('oppField', theirP, themNum());
  renderFieldSide('youField', myP, meNum());

  // Update mana display
  const manaEl = document.getElementById('manaCurrent');
  if (manaEl) manaEl.textContent = myP.mana;

  // Action panel
  renderActionPanel();
  renderHandPanel();
  renderLogPanel();

  // Animate HP bars (must be after innerHTML rebuild)
  animateHpBars();
}

function renderFieldSide(containerId, player, playerNum) {
  const el = document.getElementById(containerId);
  if (!el) return;
  let activeHtml = '';
  let benchHtml = '';

  // Active (center, near divider)
  if (player.active) {
    activeHtml = renderPokemonSlot(player.active, 'active-slot', playerNum, -1, false);
  }

  // Bench (row on the outside edge)
  const benchSlots = 4;
  for (let i = 0; i < benchSlots; i++) {
    const pk = player.bench[i];
    if (pk) {
      const isRetreatTarget = G.pendingRetreats.length > 0 && G.pendingRetreats[0].player === playerNum && (!isOnline || playerNum === myPlayerNum);
      benchHtml += renderPokemonSlot(pk, 'bench-slot', playerNum, i, isRetreatTarget);
    } else {
      benchHtml += '<div class="bench-empty"></div>';
    }
  }

  // For "you" side: CSS flex-direction:column-reverse puts first child at bottom
  // So active (first) goes to bottom (near divider), bench (second) goes to top (outside)
  // For "opp" side: CSS flex-direction:column puts first child at top
  // So bench (first) goes to top (outside), active (second) goes to bottom (near divider)
  if (containerId === 'oppField') {
    el.innerHTML = `<div class="field-bench-row">${benchHtml}</div><div class="field-active-row">${activeHtml}</div>`;
  } else {
    el.innerHTML = `<div class="field-active-row">${activeHtml}</div><div class="field-bench-row">${benchHtml}</div>`;
  }
}

function renderPokemonSlot(pk, slotClass, playerNum, benchIdx, isRetreatTarget) {
  const isTarget = G.targeting && G.targeting.validTargets.some(t => t.player === playerNum && t.idx === benchIdx);
  const hpPct = Math.max(0, (pk.hp / pk.maxHp) * 100);
  const hpColor = hpPct > 50 ? '#4ade80' : hpPct > 25 ? '#fbbf24' : '#ef4444';

  // Determine click behavior: targeting/retreat takes priority, then card selection
  let clickAction, imgClass;
  if (isRetreatTarget) {
    clickAction = `onclick="selectBenchForRetreat(${benchIdx})"`;
    imgClass = 'targetable';
  } else if (isTarget) {
    clickAction = `onclick="selectTarget(${playerNum},${benchIdx})"`;
    imgClass = 'targetable';
  } else {
    clickAction = `onclick="event.stopPropagation();selectCard(${playerNum},${benchIdx})"`;
    imgClass = 'clickable';
  }

  // Determine glow: yellow for active that can attack, blue for usable ability
  const isMine = playerNum === meNum();
  const isMyTurnNow = isOnline ? isMyTurn() : true;
  let glowClass = '';
  if (isMine && isMyTurnNow && !G.animating && G.pendingRetreats.length === 0 && !G.targeting) {
    const data = getPokemonData(pk.name);
    const me = isOnline ? G.players[myPlayerNum] : cp();
    // Yellow glow: active pokemon that has an affordable attack
    if (benchIdx === -1 && data.attacks && data.attacks.some(atk => pk.energy >= atk.energy && !pk.status.includes('sleep'))) {
      glowClass = 'glow-attack';
    }
    // Blue glow: has usable active ability
    if (data.ability && data.ability.type === 'active') {
      const used = me.usedAbilities[data.ability.key];
      const canUse = !used || data.ability.key === 'healingTouch' || data.ability.key === 'magicDrain';
      if (canUse) glowClass += (glowClass ? ' ' : '') + 'glow-ability';
    }
  }

  // Selected state
  const isSelected = G.selectedCard && G.selectedCard.playerNum === playerNum && G.selectedCard.benchIdx === benchIdx;
  const selectedClass = isSelected ? 'selected-card' : '';

  let statusHtml = '';
  if (pk.status.length > 0) statusHtml = pk.status.map(s => `<span class="fp-status ${s}">${s.toUpperCase()}</span>`).join(' ');

  return `<div class="field-pokemon ${slotClass} ${glowClass} ${selectedClass}">
    <div class="fp-img-wrap">
      <img class="fp-img ${imgClass}" src="${getImg(pk.name)}" alt="${pk.name}" ${clickAction}>
      ${pk.heldItem ? `<img class="fp-held-item" src="${getImg(pk.heldItem)}" alt="${pk.heldItem}" title="${pk.heldItem}" onclick="event.stopPropagation();zoomCard('${pk.heldItem.replace(/'/g,"\\'")}')" style="cursor:pointer">` : ''}
    </div>
    <div class="fp-info">
      <div class="fp-name">${pk.name}</div>
      <div class="fp-hp-bar"><div class="fp-hp-fill" style="width:${hpPct}%;background:${hpColor}"></div></div>
      <div class="fp-stats">
        <span class="fp-hp-text">${pk.hp}/${pk.maxHp}</span>
        <span class="fp-energy">${'⚡'.repeat(pk.energy)}</span>
        ${statusHtml}
      </div>
    </div>
  </div>`;
}

function renderActionPanel() {
  const panel = document.getElementById('apActions');
  const info = document.getElementById('apPokemonInfo');
  const myPendingRetreat = G.pendingRetreats.length > 0 && G.pendingRetreats[0].player === myPlayerNum;
  const oppPendingRetreat = isOnline && G.pendingRetreats.length > 0 && G.pendingRetreats[0].player !== myPlayerNum;
  if (isOnline && ((!isMyTurn() && !myPendingRetreat) || oppPendingRetreat)) {
    info.innerHTML = '';
    panel.innerHTML = '<div style="color:#888;padding:20px;text-align:center">Waiting for opponent...</div>';
    return;
  }
  const me = isOnline ? G.players[myPlayerNum] : cp();

  // Targeting mode - override everything
  if (G.targeting) {
    info.innerHTML = '';
    panel.innerHTML = `<div class="ap-section-label" style="color:#f59e0b">SELECT A TARGET <button onclick="G.targeting=null;G.animating=false;renderBattle()" style="margin-left:8px;padding:2px 10px;border:none;border-radius:6px;background:rgba(255,255,255,0.1);color:#aaa;cursor:pointer;font-size:10px">Cancel</button></div>`;
    return;
  }

  // Pending retreat - override everything
  if (G.pendingRetreats.length > 0) {
    info.innerHTML = '';
    panel.innerHTML = `<div class="ap-section-label" style="color:#f59e0b">SELECT A BENCH POKÉMON TO BECOME ACTIVE</div>`;
    return;
  }

  // Determine which card is selected
  const sel = G.selectedCard;
  const myNum = meNum();

  // If nothing selected, show prompt
  if (!sel) {
    info.innerHTML = '';
    let html = '<div style="color:#555;padding:20px;text-align:center;font-size:13px">Click a Pokémon to see info & actions</div>';
    // Still show End Turn and copiedAttacks reset
    copiedAttacks = [];
    html += renderEndTurnButton(me);
    panel.innerHTML = html;
    return;
  }

  // Get the selected pokemon
  const selPlayer = G.players[sel.playerNum];
  const selPk = sel.benchIdx === -1 ? selPlayer.active : selPlayer.bench[sel.benchIdx];
  if (!selPk) { G.selectedCard = null; info.innerHTML = ''; panel.innerHTML = ''; return; }
  const selData = getPokemonData(selPk.name);
  const isMine = sel.playerNum === myNum;
  const isActive = sel.benchIdx === -1;

  // Show card info (always)
  const discardBtn = isMine && selPk.heldItem
    ? `<button onclick="discardHeldItem('${isActive ? 'active' : 'bench'}',${isActive ? null : sel.benchIdx})" style="font-size:9px;background:#ef4444;color:#fff;border:none;border-radius:4px;padding:1px 6px;cursor:pointer;margin-left:4px">Discard</button>`
    : '';
  info.innerHTML = `
    <div class="ap-pokemon-name">${selPk.name}${!isMine ? ' <span style="color:#ef4444;font-size:10px">(Enemy)</span>' : ''}</div>
    <div class="ap-pokemon-types">${selData.types.map(t => `<span class="ap-type-badge" style="background:${TYPE_COLORS[t]}">${t}</span>`).join('')}</div>
    <div class="ap-pokemon-hp">HP: ${selPk.hp}/${selPk.maxHp} | Energy: ${selPk.energy}/5</div>
    ${selPk.heldItem ? `<div style="font-size:10px;color:#a855f7">🎒 ${selPk.heldItem} ${discardBtn}</div>` : ''}
    ${selPk.status.length > 0 ? `<div style="font-size:10px;color:#f59e0b">Status: ${selPk.status.join(', ')}</div>` : ''}
    ${selData.ability ? `<div style="font-size:10px;color:#c4b5fd">✦ ${selData.ability.name}: ${selData.ability.desc} <span style="opacity:0.6">[${selData.ability.type}]</span></div>` : ''}
    <div style="font-size:10px;color:#888;margin-top:2px">${selData.attacks.map(a => `${a.name} (${a.energy}⚡${a.baseDmg ? ', ' + a.baseDmg + 'dmg' : ''})`).join(' · ')}</div>
  `;

  let html = '';
  copiedAttacks = [];

  // If enemy card, just show info (no actions)
  if (!isMine) {
    html += '<div style="color:#888;padding:8px;font-size:11px;text-align:center">Enemy Pokémon — info only</div>';
    html += renderEndTurnButton(me);
    panel.innerHTML = html;
    return;
  }

  // Check if opponent's Active has Thick Aroma
  let thickAromaCost = 0;
  const them = isOnline ? G.players[isOnline ? (myPlayerNum === 1 ? 2 : 1) : opp(G.currentPlayer)] : op();
  if (them.active && !isPassiveBlocked()) {
    const themData = getPokemonData(them.active.name);
    if (themData.ability && themData.ability.key === 'thickAroma') thickAromaCost = 1;
  }

  // === MY ACTIVE POKEMON SELECTED ===
  if (isActive && me.active === selPk) {
    const pk = selPk;
    const data = selData;

    // Attacks
    html += '<div class="ap-section-label">ATTACKS</div>';
    data.attacks.forEach((atk, i) => {
      let cost = atk.energy;
      if (pk.quickClawActive) cost = Math.max(0, cost - 2);
      cost += thickAromaCost;
      const canUse = pk.energy >= cost && !pk.status.includes('sleep') && !(data.ability?.key === 'defeatist' && pk.damage >= 120 && !isPassiveBlocked()) && pk.cantUseAttack !== atk.name;
      const dmgLabel = atk.baseDmg > 0 ? ` | ${atk.baseDmg} dmg` : '';
      const costLabel = thickAromaCost > 0 ? `${atk.energy}+${thickAromaCost}⚡` : `${atk.energy}⚡`;
      html += `<button class="ap-btn ap-btn-attack" onclick="actionAttack(${i})" ${canUse?'':'disabled'}>
        <span class="atk-name">${atk.name}${dmgLabel}</span>
        <span class="atk-detail">${costLabel}${atk.desc ? ' | ' + atk.desc : ''}</span>
      </button>`;
    });

    // Mew Versatility - show bench allies' attacks
    if (data.ability && data.ability.key === 'versatility' && !isPassiveBlocked()) {
      me.bench.forEach(benchPk => {
        const bd = getPokemonData(benchPk.name);
        bd.attacks.forEach((atk, atkIdx) => {
          const idx = copiedAttacks.length;
          copiedAttacks.push({ attack: atk, types: bd.types, source: benchPk.name, attackIndex: atkIdx });
          const canUse = pk.energy >= (atk.energy + thickAromaCost) && !pk.status.includes('sleep');
          const cdmg = atk.baseDmg > 0 ? ` | ${atk.baseDmg} dmg` : '';
          const cCostLabel = thickAromaCost > 0 ? `${atk.energy}+${thickAromaCost}⚡` : `${atk.energy}⚡`;
          html += `<button class="ap-btn ap-btn-attack" onclick="actionCopiedAttack(${idx})" ${canUse?'':'disabled'} style="border-color:rgba(168,85,247,0.3)">
            <span class="atk-name">${atk.name}${cdmg}</span>
            <span class="atk-detail">${cCostLabel} | from ${benchPk.name}</span>
          </button>`;
        });
      });
    }

    // Ditto Improvise
    if (pk.improviseActive && op().active) {
      const oppData = getPokemonData(op().active.name);
      html += '<div class="ap-section-label" style="color:#c4b5fd">COPIED ATTACKS</div>';
      oppData.attacks.forEach((atk, atkIdx) => {
        const idx = copiedAttacks.length;
        copiedAttacks.push({ attack: atk, types: oppData.types, source: op().active.name, attackIndex: atkIdx });
        const canUse = pk.energy >= (atk.energy + thickAromaCost) && !pk.status.includes('sleep');
        const cdmg2 = atk.baseDmg > 0 ? ` | ${atk.baseDmg} dmg` : '';
        const dCostLabel = thickAromaCost > 0 ? `${atk.energy}+${thickAromaCost}⚡` : `${atk.energy}⚡`;
        html += `<button class="ap-btn ap-btn-attack" onclick="actionCopiedAttack(${idx})" ${canUse?'':'disabled'} style="border-color:rgba(168,85,247,0.3)">
          <span class="atk-name">${atk.name}${cdmg2}</span>
          <span class="atk-detail">${dCostLabel} | from ${op().active.name}</span>
        </button>`;
      });
    }

    // Ability (only this pokemon's)
    if (data.ability) {
      if (data.ability.type === 'active') {
        const used = me.usedAbilities[data.ability.key];
        const canUse = !used || data.ability.key === 'healingTouch' || data.ability.key === 'magicDrain';
        html += '<div class="ap-section-label">ABILITY</div>';
        html += `<button class="ap-btn ap-btn-ability" onclick="useAbility('${data.ability.key}')" ${canUse?'':'disabled'}>
          <span class="atk-name">${data.ability.name}</span>
          <span class="atk-detail">${data.ability.desc}</span>
        </button>`;
      } else if (data.ability.type === 'passive') {
        html += '<div class="ap-section-label">ABILITY</div>';
        html += `<div class="ap-btn" style="opacity:0.6;cursor:default;border-left:3px solid #6366f1">
          <span class="atk-name">${data.ability.name}</span>
          <span class="atk-detail" style="color:#a5b4fc">${data.ability.desc} [Passive]</span>
        </div>`;
      }
    }

    // Energy grant for this pokemon
    html += '<div class="ap-section-label">ENERGY</div>';
    const myPN = isOnline ? myPlayerNum : G.currentPlayer;
    const isSlowStart = getPokemonData(pk.name).ability?.key === 'slowStart' && !isPassiveBlocked();
    const cost = isSlowStart ? 2 : 1;
    const canGrant = me.mana >= cost && pk.energy < 5;
    html += `<button class="ap-btn ap-btn-energy" onclick="actionGrantEnergy(G.players[${myPN}].active)" ${canGrant?'':'disabled'}>
      <span class="atk-name">+1 Energy → ${pk.name}</span>
      <span class="atk-detail">${cost} mana${isSlowStart?' (Slow Start)':''} | ${pk.energy}/5</span>
    </button>`;

    // Retreat
    html += '<div class="ap-section-label">MOVEMENT</div>';
    const qrCost = pk.heldItem === 'Float Stone' ? 1 : 2;
    html += `<button class="ap-btn ap-btn-retreat" onclick="actionQuickRetreat()" ${me.bench.length > 0 && pk.energy >= qrCost ? '' : 'disabled'}>
      <span class="atk-name">Quick Retreat</span><span class="atk-detail">${qrCost} energy, don't end turn</span>
    </button>`;
    html += `<button class="ap-btn ap-btn-retreat" onclick="actionRetreat()" ${me.bench.length > 0 ? '' : 'disabled'}>
      <span class="atk-name">Retreat</span><span class="atk-detail">Ends turn</span>
    </button>`;

    // Held item discard
    if (pk.heldItem) {
      html += '<div class="ap-section-label">ITEM</div>';
      html += `<button class="ap-btn" onclick="discardHeldItem('active',null)" style="background:rgba(168,85,247,0.1);border-color:rgba(168,85,247,0.3)">
        <span class="atk-name">${pk.heldItem}</span><span class="atk-detail">Click to discard</span>
      </button>`;
    }
  }
  // === MY BENCH POKEMON SELECTED ===
  else if (!isActive && me.bench.includes(selPk)) {
    const bIdx = sel.benchIdx;
    const data = selData;

    // Energy grant
    html += '<div class="ap-section-label">ENERGY</div>';
    const myPN = isOnline ? myPlayerNum : G.currentPlayer;
    const isSlowStart = data.ability?.key === 'slowStart' && !isPassiveBlocked();
    const cost = isSlowStart ? 2 : 1;
    const canGrant = me.mana >= cost && selPk.energy < 5;
    html += `<button class="ap-btn ap-btn-energy" onclick="actionGrantEnergy(G.players[${myPN}].bench[${bIdx}])" ${canGrant?'':'disabled'}>
      <span class="atk-name">+1 Energy → ${selPk.name}</span>
      <span class="atk-detail">${cost} mana${isSlowStart?' (Slow Start)':''} | ${selPk.energy}/5</span>
    </button>`;

    // Ability (if this bench pokemon has an active ability)
    if (data.ability && data.ability.type === 'active' && data.ability.key !== 'improvise') {
      const used = me.usedAbilities[data.ability.key];
      const canUse = !used || data.ability.key === 'healingTouch' || data.ability.key === 'magicDrain';
      html += '<div class="ap-section-label">ABILITY</div>';
      html += `<button class="ap-btn ap-btn-ability" onclick="useAbility('${data.ability.key}')" ${canUse?'':'disabled'}>
        <span class="atk-name">${data.ability.name}</span>
        <span class="atk-detail">${data.ability.desc}</span>
      </button>`;
    } else if (data.ability && data.ability.type === 'passive') {
      html += '<div class="ap-section-label">ABILITY</div>';
      html += `<div class="ap-btn" style="opacity:0.6;cursor:default;border-left:3px solid #6366f1">
        <span class="atk-name">${data.ability.name}</span>
        <span class="atk-detail" style="color:#a5b4fc">${data.ability.desc} [Passive]</span>
      </div>`;
    }

    // Held item discard
    if (selPk.heldItem) {
      html += '<div class="ap-section-label">ITEM</div>';
      html += `<button class="ap-btn" onclick="discardHeldItem('bench',${bIdx})" style="background:rgba(168,85,247,0.1);border-color:rgba(168,85,247,0.3)">
        <span class="atk-name">${selPk.heldItem}</span><span class="atk-detail">Click to discard</span>
      </button>`;
    }

    // Show attacks (info-only, can't use from bench)
    if (data.attacks.length > 0) {
      html += '<div class="ap-section-label" style="opacity:0.5">ATTACKS (must be Active)</div>';
      data.attacks.forEach(atk => {
        const dmgLabel = atk.baseDmg > 0 ? ` | ${atk.baseDmg} dmg` : '';
        html += `<div class="ap-btn ap-btn-attack" style="opacity:0.35;cursor:default">
          <span class="atk-name">${atk.name}${dmgLabel}</span>
          <span class="atk-detail">${atk.energy}⚡${atk.desc ? ' | ' + atk.desc : ''}</span>
        </div>`;
      });
    }
  }

  // End turn button always shown
  html += renderEndTurnButton(me);
  panel.innerHTML = html;
}

function renderEndTurnButton(me) {
  let html = '<div class="ap-section-label" style="margin-top:8px">TURN</div>';
  if (isOnline) {
    html += `<button class="ap-btn ap-btn-end" onclick="sendAction({actionType:'endTurn'})" ${isMyTurn()?'':'disabled'}>
      <span class="atk-name">End Turn</span>
    </button>`;
  } else {
    html += `<button class="ap-btn ap-btn-end" onclick="if(!G.animating){G.animating=true;endTurn()}">
      <span class="atk-name">End Turn</span>
    </button>`;
  }
  return html;
}

function renderHandPanel() {
  const panel = document.getElementById('apHand');
  const me = isOnline ? G.players[myPlayerNum] : cp();
  const pokemonHand = me.hand.filter(c => c.type === 'pokemon');
  const itemHand = me.hand.filter(c => c.type === 'items');

  let html = `<div class="ap-hand-title">HAND (${me.hand.length})</div>`;
  pokemonHand.forEach((c, i) => {
    const realIdx = me.hand.indexOf(c);
    const data = getPokemonData(c.name);
    const canAfford = me.mana >= data.cost && me.bench.length < 4;
    html += `<div class="ap-hand-card ${canAfford?'':'cant-afford'}" onclick="actionPlayPokemon(${realIdx})">
      <img src="${getImg(c.name)}">
      <div><div class="hc-name">${c.name}</div><div class="hc-cost">${data.cost}⬡ · ${data.hp}HP</div></div>
    </div>`;
  });
  if (itemHand.length > 0) {
    html += `<div class="ap-hand-title" style="margin-top:8px">ITEMS (${itemHand.length})</div>`;
    itemHand.forEach(c => {
      html += `<div class="ap-hand-card" style="cursor:pointer" onclick="zoomCard('${c.name.replace(/'/g,"\\'")}')"><img src="${getImg(c.name)}"><div><div class="hc-name">${c.name}</div></div></div>`;
    });
  }
  panel.innerHTML = html;
}

function renderLogPanel() {
  const panel = document.getElementById('apLog');
  panel.innerHTML = `<div class="ap-log-title">BATTLE LOG</div>` +
    G.log.slice(0, 30).map(e => `<div class="log-entry ${e.cls}">${e.text}</div>`).join('');
}

// ---------- ZOOM ----------
function zoomCard(name) {
  document.getElementById('zoomImg').src = getImg(name);
  document.getElementById('zoomOverlay').classList.add('visible');
}
function closeZoom() { document.getElementById('zoomOverlay').classList.remove('visible'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeZoom(); });

// ---------- CARD SELECTION ----------
function selectCard(playerNum, benchIdx) {
  // If targeting or pending retreat, don't change selection
  if (G.targeting || G.pendingRetreats.length > 0) return;
  // Toggle off if re-clicking same card
  if (G.selectedCard && G.selectedCard.playerNum === playerNum && G.selectedCard.benchIdx === benchIdx) {
    G.selectedCard = null;
  } else {
    G.selectedCard = { playerNum, benchIdx };
  }
  renderBattle();
}

// ---------- DRAG TO PAN ----------
function enableDragPan(el) {
  let isDragging = false, startX, startY, scrollLeft, scrollTop;
  // Mouse events
  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('button, .fp-img.targetable, .fp-img.clickable, .db-zoom-btn, .fp-held-item')) return;
    isDragging = true;
    startX = e.pageX - el.offsetLeft;
    startY = e.pageY - el.offsetTop;
    scrollLeft = el.scrollLeft;
    scrollTop = el.scrollTop;
    el.style.cursor = 'grabbing';
  });
  el.addEventListener('mouseleave', () => { isDragging = false; el.style.cursor = ''; });
  el.addEventListener('mouseup', () => { isDragging = false; el.style.cursor = ''; });
  el.addEventListener('mousemove', e => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const y = e.pageY - el.offsetTop;
    el.scrollLeft = scrollLeft - (x - startX);
    el.scrollTop = scrollTop - (y - startY);
  });
  // Touch events for mobile
  el.addEventListener('touchstart', e => {
    if (e.target.closest('button, .fp-img.targetable, .fp-img.clickable, .db-zoom-btn, .fp-held-item')) return;
    const t = e.touches[0];
    isDragging = true;
    startX = t.pageX - el.offsetLeft;
    startY = t.pageY - el.offsetTop;
    scrollLeft = el.scrollLeft;
    scrollTop = el.scrollTop;
  }, { passive: true });
  el.addEventListener('touchend', () => { isDragging = false; });
  el.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const t = e.touches[0];
    const x = t.pageX - el.offsetLeft;
    const y = t.pageY - el.offsetTop;
    el.scrollLeft = scrollLeft - (x - startX);
    el.scrollTop = scrollTop - (y - startY);
  }, { passive: true });
}

// Selectors for all scrollable areas that should support drag-pan
const PAN_SELECTORS = ['.battle-field', '.db-cards', '.db-sidebar-list', '.setup-hand', '.ap-actions', '.ap-hand', '.ap-log', '.ap-pokemon-info'];

// Apply drag-pan to all scrollable areas once they exist
const observer = new MutationObserver(() => {
  PAN_SELECTORS.forEach(sel => {
    const el = document.querySelector(sel);
    if (el && !el.dataset.panInit) { enableDragPan(el); el.dataset.panInit = '1'; }
  });
});
observer.observe(document.body, { childList: true, subtree: true });

// ============================================================
// NETWORK CLIENT
// ============================================================
function sendMsg(msg) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

function sendAction(action) {
  sendMsg({ type: 'action', actionType: action.actionType, ...action });
}

function connectToServer(name, mode, code) {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = protocol + '//' + location.host;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    updateLobbyStatus('Connected!', 'ok');
    if (mode === 'create') {
      sendMsg({ type: 'createRoom', name });
    } else if (mode === 'join') {
      sendMsg({ type: 'joinRoom', code, name });
    }
  };

  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch(err) { return; }
    handleServerMessage(msg);
  };

  ws.onclose = () => {
    updateLobbyStatus('Disconnected. Refresh to retry.', 'error');
  };

  ws.onerror = () => {
    updateLobbyStatus('Connection error.', 'error');
  };
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'roomCreated':
      myPlayerNum = msg.playerNum;
      myToken = msg.token;
      myRoomCode = msg.code;
      sessionStorage.setItem('tcg_token', msg.token);
      sessionStorage.setItem('tcg_room', msg.code);
      showWaitingScreen(msg.code);
      break;

    case 'joined':
      myPlayerNum = msg.playerNum;
      myToken = msg.token;
      myRoomCode = sessionStorage.getItem('tcg_room') || '';
      sessionStorage.setItem('tcg_token', msg.token);
      updateLobbyStatus('Joined! Opponent: ' + msg.oppName, 'ok');
      break;

    case 'oppJoined':
      updateLobbyStatus('Opponent joined: ' + msg.oppName, 'ok');
      break;

    case 'reconnected':
      myPlayerNum = msg.playerNum;
      updateLobbyStatus('Reconnected!', 'ok');
      break;

    case 'gameState':
      handleGameState(msg.state, msg.events || []);
      break;

    case 'deckConfirmed': {
      const btn = document.getElementById('dbConfirmBtn');
      if (btn) { btn.textContent = 'Waiting for opponent...'; btn.className = 'db-confirm-btn disabled'; }
      break;
    }

    case 'oppDeckConfirmed': {
      const btn = document.getElementById('dbConfirmBtn');
      if (btn && btn.textContent.includes('Waiting')) btn.textContent = 'Waiting for opponent... (they\'re ready!)';
      break;
    }

    case 'setupConfirmed':
      // showOnlineSetupScreen will show "waiting" on next gameState
      break;

    case 'oppSetupConfirmed':
      break;

    case 'oppDisconnected':
      showTurnOverlay('Opponent disconnected...');
      break;

    case 'oppReconnected':
      showTurnOverlay('Opponent reconnected!');
      break;

    case 'error':
      console.warn('Server error:', msg.message);
      break;

    case 'pong':
      break;
  }
}

function applyServerState(state) {
  G.phase = state.phase;
  G.currentPlayer = state.currentPlayer;
  G.turn = state.turn;
  G.log = state.log || [];
  G.targeting = state.targeting || null;
  G.pendingRetreats = state.pendingRetreats || (state.pendingRetreat ? [state.pendingRetreat] : []);
  G.winner = state.winner || null;

  // Auto-select active card when it's my turn (online)
  if (state.currentPlayer === myPlayerNum && !G.selectedCard) {
    G.selectedCard = { playerNum: myPlayerNum, benchIdx: -1 };
  }

  for (let pNum = 1; pNum <= 2; pNum++) {
    const sp = state.players[pNum];
    G.players[pNum].name = sp.name;
    G.players[pNum].mana = sp.mana;
    G.players[pNum].kos = sp.kos;
    G.players[pNum].active = sp.active;
    G.players[pNum].bench = sp.bench || [];
    G.players[pNum].usedAbilities = sp.usedAbilities || {};
    G.players[pNum].ready = sp.ready || false;
    if (pNum === myPlayerNum) {
      G.players[pNum].hand = sp.hand || [];
      G.players[pNum].deck = sp.deck || [];
    } else {
      G.players[pNum].hand = [];
      G.players[pNum].handCount = sp.handCount || 0;
      G.players[pNum].deckCount = sp.deckCount || 0;
    }
  }

  if (state.copiedAttacks) {
    copiedAttacks = state.copiedAttacks.map((ca, i) => ({
      attack: ca.attack,
      types: ca.types,
      source: ca.source,
      attackIndex: ca.attackIndex !== undefined ? ca.attackIndex : i,
    }));
  }

  G.animating = false;
}

function handleGameState(state, events) {
  const prevPhase = G.phase;

  // Handle phase transitions
  if (state.phase === 'deckBuild') {
    applyServerState(state);
    showScreen('deckBuildScreen');
    document.getElementById('dbPlayerTag').textContent = G.players[myPlayerNum].name;
    renderDeckBuild();
  } else if (state.phase === 'setupActive' || state.phase === 'setupBench') {
    applyServerState(state);
    showOnlineSetupScreen(state.phase);
  } else if (state.phase === 'battle') {
    showScreen('battleScreen');
    if (events.length > 0) {
      // Defer full state update until after event replay so animations
      // (like ko-fall) can render against the pre-event DOM state.
      // Only update log so new log entries appear during replay.
      G.log = state.log || [];
      replayEvents(events).then(() => {
        applyServerState(state);
        renderBattle();
        if (G.winner) showWin(G.winner);
      });
    } else {
      applyServerState(state);
      renderBattle();
      if (G.winner) showWin(G.winner);
    }
  } else {
    applyServerState(state);
  }
}

// ============================================================
// EVENT REPLAY
// ============================================================
async function replayEvents(events) {
  isReplayingEvents = true;
  renderBattle(); // Render initial state

  for (const event of events) {
    switch (event.type) {
      case 'attack_declare': {
        const atkSel = getPokemonSelector(event.player, -1);
        animateEl(atkSel, 'attacking', 400);
        await delay(400);
        break;
      }
      case 'damage': {
        const dmgSel = getPokemonSelector(event.targetPlayer, event.targetIdx);
        showDamagePopup(event.amount, event.mult, dmgSel);
        animateEl(dmgSel, getShakeClass(event.amount), getShakeDuration(event.amount));
        const attackColor = '#ef4444';
        spawnParticlesAtEl(dmgSel, attackColor, event.amount >= 100 ? 22 : 14, {spread: event.amount >= 100 ? 75 : 55});
        // Apply damage to local state so HP bars update during replay
        const dmgOwner = G.players[event.targetPlayer];
        const dmgTarget = event.targetIdx === -1 ? dmgOwner.active : dmgOwner.bench[event.targetIdx];
        if (dmgTarget) {
          dmgTarget.damage = (dmgTarget.damage || 0) + event.amount;
          dmgTarget.hp = Math.max(0, dmgTarget.maxHp - dmgTarget.damage);
        }
        renderBattle();
        await delay(event.amount >= 100 ? 1200 : event.amount >= 50 ? 900 : 700);
        break;
      }
      case 'ko': {
        const koSel = getPokemonSelector(event.targetPlayer, event.targetIdx);
        animateEl(koSel, 'ko-fall', 600);
        spawnParticlesAtEl(koSel, '#ef4444', 20, {spread:70, size:4});
        await delay(600);
        // Remove the KO'd pokemon from local state so re-render shows it gone
        const koOwner = G.players[event.targetPlayer];
        if (event.targetIdx === -1) {
          koOwner.active = null;
        } else {
          koOwner.bench.splice(event.targetIdx, 1);
        }
        renderBattle();
        await delay(400);
        break;
      }
      case 'status_apply': {
        const statusSel = getPokemonSelector(event.targetPlayer, event.targetIdx);
        const statusColors = { poison: '#A33EA1', burn: '#EE8130', sleep: '#6b7280', confusion: '#eab308' };
        animateEl(statusSel, 'status-apply', 500);
        spawnParticlesAtEl(statusSel, statusColors[event.status] || '#fff', 10, {spread:40});
        renderBattle();
        await delay(500);
        break;
      }
      case 'status_cure': {
        const cureSel = getPokemonSelector(event.targetPlayer, event.targetIdx);
        animateEl(cureSel, 'status-cure', 500);
        renderBattle();
        await delay(400);
        break;
      }
      case 'status_tick': {
        const tickSel = getPokemonSelector(event.targetPlayer, event.targetIdx);
        const tickColors = { poison: '#A33EA1', burn: '#EE8130' };
        spawnParticlesAtEl(tickSel, tickColors[event.status] || '#fff', 10, {spread:40, size:5});
        animateEl(tickSel, 'status-apply', 500);
        // Apply status damage to local state
        if (event.damage) {
          const tickOwner = G.players[event.targetPlayer];
          const tickTarget = event.targetIdx === -1 ? tickOwner.active : tickOwner.bench[event.targetIdx];
          if (tickTarget) {
            tickTarget.damage = (tickTarget.damage || 0) + event.damage;
            tickTarget.hp = Math.max(0, tickTarget.maxHp - tickTarget.damage);
          }
        }
        renderBattle();
        await delay(600);
        break;
      }
      case 'heal': {
        const healSel = getPokemonSelector(event.targetPlayer, event.targetIdx);
        animateEl(healSel, 'heal-pulse', 500);
        spawnParticlesAtEl(healSel, '#4ade80', 8, {spread:30});
        showDamagePopupAt(event.amount, healSel, true);
        renderBattle();
        await delay(500);
        break;
      }
      case 'energy_gain': {
        const enSel = getPokemonSelector(event.targetPlayer, event.targetSlot === 'active' ? -1 : event.benchIdx);
        animateEl(enSel, 'energy-gain', 400);
        spawnParticlesAtEl(enSel, '#F7D02C', 6, {spread:30, size:4});
        renderBattle();
        await delay(400);
        break;
      }
      case 'retreat': {
        // Animate the active slot swap (match hotseat feel)
        const actSel = getPokemonSelector(event.player, -1);
        animateEl(actSel, 'slide-out', 320);
        await delay(320);
        renderBattle();
        animateEl(actSel, 'slide-in', 320);
        await delay(320);
        break;
      }
      case 'play_pokemon': {
        renderBattle();
        const benchSel = getPokemonSelector(event.player, event.benchIdx);
        animateEl(benchSel, 'slide-in', 350);
        await delay(350);
        break;
      }
      case 'item_proc': {
        const itemSel = getPokemonSelector(event.targetPlayer, event.targetIdx);
        animateEl(itemSel, 'item-proc', 600);
        await delay(400);
        break;
      }
      case 'turn_overlay': {
        showTurnOverlay(event.text);
        await delay(1000);
        break;
      }
      case 'turn_start': {
        renderBattle();
        await delay(300);
        break;
      }
      case 'win': {
        // Handled after replay
        break;
      }
      case 'log': {
        // Already in G.log, just re-render
        break;
      }
      case 'phase_change': {
        // Handled in handleGameState
        break;
      }
    }
  }

  isReplayingEvents = false;
}

// ============================================================
// ONLINE SETUP SCREEN
// ============================================================
let onlineSetupSelected = [];
let onlineSetupItemFor = null;

function showOnlineSetupScreen(phase) {
  onlineSetupSelected = [];
  onlineSetupItemFor = null;
  showScreen('setupScreen');
  const myP = G.players[myPlayerNum];
  const isActive = phase === 'setupActive';
  const phaseText = isActive ? `${myP.name}: Choose Active Pokémon + Item` : `${myP.name}: Choose Bench Pokémon + Items`;
  document.getElementById('setupPhaseText').textContent = phaseText;
  document.getElementById('setupMana').textContent = `Mana: ${myP.mana}`;

  // Turn-based online setup: if it's not your turn, show a waiting screen.
  if (G.currentPlayer !== myPlayerNum) {
    document.getElementById('setupHand').innerHTML = '<div style="color:#888;padding:20px;text-align:center">Waiting for opponent...</div>';
    // Show whatever info has already been revealed (server-side filtered).
    const preview = document.getElementById('setupPreview');
    const myConfirmed = `<div style="margin-bottom:10px;padding:8px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
        <div style="font-weight:800;font-size:12px;margin-bottom:6px;">Your Field</div>
        ${myP.active ? `<div style="display:flex;gap:10px;align-items:center;">
            <img src="${getImg(myP.active.name)}" alt="${myP.active.name}" style="width:54px;height:54px;object-fit:contain;border-radius:10px;" />
            <div style="display:flex;flex-direction:column;gap:2px;">
              <div style="font-size:12px;">${myP.active.name}</div>
              <div style="font-size:11px;color:#888;">${myP.active.heldItem || 'No item'}</div>
            </div>
          </div>` : '<div style="color:#888;font-size:12px;">(no active yet)</div>'}
        ${myP.bench && myP.bench.length ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
            ${myP.bench.map(pk => `<img src="${getImg(pk.name)}" alt="${pk.name}" style="width:40px;height:40px;object-fit:contain;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:2px;" />`).join('')}
          </div>` : ''}
      </div>`;
    // Use same opponent rendering logic as renderOnlineSetup.
    const oppP = G.players[opp(myPlayerNum)];
    let oppPanel = '';
    if (oppP && (oppP.active || (oppP.bench && oppP.bench.length))) {
      const oppActive = oppP.active ? `<div style="display:flex;gap:10px;align-items:center;">
          <img src="${getImg(oppP.active.name)}" alt="${oppP.active.name}" style="width:54px;height:54px;object-fit:contain;border-radius:10px;" />
          <div style="display:flex;flex-direction:column;gap:2px;">
            <div style="font-weight:800;font-size:12px;">Opponent Active</div>
            <div style="font-size:12px;">${oppP.active.name}</div>
            <div style="font-size:11px;color:#888;">${oppP.active.heldItem || 'No item'}</div>
          </div>
        </div>` : '';
      const oppBench = (oppP.bench && oppP.bench.length) ? `<div style="margin-top:8px;">
          <div style="font-weight:800;font-size:12px;margin-bottom:6px;">Opponent Bench</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${oppP.bench.map(pk => `<img src="${getImg(pk.name)}" alt="${pk.name}" style="width:40px;height:40px;object-fit:contain;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:2px;" />`).join('')}
          </div>
        </div>` : '';
      oppPanel = `<div style="margin-bottom:10px;padding:8px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;">${oppActive}${oppBench}</div>`;
    }
    preview.innerHTML = oppPanel + myConfirmed;
    return;
  }

  renderOnlineSetup();
}

function renderOnlineSetup() {
  const phase = G.phase;
  const isActive = phase === 'setupActive';
  const myP = G.players[myPlayerNum];
  const hand = document.getElementById('setupHand');

  // Virtual remaining mana while selecting (server only decrements on confirm).
  const spent = onlineSetupSelected.reduce((sum, s) => sum + (getPokemonData(s.name)?.cost || 0), 0);
  const remainingMana = Math.max(0, (myP.mana || 0) - spent);

  const placedNames = new Set();
  if (myP.active) placedNames.add(myP.active.name);
  myP.bench.forEach(pk => placedNames.add(pk.name));
  onlineSetupSelected.forEach(s => placedNames.add(s.name));

  const pokemonHand = myP.hand.filter(c => c.type === 'pokemon' && !placedNames.has(c.name));
  const itemHand = myP.hand.filter(c => c.type === 'items');

  let html = '';
  if (onlineSetupItemFor) {
    html += `<div style="width:100%;font-size:12px;color:#f59e0b;font-weight:700;margin-bottom:8px;">Choose item for ${onlineSetupItemFor} (or skip):</div>`;
    html += `<div class="setup-card" onclick="onlineAssignSetupItem(null)" style="width:100px;border:2px dashed rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;min-height:60px;"><span style="color:#666;font-size:11px">No Item</span></div>`;
    html += `<div class="setup-card" onclick="onlineCancelSetupItem()" style="width:100px;border:2px dashed rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;min-height:60px;"><span style="color:#666;font-size:11px">Cancel</span></div>`;
    itemHand.forEach(c => {
      const used = onlineSetupSelected.some(s => s.heldItem === c.name);
      html += `<div class="setup-card ${used?'placed':''}" onclick="onlineAssignSetupItem('${c.name.replace(/'/g,"\\'")}')">
        <img src="${getImg(c.name)}" alt="${c.name}">
      </div>`;
    });
  } else {
    pokemonHand.forEach(c => {
      const data = getPokemonData(c.name);
      const canAfford = remainingMana >= data.cost;
      html += `<div class="setup-card ${!canAfford?'placed':''}" onclick="${canAfford ? `onlineSelectSetupPokemon('${c.name.replace(/'/g,"\\'")}')` : ''}">
        <img src="${getImg(c.name)}" alt="${c.name}">
        <span class="cost-badge">${data.cost}⬡</span>
      </div>`;
    });
  }
  hand.innerHTML = html;

  const preview = document.getElementById('setupPreview');
  let previewHtml = '';

  // Opponent info panel (server filterStateForPlayer already hides anything that
  // should not be visible yet in setup).
  const oppP = G.players[opp(myPlayerNum)];
  if (oppP) {
    const oppActive = oppP.active ? `<div style="display:flex;gap:10px;align-items:center;">
        <img src="${getImg(oppP.active.name)}" alt="${oppP.active.name}" style="width:54px;height:54px;object-fit:contain;border-radius:10px;" />
        <div style="display:flex;flex-direction:column;gap:2px;">
          <div style="font-weight:800;font-size:12px;">Opponent Active</div>
          <div style="font-size:12px;">${oppP.active.name}</div>
          <div style="font-size:11px;color:#888;">${oppP.active.heldItem || 'No item'}</div>
        </div>
      </div>` : '';
    const oppBench = (oppP.bench && oppP.bench.length) ? `<div style="margin-top:8px;">
        <div style="font-weight:800;font-size:12px;margin-bottom:6px;">Opponent Bench</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${oppP.bench.map(pk => `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px;border:1px solid rgba(255,255,255,0.06);border-radius:10px;min-width:64px;">
              <img src="${getImg(pk.name)}" alt="${pk.name}" style="width:40px;height:40px;object-fit:contain;" />
              <div style="font-size:10px;text-align:center;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${pk.name}</div>
            </div>`).join('')}
        </div>
      </div>` : '';
    if (oppActive || oppBench) {
      previewHtml += `<div style="margin-bottom:10px;padding:8px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;">${oppActive}${oppBench}</div>`;
    }
  }
  if (isActive) {
    const sel = onlineSetupSelected[0];
    previewHtml += `<div class="setup-slot ${sel?'filled':''}" ${sel ? 'onclick="onlineUnselectSetup(0)" style="cursor:pointer"' : ''}>
      ${sel ? `<img src="${getImg(sel.name)}"><div><div class="setup-slot-name">${sel.name}</div><div class="setup-slot-label">${sel.heldItem||'No item'}</div><div class="setup-slot-label" style="color:#888">(click to remove)</div></div>` : '<div class="setup-slot-label">ACTIVE SLOT</div>'}
    </div>`;
  } else {
    for (let i = 0; i < 4; i++) {
      const sel = onlineSetupSelected[i];
      previewHtml += `<div class="setup-slot ${sel?'filled':''}" ${sel ? `onclick="onlineUnselectSetup(${i})" style="cursor:pointer"` : ''}>
        ${sel ? `<img src="${getImg(sel.name)}"><div><div class="setup-slot-name">${sel.name}</div><div class="setup-slot-label">${sel.heldItem||'No item'}</div><div class="setup-slot-label" style="color:#888">(click to remove)</div></div>` : `<div class="setup-slot-label">BENCH ${i+1}</div>`}
      </div>`;
    }
  }
  const canConfirmBench = !isActive && onlineSetupSelected.length === 0 && !onlineSetupItemFor && pokemonHand.every(c => remainingMana < getPokemonData(c.name).cost);
  const canConfirm = (onlineSetupSelected.length > 0 && !onlineSetupItemFor) || canConfirmBench;
  previewHtml += `<button class="setup-confirm-btn ${canConfirm ? 'db-confirm-btn ready' : 'db-confirm-btn disabled'}" onclick="onlineConfirmSetup()" ${canConfirm ? '' : 'disabled'}>${isActive ? 'Confirm Active' : (canConfirmBench ? 'Skip Bench (no mana)' : 'Confirm Bench')}</button>`;
  preview.innerHTML = previewHtml;

  document.getElementById('setupMana').textContent = `Mana: ${remainingMana}`;
}

function onlineSelectSetupPokemon(name) {
  const isActive = G.phase === 'setupActive';
  if (isActive && onlineSetupSelected.length >= 1) return;
  if (!isActive && onlineSetupSelected.length >= 4) return;
  // Enforce remaining mana client-side.
  const myP = G.players[myPlayerNum];
  const spent = onlineSetupSelected.reduce((sum, s) => sum + (getPokemonData(s.name)?.cost || 0), 0);
  const remainingMana = Math.max(0, (myP.mana || 0) - spent);
  const data = getPokemonData(name);
  if (!data || remainingMana < data.cost) return;
  onlineSetupItemFor = name;
  renderOnlineSetup();
}

function onlineCancelSetupItem() {
  onlineSetupItemFor = null;
  renderOnlineSetup();
}

function onlineUnselectSetup(idx) {
  if (onlineSetupItemFor) return;
  if (idx < 0 || idx >= onlineSetupSelected.length) return;
  onlineSetupSelected.splice(idx, 1);
  renderOnlineSetup();
}

function onlineAssignSetupItem(itemName) {
  const usedItems = new Set(onlineSetupSelected.map(s => s.heldItem).filter(Boolean));
  if (itemName && usedItems.has(itemName)) return;
  onlineSetupSelected.push({ name: onlineSetupItemFor, heldItem: itemName });
  onlineSetupItemFor = null;
  renderOnlineSetup();
}

function onlineConfirmSetup() {
  if (onlineSetupItemFor) return;
  sendMsg({ type: 'setupChoice', choices: onlineSetupSelected });
}

// ============================================================
// ONLINE DECK CONFIRM
// ============================================================
function onlineConfirmDeck() {
  if (dbSelection.length !== 15) return;
  sendMsg({ type: 'confirmDeck', deck: dbSelection });
}

// ============================================================
// LOBBY UI
// ============================================================
function showLobby() {
  showScreen('lobbyScreen');
}

function showWaitingScreen(code) {
  const el = document.getElementById('lobbyContent');
  el.innerHTML = `
    <div class="lobby-title">Room Code</div>
    <div class="lobby-code">${code}</div>
    <div class="lobby-status" id="lobbyStatus">Waiting for opponent to join...</div>
  `;
}

function updateLobbyStatus(text, type) {
  const el = document.getElementById('lobbyStatus');
  if (el) {
    el.textContent = text;
    el.className = 'lobby-status ' + (type || '');
  }
}

function lobbyCreateRoom() {
  const name = document.getElementById('lobbyName').value.trim() || 'Player';
  isOnline = true;
  connectToServer(name, 'create');
}

function lobbyJoinRoom() {
  const name = document.getElementById('lobbyName').value.trim() || 'Player';
  const code = document.getElementById('lobbyCode').value.trim().toUpperCase();
  if (!code || code.length !== 4) {
    updateLobbyStatus('Enter a 4-character room code', 'error');
    return;
  }
  isOnline = true;
  connectToServer(name, 'join', code);
}

function lobbyLocalPlay() {
  isOnline = false;
  myPlayerNum = null;
  initDeckBuild(1);
}

// ============================================================
// KEEPALIVE
// ============================================================
setInterval(() => {
  if (ws && ws.readyState === 1) {
    sendMsg({ type: 'ping' });
  }
}, 30000);

// ---------- INIT ----------
function init() {
  showLobby();
  // Init drag-pan for all visible scrollable areas
  PAN_SELECTORS.forEach(sel => {
    const el = document.querySelector(sel);
    if (el && !el.dataset.panInit) { enableDragPan(el); el.dataset.panInit = '1'; }
  });
}

init();


// --- Back-compat handlers for lobby buttons (HTML onclick=...) ---
(() => {
  try {
    if (typeof window.lobbyCreateRoom !== 'function') {
      window.lobbyCreateRoom = function () {
        if (typeof lobbyCreateRoom === 'function') return lobbyCreateRoom();
        if (typeof createRoom === 'function') return createRoom();
        if (typeof lobbyCreate === 'function') return lobbyCreate();
        if (typeof onlineCreateRoom === 'function') return onlineCreateRoom();
        if (typeof hostRoom === 'function') return hostRoom();
        if (typeof connectOnline === 'function') return connectOnline(true);
        if (typeof connectToServer === 'function') return connectToServer('host');
        console.error('No create-room function found in game.js');
        alert('Create-room function missing. Check game.js lobby functions.');
      };
    }
    if (typeof window.lobbyJoinRoom !== 'function') {
      window.lobbyJoinRoom = function () {
        if (typeof lobbyJoinRoom === 'function') return lobbyJoinRoom();
        if (typeof joinRoom === 'function') return joinRoom();
        if (typeof lobbyJoin === 'function') return lobbyJoin();
        if (typeof onlineJoinRoom === 'function') return onlineJoinRoom();
        if (typeof connectOnline === 'function') return connectOnline(false);
        if (typeof connectToServer === 'function') return connectToServer('join');
        console.error('No join-room function found in game.js');
        alert('Join-room function missing. Check game.js lobby functions.');
      };
    }
  } catch (e) {
    console.error('Lobby shim init failed:', e);
  }
})();
