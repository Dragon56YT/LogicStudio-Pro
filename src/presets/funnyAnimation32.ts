// =========================================================================
// MOTOR DE ANIMACIÓN DE 32 ESCENAS CÓMICAS (RGB332 64x48 + LCD 16x2 + AUDIO)
// "Las 32 Desventuras de Pepe el Bot vs El Bug del Viernes"
// =========================================================================

export interface FunnySceneDef {
  id: number;
  title: string;
  line1: string;
  line2: string;
  sfxFreq: number;
  sfxWave: number; // 0: square, 1: sawtooth, 2: triangle, 3: sine
}

const pad16 = (s: string) => s.slice(0, 16).padEnd(16, ' ');

export const FUNNY_SCENES_32: FunnySceneDef[] = [
  { id: 0, title: 'Despertar con Café', line1: pad16('01.DESPERTAR BOT'), line2: pad16('Pepe quiere cafe'), sfxFreq: 440, sfxWave: 2 },
  { id: 1, title: 'Cerebro Binario', line1: pad16('02.CEREBRO ON   '), line2: pad16('0110 -> BEEP BOP'), sfxFreq: 523, sfxWave: 2 },
  { id: 2, title: 'Tecleo Turbo', line1: pad16('03.TECLEO TURBO '), line2: pad16('1200 lineas/seg '), sfxFreq: 660, sfxWave: 0 },
  { id: 3, title: 'Cero Warnings?!', line1: pad16('04.COMPILANDO...'), line2: pad16('0 errors!Sospech'), sfxFreq: 587, sfxWave: 3 },
  { id: 4, title: 'Aparece El Bug', line1: pad16('05.EL BUG SALUDA'), line2: pad16('Hola guapo :)   '), sfxFreq: 220, sfxWave: 1 },
  { id: 5, title: 'Pánico Digital', line1: pad16('06.PANICO TOTAL!'), line2: pad16('Aaaah un 0 en 1!'), sfxFreq: 880, sfxWave: 0 },
  { id: 6, title: 'Bugs Se Multiplican', line1: pad16('07.CLONACION X8 '), line2: pad16('Bichos por todos'), sfxFreq: 740, sfxWave: 0 },
  { id: 7, title: 'Café Derramado', line1: pad16('08.CAFE AL TECL '), line2: pad16('Corto en ctrl+Z!'), sfxFreq: 196, sfxWave: 1 },
  { id: 8, title: 'Stack Overflow', line1: pad16('09.STACK OVERFLW'), line2: pad16('La torre se cae!'), sfxFreq: 165, sfxWave: 1 },
  { id: 9, title: 'Firewall en Llamas', line1: pad16('10.FIREWALL ARDE'), line2: pad16('Puerto 80 en BBQ'), sfxFreq: 262, sfxWave: 1 },
  { id: 10, title: 'CPU Sudando', line1: pad16('11.CPU A 99.9 C '), line2: pad16('Dame ventilador!'), sfxFreq: 311, sfxWave: 2 },
  { id: 11, title: 'Pato de Goma', line1: pad16('12.PATO DE GOMA '), line2: pad16('Cuac? Mira l.42 '), sfxFreq: 698, sfxWave: 2 },
  { id: 12, title: 'Lupa de Debug', line1: pad16('13.BUSCANDO EL ;'), line2: pad16('Faltaba un punto'), sfxFreq: 494, sfxWave: 3 },
  { id: 13, title: 'Pantallazo Azul', line1: pad16('14.BSOD CLASICO '), line2: pad16(':(  Reinicia ya '), sfxFreq: 147, sfxWave: 0 },
  { id: 14, title: 'Cable Suelto', line1: pad16('15.CABLE SUELTO '), line2: pad16('Era GND sin unir'), sfxFreq: 392, sfxWave: 2 },
  { id: 15, title: 'OVNI Roba RAM', line1: pad16('16.OVNI EN LA CP'), line2: pad16('Se llevan la RAM'), sfxFreq: 830, sfxWave: 3 },
  { id: 16, title: 'Patada Ninja', line1: pad16('17.NINJA REBOOT '), line2: pad16('Kiai! Reset hw! '), sfxFreq: 622, sfxWave: 0 },
  { id: 17, title: 'Pizza de Emergencia', line1: pad16('18.PIZZA 64 BITS'), line2: pad16('Extra pepperoni!'), sfxFreq: 554, sfxWave: 2 },
  { id: 18, title: 'Overclock 9000', line1: pad16('19.TURBO OVERCLK'), line2: pad16('A todo voltaje! '), sfxFreq: 932, sfxWave: 0 },
  { id: 19, title: 'Boss Final: MegaBug', line1: pad16('20.JEFE MEGABUG '), line2: pad16('No pasaras n00b!'), sfxFreq: 131, sfxWave: 1 },
  { id: 20, title: 'Rayo XOR', line1: pad16('21.RAYO LASER!  '), line2: pad16('Toma XOR en cara'), sfxFreq: 1046, sfxWave: 0 },
  { id: 21, title: 'El Bug Huye', line1: pad16('22.COHETE ESCAPE'), line2: pad16('Adios me las pir'), sfxFreq: 784, sfxWave: 2 },
  { id: 22, title: 'Deploy en Viernes', line1: pad16('23.DEPLOY VIERNS'), line2: pad16('17:59 Push prod!'), sfxFreq: 349, sfxWave: 1 },
  { id: 23, title: 'Servidor Kaboom', line1: pad16('24.SERVER KABOOM'), line2: pad16('Quien toco prod?'), sfxFreq: 110, sfxWave: 1 },
  { id: 24, title: 'Tests en Verde', line1: pad16('25.100% EN VERDE'), line2: pad16('Milagro de bits!'), sfxFreq: 659, sfxWave: 2 },
  { id: 25, title: 'Baile Disco Bot', line1: pad16('26.DISCO ROBOTO '), line2: pad16('Pasos prohibidos'), sfxFreq: 587, sfxWave: 2 },
  { id: 26, title: 'Trofeo Dorado', line1: pad16('27.TROFEO 64-BIT'), line2: pad16('Leyenda Digital!'), sfxFreq: 880, sfxWave: 2 },
  { id: 27, title: 'Siesta Táctica', line1: pad16('28.MODO SIESTA  '), line2: pad16('Zzz... CLK = 0Hz'), sfxFreq: 247, sfxWave: 3 },
  { id: 28, title: 'Ovejas Binarias', line1: pad16('29.SUEÑA CON LED'), line2: pad16('0, 1, 0, ovejas '), sfxFreq: 330, sfxWave: 3 },
  { id: 29, title: 'Alarma Lunes', line1: pad16('30.LUNES 08:00!!'), line2: pad16('NOOO otra vez!  '), sfxFreq: 988, sfxWave: 0 },
  { id: 30, title: 'Fuegos Artificiales', line1: pad16('31.FIESTA RGB332'), line2: pad16('Fuegos y gloria!'), sfxFreq: 1175, sfxWave: 2 },
  { id: 31, title: 'Fin y Bucle', line1: pad16('32.BUCLE INFINIT'), line2: pad16('Rebobinando...  '), sfxFreq: 440, sfxWave: 3 }
];

