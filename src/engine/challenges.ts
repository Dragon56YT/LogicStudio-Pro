import { evaluateCircuitDeterministic } from './simulator';
import { CustomICDef, LogicComponent, Wire } from './types';

export interface ChallengeStep {
  set?: Record<string, number>;
  pulse?: boolean;
  expect: Record<string, number>;
}

export interface ChallengeDef {
  id: string;
  group: string;
  level: number;
  title: string;
  desc: string;
  inputs: string[];
  outputs: string[];
  fn?: (bits: number[]) => Array<number | null>;
  steps?: ChallengeStep[];
}

export interface ChallengeRowResult {
  label: string;
  exp: string;
  got: string;
  ok: boolean;
}

export interface ChallengeValidationResult {
  ok: boolean;
  missing: string[];
  rows: ChallengeRowResult[];
}

const xorN = (a: number[]) => a.reduce((x, y) => x ^ y, 0);
const COMB = 'Combinacionales';
const SEQG = 'Secuenciales (con reloj)';

const cc = (
  id: string,
  level: number,
  title: string,
  desc: string,
  inputs: string[],
  outputs: string[],
  fn: (bits: number[]) => Array<number | null>
): ChallengeDef => ({ id, group: COMB, level, title, desc, inputs, outputs, fn });

const sq = (
  id: string,
  level: number,
  title: string,
  desc: string,
  inputs: string[],
  outputs: string[],
  steps: ChallengeStep[]
): ChallengeDef => ({ id, group: SEQG, level, title, desc, inputs, outputs, steps });

