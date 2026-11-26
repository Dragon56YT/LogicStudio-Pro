import assert from 'node:assert/strict';
import test from 'node:test';
import { createComponent } from './catalog';
import { compileLogicScript, formatLogicScriptDiagnosticsForAI } from './logicscript';
import { evaluateCircuitDeterministic, solveNetwork } from './simulator';
import { deserializeCircuitData, serializeCircuitData, toUintN } from './types';
import { PRESET_LIST, buildPresetCircuit } from '../presets/circuits';
import { FUNNY_SCENES_32, renderFunnyScene32Buffer } from '../presets/funnyAnimation32';
import { synthesizeBooleanCircuit, computeTruthTable } from './booleanSynth';
import { CHALLENGES, validateChallenge } from './challenges';
import { exportCircuitToLogisimCirc } from './logisimExport';

test('64-bit ALU_N and ADDER_N exact BigInt arithmetic', () => {
  const a = createComponent('CONST_N', 0, 0, { bits: 64, initialValue: 0xFFFFFFFFFFFFFFF0n });
  const b = createComponent('CONST_N', 0, 50, { bits: 64, initialValue: 0x0000000000000020n });
  const op = createComponent('CONST_N', 0, 100, { bits: 4, initialValue: 0n }); // ADD
  const alu = createComponent('ALU_N', 150, 50, { bits: 64 });
  const adder = createComponent('ADDER_N', 150, 180, { bits: 64 });

  const wires = [
    { id: 'w1', fromCompId: a.id, fromPinId: 'out', toCompId: alu.id, toPinId: 'a', signal: 0 },
    { id: 'w2', fromCompId: b.id, fromPinId: 'out', toCompId: alu.id, toPinId: 'b', signal: 0 },
    { id: 'w3', fromCompId: op.id, fromPinId: 'out', toCompId: alu.id, toPinId: 'op', signal: 0 },
    { id: 'w4', fromCompId: a.id, fromPinId: 'out', toCompId: adder.id, toPinId: 'a', signal: 0 },
    { id: 'w5', fromCompId: b.id, fromPinId: 'out', toCompId: adder.id, toPinId: 'b', signal: 0 }
  ];

  solveNetwork([a, b, op, alu, adder], wires, false);
  assert.equal(alu.pinValues.y, 0x0000000000000010n);
  assert.equal(alu.pinValues.cout, 1);
  assert.equal(alu.pinValues.z, 0);
  assert.equal(adder.pinValues.y, 0x0000000000000010n);
  assert.equal(adder.pinValues.cout, 1);

  // Test 64-bit XOR
  op.internalState.value = 4n;
  solveNetwork([a, b, op, alu, adder], wires, false);
  assert.equal(alu.pinValues.y, 0xFFFFFFFFFFFFFFD0n);
});

test('SPLITTER and MERGER preserve 64-bit slices', () => {
  const src = createComponent('CONST_N', 0, 0, { bits: 64, initialValue: 0x123456789ABCDEF0n });
  const spl = createComponent('SPLITTER', 120, 0, { bits: 64, splitWidths: [16, 16, 16, 16] });
  const mrg = createComponent('MERGER', 260, 0, { bits: 64, splitWidths: [16, 16, 16, 16] });

  const wires = [
    { id: 'w0', fromCompId: src.id, fromPinId: 'out', toCompId: spl.id, toPinId: 'bus', signal: 0 },
    { id: 'w1', fromCompId: spl.id, fromPinId: 'p0', toCompId: mrg.id, toPinId: 'p0', signal: 0 },
    { id: 'w2', fromCompId: spl.id, fromPinId: 'p1', toCompId: mrg.id, toPinId: 'p1', signal: 0 },
    { id: 'w3', fromCompId: spl.id, fromPinId: 'p2', toCompId: mrg.id, toPinId: 'p2', signal: 0 },
    { id: 'w4', fromCompId: spl.id, fromPinId: 'p3', toCompId: mrg.id, toPinId: 'p3', signal: 0 }
  ];

  solveNetwork([src, spl, mrg], wires, false);
  assert.equal(spl.pinValues.p0, 0xDEF0n);
  assert.equal(spl.pinValues.p1, 0x9ABCn);
  assert.equal(spl.pinValues.p2, 0x5678n);
  assert.equal(spl.pinValues.p3, 0x1234n);
  assert.equal(mrg.pinValues.bus, 0x123456789ABCDEF0n);
});

test('Wireless TUNNEL propagates 32-bit buses without wires', () => {
  const c = createComponent('CONST_N', 0, 0, { bits: 32, initialValue: 0xCAFEBABEn });
  const tx = createComponent('TUNNEL', 100, 0, { bits: 32, tunnelDir: 'out', tunnelTag: 'MEM_BUS' });
  const rx = createComponent('TUNNEL', 400, 200, { bits: 32, tunnelDir: 'in', tunnelTag: 'MEM_BUS' });
  const disp = createComponent('HEX_DISPLAY_N', 550, 200, { bits: 32 });

  const wires = [
    { id: 'w1', fromCompId: c.id, fromPinId: 'out', toCompId: tx.id, toPinId: 'in0', signal: 0 },
    { id: 'w2', fromCompId: rx.id, fromPinId: 'out', toCompId: disp.id, toPinId: 'd', signal: 0 }
  ];
  solveNetwork([c, tx, rx, disp], wires, false);
  assert.equal(rx.pinValues.out, 0xCAFEBABEn);
  assert.equal(disp.pinValues.d, 0xCAFEBABEn);
});

test('Symmetric DEMUX_8, MUX_16, DEMUX_16, DEC_4TO16, ENC_16TO4', () => {
  const din = createComponent('CONST_N', 0, 0, { bits: 16, initialValue: 0xBEEFn });
  const s0 = createComponent('HIGH', 0, 40);
  const s1 = createComponent('LOW', 0, 70);
  const s2 = createComponent('HIGH', 0, 100); // sel = 5
  const dmx8 = createComponent('DEMUX_8', 150, 0, { bits: 16 });
  const wires = [
    { id: 'w1', fromCompId: din.id, fromPinId: 'out', toCompId: dmx8.id, toPinId: 'din', signal: 0 },
    { id: 'w2', fromCompId: s0.id, fromPinId: 'out', toCompId: dmx8.id, toPinId: 's0', signal: 0 },
    { id: 'w3', fromCompId: s1.id, fromPinId: 'out', toCompId: dmx8.id, toPinId: 's1', signal: 0 },
    { id: 'w4', fromCompId: s2.id, fromPinId: 'out', toCompId: dmx8.id, toPinId: 's2', signal: 0 }
  ];
  solveNetwork([din, s0, s1, s2, dmx8], wires, false);
  assert.equal(dmx8.pinValues.y5, 0xBEEFn);
  assert.equal(dmx8.pinValues.y0, 0n);

  const enc16 = createComponent('ENC_16TO4', 0, 0);
  const hi = createComponent('HIGH', -100, 0);
  solveNetwork([hi, enc16], [{ id: 'we', fromCompId: hi.id, fromPinId: 'out', toCompId: enc16.id, toPinId: 'i13', signal: 0 }], false);
  assert.equal(enc16.pinValues.v, 1);
  assert.equal(enc16.pinValues.y3, 1);
  assert.equal(enc16.pinValues.y2, 1);
  assert.equal(enc16.pinValues.y1, 0);
  assert.equal(enc16.pinValues.y0, 1);
});

