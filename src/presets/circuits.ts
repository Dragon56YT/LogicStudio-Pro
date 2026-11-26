import { createComponent } from '../engine/catalog';
import { DEFAULT_DOOM_MAP } from '../engine/simulator';
import { LogicComponent, Wire, genId } from '../engine/types';

export interface PresetMeta {
  id: string;
  label: string;
  recommendedMultiplier?: number;
}

export const PRESET_LIST: PresetMeta[] = [
  { id: 'demo', label: '1. Demo Bienvenida + LED RGB' },
  { id: 'full_adder', label: '2. Sumador Completo (Full Adder)' },
  { id: 'counter_hex', label: '3. Contador 4-Bit + Display Hex' },
  { id: 'traffic_light', label: '4. Semáforo Automático Secuencial' },
  { id: 'flipflops', label: '5. Memorias: Latch SR y Flip-Flop D' },
  { id: 'mux_4to1', label: '6. Multiplexor 4:1 (Selector)' },
  { id: 'bcd_7seg', label: '7. Contador Decimal BIN→BCD + 4 Dígitos' },
  { id: 'ring_osc', label: '8. Oscilador en Anillo (Realimentación)' },
  { id: 'bus_alu64', label: '9. Bus 64-Bit + Splitter + ALU 64-Bit' },
  { id: 'tunnels_demo', label: '10. Túneles Inalámbricos (Cero Cruces)' },
  { id: 'risc_cpu16', label: '11. Procesador RISC 16-Bit (Regs + ROM + ALU + DualRAM)' },
  { id: 'lcd_terminal', label: '12. Terminal LCD 16×2 ASCII + ROM Mensajes' },
  { id: 'vga_pattern', label: '13. Pantalla VGA 64×48 (Generador Hardware)', recommendedMultiplier: 3000 },
  { id: 'chiptune_synth', label: '14. Sintetizador ROM Audio Hz + Barra LED + Matriz 8×8' },
  { id: 'doom_3d', label: '15. DOOM 3D Raycaster Funcional (Gamepad + ROM + VGA)', recommendedMultiplier: 3000 },
  { id: 'anim_32_scenes', label: '16. 🎬 Animación 32 Escenas: Pepe el Bot vs El Bug', recommendedMultiplier: 3000 },
  { id: 'uart_crc_console', label: '17. Terminal Serie + CRC-16 + Cola FIFO Hardware' },
  { id: 'dsp_math_vumeter', label: '18. Laboratorio DSP: √N, Sumador Saturado, ADC y Vúmetro' },
  { id: 'watchdog_mod_safety', label: '19. Seguridad HW: Watchdog, Antirrebote y Contador Mod-M' }
];

