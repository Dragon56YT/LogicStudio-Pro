import { COMPONENT_CATALOG, createComponent, getSplitterChunks, syncComponentPins } from './catalog';
import { evaluateCircuitDeterministic } from './simulator';
import { CustomICDef, LogicComponent, Wire, genId } from './types';

export const LS_TYPE_ALIASES: Record<string, string> = {
  SW: 'SWITCH',
  BTN: 'BUTTON',
  CLK: 'CLOCK',
  DFF: 'D_FF',
  JKFF: 'JK_FF',
  TFF: 'T_FF',
  FF_D: 'D_FF',
  FF_T: 'T_FF',
  FF_JK: 'JK_FF',
  REG: 'REG_4',
  REGISTER: 'REG_4',
  REG64: 'REG_N',
  COUNTER: 'COUNTER_4',
  CNT: 'COUNTER_4',
  CNT64: 'COUNTER_N',
  RAM: 'RAM_N',
  ROM: 'ROM_N',
  ALU: 'ALU_N',
  ALU64: 'ALU_N',
  ADD: 'ADDER_N',
  SUB: 'SUB_N',
  MUL: 'MULT_N',
  DIV: 'DIV_N',
  SHF: 'SHIFTER_N',
  CMP: 'COMP_N',
  MUX2: 'MUX_2',
  MUX4: 'MUX_4',
  MUX8: 'MUX_8',
  MUX16: 'MUX_16',
  DEMUX: 'DEMUX_2',
  DEMUX2: 'DEMUX_2',
  DEMUX4: 'DEMUX_4',
  DEMUX8: 'DEMUX_8',
  DEMUX16: 'DEMUX_16',
  DEC2: 'DEC_2TO4',
  DEC3: 'DEC_3TO8',
  DEC4: 'DEC_4TO16',
  ENC4: 'ENC_4TO2',
  ENC8: 'ENC_8TO3',
  ENC16: 'ENC_16TO4',
  HA: 'HALF_ADDER',
  FA: 'FULL_ADDER',
  SEG7: 'SEG7_DISPLAY',
  HEX: 'HEX_DISPLAY',
  HEX_N: 'HEX_DISPLAY_N',
  HEX64: 'HEX_DISPLAY_N',
  DEC_N: 'DEC_DISPLAY_N',
  TRISTATE: 'TRI_BUFFER',
  INV: 'NOT',
  ONE: 'HIGH',
  ZERO: 'LOW',
  VCC: 'HIGH',
  GND: 'LOW',
  CONST: 'CONST_N',
  SPLIT: 'SPLITTER',
  JOIN: 'MERGER',
  VGA: 'VGA_SCREEN',
  PAD: 'GAMEPAD',
  KBD: 'KEYBOARD_ASCII',
  STK: 'STACK_LIFO',
  STACK: 'STACK_LIFO',
  FIFO: 'FIFO_N',
  QUEUE: 'FIFO_N',
  REGFILE: 'REG_FILE_N',
  RF: 'REG_FILE_N',
  DUALRAM: 'DUAL_RAM_N',
  DRAM: 'DUAL_RAM_N',
  LCD: 'LCD_TEXT',
  BAR_N: 'LED_BAR_8',
  BAR8: 'LED_BAR_8',
  BAR16: 'LED_BAR_8',
  TONE: 'TONE_GEN',
  SYNTH: 'TONE_GEN',
  MAJ: 'MAJ3',
  MAJ3: 'MAJ3',
  ONESHOT: 'PULSE_ONE',
  PULSE1: 'PULSE_ONE',
  RSFF: 'RS_FF',
  FF_RS: 'RS_FF',
  SLICE: 'BUS_SLICE',
  INC: 'INC_DEC_N',
  DEC: 'INC_DEC_N',
  ABS: 'ABS_NEG_N',
  NEG: 'ABS_NEG_N',
  MINMAX: 'MIN_MAX_N',
  POPCNT: 'POPCOUNT_N',
  POPCOUNT: 'POPCOUNT_N',
  MUX32: 'MUX_32',
  DEMUX32: 'DEMUX_32',
  DEC5: 'DEC_5TO32',
  ENC32: 'ENC_32TO5',
  BIN2BCD: 'BIN2BCD_N',
  BCD4: 'BIN2BCD_N',
  STEPPER: 'NUM_STEPPER',
  MAC: 'MAC_N',
  PWM: 'PWM_GEN',
  RING: 'RING_CNT',
  JOHNSON: 'RING_CNT',
  CRC: 'CRC8_GEN',
  CRC8: 'CRC8_GEN',
  UARTTX: 'UART_TX',
  UARTRX: 'UART_RX',
  DECDISP: 'DEC_DISPLAY_N',
  DECIMAL: 'DEC_DISPLAY_N',
  SEMAFORO: 'TRAFFIC_LIGHT',
  TRAFFIC: 'TRAFFIC_LIGHT',
  TEXT: 'LABEL',
  // Nuevos Beta 0.3+
  ROTARY: 'ROTARY_ENC',
  SLIDER: 'SLIDER_ADC',
  ADC: 'SLIDER_ADC',
  POT: 'SLIDER_ADC',
  CROSSBAR: 'CROSSBAR_2X2',
  XBAR: 'CROSSBAR_2X2',
  ARB: 'PRIORITY_ARB',
  ARBITER: 'PRIORITY_ARB',
  PACK4: 'BUS_PACK4',
  UNPACK4: 'BUS_UNPACK4',
  SATADD: 'SAT_ADDER_N',
  SAT: 'SAT_ADDER_N',
  SQRT: 'SQRT_N',
  WINDOW: 'COMP_WIN_N',
  WIN: 'COMP_WIN_N',
  MODCNT: 'MOD_COUNTER_N',
  MOD: 'MOD_COUNTER_N',
  WDOG: 'WATCHDOG_N',
  WATCHDOG: 'WATCHDOG_N',
  DEBOUNCE: 'DEBOUNCER',
  STOPWATCH: 'STOPWATCH_N',
  CRONO: 'STOPWATCH_N',
  CRC16: 'CRC16_GEN',
  CONSOLE: 'TEXT_CONSOLE',
  TERM: 'TEXT_CONSOLE',
  VU: 'VU_METER_N',
  VUMETER: 'VU_METER_N',
  ANIM32: 'ANIM32_GPU'
};