test('Large RAM_N (4096x32) read/write and BigInt JSON serialization round-trip', () => {
  const addr = createComponent('CONST_N', 0, 0, { bits: 12, initialValue: 0x3A5n });
  const data = createComponent('CONST_N', 0, 40, { bits: 32, initialValue: 0xDEAD1234n });
  const we = createComponent('HIGH', 0, 80);
  const clk = createComponent('SWITCH', 0, 120, { initialValue: 0 });
  const ram = createComponent('RAM_N', 150, 40, { bits: 32, addrBits: 12 });

  const wires = [
    { id: 'w1', fromCompId: addr.id, fromPinId: 'out', toCompId: ram.id, toPinId: 'addr', signal: 0 },
    { id: 'w2', fromCompId: data.id, fromPinId: 'out', toCompId: ram.id, toPinId: 'd', signal: 0 },
    { id: 'w3', fromCompId: we.id, fromPinId: 'out', toCompId: ram.id, toPinId: 'we', signal: 0 },
    { id: 'w4', fromCompId: clk.id, fromPinId: 'out', toCompId: ram.id, toPinId: 'clk', signal: 0 }
  ];
  const comps = [addr, data, we, clk, ram];
  evaluateCircuitDeterministic(comps, wires, 0);
  clk.internalState.value = 1;
  evaluateCircuitDeterministic(comps, wires, 0);
  assert.equal(toUintN(ram.pinValues.q, 32), 0xDEAD1234n);

  const json = serializeCircuitData({ components: comps, wires });
  const restored = deserializeCircuitData<{ components: typeof comps; wires: typeof wires }>(json);
  const restoredRam = restored.components.find(c => c.type === 'RAM_N')!;
  assert.equal(restoredRam.internalState.mem![0x3A5], 0xDEAD1234n);
});

test('DOOM 3D Raycaster preset renders live RGB332 frame to VGA_SCREEN', () => {
  const { components, wires } = buildPresetCircuit('doom_3d');
  const clk = components.find(c => c.type === 'CLOCK')!;
  const pad = components.find(c => c.type === 'GAMEPAD')!;
  const vga = components.find(c => c.type === 'VGA_SCREEN')!;
  assert.ok(clk && pad && vga);

  // Drive 3075 full rising edges to complete one full 64x48 frame + swap
  for (let i = 0; i < 3075; i++) {
    clk.internalState.clockOut = 0;
    evaluateCircuitDeterministic(components, wires, 0);
    clk.internalState.clockOut = 1;
    evaluateCircuitDeterministic(components, wires, 0);
  }

  const front = vga.internalState.vgaFront!;
  assert.equal(front.length, 64 * 48);
  let nonZero = 0;
  for (let i = 0; i < front.length; i++) {
    if (front[i] !== 0) nonZero++;
  }
  assert.ok(nonZero > 2000, `Expected >2000 rendered DOOM pixels, got ${nonZero}`);

  // Press W + FIRE on gamepad and advance enough cycles for a full new frame to render & swap
  const beforeSnapshot = Uint8Array.from(front);
  pad.internalState.gamepadBits = 1 | 16; // W + FIRE
  for (let i = 0; i < 6150; i++) {
    clk.internalState.clockOut = 0;
    evaluateCircuitDeterministic(components, wires, 0);
    clk.internalState.clockOut = 1;
    evaluateCircuitDeterministic(components, wires, 0);
  }
  let diffs = 0;
  for (let i = 0; i < front.length; i++) {
    if (front[i] !== beforeSnapshot[i]) diffs++;
  }
  assert.ok(diffs > 50, `Expected DOOM frame to respond to player movement/fire, diffs=${diffs}`);

  // Regression check: serialized DOOM circuit + legacy plain-object rcMap/rcTempMap must evaluate without throwing
  const serialized = serializeCircuitData({ components, wires }, true);
  const restored = deserializeCircuitData<{ components: typeof components; wires: typeof wires }>(serialized);
  const rcComp = restored.components.find(c => c.type === 'RAYCAST_CORE')!;
  (rcComp.internalState as Record<string, unknown>).rcMap = { 0: 1, 1: 1, 255: 1 };
  (rcComp.internalState as Record<string, unknown>).rcTempMap = { 0: 0 };
  (rcComp.internalState as Record<string, unknown>).rcScanAddr = 255;
  (rcComp.internalState as Record<string, unknown>).rcTempNonZero = true;
  const restoredClk = restored.components.find(c => c.type === 'CLOCK')!;
  restoredClk.internalState.clockOut = 0;
  evaluateCircuitDeterministic(restored.components, restored.wires, 0);
  restoredClk.internalState.clockOut = 1;
  evaluateCircuitDeterministic(restored.components, restored.wires, 0);
  assert.ok(rcComp.internalState.rcMap instanceof Uint8Array);
  assert.ok(rcComp.internalState.rcTempMap instanceof Uint8Array);
});

test('LogicScript compiles 64-bit circuits with CONST_N, ALU_N, and TUNNEL', () => {
  const script = `
    place a = CONST_N bits=64 value=0x1122334455667788
    place b = CONST_N bits=64 value=0x0000000000000010
    place op = CONST_N bits=4 value=0
    place alu = ALU_N bits=64
    place tx = TUNNEL bits=64 dir=out tag=RES
    place rx = TUNNEL bits=64 dir=in tag=RES
    place disp = HEX_DISPLAY_N bits=64
    connect a.out -> alu.a
    connect b.out -> alu.b
    connect op.out -> alu.op
    connect alu.y -> tx.in0
    connect rx.out -> disp.d
  `;
  const compiled = compileLogicScript(script);
  assert.equal(compiled.errors.length, 0);
  assert.equal(compiled.components!.length, 7);
  solveNetwork(compiled.components!, compiled.wireList!, false);
  const disp = compiled.components!.find(c => c.type === 'HEX_DISPLAY_N')!;
  assert.equal(disp.pinValues.d, 0x1122334455667798n);
});

test('All 19 curated presets build cleanly and evaluate without throwing', () => {
  assert.equal(PRESET_LIST.length, 19);
  assert.equal(PRESET_LIST.some(p => p.id === 'adder_2bit' || p.id === 'comp_2bit'), false);
  for (const p of PRESET_LIST) {
    const { components, wires } = buildPresetCircuit(p.id);
    assert.ok(components.length > 0, `Preset ${p.id} has components`);
    evaluateCircuitDeterministic(components, wires, 0.016);
  }
});

