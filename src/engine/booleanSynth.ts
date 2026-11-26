import { createComponent } from './catalog';
import { evaluateCircuitDeterministic } from './simulator';
import { CustomICDef, LogicComponent, Wire, bit, deserializeCircuitData, genId, serializeCircuitData } from './types';

interface BoolAst {
  type: string;
  name?: string;
  child?: BoolAst;
  left?: BoolAst;
  right?: BoolAst;
}

export function synthesizeBooleanCircuit(exprRaw: string): { components: LogicComponent[]; wires: Wire[] } {
  let s = exprRaw.trim();
  if (!s) throw new Error('Introduce una expresión booleana.');

  s = s
    .replace(/\bXNOR\b/gi, ' XNOR ')
    .replace(/\bNAND\b/gi, ' NAND ')
    .replace(/\bNOR\b/gi, ' NOR ')
    .replace(/\bXOR\b/gi, ' XOR ')
    .replace(/\bAND\b/gi, ' AND ')
    .replace(/\bOR\b/gi, ' OR ')
    .replace(/\bNOT\b/gi, ' NOT ')
    .replace(/&&|\*|·|&/g, ' AND ')
    .replace(/\|\||\+|\|/g, ' OR ')
    .replace(/!|~/g, ' NOT ')
    .replace(/\^/g, ' XOR ');

  const tokens = s.match(/\(|\)|XNOR|NAND|NOR|XOR|AND|OR|NOT|[A-Za-z][A-Za-z0-9_]*/g);
  if (!tokens || tokens.length === 0) throw new Error('Expresión no válida.');

  let pos = 0;
  const varsSet = new Set<string>();
  const ops = new Set(['AND', 'NAND', 'OR', 'NOR', 'XOR', 'XNOR', 'NOT', '(', ')']);

  function parseOr(): BoolAst {
    let node = parseXor();
    while (pos < tokens!.length && (tokens![pos] === 'OR' || tokens![pos] === 'NOR')) {
      const op = tokens![pos++];
      node = { type: op, left: node, right: parseXor() };
    }
    return node;
  }
  function parseXor(): BoolAst {
    let node = parseAnd();
    while (pos < tokens!.length && (tokens![pos] === 'XOR' || tokens![pos] === 'XNOR')) {
      const op = tokens![pos++];
      node = { type: op, left: node, right: parseAnd() };
    }
    return node;
  }
  function parseAnd(): BoolAst {
    let node = parseNot();
    while (pos < tokens!.length && (tokens![pos] === 'AND' || tokens![pos] === 'NAND')) {
      const op = tokens![pos++];
      node = { type: op, left: node, right: parseNot() };
    }
    return node;
  }
  function parseNot(): BoolAst {
    if (pos < tokens!.length && tokens![pos] === 'NOT') {
      pos++;
      return { type: 'NOT', child: parseNot() };
    }
    return parsePrimary();
  }
  function parsePrimary(): BoolAst {
    if (pos >= tokens!.length) throw new Error('Falta un operando al final.');
    const tok = tokens![pos++];
    if (tok === '(') {
      const inner = parseOr();
      if (tokens![pos] !== ')') throw new Error('Paréntesis sin cerrar.');
      pos++;
      return inner;
    }
    if (ops.has(tok)) throw new Error(`Operador inesperado: ${tok}`);
    const vName = tok.toUpperCase();
    varsSet.add(vName);
    return { type: 'VAR', name: vName };
  }

  const ast = parseOr();
  if (pos < tokens.length) throw new Error(`Token inesperado: ${tokens[pos]}`);

  const varNames = [...varsSet].sort();
  if (varNames.length > 8) throw new Error('Máximo 8 variables distintas permitidas.');

  const components: LogicComponent[] = [];
  const wires: Wire[] = [];
  const varCompMap = new Map<string, LogicComponent>();

  varNames.forEach((vName, idx) => {
    const sw = createComponent('SWITCH', -280, -((varNames.length - 1) * 70) / 2 + idx * 70, { label: vName, initialValue: 1 });
    components.push(sw);
    varCompMap.set(vName, sw);
  });

  const depthCounters = new Map<number, number>();
  function getDepth(n: BoolAst): number {
    if (n.type === 'VAR') return 0;
    if (n.type === 'NOT') return 1 + getDepth(n.child!);
    return 1 + Math.max(getDepth(n.left!), getDepth(n.right!));
  }

  function buildNode(node: BoolAst, depth: number): LogicComponent {
    if (node.type === 'VAR') return varCompMap.get(node.name!)!;
    const row = depthCounters.get(depth) || 0;
    depthCounters.set(depth, row + 1);
    const gx = -120 + depth * 130;
    const gy = (row - 0.5) * 85;

    if (node.type === 'NOT') {
      const childComp = buildNode(node.child!, depth - 1);
      const gate = createComponent('NOT', gx, gy);
      components.push(gate);
      wires.push({ id: genId('w'), fromCompId: childComp.id, fromPinId: 'out', toCompId: gate.id, toPinId: 'in0', signal: 0 });
      return gate;
    }

    const leftComp = buildNode(node.left!, depth - 1);
    const rightComp = buildNode(node.right!, depth - 1);
    const gate = createComponent(node.type, gx, gy);
    components.push(gate);
    wires.push({ id: genId('w'), fromCompId: leftComp.id, fromPinId: 'out', toCompId: gate.id, toPinId: 'in0', signal: 0 });
    wires.push({ id: genId('w'), fromCompId: rightComp.id, fromPinId: 'out', toCompId: gate.id, toPinId: 'in1', signal: 0 });
    return gate;
  }

  const totalDepth = Math.max(1, getDepth(ast));
  const rootGate = buildNode(ast, totalDepth);
  const led = createComponent('LED', rootGate.x + 140, rootGate.y, { label: 'ƒ(x)', color: 'cyan', probe: true });
  components.push(led);
  wires.push({ id: genId('w'), fromCompId: rootGate.id, fromPinId: 'out', toCompId: led.id, toPinId: 'in0', signal: 0 });

  evaluateCircuitDeterministic(components, wires, 0);
  return { components, wires };
}

