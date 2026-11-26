import { LogicComponent, PinSignal, Wire, toUintN } from './types';
import { pinWX, pinWY } from './catalog';

export interface LogisimExportResult {
  xml: string;
  compCount: number;
  wireCount: number;
  warnings: string[];
}

const snap10 = (v: number): number => Math.round(v / 10) * 10;

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatLogisimMemoryContents(mem: Array<number | bigint> | undefined, addrBits: number, dataBits: number): string {
  const size = 1 << Math.max(4, Math.min(16, addrBits));
  const vals: string[] = [];
  let lastNonZero = -1;
  for (let i = 0; i < size; i++) {
    const raw = mem && i < mem.length ? toUintN(mem[i] as PinSignal, dataBits) : 0n;
    if (raw !== 0n) lastNonZero = i;
    vals.push(raw.toString(16));
  }
  const trimmed = lastNonZero < 0 ? ['0'] : vals.slice(0, lastNonZero + 1);
  // Run-length compress trailing/long zero runs slightly or emit clean Logisim-evolution header
  return `addr/data: ${addrBits} ${dataBits}\n${trimmed.join(' ')}`;
}

interface LogisimMappedComp {
  lib: string;
  name: string;
  locX: number;
  locY: number;
  attrs: Array<{ name: string; val: string }>;
  /** Exact pin world coordinates on the 10px Logisim grid keyed by LogicStudio pinId */
  pinLocs: Record<string, { x: number; y: number }>;
}