test('Combinational additions: MAJ3, BUS_SLICE, INC_DEC_N, ABS_NEG_N, MIN_MAX_N, POPCOUNT_N, BIN2BCD_N', () => {
  // MAJ3
  const mA = createComponent('HIGH', 0, 0);
  const mB = createComponent('LOW', 0, 30);
  const mC = createComponent('HIGH', 0, 60);
  const maj = createComponent('MAJ3', 100, 30, { bits: 1 });
  solveNetwork(
    [mA, mB, mC, maj],
    [
      { id: 'w1', fromCompId: mA.id, fromPinId: 'out', toCompId: maj.id, toPinId: 'in0', signal: 0 },
      { id: 'w2', fromCompId: mB.id, fromPinId: 'out', toCompId: maj.id, toPinId: 'in1', signal: 0 },
      { id: 'w3', fromCompId: mC.id, fromPinId: 'out', toCompId: maj.id, toPinId: 'in2', signal: 0 }
    ],
    false
  );
  assert.equal(maj.pinValues.out, 1);

  // BUS_SLICE [15:8] from 32-bit 0x1234AB78
  const busIn = createComponent('CONST_N', 0, 0, { bits: 32, initialValue: 0x1234AB78n });
  const sl = createComponent('BUS_SLICE', 120, 0, { bits: 32, sliceHi: 15, sliceLo: 8 });
  solveNetwork([busIn, sl], [{ id: 'ws', fromCompId: busIn.id, fromPinId: 'out', toCompId: sl.id, toPinId: 'in0', signal: 0 }], false);
  assert.equal(sl.pinValues.out, 0xABn);

  // INC_DEC_N
  const incIn = createComponent('CONST_N', 0, 0, { bits: 8, initialValue: 254n });
  const decFlag = createComponent('LOW', 0, 30);
  const stp = createComponent('CONST_N', 0, 60, { bits: 4, initialValue: 5n });
  const incDec = createComponent('INC_DEC_N', 120, 30, { bits: 8 });
  solveNetwork(
    [incIn, decFlag, stp, incDec],
    [
      { id: 'wi1', fromCompId: incIn.id, fromPinId: 'out', toCompId: incDec.id, toPinId: 'a', signal: 0 },
      { id: 'wi2', fromCompId: decFlag.id, fromPinId: 'out', toCompId: incDec.id, toPinId: 'sub', signal: 0 },
      { id: 'wi3', fromCompId: stp.id, fromPinId: 'out', toCompId: incDec.id, toPinId: 'step', signal: 0 }
    ],
    false
  );
  assert.equal(incDec.pinValues.y, 3n);
  assert.equal(incDec.pinValues.cout, 1);

  // ABS_NEG_N (8-bit signed: -42 = 0xD6 = 214; op=0 NEG, op=1 ABS, op=2 REV, op=3 BSWAP)
  const negVal = createComponent('CONST_N', 0, 0, { bits: 8, initialValue: 10n });
  const absOp = createComponent('CONST_N', 0, 40, { bits: 2, initialValue: 0n }); // op=0 -> NEG
  const absN = createComponent('ABS_NEG_N', 120, 20, { bits: 8, signedMode: true });
  solveNetwork(
    [negVal, absOp, absN],
    [
      { id: 'wa1', fromCompId: negVal.id, fromPinId: 'out', toCompId: absN.id, toPinId: 'a', signal: 0 },
      { id: 'wa2', fromCompId: absOp.id, fromPinId: 'out', toCompId: absN.id, toPinId: 'op', signal: 0 }
    ],
    false
  );
  assert.equal(absN.pinValues.y, 246n);
  absOp.internalState.value = 1n; // op=1 -> ABS
  negVal.internalState.value = 0xD6n; // -42
  solveNetwork(
    [negVal, absOp, absN],
    [
      { id: 'wa1', fromCompId: negVal.id, fromPinId: 'out', toCompId: absN.id, toPinId: 'a', signal: 0 },
      { id: 'wa2', fromCompId: absOp.id, fromPinId: 'out', toCompId: absN.id, toPinId: 'op', signal: 0 }
    ],
    false
  );
  assert.equal(absN.pinValues.y, 42n);

  // MIN_MAX_N (signed: -5 (251) vs +12)
  const mmA = createComponent('CONST_N', 0, 0, { bits: 8, initialValue: 251n });
  const mmB = createComponent('CONST_N', 0, 40, { bits: 8, initialValue: 12n });
  const mm = createComponent('MIN_MAX_N', 120, 20, { bits: 8, signedMode: true });
  solveNetwork(
    [mmA, mmB, mm],
    [
      { id: 'wm1', fromCompId: mmA.id, fromPinId: 'out', toCompId: mm.id, toPinId: 'a', signal: 0 },
      { id: 'wm2', fromCompId: mmB.id, fromPinId: 'out', toCompId: mm.id, toPinId: 'b', signal: 0 }
    ],
    false
  );
  assert.equal(mm.pinValues.min, 251n);
  assert.equal(mm.pinValues.max, 12n);

  // POPCOUNT_N (8-bit: 0b0010_1100 = 0x2C -> pop=3, clz=2, ctz=2)
  const popIn = createComponent('CONST_N', 0, 0, { bits: 8, initialValue: 0x2Cn });
  const pop = createComponent('POPCOUNT_N', 120, 0, { bits: 8 });
  solveNetwork([popIn, pop], [{ id: 'wp', fromCompId: popIn.id, fromPinId: 'out', toCompId: pop.id, toPinId: 'd', signal: 0 }], false);
  assert.equal(pop.pinValues.pop, 3n);
  assert.equal(pop.pinValues.clz, 2n);
  assert.equal(pop.pinValues.ctz, 2n);

  // BIN2BCD_N (16-bit: 1234 -> d3=1, d2=2, d1=3, d0=4)
  const bcdIn = createComponent('CONST_N', 0, 0, { bits: 16, initialValue: 1234n });
  const bcd = createComponent('BIN2BCD_N', 120, 0, { bits: 16 });
  solveNetwork([bcdIn, bcd], [{ id: 'wb', fromCompId: bcdIn.id, fromPinId: 'out', toCompId: bcd.id, toPinId: 'd', signal: 0 }], false);
  assert.equal(bcd.pinValues.d3, 1n);
  assert.equal(bcd.pinValues.d2, 2n);
  assert.equal(bcd.pinValues.d1, 3n);
  assert.equal(bcd.pinValues.d0, 4n);
});

test('32-channel MUX_32, DEMUX_32, DEC_5TO32, ENC_32TO5 work accurately', () => {
  const din = createComponent('CONST_N', 0, 0, { bits: 16, initialValue: 0xA55An });
  const hi = createComponent('HIGH', 0, 50);
  const dmx = createComponent('DEMUX_32', 150, 0, { bits: 16 });
  const mux = createComponent('MUX_32', 350, 0, { bits: 16 });
  // Select channel 27 = 0b11011 (s4=1, s3=1, s2=0, s1=1, s0=1)
  const wires = [
    { id: 'w_din', fromCompId: din.id, fromPinId: 'out', toCompId: dmx.id, toPinId: 'din', signal: 0 },
    { id: 'wd0', fromCompId: hi.id, fromPinId: 'out', toCompId: dmx.id, toPinId: 's0', signal: 0 },
    { id: 'wd1', fromCompId: hi.id, fromPinId: 'out', toCompId: dmx.id, toPinId: 's1', signal: 0 },
    { id: 'wd3', fromCompId: hi.id, fromPinId: 'out', toCompId: dmx.id, toPinId: 's3', signal: 0 },
    { id: 'wd4', fromCompId: hi.id, fromPinId: 'out', toCompId: dmx.id, toPinId: 's4', signal: 0 },
    { id: 'w_m27', fromCompId: dmx.id, fromPinId: 'y27', toCompId: mux.id, toPinId: 'd27', signal: 0 },
    { id: 'wm0', fromCompId: hi.id, fromPinId: 'out', toCompId: mux.id, toPinId: 's0', signal: 0 },
    { id: 'wm1', fromCompId: hi.id, fromPinId: 'out', toCompId: mux.id, toPinId: 's1', signal: 0 },
    { id: 'wm3', fromCompId: hi.id, fromPinId: 'out', toCompId: mux.id, toPinId: 's3', signal: 0 },
    { id: 'wm4', fromCompId: hi.id, fromPinId: 'out', toCompId: mux.id, toPinId: 's4', signal: 0 }
  ];
  solveNetwork([din, hi, dmx, mux], wires, false);
  assert.equal(dmx.pinValues.y27, 0xA55An);
  assert.equal(dmx.pinValues.y0, 0n);
  assert.equal(mux.pinValues.y, 0xA55An);

  // DEC_5TO32 -> ENC_32TO5 round-trip for index 27
  const dec = createComponent('DEC_5TO32', 100, 300);
  const enc = createComponent('ENC_32TO5', 300, 300);
  const decWires = [
    { id: 'de', fromCompId: hi.id, fromPinId: 'out', toCompId: dec.id, toPinId: 'en', signal: 0 },
    { id: 'da0', fromCompId: hi.id, fromPinId: 'out', toCompId: dec.id, toPinId: 'a0', signal: 0 },
    { id: 'da1', fromCompId: hi.id, fromPinId: 'out', toCompId: dec.id, toPinId: 'a1', signal: 0 },
    { id: 'da3', fromCompId: hi.id, fromPinId: 'out', toCompId: dec.id, toPinId: 'a3', signal: 0 },
    { id: 'da4', fromCompId: hi.id, fromPinId: 'out', toCompId: dec.id, toPinId: 'a4', signal: 0 },
    { id: 'dy27', fromCompId: dec.id, fromPinId: 'y27', toCompId: enc.id, toPinId: 'i27', signal: 0 }
  ];
  solveNetwork([hi, dec, enc], decWires, false);
  assert.equal(dec.pinValues.y27, 1);
  assert.equal(dec.pinValues.y26, 0);
  assert.equal(enc.pinValues.v, 1);
  assert.equal(enc.pinValues.y4, 1);
  assert.equal(enc.pinValues.y3, 1);
  assert.equal(enc.pinValues.y2, 0);
  assert.equal(enc.pinValues.y1, 1);
  assert.equal(enc.pinValues.y0, 1);
});

