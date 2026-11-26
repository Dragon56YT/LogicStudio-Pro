import { FUNNY_SCENES_32, renderFunnyScene32Buffer } from '../presets/funnyAnimation32';
import { cloneCleanSubNetlist, getSplitterChunks } from './catalog';
import {
  CustomICDef,
  LogicComponent,
  PinSignal,
  Wire,
  bit,
  maskBits,
  toSignedN,
  toUintN
} from './types';

export const SEG7_BCD_TABLE = [
  [1, 1, 1, 1, 1, 1, 0], // 0
  [0, 1, 1, 0, 0, 0, 0], // 1
  [1, 1, 0, 1, 1, 0, 1], // 2
  [1, 1, 1, 1, 0, 0, 1], // 3
  [0, 1, 1, 0, 0, 1, 1], // 4
  [1, 0, 1, 1, 0, 1, 1], // 5
  [1, 0, 1, 1, 1, 1, 1], // 6
  [1, 1, 1, 0, 0, 0, 0], // 7
  [1, 1, 1, 1, 1, 1, 1], // 8
  [1, 1, 1, 1, 0, 1, 1], // 9
  [1, 1, 1, 0, 1, 1, 1], // A
  [0, 0, 1, 1, 1, 1, 1], // b
  [1, 0, 0, 1, 1, 1, 0], // C
  [0, 1, 1, 1, 1, 0, 1], // d
  [1, 0, 0, 1, 1, 1, 1], // E
  [1, 0, 0, 0, 1, 1, 1]  // F
];

const nbits = (pv: Record<string, PinSignal>, p: string, n: number): number => {
  let v = 0;
  for (let i = 0; i < n; i++) v |= bit(pv[p + i]) << i;
  return v;
};

const putbits = (pv: Record<string, PinSignal>, p: string, v: number, n: number): void => {
  for (let i = 0; i < n; i++) pv[p + i] = (v >> i) & 1;
};

const outVal = (v: bigint, b: number): PinSignal => {
  const masked = BigInt.asUintN(b, v);
  return b === 1 ? (masked !== 0n ? 1 : 0) : masked;
};

// Precomputed 256-entry fixed-point Q8.8 sine/cosine LUT for 16-bit trig
const TRIG_SIN = new Int16Array(256);
const TRIG_COS = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  const rad = (i * Math.PI * 2) / 256;
  TRIG_SIN[i] = Math.round(Math.sin(rad) * 256);
  TRIG_COS[i] = Math.round(Math.cos(rad) * 256);
}

// Default 16x16 dungeon map for RAYCAST_CORE (editable externally via ROM_N)
export const DEFAULT_DOOM_MAP: number[] = [
  1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  1,0,0,0,0,0,2,0,0,0,0,0,0,0,4,1,
  1,0,0,0,0,0,2,0,0,3,3,0,0,0,0,1,
  1,0,0,2,2,0,0,0,0,3,0,0,0,2,0,1,
  1,0,0,2,0,0,0,0,0,0,0,0,0,2,0,1,
  1,0,0,0,0,0,1,1,0,0,0,2,2,2,0,1,
  1,2,2,0,0,0,1,0,0,0,0,0,0,0,0,1,
  1,0,0,0,0,0,0,0,0,4,0,0,3,0,0,1,
  1,0,0,3,0,0,0,0,0,0,0,0,3,0,0,1,
  1,0,0,3,3,0,0,2,2,0,0,0,0,0,0,1,
  1,0,0,0,0,0,0,2,0,0,0,1,1,0,0,1,
  1,0,1,1,0,0,0,0,0,0,0,1,0,0,0,1,
  1,0,1,0,0,0,3,0,0,2,0,0,0,0,0,1,
  1,0,0,0,0,0,3,0,0,2,0,0,0,4,0,1,
  1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
  1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1
];

function rgb332(r: number, g: number, b: number): number {
  const r3 = Math.max(0, Math.min(7, r >> 5));
  const g3 = Math.max(0, Math.min(7, g >> 5));
  const b2 = Math.max(0, Math.min(3, b >> 6));
  return (r3 << 5) | (g3 << 2) | b2;
}

function ensureUint8Array(raw: unknown, size: number, fallback?: number[]): Uint8Array {
  if (raw instanceof Uint8Array && raw.length === size) return raw;
  const out = new Uint8Array(size);
  if (Array.isArray(raw)) {
    for (let i = 0; i < Math.min(size, raw.length); i++) out[i] = Number(raw[i]) & 255;
    return out;
  }
  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    let copied = false;
    for (let i = 0; i < size; i++) {
      if (rec[i] !== undefined) {
        out[i] = Number(rec[i]) & 255;
        copied = true;
      }
    }
    if (copied) return out;
  }
  if (fallback) {
    for (let i = 0; i < Math.min(size, fallback.length); i++) out[i] = fallback[i] & 255;
  }
  return out;
}

function initRaycastState(st: LogicComponent['internalState']): void {
  st.rcMap = ensureUint8Array(st.rcMap, 256, DEFAULT_DOOM_MAP);
  st.rcTempMap = ensureUint8Array(st.rcTempMap, 256);
  if (st.rcInit) return;
  st.rcInit = true;
  st.rcTempNonZero = false;
  st.rcScanAddr = 0;
  st.rcX = 2.5;
  st.rcY = 2.5;
  st.rcAng = 0.45;
  st.rcEnemyX = 8.5;
  st.rcEnemyY = 7.5;
  st.rcEnemyHp = 3;
  st.rcEnemyRespawn = 0;
  st.rcFireTimer = 0;
  st.rcPrevFire = 0;
  st.rcKills = 0;
  st.rcColIdx = 0;
  st.rcRowIdx = 0;
  st.rcPx = 0n;
  st.rcPy = 0n;
  st.rcCol = 0n;
  st.rcWe = 0;
  st.rcSwap = 0;
  st.rcSfx = 0;
  st.rcHitDist = 4.0;
  st.rcHitWall = 1;
  st.rcHitSide = 0;
  st.rcHitU = 0;
}

function castRayColumn(st: LogicComponent['internalState'], colIdx: number): void {
  const map = ensureUint8Array(st.rcMap, 256, DEFAULT_DOOM_MAP);
  const px = (st.rcX as number) ?? 2.5;
  const py = (st.rcY as number) ?? 2.5;
  const ang = (st.rcAng as number) ?? 0.45;
  const fov = 1.05;
  const rayAng = ang + ((colIdx / 63) - 0.5) * fov;
  const dirX = Math.cos(rayAng);
  const dirY = Math.sin(rayAng);

  let mapX = Math.floor(px);
  let mapY = Math.floor(py);
  const deltaDistX = Math.abs(dirX) < 1e-6 ? 1e6 : Math.abs(1 / dirX);
  const deltaDistY = Math.abs(dirY) < 1e-6 ? 1e6 : Math.abs(1 / dirY);

  let stepX = 0;
  let stepY = 0;
  let sideDistX = 0;
  let sideDistY = 0;

  if (dirX < 0) {
    stepX = -1;
    sideDistX = (px - mapX) * deltaDistX;
  } else {
    stepX = 1;
    sideDistX = (mapX + 1.0 - px) * deltaDistX;
  }
  if (dirY < 0) {
    stepY = -1;
    sideDistY = (py - mapY) * deltaDistY;
  } else {
    stepY = 1;
    sideDistY = (mapY + 1.0 - py) * deltaDistY;
  }

  let hitWall = 1;
  let side = 0;
  for (let iter = 0; iter < 24; iter++) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }
    if (mapX < 0 || mapX >= 16 || mapY < 0 || mapY >= 16) {
      hitWall = 1;
      break;
    }
    const cell = map[(mapY << 4) | mapX];
    if (cell > 0) {
      hitWall = cell;
      break;
    }
  }

  const rawDist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
  const perpDist = Math.max(0.25, rawDist * Math.cos(rayAng - ang));
  let wallX = side === 0 ? py + rawDist * dirY : px + rawDist * dirX;
  wallX -= Math.floor(wallX);

  st.rcHitDist = perpDist;
  st.rcHitWall = hitWall;
  st.rcHitSide = side;
  st.rcHitU = Math.floor(wallX * 8) & 7;

  // Sprite (Cacodemon) projection for this column
  const ex = (st.rcEnemyX as number) ?? 8.5;
  const ey = (st.rcEnemyY as number) ?? 7.5;
  const hp = (st.rcEnemyHp as number) ?? 0;
  let sprVisible = false;
  let sprDist = 999;
  let sprHalfH = 0;
  let sprU = 0;
  if (hp > 0) {
    const dx = ex - px;
    const dy = ey - py;
    sprDist = Math.hypot(dx, dy);
    if (sprDist > 0.45 && sprDist < perpDist) {
      let relAng = Math.atan2(dy, dx) - ang;
      while (relAng > Math.PI) relAng -= Math.PI * 2;
      while (relAng < -Math.PI) relAng += Math.PI * 2;
      const sprCol = (relAng / fov + 0.5) * 63;
      sprHalfH = Math.min(22, Math.floor(18 / sprDist));
      const halfW = Math.max(2, sprHalfH * 0.9);
      if (Math.abs(colIdx - sprCol) <= halfW) {
        sprVisible = true;
        sprU = (colIdx - sprCol) / halfW; // -1..1
      }
    }
  }
  st.rcSprVis = sprVisible;
  st.rcSprHalfH = sprHalfH;
  st.rcSprU = sprU;
}

function shadeRaycastPixel(st: LogicComponent['internalState'], colIdx: number, rowIdx: number): number {
  const halfH = Math.min(24, Math.floor(24 / ((st.rcHitDist as number) || 1)));
  const top = 24 - halfH;
  const bot = 24 + halfH;
  const fireTimer = (st.rcFireTimer as number) || 0;

  // DOOM Gun HUD at bottom center
  if (rowIdx >= 38 && colIdx >= 26 && colIdx <= 37) {
    const dx = Math.abs(colIdx - 31.5);
    if (fireTimer > 0 && rowIdx <= 42 && dx < 4.5) {
      return rgb332(255, 224, 64); // Muzzle flash
    }
    if (rowIdx >= 40 && dx < 3.2) {
      return dx < 1.3 ? rgb332(96, 96, 112) : rgb332(56, 56, 68);
    }
  }

  // Crosshair
  if ((colIdx === 31 || colIdx === 32) && rowIdx === 23) {
    return rgb332(255, 255, 192);
  }

  // Sprite overlay (Imp / Cacodemon)
  if (st.rcSprVis) {
    const sh = (st.rcSprHalfH as number) || 6;
    const sTop = 24 - sh;
    const sBot = 24 + sh;
    if (rowIdx >= sTop && rowIdx <= sBot) {
      const v = ((rowIdx - 24) / Math.max(1, sh)); // -1..1
      const u = (st.rcSprU as number) || 0;
      if (u * u + v * v <= 0.92) {
        if (Math.abs(v + 0.25) < 0.22 && Math.abs(Math.abs(u) - 0.35) < 0.18) {
          return rgb332(255, 240, 0); // Glowing eyes
        }
        if (v > 0.2 && v < 0.55 && Math.abs(u) < 0.45) {
          return rgb332(32, 0, 0); // Mouth
        }
        return v < 0 ? rgb332(224, 32, 32) : rgb332(160, 0, 32);
      }
    }
  }

  // HUD Kills bar on top left
  if (rowIdx === 1 && colIdx >= 2 && colIdx < 2 + Math.min(20, ((st.rcKills as number) || 0) * 2)) {
    return (colIdx & 1) === 0 ? rgb332(255, 64, 64) : rgb332(255, 192, 0);
  }

  if (rowIdx < top) {
    // Ceiling
    const k = Math.max(0, 24 - rowIdx);
    return rgb332(16 + (k >> 1), 8, 24 + (k >> 1));
  }
  if (rowIdx > bot) {
    // Floor with distance shading
    const k = Math.max(0, rowIdx - 24);
    return rgb332(36 + k * 2, 24 + k, 16);
  }

  // Wall shading
  const dist = (st.rcHitDist as number) || 1;
  const side = (st.rcHitSide as number) || 0;
  const wall = (st.rcHitWall as number) || 1;
  const u = (st.rcHitU as number) || 0;
  const texV = Math.floor(((rowIdx - top) / Math.max(1, bot - top)) * 8) & 7;
  const mortar = (texV === 0 || texV === 4 || (u === 0 && (texV < 4)) || (u === 4 && texV >= 4)) ? 0.65 : 1.0;
  const fog = Math.max(0.28, Math.min(1.0, 1.35 - dist * 0.14)) * (side ? 0.72 : 1.0) * mortar;

  let baseR = 192, baseG = 48, baseB = 32;
  if (wall === 2) { baseR = 80; baseG = 144; baseB = 224; }
  else if (wall === 3) { baseR = 48; baseG = 224; baseB = 80; }
  else if (wall >= 4) { baseR = 240; baseG = 192; baseB = 40; }

  const flashBoost = fireTimer > 0 ? 1.25 : 1.0;
  return rgb332(
    Math.min(255, Math.round(baseR * fog * flashBoost)),
    Math.min(255, Math.round(baseG * fog * flashBoost)),
    Math.min(255, Math.round(baseB * fog * flashBoost))
  );
}