export function rgb332(r: number, g: number, b: number): number {
  const r3 = Math.max(0, Math.min(7, Math.round((r / 255) * 7)));
  const g3 = Math.max(0, Math.min(7, Math.round((g / 255) * 7)));
  const b2 = Math.max(0, Math.min(3, Math.round((b / 255) * 3)));
  return ((r3 << 5) | (g3 << 2) | b2) & 0xff;
}

const C_BG_DARK = rgb332(12, 16, 36);
const C_BG_TECH = rgb332(14, 32, 56);
const C_BG_PANIC = rgb332(64, 12, 20);
const C_BG_BLUE = rgb332(0, 72, 192);
const C_FLOOR = rgb332(36, 44, 72);
const C_WHITE = rgb332(255, 255, 255);
const C_SILVER = rgb332(180, 196, 220);
const C_DARK = rgb332(24, 28, 40);
const C_CYAN = rgb332(0, 245, 212);
const C_BLUE = rgb332(56, 160, 255);
const C_YELLOW = rgb332(255, 220, 40);
const C_GOLD = rgb332(255, 180, 0);
const C_ORANGE = rgb332(255, 110, 20);
const C_RED = rgb332(255, 45, 55);
const C_GREEN = rgb332(40, 235, 110);
const C_PINK = rgb332(255, 95, 190);
const C_PURPLE = rgb332(165, 70, 255);
const C_BROWN = rgb332(140, 75, 35);