test('Sequential, Memory & IO additions: RS_FF, PULSE_ONE, FIFO_N, REG_FILE_N, DUAL_RAM_N, LCD_TEXT, TONE_GEN', () => {
  // RS_FF + PULSE_ONE
  const clk = createComponent('SWITCH', 0, 0, { initialValue: 0 });
  const s = createComponent('SWITCH', 0, 40, { initialValue: 1 });
  const r = createComponent('SWITCH', 0, 80, { initialValue: 0 });
  const rs = createComponent('RS_FF', 140, 40);
  const pulse = createComponent('PULSE_ONE', 140, 140);
  const rsWires = [
    { id: 'ws', fromCompId: s.id, fromPinId: 'out', toCompId: rs.id, toPinId: 's', signal: 0 },
    { id: 'wr', fromCompId: r.id, fromPinId: 'out', toCompId: rs.id, toPinId: 'r', signal: 0 },
    { id: 'wc', fromCompId: clk.id, fromPinId: 'out', toCompId: rs.id, toPinId: 'clk', signal: 0 },
    { id: 'wt', fromCompId: s.id, fromPinId: 'out', toCompId: pulse.id, toPinId: 'trig', signal: 0 },
    { id: 'wpc', fromCompId: clk.id, fromPinId: 'out', toCompId: pulse.id, toPinId: 'clk', signal: 0 }
  ];
  const tick = (comps: typeof s[], wires: typeof rsWires) => {
    clk.internalState.value = 0;
    evaluateCircuitDeterministic(comps, wires, 0);
    clk.internalState.value = 1;
    evaluateCircuitDeterministic(comps, wires, 0);
  };
  tick([clk, s, r, rs, pulse], rsWires);
  assert.equal(rs.pinValues.q, 1);
  assert.equal(pulse.pinValues.q, 1); // 1st rising edge with trig=1 -> pulse=1
  tick([clk, s, r, rs, pulse], rsWires);
  assert.equal(pulse.pinValues.q, 0); // 2nd rising edge while trig stays 1 -> pulse=0

  // FIFO_N
  const fd = createComponent('CONST_N', 0, 0, { bits: 16, initialValue: 0x1111n });
  const push = createComponent('SWITCH', 0, 40, { initialValue: 1 });
  const pop = createComponent('SWITCH', 0, 80, { initialValue: 0 });
  const fifo = createComponent('FIFO_N', 150, 40, { bits: 16 });
  const fWires = [
    { id: 'f1', fromCompId: fd.id, fromPinId: 'out', toCompId: fifo.id, toPinId: 'd', signal: 0 },
    { id: 'f2', fromCompId: push.id, fromPinId: 'out', toCompId: fifo.id, toPinId: 'push', signal: 0 },
    { id: 'f3', fromCompId: pop.id, fromPinId: 'out', toCompId: fifo.id, toPinId: 'pop', signal: 0 },
    { id: 'f4', fromCompId: clk.id, fromPinId: 'out', toCompId: fifo.id, toPinId: 'clk', signal: 0 }
  ];
  tick([clk, fd, push, pop, fifo], fWires);
  fd.internalState.value = 0x2222n;
  tick([clk, fd, push, pop, fifo], fWires);
  assert.equal(fifo.pinValues.cnt, 2n);
  assert.equal(fifo.pinValues.q, 0x1111n);
  push.internalState.value = 0;
  pop.internalState.value = 1;
  tick([clk, fd, push, pop, fifo], fWires);
  assert.equal(fifo.pinValues.cnt, 1n);
  assert.equal(fifo.pinValues.q, 0x2222n);

  // REG_FILE_N + DUAL_RAM_N
  const rf = createComponent('REG_FILE_N', 150, 0, { bits: 16 });
  const ra = createComponent('CONST_N', 0, 0, { bits: 3, initialValue: 3n });
  const rb = createComponent('CONST_N', 0, 30, { bits: 3, initialValue: 5n });
  const wa = createComponent('CONST_N', 0, 60, { bits: 3, initialValue: 3n });
  const wd = createComponent('CONST_N', 0, 90, { bits: 16, initialValue: 0xCAFEn });
  const hi = createComponent('HIGH', 0, 120);
  const rfWires = [
    { id: 'r1', fromCompId: ra.id, fromPinId: 'out', toCompId: rf.id, toPinId: 'ra', signal: 0 },
    { id: 'r2', fromCompId: rb.id, fromPinId: 'out', toCompId: rf.id, toPinId: 'rb', signal: 0 },
    { id: 'r3', fromCompId: wa.id, fromPinId: 'out', toCompId: rf.id, toPinId: 'wa', signal: 0 },
    { id: 'r4', fromCompId: wd.id, fromPinId: 'out', toCompId: rf.id, toPinId: 'wd', signal: 0 },
    { id: 'r5', fromCompId: hi.id, fromPinId: 'out', toCompId: rf.id, toPinId: 'we', signal: 0 },
    { id: 'r6', fromCompId: clk.id, fromPinId: 'out', toCompId: rf.id, toPinId: 'clk', signal: 0 }
  ];
  tick([clk, rf, ra, rb, wa, wd, hi], rfWires);
  assert.equal(rf.pinValues.qa, 0xCAFEn);

  const dram = createComponent('DUAL_RAM_N', 150, 0, { bits: 16, addrBits: 4 });
  const aa = createComponent('CONST_N', 0, 0, { bits: 4, initialValue: 2n });
  const ab = createComponent('CONST_N', 0, 30, { bits: 4, initialValue: 2n });
  const drWires = [
    { id: 'd1', fromCompId: aa.id, fromPinId: 'out', toCompId: dram.id, toPinId: 'aa', signal: 0 },
    { id: 'd2', fromCompId: ab.id, fromPinId: 'out', toCompId: dram.id, toPinId: 'ab', signal: 0 },
    { id: 'd3', fromCompId: wd.id, fromPinId: 'out', toCompId: dram.id, toPinId: 'da', signal: 0 },
    { id: 'd4', fromCompId: hi.id, fromPinId: 'out', toCompId: dram.id, toPinId: 'we', signal: 0 },
    { id: 'd5', fromCompId: clk.id, fromPinId: 'out', toCompId: dram.id, toPinId: 'clk', signal: 0 }
  ];
  tick([clk, dram, aa, ab, wd, hi], drWires);
  assert.equal(dram.pinValues.qa, 0xCAFEn);
  assert.equal(dram.pinValues.qb, 0xCAFEn);

  // LCD_TEXT preset writes "HELLO LOGIC 64b!" cleanly across 16 rising edges
  const lcdPreset = buildPresetCircuit('lcd_terminal');
  const lcdClk = lcdPreset.components.find(c => c.type === 'CLOCK')!;
  const lcdComp = lcdPreset.components.find(c => c.type === 'LCD_TEXT')!;
  for (let i = 0; i < 16; i++) {
    lcdClk.internalState.clockOut = 0;
    evaluateCircuitDeterministic(lcdPreset.components, lcdPreset.wires, 0);
    lcdClk.internalState.clockOut = 1;
    evaluateCircuitDeterministic(lcdPreset.components, lcdPreset.wires, 0);
  }
  const line0 = String.fromCharCode(...Array.from(lcdComp.internalState.lcdChars!.slice(0, 16)));
  assert.equal(line0, 'HELLO LOGIC 64b!');

  // TONE_GEN pin presence
  const tone = createComponent('TONE_GEN', 0, 0);
  assert.equal(tone.pins.map(p => p.id).join(','), 'freq,wave,gate');
});

test('LogicScript supports BUS_SLICE slice=HI:LO and new component aliases', () => {
  const script = `
    place src = CONST_N bits=32 value=0x12345678
    place sl = SLICE bits=32 slice=15:8
    place bar = BAR8 bits=8
    connect src.out -> sl.in0
    connect sl.out -> bar.d
  `;
  const compiled = compileLogicScript(script);
  assert.equal(compiled.errors.length, 0);
  solveNetwork(compiled.components!, compiled.wireList!, false);
  const bar = compiled.components!.find(c => c.type === 'LED_BAR_8')!;
  assert.equal(bar.pinValues.d, 0x56n);
});

test('Boolean synth + truth table + challenge validator work end-to-end', () => {
  const synth = synthesizeBooleanCircuit('(A XOR B) AND C');
  const tt = computeTruthTable(synth.components, synth.wires);
  assert.ok(tt !== null);
  assert.equal(tt.rows.length, 8);

  const xorChal = CHALLENGES.find(c => c.id === 'xor')!;
  const a = createComponent('SWITCH', 0, 0, { label: 'A' });
  const b = createComponent('SWITCH', 0, 60, { label: 'B' });
  const g = createComponent('XOR', 100, 30);
  const y = createComponent('LED', 200, 30, { label: 'Y' });
  const wires = [
    { id: 'w1', fromCompId: a.id, fromPinId: 'out', toCompId: g.id, toPinId: 'in0', signal: 0 },
    { id: 'w2', fromCompId: b.id, fromPinId: 'out', toCompId: g.id, toPinId: 'in1', signal: 0 },
    { id: 'w3', fromCompId: g.id, fromPinId: 'out', toCompId: y.id, toPinId: 'in0', signal: 0 }
  ];
  const res = validateChallenge(xorChal, [a, b, g, y], wires);
  assert.equal(res.ok, true);
});