export function evaluateCombinationalOutputs(
  comp: LogicComponent,
  customICs: CustomICDef[] = [],
  tunnelBus?: Map<string, PinSignal>
): void {
  const pv = comp.pinValues;
  const st = comp.internalState;
  const b = Math.max(1, Math.min(64, comp.bits || 1));

  switch (comp.type) {
    case 'SWITCH':
    case 'BUTTON':
    case 'HIGH':
    case 'LOW':
      pv.out = bit(st.value as PinSignal);
      break;

    case 'CLOCK':
      pv.out = st.clockOut ? 1 : 0;
      break;

    case 'CONST_N':
    case 'NUM_STEPPER':
      pv.out = toUintN(st.value as PinSignal, b);
      break;

    case 'DIP_SWITCH':
      pv.bus = toUintN(st.value as PinSignal, b);
      break;

    case 'HEX_KEY': {
      const hv = Number(st.hexVal || 0) & 15;
      pv.b0 = hv & 1;
      pv.b1 = (hv >> 1) & 1;
      pv.b2 = (hv >> 2) & 1;
      pv.b3 = (hv >> 3) & 1;
      break;
    }

    case 'HEX_KEY_N':
      pv.out = toUintN(st.hexVal as PinSignal, b);
      break;

    case 'PULSE_GEN':
      pv.out = bit(st.seqBits[st.seqIdx % st.seqBits.length]);
      break;

    case 'GAMEPAD': {
      const g = st.gamepadBits || 0;
      pv.w = g & 1;
      pv.s = (g >> 1) & 1;
      pv.a = (g >> 2) & 1;
      pv.d = (g >> 3) & 1;
      pv.fire = (g >> 4) & 1;
      pv.bus = BigInt(g & 31);
      break;
    }

    case 'KEYBOARD_ASCII':
      pv.ascii = BigInt((st.lastKeyAscii || 0) & 0xff);
      pv.ready = st.keyReady ? 1 : 0;
      break;

    case 'BUFFER':
    case 'PROBE':
      pv.out = b === 1 ? bit(pv.in0) : toUintN(pv.in0, b);
      break;

    case 'NOT':
      if (b === 1) {
        pv.out = bit(pv.in0) === 1 ? 0 : 1;
      } else {
        pv.out = BigInt.asUintN(b, ~toUintN(pv.in0, b));
      }
      break;

    case 'AND':
    case 'NAND':
    case 'OR':
    case 'NOR':
    case 'XOR':
    case 'XNOR': {
      const n = Math.max(2, Math.min(4, comp.inputCount || 2));
      if (b === 1) {
        const vals: number[] = [];
        for (let i = 0; i < n; i++) vals.push(bit(pv[`in${i}`]));
        let res = 0;
        if (comp.type === 'AND') res = vals.every(v => v === 1) ? 1 : 0;
        else if (comp.type === 'NAND') res = vals.every(v => v === 1) ? 0 : 1;
        else if (comp.type === 'OR') res = vals.some(v => v === 1) ? 1 : 0;
        else if (comp.type === 'NOR') res = vals.some(v => v === 1) ? 0 : 1;
        else if (comp.type === 'XOR') res = (vals.reduce((a, c) => a + c, 0) % 2) === 1 ? 1 : 0;
        else res = (vals.reduce((a, c) => a + c, 0) % 2) === 0 ? 1 : 0;
        pv.out = res;
      } else {
        let acc = toUintN(pv.in0, b);
        for (let i = 1; i < n; i++) {
          const cur = toUintN(pv[`in${i}`], b);
          if (comp.type === 'AND' || comp.type === 'NAND') acc &= cur;
          else if (comp.type === 'OR' || comp.type === 'NOR') acc |= cur;
          else acc ^= cur;
        }
        if (comp.type === 'NAND' || comp.type === 'NOR' || comp.type === 'XNOR') {
          acc = ~acc;
        }
        pv.out = BigInt.asUintN(b, acc);
      }
      break;
    }

    case 'MAJ3':
      if (b === 1) {
        pv.out = bit(pv.in0) + bit(pv.in1) + bit(pv.in2) >= 2 ? 1 : 0;
      } else {
        const va = toUintN(pv.in0, b);
        const vb = toUintN(pv.in1, b);
        const vc = toUintN(pv.in2, b);
        pv.out = BigInt.asUintN(b, (va & vb) | (vb & vc) | (va & vc));
      }
      break;

    case 'TRI_BUFFER':
      pv.out = bit(pv.oe) === 1 ? (b === 1 ? bit(pv.in0) : toUintN(pv.in0, b)) : 'Z';
      break;

    case 'TUNNEL':
      if (comp.tunnelDir === 'in') {
        const key = (comp.tunnelTag || 'SIG').trim();
        const sig = tunnelBus ? tunnelBus.get(key) : 0;
        if (sig === 'Z' || sig === 'ERR') {
          pv.out = sig;
        } else {
          pv.out = b === 1 ? bit(sig) : toUintN(sig, b);
        }
      }
      break;

    case 'SPLITTER': {
      const bus = toUintN(pv.bus, b);
      const chunks = getSplitterChunks(comp);
      let shift = 0n;
      chunks.forEach((cw, idx) => {
        const chunkVal = BigInt.asUintN(cw, bus >> shift);
        pv[`p${idx}`] = cw === 1 ? (chunkVal !== 0n ? 1 : 0) : chunkVal;
        shift += BigInt(cw);
      });
      break;
    }

    case 'MERGER': {
      const chunks = getSplitterChunks(comp);
      let acc = 0n;
      let shift = 0n;
      chunks.forEach((cw, idx) => {
        const part = toUintN(pv[`p${idx}`], cw);
        acc |= part << shift;
        shift += BigInt(cw);
      });
      pv.bus = BigInt.asUintN(b, acc);
      break;
    }

    case 'BUS_SLICE': {
      const hi = Math.max(0, Math.min(b - 1, comp.sliceHi ?? Math.min(b - 1, 7)));
      const lo = Math.max(0, Math.min(hi, comp.sliceLo ?? 0));
      const outW = hi - lo + 1;
      const extracted = (toUintN(pv.in0, b) >> BigInt(lo)) & maskBits(outW);
      pv.out = outVal(extracted, outW);
      break;
    }

    case 'BIT_EXTEND': {
      const inW = Math.max(1, Math.min(32, Math.floor(b / 2) || 4));
      const raw = toUintN(pv.in0, inW);
      pv.out = comp.signedMode ? BigInt.asUintN(b, BigInt.asIntN(inW, raw)) : BigInt.asUintN(b, raw);
      break;
    }

    case 'SR_LATCH': {
      const s = bit(pv.s);
      const r = bit(pv.r);
      if (s === 1 && r === 0) { st.q = 1; st.qn = 0; }
      else if (s === 0 && r === 1) { st.q = 0; st.qn = 1; }
      else if (s === 1 && r === 1) { st.q = 0; st.qn = 0; }
      pv.q = st.q;
      pv.qn = st.qn;
      break;
    }

    case 'LATCH_D': {
      if (bit(pv.en)) st.q = bit(pv.d);
      pv.q = st.q ? 1 : 0;
      pv.qn = st.q ? 0 : 1;
      break;
    }

    case 'D_FF':
    case 'T_FF':
    case 'JK_FF':
    case 'RS_FF':
      pv.q = st.q;
      pv.qn = st.qn;
      break;

    case 'PULSE_ONE':
      pv.q = st.q ? 1 : 0;
      break;

    case 'EDGE_DET':
      pv.rise = st.rise ? 1 : 0;
      pv.fall = st.fall ? 1 : 0;
      break;

    case 'REG_4':
      pv.q0 = st.reg[0];
      pv.q1 = st.reg[1];
      pv.q2 = st.reg[2];
      pv.q3 = st.reg[3];
      break;

    case 'REG_N':
      pv.q = BigInt.asUintN(b, st.regBig ?? 0n);
      break;

    case 'REG_FILE_N': {
      if (!Array.isArray(st.regFile) || st.regFile.length !== 8) st.regFile = new Array(8).fill(0n);
      const ra = Number(toUintN(pv.ra, 3)) & 7;
      const rb = Number(toUintN(pv.rb, 3)) & 7;
      pv.qa = toUintN(st.regFile[ra] as PinSignal, b);
      pv.qb = toUintN(st.regFile[rb] as PinSignal, b);
      break;
    }

    case 'COUNTER_4':
      pv.q3 = (st.count >> 3) & 1;
      pv.q2 = (st.count >> 2) & 1;
      pv.q1 = (st.count >> 1) & 1;
      pv.q0 = st.count & 1;
      break;

    case 'COUNTER_N': {
      const c = BigInt.asUintN(b, st.countBig ?? 0n);
      pv.q = c;
      const max = maskBits(b);
      pv.co = bit(pv.up) ? (c === max ? 1 : 0) : (c === 0n ? 1 : 0);
      break;
    }

    case 'UDCOUNTER_4': {
      const c = (st.count || 0) & 15;
      putbits(pv, 'q', c, 4);
      pv.co = bit(pv.up) ? (c === 15 ? 1 : 0) : (c === 0 ? 1 : 0);
      break;
    }

    case 'COUNTER_BCD': {
      const c = (st.count || 0) % 10;
      putbits(pv, 'q', c, 4);
      pv.co = c === 9 ? 1 : 0;
      break;
    }

    case 'SHIFT_REG_4': {
      const r = st.reg || [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) pv['q' + i] = r[i] ? 1 : 0;
      break;
    }

    case 'SHIFT_REG_N': {
      const val = BigInt.asUintN(b, st.regBig ?? 0n);
      pv.q = val;
      pv.sout = Number((val >> BigInt(b - 1)) & 1n);
      break;
    }

    case 'FREQ_DIV': {
      const c = (st.count || 0) & 15;
      pv.d2 = c & 1;
      pv.d4 = (c >> 1) & 1;
      pv.d8 = (c >> 2) & 1;
      pv.d16 = (c >> 3) & 1;
      break;
    }

    case 'TIMER_N': {
      const val = BigInt.asUintN(b, st.countBig ?? 0n);
      const per = toUintN(pv.period, b);
      pv.q = val;
      pv.tick = per > 0n && val === 0n && bit(pv.en) === 1 ? 1 : 0;
      break;
    }

    case 'LFSR_4':
      putbits(pv, 'q', st.count || 1, 4);
      break;

    case 'LFSR_N':
      pv.q = BigInt.asUintN(b, st.countBig ?? 1n);
      break;

    case 'PWM_GEN': {
      const cnt = (st.count || 0) & 255;
      const duty = Number(toUintN(pv.duty, 8)) & 255;
      const en = bit(pv.en) === 1 && bit(pv.rst) === 0;
      pv.cnt = BigInt(cnt);
      pv.pwm = !en || duty === 0 ? 0 : duty === 255 ? 1 : cnt < duty ? 1 : 0;
      break;
    }

    case 'RING_CNT': {
      const q = (st.count || 0) & 255;
      pv.q = BigInt(q);
      pv.tc = bit(pv.jhn) === 1 ? (q === 0xff ? 1 : 0) : q === 0x80 ? 1 : 0;
      break;
    }

    case 'CRC8_GEN':
      pv.crc = BigInt((st.count || 0) & 255);
      break;

    case 'UART_TX':
      pv.tx = st.uartTxOut !== undefined ? (st.uartTxOut ? 1 : 0) : 1;
      pv.busy = st.uartTxBusy ? 1 : 0;
      break;

    case 'UART_RX':
      pv.data = BigInt((st.uartRxData || 0) & 255);
      pv.valid = st.uartRxValid ? 1 : 0;
      pv.err = st.uartRxErr ? 1 : 0;
      break;

    case 'STACK_LIFO': {
      const stk = Array.isArray(st.stack) ? st.stack : [];
      pv.q = stk.length > 0 ? BigInt.asUintN(b, stk[stk.length - 1]) : 0n;
      pv.empty = stk.length === 0 ? 1 : 0;
      pv.full = stk.length >= 32 ? 1 : 0;
      break;
    }

    case 'FIFO_N': {
      const qArr = Array.isArray(st.fifo) ? st.fifo : [];
      pv.q = qArr.length > 0 ? BigInt.asUintN(b, toUintN(qArr[0] as PinSignal, b)) : 0n;
      pv.empty = qArr.length === 0 ? 1 : 0;
      pv.full = qArr.length >= 32 ? 1 : 0;
      pv.cnt = BigInt(qArr.length);
      break;
    }

    case 'HALF_ADDER': {
      const a = bit(pv.a), bv = bit(pv.b);
      pv.s = a ^ bv;
      pv.c = a & bv;
      break;
    }

    case 'FULL_ADDER': {
      const a = bit(pv.a), bv = bit(pv.b), cin = bit(pv.cin);
      pv.s = a ^ bv ^ cin;
      pv.cout = (a & bv) | (cin & (a ^ bv));
      break;
    }

    case 'ADDER_4': {
      const r = nbits(pv, 'a', 4) + nbits(pv, 'b', 4) + bit(pv.cin);
      putbits(pv, 's', r, 4);
      pv.cout = r > 15 ? 1 : 0;
      break;
    }

    case 'ADDER_N': {
      const av = toUintN(pv.a, b);
      const bv = toUintN(pv.b, b);
      const cin = BigInt(bit(pv.cin));
      const full = av + bv + cin;
      pv.y = BigInt.asUintN(b, full);
      pv.cout = (full >> BigInt(b)) !== 0n ? 1 : 0;
      break;
    }

    case 'SUB_N': {
      const av = toUintN(pv.a, b);
      const bv = toUintN(pv.b, b);
      const bin = BigInt(bit(pv.cin));
      const diff = av - bv - bin;
      pv.y = BigInt.asUintN(b, diff);
      pv.cout = diff < 0n ? 1 : 0;
      break;
    }

    case 'MULT_2X2':
      putbits(pv, 'p', (bit(pv.a0) | (bit(pv.a1) << 1)) * (bit(pv.b0) | (bit(pv.b1) << 1)), 4);
      break;

    case 'MULT_N': {
      const av = comp.signedMode ? toSignedN(toUintN(pv.a, b), b) : toUintN(pv.a, b);
      const bv = comp.signedMode ? toSignedN(toUintN(pv.b, b), b) : toUintN(pv.b, b);
      const prod = av * bv;
      pv.p = BigInt.asUintN(b, prod);
      pv.hi = BigInt.asUintN(b, prod >> BigInt(b));
      break;
    }

    case 'DIV_N': {
      const av = toUintN(pv.a, b);
      const bv = toUintN(pv.b, b);
      if (bv === 0n) {
        pv.q = maskBits(b);
        pv.r = av;
      } else if (comp.signedMode) {
        const sa = toSignedN(av, b);
        const sb = toSignedN(bv, b);
        pv.q = BigInt.asUintN(b, sa / sb);
        pv.r = BigInt.asUintN(b, sa % sb);
      } else {
        pv.q = BigInt.asUintN(b, av / bv);
        pv.r = BigInt.asUintN(b, av % bv);
      }
      break;
    }

    case 'SHIFTER_N': {
      const av = toUintN(pv.a, b);
      const amt = Number(toUintN(pv.sh, 6)) % b;
      const op = Number(toUintN(pv.op, 3));
      const sAmt = BigInt(amt);
      const invAmt = BigInt(b - amt);
      let res = av;
      switch (op) {
        case 0: res = av << sAmt; break; // LSL
        case 1: res = av >> sAmt; break; // LSR
        case 2: res = toSignedN(av, b) >> sAmt; break; // ASR
        case 3: res = amt === 0 ? av : (av << sAmt) | (av >> invAmt); break; // ROL
        case 4: res = amt === 0 ? av : (av >> sAmt) | (av << invAmt); break; // ROR
        default: res = av << sAmt; break;
      }
      pv.y = BigInt.asUintN(b, res);
      break;
    }

    case 'INC_DEC_N': {
      const av = toUintN(pv.a, b);
      const stepRaw = pv.step === undefined ? 1n : toUintN(pv.step, 4);
      const step = stepRaw > 0n ? stepRaw : 1n;
      const isSub = bit(pv.sub) === 1;
      const raw = isSub ? av - step : av + step;
      pv.y = BigInt.asUintN(b, raw);
      pv.cout = isSub ? (raw < 0n ? 1 : 0) : ((raw >> BigInt(b)) !== 0n ? 1 : 0);
      break;
    }

    case 'ABS_NEG_N': {
      const av = toUintN(pv.a, b);
      const op = Number(toUintN(pv.op, 2));
      if (op === 0) {
        pv.y = BigInt.asUintN(b, -toSignedN(av, b));
      } else if (op === 1) {
        const sa = toSignedN(av, b);
        pv.y = BigInt.asUintN(b, sa < 0n ? -sa : sa);
      } else if (op === 2) {
        let rev = 0n;
        for (let i = 0; i < b; i++) {
          if ((av >> BigInt(i)) & 1n) rev |= 1n << BigInt(b - 1 - i);
        }
        pv.y = BigInt.asUintN(b, rev);
      } else {
        const bytes = Math.max(1, Math.ceil(b / 8));
        let swp = 0n;
        for (let i = 0; i < bytes; i++) {
          const byteVal = (av >> BigInt(i * 8)) & 0xFFn;
          swp |= byteVal << BigInt((bytes - 1 - i) * 8);
        }
        pv.y = BigInt.asUintN(b, swp);
      }
      break;
    }

    case 'MIN_MAX_N': {
      const ua = toUintN(pv.a, b);
      const ub = toUintN(pv.b, b);
      const ca = comp.signedMode ? toSignedN(ua, b) : ua;
      const cb = comp.signedMode ? toSignedN(ub, b) : ub;
      pv.min = ca <= cb ? ua : ub;
      pv.max = ca >= cb ? ua : ub;
      break;
    }

    case 'POPCOUNT_N': {
      const dv = toUintN(pv.d, b);
      let pop = 0;
      for (let i = 0; i < b; i++) {
        if ((dv >> BigInt(i)) & 1n) pop++;
      }
      let clz = 0;
      for (let i = b - 1; i >= 0; i--) {
        if ((dv >> BigInt(i)) & 1n) break;
        clz++;
      }
      let ctz = 0;
      for (let i = 0; i < b; i++) {
        if ((dv >> BigInt(i)) & 1n) break;
        ctz++;
      }
      pv.pop = BigInt(pop);
      pv.clz = BigInt(clz);
      pv.ctz = BigInt(ctz);
      break;
    }

    case 'BIN2BCD_N': {
      const inW = Math.min(16, b);
      const v = Math.min(9999, Number(toUintN(pv.d, inW)));
      pv.d0 = BigInt(v % 10);
      pv.d1 = BigInt(Math.floor(v / 10) % 10);
      pv.d2 = BigInt(Math.floor(v / 100) % 10);
      pv.d3 = BigInt(Math.floor(v / 1000) % 10);
      break;
    }

    case 'RAM_16X4':
    case 'ROM_16X4': {
      if (!st.mem) st.mem = new Array(16).fill(0);
      const addr = (bit(pv.a3) << 3) | (bit(pv.a2) << 2) | (bit(pv.a1) << 1) | bit(pv.a0);
      const word = Number(st.mem[addr] || 0) & 15;
      pv.q0 = word & 1; pv.q1 = (word >> 1) & 1; pv.q2 = (word >> 2) & 1; pv.q3 = (word >> 3) & 1;
      break;
    }

    case 'RAM_N':
    case 'ROM_N': {
      const ab = Math.max(4, Math.min(16, comp.addrBits || 8));
      const size = 1 << ab;
      if (!Array.isArray(st.mem) || st.mem.length !== size) {
        const old = Array.isArray(st.mem) ? st.mem : [];
        st.mem = new Array(size).fill(0n);
        for (let i = 0; i < Math.min(old.length, size); i++) st.mem[i] = old[i];
      }
      const addr = Number(toUintN(pv.addr, ab)) & (size - 1);
      pv.q = toUintN(st.mem[addr] as PinSignal, b);
      break;
    }

    case 'DUAL_RAM_N': {
      const ab = Math.max(4, Math.min(16, comp.addrBits || 8));
      const size = 1 << ab;
      if (!Array.isArray(st.mem) || st.mem.length !== size) {
        const old = Array.isArray(st.mem) ? st.mem : [];
        st.mem = new Array(size).fill(0n);
        for (let i = 0; i < Math.min(old.length, size); i++) st.mem[i] = old[i];
      }
      const aa = Number(toUintN(pv.aa, ab)) & (size - 1);
      const abAddr = Number(toUintN(pv.ab, ab)) & (size - 1);
      pv.qa = toUintN(st.mem[aa] as PinSignal, b);
      pv.qb = toUintN(st.mem[abAddr] as PinSignal, b);
      break;
    }

    case 'FSM': {
      const f = st.fsm || { n: 1, next0: [0], next1: [0], out: [0] };
      const cur = (st.fsmState || 0) % Math.max(1, f.n);
      pv.q0 = cur & 1; pv.q1 = (cur >> 1) & 1; pv.q2 = (cur >> 2) & 1;
      pv.z = f.out[cur] ? 1 : 0;
      break;
    }

    case 'ALU_4': {
      const a = (bit(pv.a3) << 3) | (bit(pv.a2) << 2) | (bit(pv.a1) << 1) | bit(pv.a0);
      const bv = (bit(pv.b3) << 3) | (bit(pv.b2) << 2) | (bit(pv.b1) << 1) | bit(pv.b0);
      const op = (bit(pv.s2) << 2) | (bit(pv.s1) << 1) | bit(pv.s0);
      const cin = bit(pv.cin);
      let r = 0, c = 0;
      switch (op) {
        case 0: r = a + bv + cin; c = r > 15 ? 1 : 0; break;
        case 1: r = a - bv - cin; c = r < 0 ? 1 : 0; break;
        case 2: r = a & bv; break;
        case 3: r = a | bv; break;
        case 4: r = a ^ bv; break;
        case 5: r = ~a; break;
        case 6: r = a + 1; c = r > 15 ? 1 : 0; break;
        default: r = a << 1; c = (a >> 3) & 1; break;
      }
      r &= 15;
      st.aluOp = op; st.aluRes = BigInt(r); st.aluA = BigInt(a); st.aluB = BigInt(bv);
      pv.y0 = r & 1; pv.y1 = (r >> 1) & 1; pv.y2 = (r >> 2) & 1; pv.y3 = (r >> 3) & 1;
      pv.cout = c;
      pv.z = r === 0 ? 1 : 0;
      break;
    }

    case 'ALU_N': {
      const av = toUintN(pv.a, b);
      const bv = toUintN(pv.b, b);
      const op = Number(toUintN(pv.op, 4));
      const cin = BigInt(bit(pv.cin));
      const sa = toSignedN(av, b);
      const sb = toSignedN(bv, b);
      const signBit = 1n << BigInt(b - 1);
      let raw = 0n;
      let cout = 0;
      let ovf = 0;

      switch (op) {
        case 0: // ADD
          raw = av + bv + cin;
          cout = (raw >> BigInt(b)) !== 0n ? 1 : 0;
          {
            const sr = BigInt.asUintN(b, raw);
            if (((av ^ sr) & (bv ^ sr) & signBit) !== 0n) ovf = 1;
          }
          break;
        case 1: // SUB
          raw = av - bv - cin;
          cout = raw < 0n ? 1 : 0;
          {
            const sr = BigInt.asUintN(b, raw);
            if (((av ^ bv) & (av ^ sr) & signBit) !== 0n) ovf = 1;
          }
          break;
        case 2: raw = av & bv; break; // AND
        case 3: raw = av | bv; break; // OR
        case 4: raw = av ^ bv; break; // XOR
        case 5: raw = ~av; break; // NOT A
        case 6: raw = av + 1n; cout = (raw >> BigInt(b)) !== 0n ? 1 : 0; break; // INC
        case 7: raw = av - 1n; cout = raw < 0n ? 1 : 0; break; // DEC
        case 8: raw = av << (bv & 63n); break; // SHL
        case 9: raw = av >> (bv & 63n); break; // SHR
        case 10: raw = sa >> (bv & 63n); break; // ASR
        case 11: raw = sa * sb; break; // MUL
        case 12: raw = sa < sb ? 1n : 0n; break; // SLT
        case 13: raw = -sa; break; // NEG
        case 14: raw = av; break; // PASS A
        default: raw = bv; break; // PASS B
      }

      const res = BigInt.asUintN(b, raw);
      st.aluOp = op;
      st.aluRes = res;
      st.aluA = av;
      st.aluB = bv;
      pv.y = res;
      pv.z = res === 0n ? 1 : 0;
      pv.cout = cout;
      pv.neg = (res & signBit) !== 0n ? 1 : 0;
      pv.ovf = ovf;
      break;
    }

    case 'MAC_N':
      pv.acc = BigInt.asUintN(b, st.regBig ?? 0n);
      pv.ovf = st.ovf ? 1 : 0;
      break;

    case 'MUX_2':
      pv.y = bit(pv.s0) === 0 ? outVal(toUintN(pv.d0, b), b) : outVal(toUintN(pv.d1, b), b);
      break;

    case 'MUX_4': {
      const sel = (bit(pv.s1) << 1) | bit(pv.s0);
      pv.y = outVal(toUintN(pv[`d${sel}`], b), b);
      break;
    }

    case 'MUX_8': {
      const sel = nbits(pv, 's', 3);
      pv.y = outVal(toUintN(pv[`d${sel}`], b), b);
      break;
    }

    case 'MUX_16': {
      const sel = nbits(pv, 's', 4);
      pv.y = outVal(toUintN(pv[`d${sel}`], b), b);
      break;
    }

    case 'MUX_32': {
      const sel = nbits(pv, 's', 5);
      pv.y = outVal(toUintN(pv[`d${sel}`], b), b);
      break;
    }

    case 'DEMUX_2': {
      const din = outVal(toUintN(pv.din, b), b);
      const zero = b === 1 ? 0 : 0n;
      const s0 = bit(pv.s0);
      pv.y0 = s0 === 0 ? din : zero;
      pv.y1 = s0 === 1 ? din : zero;
      break;
    }

    case 'DEMUX_4': {
      const din = outVal(toUintN(pv.din, b), b);
      const zero = b === 1 ? 0 : 0n;
      const s = nbits(pv, 's', 2);
      for (let i = 0; i < 4; i++) pv[`y${i}`] = i === s ? din : zero;
      break;
    }

    case 'DEMUX_8': {
      const din = outVal(toUintN(pv.din, b), b);
      const zero = b === 1 ? 0 : 0n;
      const s = nbits(pv, 's', 3);
      for (let i = 0; i < 8; i++) pv[`y${i}`] = i === s ? din : zero;
      break;
    }

    case 'DEMUX_16': {
      const din = outVal(toUintN(pv.din, b), b);
      const zero = b === 1 ? 0 : 0n;
      const s = nbits(pv, 's', 4);
      for (let i = 0; i < 16; i++) pv[`y${i}`] = i === s ? din : zero;
      break;
    }

    case 'DEMUX_32': {
      const din = outVal(toUintN(pv.din, b), b);
      const zero = b === 1 ? 0 : 0n;
      const s = nbits(pv, 's', 5);
      for (let i = 0; i < 32; i++) pv[`y${i}`] = i === s ? din : zero;
      break;
    }

    case 'DEC_2TO4': {
      const s = nbits(pv, 'a', 2), en = bit(pv.en);
      for (let i = 0; i < 4; i++) pv[`y${i}`] = en && i === s ? 1 : 0;
      break;
    }

    case 'DEC_3TO8': {
      const s = nbits(pv, 'a', 3), en = bit(pv.en);
      for (let i = 0; i < 8; i++) pv[`y${i}`] = en && i === s ? 1 : 0;
      break;
    }

    case 'DEC_4TO16': {
      const s = nbits(pv, 'a', 4), en = bit(pv.en);
      for (let i = 0; i < 16; i++) pv[`y${i}`] = en && i === s ? 1 : 0;
      break;
    }

    case 'DEC_5TO32': {
      const s = nbits(pv, 'a', 5), en = bit(pv.en);
      for (let i = 0; i < 32; i++) pv[`y${i}`] = en && i === s ? 1 : 0;
      break;
    }

    case 'ENC_4TO2': {
      let n = 0, any = 0;
      for (let i = 3; i >= 0; i--) {
        if (bit(pv[`i${i}`])) { n = i; any = 1; break; }
      }
      pv.y0 = n & 1; pv.y1 = (n >> 1) & 1; pv.v = any;
      break;
    }

    case 'ENC_8TO3': {
      let n = 0, any = 0;
      for (let i = 7; i >= 0; i--) {
        if (bit(pv[`i${i}`])) { n = i; any = 1; break; }
      }
      pv.y0 = n & 1; pv.y1 = (n >> 1) & 1; pv.y2 = (n >> 2) & 1; pv.v = any;
      break;
    }

    case 'ENC_16TO4': {
      let n = 0, any = 0;
      for (let i = 15; i >= 0; i--) {
        if (bit(pv[`i${i}`])) { n = i; any = 1; break; }
      }
      pv.y0 = n & 1; pv.y1 = (n >> 1) & 1; pv.y2 = (n >> 2) & 1; pv.y3 = (n >> 3) & 1; pv.v = any;
      break;
    }

    case 'ENC_32TO5': {
      let n = 0, any = 0;
      for (let i = 31; i >= 0; i--) {
        if (bit(pv[`i${i}`])) { n = i; any = 1; break; }
      }
      for (let k = 0; k < 5; k++) pv[`y${k}`] = (n >> k) & 1;
      pv.v = any;
      break;
    }

    case 'PARITY_4': {
      const o = bit(pv.d0) ^ bit(pv.d1) ^ bit(pv.d2) ^ bit(pv.d3);
      pv.odd = o; pv.even = o ? 0 : 1;
      break;
    }

    case 'PARITY_N': {
      let v = toUintN(pv.d, b);
      let parity = 0;
      while (v !== 0n) {
        parity ^= 1;
        v &= v - 1n;
      }
      pv.odd = parity;
      pv.even = parity ? 0 : 1;
      break;
    }

    case 'BIN2GRAY_4': {
      const bv = nbits(pv, 'b', 4);
      putbits(pv, 'g', bv ^ (bv >> 1), 4);
      break;
    }

    case 'GRAY2BIN_4': {
      let bv = nbits(pv, 'g', 4);
      bv ^= bv >> 1; bv ^= bv >> 2;
      putbits(pv, 'b', bv, 4);
      break;
    }

    case 'BIN2GRAY_N': {
      const bv = toUintN(pv.b, b);
      pv.g = BigInt.asUintN(b, bv ^ (bv >> 1n));
      break;
    }

    case 'GRAY2BIN_N': {
      let gv = toUintN(pv.g, b);
      let bv = gv;
      while (gv > 0n) {
        gv >>= 1n;
        bv ^= gv;
      }
      pv.b = BigInt.asUintN(b, bv);
      break;
    }

    case 'LUT_TRIG': {
      const idx = Number(toUintN(pv.ang, 8)) & 255;
      pv.sin = BigInt.asUintN(16, BigInt(TRIG_SIN[idx]));
      pv.cos = BigInt.asUintN(16, BigInt(TRIG_COS[idx]));
      break;
    }

    case 'RAYCAST_CORE': {
      initRaycastState(st);
      pv.px = (st.rcPx as number | bigint | undefined) ?? 0n;
      pv.py = (st.rcPy as number | bigint | undefined) ?? 0n;
      pv.col = (st.rcCol as number | bigint | undefined) ?? 0n;
      pv.we = st.rcWe ? 1 : 0;
      pv.swap = st.rcSwap ? 1 : 0;
      pv.mapa = BigInt((st.rcScanAddr as number) & 255);
      pv.sfx = st.rcSfx ? 1 : 0;
      break;
    }

    case 'BCD_7SEG': {
      const val = (bit(pv.d3) << 3) | (bit(pv.d2) << 2) | (bit(pv.d1) << 1) | bit(pv.d0);
      const pattern = SEG7_BCD_TABLE[val] || [0, 0, 0, 0, 0, 0, 0];
      ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach((seg, i) => {
        pv[seg] = pattern[i];
      });
      break;
    }

    case 'COMP_2': {
      const a = (bit(pv.a1) << 1) | bit(pv.a0);
      const bv = (bit(pv.b1) << 1) | bit(pv.b0);
      pv.gt = a > bv ? 1 : 0;
      pv.eq = a === bv ? 1 : 0;
      pv.lt = a < bv ? 1 : 0;
      break;
    }

    case 'COMP_4': {
      const a = nbits(pv, 'a', 4), bv = nbits(pv, 'b', 4);
      pv.gt = a > bv ? 1 : 0;
      pv.eq = a === bv ? 1 : 0;
      pv.lt = a < bv ? 1 : 0;
      break;
    }

    case 'COMP_N': {
      const av = comp.signedMode ? toSignedN(toUintN(pv.a, b), b) : toUintN(pv.a, b);
      const bv = comp.signedMode ? toSignedN(toUintN(pv.b, b), b) : toUintN(pv.b, b);
      pv.gt = av > bv ? 1 : 0;
      pv.eq = av === bv ? 1 : 0;
      pv.lt = av < bv ? 1 : 0;
      break;
    }

    case 'CUSTOM_IC': {
      const def = customICs.find(d => d.id === comp.icDefId) || comp.icSnapshot;
      if (def && !st.subState) {
        st.subState = cloneCleanSubNetlist(def.netlist);
      }
      const sub = st.subState;
      if (def && sub) {
        def.inputs.forEach((inpDef, idx) => {
          const subComp = sub.components.find(c => c.id === inpDef.compId);
          if (subComp) {
            const w = inpDef.width || subComp.bits || 1;
            const v = w === 1 ? bit(pv[`in_${idx}`]) : toUintN(pv[`in_${idx}`], w);
            subComp.internalState.value = v;
            subComp.pinValues.out = v;
          }
        });
        solveNetwork(sub.components, sub.wires, false, customICs);
        def.outputs.forEach((outDef, idx) => {
          const subComp = sub.components.find(c => c.id === outDef.compId);
          if (subComp) {
            const val = subComp.pinValues[outDef.pinId || 'in0'] !== undefined
              ? subComp.pinValues[outDef.pinId || 'in0']
              : (subComp.pinValues.in0 ?? 0);
            pv[`out_${idx}`] = val;
          }
        });
      }
      break;
    }

    case 'ROTARY_ENC': {
      const pos = Math.trunc(Number(st.encPos || 0)) & 255;
      const phase = pos & 3;
      // Standard 2-bit quadrature Gray cycle: 00 -> 01 -> 11 -> 10
      const a = phase === 1 || phase === 2 ? 1 : 0;
      const bOut = phase === 2 || phase === 3 ? 1 : 0;
      pv.a = a;
      pv.b = bOut;
      pv.pos = BigInt(pos);
      break;
    }

    case 'SLIDER_ADC': {
      pv.out = outVal(toUintN((st.adcVal ?? st.value ?? 0) as PinSignal, b), b);
      break;
    }

    case 'CROSSBAR_2X2': {
      const av = toUintN(pv.a, b);
      const bv = toUintN(pv.b, b);
      const sw = bit(pv.swap) === 1;
      pv.y0 = outVal(sw ? bv : av, b);
      pv.y1 = outVal(sw ? av : bv, b);
      break;
    }

    case 'PRIORITY_ARB': {
      const r0 = bit(pv.r0);
      const r1 = bit(pv.r1);
      const r2 = bit(pv.r2);
      const r3 = bit(pv.r3);
      let g0 = 0, g1 = 0, g2 = 0, g3 = 0, idx = 0n, valid = 0;
      if (r0) { g0 = 1; idx = 0n; valid = 1; }
      else if (r1) { g1 = 1; idx = 1n; valid = 1; }
      else if (r2) { g2 = 1; idx = 2n; valid = 1; }
      else if (r3) { g3 = 1; idx = 3n; valid = 1; }
      pv.g0 = g0;
      pv.g1 = g1;
      pv.g2 = g2;
      pv.g3 = g3;
      pv.idx = idx;
      pv.valid = valid;
      break;
    }

    case 'BUS_PACK4': {
      const totalW = Math.min(64, b * 4);
      const shift = BigInt(b);
      let acc = toUintN(pv.i0, b);
      acc |= toUintN(pv.i1, b) << shift;
      acc |= toUintN(pv.i2, b) << (shift * 2n);
      acc |= toUintN(pv.i3, b) << (shift * 3n);
      pv.out = BigInt.asUintN(totalW, acc);
      break;
    }

    case 'BUS_UNPACK4': {
      const totalW = Math.min(64, b * 4);
      const v = toUintN(pv.in0, totalW);
      const shift = BigInt(b);
      pv.o0 = outVal(v, b);
      pv.o1 = outVal(v >> shift, b);
      pv.o2 = outVal(v >> (shift * 2n), b);
      pv.o3 = outVal(v >> (shift * 3n), b);
      break;
    }

    case 'SAT_ADDER_N': {
      if (comp.signedMode) {
        const av = toSignedN(toUintN(pv.a, b), b);
        const bv = toSignedN(toUintN(pv.b, b), b);
        const minS = -(1n << BigInt(b - 1));
        const maxS = (1n << BigInt(b - 1)) - 1n;
        let sum = av + bv;
        let sat = 0;
        if (sum > maxS) { sum = maxS; sat = 1; }
        else if (sum < minS) { sum = minS; sat = 1; }
        pv.s = outVal(sum, b);
        pv.sat = sat;
      } else {
        const av = toUintN(pv.a, b);
        const bv = toUintN(pv.b, b);
        const maxU = maskBits(b);
        let sum = av + bv;
        let sat = 0;
        if (sum > maxU) { sum = maxU; sat = 1; }
        pv.s = outVal(sum, b);
        pv.sat = sat;
      }
      break;
    }

    case 'SQRT_N': {
      const x = toUintN(pv.in0, b);
      let lo = 0n;
      let hi = x < (1n << 32n) ? x : (1n << 32n) - 1n;
      let ans = 0n;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1n;
        const sq = mid * mid;
        if (sq === x) { ans = mid; break; }
        if (sq < x) { ans = mid; lo = mid + 1n; }
        else { hi = mid - 1n; }
      }
      pv.root = outVal(ans, b);
      pv.rem = outVal(x - ans * ans, b);
      break;
    }

    case 'COMP_WIN_N': {
      const xv = comp.signedMode ? toSignedN(toUintN(pv.x, b), b) : toUintN(pv.x, b);
      const loV = comp.signedMode ? toSignedN(toUintN(pv.lo, b), b) : toUintN(pv.lo, b);
      const hiV = comp.signedMode ? toSignedN(toUintN(pv.hi, b), b) : toUintN(pv.hi, b);
      const low = loV <= hiV ? loV : hiV;
      const high = loV <= hiV ? hiV : loV;
      pv.below = xv < low ? 1 : 0;
      pv.above = xv > high ? 1 : 0;
      pv.inw = xv >= low && xv <= high ? 1 : 0;
      break;
    }

    case 'MOD_COUNTER_N': {
      const val = toUintN(st.countBig ?? 0n, b);
      pv.q = outVal(val, b);
      const modPin = toUintN(pv.mod, b);
      const modVal = modPin > 0n ? modPin : BigInt(Math.max(2, comp.modBase || 10));
      pv.wrap = val + 1n >= modVal ? 1 : 0;
      break;
    }

    case 'WATCHDOG_N': {
      const cnt = toUintN(BigInt(st.wdTimer || 0), b);
      const limPin = toUintN(pv.lim, b);
      const lim = limPin > 0n ? limPin : BigInt(Math.max(1, comp.modBase || 16));
      pv.cnt = outVal(cnt, b);
      pv.bark = cnt >= lim ? 1 : 0;
      break;
    }

    case 'DEBOUNCER': {
      pv.out = st.debStable ? 1 : 0;
      break;
    }

    case 'STOPWATCH_N': {
      pv.q = outVal(toUintN(st.countBig ?? 0n, b), b);
      pv.run = st.q ? 1 : 0;
      break;
    }

    case 'CRC16_GEN': {
      const crc = (st.crcVal ?? 0xffff) & 0xffff;
      pv.crc = BigInt(crc);
      pv.ok = crc === 0 ? 1 : 0;
      break;
    }

    case 'VU_METER_N':
      break;

    case 'TEXT_CONSOLE': {
      const lines = st.textLines || [''];
      pv.len = BigInt(Math.min(255, lines.reduce((acc, s) => acc + s.length, 0)));
      break;
    }

    case 'ANIM32_GPU': {
      pv.px = BigInt((st.animOutPx as number) || 0);
      pv.py = BigInt((st.animOutPy as number) || 0);
      pv.col = BigInt((st.animCol as number) || 0);
      pv.we = st.animWe ? 1 : 0;
      pv.swap = st.animSwap ? 1 : 0;
      pv.scn = BigInt(((st.animScene as number) || 0) & 31);
      pv.lchar = BigInt((st.animLchar as number) || 32);
      pv.lx = BigInt((st.animLx as number) || 0);
      pv.ly = st.animLy ? 1 : 0;
      pv.lwe = st.animLwe ? 1 : 0;
      pv.sfreq = BigInt((st.animSfxFreq as number) || 440);
      pv.sgate = st.animSfxGate ? 1 : 0;
      break;
    }
  }
}