export const LS_EXAMPLES: Record<string, string> = {
  'Procesador Bus 64-Bit + ALU + Túneles': `# Arquitectura de 64 bits usando Buses y Túneles (cero enredo de cables)
place clk = CLOCK hz=2 label="CLK"
place op_add = CONST_N bits=4 value=0 label="OP=ADD"
place k1 = CONST_N bits=64 value=0x123456789ABCDEF0 label="REG_A"
place k2 = CONST_N bits=64 value=0x0000000000000110 label="INC"
place en = HIGH
place cin = LOW
place alu = ALU_N bits=64 label="ALU 64b"
place acc = REG_N bits=64 label="ACC 64b"
place t_out = TUNNEL tag="ACC_BUS" bits=64 dir=out
place t_in = TUNNEL tag="ACC_BUS" bits=64 dir=in
place disp = HEX_DISPLAY_N bits=64 label="RESULTADO 64-BIT"

connect clk.out -> acc.clk
connect en.out -> acc.en
connect cin.out -> alu.cin
connect op_add.out -> alu.op
connect k2.out -> alu.b
connect acc.q -> t_out.in0
connect t_in.out -> alu.a, disp.d
connect alu.y -> acc.d`,

  'Macro + Bucle + Consola ASCII (LogicScript v2)': `# LogicScript v2: macros, let aritmético, rangos de pines y memoria ASCII
place clk = CLOCK hz=8 label="CLK 8Hz"
place en = HIGH
place rst = BUTTON label="CLR"
place cnt = COUNTER_N bits=5 label="ADDR"
place rom = ROM_N bits=8 addrBits=5 label="Texto ASCII" mem="HOLA DESDE LOGICSCRIPT V2!"
place con = TEXT_CONSOLE label="Consola Serial"
place crc = CRC16_GEN label="CRC-16"

connect clk.out -> cnt.clk, con.clk, crc.clk
connect en.out -> cnt.en, cnt.up, con.we, crc.en
connect rst.out -> cnt.rst, con.clr, crc.rst
connect cnt.q -> rom.addr
connect rom.q -> con.char, crc.d

macro canal_led(idx, x, y)
  place sw_{idx} = SWITCH label="CH{idx}" at {x},{y}
  place led_{idx} = LED color=emerald label="L{idx}" at +150,+0
  connect sw_{idx}.out -> led_{idx}.in0
endmacro

for i in 0..1
  let py = -120 + i * 70
  call canal_led(i, -340, py)
end`,

  'CPU 16-Bit con ROM + RAM + Pila + Display': `# CPU de 16 bits con Contador de Programa, ROM 256x16, ALU 16-Bit y Display
place clk = CLOCK hz=4 label="CLK"
place en = HIGH
place rst = SWITCH label="RST"
place cin = LOW
place op_add = CONST_N bits=4 value=0 label="ADD"
place pc = COUNTER_N bits=8 label="PC"
place rom = ROM_N bits=16 addrBits=8 label="PROG ROM" mem=0x0001,0x0002,0x0004,0x0008,0x0010*2,0x0040,0x0080,0x0100,0x0200,0x0400,0x0800
place alu = ALU_N bits=16 label="ALU 16b"
place acc = REG_N bits=16 label="ACC 16b"
place disp = HEX_DISPLAY_N bits=16 label="ACCUM" color=emerald

connect clk.out -> pc.clk, acc.clk
connect en.out -> pc.en, pc.up, acc.en
connect rst.out -> pc.rst, acc.rst
connect cin.out -> alu.cin
connect op_add.out -> alu.op
connect pc.q -> rom.addr
connect rom.q -> alu.b
connect acc.q -> alu.a, disp.d
connect alu.y -> acc.d`,

  'Sumador de 4 bits (puertas clásicas)': `# Sumador de 4 bits con acarreo en cadena
for i in 0..3
  place a{i} = SWITCH label="A{i}"
  place b{i} = SWITCH label="B{i}"
  place fa{i} = FULL_ADDER
  place s{i} = LED label="S{i}" color=emerald
  connect a{i}.out -> fa{i}.a
  connect b{i}.out -> fa{i}.b
  connect fa{i}.s -> s{i}.in0
end
place cin = LOW
connect cin.out -> fa0.cin
for i in 0..2
  connect fa{i}.cout -> fa{i+1}.cin
end
place cout = LED label="COUT" color=rose
connect fa3.cout -> cout.in0`,

  'LCD 16×2 + ROM Mensajes': `# Pantalla LCD 16x2 mostrando texto ASCII desde una ROM
place clk = CLOCK hz=6 label="CLK"
place en = HIGH
place y0 = LOW
place clr = BUTTON label="CLR"
place cnt = COUNTER_N bits=4 label="Cursor"
place rom = ROM_N bits=8 addrBits=4 label="Mensaje" mem="HELLO LOGIC 64b!"
place lcd = LCD_TEXT color=emerald label="Pantalla 16x2"

connect clk.out -> cnt.clk, lcd.clk
connect en.out -> cnt.en, cnt.up, lcd.we
connect y0.out -> lcd.y
connect clr.out -> lcd.clr
connect cnt.q -> rom.addr, lcd.x
connect rom.q -> lcd.char`,

  'CPU con Banco 8 Registros + Dual RAM': `# Arquitectura RISC con Banco de 8 Registros, ALU 16b y RAM Doble Puerto
place clk = CLOCK hz=4 label="CLK"
place en = HIGH
place rst = BUTTON label="RST"
place ra = CONST_N bits=3 value=1 label="RA=R1"
place rb = CONST_N bits=3 value=2 label="RB=R2"
place wa = CONST_N bits=3 value=1 label="WA=R1"
place op = CONST_N bits=4 value=0 label="ADD"
place rf = REG_FILE_N bits=16 label="Regs 8x16b"
place alu = ALU_N bits=16 label="ALU 16b"
place inc = CONST_N bits=16 value=1 label="IMM=1"
place dram = DUAL_RAM_N bits=16 addrBits=8 label="Dual RAM"
place disp = HEX_DISPLAY_N bits=16 label="R1" color=cyan

connect clk.out -> rf.clk, dram.clk
connect rst.out -> rf.rst
connect en.out -> rf.we, dram.we
connect ra.out -> rf.ra, dram.aa
connect rb.out -> rf.rb, dram.ab
connect wa.out -> rf.wa
connect rf.qa -> alu.a, disp.d, dram.da
connect inc.out -> alu.b
connect op.out -> alu.op
connect alu.y -> rf.wd`,

  'Demux 1:8 con Conexión por Rango': `# Demultiplexor 1:8 usando conexión de rango a0..a2 / y0..y7
place clk = CLOCK hz=2 label="CLK"
place en = HIGH
place din = HIGH
place cnt = COUNTER_4 label="SEL"
place dmx = DEMUX_8 label="DEMUX 1:8"
connect clk.out -> cnt.clk
connect en.out -> cnt.en
connect din.out -> dmx.din
connect cnt.q0..q2 -> dmx.s0..s2
for i in 0..7
  place l{i} = LED label="Y{i}" color=cyan
  connect dmx.y{i} -> l{i}.in0
end`
};

export interface LogicScriptDiagnostic {
  line: number;
  msg: string;
  sourceLine?: string;
  suggestion?: string;
}

export interface LogicScriptBuildResult {
  errors: LogicScriptDiagnostic[];
  warnings: string[];
  comps?: number;
  wires?: number;
  components?: LogicComponent[];
  wireList?: Wire[];
}

interface ScriptLine {
  t: string;
  n: number;
  raw: string;
}

interface MacroDef {
  params: string[];
  body: ScriptLine[];
}

interface PlaceCmd {
  kind: 'place';
  alias: string;
  type: string;
  opts: Record<string, string>;
  at: { x: number; y: number; relX: boolean; relY: boolean } | null;
  line: number;
  raw: string;
}

interface ConnectCmd {
  kind: 'connect';
  froms: Array<{ alias: string; pin: string }>;
  tos: Array<{ alias: string; pin: string }>;
  line: number;
  raw: string;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function closestMatch(target: string, candidates: string[], maxDist = 4): string | null {
  const low = target.toLowerCase();
  let best: string | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const cl = c.toLowerCase();
    if (cl === low) return c;
    const d = levenshtein(low, cl);
    if (d < bestD && d <= maxDist) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function evalIntExpr(expr: string, env: Record<string, number>): number | null {
  // Replace identifiers present in env
  const replaced = expr.replace(/\b([A-Za-z_]\w*)\b/g, (m, id) => {
    if (id in env) return String(env[id]);
    return m;
  });
  // Strict tokenizer: integers, + - * / % ( ) and whitespace only
  if (!/^[0-9+\-*/%()\s]+$/.test(replaced)) return null;
  const tokens = replaced.match(/\d+|[+\-*/%()]/g);
  if (!tokens || !tokens.length) return null;

  let idx = 0;
  const parseExpr = (): number => {
    let val = parseTerm();
    while (idx < tokens.length && (tokens[idx] === '+' || tokens[idx] === '-')) {
      const op = tokens[idx++];
      const rhs = parseTerm();
      val = op === '+' ? val + rhs : val - rhs;
    }
    return val;
  };
  const parseTerm = (): number => {
    let val = parseFactor();
    while (idx < tokens.length && (tokens[idx] === '*' || tokens[idx] === '/' || tokens[idx] === '%')) {
      const op = tokens[idx++];
      const rhs = parseFactor();
      if (op === '*') val *= rhs;
      else if (op === '/') val = rhs === 0 ? 0 : Math.trunc(val / rhs);
      else val = rhs === 0 ? 0 : val % rhs;
    }
    return val;
  };
  const parseFactor = (): number => {
    const tok = tokens[idx];
    if (tok === '-') {
      idx++;
      return -parseFactor();
    }
    if (tok === '+') {
      idx++;
      return parseFactor();
    }
    if (tok === '(') {
      idx++;
      const v = parseExpr();
      if (tokens[idx] === ')') idx++;
      return v;
    }
    if (/^\d+$/.test(tok || '')) {
      idx++;
      return Number(tok);
    }
    throw new Error('bad expr');
  };

  try {
    const out = parseExpr();
    return idx === tokens.length && Number.isFinite(out) ? Math.trunc(out) : null;
  } catch {
    return null;
  }
}

function lsSubst(t: string, env: Record<string, number | string>): string {
  let out = t;
  // Substitute $var tokens when present
  for (const [k, v] of Object.entries(env)) {
    out = out.replace(new RegExp(`\\$${k}\\b`, 'g'), String(v));
  }
  const numEnv: Record<string, number> = {};
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === 'number') numEnv[k] = v;
    else if (/^-?\d+$/.test(v.trim())) numEnv[k] = Number(v);
  }
  return out.replace(/\{([^}]+)\}/g, (m, inner) => {
    const trimmed = inner.trim();
    if (trimmed in env) return String(env[trimmed]);
    const val = evalIntExpr(trimmed, numEnv);
    return val !== null ? String(val) : m;
  });
}