test('VGA 64x48 pattern preset renders colorful RGB332 frame and returns TURBO multiplier', () => {
  const built = buildPresetCircuit('vga_pattern');
  assert.equal(built.recommendedMultiplier, 3000);
  const clk = built.components.find(c => c.type === 'CLOCK')!;
  const vga = built.components.find(c => c.type === 'VGA_SCREEN')!;
  for (let i = 0; i < 3100; i++) {
    clk.internalState.clockOut = 0;
    evaluateCircuitDeterministic(built.components, built.wires, 0);
    clk.internalState.clockOut = 1;
    evaluateCircuitDeterministic(built.components, built.wires, 0);
  }
  const front = vga.internalState.vgaFront!;
  let nonZero = 0;
  for (let i = 0; i < front.length; i++) {
    if (front[i] !== 0) nonZero++;
  }
  assert.ok(nonZero > 2500, `Expected >2500 visible VGA pattern pixels, got ${nonZero}`);
});

test('Logisim-evolution (.circ) exporter converts live circuit components, memory, and wires to valid XML', () => {
  const sw = createComponent('SWITCH', 0, 0, { label: 'EN' });
  const gate = createComponent('AND', 120, 20, { label: 'G1', bits: 1 });
  const led = createComponent('LED', 240, 20, { label: 'OUT' });
  const rom = createComponent('ROM_N', 120, 180, { label: 'PROG', bits: 8, addrBits: 4, mem: [0x12n, 0x34n, 0xABn] });
  const wires = [
    { id: 'w1', fromCompId: sw.id, fromPinId: 'out', toCompId: gate.id, toPinId: 'in0', signal: 0 },
    { id: 'w2', fromCompId: gate.id, fromPinId: 'out', toCompId: led.id, toPinId: 'in0', signal: 0 }
  ];
  const res = exportCircuitToLogisimCirc([sw, gate, led, rom], wires, 'mi_circuito');
  assert.equal(res.compCount, 4);
  assert.equal(res.wireCount, 2);
  assert.ok(res.xml.includes('<project source="3.8.0" version="1.0">'));
  assert.ok(res.xml.includes('<circuit name="mi_circuito">'));
  assert.ok(res.xml.includes('name="AND Gate"'));
  assert.ok(res.xml.includes('name="ROM"'));
  assert.ok(res.xml.includes('addr/data: 4 8\n12 34 ab'));
  assert.ok(res.xml.includes('<wire from='));
});

test('New components: NUM_STEPPER, MAC_N, PWM_GEN, RING_CNT, CRC8_GEN, UART_TX/RX, DEC_DISPLAY_N, TRAFFIC_LIGHT', () => {
  // NUM_STEPPER + DEC_DISPLAY_N + TRAFFIC_LIGHT
  const step = createComponent('NUM_STEPPER', 0, 0, { bits: 8, initialValue: 42n });
  const disp = createComponent('DEC_DISPLAY_N', 160, 0, { bits: 8, signedMode: true });
  const tl = createComponent('TRAFFIC_LIGHT', 160, 120);
  const hi = createComponent('HIGH', 0, 100);
  solveNetwork(
    [step, disp, tl, hi],
    [
      { id: 'ws1', fromCompId: step.id, fromPinId: 'out', toCompId: disp.id, toPinId: 'd', signal: 0 },
      { id: 'wt1', fromCompId: hi.id, fromPinId: 'out', toCompId: tl.id, toPinId: 'g', signal: 0 }
    ],
    false
  );
  assert.equal(step.pinValues.out, 42n);
  assert.equal(disp.pinValues.d, 42n);
  assert.equal(tl.pinValues.g, 1);

  const clk = createComponent('SWITCH', 0, 0, { initialValue: 0 });
  const tick = (comps: typeof clk[], wires: Parameters<typeof evaluateCircuitDeterministic>[1]) => {
    clk.internalState.value = 0;
    evaluateCircuitDeterministic(comps, wires, 0);
    clk.internalState.value = 1;
    evaluateCircuitDeterministic(comps, wires, 0);
  };

  // MAC_N (acc += a * b; overflow & clr)
  const macA = createComponent('CONST_N', 0, 40, { bits: 8, initialValue: 10n });
  const macB = createComponent('CONST_N', 0, 80, { bits: 8, initialValue: 20n });
  const macClr = createComponent('SWITCH', 0, 120, { initialValue: 0 });
  const mac = createComponent('MAC_N', 160, 60, { bits: 8 });
  const macWires = [
    { id: 'm1', fromCompId: macA.id, fromPinId: 'out', toCompId: mac.id, toPinId: 'a', signal: 0 },
    { id: 'm2', fromCompId: macB.id, fromPinId: 'out', toCompId: mac.id, toPinId: 'b', signal: 0 },
    { id: 'm3', fromCompId: hi.id, fromPinId: 'out', toCompId: mac.id, toPinId: 'en', signal: 0 },
    { id: 'm4', fromCompId: clk.id, fromPinId: 'out', toCompId: mac.id, toPinId: 'clk', signal: 0 },
    { id: 'm5', fromCompId: macClr.id, fromPinId: 'out', toCompId: mac.id, toPinId: 'clr', signal: 0 }
  ];
  tick([clk, macA, macB, macClr, hi, mac], macWires);
  assert.equal(mac.pinValues.acc, 200n);
  assert.equal(mac.pinValues.ovf, 0);
  tick([clk, macA, macB, macClr, hi, mac], macWires); // 200 + 200 = 400 -> 144 mod 256, ovf=1
  assert.equal(mac.pinValues.acc, 144n);
  assert.equal(mac.pinValues.ovf, 1);
  macClr.internalState.value = 1;
  tick([clk, macA, macB, macClr, hi, mac], macWires);
  assert.equal(mac.pinValues.acc, 0n);

  // PWM_GEN (duty=2 -> high for cnt=0,1 then low for cnt=2..255)
  const duty = createComponent('CONST_N', 0, 40, { bits: 8, initialValue: 2n });
  const pwm = createComponent('PWM_GEN', 160, 40);
  const pwmWires = [
    { id: 'p1', fromCompId: duty.id, fromPinId: 'out', toCompId: pwm.id, toPinId: 'duty', signal: 0 },
    { id: 'p2', fromCompId: hi.id, fromPinId: 'out', toCompId: pwm.id, toPinId: 'en', signal: 0 },
    { id: 'p3', fromCompId: clk.id, fromPinId: 'out', toCompId: pwm.id, toPinId: 'clk', signal: 0 }
  ];
  clk.internalState.value = 0;
  evaluateCircuitDeterministic([clk, duty, hi, pwm], pwmWires, 0);
  assert.equal(pwm.pinValues.pwm, 1); // cnt=0 < 2
  tick([clk, duty, hi, pwm], pwmWires); // cnt=1 < 2
  assert.equal(pwm.pinValues.pwm, 1);
  tick([clk, duty, hi, pwm], pwmWires); // cnt=2 >= 2
  assert.equal(pwm.pinValues.pwm, 0);

  // RING_CNT (ring 0x01 -> 0x02 -> 0x04; Johnson jhn=1)
  const jhn = createComponent('SWITCH', 0, 40, { initialValue: 0 });
  const ring = createComponent('RING_CNT', 160, 40);
  const ringWires = [
    { id: 'r1', fromCompId: clk.id, fromPinId: 'out', toCompId: ring.id, toPinId: 'clk', signal: 0 },
    { id: 'r2', fromCompId: hi.id, fromPinId: 'out', toCompId: ring.id, toPinId: 'en', signal: 0 },
    { id: 'r3', fromCompId: jhn.id, fromPinId: 'out', toCompId: ring.id, toPinId: 'jhn', signal: 0 }
  ];
  tick([clk, hi, jhn, ring], ringWires);
  assert.equal(ring.pinValues.q, 2n);
  tick([clk, hi, jhn, ring], ringWires);
  assert.equal(ring.pinValues.q, 4n);

  // CRC8_GEN
  const din = createComponent('CONST_N', 0, 40, { bits: 8, initialValue: 0x31n });
  const crc = createComponent('CRC8_GEN', 160, 40);
  const crcWires = [
    { id: 'c1', fromCompId: din.id, fromPinId: 'out', toCompId: crc.id, toPinId: 'din', signal: 0 },
    { id: 'c2', fromCompId: hi.id, fromPinId: 'out', toCompId: crc.id, toPinId: 'en', signal: 0 },
    { id: 'c3', fromCompId: clk.id, fromPinId: 'out', toCompId: crc.id, toPinId: 'clk', signal: 0 }
  ];
  tick([clk, din, hi, crc], crcWires);
  assert.notEqual(crc.pinValues.crc, 0n);

  // UART_TX -> UART_RX loopback over shared clock
  const txByte = createComponent('CONST_N', 0, 40, { bits: 8, initialValue: 0xA5n });
  const sendSw = createComponent('SWITCH', 0, 80, { initialValue: 1 });
  const tx = createComponent('UART_TX', 140, 40);
  const rx = createComponent('UART_RX', 300, 40);
  const uartWires = [
    { id: 'u1', fromCompId: txByte.id, fromPinId: 'out', toCompId: tx.id, toPinId: 'data', signal: 0 },
    { id: 'u2', fromCompId: sendSw.id, fromPinId: 'out', toCompId: tx.id, toPinId: 'send', signal: 0 },
    { id: 'u3', fromCompId: clk.id, fromPinId: 'out', toCompId: tx.id, toPinId: 'clk', signal: 0 },
    { id: 'u4', fromCompId: tx.id, fromPinId: 'tx', toCompId: rx.id, toPinId: 'rx', signal: 0 },
    { id: 'u5', fromCompId: clk.id, fromPinId: 'out', toCompId: rx.id, toPinId: 'clk', signal: 0 }
  ];
  tick([clk, txByte, sendSw, tx, rx], uartWires); // edge 1: TX emits START(0)
  sendSw.internalState.value = 0;
  for (let i = 0; i < 10; i++) {
    tick([clk, txByte, sendSw, tx, rx], uartWires);
  }
  assert.equal(rx.pinValues.valid, 1);
  assert.equal(rx.pinValues.err, 0);
  assert.equal(rx.pinValues.data, 0xA5n);

  // LogicScript aliases
  const ls = compileLogicScript(`
    place st = STEPPER bits=8 value=25
    place dec = DECDISP bits=8 signed=1
    connect st.out -> dec.d
  `);
  assert.equal(ls.errors.length, 0);
  assert.equal(ls.components!.find(c => c.type === 'DEC_DISPLAY_N')!.pinValues.d, 25n);
});