function copyPinValuesInPlace(src: Record<string, PinSignal>, dst: Record<string, PinSignal>): number {
  for (const k in dst) {
    if (!(k in src)) delete dst[k];
  }
  let count = 0;
  for (const k in src) {
    dst[k] = src[k];
    count++;
  }
  return count;
}

function pinValuesChangedFast(prev: Record<string, PinSignal>, prevCount: number, curr: Record<string, PinSignal>): boolean {
  let currCount = 0;
  for (const k in curr) {
    currCount++;
    if (prev[k] !== curr[k]) return true;
  }
  return currCount !== prevCount;
}

interface SolveScratch {
  compMap: Map<string, LogicComponent>;
  incomingMap: Map<string, Wire[]>;
  tunnelOuts: LogicComponent[];
  tunnelBus: Map<string, PinSignal>;
  prevBuf: Array<Record<string, PinSignal>>;
  prevCounts: number[];
  oscSnap: Array<Record<string, PinSignal>>;
  oscCounts: number[];
  activeVals: PinSignal[];
}

const solveScratchPool: SolveScratch[] = [];
let solveDepth = 0;
let lastSolveChanged = false;

function getSolveScratch(depth: number): SolveScratch {
  while (solveScratchPool.length <= depth) {
    solveScratchPool.push({
      compMap: new Map(),
      incomingMap: new Map(),
      tunnelOuts: [],
      tunnelBus: new Map(),
      prevBuf: [],
      prevCounts: [],
      oscSnap: [],
      oscCounts: [],
      activeVals: []
    });
  }
  return solveScratchPool[depth];
}