function lsExpandBlock(
  items: ScriptLine[],
  env: Record<string, number | string>,
  macros: Map<string, MacroDef>,
  out: ScriptLine[],
  errors: LogicScriptDiagnostic[],
  depth = 0
): void {
  if (depth > 16) {
    errors.push({ line: items[0]?.n || 1, msg: 'Anidamiento excesivo de bucles o macros (>16 niveles)' });
    return;
  }
  const localEnv: Record<string, number | string> = { ...env };

  for (let i = 0; i < items.length; i++) {
    const n = items[i].n;
    const raw = items[i].raw;
    const t = lsSubst(items[i].t, localEnv);

    // let var = expr
    const ml = t.match(/^let\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
    if (ml) {
      const numEnv: Record<string, number> = {};
      for (const [k, v] of Object.entries(localEnv)) {
        if (typeof v === 'number') numEnv[k] = v;
      }
      const val = evalIntExpr(ml[2], numEnv);
      if (val !== null) {
        localEnv[ml[1]] = val;
      } else {
        localEnv[ml[1]] = ml[2].trim().replace(/^"(.*)"$/, '$1');
      }
      continue;
    }

    // Macro definition: macro name(p1, p2) ... endmacro
    const mm = t.match(/^macro\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*$/i);
    if (mm) {
      let j = i + 1;
      for (; j < items.length; j++) {
        if (/^endmacro$/i.test(items[j].t)) break;
      }
      if (j >= items.length) {
        errors.push({ line: n, msg: `Falta "endmacro" para cerrar la macro "${mm[1]}"`, sourceLine: raw });
        return;
      }
      const params = mm[2]
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      macros.set(mm[1].toLowerCase(), { params, body: items.slice(i + 1, j) });
      i = j;
      continue;
    }
    if (/^endmacro$/i.test(t)) {
      errors.push({ line: n, msg: '"endmacro" sin "macro" que la abra', sourceLine: raw });
      continue;
    }

    // Call macro: call name(arg1, arg2)
    const mc = t.match(/^call\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*$/i);
    if (mc) {
      const def = macros.get(mc[1].toLowerCase());
      if (!def) {
        const sug = closestMatch(mc[1], Array.from(macros.keys()));
        errors.push({
          line: n,
          msg: `Macro desconocida: "${mc[1]}"`,
          sourceLine: raw,
          suggestion: sug ? `¿Quizás quisiste llamar a "${sug}"?` : 'Declara la macro con: macro nombre(param1, param2) ... endmacro'
        });
        continue;
      }
      const rawArgs = mc[2].trim() ? mc[2].split(',').map(s => s.trim()) : [];
      if (rawArgs.length !== def.params.length) {
        errors.push({
          line: n,
          msg: `La macro "${mc[1]}" espera ${def.params.length} parámetro(s), recibió ${rawArgs.length}`,
          sourceLine: raw,
          suggestion: `Formato: call ${mc[1]}(${def.params.join(', ')})`
        });
        continue;
      }
      const callEnv: Record<string, number | string> = { ...localEnv };
      const numEnv: Record<string, number> = {};
      for (const [k, v] of Object.entries(localEnv)) {
        if (typeof v === 'number') numEnv[k] = v;
        else if (/^-?\d+$/.test(String(v).trim())) numEnv[k] = Number(v);
      }
      def.params.forEach((p, idx) => {
        const argVal = lsSubst(rawArgs[idx], localEnv).trim().replace(/^"(.*)"$/, '$1');
        if (argVal in localEnv) {
          callEnv[p] = localEnv[argVal];
        } else {
          const exprVal = evalIntExpr(argVal, numEnv);
          callEnv[p] = exprVal !== null ? exprVal : argVal;
        }
      });
      lsExpandBlock(def.body, callEnv, macros, out, errors, depth + 1);
      continue;
    }

    // for i in A..B ... end / endfor
    const mf = t.match(/^for\s+([A-Za-z_]\w*)\s+in\s+(-?\d+)\s*\.\.\s*(-?\d+)\s*$/i);
    if (mf) {
      let loopDepth = 1;
      let j = i + 1;
      for (; j < items.length; j++) {
        if (/^for\s/i.test(items[j].t)) loopDepth++;
        else if (/^(?:end|endfor)$/i.test(items[j].t)) {
          loopDepth--;
          if (!loopDepth) break;
        }
      }
      if (j >= items.length) {
        errors.push({ line: n, msg: 'Falta "end" (o "endfor") para cerrar este bucle "for"', sourceLine: raw });
        return;
      }
      const a = Number(mf[2]);
      const b = Number(mf[3]);
      if (Math.abs(b - a) > 255) {
        errors.push({ line: n, msg: 'Un "for" no puede superar 256 iteraciones', sourceLine: raw });
        i = j;
        continue;
      }
      const body = items.slice(i + 1, j);
      const step = a <= b ? 1 : -1;
      for (let v = a; step > 0 ? v <= b : v >= b; v += step) {
        lsExpandBlock(body, { ...localEnv, [mf[1]]: v }, macros, out, errors, depth + 1);
      }
      i = j;
      continue;
    }
    if (/^(?:end|endfor)$/i.test(t)) {
      errors.push({ line: n, msg: `"${t}" sin "for" que lo abra`, sourceLine: raw });
      continue;
    }
    out.push({ t, n, raw });
  }
}

function expandPinEndpoint(s: string): Array<{ alias: string; pin: string }> | null {
  const trimmed = s.trim();
  const range = trimmed.match(/^([A-Za-z_]\w*)\.([A-Za-z_]+)(\d+)\.\.\2?(\d+)$/);
  if (range) {
    const alias = range[1];
    const prefix = range[2];
    const a = Number(range[3]);
    const b = Number(range[4]);
    if (Math.abs(b - a) > 64) return null;
    const step = a <= b ? 1 : -1;
    const list: Array<{ alias: string; pin: string }> = [];
    for (let k = a; step > 0 ? k <= b : k >= b; k += step) {
      list.push({ alias, pin: `${prefix}${k}` });
    }
    return list;
  }
  const single = trimmed.match(/^([A-Za-z_]\w*)\.([A-Za-z0-9_]+)$/);
  return single ? [{ alias: single[1], pin: single[2] }] : null;
}

function lsParseLine(
  t: string,
  n: number,
  raw: string,
  errors: LogicScriptDiagnostic[]
): PlaceCmd | ConnectCmd | null {
  const mp = t.match(/^place\s+([A-Za-z_]\w*)\s*=\s*([A-Za-z0-9_]+)\s*(.*)$/i);
  if (mp) {
    let rest = mp[3];
    let at: { x: number; y: number; relX: boolean; relY: boolean } | null = null;
    const masked = rest.replace(/"[^"]*"/g, q => '_'.repeat(q.length));
    const ma = masked.match(/\bat\s+([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)/i);
    if (ma && ma.index !== undefined) {
      at = {
        x: Number(ma[1]),
        y: Number(ma[2]),
        relX: ma[1].startsWith('+') || ma[1].startsWith('-'),
        relY: ma[2].startsWith('+') || ma[2].startsWith('-')
      };
      // Note: treat only explicit `+` or `@`? Actually if they placed an explicit negative coord like `-340,0` that's absolute unless `+` or `at +dx,+dy`!
      // Wait: "+150" is definitely relative; "-150" without "+0" could be negative world coord! Let's require '+' prefix OR explicit 'rel' keyword? Wait: `at +150,+0` -> relX true, relY true! What about `at -80,+40`? Best rule: relative only when starts with `+`, OR `rel X,Y`? Wait: if either token starts with `+`, mark both relative or per-axis? Let's make '+' mark relative on that axis, or `at ~dx,~dy` also accepted!
      at = {
        x: Number(ma[1]),
        y: Number(ma[2]),
        relX: ma[1].startsWith('+'),
        relY: ma[2].startsWith('+')
      };
      rest = rest.slice(0, ma.index) + ' '.repeat(ma[0].length) + rest.slice(ma.index + ma[0].length);
    }
    const matilde = masked.match(/\bat\s+~([+-]?\d+(?:\.\d+)?)\s*,\s*~([+-]?\d+(?:\.\d+)?)/i);
    if (!at && matilde && matilde.index !== undefined) {
      at = { x: Number(matilde[1]), y: Number(matilde[2]), relX: true, relY: true };
      rest = rest.slice(0, matilde.index) + ' '.repeat(matilde[0].length) + rest.slice(matilde.index + matilde[0].length);
    }

    const opts: Record<string, string> = {};
    const re = /([A-Za-z_]\w*)\s*=\s*("([^"]*)"|\[[^\]]*\]|[^\s"]+)/g;
    let mo: RegExpExecArray | null;
    while ((mo = re.exec(rest))) {
      opts[mo[1].toLowerCase()] = mo[3] !== undefined ? mo[3] : mo[2];
    }
    const leftover = rest.replace(re, '').trim();
    if (leftover) {
      errors.push({
        line: n,
        msg: `Texto no reconocido en "place": "${leftover}"`,
        sourceLine: raw,
        suggestion: 'Las opciones deben tener formato clave=valor (ej: bits=8 label="Mi Chip" at 100,0)'
      });
    }
    return { kind: 'place', alias: mp[1], type: mp[2].toUpperCase(), opts, at, line: n, raw };
  }

  const mc = t.match(/^connect\s+(.+?)\s*->\s*(.+)$/i);
  if (mc) {
    const froms = expandPinEndpoint(mc[1]);
    const tosExpanded: Array<{ alias: string; pin: string }> = [];
    let ok = Boolean(froms);
    const destTokens = mc[2].split(',').map(s => s.trim()).filter(Boolean);
    if (!destTokens.length) ok = false;
    for (const tok of destTokens) {
      const exp = expandPinEndpoint(tok);
      if (!exp) {
        ok = false;
        break;
      }
      tosExpanded.push(...exp);
    }
    if (!ok || !froms) {
      errors.push({
        line: n,
        msg: 'Sintaxis de conexión inválida.',
        sourceLine: raw,
        suggestion: 'Usa: connect origen.pin -> destino.pin, otro.pin (o rangos: connect a.q0..q3 -> b.d0..d3)'
      });
      return null;
    }
    if (froms.length > 1 && tosExpanded.length !== froms.length) {
      errors.push({
        line: n,
        msg: `El rango de origen (${froms.length} pines) no coincide con el de destino (${tosExpanded.length} pines).`,
        sourceLine: raw,
        suggestion: 'Asegúrate de que ambos rangos tengan la misma cantidad de pines (ej. q0..q3 -> d0..d3).'
      });
      return null;
    }
    return { kind: 'connect', froms, tos: tosExpanded, line: n, raw };
  }

  errors.push({
    line: n,
    msg: `Instrucción no reconocida: "${t.slice(0, 48)}"`,
    sourceLine: raw,
    suggestion: 'Instrucciones válidas: place, connect, const/let, for…end, macro…endmacro, call'
  });
  return null;
}

