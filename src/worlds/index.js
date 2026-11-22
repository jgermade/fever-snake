// World order. Every APPLES_PER_WORLD apples the game moves to the next one.
import neon from './neon.js';
import retro95 from './retro95.js';
import cube from './cube.js';
import pocket from './pocket.js';
import tube from './tube.js';
import terminal from './terminal.js';
import firstperson from './firstperson.js';
import doodle from './doodle.js';

export const APPLES_PER_WORLD = 5;
export const WORLDS = [neon, retro95, cube, pocket, tube, terminal, firstperson, doodle];