function mapComponentToLogisim(
  comp: LogicComponent,
  originX: number,
  originY: number,
  warnings: string[]
): LogisimMappedComp | null {
  const lx = snap10(comp.x - originX);
  const ly = snap10(comp.y - originY);
  const b = Math.max(1, Math.min(32, comp.bits || 1)); // Logisim-evolution supports 1..32 natively per wire; warn if 64b
  const rawBits = Math.max(1, Math.min(64, comp.bits || 1));
  if (rawBits > 32) {
    warnings.push(`${comp.label || comp.type}: Logisim-evolution admite máx. 32 bits por cable (ajustado de ${rawBits}b a 32b).`);
  }

  const labelAttr = comp.label ? [{ name: 'label', val: comp.label }] : [];

  // Fallback pin layout aligned to 10px grid around (lx, ly)
  const fallbackPinLocs = (): Record<string, { x: number; y: number }> => {
    const m: Record<string, { x: number; y: number }> = {};
    for (const p of comp.pins) {
      m[p.id] = {
        x: snap10(pinWX(comp, p) - originX),
        y: snap10(pinWY(comp, p) - originY)
      };
    }
    return m;
  };

  switch (comp.type) {
    case 'SWITCH':
    case 'DIP_SWITCH':
    case 'HEX_KEY':
    case 'HEX_KEY_N':
    case 'SLIDER_ADC': {
      const pinId = comp.pins[0]?.id || 'out';
      return {
        lib: '0',
        name: 'Pin',
        locX: lx,
        locY: ly,
        attrs: [
          { name: 'appearance', val: 'NewPins' },
          { name: 'width', val: String(b) },
          ...labelAttr
        ],
        pinLocs: { [pinId]: { x: lx, y: ly } }
      };
    }

    case 'HIGH':
    case 'LOW':
    case 'CONST_N': {
      const val =
        comp.type === 'HIGH'
          ? 1n
          : comp.type === 'LOW'
            ? 0n
            : toUintN((comp.internalState.value as PinSignal) ?? 0n, b);
      return {
        lib: '0',
        name: 'Constant',
        locX: lx,
        locY: ly,
        attrs: [
          { name: 'value', val: `0x${val.toString(16)}` },
          { name: 'width', val: String(b) }
        ],
        pinLocs: { out: { x: lx, y: ly } }
      };
    }

    case 'BUTTON':
      return {
        lib: '5',
        name: 'Button',
        locX: lx,
        locY: ly,
        attrs: [...labelAttr],
        pinLocs: { out: { x: lx, y: ly } }
      };

    case 'CLOCK':
      return {
        lib: '0',
        name: 'Clock',
        locX: lx,
        locY: ly,
        attrs: [...labelAttr],
        pinLocs: { out: { x: lx, y: ly } }
      };

    case 'LED':
      return {
        lib: '5',
        name: 'LED',
        locX: lx,
        locY: ly,
        attrs: [...labelAttr],
        pinLocs: { in0: { x: lx, y: ly } }
      };

    case 'PROBE':
    case 'HEX_DISPLAY_N':
    case 'LED_BAR_8':
    case 'VU_METER_N': {
      const pinId = comp.pins[0]?.id || 'in0';
      return {
        lib: '0',
        name: 'Pin',
        locX: lx,
        locY: ly,
        attrs: [
          { name: 'appearance', val: 'NewPins' },
          { name: 'facing', val: 'west' },
          { name: 'output', val: 'true' },
          { name: 'width', val: String(b) },
          ...labelAttr
        ],
        pinLocs: { [pinId]: { x: lx, y: ly } }
      };
    }

    case 'NOT':
      return {
        lib: '1',
        name: 'NOT Gate',
        locX: lx,
        locY: ly,
        attrs: [...(b > 1 ? [{ name: 'width', val: String(b) }] : []), ...labelAttr],
        pinLocs: { in0: { x: lx - 30, y: ly }, out: { x: lx, y: ly } }
      };

    case 'BUFFER':
      return {
        lib: '1',
        name: 'Buffer',
        locX: lx,
        locY: ly,
        attrs: [...(b > 1 ? [{ name: 'width', val: String(b) }] : []), ...labelAttr],
        pinLocs: { in0: { x: lx - 20, y: ly }, out: { x: lx, y: ly } }
      };

    case 'TRI_BUFFER':
      return {
        lib: '1',
        name: 'Controlled Buffer',
        locX: lx,
        locY: ly,
        attrs: [...(b > 1 ? [{ name: 'width', val: String(b) }] : []), ...labelAttr],
        pinLocs: { in0: { x: lx - 20, y: ly }, oe: { x: lx - 10, y: ly + 10 }, out: { x: lx, y: ly } }
      };

    case 'AND':
    case 'NAND':
    case 'OR':
    case 'NOR':
    case 'XOR':
    case 'XNOR': {
      const gateNames: Record<string, string> = {
        AND: 'AND Gate',
        NAND: 'NAND Gate',
        OR: 'OR Gate',
        NOR: 'NOR Gate',
        XOR: 'XOR Gate',
        XNOR: 'XNOR Gate'
      };
      const isInv = comp.type === 'NAND' || comp.type === 'NOR' || comp.type === 'XNOR';
      const isXor = comp.type === 'XOR' || comp.type === 'XNOR';
      const bodyW = (isXor ? 60 : 50) + (isInv ? 10 : 0);
      const nIn = Math.max(2, comp.inputCount || 2);
      const pinLocs: Record<string, { x: number; y: number }> = {
        out: { x: lx, y: ly }
      };
      for (let i = 0; i < nIn; i++) {
        const dy = nIn === 2 ? (i === 0 ? -20 : 20) : (i - Math.floor(nIn / 2)) * 10;
        pinLocs[`in${i}`] = { x: lx - bodyW, y: ly + dy };
      }
      return {
        lib: '1',
        name: gateNames[comp.type],
        locX: lx,
        locY: ly,
        attrs: [
          ...(nIn !== 2 ? [{ name: 'inputs', val: String(nIn) }] : []),
          ...(b > 1 ? [{ name: 'width', val: String(b) }] : []),
          ...labelAttr
        ],
        pinLocs
      };
    }

    case 'TUNNEL':
      return {
        lib: '0',
        name: 'Tunnel',
        locX: lx,
        locY: ly,
        attrs: [
          ...(comp.tunnelDir === 'in' ? [{ name: 'facing', val: 'west' }] : []),
          { name: 'label', val: comp.tunnelTag || comp.label || 'BUS' },
          ...(b > 1 ? [{ name: 'width', val: String(b) }] : [])
        ],
        pinLocs: comp.tunnelDir === 'in' ? { out: { x: lx, y: ly } } : { in0: { x: lx, y: ly } }
      };

    case 'ADDER_N':
      return {
        lib: '3',
        name: 'Adder',
        locX: lx,
        locY: ly,
        attrs: [{ name: 'width', val: String(b) }, ...labelAttr],
        pinLocs: {
          a: { x: lx - 40, y: ly - 10 },
          b: { x: lx - 40, y: ly + 10 },
          cin: { x: lx - 20, y: ly - 20 },
          y: { x: lx, y: ly },
          cout: { x: lx - 20, y: ly + 20 }
        }
      };

    case 'SUB_N':
      return {
        lib: '3',
        name: 'Subtractor',
        locX: lx,
        locY: ly,
        attrs: [{ name: 'width', val: String(b) }, ...labelAttr],
        pinLocs: {
          a: { x: lx - 40, y: ly - 10 },
          b: { x: lx - 40, y: ly + 10 },
          cin: { x: lx - 20, y: ly - 20 },
          y: { x: lx, y: ly },
          cout: { x: lx - 20, y: ly + 20 }
        }
      };

    case 'MULT_N':
      return {
        lib: '3',
        name: 'Multiplier',
        locX: lx,
        locY: ly,
        attrs: [{ name: 'width', val: String(b) }, ...labelAttr],
        pinLocs: {
          a: { x: lx - 40, y: ly - 10 },
          b: { x: lx - 40, y: ly + 10 },
          p: { x: lx, y: ly },
          hi: { x: lx - 20, y: ly + 20 }
        }
      };

    case 'DIV_N':
      return {
        lib: '3',
        name: 'Divider',
        locX: lx,
        locY: ly,
        attrs: [{ name: 'width', val: String(b) }, ...labelAttr],
        pinLocs: {
          a: { x: lx - 40, y: ly - 10 },
          b: { x: lx - 40, y: ly + 10 },
          q: { x: lx, y: ly },
          r: { x: lx - 20, y: ly + 20 }
        }
      };

    case 'COMP_N':
      return {
        lib: '3',
        name: 'Comparator',
        locX: lx,
        locY: ly,
        attrs: [
          { name: 'width', val: String(b) },
          ...(comp.signedMode ? [] : [{ name: 'mode', val: 'unsigned' }]),
          ...labelAttr
        ],
        pinLocs: {
          a: { x: lx - 40, y: ly - 10 },
          b: { x: lx - 40, y: ly + 10 },
          gt: { x: lx, y: ly - 10 },
          eq: { x: lx, y: ly },
          lt: { x: lx, y: ly + 10 }
        }
      };

    case 'D_FF':
    case 'T_FF':
    case 'JK_FF':
    case 'RS_FF': {
      const ffNames: Record<string, string> = {
        D_FF: 'D Flip-Flop',
        T_FF: 'T Flip-Flop',
        JK_FF: 'J-K Flip-Flop',
        RS_FF: 'S-R Flip-Flop'
      };
      const pinLocs: Record<string, { x: number; y: number }> = {
        q: { x: lx + 60, y: ly },
        qn: { x: lx + 60, y: ly + 40 },
        clk: { x: lx, y: ly + 40 }
      };
      if (comp.type === 'D_FF') pinLocs.d = { x: lx, y: ly };
      else if (comp.type === 'T_FF') pinLocs.t = { x: lx, y: ly };
      else if (comp.type === 'JK_FF') {
        pinLocs.j = { x: lx, y: ly };
        pinLocs.k = { x: lx, y: ly + 20 };
      } else {
        pinLocs.s = { x: lx, y: ly };
        pinLocs.r = { x: lx, y: ly + 20 };
      }
      return {
        lib: '4',
        name: ffNames[comp.type],
        locX: lx,
        locY: ly,
        attrs: [...labelAttr],
        pinLocs
      };
    }

    case 'REG_N':
      return {
        lib: '4',
        name: 'Register',
        locX: lx,
        locY: ly,
        attrs: [{ name: 'width', val: String(b) }, ...labelAttr],
        pinLocs: {
          d: { x: lx, y: ly + 30 },
          en: { x: lx, y: ly + 50 },
          clk: { x: lx, y: ly + 70 },
          rst: { x: lx + 30, y: ly + 90 },
          q: { x: lx + 60, y: ly + 30 }
        }
      };

    case 'COUNTER_N':
    case 'MOD_COUNTER_N': {
      const maxVal =
        comp.type === 'MOD_COUNTER_N'
          ? BigInt(Math.max(1, (comp.modBase ?? 10) - 1)) & ((1n << BigInt(b)) - 1n)
          : (1n << BigInt(b)) - 1n;
      return {
        lib: '4',
        name: 'Counter',
        locX: lx,
        locY: ly,
        attrs: [{ name: 'width', val: String(b) }, { name: 'max', val: `0x${maxVal.toString(16)}` }, ...labelAttr],
        pinLocs:
          comp.type === 'MOD_COUNTER_N'
            ? {
                clk: { x: lx, y: ly + 110 },
                en: { x: lx, y: ly + 70 },
                rst: { x: lx + 30, y: ly + 130 },
                mod: { x: lx, y: ly + 30 },
                q: { x: lx + 60, y: ly + 30 },
                wrap: { x: lx + 60, y: ly + 50 }
              }
            : {
                d: { x: lx, y: ly + 30 },
                load: { x: lx, y: ly + 50 },
                en: { x: lx, y: ly + 70 },
                up: { x: lx, y: ly + 90 },
                clk: { x: lx, y: ly + 110 },
                rst: { x: lx + 30, y: ly + 130 },
                q: { x: lx + 60, y: ly + 30 },
                co: { x: lx + 60, y: ly + 50 }
              }
      };
    }

    case 'RAM_N':
    case 'ROM_N': {
      const ab = Math.max(4, Math.min(16, comp.addrBits || 8));
      const isRom = comp.type === 'ROM_N';
      return {
        lib: '4',
        name: isRom ? 'ROM' : 'RAM',
        locX: lx,
        locY: ly,
        attrs: [
          { name: 'addrWidth', val: String(ab) },
          { name: 'dataWidth', val: String(b) },
          { name: 'contents', val: formatLogisimMemoryContents(comp.internalState.mem, ab, b) },
          ...labelAttr
        ],
        pinLocs: isRom
          ? { addr: { x: lx, y: ly + 10 }, q: { x: lx + 240, y: ly + 70 } }
          : {
              addr: { x: lx, y: ly + 10 },
              we: { x: lx, y: ly + 50 },
              clk: { x: lx, y: ly + 70 },
              d: { x: lx, y: ly + 90 },
              q: { x: lx + 240, y: ly + 90 }
            }
      };
    }

    case 'MUX_2':
    case 'MUX_4':
    case 'MUX_8':
    case 'MUX_16':
    case 'MUX_32': {
      const selBits = comp.type === 'MUX_2' ? 1 : comp.type === 'MUX_4' ? 2 : comp.type === 'MUX_8' ? 3 : comp.type === 'MUX_16' ? 4 : 5;
      const nIn = 1 << selBits;
      const pinLocs: Record<string, { x: number; y: number }> = { y: { x: lx, y: ly } };
      for (let i = 0; i < nIn; i++) {
        pinLocs[`d${i}`] = { x: lx - 40, y: ly - (nIn * 10) / 2 + i * 10 };
      }
      pinLocs.s0 = { x: lx - 20, y: ly + (nIn * 10) / 2 + 10 };
      return {
        lib: '2',
        name: 'Multiplexer',
        locX: lx,
        locY: ly,
        attrs: [
          { name: 'select', val: String(selBits) },
          { name: 'width', val: String(b) }
        ],
        pinLocs
      };
    }

    case 'DEMUX_2':
    case 'DEMUX_4':
    case 'DEMUX_8':
    case 'DEMUX_16':
    case 'DEMUX_32': {
      const selBits = comp.type === 'DEMUX_2' ? 1 : comp.type === 'DEMUX_4' ? 2 : comp.type === 'DEMUX_8' ? 3 : comp.type === 'DEMUX_16' ? 4 : 5;
      const nOut = 1 << selBits;
      const pinLocs: Record<string, { x: number; y: number }> = { din: { x: lx - 40, y: ly } };
      for (let i = 0; i < nOut; i++) {
        pinLocs[`y${i}`] = { x: lx, y: ly - (nOut * 10) / 2 + i * 10 };
      }
      pinLocs.s0 = { x: lx - 20, y: ly + (nOut * 10) / 2 + 10 };
      return {
        lib: '2',
        name: 'Demultiplexer',
        locX: lx,
        locY: ly,
        attrs: [
          { name: 'select', val: String(selBits) },
          { name: 'width', val: String(b) }
        ],
        pinLocs
      };
    }

    case 'DEC_2TO4':
    case 'DEC_3TO8':
    case 'DEC_4TO16':
    case 'DEC_5TO32': {
      const selBits = comp.type === 'DEC_2TO4' ? 2 : comp.type === 'DEC_3TO8' ? 3 : comp.type === 'DEC_4TO16' ? 4 : 5;
      const nOut = 1 << selBits;
      const pinLocs: Record<string, { x: number; y: number }> = { a0: { x: lx - 20, y: ly + (nOut * 10) / 2 + 10 } };
      for (let i = 0; i < nOut; i++) {
        pinLocs[`y${i}`] = { x: lx, y: ly - (nOut * 10) / 2 + i * 10 };
      }
      return {
        lib: '2',
        name: 'Decoder',
        locX: lx,
        locY: ly,
        attrs: [{ name: 'select', val: String(selBits) }],
        pinLocs
      };
    }

    case 'LABEL':
      return {
        lib: '6',
        name: 'Text',
        locX: lx,
        locY: ly,
        attrs: [{ name: 'text', val: comp.noteText || comp.label || 'Nota' }],
        pinLocs: {}
      };

    default: {
      // Components specific to LogicStudio (ALU_N, RAYCAST_CORE, LCD_TEXT, VGA_SCREEN, TONE_GEN, etc.)
      // Emit labeled Pin/Tunnel block stubs so connectivity is preserved cleanly without dropping wires
      warnings.push(
        `${comp.label || comp.type} (${comp.type}): bloque exclusivo de LogicStudio exportado como etiqueta/túnel de referencia.`
      );
      return {
        lib: '0',
        name: 'Tunnel',
        locX: lx,
        locY: ly,
        attrs: [
          { name: 'label', val: comp.label || comp.type },
          ...(b > 1 ? [{ name: 'width', val: String(b) }] : [])
        ],
        pinLocs: fallbackPinLocs()
      };
    }
  }
}