function parseBigIntLiteral(raw: string): bigint {
  const s = raw.trim();
  if (/^0x[0-9a-fA-F_]+$/.test(s)) return BigInt(s.replace(/_/g, ''));
  if (/^0b[01_]+$/.test(s)) return BigInt(s.replace(/_/g, ''));
  if (/^-?\d+$/.test(s)) return BigInt(s);
  if (/^[0-9a-fA-F]+$/.test(s)) return BigInt('0x' + s);
  return 0n;
}

function parseMemTokens(rawMem: string, maxLen: number): bigint[] {
  const out: bigint[] = new Array(maxLen).fill(0n);
  let trimmed = rawMem.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  // If rawMem was wrapped in quotes originally and passed raw text without spaces as tokens or plain ASCII
  const hasSpacesOrPunct = !/^([0-9a-fA-F]+|0x|0b|\d+)/i.test(trimmed);
  if (hasSpacesOrPunct && !trimmed.includes(',') && !trimmed.includes('*')) {
    for (let i = 0; i < Math.min(trimmed.length, maxLen); i++) {
      out[i] = BigInt(trimmed.charCodeAt(i) & 0xff);
    }
    return out;
  }

  // Split by comma/whitespace while preserving quoted segments
  const tokens: string[] = [];
  const tokRe = /"([^"]*)"|[^\s,]+/g;
  let m: RegExpExecArray | null;
  while ((m = tokRe.exec(trimmed))) {
    if (m[1] !== undefined) tokens.push(`"${m[1]}"`);
    else tokens.push(m[0]);
  }

  let ptr = 0;
  for (const tok of tokens) {
    if (ptr >= maxLen) break;
    if (tok.startsWith('"') && tok.endsWith('"')) {
      const txt = tok.slice(1, -1);
      for (let i = 0; i < txt.length && ptr < maxLen; i++) {
        out[ptr++] = BigInt(txt.charCodeAt(i) & 0xff);
      }
      continue;
    }
    const rep = tok.match(/^(.+)\*(\d+)$/);
    if (rep) {
      const val = parseBigIntLiteral(rep[1]);
      const count = Math.min(maxLen - ptr, Math.max(0, parseInt(rep[2], 10)));
      for (let k = 0; k < count; k++) out[ptr++] = val;
      continue;
    }
    out[ptr++] = parseBigIntLiteral(tok);
  }
  return out;
}

function lsLayoutSubgraph(auto: LogicComponent[], wires: Wire[], ox: number, oy: number): void {
  const idx = new Map(auto.map((c, i) => [c.id, i]));
  const N = auto.length;
  if (N === 0) return;
  const succ: number[][] = auto.map(() => []);
  const rawIn = new Array<number>(N).fill(0);

  wires.forEach(w => {
    const a = idx.get(w.fromCompId);
    const b = idx.get(w.toCompId);
    if (a === undefined || b === undefined || a === b) return;
    succ[a].push(b);
    rawIn[b]++;
  });

  const tOutByTag = new Map<string, number[]>();
  auto.forEach((c, i) => {
    if (c.type === 'TUNNEL' && c.tunnelDir !== 'in') {
      const tag = (c.tunnelTag || 'SIG').trim();
      const list = tOutByTag.get(tag) || [];
      list.push(i);
      tOutByTag.set(tag, list);
    }
  });
  auto.forEach((c, i) => {
    if (c.type === 'TUNNEL' && c.tunnelDir === 'in') {
      const outs = tOutByTag.get((c.tunnelTag || 'SIG').trim()) || [];
      outs.forEach(o => {
        succ[o].push(i);
        rawIn[i]++;
      });
    }
  });

  const color = new Array<number>(N).fill(0);
  const dag: Array<Set<number>> = auto.map(() => new Set<number>());
  const dfs = (u: number) => {
    color[u] = 1;
    for (const v of succ[u]) {
      if (color[v] === 1) continue;
      dag[u].add(v);
      if (color[v] === 0) dfs(v);
    }
    color[u] = 2;
  };
  for (let i = 0; i < N; i++) if (rawIn[i] === 0 && color[i] === 0) dfs(i);
  for (let i = 0; i < N; i++) if (color[i] === 0) dfs(i);

  const indeg = new Array<number>(N).fill(0);
  dag.forEach(s => s.forEach(v => indeg[v]++));
  const depth = new Array<number>(N).fill(0);
  const q: number[] = [];
  indeg.forEach((d, i) => {
    if (d === 0) q.push(i);
  });
  while (q.length) {
    const u = q.shift()!;
    dag[u].forEach(v => {
      depth[v] = Math.max(depth[v], depth[u] + 1);
      if (--indeg[v] === 0) q.push(v);
    });
  }
  for (let i = 0; i < N; i++) {
    if (rawIn[i] === 0 && dag[i].size) {
      depth[i] = Math.max(0, Math.min(...[...dag[i]].map(v => depth[v])) - 1);
    }
  }

  const maxD = Math.max(0, ...depth);
  const cols: number[][] = Array.from({ length: maxD + 1 }, () => []);
  depth.forEach((d, i) => cols[d].push(i));

  const pos = new Array<number>(N).fill(0);
  const refresh = () =>
    cols.forEach(col =>
      col.forEach((u, r) => {
        pos[u] = r;
      })
    );
  refresh();

  const pred: number[][] = auto.map(() => []);
  dag.forEach((s, u) => s.forEach(v => pred[v].push(u)));
  const bary = (list: number[], self: number) => (list.length ? list.reduce((s, x) => s + pos[x], 0) / list.length : pos[self]);
  for (let pass = 0; pass < 2; pass++) {
    cols.forEach(col => {
      col.sort((a, b) => bary(pred[a], a) - bary(pred[b], b));
    });
    refresh();
    for (let d = cols.length - 1; d >= 0; d--) {
      cols[d].sort((a, b) => bary([...dag[a]], a) - bary([...dag[b]], b));
    }
    refresh();
  }

  let x = 0;
  const GAPX = 120;
  const GAPY = 30;
  cols.forEach(col => {
    if (!col.length) return;
    const cw = Math.max(...col.map(u => auto[u].w));
    const total = col.reduce((s, u) => s + auto[u].h + GAPY, -GAPY);
    let y = -total / 2;
    col.forEach(u => {
      const c = auto[u];
      c.x = Math.round((x + cw / 2 + ox) / 10) * 10;
      c.y = Math.round((y + c.h / 2 + oy) / 10) * 10;
      y += c.h + GAPY;
    });
    x += cw + GAPX;
  });
}

