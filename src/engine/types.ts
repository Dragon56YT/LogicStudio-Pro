export type ThemeId = 'cyber' | 'blueprint' | 'clean';
export type WireStyle = 'bezier' | 'orthogonal';
export type WireVisibilityMode = 'all' | 'dim_inactive' | 'selected_only';
export type NavigationMode = 'auto' | 'trackpad' | 'mouse';
export type QualityMode = 'auto' | 'high' | 'low' | 'eco';

export type PinSignal = number | bigint | 'Z' | 'ERR';

export interface PinDef {
  id: string;
  dir: 'in' | 'out';
  lx: number;
  ly: number;
  label: string;
  width?: number; // 1..64 bits (defaults to 1)
}

export interface WorldPin {
  comp: LogicComponent;
  pinId: string;
  dir: 'in' | 'out';
  label: string;
  width: number;
  x: number;
  y: number;
}

export interface FsmDef {
  n: number;
  next0: number[];
  next1: number[];
  out: number[];
}

export interface ComponentInternalState {
  value: number | bigint;
  q: number;
  qn: number;
  reg: number[];
  regBig?: bigint;
  count: number;
  countBig?: bigint;
  prevClk: number;
  clockTimer: number;
  clockOut: number;
  hexVal: number | bigint;
  seqBits: number[];
  seqIdx: number;
  mem?: (number | bigint)[];
  lastWrite?: number;
  fsm?: FsmDef;
  fsmState?: number;
  stack?: bigint[];
  sp?: number;
  vgaBuf?: Uint8Array;
  vgaFront?: Uint8Array;
  vgaW?: number;
  vgaH?: number;
  prevSwap?: number;
  prevClr?: number;
  gamepadBits?: number;
  lastKeyAscii?: number;
  keyReady?: number;
  aluOp?: number;
  aluRes?: bigint;
  aluA?: bigint;
  aluB?: bigint;
  subState?: SubNetlistState | null;
  timerCount?: number;
  splitWidths?: number[];
  fifo?: bigint[];
  regFile?: bigint[];
  lcdChars?: number[];
  vgaVersion?: number;
  ovf?: number;
  uartTxBusy?: number;
  uartTxShift?: number;
  uartTxRem?: number;
  uartTxOut?: number;
  uartRxState?: number;
  uartRxBit?: number;
  uartRxShift?: number;
  uartRxData?: number;
  uartRxValid?: number;
  uartRxErr?: number;
  textLines?: string[];
  wdTimer?: number;
  prevKick?: number;
  debCount?: number;
  debStable?: number;
  encPos?: number;
  adcVal?: number | bigint;
  swTicks?: number;
  crcVal?: number;
  animScene?: number;
  animSubFrame?: number;
  animPx?: number;
  animPy?: number;
  animStep?: number;
  [key: string]: unknown;
}

export interface SubNetlistState {
  components: LogicComponent[];
  wires: Wire[];
}

export interface LogicComponent {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  bits?: number; // 1, 2, 4, 8, 16, 32, 64
  addrBits?: number; // 4..16 for RAM_N / ROM_N
  tunnelTag?: string;
  tunnelDir?: 'in' | 'out';
  splitWidths?: number[];
  sliceHi?: number;
  sliceLo?: number;
  signedMode?: boolean;
  modBase?: number;
  label: string;
  noteText: string;
  inputCount: number;
  color: string;
  freqHz: number | null;
  buzzerHz: number;
  probe: boolean;
  rot: number;
  flip: boolean;
  icDefId: string | null;
  icSnapshot: CustomICDef | null;
  spawnScale?: number;
  spawnVel?: number;
  unstable: boolean;
  pins: PinDef[];
  pinValues: Record<string, PinSignal>;
  internalState: ComponentInternalState;
  _fixed?: boolean;
}

export interface Wire {
  id: string;
  fromCompId: string;
  fromPinId: string;
  toCompId: string;
  toPinId: string;
  signal: PinSignal;
  width?: number;
  unstable?: boolean;
}

export interface CustomICPinRef {
  compId: string;
  pinId?: string;
  name: string;
  width?: number;
}

export interface CustomICDef {
  id: string;
  name: string;
  inputs: CustomICPinRef[];
  outputs: CustomICPinRef[];
  netlist: SubNetlistState;
}

export type PerfProfile = 'high' | 'balanced' | 'eco' | 'potato';

