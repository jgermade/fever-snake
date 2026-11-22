// All worlds. Every APPLES_PER_WORLD apples the game moves on to the next one;
// the order is shuffled per run (see src/order.js). This authored order is the
// fallback and keeps 3D worlds (`three: true`) apart.
import neon from './neon.js';
import retro95 from './retro95.js';
import cube from './cube.js';
import pocket from './pocket.js';
import spreadsheet from './spreadsheet.js';
import tube from './tube.js';
import terminal from './terminal.js';
import portals from './portals.js';
import planet from './planet.js';
import isometric from './isometric.js';
import firstperson from './firstperson.js';
import lightsout from './lightsout.js';
import doodle from './doodle.js';
import mobius from './mobius.js';
import deepspace from './deepspace.js';
import vertigo from './vertigo.js';
import checkmate from './checkmate.js';
import aquarium from './aquarium.js';

export const APPLES_PER_WORLD = 5;
export const WORLDS = [
  neon, retro95, cube, pocket, spreadsheet, tube, terminal,
  portals, planet, isometric, firstperson, lightsout, mobius, doodle,
  deepspace, vertigo, checkmate, aquarium,
];