const W = 64;
const H = 48;
const FRAME_CACHE = new Map<number, Uint8Array>();

function fillRect(buf: Uint8Array, x0: number, y0: number, rw: number, rh: number, col: number): void {
  const xStart = Math.max(0, Math.floor(x0));
  const yStart = Math.max(0, Math.floor(y0));
  const xEnd = Math.min(W, Math.floor(x0 + rw));
  const yEnd = Math.min(H, Math.floor(y0 + rh));
  for (let y = yStart; y < yEnd; y++) {
    const row = y * W;
    for (let x = xStart; x < xEnd; x++) {
      buf[row + x] = col;
    }
  }
}

function setPx(buf: Uint8Array, x: number, y: number, col: number): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix >= 0 && ix < W && iy >= 0 && iy < H) {
    buf[iy * W + ix] = col;
  }
}

function drawCircle(buf: Uint8Array, cx: number, cy: number, r: number, col: number): void {
  const r2 = r * r;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r2) setPx(buf, cx + dx, cy + dy, col);
    }
  }
}

function drawBot(
  buf: Uint8Array,
  cx: number,
  cy: number,
  mood: 'normal' | 'happy' | 'panic' | 'sleep' | 'cool' | 'hot' | 'ninja',
  frame: number
): void {
  const bob = mood === 'sleep' ? 0 : (frame & 1) * -1;
  const y = cy + bob;
  // Antenna
  fillRect(buf, cx, y - 13, 1, 4, C_SILVER);
  setPx(buf, cx, y - 14, frame % 2 === 0 ? C_CYAN : C_YELLOW);
  // Head
  fillRect(buf, cx - 7, y - 9, 15, 10, C_SILVER);
  fillRect(buf, cx - 6, y - 8, 13, 8, mood === 'hot' ? C_ORANGE : C_DARK);
  // Eyes
  const eyeCol = mood === 'panic' || mood === 'hot' ? C_RED : mood === 'happy' || mood === 'cool' ? C_GREEN : C_CYAN;
  if (mood === 'sleep') {
    fillRect(buf, cx - 4, y - 5, 3, 1, C_CYAN);
    fillRect(buf, cx + 2, y - 5, 3, 1, C_CYAN);
  } else if (mood === 'cool') {
    fillRect(buf, cx - 5, y - 6, 11, 3, C_DARK);
    fillRect(buf, cx - 4, y - 6, 4, 2, C_PURPLE);
    fillRect(buf, cx + 1, y - 6, 4, 2, C_PURPLE);
  } else if (mood === 'panic') {
    drawCircle(buf, cx - 3, y - 5, 2, C_WHITE);
    drawCircle(buf, cx + 3, y - 5, 2, C_WHITE);
    setPx(buf, cx - 3, y - 5, C_RED);
    setPx(buf, cx + 3, y - 5, C_RED);
  } else {
    fillRect(buf, cx - 4, y - 6, 2, 3, eyeCol);
    fillRect(buf, cx + 3, y - 6, 2, 3, eyeCol);
  }
  // Mouth
  if (mood === 'happy') {
    fillRect(buf, cx - 3, y - 2, 7, 1, C_GREEN);
    setPx(buf, cx - 4, y - 3, C_GREEN);
    setPx(buf, cx + 4, y - 3, C_GREEN);
  } else if (mood === 'panic') {
    fillRect(buf, cx - 2, y - 2, 5, 2, C_YELLOW);
  } else {
    fillRect(buf, cx - 2, y - 2, 5, 1, C_CYAN);
  }
  // Ninja headband
  if (mood === 'ninja') {
    fillRect(buf, cx - 7, y - 9, 15, 2, C_RED);
    fillRect(buf, cx + 8, y - 8 + (frame % 2), 3, 1, C_RED);
  }
  // Torso
  fillRect(buf, cx - 6, y + 2, 13, 9, C_BLUE);
  fillRect(buf, cx - 3, y + 4, 7, 4, C_DARK);
  setPx(buf, cx - 1 + (frame % 3), y + 6, C_CYAN);
  // Arms
  const armUp = mood === 'panic' || mood === 'happy' ? -4 : 0;
  fillRect(buf, cx - 9, y + 3 + armUp, 3, 6, C_SILVER);
  fillRect(buf, cx + 7, y + 3 + armUp, 3, 6, C_SILVER);
  // Legs
  const walk = mood === 'ninja' || mood === 'happy' ? (frame % 2 === 0 ? -1 : 1) : 0;
  fillRect(buf, cx - 4, y + 11, 3, 5 + walk, C_SILVER);
  fillRect(buf, cx + 2, y + 11, 3, 5 - walk, C_SILVER);
}