test('evaluateCircuitDeterministic reports false when static and increments VGA vgaVersion on swap', () => {
  const sw = createComponent('SWITCH', 0, 0, { initialValue: 1 });
  const led = createComponent('LED', 100, 0);
  const wires = [{ id: 'w1', fromCompId: sw.id, fromPinId: 'out', toCompId: led.id, toPinId: 'in0', signal: 0 }];
  evaluateCircuitDeterministic([sw, led], wires, 0.016);
  const secondChanged = evaluateCircuitDeterministic([sw, led], wires, 0.016);
  assert.equal(secondChanged, false);

  const vga = createComponent('VGA_SCREEN', 200, 0);
  const v0 = vga.internalState.vgaVersion || 0;
  const clk = createComponent('SWITCH', 0, 0, { initialValue: 0 });
  const hi = createComponent('HIGH', 0, 40);
  const vgaWires = [
    { id: 'vw1', fromCompId: hi.id, fromPinId: 'out', toCompId: vga.id, toPinId: 'swap', signal: 0 },
    { id: 'vw2', fromCompId: clk.id, fromPinId: 'out', toCompId: vga.id, toPinId: 'clk', signal: 0 }
  ];
  evaluateCircuitDeterministic([clk, hi, vga], vgaWires, 0);
  clk.internalState.value = 1;
  evaluateCircuitDeterministic([clk, hi, vga], vgaWires, 0);
  assert.ok((vga.internalState.vgaVersion || 0) > v0);
});

test('32-scene funny animation engine and anim_32_scenes preset advance scenes and drive VGA + LCD', () => {
  assert.equal(FUNNY_SCENES_32.length, 32);
  const hashes = new Set<string>();
  for (let s = 0; s < 32; s++) {
    const def = FUNNY_SCENES_32[s];
    assert.equal(def.line1.length, 16);
    assert.equal(def.line2.length, 16);
    const f0 = renderFunnyScene32Buffer(s, 0);
    const f1 = renderFunnyScene32Buffer(s, 3);
    assert.equal(f0.length, 64 * 48);
    assert.equal(f1.length, 64 * 48);
    hashes.add(Array.from(f0.slice(0, 600)).join(','));
    let subDiffs = 0;
    for (let i = 0; i < f0.length; i++) if (f0[i] !== f1[i]) subDiffs++;
    assert.ok(subDiffs > 0, `Scene ${s} (${def.title}) should animate across subframes`);
  }
  assert.ok(hashes.size >= 20, `Expected distinct visual frames across 32 scenes, got ${hashes.size}`);

  const built = buildPresetCircuit('anim_32_scenes');
  const clk = built.components.find(c => c.type === 'CLOCK')!;
  const gpu = built.components.find(c => c.type === 'ANIM32_GPU')!;
  const vga = built.components.find(c => c.type === 'VGA_SCREEN')!;
  const lcd = built.components.find(c => c.type === 'LCD_TEXT')!;
  assert.ok(clk && gpu && vga && lcd);

  // Complete 1 full frame + swap rising edge (3074 rising edges) -> scene 0 frame swaps to VGA and writes LCD line0
  for (let i = 0; i < 3075; i++) {
    clk.internalState.clockOut = 0;
    evaluateCircuitDeterministic(built.components, built.wires, 0);
    clk.internalState.clockOut = 1;
    evaluateCircuitDeterministic(built.components, built.wires, 0);
  }
  const front = vga.internalState.vgaFront!;
  let nonZero = 0;
  for (let i = 0; i < front.length; i++) if (front[i] !== 0) nonZero++;
  assert.ok(nonZero > 400, `Expected >400 non-zero RGB332 pixels on VGA from ANIM32_GPU, got ${nonZero}`);
  const lcdRow0 = String.fromCharCode(...Array.from(lcd.internalState.lcdChars!.slice(0, 16)));
  assert.equal(lcdRow0, FUNNY_SCENES_32[0].line1);
});