export interface TruthTableResult {
  inHeaders: string[];
  outHeaders: string[];
  rows: Array<{ inBits: number[]; outBits: number[] }>;
  csv: string;
  usedInputIds: string[];
}

export function computeTruthTable(
  components: LogicComponent[],
  wires: Wire[],
  customICs: CustomICDef[] = []
): TruthTableResult | null {
  const inputs = components.filter(c => ['SWITCH', 'BUTTON', 'HIGH', 'LOW'].includes(c.type));
  const outputs = components.filter(c => ['LED', 'PROBE', 'BUZZER'].includes(c.type));
  if (inputs.length === 0 || outputs.length === 0) return null;

  const usedInputs = inputs.slice(0, 6);
  const rowsCount = 1 << usedInputs.length;

  const backupStr = serializeCircuitData({ components, wires }, false);
  const cloned = deserializeCircuitData<{ components: LogicComponent[]; wires: Wire[] }>(backupStr);
  const clonedInputs = usedInputs.map(u => cloned.components.find(c => c.id === u.id)!);
  const clonedOutputs = outputs.map(o => cloned.components.find(c => c.id === o.id)!);

  const inHeaders = usedInputs.map((c, i) => c.label || `IN${i}`);
  const outHeaders = outputs.map((c, i) => c.label || `OUT${i}`);
  const csvRows = [[...inHeaders, ...outHeaders].join(',')];
  const rows: Array<{ inBits: number[]; outBits: number[] }> = [];

  for (let r = 0; r < rowsCount; r++) {
    const inBits: number[] = [];
    clonedInputs.forEach((inp, idx) => {
      const b = (r >> (usedInputs.length - 1 - idx)) & 1;
      inp.internalState.value = b;
      inBits.push(b);
    });
    evaluateCircuitDeterministic(cloned.components, cloned.wires, 0, 2, customICs);
    const outBits = clonedOutputs.map(out => bit(out.pinValues.in0));
    csvRows.push([...inBits, ...outBits].join(','));
    rows.push({ inBits, outBits });
  }

  return {
    inHeaders,
    outHeaders,
    rows,
    csv: csvRows.join('\n'),
    usedInputIds: usedInputs.map(u => u.id)
  };
}