export function solveNetwork(
  compList: LogicComponent[],
  wireList: Wire[],
  allowOscillationStep = true,
  customICs: CustomICDef[] = []
): boolean {
  const sc = getSolveScratch(solveDepth);
  solveDepth++;
  let anyNetworkChange = false;
  try {
    const { compMap, incomingMap, tunnelOuts, tunnelBus, prevBuf, prevCounts, oscSnap, oscCounts, activeVals } = sc;
    compMap.clear();
    incomingMap.clear();
    tunnelOuts.length = 0;
    tunnelBus.clear();

    const compCount = compList.length;
    while (prevBuf.length < compCount) {
      prevBuf.push({});
      prevCounts.push(0);
      oscSnap.push({});
      oscCounts.push(0);
    }

    for (let i = 0; i < compCount; i++) {
      const c = compList[i];
      compMap.set(c.id, c);
      c.unstable = false;
      if (c.type === 'TUNNEL' && c.tunnelDir !== 'in') {
        tunnelOuts.push(c);
      }
    }

    for (let i = 0; i < wireList.length; i++) {
      const w = wireList[i];
      w.unstable = false;
      const key = `${w.toCompId}:${w.toPinId}`;
      let list = incomingMap.get(key);
      if (!list) {
        list = [];
        incomingMap.set(key, list);
      }
      list.push(w);
    }

    const maxPasses = 24;
    let settled = false;
    let hasOscSnap = false;

    for (let pass = 0; pass < maxPasses; pass++) {
      let changed = false;

      if (tunnelOuts.length > 0) {
        tunnelBus.clear();
        for (let i = 0; i < tunnelOuts.length; i++) {
          const tout = tunnelOuts[i];
          const tag = (tout.tunnelTag || 'SIG').trim();
          const sig = tout.pinValues.in0 ?? 0;
          if (!tunnelBus.has(tag)) {
            tunnelBus.set(tag, sig);
          } else {
            const prev = tunnelBus.get(tag);
            if (prev === 'Z') tunnelBus.set(tag, sig);
            else if (sig !== 'Z' && prev !== sig) tunnelBus.set(tag, 'ERR');
          }
        }
      }

      // 1. Evaluar salidas combinacionales de todos los componentes (sin spreads por pasada)
      for (let i = 0; i < compCount; i++) {
        const c = compList[i];
        const buf = prevBuf[i];
        const prevCnt = copyPinValuesInPlace(c.pinValues, buf);
        evaluateCombinationalOutputs(c, customICs, tunnelBus);
        if (pinValuesChangedFast(buf, prevCnt, c.pinValues)) {
          changed = true;
        }
      }

      // 2. Propagar valores por cables hacia pines de entrada
      for (let i = 0; i < compCount; i++) {
        const c = compList[i];
        const pins = c.pins;
        for (let pi = 0; pi < pins.length; pi++) {
          const p = pins[pi];
          if (p.dir !== 'in') continue;
          const pWidth = p.width || 1;
          const drivers = incomingMap.get(`${c.id}:${p.id}`);
          let resolved: PinSignal = pWidth > 1 ? 0n : 0;

          if (drivers && drivers.length === 1) {
            const d = drivers[0];
            const src = compMap.get(d.fromCompId);
            const sig: PinSignal = src && src.pinValues[d.fromPinId] !== undefined ? src.pinValues[d.fromPinId] : 0;
            d.signal = sig;
            if (src) {
              let sw = pWidth;
              for (let si = 0; si < src.pins.length; si++) {
                if (src.pins[si].id === d.fromPinId) {
                  sw = src.pins[si].width || pWidth;
                  break;
                }
              }
              d.width = sw;
            } else {
              d.width = pWidth;
            }
            if (sig === 'Z') resolved = pWidth > 1 ? 0n : 0;
            else if (sig === 'ERR') resolved = 'ERR';
            else resolved = pWidth === 1 ? bit(sig) : toUintN(sig, pWidth);
          } else if (drivers && drivers.length > 1) {
            activeVals.length = 0;
            for (let di = 0; di < drivers.length; di++) {
              const d = drivers[di];
              const src = compMap.get(d.fromCompId);
              const sig: PinSignal = src && src.pinValues[d.fromPinId] !== undefined ? src.pinValues[d.fromPinId] : 0;
              d.signal = sig;
              if (src) {
                let sw = pWidth;
                for (let si = 0; si < src.pins.length; si++) {
                  if (src.pins[si].id === d.fromPinId) {
                    sw = src.pins[si].width || pWidth;
                    break;
                  }
                }
                d.width = sw;
              } else {
                d.width = pWidth;
              }
              if (sig !== 'Z') {
                activeVals.push(pWidth === 1 && sig !== 'ERR' ? bit(sig) : sig === 'ERR' ? 'ERR' : toUintN(sig, pWidth));
              }
            }
            if (activeVals.length === 0) {
              resolved = pWidth > 1 ? 0n : 0;
            } else {
              let hasErr = false;
              let mismatch = false;
              const first = activeVals[0];
              for (let ai = 0; ai < activeVals.length; ai++) {
                const av = activeVals[ai];
                if (av === 'ERR') hasErr = true;
                else if (av !== first) mismatch = true;
              }
              resolved = hasErr || mismatch ? 'ERR' : first;
            }
          }

          if (c.pinValues[p.id] !== resolved) {
            c.pinValues[p.id] = resolved;
            changed = true;
          }
        }
      }

      if (changed) anyNetworkChange = true;
      if (!changed) {
        settled = true;
        break;
      }

      if (pass === maxPasses - 2) {
        hasOscSnap = true;
        for (let i = 0; i < compCount; i++) {
          oscCounts[i] = copyPinValuesInPlace(compList[i].pinValues, oscSnap[i]);
        }
      }
    }

    if (!settled && hasOscSnap) {
      for (let i = 0; i < compCount; i++) {
        const c = compList[i];
        if (pinValuesChangedFast(oscSnap[i], oscCounts[i], c.pinValues)) {
          c.unstable = true;
        }
      }
      for (let i = 0; i < wireList.length; i++) {
        const w = wireList[i];
        const src = compMap.get(w.fromCompId);
        if (src && src.unstable) w.unstable = true;
      }
      if (allowOscillationStep && compCount > 0) {
        evaluateCombinationalOutputs(compList[0], customICs, tunnelBus);
      }
    }

    lastSolveChanged = anyNetworkChange;
    return settled;
  } finally {
    sc.compMap.clear();
    sc.incomingMap.clear();
    sc.tunnelOuts.length = 0;
    sc.tunnelBus.clear();
    solveDepth--;
  }
}