test('All 17 new components: combinational, sequential, DSP, and IO peripherals', () => {
  // 1. ROTARY_ENC quadrature Gray cycle
  const rot = createComponent('ROTARY_ENC', 0, 0, { initialValue: 1n });
  solveNetwork([rot], [], false);
  assert.equal(rot.pinValues.pos, 1n);
  assert.equal(rot.pinValues.a, 1);
  assert.equal(rot.pinValues.b, 0);
  rot.internalState.encPos = 2;
  solveNetwork([rot], [], false);
  assert.equal(rot.pinValues.a, 1);
  assert.equal(rot.pinValues.b, 1);

  // 2. SLIDER_ADC + VU_METER_N
  const slider = createComponent('SLIDER_ADC', 0, 0, { bits: 8, initialValue: 180n });
  const vu = createComponent('VU_METER_N', 120, 0, { bits: 8 });
  solveNetwork([slider, vu], [{ id: 'wsv', fromCompId: slider.id, fromPinId: 'out', toCompId: vu.id, toPinId: 'in0', signal: 0 }], false);
  assert.equal(slider.pinValues.out, 180n);
  assert.equal(vu.pinValues.in0, 180n);

  // 3. CROSSBAR_2X2
  const ca = createComponent('CONST_N', 0, 0, { bits: 8, initialValue: 0xAA });
  const cb = createComponent('CONST_N', 0, 40, { bits: 8, initialValue: 0x55 });
  const csw = createComponent('SWITCH', 0, 80, { initialValue: 1 });
  const xbar = createComponent('CROSSBAR_2X2', 140, 40, { bits: 8 });
  solveNetwork(
    [ca, cb, csw, xbar],
    [
      { id: 'x1', fromCompId: ca.id, fromPinId: 'out', toCompId: xbar.id, toPinId: 'a', signal: 0 },
      { id: 'x2', fromCompId: cb.id, fromPinId: 'out', toCompId: xbar.id, toPinId: 'b', signal: 0 },
      { id: 'x3', fromCompId: csw.id, fromPinId: 'out', toCompId: xbar.id, toPinId: 'swap', signal: 0 }
    ],
    false
  );
  assert.equal(xbar.pinValues.y0, 0x55n);
  assert.equal(xbar.pinValues.y1, 0xAAn);

  // 4. PRIORITY_ARB (r1 and r3 active -> r1 wins with idx=1)
  const hi = createComponent('HIGH', 0, 0);
  const arb = createComponent('PRIORITY_ARB', 120, 0);
  solveNetwork(
    [hi, arb],
    [
      { id: 'a1', fromCompId: hi.id, fromPinId: 'out', toCompId: arb.id, toPinId: 'r1', signal: 0 },
      { id: 'a2', fromCompId: hi.id, fromPinId: 'out', toCompId: arb.id, toPinId: 'r3', signal: 0 }
    ],
    false
  );
  assert.equal(arb.pinValues.g0, 0);
  assert.equal(arb.pinValues.g1, 1);
  assert.equal(arb.pinValues.g3, 0);
  assert.equal(arb.pinValues.idx, 1n);
  assert.equal(arb.pinValues.valid, 1);

  // 5. BUS_PACK4 + BUS_UNPACK4 round-trip (4 x 8-bit -> 32-bit -> 4 x 8-bit)
  const p0 = createComponent('CONST_N', 0, 0, { bits: 8, initialValue: 0x12n });
  const p1 = createComponent('CONST_N', 0, 30, { bits: 8, initialValue: 0x34n });
  const p2 = createComponent('CONST_N', 0, 60, { bits: 8, initialValue: 0x56n });
  const p3 = createComponent('CONST_N', 0, 90, { bits: 8, initialValue: 0x78n });
  const pack = createComponent('BUS_PACK4', 120, 40, { bits: 8 });
  const unpack = createComponent('BUS_UNPACK4', 260, 40, { bits: 8 });
  solveNetwork(
    [p0, p1, p2, p3, pack, unpack],
    [
      { id: 'pk0', fromCompId: p0.id, fromPinId: 'out', toCompId: pack.id, toPinId: 'i0', signal: 0 },
      { id: 'pk1', fromCompId: p1.id, fromPinId: 'out', toCompId: pack.id, toPinId: 'i1', signal: 0 },
      { id: 'pk2', fromCompId: p2.id, fromPinId: 'out', toCompId: pack.id, toPinId: 'i2', signal: 0 },
      { id: 'pk3', fromCompId: p3.id, fromPinId: 'out', toCompId: pack.id, toPinId: 'i3', signal: 0 },
      { id: 'pk4', fromCompId: pack.id, fromPinId: 'out', toCompId: unpack.id, toPinId: 'in0', signal: 0 }
    ],
    false
  );
  assert.equal(pack.pinValues.out, 0x78563412n);
  assert.equal(unpack.pinValues.o0, 0x12n);
  assert.equal(unpack.pinValues.o3, 0x78n);

  // 6. SAT_ADDER_N (unsigned clamp 200+100 -> 255, sat=1; signed clamp 100+100 -> 127, sat=1)
  const sa = createComponent('CONST_N', 0, 0, { bits: 8, initialValue: 200n });
  const sb = createComponent('CONST_N', 0, 30, { bits: 8, initialValue: 100n });
  const satU = createComponent('SAT_ADDER_N', 120, 15, { bits: 8, signedMode: false });
  solveNetwork(
    [sa, sb, satU],
    [
      { id: 'su1', fromCompId: sa.id, fromPinId: 'out', toCompId: satU.id, toPinId: 'a', signal: 0 },
      { id: 'su2', fromCompId: sb.id, fromPinId: 'out', toCompId: satU.id, toPinId: 'b', signal: 0 }
    ],
    false
  );
  assert.equal(satU.pinValues.s, 255n);
  assert.equal(satU.pinValues.sat, 1);
  satU.signedMode = true;
  sa.internalState.value = 100n;
  solveNetwork(
    [sa, sb, satU],
    [
      { id: 'su1', fromCompId: sa.id, fromPinId: 'out', toCompId: satU.id, toPinId: 'a', signal: 0 },
      { id: 'su2', fromCompId: sb.id, fromPinId: 'out', toCompId: satU.id, toPinId: 'b', signal: 0 }
    ],
    false
  );
  assert.equal(satU.pinValues.s, 127n);
  assert.equal(satU.pinValues.sat, 1);

  // 7. SQRT_N (sqrt(200) -> root=14, rem=4)
  const sqIn = createComponent('CONST_N', 0, 0, { bits: 16, initialValue: 200n });
  const sqrtN = createComponent('SQRT_N', 120, 0, { bits: 16 });
  solveNetwork([sqIn, sqrtN], [{ id: 'wsq', fromCompId: sqIn.id, fromPinId: 'out', toCompId: sqrtN.id, toPinId: 'in0', signal: 0 }], false);
  assert.equal(sqrtN.pinValues.root, 14n);
  assert.equal(sqrtN.pinValues.rem, 4n);

  // 8. COMP_WIN_N (lo=20, hi=50, x=35 -> inw=1; x=10 -> below=1)
  const wx = createComponent('CONST_N', 0, 0, { bits: 8, initialValue: 35n });
  const wlo = createComponent('CONST_N', 0, 30, { bits: 8, initialValue: 20n });
  const whi = createComponent('CONST_N', 0, 60, { bits: 8, initialValue: 50n });
  const win = createComponent('COMP_WIN_N', 120, 30, { bits: 8 });
  const winWires = [
    { id: 'wn1', fromCompId: wx.id, fromPinId: 'out', toCompId: win.id, toPinId: 'x', signal: 0 },
    { id: 'wn2', fromCompId: wlo.id, fromPinId: 'out', toCompId: win.id, toPinId: 'lo', signal: 0 },
    { id: 'wn3', fromCompId: whi.id, fromPinId: 'out', toCompId: win.id, toPinId: 'hi', signal: 0 }
  ];
  solveNetwork([wx, wlo, whi, win], winWires, false);
  assert.equal(win.pinValues.inw, 1);
  assert.equal(win.pinValues.below, 0);
  assert.equal(win.pinValues.above, 0);
  wx.internalState.value = 10n;
  solveNetwork([wx, wlo, whi, win], winWires, false);
  assert.equal(win.pinValues.below, 1);
  assert.equal(win.pinValues.inw, 0);

  // Sequential helper
  const clk = createComponent('SWITCH', 0, 0, { initialValue: 0 });
  const tick = (comps: typeof clk[], wires: Parameters<typeof evaluateCircuitDeterministic>[1]) => {
    clk.internalState.value = 0;
    evaluateCircuitDeterministic(comps, wires, 0);
    clk.internalState.value = 1;
    evaluateCircuitDeterministic(comps, wires, 0);
  };

  // 9. MOD_COUNTER_N (mod=3: 0 -> 1 -> 2(wrap=1) -> 0)
  const modC = createComponent('CONST_N', 0, 40, { bits: 8, initialValue: 3n });
  const modCnt = createComponent('MOD_COUNTER_N', 140, 40, { bits: 8 });
  const modWires = [
    { id: 'mc1', fromCompId: clk.id, fromPinId: 'out', toCompId: modCnt.id, toPinId: 'clk', signal: 0 },
    { id: 'mc2', fromCompId: hi.id, fromPinId: 'out', toCompId: modCnt.id, toPinId: 'en', signal: 0 },
    { id: 'mc3', fromCompId: modC.id, fromPinId: 'out', toCompId: modCnt.id, toPinId: 'mod', signal: 0 }
  ];
  tick([clk, hi, modC, modCnt], modWires);
  assert.equal(modCnt.pinValues.q, 1n);
  tick([clk, hi, modC, modCnt], modWires);
  assert.equal(modCnt.pinValues.q, 2n);
  assert.equal(modCnt.pinValues.wrap, 1);
  tick([clk, hi, modC, modCnt], modWires);
  assert.equal(modCnt.pinValues.q, 0n);

  // 10. WATCHDOG_N (lim=2 -> barks after 2 ticks without kick; kick rising edge resets)
  const wdLim = createComponent('CONST_N', 0, 40, { bits: 8, initialValue: 2n });
  const wdKick = createComponent('SWITCH', 0, 80, { initialValue: 0 });
  const wdog = createComponent('WATCHDOG_N', 140, 60, { bits: 8 });
  const wdWires = [
    { id: 'wd1', fromCompId: clk.id, fromPinId: 'out', toCompId: wdog.id, toPinId: 'clk', signal: 0 },
    { id: 'wd2', fromCompId: wdKick.id, fromPinId: 'out', toCompId: wdog.id, toPinId: 'kick', signal: 0 },
    { id: 'wd3', fromCompId: wdLim.id, fromPinId: 'out', toCompId: wdog.id, toPinId: 'lim', signal: 0 }
  ];
  tick([clk, wdLim, wdKick, wdog], wdWires);
  assert.equal(wdog.pinValues.bark, 0);
  tick([clk, wdLim, wdKick, wdog], wdWires);
  assert.equal(wdog.pinValues.bark, 1);
  wdKick.internalState.value = 1;
  clk.internalState.value = 0;
  evaluateCircuitDeterministic([clk, wdLim, wdKick, wdog], wdWires, 0);
  assert.equal(wdog.pinValues.cnt, 0n);
  assert.equal(wdog.pinValues.bark, 0);
  clk.internalState.value = 1;
  evaluateCircuitDeterministic([clk, wdLim, wdKick, wdog], wdWires, 0);
  assert.equal(wdog.pinValues.cnt, 1n);

  // 11. DEBOUNCER (requires 4 consecutive rising edges at new state)
  const rawSw = createComponent('SWITCH', 0, 40, { initialValue: 1 });
  const deb = createComponent('DEBOUNCER', 140, 40);
  const debWires = [
    { id: 'db1', fromCompId: rawSw.id, fromPinId: 'out', toCompId: deb.id, toPinId: 'in0', signal: 0 },
    { id: 'db2', fromCompId: clk.id, fromPinId: 'out', toCompId: deb.id, toPinId: 'clk', signal: 0 }
  ];
  for (let i = 0; i < 3; i++) {
    tick([clk, rawSw, deb], debWires);
    assert.equal(deb.pinValues.out, 0);
  }
  tick([clk, rawSw, deb], debWires);
  assert.equal(deb.pinValues.out, 1);

  // 12. STOPWATCH_N (run=1 advances, lap=1 freezes q output while internal ticks keep counting)
  const swLap = createComponent('SWITCH', 0, 40, { initialValue: 0 });
  const swComp = createComponent('STOPWATCH_N', 140, 40, { bits: 8 });
  const swWires = [
    { id: 'sw1', fromCompId: clk.id, fromPinId: 'out', toCompId: swComp.id, toPinId: 'clk', signal: 0 },
    { id: 'sw2', fromCompId: hi.id, fromPinId: 'out', toCompId: swComp.id, toPinId: 'start', signal: 0 },
    { id: 'sw3', fromCompId: swLap.id, fromPinId: 'out', toCompId: swComp.id, toPinId: 'lap', signal: 0 }
  ];
  tick([clk, hi, swLap, swComp], swWires);
  assert.equal(swComp.pinValues.q, 1n);
  swLap.internalState.value = 1;
  tick([clk, hi, swLap, swComp], swWires);
  assert.equal(swComp.pinValues.q, 1n); // frozen on lap
  swLap.internalState.value = 0;
  tick([clk, hi, swLap, swComp], swWires);
  assert.equal(swComp.pinValues.q, 3n); // catches up on unlap

  // 13. CRC16_GEN + TEXT_CONSOLE
  const chConst = createComponent('CONST_N', 0, 40, { bits: 8, initialValue: 0x41n }); // 'A'
  const crc16 = createComponent('CRC16_GEN', 140, 40);
  const consoleComp = createComponent('TEXT_CONSOLE', 140, 160);
  const ctWires = [
    { id: 'ct1', fromCompId: chConst.id, fromPinId: 'out', toCompId: crc16.id, toPinId: 'd', signal: 0 },
    { id: 'ct2', fromCompId: hi.id, fromPinId: 'out', toCompId: crc16.id, toPinId: 'en', signal: 0 },
    { id: 'ct3', fromCompId: clk.id, fromPinId: 'out', toCompId: crc16.id, toPinId: 'clk', signal: 0 },
    { id: 'ct4', fromCompId: chConst.id, fromPinId: 'out', toCompId: consoleComp.id, toPinId: 'char', signal: 0 },
    { id: 'ct5', fromCompId: hi.id, fromPinId: 'out', toCompId: consoleComp.id, toPinId: 'we', signal: 0 },
    { id: 'ct6', fromCompId: clk.id, fromPinId: 'out', toCompId: consoleComp.id, toPinId: 'clk', signal: 0 }
  ];
  tick([clk, chConst, hi, crc16, consoleComp], ctWires);
  assert.notEqual(crc16.pinValues.crc, 0xffffn);
  chConst.internalState.value = 0x4Bn; // 'K'
  tick([clk, chConst, hi, crc16, consoleComp], ctWires);
  assert.equal(consoleComp.internalState.textLines![0], 'AK');
  assert.equal(consoleComp.pinValues.len, 2n);
});