export function lsLayout(auto: LogicComponent[], wires: Wire[], ox: number, oy: number): void {
  const hasGroups = auto.some(c => Boolean(c.groupId));
  if (!hasGroups) {
    lsLayoutSubgraph(auto, wires, ox, oy);
    return;
  }

  // Group-aware layout: lay out ungrouped nodes first, then pack each group cleanly in non-overlapping group islands
  const ungrouped = auto.filter(c => !c.groupId);
  const groups = new Map<string, LogicComponent[]>();
  for (const c of auto) {
    if (!c.groupId) continue;
    const arr = groups.get(c.groupId) || [];
    arr.push(c);
    groups.set(c.groupId, arr);
  }

  let cursorY = oy;
  if (ungrouped.length > 0) {
    lsLayoutSubgraph(ungrouped, wires, ox, cursorY);
    const minY = Math.min(...ungrouped.map(c => c.y - c.h / 2));
    const maxY = Math.max(...ungrouped.map(c => c.y + c.h / 2));
    const shiftY = cursorY - minY;
    if (Number.isFinite(shiftY)) ungrouped.forEach(c => { c.y = Math.round((c.y + shiftY) / 10) * 10; });
    cursorY += Math.max(120, maxY - minY) + 90;
  }

  for (const members of groups.values()) {
    lsLayoutSubgraph(members, wires, ox, 0);
    const minX = Math.min(...members.map(c => c.x - c.w / 2));
    const minY = Math.min(...members.map(c => c.y - c.h / 2));
    const maxY = Math.max(...members.map(c => c.y + c.h / 2));
    const dx = ox - minX;
    const dy = cursorY - minY;
    members.forEach(c => {
      c.x = Math.round((c.x + dx) / 10) * 10;
      c.y = Math.round((c.y + dy) / 10) * 10;
    });
    cursorY += Math.max(100, maxY - minY) + 90;
  }
}