function drawBug(buf: Uint8Array, cx: number, cy: number, scale: number, frame: number, col = C_RED): void {
  const jx = (frame % 2) * 1;
  const x = cx + jx;
  const r = Math.max(2, Math.round(3 * scale));
  drawCircle(buf, x, cy, r, col);
  drawCircle(buf, x, cy - r + 1, Math.max(1, r - 1), C_PURPLE);
  // Eyes
  setPx(buf, x - 1, cy - r + 1, C_YELLOW);
  setPx(buf, x + 1, cy - r + 1, C_YELLOW);
  // Legs
  for (let l = -1; l <= 1; l++) {
    const wig = (frame + l) % 2;
    fillRect(buf, x - r - 2, cy + l * 2 + wig, 2, 1, C_ORANGE);
    fillRect(buf, x + r + 1, cy + l * 2 - wig, 2, 1, C_ORANGE);
  }
}

export function renderFunnyScene32Buffer(scene: number, frame: number): Uint8Array {
  const s = ((scene % 32) + 32) % 32;
  const f = ((frame % 8) + 8) % 8;
  const key = (s << 3) | f;
  const hit = FRAME_CACHE.get(key);
  if (hit) return hit;

  const buf = new Uint8Array(W * H);

  // Backdrop per mood
  let bg = C_BG_DARK;
  if ([5, 9, 10, 19, 23, 29].includes(s)) bg = C_BG_PANIC;
  else if (s === 13) bg = C_BG_BLUE;
  else if ([1, 2, 3, 12, 24].includes(s)) bg = C_BG_TECH;
  buf.fill(bg);

  // Subtle floor unless sky/BSOD scene
  if (s !== 13 && s !== 15 && s !== 21 && s !== 28 && s !== 30) {
    fillRect(buf, 0, 38, W, 10, C_FLOOR);
    fillRect(buf, 0, 38, W, 1, C_SILVER);
  }

  // Scene-specific header banner bar (2px progress indicator for 0..31)
  fillRect(buf, 0, 0, W, 3, C_DARK);
  fillRect(buf, 0, 0, Math.round(((s + 1) / 32) * W), 2, C_CYAN);

  switch (s) {
    case 0: // Waking up with coffee
      drawBot(buf, 22, 24, 'normal', f);
      fillRect(buf, 40, 26, 9, 9, C_WHITE);
      fillRect(buf, 49, 28, 3, 5, C_WHITE);
      fillRect(buf, 41, 27, 7, 2, C_BROWN);
      setPx(buf, 42 + (f % 2), 23 - (f % 3), C_SILVER);
      setPx(buf, 46 - (f % 2), 21 - ((f + 1) % 3), C_WHITE);
      break;
    case 1: // Brain ON binary rain
      for (let i = 0; i < 6; i++) {
        const y = ((f * 5 + i * 9) % 36) + 4;
        fillRect(buf, 6 + i * 10, y, 2, 4, i % 2 ? C_GREEN : C_CYAN);
      }
      drawBot(buf, 32, 24, 'happy', f);
      break;
    case 2: // Fast typing at desk
      drawBot(buf, 22, 22, 'normal', f);
      fillRect(buf, 32, 26, 22, 12, C_SILVER);
      fillRect(buf, 38, 16, 16, 10, C_DARK);
      for (let r = 0; r < 3; r++) fillRect(buf, 40, 18 + r * 3, 4 + ((f + r * 3) % 9), 1, C_GREEN);
      break;
    case 3: // Green build checkmark
      drawBot(buf, 18, 24, 'happy', f);
      drawCircle(buf, 46, 22, 10, C_GREEN);
      fillRect(buf, 41, 23, 3, 2, C_WHITE);
      fillRect(buf, 44, 25, 2, 2, C_WHITE);
      fillRect(buf, 46, 20, 6, 3, C_WHITE);
      break;
    case 4: // Evil bug sneaks in
      drawBot(buf, 18, 24, 'normal', f);
      drawBug(buf, 46 - (f % 4), 28, 1.3, f);
      break;
    case 5: // Total panic!
      drawBot(buf, 20, 24, 'panic', f);
      drawBug(buf, 44, 24 - (f % 3) * 2, 1.6, f);
      fillRect(buf, 20, 6, 2, 5, C_YELLOW);
      setPx(buf, 20, 12, C_YELLOW);
      break;
    case 6: // Bugs multiply x8
      drawBot(buf, 14, 25, 'panic', f);
      for (let i = 0; i < 6; i++) {
        drawBug(buf, 28 + (i % 3) * 12, 14 + Math.floor(i / 3) * 14 + (f % 2), 0.9, f + i);
      }
      break;
    case 7: // Coffee spilled on keyboard
      drawBot(buf, 18, 22, 'panic', f);
      fillRect(buf, 34, 31, 22, 6, C_SILVER);
      fillRect(buf, 36, 33, 18, 3, C_BROWN);
      drawCircle(buf, 45, 27, 4, C_BROWN);
      setPx(buf, 40 + f, 20, C_YELLOW);
      break;
    case 8: // Stack Overflow tower falling
      drawBot(buf, 16, 25, 'panic', f);
      for (let i = 0; i < 6; i++) {
        const tilt = i > 2 ? (f % 4) + (i - 2) * 2 : 0;
        fillRect(buf, 36 + tilt, 33 - i * 5, 14, 4, i % 2 ? C_ORANGE : C_YELLOW);
      }
      break;
    case 9: // Firewall on fire
      fillRect(buf, 24, 14, 16, 24, C_BROWN);
      for (let i = 0; i < 12; i++) {
        const fx = 12 + i * 4;
        const fh = 6 + ((f * 3 + i * 5) % 12);
        fillRect(buf, fx, 38 - fh, 3, fh, i % 2 ? C_ORANGE : C_RED);
        fillRect(buf, fx + 1, 38 - Math.floor(fh / 2), 1, Math.floor(fh / 2), C_YELLOW);
      }
      break;
    case 10: // CPU sweating at 99C
      fillRect(buf, 20, 14, 24, 20, C_DARK);
      fillRect(buf, 22, 16, 20, 16, f % 2 ? C_RED : C_ORANGE);
      drawBot(buf, 32, 24, 'hot', f);
      fillRect(buf, 47, 15 + (f % 4) * 3, 2, 4, C_CYAN);
      fillRect(buf, 15, 18 + ((f + 2) % 4) * 3, 2, 4, C_CYAN);
      break;
    case 11: // Rubber duck debugging
      drawBot(buf, 18, 24, 'normal', f);
      drawCircle(buf, 44, 29, 5, C_YELLOW);
      drawCircle(buf, 47, 22, 3, C_YELLOW);
      fillRect(buf, 50, 22, 4, 2, C_ORANGE);
      setPx(buf, 48, 21, C_DARK);
      break;
    case 12: // Magnifying glass hunting semicolon
      drawBot(buf, 18, 24, 'normal', f);
      drawCircle(buf, 42 + (f % 3), 21, 7, C_CYAN);
      drawCircle(buf, 42 + (f % 3), 21, 5, C_BG_TECH);
      fillRect(buf, 47 + (f % 3), 26, 6, 2, C_SILVER);
      fillRect(buf, 41 + (f % 3), 19, 2, 4, C_YELLOW);
      break;
    case 13: // Classic Blue Screen :(
      fillRect(buf, 12, 10, 4, 4, C_WHITE);
      fillRect(buf, 12, 22, 4, 4, C_WHITE);
      fillRect(buf, 22, 12, 2, 14, C_WHITE);
      fillRect(buf, 24, 10, 3, 3, C_WHITE);
      fillRect(buf, 24, 25, 3, 3, C_WHITE);
      if (f % 2 === 0) fillRect(buf, 36, 18, 18, 3, C_WHITE);
      fillRect(buf, 12, 34, 40, 3, C_SILVER);
      break;
    case 14: // Unplugged GND wire
      drawBot(buf, 16, 24, 'normal', f);
      fillRect(buf, 28, 24, 10, 3, C_RED);
      fillRect(buf, 44, 24, 12, 3, C_RED);
      if (f % 2 === 0) {
        setPx(buf, 40, 21, C_YELLOW);
        setPx(buf, 42, 27, C_YELLOW);
        setPx(buf, 41, 24, C_WHITE);
      }
      break;
    case 15: // UFO abducting RAM stick
      drawCircle(buf, 32, 12, 6, C_CYAN);
      fillRect(buf, 20, 12, 24, 5, C_SILVER);
      // Tractor beam
      for (let y = 17; y < 44; y++) {
        const hw = Math.floor((y - 14) * 0.45);
        if ((y + f) % 2 === 0) fillRect(buf, 32 - hw, y, hw * 2, 1, C_GREEN);
      }
      fillRect(buf, 26, 36 - (f % 6) * 2, 12, 5, C_GOLD);
      break;
    case 16: // Ninja reboot kick
      drawBot(buf, 24 + (f % 4), 22, 'ninja', f);
      fillRect(buf, 44, 16, 12, 22, C_DARK);
      fillRect(buf, 46, 20, 8, 4, f > 4 ? C_GREEN : C_RED);
      break;
    case 17: // Pizza time 64-bit
      drawBot(buf, 18, 24, 'happy', f);
      for (let r = 0; r < 14; r++) {
        fillRect(buf, 46 - Math.floor(r / 2), 18 + r, r + 1, 1, r < 2 ? C_BROWN : C_YELLOW);
      }
      setPx(buf, 45, 25, C_RED);
      setPx(buf, 48, 28, C_RED);
      setPx(buf, 43, 29, C_RED);
      break;
    case 18: // Overclock 9000 lightning
      drawBot(buf, 32, 24, 'cool', f);
      for (let i = 0; i < 4; i++) {
        const lx = 10 + i * 14 + (f % 3);
        fillRect(buf, lx, 8, 3, 8, C_YELLOW);
        fillRect(buf, lx - 2, 15, 5, 3, C_CYAN);
        fillRect(buf, lx - 1, 18, 3, 10, C_YELLOW);
      }
      break;
    case 19: // Boss Final MegaBug
      drawBot(buf, 14, 26, 'ninja', f);
      drawBug(buf, 46, 22, 3.0, f, C_RED);
      fillRect(buf, 32, 6, 26, 3, C_RED);
      break;
    case 20: // Laser XOR beam!
      drawBot(buf, 14, 24, 'cool', f);
      fillRect(buf, 22, 20, 26, 4, f % 2 ? C_CYAN : C_WHITE);
      drawBug(buf, 50, 22, 1.5, f, f % 2 ? C_YELLOW : C_ORANGE);
      break;
    case 21: // Bug escapes in rocket
      for (let i = 0; i < 10; i++) setPx(buf, (i * 19 + f * 3) % 64, (i * 13) % 44, C_WHITE);
      const ry = 32 - f * 3;
      fillRect(buf, 28, ry, 8, 12, C_SILVER);
      fillRect(buf, 29, ry - 4, 6, 4, C_RED);
      fillRect(buf, 30, ry + 12, 4, 5 + (f % 3), C_ORANGE);
      break;
    case 22: // Friday 17:59 deploy button
      drawBot(buf, 18, 24, 'normal', f);
      fillRect(buf, 38, 28, 16, 10, C_DARK);
      drawCircle(buf, 46, 25 + (f % 2), 6, C_RED);
      fillRect(buf, 40, 8, 12, 8, C_WHITE);
      fillRect(buf, 45, 9, 1, 4, C_DARK);
      fillRect(buf, 45, 12, 4, 1, C_DARK);
      break;
    case 23: // Server explosion
      fillRect(buf, 24, 18, 16, 20, C_DARK);
      drawCircle(buf, 32, 18, 6 + (f % 6), f % 2 ? C_ORANGE : C_YELLOW);
      drawCircle(buf, 32, 18, 3 + (f % 4), C_RED);
      break;
    case 24: // All tests green!
      drawBot(buf, 20, 24, 'happy', f);
      for (let i = 0; i < 4; i++) {
        fillRect(buf, 36, 12 + i * 6, 18, 4, C_GREEN);
      }
      break;
    case 25: // Disco dance floor
      for (let c = 0; c < 8; c++) {
        fillRect(buf, c * 8, 38, 8, 10, (c + f) % 2 ? C_PINK : C_PURPLE);
      }
      drawCircle(buf, 32, 8, 4, f % 2 ? C_WHITE : C_CYAN);
      drawBot(buf, 26 + (f % 4) * 3, 24, 'cool', f);
      break;
    case 26: // Golden 64-bit Trophy
      drawBot(buf, 18, 24, 'happy', f);
      fillRect(buf, 38, 14, 14, 10, C_GOLD);
      fillRect(buf, 42, 24, 6, 8, C_GOLD);
      fillRect(buf, 38, 32, 14, 5, C_BROWN);
      if (f % 2 === 0) setPx(buf, 45, 11, C_WHITE);
      break;
    case 27: // Siesta mode Zzz
      fillRect(buf, 14, 30, 36, 8, C_BLUE);
      drawBot(buf, 32, 24, 'sleep', f);
      const zx = 42 + (f % 4);
      const zy = 14 - (f % 4);
      fillRect(buf, zx, zy, 5, 1, C_CYAN);
      fillRect(buf, zx + 2, zy + 1, 2, 1, C_CYAN);
      fillRect(buf, zx, zy + 2, 5, 1, C_CYAN);
      break;
    case 28: // Dreaming of binary sheep
      drawBot(buf, 14, 32, 'sleep', f);
      const sx = 24 + (f * 4);
      drawCircle(buf, sx % 56 + 4, 16 - Math.abs((f % 4) - 2) * 3, 5, C_WHITE);
      fillRect(buf, (sx % 56) + 8, 15, 3, 3, C_DARK);
      break;
    case 29: // Monday 08:00 alarm clock!
      drawBot(buf, 18, 24, 'panic', f);
      drawCircle(buf, 46, 24 + (f % 2), 8, C_RED);
      drawCircle(buf, 46, 24 + (f % 2), 6, C_WHITE);
      fillRect(buf, 46, 20, 1, 5, C_DARK);
      fillRect(buf, 46, 24, 4, 1, C_DARK);
      break;
    case 30: // Fireworks finale
      for (let k = 0; k < 3; k++) {
        const fx = 14 + k * 18;
        const fy = 14 + (k % 2) * 8;
        const rad = (f + k * 2) % 8;
        const col = k === 0 ? C_CYAN : k === 1 ? C_PINK : C_YELLOW;
        for (let a = 0; a < 8; a++) {
          const ang = (a * Math.PI) / 4;
          setPx(buf, fx + Math.cos(ang) * rad * 1.4, fy + Math.sin(ang) * rad * 1.4, col);
        }
      }
      drawBot(buf, 32, 32, 'happy', f);
      break;
    case 31: // Infinite loop rewind
    default:
      drawBot(buf, 32, 24, 'cool', f);
      drawCircle(buf, 32, 24, 15, C_PURPLE);
      drawCircle(buf, 32, 24, 13, bg);
      drawBot(buf, 32, 24, 'happy', f);
      setPx(buf, 32 + Math.cos(f * 0.8) * 14, 24 + Math.sin(f * 0.8) * 14, C_CYAN);
      break;
  }

  FRAME_CACHE.set(key, buf);
  return buf;
}