export function buildPresetCircuit(key: string): {
  components: LogicComponent[];
  wires: Wire[];
  recommendedMultiplier?: number;
} {
  const components: LogicComponent[] = [];
  const wires: Wire[] = [];

  const add = (type: string, x: number, y: number, opts: Parameters<typeof createComponent>[3] = {}) => {
    const c = createComponent(type, x, y, { ...opts, noAnim: true });
    components.push(c);
    return c;
  };
  const link = (c1: LogicComponent, p1: string, c2: LogicComponent, p2: string) => {
    wires.push({
      id: genId('w'),
      fromCompId: c1.id,
      fromPinId: p1,
      toCompId: c2.id,
      toPinId: p2,
      signal: 0
    });
  };

  if (key === 'demo') {
    add('LABEL', 0, -195, { noteText: 'LogicStudio Pro Beta 0.3 — Escalabilidad 64-Bit' });
    const swA = add('SWITCH', -240, -100, { label: 'A', initialValue: 1 });
    const swB = add('SWITCH', -240, -30, { label: 'B', initialValue: 1 });
    const gateAnd = add('AND', -90, -65, { label: 'AND' });
    const ledAnd = add('LED', 50, -65, { label: 'A·B', color: 'cyan', probe: true });
    link(swA, 'out', gateAnd, 'in0');
    link(swB, 'out', gateAnd, 'in1');
    link(gateAnd, 'out', ledAnd, 'in0');

    const swR = add('SWITCH', -240, 50, { label: 'R', initialValue: 1 });
    const swG = add('SWITCH', -240, 105, { label: 'G', initialValue: 0 });
    const swBl = add('SWITCH', -240, 160, { label: 'B', initialValue: 1 });
    const rgb = add('LED_RGB', -90, 105, { label: 'Mezcla RGB' });
    link(swR, 'out', rgb, 'r');
    link(swG, 'out', rgb, 'g');
    link(swBl, 'out', rgb, 'b');

    const clk = add('CLOCK', 140, -40, { label: 'Reloj' });
    const en = add('HIGH', 140, 20);
    const cnt = add('COUNTER_4', 270, -10, { label: 'Contador' });
    const hex = add('HEX_DISPLAY', 410, -10, { label: 'Hex', color: 'emerald' });
    link(clk, 'out', cnt, 'clk');
    link(en, 'out', cnt, 'en');
    link(cnt, 'q3', hex, 'd3');
    link(cnt, 'q2', hex, 'd2');
    link(cnt, 'q1', hex, 'd1');
    link(cnt, 'q0', hex, 'd0');
  } else if (key === 'full_adder') {
    const a = add('SWITCH', -240, -70, { label: 'A', initialValue: 1 });
    const b = add('SWITCH', -240, 0, { label: 'B', initialValue: 1 });
    const cin = add('SWITCH', -240, 90, { label: 'Cin', initialValue: 0 });
    const xor1 = add('XOR', -100, -35);
    const xor2 = add('XOR', 50, -10);
    const and1 = add('AND', -100, 50);
    const and2 = add('AND', 50, 75);
    const or1 = add('OR', 180, 62);
    const sumLed = add('LED', 300, -10, { label: 'SUMA', color: 'cyan', probe: true });
    const coutLed = add('LED', 300, 62, { label: 'ACARREO', color: 'amber', probe: true });

    link(a, 'out', xor1, 'in0');
    link(b, 'out', xor1, 'in1');
    link(xor1, 'out', xor2, 'in0');
    link(cin, 'out', xor2, 'in1');
    link(xor2, 'out', sumLed, 'in0');

    link(a, 'out', and1, 'in0');
    link(b, 'out', and1, 'in1');
    link(xor1, 'out', and2, 'in0');
    link(cin, 'out', and2, 'in1');
    link(and2, 'out', or1, 'in0');
    link(and1, 'out', or1, 'in1');
    link(or1, 'out', coutLed, 'in0');
  } else if (key === 'counter_hex') {
    const clk = add('CLOCK', -210, -30, { label: 'CLK' });
    const en = add('SWITCH', -210, 30, { label: 'ENABLE', initialValue: 1 });
    const rst = add('BUTTON', -210, 90, { label: 'RESET' });
    const cnt = add('COUNTER_4', -40, 10, { label: 'Contador 4b', probe: true });
    const hex = add('HEX_DISPLAY', 130, -30, { label: 'HEX', color: 'cyan' });
    const bar = add('LED_BAR_4', 130, 70, { label: 'BINARIO', color: 'emerald' });

    link(clk, 'out', cnt, 'clk');
    link(en, 'out', cnt, 'en');
    link(rst, 'out', cnt, 'rst');
    (['q3', 'q2', 'q1', 'q0'] as const).forEach((q, i) => {
      link(cnt, q, hex, `d${3 - i}`);
      link(cnt, q, bar, `b${3 - i}`);
    });
  } else if (key === 'traffic_light') {
    add('LABEL', 0, -150, { noteText: 'Controlador de Semáforo Secuencial' });
    const clk = add('CLOCK', -250, -20, { label: 'Reloj' });
    const en = add('HIGH', -250, 40);
    const cnt = add('COUNTER_4', -110, 0, { label: 'Estado' });
    const not1 = add('NOT', 30, -60);
    const not0 = add('NOT', 30, 60);
    const andGreen = add('AND', 150, 65, { label: 'Verde' });
    const ledRed = add('LED', 270, -65, { label: 'ROJO', color: 'rose', probe: true });
    const ledAmb = add('LED', 270, 0, { label: 'ÁMBAR', color: 'amber', probe: true });
    const ledGrn = add('LED', 270, 65, { label: 'VERDE', color: 'emerald', probe: true });

    link(clk, 'out', cnt, 'clk');
    link(en, 'out', cnt, 'en');
    link(cnt, 'q1', not1, 'in0');
    link(cnt, 'q0', not0, 'in0');

    link(cnt, 'q1', ledRed, 'in0');
    link(not1, 'out', andGreen, 'in0');
    link(not0, 'out', andGreen, 'in1');
    link(andGreen, 'out', ledGrn, 'in0');

    const andAmb = add('AND', 150, 0);
    link(not1, 'out', andAmb, 'in0');
    link(cnt, 'q0', andAmb, 'in1');
    link(andAmb, 'out', ledAmb, 'in0');
  } else if (key === 'flipflops') {
    const s = add('SWITCH', -230, -90, { label: 'SET', initialValue: 1 });
    const r = add('SWITCH', -230, -30, { label: 'RESET', initialValue: 0 });
    const sr = add('SR_LATCH', -80, -60, { label: 'Latch SR' });
    const lq1 = add('LED', 60, -80, { label: 'Q', color: 'cyan' });
    const lqn1 = add('LED', 60, -35, { label: 'Q̅', color: 'rose' });
    link(s, 'out', sr, 's');
    link(r, 'out', sr, 'r');
    link(sr, 'q', lq1, 'in0');
    link(sr, 'qn', lqn1, 'in0');

    const d = add('SWITCH', -230, 50, { label: 'DATO D', initialValue: 1 });
    const clk = add('BUTTON', -230, 110, { label: 'PULSO CLK' });
    const dff = add('D_FF', -80, 80, { label: 'Flip-Flop D' });
    const lq2 = add('LED', 60, 60, { label: 'Q', color: 'emerald' });
    const lqn2 = add('LED', 60, 105, { label: 'Q̅', color: 'amber' });
    link(d, 'out', dff, 'd');
    link(clk, 'out', dff, 'clk');
    link(dff, 'q', lq2, 'in0');
    link(dff, 'qn', lqn2, 'in0');
  } else if (key === 'mux_4to1') {
    const d0 = add('SWITCH', -220, -105, { label: 'D0', initialValue: 1 });
    const d1 = add('SWITCH', -220, -45, { label: 'D1', initialValue: 0 });
    const d2 = add('SWITCH', -220, 15, { label: 'D2', initialValue: 1 });
    const d3 = add('SWITCH', -220, 75, { label: 'D3', initialValue: 0 });
    const s0 = add('SWITCH', -80, 130, { label: 'S0', initialValue: 0 });
    const s1 = add('SWITCH', 20, 130, { label: 'S1', initialValue: 1 });
    const mux = add('MUX_4', -30, -15, { label: 'MUX 4:1' });
    const outLed = add('LED', 130, -15, { label: 'SALIDA Y', color: 'cyan', probe: true });

    link(d0, 'out', mux, 'd0');
    link(d1, 'out', mux, 'd1');
    link(d2, 'out', mux, 'd2');
    link(d3, 'out', mux, 'd3');
    link(s0, 'out', mux, 's0');
    link(s1, 'out', mux, 's1');
    link(mux, 'y', outLed, 'in0');
  } else if (key === 'bcd_7seg') {
    add('LABEL', 0, -210, { noteText: 'Conversor Binario → BCD 4 Dígitos (Algoritmo Double Dabble)' });
    const clk = add('CLOCK', -340, -50, { label: 'CLK', freqHz: 8 });
    const hi = add('HIGH', -340, 20);
    const rst = add('BUTTON', -340, 90, { label: 'RESET' });
    const cnt = add('COUNTER_N', -190, 0, { label: 'Binario 16b', bits: 16 });
    const bcd = add('BIN2BCD_N', -20, 0, { label: 'BIN→BCD', bits: 16 });
    const d3 = add('HEX_DISPLAY_N', 190, -145, { label: 'Millares', bits: 4, color: 'amber' });
    const d2 = add('HEX_DISPLAY_N', 190, -50, { label: 'Centenas', bits: 4, color: 'emerald' });
    const d1 = add('HEX_DISPLAY_N', 190, 45, { label: 'Decenas', bits: 4, color: 'cyan' });
    const d0 = add('HEX_DISPLAY_N', 190, 140, { label: 'Unidades', bits: 4, color: 'cyan' });
    const hexIn = add('HEX_DISPLAY_N', -190, 140, { label: 'Hex Bruto', bits: 16, color: 'violet' });

    link(clk, 'out', cnt, 'clk');
    link(hi, 'out', cnt, 'en');
    link(hi, 'out', cnt, 'up');
    link(rst, 'out', cnt, 'rst');
    link(cnt, 'q', bcd, 'd');
    link(cnt, 'q', hexIn, 'd');
    link(bcd, 'd3', d3, 'd');
    link(bcd, 'd2', d2, 'd');
    link(bcd, 'd1', d1, 'd');
    link(bcd, 'd0', d0, 'd');
  } else if (key === 'ring_osc') {
    add('LABEL', 0, -130, { noteText: 'Oscilador en Anillo (Ciclo de Realimentación Impar)' });
    const n1 = add('NOT', -140, 0, { label: 'INV 1', probe: true });
    const n2 = add('NOT', 0, 0, { label: 'INV 2', probe: true });
    const n3 = add('NOT', 140, 0, { label: 'INV 3', probe: true });
    link(n1, 'out', n2, 'in0');
    link(n2, 'out', n3, 'in0');
    link(n3, 'out', n1, 'in0');
  } else if (key === 'bus_alu64') {
    add('LABEL', 0, -210, { noteText: 'Arquitectura 64-Bit: Bus + ALU 64-Bit + Splitter 4×16' });
    const dipA = add('CONST_N', -310, -90, { label: 'Operando A (64b)', bits: 64, initialValue: 0x0000000123456789n });
    const dipB = add('CONST_N', -310, 10, { label: 'Operando B (64b)', bits: 64, initialValue: 0x00000000FEDCBA10n });
    const opKey = add('HEX_KEY_N', -310, 120, { label: 'OP (0=ADD..B=MUL)', bits: 4, hexVal: 0 });
    const alu = add('ALU_N', -60, 0, { label: 'ALU 64-Bit', bits: 64 });

    link(dipA, 'out', alu, 'a');
    link(dipB, 'out', alu, 'b');
    link(opKey, 'out', alu, 'op');

    const disp64 = add('HEX_DISPLAY_N', 220, -120, { label: 'Resultado Y (64-Bit)', bits: 64, color: 'cyan' });
    link(alu, 'y', disp64, 'd');

    const spl = add('SPLITTER', 120, 10, { label: 'Split 4×16', bits: 64, splitWidths: [16, 16, 16, 16] });
    link(alu, 'y', spl, 'bus');

    const lo16 = add('HEX_DISPLAY_N', 345, -15, { label: 'Bits 0..15', bits: 16, color: 'emerald' });
    const hi16 = add('HEX_DISPLAY_N', 345, 105, { label: 'Bits 16..31', bits: 16, color: 'amber' });
    link(spl, 'p0', lo16, 'd');
    link(spl, 'p1', hi16, 'd');

    const ledZ = add('LED', 110, 175, { label: 'Z (Cero)', color: 'emerald' });
    const ledC = add('LED', 200, 175, { label: 'C (Carry)', color: 'amber' });
    const ledN = add('LED', 290, 175, { label: 'N (Neg)', color: 'rose' });
    link(alu, 'z', ledZ, 'in0');
    link(alu, 'cout', ledC, 'in0');
    link(alu, 'neg', ledN, 'in0');
  } else if (key === 'tunnels_demo') {
    add('LABEL', 0, -190, { noteText: 'Túneles Inalámbricos: Buses sin cables cruzados' });
    const clk = add('CLOCK', -320, -60, { label: 'Reloj', freqHz: 2 });
    const hi = add('HIGH', -320, 20);
    const cnt = add('COUNTER_N', -170, -20, { label: 'PC 8-Bit', bits: 8 });
    const tBusOut = add('TUNNEL', -10, -40, { label: 'TX BUS', bits: 8, tunnelTag: 'DATA_BUS', tunnelDir: 'out' });
    link(clk, 'out', cnt, 'clk');
    link(hi, 'out', cnt, 'en');
    link(hi, 'out', cnt, 'up');
    link(cnt, 'q', tBusOut, 'in0');

    const swEn = add('SWITCH', -320, 110, { label: 'Habilitar LED', initialValue: 1 });
    const tEnOut = add('TUNNEL', -150, 110, { label: 'TX EN', bits: 1, tunnelTag: 'ENABLE_SIG', tunnelDir: 'out' });
    link(swEn, 'out', tEnOut, 'in0');

    const tBusIn1 = add('TUNNEL', 140, -80, { label: 'RX BUS', bits: 8, tunnelTag: 'DATA_BUS', tunnelDir: 'in' });
    const rom = add('ROM_N', 290, -80, {
      label: 'ROM Tabla',
      bits: 8,
      addrBits: 4,
      mem: [0x10n, 0x22n, 0x44n, 0x88n, 0xAAn, 0x55n, 0xFFn, 0x0Fn, 0x18n, 0x3Cn, 0x7En, 0xFFn, 0x7En, 0x3Cn, 0x18n, 0x00n]
    });
    const disp = add('HEX_DISPLAY_N', 450, -80, { label: 'Valor ROM', bits: 8, color: 'cyan' });
    link(tBusIn1, 'out', rom, 'addr');
    link(rom, 'q', disp, 'd');

    const tBusIn2 = add('TUNNEL', 140, 60, { label: 'RX BUS', bits: 8, tunnelTag: 'DATA_BUS', tunnelDir: 'in' });
    const par = add('PARITY_N', 280, 50, { label: 'Paridad 8b', bits: 8 });
    const tEnIn = add('TUNNEL', 280, 140, { label: 'RX EN', bits: 1, tunnelTag: 'ENABLE_SIG', tunnelDir: 'in' });
    const gate = add('AND', 400, 95);
    const ledPar = add('LED', 520, 95, { label: 'Paridad Impar', color: 'emerald', probe: true });
    link(tBusIn2, 'out', par, 'd');
    link(par, 'odd', gate, 'in0');
    link(tEnIn, 'out', gate, 'in1');
    link(gate, 'out', ledPar, 'in0');
  } else if (key === 'risc_cpu16') {
    add('LABEL', 0, -235, { noteText: 'Procesador RISC 16-Bit (PC + ROM + Banco Registros + ALU + Dual RAM)' });
    const clk = add('CLOCK', -410, -100, { label: 'CLK CPU', freqHz: 3 });
    const hi = add('HIGH', -410, -25);
    const rst = add('BUTTON', -410, 50, { label: 'RESET' });
    const pc = add('COUNTER_N', -260, -50, { label: 'PC (4b)', bits: 4 });
    link(clk, 'out', pc, 'clk');
    link(hi, 'out', pc, 'en');
    link(hi, 'out', pc, 'up');
    link(rst, 'out', pc, 'rst');

    // Instruction format (16b): bits 0..7=IMM(8), 8..11=ALU_OP(4), 12..14=REG_IDX(3), 15=WE_RAM
    const prog = [
      0x0F05n, // LOAD 5 -> R0
      0x8003n, // ADD 3 -> R0=8 + WRITE DRAM
      0x1002n, // ADD 2 -> R1
      0x9006n, // ADD 6 -> R1 + WRITE DRAM
      0x2101n, // SUB 1 -> R2
      0x24FFn, // XOR 0xFF -> R2
      0x320Fn, // AND 0x0F -> R3
      0x9F01n, // LOAD 1 -> R1 + WRITE DRAM
      0x0004n, // ADD 4 -> R0
      0x1008n, // ADD 8 -> R1
      0x2010n, // ADD 16 -> R2
      0xA020n, // ADD 32 + WRITE DRAM
      0x3F42n, // LOAD 0x42 -> R3
      0x0001n, // ADD 1
      0x1005n, // ADD 5
      0x0F00n  // LOAD 0
    ];
    const rom = add('ROM_N', -95, -50, { label: 'ROM Programa', bits: 16, addrBits: 4, mem: prog });
    link(pc, 'q', rom, 'addr');

    const spl = add('SPLITTER', 65, -50, { label: 'Decode 8|4|3|1', bits: 16, splitWidths: [8, 4, 3, 1] });
    link(rom, 'q', spl, 'bus');

    const dispIR = add('HEX_DISPLAY_N', 65, -170, { label: 'IR (16-Bit)', bits: 16, color: 'amber' });
    link(rom, 'q', dispIR, 'd');

    const rf = add('REG_FILE_N', 235, -35, { label: 'Banco Regs 8×8b', bits: 8 });
    const alu = add('ALU_N', 410, -35, { label: 'ALU 8-Bit', bits: 8 });
    const dispACC = add('HEX_DISPLAY_N', 565, -110, { label: 'ALU Out', bits: 8, color: 'cyan' });

    link(spl, 'p2', rf, 'ra');
    link(spl, 'p2', rf, 'wa');
    link(pc, 'q', rf, 'rb'); // Read shadow port via PC
    link(alu, 'y', rf, 'wd');
    link(hi, 'out', rf, 'we');
    link(clk, 'out', rf, 'clk');
    link(rst, 'out', rf, 'rst');

    link(rf, 'qa', alu, 'a');
    link(spl, 'p0', alu, 'b');
    link(spl, 'p1', alu, 'op');
    link(alu, 'y', dispACC, 'd');

    const dram = add('DUAL_RAM_N', 340, 145, { label: 'Dual RAM 8b', bits: 8, addrBits: 4 });
    const dispRAM = add('HEX_DISPLAY_N', 565, 145, { label: 'DRAM[PC]', bits: 8, color: 'emerald' });
    link(pc, 'q', dram, 'aa');
    link(spl, 'p2', dram, 'ab');
    link(alu, 'y', dram, 'da');
    link(spl, 'p3', dram, 'we');
    link(clk, 'out', dram, 'clk');
    link(dram, 'qa', dispRAM, 'd');
  } else if (key === 'lcd_terminal') {
    add('LABEL', 0, -185, { noteText: 'Terminal LCD 16×2 ASCII alimentada por ROM + Contador' });
    const clk = add('CLOCK', -330, -40, { label: 'CLK Texto', freqHz: 6 });
    const hi = add('HIGH', -330, 35);
    const y0 = add('LOW', -330, 95);
    const clr = add('BUTTON', -330, 155, { label: 'LIMPIAR' });
    const cnt = add('COUNTER_N', -175, -15, { label: 'Cursor X (0..15)', bits: 4 });

    const text = 'HELLO LOGIC 64b!';
    const mem = Array.from({ length: 16 }, (_, i) => BigInt(text.charCodeAt(i)));
    const rom = add('ROM_N', -10, -80, { label: 'ROM Mensaje', bits: 8, addrBits: 4, mem });
    const lcd = add('LCD_TEXT', 200, 10, { label: 'Pantalla 16×2', color: 'emerald' });
    const asciiDisp = add('HEX_DISPLAY_N', 195, -115, { label: 'Byte ASCII', bits: 8, color: 'cyan' });

    link(clk, 'out', cnt, 'clk');
    link(hi, 'out', cnt, 'en');
    link(hi, 'out', cnt, 'up');
    link(clr, 'out', cnt, 'rst');

    link(cnt, 'q', rom, 'addr');
    link(rom, 'q', lcd, 'char');
    link(rom, 'q', asciiDisp, 'd');
    link(cnt, 'q', lcd, 'x');
    link(y0, 'out', lcd, 'y');
    link(hi, 'out', lcd, 'we');
    link(clk, 'out', lcd, 'clk');
    link(clr, 'out', lcd, 'clr');
  } else if (key === 'vga_pattern') {
    add('LABEL', 0, -225, { noteText: 'Generador Gráfico VGA 64×48 RGB332 por Hardware (Sync 64×48 + Shader Animado)' });
    const clk = add('CLOCK', -400, -60, { label: 'Pixel CLK', freqHz: 15 });
    const hi = add('HIGH', -400, 15);
    const c47 = add('CONST_N', -400, 130, { label: 'Alto-1 (47)', bits: 6, initialValue: 47n });
    const cntX = add('COUNTER_N', -245, -90, { label: 'X (0..63)', bits: 6 });
    const cntY = add('COUNTER_N', -245, 55, { label: 'Y (0..47)', bits: 6 });
    link(clk, 'out', cntX, 'clk');
    link(hi, 'out', cntX, 'en');
    link(hi, 'out', cntX, 'up');

    link(clk, 'out', cntY, 'clk');
    link(cntX, 'co', cntY, 'en');
    link(hi, 'out', cntY, 'up');

    // Sync 48 filas: endFrame = (Y == 47) AND X.co
    const cmpY = add('COMP_N', -90, 135, { label: 'Y == 47', bits: 6 });
    const endFrame = add('AND', 35, 135, { label: 'Fin Frame' });
    link(cntY, 'q', cmpY, 'a');
    link(c47, 'out', cmpY, 'b');
    link(cmpY, 'eq', endFrame, 'in0');
    link(cntX, 'co', endFrame, 'in1');
    link(endFrame, 'out', cntY, 'rst');

    const cntFrame = add('COUNTER_N', 175, 135, { label: 'Frame #', bits: 8 });
    link(clk, 'out', cntFrame, 'clk');
    link(endFrame, 'out', cntFrame, 'en');
    link(hi, 'out', cntFrame, 'up');

    // Shader RGB332 vibrante: ((X XOR Y) << 2) + Frame
    const extX = add('BIT_EXTEND', -95, -120, { label: 'X→8b', bits: 8 });
    const extY = add('BIT_EXTEND', -95, -20, { label: 'Y→8b', bits: 8 });
    const opXor = add('CONST_N', -95, 55, { label: 'OP=XOR', bits: 4, initialValue: 4 });
    const aluXor = add('ALU_N', 45, -75, { label: 'X XOR Y', bits: 8 });
    link(cntX, 'q', extX, 'in0');
    link(cntY, 'q', extY, 'in0');
    link(extX, 'out', aluXor, 'a');
    link(extY, 'out', aluXor, 'b');
    link(opXor, 'out', aluXor, 'op');

    const sh2 = add('CONST_N', 45, 45, { label: 'SHL 2', bits: 6, initialValue: 2n });
    const shifter = add('SHIFTER_N', 185, -75, { label: 'Escala RGB', bits: 8 });
    link(aluXor, 'y', shifter, 'a');
    link(sh2, 'out', shifter, 'sh');

    const addCol = add('ADDER_N', 310, -10, { label: 'Color RGB332', bits: 8 });
    link(shifter, 'y', addCol, 'a');
    link(cntFrame, 'q', addCol, 'b');

    const vga = add('VGA_SCREEN', 465, -20, { label: 'Pantalla VGA 64×48' });
    link(cntX, 'q', vga, 'x');
    link(cntY, 'q', vga, 'y');
    link(addCol, 'y', vga, 'col');
    link(hi, 'out', vga, 'we');
    link(clk, 'out', vga, 'clk');
    link(endFrame, 'out', vga, 'swap');

    return { components, wires, recommendedMultiplier: 3000 };
  } else if (key === 'chiptune_synth') {
    add('LABEL', 0, -210, { noteText: 'Sintetizador Chiptune ROM + TONE_GEN Hz + Barra LED 8b + Matriz 8×8' });
    const clk = add('CLOCK', -340, -50, { label: 'Tempo', freqHz: 4 });
    const hi = add('HIGH', -340, 25);
    const cnt = add('COUNTER_N', -195, -10, { label: 'Paso 0..15', bits: 4 });
    link(clk, 'out', cnt, 'clk');
    link(hi, 'out', cnt, 'en');
    link(hi, 'out', cnt, 'up');

    // 16-bit track: bits 0..11 = freq Hz, 12..13 = wave (0=SQR,1=SAW,2=TRI), 14 = gate
    const encodeNote = (hz: number, wave: number, gate: number) =>
      BigInt((hz & 0xfff) | ((wave & 3) << 12) | ((gate & 1) << 14));
    const track = [
      encodeNote(523, 0, 1), // C5
      encodeNote(659, 0, 1), // E5
      encodeNote(784, 0, 1), // G5
      encodeNote(1047, 1, 1), // C6
      encodeNote(784, 1, 1), // G5
      encodeNote(659, 0, 1), // E5
      encodeNote(587, 2, 1), // D5
      encodeNote(494, 2, 1), // B4
      encodeNote(523, 0, 1), // C5
      encodeNote(659, 0, 1), // E5
      encodeNote(880, 1, 1), // A5
      encodeNote(784, 1, 1), // G5
      encodeNote(659, 2, 1), // E5
      encodeNote(587, 2, 1), // D5
      encodeNote(523, 0, 1), // C5
      encodeNote(0, 0, 0) // Rest
    ];
    const rom = add('ROM_N', -40, -10, { label: 'Partitura ROM', bits: 16, addrBits: 4, mem: track });
    link(cnt, 'q', rom, 'addr');

    const spl = add('SPLITTER', 110, 80, { label: 'Nota|Wav|Gate', bits: 16, splitWidths: [12, 2, 1, 1] });
    link(rom, 'q', spl, 'bus');

    const tone = add('TONE_GEN', 285, 115, { label: 'Sintetizador Hz' });
    link(spl, 'p0', tone, 'freq');
    link(spl, 'p1', tone, 'wave');
    link(spl, 'p2', tone, 'gate');

    const slice8 = add('BUS_SLICE', 110, -110, { label: 'LSB 8b', bits: 16, sliceHi: 7, sliceLo: 0 });
    link(rom, 'q', slice8, 'in0');

    const bar8 = add('LED_BAR_8', 285, -135, { label: 'Espectro 8b', bits: 8, color: 'emerald' });
    link(slice8, 'out', bar8, 'd');

    const mtx = add('LED_MATRIX_8X8', 485, -10, { label: 'Visualizador', color: 'cyan' });
    link(slice8, 'out', mtx, 'r2');
    link(slice8, 'out', mtx, 'r5');
  } else if (key === 'doom_3d') {
    add('LABEL', 0, -235, { noteText: 'DOOM 3D Raycaster Hardware (WASD / Flechas + Espacio para Disparar)' });
    const clk = add('CLOCK', -340, -115, { label: 'GPU CLK', freqHz: 15 });
    const pad = add('GAMEPAD', -340, 20, { label: 'Control WASD + Fuego' });
    const rst = add('BUTTON', -340, 155, { label: 'RESET' });

    const rom = add('ROM_N', -110, 165, {
      label: 'Mapa Dungeon 16×16',
      bits: 8,
      addrBits: 8,
      mem: DEFAULT_DOOM_MAP.map(v => BigInt(v))
    });

    const gpu = add('RAYCAST_CORE', -110, -40, { label: 'RAYCAST_CORE 3D' });
    const vga = add('VGA_SCREEN', 200, -45, { label: 'Monitor DOOM 64×48' });
    const buz = add('BUZZER', 110, 165, { label: 'SFX Plasma', buzzerHz: 180 });
    const dispAddr = add('HEX_DISPLAY_N', 255, 165, { label: 'Scan Mapa', bits: 8, color: 'amber' });

    link(clk, 'out', gpu, 'clk');
    link(pad, 'bus', gpu, 'pad');
    link(rst, 'out', gpu, 'rst');

    link(gpu, 'mapa', rom, 'addr');
    link(rom, 'q', gpu, 'mapd');
    link(gpu, 'mapa', dispAddr, 'd');

    link(gpu, 'px', vga, 'x');
    link(gpu, 'py', vga, 'y');
    link(gpu, 'col', vga, 'col');
    link(gpu, 'we', vga, 'we');
    link(clk, 'out', vga, 'clk');
    link(gpu, 'swap', vga, 'swap');
    link(gpu, 'sfx', buz, 'in0');

    return { components, wires, recommendedMultiplier: 3000 };
  } else if (key === 'anim_32_scenes') {
    add('LABEL', 0, -250, {
      noteText: '🎬 Las 32 Desventuras de Pepe el Bot vs El Bug del Viernes (32 Escenas VGA + Subtítulos LCD + SFX)'
    });
    const clk = add('CLOCK', -390, -135, { label: 'GPU CLK', freqHz: 15 });
    const adc = add('SLIDER_ADC', -390, -15, { label: 'Selector Escena', bits: 8, initialValue: 0n });
    const slice5 = add('BUS_SLICE', -245, -15, { label: '5 Bits (0..31)', bits: 8, sliceHi: 4, sliceLo: 0 });
    const swExt = add('SWITCH', -390, 85, { label: 'Manual EXT', initialValue: 0 });
    const swPause = add('SWITCH', -390, 165, { label: 'Pausa', initialValue: 0 });
    const btnRst = add('BUTTON', -245, 165, { label: 'Reset 01' });

    const gpu = add('ANIM32_GPU', -65, -10, { label: 'GPU Animación 32 Escenas' });
    const vga = add('VGA_SCREEN', 245, -118, { label: 'Pantalla VGA 64×48' });
    const lcd = add('LCD_TEXT', 245, 76, { label: 'Subtítulos 16×2', color: 'amber' });

    const vu = add('VU_METER_N', 425, -115, { label: 'Progreso 32', bits: 5 });
    const decDisp = add('DEC_DISPLAY_N', 425, 14, { label: 'Escena (0-31)', bits: 5, color: 'cyan' });
    const waveK = add('CONST_N', 245, 205, { label: 'Onda SQR', bits: 2, initialValue: 0n });
    const tone = add('TONE_GEN', 425, 134, { label: 'SFX Escena' });

    link(clk, 'out', gpu, 'clk');
    link(adc, 'out', slice5, 'in0');
    link(slice5, 'out', gpu, 'scene');
    link(swExt, 'out', gpu, 'use_ext');
    link(swPause, 'out', gpu, 'pause');
    link(btnRst, 'out', gpu, 'rst');

    link(gpu, 'px', vga, 'x');
    link(gpu, 'py', vga, 'y');
    link(gpu, 'col', vga, 'col');
    link(gpu, 'we', vga, 'we');
    link(clk, 'out', vga, 'clk');
    link(gpu, 'swap', vga, 'swap');

    link(gpu, 'lchar', lcd, 'char');
    link(gpu, 'lx', lcd, 'x');
    link(gpu, 'ly', lcd, 'y');
    link(gpu, 'lwe', lcd, 'we');
    link(clk, 'out', lcd, 'clk');
    link(btnRst, 'out', lcd, 'clr');

    link(gpu, 'scn', vu, 'in0');
    link(gpu, 'scn', decDisp, 'd');
    link(gpu, 'sfreq', tone, 'freq');
    link(waveK, 'out', tone, 'wave');
    link(gpu, 'sgate', tone, 'gate');

    return { components, wires, recommendedMultiplier: 3000 };
  } else if (key === 'uart_crc_console') {
    add('LABEL', 0, -215, { noteText: 'Terminal Serie ROM/Teclado + Cola FIFO + Verificador CRC-16 CCITT' });
    const clk = add('CLOCK', -360, -90, { label: 'CLK 6Hz', freqHz: 6 });
    const en = add('SWITCH', -360, 15, { label: 'Auto Envío', initialValue: 1 });
    const clr = add('BUTTON', -360, 115, { label: 'Borrar' });

    const mod = add('MOD_COUNTER_N', -180, -70, { label: 'Cursor 0..23', bits: 5, modBase: 24 });
    const msg = 'LOGICSTUDIO PRO 64-BIT!\n';
    const rom = add('ROM_N', 10, -70, {
      label: 'ROM Mensaje',
      bits: 8,
      addrBits: 5,
      mem: Array.from({ length: 32 }, (_, i) => BigInt(i < msg.length ? msg.charCodeAt(i) : 0))
    });
    const fifo = add('FIFO_N', 10, 115, { label: 'Buffer FIFO', bits: 8 });
    const con = add('TEXT_CONSOLE', 265, -45, { label: 'Consola Hardware' });
    const crc = add('CRC16_GEN', 265, 125, { label: 'Hash CRC-16' });
    const hexCrc = add('HEX_DISPLAY_N', 450, 125, { label: 'CRC16 HEX', bits: 16, color: 'emerald' });

    link(clk, 'out', mod, 'clk');
    link(en, 'out', mod, 'en');
    link(clr, 'out', mod, 'rst');
    link(mod, 'q', rom, 'addr');

    link(rom, 'q', fifo, 'd');
    link(en, 'out', fifo, 'push');
    link(en, 'out', fifo, 'pop');
    link(clk, 'out', fifo, 'clk');
    link(clr, 'out', fifo, 'rst');

    link(rom, 'q', con, 'char');
    link(en, 'out', con, 'we');
    link(clk, 'out', con, 'clk');
    link(clr, 'out', con, 'clr');

    link(rom, 'q', crc, 'd');
    link(en, 'out', crc, 'en');
    link(clk, 'out', crc, 'clk');
    link(clr, 'out', crc, 'rst');
    link(crc, 'crc', hexCrc, 'd');
  } else if (key === 'dsp_math_vumeter') {
    add('LABEL', 0, -210, { noteText: 'Laboratorio DSP: Potenciómetro ADC + Sumador Saturado + √N + Ventana [40..180]' });
    const adcA = add('SLIDER_ADC', -340, -85, { label: 'Sensor A', bits: 8, initialValue: 96n });
    const adcB = add('SLIDER_ADC', -340, 35, { label: 'Offset B', bits: 8, initialValue: 48n });
    const lo = add('CONST_N', -340, 130, { label: 'LO=40', bits: 8, initialValue: 40n });
    const hi = add('CONST_N', -340, 200, { label: 'HI=180', bits: 8, initialValue: 180n });

    const sat = add('SAT_ADDER_N', -100, -45, { label: 'A + B Saturado', bits: 8 });
    const sq = add('SQRT_N', 120, -105, { label: 'Raíz √X', bits: 8 });
    const win = add('COMP_WIN_N', 120, 45, { label: 'Ventana', bits: 8 });
    const vu = add('VU_METER_N', 340, -110, { label: 'Nivel VU', bits: 8 });
    const dispSum = add('DEC_DISPLAY_N', 340, 35, { label: 'Suma Clamped', bits: 8, color: 'emerald' });
    const dispRoot = add('DEC_DISPLAY_N', 340, 155, { label: 'Raíz Entera', bits: 8, color: 'cyan' });
    const ledOk = add('LED', 120, 175, { label: 'En Rango', color: 'emerald' });

    link(adcA, 'out', sat, 'a');
    link(adcB, 'out', sat, 'b');
    link(sat, 's', sq, 'in0');
    link(sat, 's', win, 'x');
    link(lo, 'out', win, 'lo');
    link(hi, 'out', win, 'hi');
    link(sat, 's', vu, 'in0');
    link(sat, 's', dispSum, 'd');
    link(sq, 'root', dispRoot, 'd');
    link(win, 'inw', ledOk, 'in0');
  } else if (key === 'watchdog_mod_safety') {
    add('LABEL', 0, -210, { noteText: 'Seguridad Digital: Botón con Filtro Antirrebote → Kick al Watchdog + Cronómetro' });
    const clk = add('CLOCK', -360, -70, { label: 'CLK 4Hz', freqHz: 4 });
    const rawBtn = add('BUTTON', -360, 45, { label: 'Botón Kick' });
    const swRun = add('SWITCH', -360, 145, { label: 'Run Crono', initialValue: 1 });
    const rst = add('BUTTON', -140, 165, { label: 'Reset Total' });

    const deb = add('DEBOUNCER', -150, 20, { label: 'Filtro 4x' });
    const lim = add('CONST_N', -150, -105, { label: 'Límite=16', bits: 8, initialValue: 16n });
    const wdog = add('WATCHDOG_N', 60, -45, { label: 'Watchdog 8b', bits: 8, modBase: 16 });
    const stopw = add('STOPWATCH_N', 60, 120, { label: 'Cronómetro', bits: 8 });
    const ledBark = add('LED', 270, -75, { label: 'ALARMA!', color: 'rose', probe: true });
    const dispCnt = add('DEC_DISPLAY_N', 270, 20, { label: 'Cuenta WDG', bits: 8, color: 'amber' });
    const dispTime = add('DEC_DISPLAY_N', 270, 130, { label: 'Ticks OK', bits: 8, color: 'emerald' });

    link(rawBtn, 'out', deb, 'in0');
    link(clk, 'out', deb, 'clk');

    link(clk, 'out', wdog, 'clk');
    link(deb, 'out', wdog, 'kick');
    link(lim, 'out', wdog, 'lim');
    link(rst, 'out', wdog, 'rst');
    link(wdog, 'bark', ledBark, 'in0');
    link(wdog, 'cnt', dispCnt, 'd');

    link(clk, 'out', stopw, 'clk');
    link(swRun, 'out', stopw, 'start');
    link(wdog, 'bark', stopw, 'lap');
    link(rst, 'out', stopw, 'rst');
    link(stopw, 'q', dispTime, 'd');
  }

  return { components, wires };
}
