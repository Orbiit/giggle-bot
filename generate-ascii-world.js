const Simplex = require("./simplex.js");

function randomTable(tableSize) {
  let table = [];
  for (let i = tableSize; i--;) table[i] = Math.floor(Math.random() * tableSize);
  return table;
}

function generateWorld(width, height, options) {
  let elevationTable = randomTable(options.tableSize),
  climateTable = randomTable(options.tableSize),
  world = [],
  scale = options.scale;
  for (let y = height; y--;) {
    world.splice(0, 0, []);
    for (let x = width; x--;) {
      let elevation = Simplex(elevationTable, x / scale, y / scale) * 32.5 + 0.5;
      if (elevation < 0.3) world[0].push(options.biomeChars.OCEAN);
      else if (elevation > 0.75) world[0].push(options.biomeChars.MOUNTAIN);
      else {
        let climate = Simplex(climateTable, x / scale, y / scale) * 32.5 + 0.5;
        if (climate < 0.33) world[0].push(options.biomeChars.DESERT);
        else if (climate < 0.67)
          world[0].push(Math.floor(Math.random() * options.villageChance) === 0 ? options.biomeChars.VILLAGE : options.biomeChars.PLAINS);
        else world[0].push(options.biomeChars.FOREST);
      }
    }
  }
  return world;
}

module.exports = generateWorld;