export const CHALLENGES: ChallengeDef[] = [
  cc('xor', 1, 'Puerta XOR a mano', 'Y vale 1 solo cuando A y B son distintas. Reto extra: constrúyelo solo con AND, OR y NOT.', ['A', 'B'], ['Y'], ([a, b]) => [a ^ b]),
  cc('aboc', 1, 'Función A·B + C', 'Y = (A AND B) OR C.', ['A', 'B', 'C'], ['Y'], ([a, b, c]) => [(a & b) | c]),
  cc('ha', 1, 'Semisumador', 'Suma dos bits: S es la suma y C el acarreo.', ['A', 'B'], ['S', 'C'], ([a, b]) => [a ^ b, a & b]),
  cc('hs', 1, 'Semirrestador', 'Calcula A − B con un bit: D es la diferencia y BOR el préstamo (1 si A=0 y B=1).', ['A', 'B'], ['D', 'BOR'], ([a, b]) => [a ^ b, (1 - a) & b]),
  cc('alarm', 1, 'Alarma del coche', 'Suena (Y) si la llave está puesta (K) y además hay una puerta abierta (D) o el cinturón NO está abrochado (C=0).', ['D', 'K', 'C'], ['Y'], ([d, k, c]) => [k & (d | (1 - c))]),
  cc('maj', 2, 'Mayoría de 3', 'Y vale 1 cuando al menos dos de las tres entradas valen 1.', ['A', 'B', 'C'], ['Y'], ([a, b, c]) => [(a + b + c) >= 2 ? 1 : 0]),
  cc('fa', 2, 'Sumador completo', 'Suma A + B + CIN. S es la suma y COUT el acarreo de salida.', ['A', 'B', 'CIN'], ['S', 'COUT'], ([a, b, c]) => [a ^ b ^ c, (a + b + c) >= 2 ? 1 : 0]),
  cc('fs', 2, 'Restador completo', 'Calcula A − B − BIN. D es la diferencia y BOUT el préstamo de salida.', ['A', 'B', 'BIN'], ['D', 'BOUT'], ([a, b, c]) => [a ^ b ^ c, a < b + c ? 1 : 0]),
  cc('mux', 2, 'Multiplexor 2:1', 'Si S=0 la salida Y copia A; si S=1 copia B.', ['A', 'B', 'S'], ['Y'], ([a, b, s]) => [s ? b : a]),
  cc('par', 2, 'Paridad impar de 4 bits', 'P vale 1 si hay un número impar de unos entre D3..D0.', ['D3', 'D2', 'D1', 'D0'], ['P'], d => [xorN(d)]),
  cc('dec', 2, 'Decodificador 2→4', 'Activa solo la salida Yn, donde n es el número binario A1A0.', ['A1', 'A0'], ['Y3', 'Y2', 'Y1', 'Y0'], ([a1, a0]) => { const n = a1 * 2 + a0; return [n === 3 ? 1 : 0, n === 2 ? 1 : 0, n === 1 ? 1 : 0, n === 0 ? 1 : 0]; }),
  cc('gt2', 2, 'Comparador mayor que (2 bits)', 'G vale 1 si el número A1A0 es mayor que B1B0.', ['A1', 'A0', 'B1', 'B0'], ['G'], ([a1, a0, b1, b0]) => [(a1 * 2 + a0) > (b1 * 2 + b0) ? 1 : 0]),
  cc('eq2', 3, 'Comparador de igualdad (2 bits)', 'Y vale 1 si el número A1A0 es igual a B1B0.', ['A1', 'A0', 'B1', 'B0'], ['Y'], ([a1, a0, b1, b0]) => [(a1 === b1 && a0 === b0) ? 1 : 0]),
  cc('gray', 3, 'Binario a Gray (3 bits)', 'Convierte B2B1B0 a código Gray G2G1G0.', ['B2', 'B1', 'B0'], ['G2', 'G1', 'G0'], ([b2, b1, b0]) => [b2, b2 ^ b1, b1 ^ b0]),
  cc('g2b', 3, 'Gray a binario (3 bits)', 'Convierte G2G1G0 (Gray) a binario B2B1B0.', ['G2', 'G1', 'G0'], ['B2', 'B1', 'B0'], ([g2, g1, g0]) => [g2, g2 ^ g1, g2 ^ g1 ^ g0]),
  cc('add2', 3, 'Sumador de 2 bits', 'Suma A1A0 + B1B0. El resultado son 3 bits S2S1S0.', ['A1', 'A0', 'B1', 'B0'], ['S2', 'S1', 'S0'], ([a1, a0, b1, b0]) => { const s = (a1 * 2 + a0) + (b1 * 2 + b0); return [(s >> 2) & 1, (s >> 1) & 1, s & 1]; }),
  cc('mul2', 3, 'Multiplicador 2×2', 'Multiplica A1A0 × B1B0. El producto son 4 bits P3P2P1P0.', ['A1', 'A0', 'B1', 'B0'], ['P3', 'P2', 'P1', 'P0'], ([a1, a0, b1, b0]) => { const p = (a1 * 2 + a0) * (b1 * 2 + b0); return [(p >> 3) & 1, (p >> 2) & 1, (p >> 1) & 1, p & 1]; }),
  cc('prio', 3, 'Codificador de prioridad 4→2', 'Y1Y0 es el índice de la entrada más alta que vale 1 (I3 manda más que I0). V vale 1 si hay alguna entrada activa.', ['I3', 'I2', 'I1', 'I0'], ['Y1', 'Y0', 'V'], ([i3, i2, i1, i0]) => { const n = i3 ? 3 : i2 ? 2 : i1 ? 1 : 0; return [(n >> 1) & 1, n & 1, i3 | i2 | i1 | i0]; }),
  cc('bcd', 3, 'Detector de BCD inválido', 'E vale 1 si el número D3D2D1D0 es mayor que 9 (no es un dígito BCD válido).', ['D3', 'D2', 'D1', 'D0'], ['E'], ([d3, d2, d1, d0]) => [(d3 * 8 + d2 * 4 + d1 * 2 + d0) > 9 ? 1 : 0]),
  cc('sega', 3, 'Segmento "a" de un display', 'A vale 1 en los dígitos 0,2,3,5,6,7,8,9. Para valores 10-15 da igual lo que salga.', ['D3', 'D2', 'D1', 'D0'], ['A'], ([d3, d2, d1, d0]) => { const n = d3 * 8 + d2 * 4 + d1 * 2 + d0; return [n > 9 ? null : ([0, 2, 3, 5, 6, 7, 8, 9].includes(n) ? 1 : 0)]; }),
  cc('mux4', 3, 'Multiplexor 4:1', 'Y copia la entrada Dn, donde n es el número binario S1S0.', ['D3', 'D2', 'D1', 'D0', 'S1', 'S0'], ['Y'], ([d3, d2, d1, d0, s1, s0]) => [[d0, d1, d2, d3][s1 * 2 + s0]]),
  sq('sq_sr', 2, 'Latch SR con puertas', 'Construye una memoria de 1 bit con puertas NOR: S pone Q a 1, R lo pone a 0 y sin ninguna de las dos Q se mantiene.', ['S', 'R'], ['Q'], [
    { set: { S: 1, R: 0 }, expect: { Q: 1 } }, { set: { S: 0, R: 0 }, expect: { Q: 1 } }, { set: { S: 0, R: 1 }, expect: { Q: 0 } }, { set: { S: 0, R: 0 }, expect: { Q: 0 } }, { set: { S: 1, R: 0 }, expect: { Q: 1 } }]),
  sq('sq_d', 2, 'Registro de 1 bit', 'Q copia a D solo en el flanco de subida de CLK; entre pulsos mantiene su valor.', ['D', 'CLK'], ['Q'], [
    { set: { D: 1 }, pulse: true, expect: { Q: 1 } }, { set: { D: 0 }, expect: { Q: 1 } }, { set: { D: 0 }, pulse: true, expect: { Q: 0 } }, { set: { D: 1 }, pulse: true, expect: { Q: 1 } }]),
  sq('sq_t', 2, 'Divisor de frecuencia ÷2', 'Q cambia de valor en cada pulso de CLK (empieza en 0).', ['CLK'], ['Q'], [
    { pulse: true, expect: { Q: 1 } }, { pulse: true, expect: { Q: 0 } }, { pulse: true, expect: { Q: 1 } }, { pulse: true, expect: { Q: 0 } }]),
  sq('sq_cnt', 3, 'Contador de 2 bits', 'Cuenta 0,1,2,3,0… en cada pulso de CLK. RST=1 lo pone a 0.', ['CLK', 'RST'], ['Q1', 'Q0'], [
    { set: { RST: 1 }, expect: { Q1: 0, Q0: 0 } }, { set: { RST: 0 }, pulse: true, expect: { Q1: 0, Q0: 1 } }, { pulse: true, expect: { Q1: 1, Q0: 0 } }, { pulse: true, expect: { Q1: 1, Q0: 1 } }, { pulse: true, expect: { Q1: 0, Q0: 0 } }]),
  sq('sq_shift', 3, 'Registro de desplazamiento de 3 bits', 'En cada pulso de CLK, D entra por Q0 y los bits se desplazan hacia Q2.', ['D', 'CLK'], ['Q2', 'Q1', 'Q0'], [
    { set: { D: 1 }, pulse: true, expect: { Q2: 0, Q1: 0, Q0: 1 } }, { set: { D: 0 }, pulse: true, expect: { Q2: 0, Q1: 1, Q0: 0 } }, { set: { D: 1 }, pulse: true, expect: { Q2: 1, Q1: 0, Q0: 1 } }, { set: { D: 0 }, pulse: true, expect: { Q2: 0, Q1: 1, Q0: 0 } }]),
  sq('sq_seq', 3, 'Detector de secuencia 101', 'Con el bit X en cada pulso de CLK, Z vale 1 justo cuando los tres últimos bits recibidos han sido 1, 0, 1 (se permite solapamiento).', ['X', 'CLK'], ['Z'], [
    { set: { X: 1 }, pulse: true, expect: { Z: 0 } }, { set: { X: 0 }, pulse: true, expect: { Z: 0 } }, { set: { X: 1 }, pulse: true, expect: { Z: 1 } }, { set: { X: 0 }, pulse: true, expect: { Z: 0 } }, { set: { X: 1 }, pulse: true, expect: { Z: 1 } }, { set: { X: 1 }, pulse: true, expect: { Z: 0 } }])
];