export function advanceClocks(compList: LogicComponent[], dt: number, globalClockHz: number): boolean {
  let anyToggled = false;
  for (const comp of compList) {
    const st = comp.internalState;
    if (comp.type === 'CLOCK' && dt > 0) {
      const hz = comp.freqHz !== null ? comp.freqHz : globalClockHz;
      const halfPeriod = 0.5 / Math.max(0.1, hz);
      st.clockTimer += dt;
      if (st.clockTimer >= halfPeriod) {
        st.clockTimer %= halfPeriod;
        st.clockOut = st.clockOut === 1 ? 0 : 1;
        anyToggled = true;
      }
    } else if (comp.type === 'CUSTOM_IC' && st.subState) {
      if (advanceClocks(st.subState.components, dt, globalClockHz)) {
        anyToggled = true;
      }
    }
  }
  return anyToggled;
}

export function evaluateSequentialEdges(compList: LogicComponent[]): boolean {
  let anyChanged = false;
  for (const comp of compList) {
    const st = comp.internalState;
    const pv = comp.pinValues;
    const b = Math.max(1, Math.min(64, comp.bits || 1));
    const clkVal = bit(pv.clk);
    const risingEdge = st.prevClk === 0 && clkVal === 1;

    switch (comp.type) {
      case 'D_FF': {
        if (risingEdge) {
          const nextQ = bit(pv.d);
          if (st.q !== nextQ) anyChanged = true;
          st.q = nextQ;
          st.qn = st.q ? 0 : 1;
        }
        st.prevClk = clkVal;
        break;
      }
      case 'T_FF': {
        if (risingEdge && bit(pv.t) === 1) {
          st.q = st.q ? 0 : 1;
          st.qn = st.q ? 0 : 1;
          anyChanged = true;
        }
        st.prevClk = clkVal;
        break;
      }
      case 'JK_FF': {
        if (risingEdge) {
          const j = bit(pv.j), k = bit(pv.k);
          const prevQ = st.q;
          if (j === 1 && k === 0) { st.q = 1; st.qn = 0; }
          else if (j === 0 && k === 1) { st.q = 0; st.qn = 1; }
          else if (j === 1 && k === 1) { st.q = st.q ? 0 : 1; st.qn = st.q ? 0 : 1; }
          if (st.q !== prevQ) anyChanged = true;
        }
        st.prevClk = clkVal;
        break;
      }
      case 'RS_FF': {
        if (risingEdge) {
          const s = bit(pv.s), r = bit(pv.r);
          const prevQ = st.q;
          if (s === 1 && r === 0) { st.q = 1; st.qn = 0; }
          else if (s === 0 && r === 1) { st.q = 0; st.qn = 1; }
          if (st.q !== prevQ) anyChanged = true;
        }
        st.prevClk = clkVal;
        break;
      }
      case 'PULSE_ONE': {
        const trig = bit(pv.trig);
        const prevTrig = (st.prevSig as number) || 0;
        if (risingEdge) {
          const prevQ = st.q;
          if (trig === 1 && prevTrig === 0) {
            st.q = 1;
            st.prevSig = 1;
          } else {
            st.q = 0;
            if (trig === 0) st.prevSig = 0;
          }
          if (st.q !== prevQ) anyChanged = true;
        }
        st.prevClk = clkVal;
        break;
      }
      case 'EDGE_DET': {
        const sig = bit(pv.in0);
        const prevSig = (st.prevSig as number) || 0;
        if (risingEdge) {
          const nr = prevSig === 0 && sig === 1 ? 1 : 0;
          const nf = prevSig === 1 && sig === 0 ? 1 : 0;
          if (st.rise !== nr || st.fall !== nf) anyChanged = true;
          st.rise = nr;
          st.fall = nf;
          st.prevSig = sig;
        }
        st.prevClk = clkVal;
        break;
      }
      case 'REG_4': {
        const prevReg = st.reg.join('');
        if (bit(pv.rst) === 1) st.reg = [0, 0, 0, 0];
        else if (risingEdge) st.reg = [bit(pv.d0), bit(pv.d1), bit(pv.d2), bit(pv.d3)];
        if (st.reg.join('') !== prevReg) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'REG_N': {
        const old = st.regBig ?? 0n;
        if (bit(pv.rst) === 1) {
          st.regBig = 0n;
        } else if (risingEdge && (pv.en === undefined || bit(pv.en) === 1 || comp.pins.every(p => p.id !== 'en'))) {
          if (bit(pv.en) === 1) {
            st.regBig = toUintN(pv.d, b);
          }
        }
        if (st.regBig !== old) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'REG_FILE_N': {
        if (!Array.isArray(st.regFile) || st.regFile.length !== 8) st.regFile = new Array(8).fill(0n);
        if (bit(pv.rst) === 1) {
          if (st.regFile.some(v => BigInt(v || 0) !== 0n)) anyChanged = true;
          st.regFile = new Array(8).fill(0n);
        } else if (risingEdge && bit(pv.we) === 1) {
          const wa = Number(toUintN(pv.wa, 3)) & 7;
          const wd = toUintN(pv.wd, b);
          if (st.regFile[wa] !== wd) anyChanged = true;
          st.regFile[wa] = wd;
          st.lastWrite = wa;
        }
        st.prevClk = clkVal;
        break;
      }
      case 'COUNTER_4': {
        const prevCnt = st.count;
        if (bit(pv.rst) === 1) st.count = 0;
        else if (risingEdge && bit(pv.en) === 1) st.count = (st.count + 1) & 0x0f;
        if (st.count !== prevCnt) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'COUNTER_N': {
        const old = st.countBig ?? 0n;
        if (bit(pv.rst) === 1) {
          st.countBig = 0n;
        } else if (risingEdge) {
          if (bit(pv.load) === 1) {
            st.countBig = toUintN(pv.d, b);
          } else if (bit(pv.en) === 1) {
            const delta = bit(pv.up) === 1 ? 1n : -1n;
            st.countBig = BigInt.asUintN(b, old + delta);
          }
        }
        if (st.countBig !== old) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'UDCOUNTER_4': {
        const o = st.count || 0;
        if (bit(pv.rst)) st.count = 0;
        else if (risingEdge && bit(pv.en)) st.count = bit(pv.up) ? (o + 1) & 15 : (o + 15) & 15;
        if (st.count !== o) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'COUNTER_BCD': {
        const o = st.count || 0;
        if (bit(pv.rst)) st.count = 0;
        else if (risingEdge && bit(pv.en)) st.count = (o + 1) % 10;
        if (st.count !== o) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'SHIFT_REG_4': {
        const r = st.reg || (st.reg = [0, 0, 0, 0]);
        const old = r.join('');
        if (bit(pv.rst)) { r[0] = r[1] = r[2] = r[3] = 0; }
        else if (risingEdge) { r[3] = r[2]; r[2] = r[1]; r[1] = r[0]; r[0] = bit(pv.d); }
        if (r.join('') !== old) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'SHIFT_REG_N': {
        const old = st.regBig ?? 0n;
        if (bit(pv.rst)) st.regBig = 0n;
        else if (risingEdge) {
          if (bit(pv.load)) st.regBig = toUintN(pv.d, b);
          else st.regBig = BigInt.asUintN(b, (old << 1n) | BigInt(bit(pv.sin)));
        }
        if (st.regBig !== old) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'FREQ_DIV': {
        const o = st.count || 0;
        if (bit(pv.rst)) st.count = 0;
        else if (risingEdge) st.count = (o + 1) & 15;
        if (st.count !== o) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'TIMER_N': {
        const old = st.countBig ?? 0n;
        const per = toUintN(pv.period, b);
        if (bit(pv.rst)) st.countBig = 0n;
        else if (risingEdge && bit(pv.en)) {
          st.countBig = per > 0n ? (old + 1n) % per : BigInt.asUintN(b, old + 1n);
        }
        if (st.countBig !== old) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'LFSR_4': {
        const o = st.count || 1;
        if (bit(pv.rst)) st.count = 1;
        else if (risingEdge && bit(pv.en)) {
          const fb = ((o >> 3) ^ (o >> 2)) & 1;
          st.count = ((o << 1) | fb) & 15;
          if (!st.count) st.count = 1;
        }
        if ((st.count || 1) !== o) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'LFSR_N': {
        const o = st.countBig || 1n;
        if (bit(pv.rst)) st.countBig = 1n;
        else if (risingEdge && bit(pv.en)) {
          const msb = BigInt(b - 1);
          const fb = ((o >> msb) ^ (o >> (msb > 2n ? msb - 2n : 0n)) ^ (o & 1n)) & 1n;
          let next = BigInt.asUintN(b, (o << 1n) | fb);
          if (next === 0n) next = 1n;
          st.countBig = next;
        }
        if ((st.countBig || 1n) !== o) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'STACK_LIFO': {
        if (!Array.isArray(st.stack)) st.stack = [];
        if (bit(pv.rst)) {
          if (st.stack.length > 0) anyChanged = true;
          st.stack = [];
        } else if (risingEdge) {
          if (bit(pv.push) && st.stack.length < 32) {
            st.stack.push(toUintN(pv.d, b));
            anyChanged = true;
          } else if (bit(pv.pop) && st.stack.length > 0) {
            st.stack.pop();
            anyChanged = true;
          }
        }
        st.prevClk = clkVal;
        break;
      }
      case 'FIFO_N': {
        if (!Array.isArray(st.fifo)) st.fifo = [];
        if (bit(pv.rst)) {
          if (st.fifo.length > 0) anyChanged = true;
          st.fifo = [];
        } else if (risingEdge) {
          const doPop = bit(pv.pop) === 1 && st.fifo.length > 0;
          const doPush = bit(pv.push) === 1 && (st.fifo.length < 32 || doPop);
          if (doPop) {
            st.fifo.shift();
            anyChanged = true;
          }
          if (doPush) {
            st.fifo.push(toUintN(pv.d, b));
            anyChanged = true;
          }
        }
        st.prevClk = clkVal;
        break;
      }
      case 'RAM_16X4': {
        if (!Array.isArray(st.mem)) st.mem = new Array(16).fill(0);
        if (risingEdge && bit(pv.we) === 1) {
          const addr = (bit(pv.a3) << 3) | (bit(pv.a2) << 2) | (bit(pv.a1) << 1) | bit(pv.a0);
          const data = (bit(pv.d3) << 3) | (bit(pv.d2) << 2) | (bit(pv.d1) << 1) | bit(pv.d0);
          if (st.mem[addr] !== data) anyChanged = true;
          st.mem[addr] = data;
          st.lastWrite = addr;
        }
        st.prevClk = clkVal;
        break;
      }
      case 'RAM_N': {
        const ab = Math.max(4, Math.min(16, comp.addrBits || 8));
        const size = 1 << ab;
        if (!Array.isArray(st.mem) || st.mem.length !== size) st.mem = new Array(size).fill(0n);
        if (risingEdge && bit(pv.we) === 1) {
          const addr = Number(toUintN(pv.addr, ab)) & (size - 1);
          const data = toUintN(pv.d, b);
          if (st.mem[addr] !== data) anyChanged = true;
          st.mem[addr] = data;
          st.lastWrite = addr;
        }
        st.prevClk = clkVal;
        break;
      }
      case 'DUAL_RAM_N': {
        const ab = Math.max(4, Math.min(16, comp.addrBits || 8));
        const size = 1 << ab;
        if (!Array.isArray(st.mem) || st.mem.length !== size) st.mem = new Array(size).fill(0n);
        if (risingEdge && bit(pv.we) === 1) {
          const aa = Number(toUintN(pv.aa, ab)) & (size - 1);
          const da = toUintN(pv.da, b);
          if (st.mem[aa] !== da) anyChanged = true;
          st.mem[aa] = da;
          st.lastWrite = aa;
        }
        st.prevClk = clkVal;
        break;
      }
      case 'LCD_TEXT': {
        if (!Array.isArray(st.lcdChars) || st.lcdChars.length !== 32) st.lcdChars = new Array(32).fill(32);
        if (bit(pv.clr) === 1) {
          if (st.lcdChars.some(c => c !== 32)) anyChanged = true;
          st.lcdChars.fill(32);
        } else if (risingEdge && bit(pv.we) === 1) {
          const ch = Number(toUintN(pv.char, 8)) & 0xff;
          const x = Number(toUintN(pv.x, 4)) & 15;
          const y = bit(pv.y);
          const idx = y * 16 + x;
          if (st.lcdChars[idx] !== ch) anyChanged = true;
          st.lcdChars[idx] = ch;
        }
        st.prevClk = clkVal;
        break;
      }
      case 'VGA_SCREEN': {
        const vw = st.vgaW || 64;
        const vh = st.vgaH || 48;
        st.vgaBuf = ensureUint8Array(st.vgaBuf, vw * vh);
        st.vgaFront = ensureUint8Array(st.vgaFront, vw * vh);
        const clr = bit(pv.clr);
        if (clr && !st.prevClr) {
          st.vgaBuf.fill(0);
        }
        st.prevClr = clr;
        if (risingEdge && bit(pv.we)) {
          const px = Number(toUintN(pv.x, 6));
          const py = Number(toUintN(pv.y, 6));
          const col = Number(toUintN(pv.col, 8)) & 0xff;
          if (px >= 0 && px < vw && py >= 0 && py < vh) {
            st.vgaBuf[py * vw + px] = col;
          }
        }
        const swap = bit(pv.swap);
        if (swap && !st.prevSwap) {
          st.vgaFront.set(st.vgaBuf);
          st.vgaVersion = ((st.vgaVersion as number) || 0) + 1;
          anyChanged = true;
        }
        st.prevSwap = swap;
        st.prevClk = clkVal;
        break;
      }
      case 'KEYBOARD_ASCII': {
        if (risingEdge && st.keyReady) {
          st.keyReady = 0;
          anyChanged = true;
        }
        st.prevClk = clkVal;
        break;
      }
      case 'RAYCAST_CORE': {
        initRaycastState(st);
        if (bit(pv.rst)) {
          st.rcX = 2.5;
          st.rcY = 2.5;
          st.rcAng = 0.45;
          st.rcEnemyX = 8.5;
          st.rcEnemyY = 7.5;
          st.rcEnemyHp = 3;
          st.rcKills = 0;
          st.rcColIdx = 0;
          st.rcRowIdx = 0;
          st.rcWe = 0;
          st.rcSwap = 0;
          st.rcSfx = 0;
          anyChanged = true;
        } else if (risingEdge) {
          // Sample external ROM map continuously (256-byte live sync)
          const scanAddr = (st.rcScanAddr as number) & 255;
          const romByte = Number(toUintN(pv.mapd, 8)) & 255;
          const tmpMap = st.rcTempMap as Uint8Array;
          tmpMap[scanAddr] = romByte;
          if (romByte > 0) st.rcTempNonZero = true;
          if (scanAddr === 255) {
            if (st.rcTempNonZero) {
              (st.rcMap as Uint8Array).set(tmpMap);
            }
            st.rcTempNonZero = false;
          }
          st.rcScanAddr = (scanAddr + 1) & 255;

          const colIdx = (st.rcColIdx as number) || 0;
          const rowIdx = (st.rcRowIdx as number) || 0;

          if (colIdx === 0 && rowIdx === 0) {
            // Update physics at the start of each 64x48 frame for zero input lag
            const pad = Number(toUintN(pv.pad, 5));
            const moveW = (pad & 1) !== 0;
            const moveS = (pad & 2) !== 0;
            const turnA = (pad & 4) !== 0;
            const turnD = (pad & 8) !== 0;
            const fire = (pad & 16) !== 0;

            let ang = (st.rcAng as number) ?? 0.45;
            if (turnA) ang -= 0.085;
            if (turnD) ang += 0.085;
            st.rcAng = ang;

            const spd = 0.14;
            let nx = (st.rcX as number) ?? 2.5;
            let ny = (st.rcY as number) ?? 2.5;
            const map = st.rcMap as Uint8Array;
            const canWalk = (tx: number, ty: number) => {
              const mx = Math.floor(tx), my = Math.floor(ty);
              if (mx < 0 || mx >= 16 || my < 0 || my >= 16) return false;
              return map[(my << 4) | mx] === 0;
            };
            if (moveW) {
              const dx = Math.cos(ang) * spd;
              const dy = Math.sin(ang) * spd;
              if (canWalk(nx + dx * 1.8, ny)) nx += dx;
              if (canWalk(nx, ny + dy * 1.8)) ny += dy;
            }
            if (moveS) {
              const dx = Math.cos(ang) * spd;
              const dy = Math.sin(ang) * spd;
              if (canWalk(nx - dx * 1.8, ny)) nx -= dx;
              if (canWalk(nx, ny - dy * 1.8)) ny -= dy;
            }
            st.rcX = nx;
            st.rcY = ny;

            // Fire / Enemy AI
            let ft = (st.rcFireTimer as number) || 0;
            if (ft > 0) ft--;
            if (fire && !st.rcPrevFire) {
              ft = 3;
              const ex = (st.rcEnemyX as number) ?? 8.5;
              const ey = (st.rcEnemyY as number) ?? 7.5;
              const hp = (st.rcEnemyHp as number) ?? 0;
              if (hp > 0) {
                let rel = Math.atan2(ey - ny, ex - nx) - ang;
                while (rel > Math.PI) rel -= Math.PI * 2;
                while (rel < -Math.PI) rel += Math.PI * 2;
                if (Math.abs(rel) < 0.24) {
                  const newHp = hp - 1;
                  st.rcEnemyHp = newHp;
                  if (newHp <= 0) {
                    st.rcKills = ((st.rcKills as number) || 0) + 1;
                    st.rcEnemyRespawn = 20;
                  }
                }
              }
            }
            st.rcPrevFire = fire ? 1 : 0;
            st.rcFireTimer = ft;
            st.rcSfx = ft > 0 ? 1 : 0;

            if (((st.rcEnemyHp as number) || 0) <= 0) {
              const resp = ((st.rcEnemyRespawn as number) || 0) - 1;
              st.rcEnemyRespawn = resp;
              if (resp <= 0) {
                const spots: [number, number][] = [[10.5, 6.5], [4.5, 11.5], [12.5, 12.5], [8.5, 7.5]];
                const pick = spots[((st.rcKills as number) || 0) % spots.length];
                st.rcEnemyX = pick[0];
                st.rcEnemyY = pick[1];
                st.rcEnemyHp = 3;
              }
            } else {
              const ex = (st.rcEnemyX as number) ?? 8.5;
              const ey = (st.rcEnemyY as number) ?? 7.5;
              const distToP = Math.hypot(nx - ex, ny - ey);
              if (distToP > 1.8 && distToP < 8.5) {
                const enx = ex + ((nx - ex) / distToP) * 0.03;
                const eny = ey + ((ny - ey) / distToP) * 0.03;
                if (canWalk(enx, ey)) st.rcEnemyX = enx;
                if (canWalk(ex, eny)) st.rcEnemyY = eny;
              }
            }
          }

          if (rowIdx === 0) {
            castRayColumn(st, colIdx);
          }
          const pixelCol = shadeRaycastPixel(st, colIdx, rowIdx);
          st.rcPx = BigInt(colIdx);
          st.rcPy = BigInt(rowIdx);
          st.rcCol = BigInt(pixelCol);
          st.rcWe = 1;

          const isLastPixel = colIdx === 63 && rowIdx === 47;
          st.rcSwap = isLastPixel ? 1 : 0;

          if (isLastPixel) {
            st.rcColIdx = 0;
            st.rcRowIdx = 0;
          } else {
            if (rowIdx < 47) {
              st.rcRowIdx = rowIdx + 1;
            } else {
              st.rcRowIdx = 0;
              st.rcColIdx = colIdx + 1;
            }
          }
          anyChanged = true;
        }
        st.prevClk = clkVal;
        break;
      }
      case 'FSM': {
        const f = st.fsm;
        if (f) {
          const prevS = st.fsmState || 0;
          if (bit(pv.rst) === 1) st.fsmState = 0;
          else if (risingEdge) st.fsmState = ((bit(pv.x) ? f.next1 : f.next0)[prevS] || 0) % f.n;
          if (st.fsmState !== prevS) anyChanged = true;
        }
        st.prevClk = clkVal;
        break;
      }
      case 'PULSE_GEN': {
        if (risingEdge) {
          st.seqIdx = (st.seqIdx + 1) % st.seqBits.length;
          anyChanged = true;
        }
        st.prevClk = clkVal;
        break;
      }
      case 'MAC_N': {
        const old = st.regBig ?? 0n;
        const oldOvf = st.ovf ? 1 : 0;
        if (bit(pv.clr) === 1) {
          st.regBig = 0n;
          st.ovf = 0;
        } else if (risingEdge && bit(pv.en) === 1) {
          const av = comp.signedMode ? toSignedN(toUintN(pv.a, b), b) : toUintN(pv.a, b);
          const bv = comp.signedMode ? toSignedN(toUintN(pv.b, b), b) : toUintN(pv.b, b);
          const accCur = comp.signedMode ? toSignedN(toUintN(old, b), b) : toUintN(old, b);
          const sum = accCur + av * bv;
          st.regBig = BigInt.asUintN(b, sum);
          if (comp.signedMode) {
            const minS = -(1n << BigInt(b - 1));
            const maxS = (1n << BigInt(b - 1)) - 1n;
            st.ovf = sum < minS || sum > maxS ? 1 : 0;
          } else {
            st.ovf = (sum >> BigInt(b)) !== 0n ? 1 : 0;
          }
        }
        if (st.regBig !== old || (st.ovf ? 1 : 0) !== oldOvf) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'PWM_GEN': {
        const old = st.count || 0;
        if (bit(pv.rst) === 1) st.count = 0;
        else if (risingEdge && bit(pv.en) === 1) st.count = (old + 1) & 255;
        if ((st.count || 0) !== old) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'RING_CNT': {
        const old = st.count ?? 1;
        const jhn = bit(pv.jhn) === 1;
        if (bit(pv.rst) === 1) {
          st.count = jhn ? 0 : 1;
        } else if (risingEdge && bit(pv.en) === 1) {
          if (jhn) {
            const cur = old & 255;
            const fb = ((cur >> 7) & 1) ^ 1;
            st.count = ((cur << 1) | fb) & 255;
          } else {
            const cur = (old || 1) & 255;
            const nxt = ((cur << 1) | ((cur >> 7) & 1)) & 255;
            st.count = nxt === 0 ? 1 : nxt;
          }
        }
        if (st.count !== old) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'CRC8_GEN': {
        const old = st.count || 0;
        if (bit(pv.rst) === 1) {
          st.count = 0;
        } else if (risingEdge && bit(pv.en) === 1) {
          let crc = (old ^ Number(toUintN(pv.din, 8))) & 255;
          for (let i = 0; i < 8; i++) {
            crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 255 : (crc << 1) & 255;
          }
          st.count = crc;
        }
        if ((st.count || 0) !== old) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'UART_TX': {
        if (bit(pv.rst) === 1) {
          if (st.uartTxBusy || st.uartTxOut === 0) anyChanged = true;
          st.uartTxBusy = 0;
          st.uartTxShift = 0;
          st.uartTxRem = 0;
          st.uartTxOut = 1;
        } else if (risingEdge) {
          if (!st.uartTxBusy) {
            if (bit(pv.send) === 1) {
              const d = Number(toUintN(pv.data, 8)) & 255;
              st.uartTxOut = 0;
              st.uartTxShift = d | (1 << 8);
              st.uartTxRem = 9;
              st.uartTxBusy = 1;
              anyChanged = true;
            } else if (st.uartTxOut !== 1) {
              st.uartTxOut = 1;
              anyChanged = true;
            }
          } else {
            const shift = st.uartTxShift || 0;
            st.uartTxOut = shift & 1;
            st.uartTxShift = shift >> 1;
            const rem = (st.uartTxRem || 1) - 1;
            st.uartTxRem = rem;
            if (rem <= 0) st.uartTxBusy = 0;
            anyChanged = true;
          }
        }
        st.prevClk = clkVal;
        break;
      }
      case 'UART_RX': {
        if (bit(pv.rst) === 1) {
          if (st.uartRxState || st.uartRxData || st.uartRxValid || st.uartRxErr) anyChanged = true;
          st.uartRxState = 0;
          st.uartRxBit = 0;
          st.uartRxShift = 0;
          st.uartRxData = 0;
          st.uartRxValid = 0;
          st.uartRxErr = 0;
        } else if (risingEdge) {
          const rx = bit(pv.rx);
          const rxSt = st.uartRxState || 0;
          if (rxSt === 0) {
            if (rx === 0) {
              st.uartRxState = 1;
              st.uartRxBit = 0;
              st.uartRxShift = 0;
              st.uartRxValid = 0;
              st.uartRxErr = 0;
              anyChanged = true;
            }
          } else if (rxSt === 1) {
            const bIdx = st.uartRxBit || 0;
            st.uartRxShift = (st.uartRxShift || 0) | (rx << bIdx);
            if (bIdx >= 7) st.uartRxState = 2;
            else st.uartRxBit = bIdx + 1;
            anyChanged = true;
          } else {
            if (rx === 1) {
              st.uartRxData = (st.uartRxShift || 0) & 255;
              st.uartRxValid = 1;
              st.uartRxErr = 0;
            } else {
              st.uartRxValid = 0;
              st.uartRxErr = 1;
            }
            st.uartRxState = 0;
            anyChanged = true;
          }
        }
        st.prevClk = clkVal;
        break;
      }
      case 'CUSTOM_IC': {
        if (st.subState && evaluateSequentialEdges(st.subState.components)) {
          anyChanged = true;
        }
        break;
      }
      case 'MOD_COUNTER_N': {
        const old = st.countBig ?? 0n;
        const modPin = toUintN(pv.mod, b);
        const modVal = modPin > 0n ? modPin : BigInt(Math.max(2, comp.modBase || 10));
        if (bit(pv.rst) === 1) {
          st.countBig = 0n;
        } else if (risingEdge && (pv.en === undefined || bit(pv.en) === 1 || comp.pins.every(p => p.id !== 'en'))) {
          st.countBig = BigInt.asUintN(b, (old + 1n) % modVal);
        }
        if (st.countBig !== old) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'WATCHDOG_N': {
        const old = st.wdTimer || 0;
        const kick = bit(pv.kick);
        const kickRise = (st.prevKick || 0) === 0 && kick === 1;
        const limPin = Number(toUintN(pv.lim, b));
        const lim = limPin > 0 ? limPin : Math.max(1, comp.modBase || 16);
        if (bit(pv.rst) === 1 || kickRise) {
          st.wdTimer = 0;
        } else if (risingEdge && old < lim) {
          st.wdTimer = old + 1;
        }
        st.prevKick = kick;
        if ((st.wdTimer || 0) !== old) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'DEBOUNCER': {
        const raw = bit(pv.in0);
        const prevStable = st.debStable ? 1 : 0;
        if (risingEdge) {
          if (raw === prevStable) {
            st.debCount = 0;
          } else {
            const cnt = (st.debCount || 0) + 1;
            if (cnt >= 4) {
              st.debStable = raw;
              st.debCount = 0;
              anyChanged = true;
            } else {
              st.debCount = cnt;
            }
          }
        }
        st.prevClk = clkVal;
        break;
      }
      case 'STOPWATCH_N': {
        const old = st.countBig ?? 0n;
        const running = bit(pv.start) === 1;
        const lap = bit(pv.lap) === 1;
        st.q = running ? 1 : 0;
        if (bit(pv.rst) === 1) {
          st.swTicks = 0;
          st.countBig = 0n;
        } else if (risingEdge && running) {
          const next = (st.swTicks || 0) + 1;
          st.swTicks = next;
          if (!lap) st.countBig = BigInt.asUintN(b, BigInt(next));
        }
        if (st.countBig !== old) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'CRC16_GEN': {
        const old = st.crcVal ?? 0xffff;
        if (bit(pv.rst) === 1) {
          st.crcVal = 0xffff;
        } else if (risingEdge && bit(pv.en) === 1) {
          let crc = old & 0xffff;
          const byteVal = Number(toUintN(pv.d, 8)) & 0xff;
          crc ^= byteVal << 8;
          for (let i = 0; i < 8; i++) {
            crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
          }
          st.crcVal = crc;
        }
        if ((st.crcVal ?? 0xffff) !== old) anyChanged = true;
        st.prevClk = clkVal;
        break;
      }
      case 'TEXT_CONSOLE': {
        if (!Array.isArray(st.textLines) || st.textLines.length === 0) st.textLines = [''];
        if (bit(pv.clr) === 1) {
          if (st.textLines.length > 1 || st.textLines[0] !== '') anyChanged = true;
          st.textLines = [''];
        } else if (risingEdge && bit(pv.we) === 1) {
          const ch = Number(toUintN(pv.char, 8)) & 0xff;
          const lines = st.textLines;
          if (ch === 10) {
            lines.push('');
          } else if (ch === 13) {
            // ignore CR
          } else if (ch === 8) {
            const last = lines[lines.length - 1];
            if (last.length > 0) lines[lines.length - 1] = last.slice(0, -1);
            else if (lines.length > 1) lines.pop();
          } else if (ch >= 32 && ch <= 126) {
            let last = lines[lines.length - 1] + String.fromCharCode(ch);
            if (last.length > 24) {
              lines[lines.length - 1] = last.slice(0, 24);
              lines.push(last.slice(24));
            } else {
              lines[lines.length - 1] = last;
            }
          }
          while (lines.length > 8) lines.shift();
          anyChanged = true;
        }
        st.prevClk = clkVal;
        break;
      }
      case 'ANIM32_GPU': {
        if (bit(pv.rst) === 1) {
          st.animScene = 0;
          st.animStep = 0;
          st.animSubFrame = 0;
          st.animPx = 0;
          st.animPy = 0;
          st.animOutPx = 0;
          st.animOutPy = 0;
          st.animWe = 0;
          st.animSwap = 0;
          st.animLwe = 0;
          st.animSfxGate = 0;
          anyChanged = true;
        } else if (risingEdge && bit(pv.pause) === 0) {
          const useExt = bit(pv.use_ext) === 1;
          const curScene = useExt ? Number(toUintN(pv.scene, 5)) & 31 : ((st.animScene as number) || 0) & 31;
          if (useExt) st.animScene = curScene;
          const curStep = (st.animStep as number) || 0;
          const subFrame = curStep & 7;
          const px = (st.animPx as number) || 0;
          const py = (st.animPy as number) || 0;
          const buf = renderFunnyScene32Buffer(curScene, subFrame);
          const idx = py * 64 + px;

          st.animOutPx = px;
          st.animOutPy = py;
          st.animCol = buf[idx];
          st.animWe = 1;
          st.animSwap = idx === 3071 ? 1 : 0;

          const def = FUNNY_SCENES_32[curScene];
          if (idx < 32) {
            const ch = idx < 16 ? def.line1.charCodeAt(idx) : def.line2.charCodeAt(idx - 16);
            st.animLchar = ch;
            st.animLx = idx & 15;
            st.animLy = idx >> 4;
            st.animLwe = 1;
          } else {
            st.animLwe = 0;
          }
          st.animSfxFreq = def.sfxFreq;
          st.animSfxGate = curStep === 0 && idx < 48 ? 1 : 0;

          if (idx >= 3071) {
            st.animPx = 0;
            st.animPy = 0;
            const nextStep = curStep + 1;
            if (!useExt && nextStep >= 16) {
              st.animStep = 0;
              st.animScene = (curScene + 1) & 31;
            } else {
              st.animStep = nextStep % 16;
            }
            st.animSubFrame = (st.animStep as number) & 7;
          } else if (px < 63) {
            st.animPx = px + 1;
          } else {
            st.animPx = 0;
            st.animPy = py + 1;
          }
          anyChanged = true;
        }
        st.prevClk = clkVal;
        break;
      }
    }
  }
  return anyChanged;
}

export function evaluateCircuitDeterministic(
  compList: LogicComponent[],
  wireList: Wire[],
  dt = 0,
  globalClockHz = 2,
  customICs: CustomICDef[] = []
): boolean {
  const clkToggled = dt > 0 ? advanceClocks(compList, dt, globalClockHz) : false;
  solveNetwork(compList, wireList, true, customICs);
  const solve1Changed = lastSolveChanged;
  const seqChanged = evaluateSequentialEdges(compList);
  let solve2Changed = false;
  if (seqChanged) {
    solveNetwork(compList, wireList, false, customICs);
    solve2Changed = lastSolveChanged;
  }
  return clkToggled || solve1Changed || seqChanged || solve2Changed;
}