export interface AppSettings {
  dblclickEdit: boolean;
  openAnalyzerOnStart: boolean;
  quality: QualityMode;
  perfProfile?: PerfProfile;
  fpsCap?: 60 | 30 | 15 | 10;
  particles: boolean;
  snap: boolean;
  defaultWireStyle: WireStyle;
  wireVisibility: WireVisibilityMode;
  navigationMode: NavigationMode;
  showMinimap: boolean;
  showFloatingHelp: boolean;
  showGrid?: boolean;
  showWireLabels?: boolean;
  showFpsCounter?: boolean;
  reduceAnimations?: boolean;
  turboMaxCycles?: number;
  defaultBitWidth: number;
  clockMultiplier: number;
  ecoMode?: boolean;
}

export interface CatalogItem {
  type: string;
  cat: string;
  badge: string;
  name: string;
  w: number;
  h: number;
  variableInputs?: boolean;
  scalableBits?: boolean;
  defaultBits?: number;
}

// =========================================================================
// UTILIDADES DE BITS (1..64 BITS CON BIGINT EXACTO)
// =========================================================================
export function bit(v: PinSignal | undefined): 0 | 1 {
  if (typeof v === 'bigint') return v !== 0n ? 1 : 0;
  return v === 1 ? 1 : 0;
}

export function maskBits(bits: number): bigint {
  const b = Math.max(1, Math.min(64, Math.trunc(bits || 1)));
  if (b >= 64) return 0xFFFFFFFFFFFFFFFFn;
  return (1n << BigInt(b)) - 1n;
}

export function toUintN(v: PinSignal | undefined, bits: number): bigint {
  const b = Math.max(1, Math.min(64, Math.trunc(bits || 1)));
  if (v === undefined || v === 'Z' || v === 'ERR') return 0n;
  const raw = typeof v === 'bigint' ? v : BigInt(Math.trunc(Number.isFinite(v) ? v : 0));
  return BigInt.asUintN(b, raw);
}

export function toSignedN(v: bigint, bits: number): bigint {
  const b = Math.max(1, Math.min(64, Math.trunc(bits || 1)));
  return BigInt.asIntN(b, v);
}

export function formatSignalHex(v: PinSignal | undefined, width = 1): string {
  if (v === 'Z') return 'Z';
  if (v === 'ERR') return 'ERR';
  const b = Math.max(1, Math.min(64, width));
  if (b === 1) return bit(v).toString();
  const u = toUintN(v, b);
  const digits = Math.ceil(b / 4);
  return '0x' + u.toString(16).toUpperCase().padStart(digits, '0');
}

export function formatSignalCompact(v: PinSignal | undefined, width = 1): string {
  if (v === 'Z') return 'Z';
  if (v === 'ERR') return 'ERR';
  const b = Math.max(1, Math.min(64, width));
  if (b === 1) return bit(v).toString();
  const u = toUintN(v, b);
  return u.toString(16).toUpperCase().padStart(Math.ceil(b / 4), '0');
}

export function isSignalNonZero(v: PinSignal | undefined): boolean {
  if (v === 'Z' || v === 'ERR' || v === undefined) return false;
  if (typeof v === 'bigint') return v !== 0n;
  return v !== 0;
}

// =========================================================================
// SERIALIZACIÓN SEGURA CON BIGINT Y UINT8ARRAY
// =========================================================================
export function serializeCircuitData(data: unknown, stripTransient = true): string {
  return JSON.stringify(data, (k, v) => {
    if (stripTransient && (k === 'spawnScale' || k === 'spawnVel' || k === 'vgaBuf' || k === 'vgaFront' || k === 'rcTempMap')) {
      return undefined;
    }
    if (v instanceof Uint8Array) {
      return { __U8__: Array.from(v) };
    }
    if (typeof v === 'bigint') {
      return `__BI__0x${v.toString(16)}`;
    }
    return v;
  });
}

export function deserializeCircuitData<T = unknown>(json: string): T {
  return JSON.parse(json, (_k, v) => {
    if (typeof v === 'string' && v.startsWith('__BI__')) {
      try {
        return BigInt(v.slice(6));
      } catch {
        return 0n;
      }
    }
    if (v && typeof v === 'object' && !Array.isArray(v) && Array.isArray((v as { __U8__?: unknown }).__U8__)) {
      return new Uint8Array((v as { __U8__: number[] }).__U8__);
    }
    return v;
  }) as T;
}

let uidCounter = 1;
export function genId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${(uidCounter++).toString(36)}`;
}