export function resetSequentialState(components: LogicComponent[]): void {
  components.forEach(c => {
    const s = c.internalState;
    s.q = 0;
    s.qn = 1;
    s.reg = [0, 0, 0, 0];
    s.regBig = 0n;
    s.count = 0;
    s.countBig = 0n;
    s.prevClk = 0;
    s.prevSig = 0;
    s.fsmState = 0;
    s.seqIdx = 0;
    s.clockTimer = 0;
    s.clockOut = 0;
    if (s.fifo) s.fifo = [];
    if (s.regFile) s.regFile = new Array(8).fill(0n);
    if (s.lcdChars) s.lcdChars = new Array(32).fill(32);
  });
}

export function validateChallenge(
  ch: ChallengeDef,
  components: LogicComponent[],
  wires: Wire[],
  customICs: CustomICDef[] = []
): ChallengeValidationResult {
  const findLabeled = (name: string, types: string[]) =>
    components.find(c => types.includes(c.type) && (c.label || '').trim().toUpperCase() === name.toUpperCase());

  const ins = ch.inputs.map(n => ({ n, c: findLabeled(n, ['SWITCH']) }));
  const outs = ch.outputs.map(n => ({ n, c: findLabeled(n, ['LED', 'PROBE']) }));
  const missing = [
    ...ins.filter(x => !x.c).map(x => `Interruptor "${x.n}"`),
    ...outs.filter(x => !x.c).map(x => `LED "${x.n}"`)
  ];
  if (missing.length) return { ok: false, missing, rows: [] };

  const settle = () => {
    for (let k = 0; k < 4; k++) evaluateCircuitDeterministic(components, wires, 0, 2, customICs);
  };
  const saved = ins.map(x => x.c!.internalState.value);
  const read = () => outs.map(x => (x.c!.pinValues.in0 === 1 ? 1 : 0));
  const fmt = (names: string[], vals: Array<number | null | undefined>) =>
    names.map((n, i) => `${n}=${vals[i] === null || vals[i] === undefined ? 'x' : vals[i]}`).join(' ');

  const rows: ChallengeRowResult[] = [];
  if (ch.steps) {
    ins.forEach(x => { x.c!.internalState.value = 0; });
    resetSequentialState(components);
    settle();
    const clk = ins.find(x => x.n.toUpperCase() === 'CLK');
    ch.steps.forEach(stp => {
      Object.entries(stp.set || {}).forEach(([n, v]) => {
        const x = ins.find(q => q.n.toUpperCase() === n.toUpperCase());
        if (x) x.c!.internalState.value = v;
      });
      settle();
      if (stp.pulse && clk) {
        clk.c!.internalState.value = 1;
        settle();
        clk.c!.internalState.value = 0;
        settle();
      }
      const got = read();
      const exp = outs.map(x => stp.expect[x.n]);
      const label = [
        Object.entries(stp.set || {}).map(([k, v]) => `${k}=${v}`).join(' '),
        stp.pulse ? '⏵CLK' : ''
      ].filter(Boolean).join(' ');
      rows.push({
        label,
        exp: fmt(ch.outputs, exp),
        got: fmt(ch.outputs, got),
        ok: exp.every((v, i) => v === undefined || v === got[i])
      });
    });
    resetSequentialState(components);
  } else if (ch.fn) {
    const total = 1 << ins.length;
    for (let m = 0; m < total; m++) {
      const bits = ins.map((_, i) => (m >> (ins.length - 1 - i)) & 1);
      ins.forEach((x, i) => { x.c!.internalState.value = bits[i]; });
      settle();
      const got = read();
      const exp = ch.fn(bits);
      rows.push({
        label: fmt(ch.inputs, bits),
        exp: fmt(ch.outputs, exp),
        got: fmt(ch.outputs, got),
        ok: exp.every((v, i) => v === null || v === got[i])
      });
    }
  }

  ins.forEach((x, i) => { x.c!.internalState.value = saved[i]; });
  settle();
  return { ok: rows.every(r => r.ok), missing: [], rows };
}