export function compileLogicScript(
  src: string,
  existingComponents: LogicComponent[] = [],
  replace = true,
  customICs: CustomICDef[] = []
): LogicScriptBuildResult {
  const errors: LogicScriptDiagnostic[] = [];
  const warnings: string[] = [];
  const items: ScriptLine[] = [];
  const constEnv: Record<string, string> = {};

  src.split(/\r?\n/).forEach((rawLine, i) => {
    const t = rawLine.replace(/\s+(#|\/\/).*$/, m => (m.includes('"') ? m : '')).trim();
    if (!t || t.startsWith('#') || t.startsWith('//')) return;
    const mc = t.match(/^(?:const|define)\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
    if (mc) {
      constEnv[mc[1]] = mc[2].trim();
      return;
    }
    let resolved = t;
    for (const [k, v] of Object.entries(constEnv)) {
      resolved = resolved.replace(new RegExp(`\\$${k}\\b`, 'g'), v);
    }
    items.push({ t: resolved, n: i + 1, raw: rawLine });
  });

  const flat: ScriptLine[] = [];
  const macros = new Map<string, MacroDef>();
  lsExpandBlock(items, {}, macros, flat, errors);

  const places: PlaceCmd[] = [];
  const conns: ConnectCmd[] = [];
  flat.forEach(({ t, n, raw }) => {
    const left = t.match(/\{[^}]*\}/);
    if (left && !/"[^"]*\{/.test(t)) {
      errors.push({
        line: n,
        msg: `Variable o expresión sin resolver: ${left[0]}`,
        sourceLine: raw,
        suggestion: 'Define la variable con "let x = ..." o dentro de un bucle "for i in 0..N".'
      });
      return;
    }
    const r = lsParseLine(t, n, raw, errors);
    if (r) {
      if (r.kind === 'place') places.push(r);
      else conns.push(r);
    }
  });

  const validTypes = COMPONENT_CATALOG.filter(m => m.type !== 'CUSTOM_IC').map(m => m.type);
  const allTypeNames = [...validTypes, ...Object.keys(LS_TYPE_ALIASES)];
  const byAlias = new Map<string, LogicComponent>();
  const failedAliases = new Set<string>();
  const explicitSplitAliases = new Set<string>();
  const groupRegistry = new Map<string, { id: string; color: string }>();
  const GROUP_PALETTE = ['#00f5d4', '#38bdf8', '#a855f7', '#f59e0b', '#10b981', '#f43f5e'];
  const comps: LogicComponent[] = [];
  const validLedColors = new Set(['cyan', 'emerald', 'rose', 'amber', 'violet', 'blue']);
  let lastFixedX = 0;
  let lastFixedY = 0;

  for (const p of places) {
    if (byAlias.has(p.alias)) {
      errors.push({
        line: p.line,
        msg: `Alias repetido: "${p.alias}"`,
        sourceLine: p.raw,
        suggestion: 'Cada componente debe tener un alias único (ej. r0, r1).'
      });
      continue;
    }
    const type = LS_TYPE_ALIASES[p.type] || p.type;
    if (!validTypes.includes(type)) {
      failedAliases.add(p.alias);
      const sug = closestMatch(p.type, allTypeNames, 5);
      const resolvedSug = sug ? LS_TYPE_ALIASES[sug] || sug : null;
      errors.push({
        line: p.line,
        msg: `Tipo de componente desconocido: "${p.type}"`,
        sourceLine: p.raw,
        suggestion: resolvedSug
          ? `¿Quizás quisiste escribir "${resolvedSug}"?`
          : 'Pulsa "🤖 Prompt para IA" para ver el catálogo completo de tipos válidos.'
      });
      continue;
    }
    const o = p.opts;
    const co: Parameters<typeof createComponent>[3] = { customICs };
    let bad = false;
    const fail = (msg: string, suggestion?: string) => {
      errors.push({ line: p.line, msg, sourceLine: p.raw, suggestion });
      bad = true;
    };

    if (o.label !== undefined) co.label = o.label;
    if (o.text !== undefined) co.noteText = o.text;
    if (o.group !== undefined && o.group.trim()) {
      const gName = o.group.trim();
      let entry = groupRegistry.get(gName.toLowerCase());
      if (!entry) {
        const col = o.groupcolor || GROUP_PALETTE[groupRegistry.size % GROUP_PALETTE.length];
        entry = { id: genId('grp'), color: col };
        groupRegistry.set(gName.toLowerCase(), entry);
      }
      co.groupId = entry.id;
      co.groupName = gName;
      co.groupColor = o.groupcolor || entry.color;
    }
    if (o.color) {
      const k = o.color.toLowerCase();
      if (!validLedColors.has(k)) fail(`Color "${o.color}" no válido`, 'Colores permitidos: cyan, emerald, rose, amber, violet, blue');
      else co.color = k;
    }
    if (o.inputs) {
      const k = parseInt(o.inputs, 10);
      if (!(k >= 2 && k <= 4)) fail('inputs debe ser 2, 3 o 4');
      else co.inputCount = k;
    }
    if (o.bits) {
      const b = parseInt(o.bits, 10);
      if (!Number.isInteger(b) || b < 1 || b > 64) {
        fail('bits debe ser un entero entre 1 y 64', 'Ejemplos: bits=1, bits=6 (para coordenadas 0..63), bits=8, bits=16, bits=32, bits=64.');
      } else if (type === 'DIP_SWITCH' && (b < 4 || b > 16)) {
        fail('DIP_SWITCH admite bits entre 4 y 16');
      } else if ((type === 'SPLITTER' || type === 'MERGER') && b < 2) {
        fail(`${type} requiere al menos bits=2`);
      } else if (type === 'LED_BAR_8' && b !== 8 && b !== 16) {
        fail('LED_BAR_8 admite bits=8 o bits=16');
      } else if (type === 'BIN2BCD_N' && (b < 4 || b > 16)) {
        fail('BIN2BCD_N admite bits entre 4 y 16');
      } else {
        co.bits = b;
      }
    }
    if (o.addrbits) {
      const ab = parseInt(o.addrbits, 10);
      if (!(ab >= 4 && ab <= 16)) fail('addrBits debe estar entre 4 y 16');
      else co.addrBits = ab;
    }
    if (o.modbase || o.mod) {
      const mb = parseInt(o.modbase || o.mod, 10);
      if (!(mb >= 2 && mb <= 65535)) fail('mod/modBase debe estar entre 2 y 65535');
      else co.modBase = mb;
    }
    if (o.tag !== undefined) co.tunnelTag = o.tag;
    if (o.dir) {
      if (o.dir !== 'in' && o.dir !== 'out') fail('dir debe ser in u out');
      else co.tunnelDir = o.dir;
    }
    if (o.split) {
      const sNorm = o.split.trim().toLowerCase();
      if (sNorm === 'bits' || sNorm === '1bit' || sNorm === 'auto' || sNorm === '1') {
        const bw = Math.max(2, Math.min(64, co.bits ?? 8));
        co.splitWidths = new Array(bw).fill(1);
        explicitSplitAliases.add(p.alias);
      } else {
        const parts = o.split.split(',').map(x => parseInt(x.trim(), 10)).filter(x => x > 0);
        if (parts.length > 0) {
          co.splitWidths = parts;
          if (!o.bits) co.bits = Math.min(64, parts.reduce((a, c) => a + c, 0));
          explicitSplitAliases.add(p.alias);
        } else {
          fail('split inválido', 'Usa split=1,1,1,1 o split=8,8 o split=bits');
        }
      }
    }
    if (o.slice) {
      const sm = o.slice.match(/^(\d+)\s*[:,-]\s*(\d+)$/);
      if (sm) {
        const a = parseInt(sm[1], 10);
        const bv = parseInt(sm[2], 10);
        co.sliceHi = Math.max(a, bv);
        co.sliceLo = Math.min(a, bv);
      } else {
        fail('slice debe tener formato HI:LO (ej. slice=15:8)');
      }
    }
    if (o.signed) co.signedMode = o.signed === '1' || o.signed === 'true';
    if (o.hz) {
      const k = parseFloat(o.hz);
      if (!(k > 0 && k <= 100000)) fail('hz debe estar entre 0 y 100000');
      else co.freqHz = k;
    }
    const rawVal = o.value ?? o.val;
    if (rawVal !== undefined) {
      if (type === 'HEX_KEY' || type === 'HEX_KEY_N') co.hexVal = parseBigIntLiteral(rawVal);
      else if (type === 'CONST_N' || type === 'DIP_SWITCH' || type === 'NUM_STEPPER' || type === 'SLIDER_ADC' || type === 'ROTARY_ENC') {
        co.initialValue = parseBigIntLiteral(rawVal);
      } else {
        co.initialValue = rawVal === '1' ? 1 : 0;
      }
    }
    if (o.seq) {
      if (!/^[01]{1,8}$/.test(o.seq)) fail('seq debe ser de 1 a 8 bits (ej. 10110010)');
      else co.seqBits = o.seq.split('').map(Number);
    }
    if (o.probe) co.probe = o.probe === '1' || o.probe === 'true';

    let mem: Array<number | bigint> | null = null;
    let fsm: { n: number; next0: number[]; next1: number[]; out: number[] } | null = null;

    if (o.mem !== undefined) {
      if (type === 'RAM_16X4' || type === 'ROM_16X4') {
        const hex = o.mem.replace(/[^0-9a-fA-F]/g, '');
        mem = Array.from({ length: 16 }, (_, i) => parseInt(hex[i] || '0', 16) & 15);
      } else if (type === 'RAM_N' || type === 'ROM_N' || type === 'DUAL_RAM_N') {
        const size = 1 << Math.max(4, Math.min(16, co.addrBits || 8));
        mem = parseMemTokens(o.mem, size);
      } else {
        fail('mem solo se admite en RAM_16X4, ROM_16X4, RAM_N, ROM_N y DUAL_RAM_N');
      }
    }

    if (o.fsm !== undefined) {
      if (type !== 'FSM') fail('fsm solo existe en el tipo FSM');
      else {
        const parts = o.fsm.split(';');
        const n = parseInt(parts[0], 10);
        const arr = (k: number) => (parts[k] || '').split(',').map(v => parseInt(v, 10));
        const n0 = arr(1);
        const n1 = arr(2);
        const ou = arr(3);
        if (
          !(n >= 2 && n <= 8) ||
          [n0, n1, ou].some(a => a.length !== n || a.some(v => isNaN(v))) ||
          n0.concat(n1).some(v => v < 0 || v >= n)
        ) {
          fail('fsm debe ser N;next0;next1;out con N de 2 a 8');
        } else {
          fsm = { n, next0: n0, next1: n1, out: ou.map(v => (v ? 1 : 0)) };
        }
      }
    }

    if (bad) {
      failedAliases.add(p.alias);
      continue;
    }
    let px = 0;
    let py = 0;
    if (p.at) {
      px = p.at.relX ? lastFixedX + p.at.x : p.at.x;
      py = p.at.relY ? lastFixedY + p.at.y : p.at.y;
      lastFixedX = px;
      lastFixedY = py;
    }
    const comp = createComponent(type, px, py, co);
    if (mem) comp.internalState.mem = mem;
    if (fsm) comp.internalState.fsm = fsm;
    if (o.rot) comp.rot = ((parseInt(o.rot, 10) || 0) % 4 + 4) % 4;
    if (o.flip === '1' || o.flip === 'true') comp.flip = true;
    comp._fixed = Boolean(p.at);
    byAlias.set(p.alias, comp);
    comps.push(comp);
  }

  const newWires: Wire[] = [];
  const seen = new Set<string>();
  const driven = new Map<string, LogicComponent>();
  const aliasList = Array.from(byAlias.keys());
  const reportedFailedConns = new Set<string>();

  const pinOf = (alias: string, pin: string, line: number, raw: string) => {
    const comp = byAlias.get(alias);
    if (!comp) {
      if (failedAliases.has(alias)) {
        if (!reportedFailedConns.has(alias)) {
          reportedFailedConns.add(alias);
          warnings.push(`Conexiones hacia "${alias}" omitidas hasta corregir su declaración "place".`);
        }
        return null;
      }
      const sug = closestMatch(alias, aliasList, 4);
      errors.push({
        line,
        msg: `Alias desconocido: "${alias}"`,
        sourceLine: raw,
        suggestion: sug ? `¿Quizás quisiste decir "${sug}"?` : 'Declara este alias antes con: place ' + alias + ' = TIPO'
      });
      return null;
    }
    let p = comp.pins.find(q => q.id.toLowerCase() === pin.toLowerCase());
    // Smart auto-expand SPLITTER / MERGER without explicit split= when connecting per-bit pK
    if (!p && (comp.type === 'SPLITTER' || comp.type === 'MERGER') && !explicitSplitAliases.has(alias)) {
      const pm = pin.match(/^p(\d+)$/i);
      const b = Math.max(2, Math.min(64, comp.bits || 8));
      if (pm && Number(pm[1]) < b) {
        comp.splitWidths = new Array(b).fill(1);
        syncComponentPins(comp, customICs);
        explicitSplitAliases.add(alias);
        p = comp.pins.find(q => q.id.toLowerCase() === pin.toLowerCase());
      }
    }
    if (!p) {
      const pinIds = comp.pins.map(q => q.id);
      const sug = closestMatch(pin, pinIds, 4);
      const splitHint =
        (comp.type === 'SPLITTER' || comp.type === 'MERGER')
          ? ' En SPLITTER/MERGER >8b especifica split=1,1,... (o split=bits) si quieres pines de 1 bit.'
          : '';
      errors.push({
        line,
        msg: `"${alias}" (${comp.type}) no tiene el pin "${pin}".`,
        sourceLine: raw,
        suggestion: `${sug ? `¿Quizás "${sug}"? ` : ''}Pines válidos: ${pinIds.join(', ')}.${splitHint}`
      });
      return null;
    }
    return { comp, p };
  };

  for (const c of conns) {
    if (c.froms.length > 1) {
      // Pairwise zipped range connect
      for (let k = 0; k < c.froms.length; k++) {
        const A = pinOf(c.froms[k].alias, c.froms[k].pin, c.line, c.raw);
        const B = pinOf(c.tos[k].alias, c.tos[k].pin, c.line, c.raw);
        if (!A || !B) continue;
        let f = A;
        let t = B;
        if (f.p.dir === 'in' && t.p.dir === 'out') {
          f = B;
          t = A;
        }
        if (f.p.dir !== 'out' || t.p.dir !== 'in') {
          errors.push({
            line: c.line,
            msg: `Un cable debe unir salida con entrada: ${c.froms[k].alias}.${c.froms[k].pin} -> ${c.tos[k].alias}.${c.tos[k].pin}`,
            sourceLine: c.raw
          });
          continue;
        }
        const key = `${f.comp.id}.${f.p.id}>${t.comp.id}.${t.p.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const dk = `${t.comp.id}.${t.p.id}`;
        if (driven.has(dk) && f.comp.type !== 'TRI_BUFFER' && driven.get(dk)!.type !== 'TRI_BUFFER') {
          warnings.push(`Línea ${c.line}: el pin ${c.tos[k].alias}.${c.tos[k].pin} recibe más de un cable`);
        }
        driven.set(dk, f.comp);
        newWires.push({
          id: genId('w'),
          fromCompId: f.comp.id,
          fromPinId: f.p.id,
          toCompId: t.comp.id,
          toPinId: t.p.id,
          signal: 0,
          width: f.p.width || 1
        });
      }
      continue;
    }

    const A = pinOf(c.froms[0].alias, c.froms[0].pin, c.line, c.raw);
    for (const to of c.tos) {
      const B = pinOf(to.alias, to.pin, c.line, c.raw);
      if (!A || !B) continue;
      let f = A;
      let t = B;
      if (f.p.dir === 'in' && t.p.dir === 'out') {
        f = B;
        t = A;
      }
      if (f.p.dir !== 'out' || t.p.dir !== 'in') {
        errors.push({
          line: c.line,
          msg: `Un cable debe unir salida con entrada: ${c.froms[0].alias}.${c.froms[0].pin} -> ${to.alias}.${to.pin}`,
          sourceLine: c.raw,
          suggestion: `Dirección actual: ${A.p.dir.toUpperCase()} -> ${B.p.dir.toUpperCase()}`
        });
        continue;
      }
      const key = `${f.comp.id}.${f.p.id}>${t.comp.id}.${t.p.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const dk = `${t.comp.id}.${t.p.id}`;
      if (driven.has(dk) && f.comp.type !== 'TRI_BUFFER' && driven.get(dk)!.type !== 'TRI_BUFFER') {
        warnings.push(`Línea ${c.line}: el pin ${to.alias}.${to.pin} recibe más de un cable`);
      }
      if ((f.p.width || 1) !== (t.p.width || 1) && (f.p.width || 1) !== 1 && (t.p.width || 1) !== 1) {
        warnings.push(`Línea ${c.line}: ancho distinto ${c.froms[0].alias}.${c.froms[0].pin}(${f.p.width || 1}b) → ${to.alias}.${to.pin}(${t.p.width || 1}b)`);
      }
      driven.set(dk, f.comp);
      newWires.push({
        id: genId('w'),
        fromCompId: f.comp.id,
        fromPinId: f.p.id,
        toCompId: t.comp.id,
        toPinId: t.p.id,
        signal: 0,
        width: f.p.width || 1
      });
    }
  }

  if (errors.length) return { errors, warnings };
  if (!comps.length) {
    return {
      errors: [{ line: 1, msg: 'El script no crea ningún componente (usa "place alias = TIPO")' }],
      warnings
    };
  }

  const auto = comps.filter(c => !c._fixed);
  let ox = 0;
  if (!replace && existingComponents.length) {
    ox = Math.max(...existingComponents.map(c => c.x + c.w / 2)) + 160;
  }
  if (auto.length) lsLayout(auto, newWires, ox, 0);
  comps.forEach(c => {
    delete c._fixed;
  });

  for (let k = 0; k < 3; k++) evaluateCircuitDeterministic(comps, newWires, 0, 2, customICs);

  return {
    errors: [],
    warnings,
    comps: comps.length,
    wires: newWires.length,
    components: comps,
    wireList: newWires
  };
}

export function formatLogicScriptDiagnosticsForAI(
  script: string,
  errors: LogicScriptDiagnostic[],
  warnings: string[] = [],
  includeFullScript = false
): string {
  const lines = script.split(/\r?\n/);
  const out: string[] = [
    'Necesito corregir un error en mi script de LogicScript v2 (simulador LogicStudio Pro Beta 0.4).',
    ''
  ];
  if (errors.length) {
    out.push('### Errores detectados:');
    errors.forEach((e, idx) => {
      const code = e.sourceLine ?? lines[e.line - 1] ?? '';
      out.push(`${idx + 1}. **Línea ${e.line}**: ${e.msg}`);
      if (code.trim()) out.push(`   - Código: \`${code.trim()}\``);
      if (e.suggestion) out.push(`   - Pista: ${e.suggestion}`);
    });
  }
  if (warnings.length) {
    out.push('', '### Advertencias:');
    warnings.slice(0, 8).forEach(w => out.push(`- ${w}`));
  }
  if (includeFullScript) {
    out.push('', '### Script completo actual:', '```logicscript', script.trim(), '```');
  }
  out.push('', 'Recuerda: bits acepta 1..64, usa split=bits o split=1,1,... en SPLITTER/MERGER >8b si necesitas pines de 1 bit, y cierra bucles con `end` o `endfor`. Devuelve únicamente el bloque ```logicscript corregido.');
  return out.join('\n');
}

export function exportCircuitToLogicScript(components: LogicComponent[], wires: Wire[]): string {
  const used = new Set<string>();
  const alias = new Map<string, string>();
  components.forEach(c => {
    if (c.type === 'CUSTOM_IC') return;
    let base = (c.label || '').replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || c.type.toLowerCase();
    if (!/^[A-Za-z_]/.test(base)) base = 'c_' + base;
    let a = base;
    let k = 1;
    while (used.has(a.toLowerCase())) a = base + '_' + ++k;
    used.add(a.toLowerCase());
    alias.set(c.id, a);
  });

  const lines = ['# LogicScript exportado desde LogicStudio Pro Beta 0.4', ''];
  const colorTypes = new Set(['LED', 'SEG7_DISPLAY', 'SEG7_MULTI', 'HEX_DISPLAY', 'HEX_DISPLAY_N', 'DEC_DISPLAY_N', 'LED_BAR_4', 'LED_BAR_8', 'LCD_TEXT']);
  components.forEach(c => {
    if (c.type === 'CUSTOM_IC') {
      lines.push(`# (IC personalizado "${c.label || 'IC'}" no se puede exportar)`);
      return;
    }
    const meta = COMPONENT_CATALOG.find(m => m.type === c.type);
    const q = (s: string) => `"${String(s).replace(/"/g, "'")}"`;
    const parts: string[] = [];
    if (c.label) parts.push(`label=${q(c.label)}`);
    if (c.groupName) parts.push(`group=${q(c.groupName)}`);
    if (c.type === 'LABEL') parts.push(`text=${q(c.noteText || '')}`);
    if (c.bits && meta?.scalableBits && c.bits !== (meta.defaultBits ?? 1)) parts.push(`bits=${c.bits}`);
    if ((c.type === 'RAM_N' || c.type === 'ROM_N' || c.type === 'DUAL_RAM_N') && c.addrBits && c.addrBits !== 8) parts.push(`addrBits=${c.addrBits}`);
    if ((c.type === 'MOD_COUNTER_N' || c.type === 'WATCHDOG_N') && c.modBase) parts.push(`modBase=${c.modBase}`);
    if (c.type === 'TUNNEL') {
      parts.push(`tag=${q(c.tunnelTag || 'SIG')}`);
      parts.push(`dir=${c.tunnelDir || 'out'}`);
    }
    if ((c.type === 'SPLITTER' || c.type === 'MERGER') && c.splitWidths) {
      parts.push(`split=${getSplitterChunks(c).join(',')}`);
    }
    if (c.type === 'BUS_SLICE') {
      parts.push(`slice=${c.sliceHi ?? Math.min((c.bits || 16) - 1, 7)}:${c.sliceLo ?? 0}`);
    }
    if (c.signedMode) parts.push('signed=1');
    if (colorTypes.has(c.type) && c.color && c.color !== 'cyan') parts.push(`color=${c.color}`);
    if (meta?.variableInputs && c.inputCount !== 2) parts.push(`inputs=${c.inputCount}`);
    if (c.type === 'CLOCK' && c.freqHz !== null && c.freqHz !== undefined) parts.push(`hz=${c.freqHz}`);
    if (c.type === 'SWITCH' && c.internalState.value === 1) parts.push('value=1');
    if (c.type === 'CONST_N' || c.type === 'DIP_SWITCH' || c.type === 'NUM_STEPPER') {
      parts.push(`value=0x${BigInt(c.internalState.value || 0).toString(16)}`);
    }
    if (c.type === 'SLIDER_ADC' && c.internalState.adcVal !== undefined) {
      parts.push(`value=0x${BigInt(c.internalState.adcVal).toString(16)}`);
    }
    if (c.type === 'ROTARY_ENC' && c.internalState.encPos !== undefined) {
      parts.push(`value=0x${BigInt(c.internalState.encPos).toString(16)}`);
    }
    if (c.type === 'HEX_KEY' || c.type === 'HEX_KEY_N') parts.push(`value=0x${BigInt(c.internalState.hexVal || 0).toString(16)}`);
    if (c.type === 'PULSE_GEN') parts.push(`seq=${(c.internalState.seqBits || []).join('')}`);
    if ((c.type === 'RAM_16X4' || c.type === 'ROM_16X4') && c.internalState.mem) {
      parts.push(`mem=${c.internalState.mem.map(v => (Number(v) & 15).toString(16).toUpperCase()).join('')}`);
    }
    if ((c.type === 'RAM_N' || c.type === 'ROM_N' || c.type === 'DUAL_RAM_N') && c.internalState.mem) {
      const mem = c.internalState.mem;
      let lastNonZero = -1;
      for (let i = mem.length - 1; i >= 0; i--) {
        if (BigInt(mem[i] || 0) !== 0n) {
          lastNonZero = i;
          break;
        }
      }
      if (lastNonZero >= 0) {
        parts.push(`mem=${mem.slice(0, lastNonZero + 1).map(v => '0x' + BigInt(v || 0).toString(16)).join(',')}`);
      }
    }
    if (c.type === 'FSM' && c.internalState.fsm) {
      const f = c.internalState.fsm;
      parts.push(`fsm=${f.n};${f.next0.join(',')};${f.next1.join(',')};${f.out.join(',')}`);
    }
    if (c.rot) parts.push(`rot=${c.rot}`);
    if (c.flip) parts.push('flip=1');
    if (c.probe) parts.push('probe=1');
    lines.push(`place ${alias.get(c.id)} = ${c.type}${parts.length ? ' ' + parts.join(' ') : ''} at ${c.x},${c.y}`);
  });

  lines.push('');
  const groups = new Map<string, { from: string; to: string[] }>();
  wires.forEach(w => {
    if (!alias.has(w.fromCompId) || !alias.has(w.toCompId)) return;
    const k = `${w.fromCompId}|${w.fromPinId}`;
    if (!groups.has(k)) groups.set(k, { from: `${alias.get(w.fromCompId)}.${w.fromPinId}`, to: [] });
    groups.get(k)!.to.push(`${alias.get(w.toCompId)}.${w.toPinId}`);
  });
  groups.forEach(g => lines.push(`connect ${g.from} -> ${g.to.join(', ')}`));
  return lines.join('\n');
}

export function generateLogicScriptAIPrompt(): string {
  const F = '```';
  const catalogLines = COMPONENT_CATALOG.filter(m => m.type !== 'CUSTOM_IC')
    .map(m => {
      const c = createComponent(m.type, 0, 0, { noAnim: true });
      const ins = c.pins.filter(p => p.dir === 'in').map(p => `${p.id}${p.width && p.width > 1 ? `(${p.width}b)` : ''}`).join(' ');
      const outs = c.pins.filter(p => p.dir === 'out').map(p => `${p.id}${p.width && p.width > 1 ? `(${p.width}b)` : ''}`).join(' ');
      const flags = [
        m.scalableBits ? `bits=1..64 (def ${m.defaultBits || 1})` : '',
        m.variableInputs ? 'inputs=2..4' : ''
      ]
        .filter(Boolean)
        .join(' | ');
      return `- ${m.type} (${m.name}) | IN: ${ins || '—'} | OUT: ${outs || '—'}${flags ? ' | ' + flags : ''}`;
    })
    .join('\n');

  return [
    'Eres un ingeniero experto en arquitectura de computadores y diseño digital para el simulador "LogicStudio Pro Beta 0.4".',
    'Tu tarea es transformar la petición del usuario en un circuito completo, limpio y 100% válido en LogicScript v2.',
    '',
    '## REGLAS CRÍTICAS DE VALIDACIÓN (NO COMETAS ESTOS ERRORES)',
    '1. **Ancho de bits (`bits=1..64`)**: Cualquier entero de `1` a `64` es válido en bloques escalables (`CONST_N`, `COUNTER_N`, `MOD_COUNTER_N`, `ADDER_N`, `ALU_N`, `COMP_N`, `SPLITTER`, `MERGER`, `RAM_N`, `ROM_N`, `TUNNEL`, etc.). Ej: `bits=6` es válido para coordenadas `0..63` de VGA. Límites especiales: `DIP_SWITCH` (`4..16`), `LED_BAR_8` (`8` o `16`), `BIN2BCD_N` (`4..16`), `SPLITTER`/`MERGER` (`2..64`).',
    '2. **SPLITTER y MERGER (`p0..pN`)**:',
    '   - Si `bits <= 8` y omites `split=`, divide automáticamente bit a bit (`p0..p{bits-1}` de 1b cada uno).',
    '   - Si `bits > 8` y omites `split=`, divide en bytes/palabras (`16b -> 8,8`; `32b -> 8,8,8,8`; `64b -> 16,16,16,16`). Si quieres pines de 1 bit en buses >8b, escribe explícitamente `split=bits` o `split=1,1,1,...`.',
    '   - En `SPLITTER`: entrada `bus` -> salidas `p0, p1, ...`. En `MERGER`: entradas `p0, p1, ...` -> salida `bus`. ¡Nunca uses `in0` ni `out` en SPLITTER/MERGER!',
    '3. **Nombres exactos de pines frecuentes** (respeta mayúsculas/minúsculas y nombres):',
    '   - `SWITCH` / `BUTTON` / `CLOCK` / `HIGH` / `LOW` / `CONST_N` / `NUM_STEPPER`: salida `out`. (`DIP_SWITCH`: salida `bus`).',
    '   - `COUNTER_N`: IN `clk, en, up, ld, rst, d` -> OUT `q, co`. (**OJO**: es `ld`, NO `load`).',
    '   - `MOD_COUNTER_N`: IN `clk, en, mod, rst` -> OUT `q, wrap`.',
    '   - `REG_N`: IN `clk, en, rst, d` -> OUT `q`.',
    '   - `RAM_N`: IN `addr, din, we, clk` -> OUT `dout`. `ROM_N`: IN `addr` -> OUT `dout`.',
    '   - `ALU_N`: IN `a, b, op(4b)` -> OUT `out, z, c, n, v` (op: `0=ADD, 1=SUB, 2=AND, 3=OR, 4=XOR, 5=SHL, 6=SHR, 7=MUL, 8=NOT A, 9=INC A, 10=DEC A, 11=CMP A-B, 12=NAND, 13=NOR, 14=ROR, 15=PASS B`).',
    '   - `COMP_N`: IN `a, b` -> OUT `eq, gt, lt`.',
    '   - `VGA_SCREEN`: IN `px(6b), py(6b), col(8b), we, clk, swap, clr`. (Resolución fija `64×48`, color RGB332).',
    '   - `RAYCAST_CORE`: IN `clk, rst, pad(5b), mdat(8b)` -> OUT `maddr(8b), px(6b), py(6b), col(8b), we, swap, kills(8b)`.',
    '   - `LCD_TEXT`: IN `char(8b), col(4b), row, we, clk, clr` (2 filas × 16 cols ASCII).',
    '   - `TEXT_CONSOLE`: IN `char(8b), we, clk, clr`.',
    '   - `TONE_GEN`: IN `freq(12b), wave(2b), gate` (ondas: `0=Cuadrada, 1=Sierra, 2=Triángulo, 3=Senoidal`).',
    '   - `GAMEPAD`: OUT `w, s, a, d, fire, pad(5b)`.',
    '4. **Dirección de `connect`**: siempre `connect ORIGEN.pin -> DESTINO.pin` (salida hacia entrada; admite lista separada por comas y rangos `a.p0..p3 -> b.d0..d3`). Nunca conectes dos salidas juntas salvo `TRI_BUFFER`.',
    '5. **Coordenadas `at`**:',
    '   - Absolutas: `at -400,120` (admite enteros positivos o negativos).',
    '   - Relativas al bloque anterior: usa `+` o `~`, ej: `at +140,+0` o `at ~-120,~80`. **Nunca** pongas `at -120,+40` esperando desplazamiento X negativo; escribe `at ~-120,~40`.',
    '   - También puedes omitir `at ...` en todo el script y el simulador auto-ordenará por columnas DAG respetando `group="..."`.',
    '6. **Bucles, macros y agrupación**:',
    '   - Bucles: `for i in 0..7 ... end` (también acepta `endfor`). Expresiones con `{i}`, `{i*40}`, `{100+i*60}`.',
    '   - Macros: `macro nombre(p1, p2) ... endmacro` + `call nombre(a1, a2)`.',
    '   - Agrupación visual: añade `group="Nombre del Módulo"` en `place` para encerrar subsistemas en marcos coloreados.',
    '',
    '## CODIFICACIONES DE DATOS Y MEMORIA',
    '- **RGB332 (`VGA_SCREEN`)**: `col = (R3 << 5) | (G3 << 2) | B2` (`R:0..7, G:0..7, B:0..3`). Ej: Rojo=`0xE0`, Naranja=`0xF0`, Amarillo=`0xFC`, Verde=`0x1C`, Cian=`0x1F`, Azul=`0x03`, Magenta=`0xE3`, Blanco=`0xFF`, Negro=`0x00`.',
    '- **Mapa DOOM 16×16 (`ROM_N addrBits=8 bits=8` -> `RAYCAST_CORE`)**: `addr = y*16 + x`. Valores: `0x00`=Pasillo libre, `0x01`=Ladrillo rojo, `0x02`=Piedra azul, `0x03`=Portal verde, `0x04`=Metal dorado. ¡Deja espacio libre alrededor de `(2,2)` donde aparece el jugador!',
    '- **Partitura `TONE_GEN` en ROM 16b**: palabra `w = (gate << 14) | (wave << 12) | freqHz`. Ej: La4 (440Hz, cuadrada, gate=1) = `(1<<14)|440 = 0x41B8`; Silencio = `0x0000`.',
    '- **Texto ASCII en `ROM_N`**: `mem="HOLA MUNDO!"` o `mem=0x48,0x4F,0x4C,0x41,0x00*4`.',
    '',
    '## CATÁLOGO COMPLETO DE COMPONENTES Y PINES',
    catalogLines,
    '',
    '## FORMATO DE RESPUESTA',
    `Devuelve UN único bloque ${F}logicscript válido y compilable sin comentarios fuera de sintaxis y debajo una explicación breve (máx 6 líneas).`,
    '',
    '## EJEMPLO LOGICSCRIPT V2',
    `${F}logicscript`,
    LS_EXAMPLES['Macro + Bucle + Consola ASCII (LogicScript v2)'],
    F,
    '',
    '## PETICIÓN DEL USUARIO',
    '(escribe aquí tu circuito)'
  ].join('\n');
}