test('LogicScript v2: macro/call, let arithmetic, nested for, pin ranges, ASCII/repeat mem, and AI diagnostics', () => {
  const v2Script = `
    macro stage(idx, yPos)
      place r_{idx} = REG_4 label="R{idx}" at 200,{yPos}
      place next_{idx} = REG_4 label="N{idx}" at +140,+0
      connect r_{idx}.q0..q3 -> next_{idx}.d0..d3
    endmacro

    for row in 0..1
      for col in 0..1
        let idx = row * 2 + col
        let yCoord = row * 120 + col * 60
        call stage(idx, yCoord)
      end
    end

    place hi = HIGH at 0,0
    place rom = ROM_N bits=8 addrBits=4 mem="OK!" at 0,100
    place rpt = ROM_N bits=8 addrBits=4 mem=0xAA*3,0x55 at 0,200
  `;
  const compiled = compileLogicScript(v2Script);
  assert.equal(compiled.errors.length, 0);
  assert.equal(compiled.components!.length, 11);
  const rom = compiled.components!.find(c => c.type === 'ROM_N' && c.internalState.mem![0] === BigInt('O'.charCodeAt(0)))!;
  assert.ok(rom);
  assert.equal(rom.internalState.mem![1], BigInt('K'.charCodeAt(0)));
  assert.equal(rom.internalState.mem![2], BigInt('!'.charCodeAt(0)));
  const rpt = compiled.components!.find(c => c.type === 'ROM_N' && c.internalState.mem![0] === 0xAAn)!;
  assert.ok(rpt);
  assert.equal(rpt.internalState.mem![2], 0xAAn);
  assert.equal(rpt.internalState.mem![3], 0x55n);

  // Error diagnostics with sourceLine, suggestion (Levenshtein), and AI copyable prompt
  const badScript = `place sw = SWITCH\nplace g1 = ANND\nconnect sw.out -> g1.in0`;
  const bad = compileLogicScript(badScript);
  assert.ok(bad.errors.length >= 1);
  const firstErr = bad.errors[0];
  assert.equal(firstErr.line, 2);
  assert.ok(firstErr.sourceLine?.includes('ANND'));
  assert.ok(firstErr.suggestion?.includes('AND'));
  const aiMsg = formatLogicScriptDiagnosticsForAI(badScript, bad.errors, bad.warnings, true);
  assert.ok(aiMsg.includes('Línea 2'));
  assert.ok(aiMsg.includes('ANND'));
  assert.ok(aiMsg.includes('```logicscript'));
});