export function exportCircuitToLogisimCirc(
  components: LogicComponent[],
  wires: Wire[],
  circuitName = 'main'
): LogisimExportResult {
  if (components.length === 0) {
    const emptyXml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<project source="3.8.0" version="1.0">
  <lib desc="#Wiring" name="0"/>
  <lib desc="#Gates" name="1"/>
  <lib desc="#Plexers" name="2"/>
  <lib desc="#Arithmetic" name="3"/>
  <lib desc="#Memory" name="4"/>
  <lib desc="#I/O" name="5"/>
  <lib desc="#Base" name="6"/>
  <main name="${escXml(circuitName)}"/>
  <circuit name="${escXml(circuitName)}"/>
</project>
`;
    return { xml: emptyXml, compCount: 0, wireCount: 0, warnings: ['El lienzo está vacío.'] };
  }

  let minX = Infinity;
  let minY = Infinity;
  for (const c of components) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
  }
  const originX = snap10(minX - 240);
  const originY = snap10(minY - 200);

  const warnings: string[] = [];
  const mapped = new Map<string, LogisimMappedComp>();
  const compXml: string[] = [];

  for (const c of components) {
    const m = mapComponentToLogisim(c, originX, originY, warnings);
    if (!m) continue;
    mapped.set(c.id, m);
    if (m.attrs.length === 0) {
      compXml.push(`    <comp lib="${m.lib}" loc="(${m.locX},${m.locY})" name="${escXml(m.name)}"/>`);
    } else {
      const attrsXml = m.attrs
        .map(a => `      <a name="${escXml(a.name)}" val="${escXml(a.val)}"/>`)
        .join('\n');
      compXml.push(`    <comp lib="${m.lib}" loc="(${m.locX},${m.locY})" name="${escXml(m.name)}">\n${attrsXml}\n    </comp>`);
    }
  }

  const wireSet = new Set<string>();
  const wireXml: string[] = [];
  const emitSegment = (x1: number, y1: number, x2: number, y2: number) => {
    if (x1 === x2 && y1 === y2) return;
    const key = `${x1},${y1}->${x2},${y2}`;
    if (wireSet.has(key)) return;
    wireSet.add(key);
    wireXml.push(`    <wire from="(${x1},${y1})" to="(${x2},${y2})"/>`);
  };

  let routedWires = 0;
  for (const w of wires) {
    const src = mapped.get(w.fromCompId);
    const dst = mapped.get(w.toCompId);
    if (!src || !dst) continue;
    const p1 = src.pinLocs[w.fromPinId] || { x: src.locX, y: src.locY };
    const p2 = dst.pinLocs[w.toPinId] || { x: dst.locX, y: dst.locY };
    routedWires++;
    if (p1.x === p2.x || p1.y === p2.y) {
      emitSegment(p1.x, p1.y, p2.x, p2.y);
    } else {
      const mx = snap10((p1.x + p2.x) / 2);
      if (mx !== p1.x && mx !== p2.x) {
        emitSegment(p1.x, p1.y, mx, p1.y);
        emitSegment(mx, p1.y, mx, p2.y);
        emitSegment(mx, p2.y, p2.x, p2.y);
      } else {
        emitSegment(p1.x, p1.y, p2.x, p1.y);
        emitSegment(p2.x, p1.y, p2.x, p2.y);
      }
    }
  }

  const uniqueWarnings = Array.from(new Set(warnings));
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<project source="3.8.0" version="1.0">
  This file is intended to be loaded by Logisim-evolution v3.8.0(https://github.com/logisim-evolution/).
  <lib desc="#Wiring" name="0">
    <tool name="Pin">
      <a name="appearance" val="classic"/>
    </tool>
  </lib>
  <lib desc="#Gates" name="1"/>
  <lib desc="#Plexers" name="2"/>
  <lib desc="#Arithmetic" name="3"/>
  <lib desc="#Memory" name="4"/>
  <lib desc="#I/O" name="5"/>
  <lib desc="#Base" name="6"/>
  <main name="${escXml(circuitName)}"/>
  <circuit name="${escXml(circuitName)}">
    <a name="appearance" val="logisim_evolution"/>
    <a name="circuit" val="${escXml(circuitName)}"/>
    <a name="circuitnamedboxfixedsize" val="true"/>
${compXml.join('\n')}
${wireXml.join('\n')}
  </circuit>
</project>
`;

  return {
    xml,
    compCount: mapped.size,
    wireCount: routedWires,
    warnings: uniqueWarnings
  };
}
