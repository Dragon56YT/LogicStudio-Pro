import {
  CatalogItem,
  CustomICDef,
  LogicComponent,
  PinDef,
  SubNetlistState,
  WorldPin,
  deserializeCircuitData,
  genId,
  serializeCircuitData
} from './types';

export const BIT_WIDTH_OPTIONS = [1, 2, 4, 8, 16, 32, 64] as const;
export const MULTI_BIT_OPTIONS = [4, 8, 16, 32, 64] as const;

export const CATEGORIES = [
  'Entradas y Control',
  'Puertas Lógicas (1-64b)',
  'Buses, Splitters y Túneles',
  'Aritmética y ALU (1-64b)',
  'MUX, DEMUX y Códigos',
  'Secuenciales y Registros',
  'Memorias y CPU Cores',
  'Salidas, Pantallas y Audio',
  'Utilidades',
  'Mis Chips (IC)'
] as const;

export const COMPONENT_CATALOG: CatalogItem[] = [
  // 1. Entradas y Control
  { type: 'SWITCH', cat: 'Entradas y Control', badge: 'SW', name: 'Interruptor', w: 68, h: 42 },
  { type: 'BUTTON', cat: 'Entradas y Control', badge: 'BTN', name: 'Pulsador', w: 68, h: 42 },
  { type: 'CLOCK', cat: 'Entradas y Control', badge: 'CLK', name: 'Reloj (Clock)', w: 72, h: 44 },
  { type: 'HIGH', cat: 'Entradas y Control', badge: '1', name: 'Constante 1', w: 56, h: 36 },
  { type: 'LOW', cat: 'Entradas y Control', badge: '0', name: 'Constante 0', w: 56, h: 36 },
  { type: 'CONST_N', cat: 'Entradas y Control', badge: 'CONST', name: 'Constante N-Bit', w: 92, h: 46, scalableBits: true, defaultBits: 8 },
  { type: 'DIP_SWITCH', cat: 'Entradas y Control', badge: 'DIP', name: 'Banco DIP 4/8/16b', w: 96, h: 64, scalableBits: true, defaultBits: 8 },
  { type: 'HEX_KEY', cat: 'Entradas y Control', badge: '0-F', name: 'Teclado Hex 4b', w: 78, h: 86 },
  { type: 'HEX_KEY_N', cat: 'Entradas y Control', badge: 'HEX+', name: 'Entrada Hex N-Bit', w: 104, h: 58, scalableBits: true, defaultBits: 16 },
  { type: 'PULSE_GEN', cat: 'Entradas y Control', badge: 'SEQ', name: 'Secuencia 8-Bit', w: 84, h: 52 },
  { type: 'GAMEPAD', cat: 'Entradas y Control', badge: 'PAD', name: 'Mando WASD + Fuego', w: 120, h: 120 },
  { type: 'KEYBOARD_ASCII', cat: 'Entradas y Control', badge: 'KBD', name: 'Teclado ASCII 8b', w: 104, h: 68 },
  { type: 'NUM_STEPPER', cat: 'Entradas y Control', badge: '±NUM', name: 'Selector Numérico ± N-Bit', w: 118, h: 52, scalableBits: true, defaultBits: 8 },
  { type: 'ROTARY_ENC', cat: 'Entradas y Control', badge: 'ENC', name: 'Encoder Rotatorio A/B', w: 94, h: 72 },
  { type: 'SLIDER_ADC', cat: 'Entradas y Control', badge: 'ADC', name: 'Potenciómetro ADC N-Bit', w: 122, h: 60, scalableBits: true, defaultBits: 8 },

  // 2. Puertas Lógicas (1-64b)
  { type: 'BUFFER', cat: 'Puertas Lógicas (1-64b)', badge: 'BUF', name: 'Buffer (1-64b)', w: 74, h: 48, scalableBits: true, defaultBits: 1 },
  { type: 'NOT', cat: 'Puertas Lógicas (1-64b)', badge: 'NOT', name: 'Inversor NOT (1-64b)', w: 76, h: 48, scalableBits: true, defaultBits: 1 },
  { type: 'AND', cat: 'Puertas Lógicas (1-64b)', badge: 'AND', name: 'Puerta AND (1-64b)', w: 80, h: 56, variableInputs: true, scalableBits: true, defaultBits: 1 },
  { type: 'NAND', cat: 'Puertas Lógicas (1-64b)', badge: 'NAND', name: 'Puerta NAND (1-64b)', w: 84, h: 56, variableInputs: true, scalableBits: true, defaultBits: 1 },
  { type: 'OR', cat: 'Puertas Lógicas (1-64b)', badge: 'OR', name: 'Puerta OR (1-64b)', w: 80, h: 56, variableInputs: true, scalableBits: true, defaultBits: 1 },
  { type: 'NOR', cat: 'Puertas Lógicas (1-64b)', badge: 'NOR', name: 'Puerta NOR (1-64b)', w: 84, h: 56, variableInputs: true, scalableBits: true, defaultBits: 1 },
  { type: 'XOR', cat: 'Puertas Lógicas (1-64b)', badge: 'XOR', name: 'Puerta XOR (1-64b)', w: 82, h: 56, variableInputs: true, scalableBits: true, defaultBits: 1 },
  { type: 'XNOR', cat: 'Puertas Lógicas (1-64b)', badge: 'XNOR', name: 'Puerta XNOR (1-64b)', w: 86, h: 56, variableInputs: true, scalableBits: true, defaultBits: 1 },
  { type: 'MAJ3', cat: 'Puertas Lógicas (1-64b)', badge: 'MAJ3', name: 'Puerta Mayoría 3 (1-64b)', w: 86, h: 64, scalableBits: true, defaultBits: 1 },
  { type: 'TRI_BUFFER', cat: 'Puertas Lógicas (1-64b)', badge: '3-ST', name: 'Tri-Estado (1-64b)', w: 78, h: 54, scalableBits: true, defaultBits: 1 },

  // 3. Buses, Splitters y Túneles
  { type: 'TUNNEL', cat: 'Buses, Splitters y Túneles', badge: 'TUN', name: 'Túnel Inalámbrico', w: 96, h: 38, scalableBits: true, defaultBits: 1 },
  { type: 'SPLITTER', cat: 'Buses, Splitters y Túneles', badge: 'SPLIT', name: 'Divisor de Bus (N→bits)', w: 118, h: 136, scalableBits: true, defaultBits: 8 },
  { type: 'MERGER', cat: 'Buses, Splitters y Túneles', badge: 'JOIN', name: 'Unificador de Bus (bits→N)', w: 118, h: 136, scalableBits: true, defaultBits: 8 },
  { type: 'BUS_SLICE', cat: 'Buses, Splitters y Túneles', badge: 'SLICE', name: 'Extractor Rango [HI:LO]', w: 102, h: 62, scalableBits: true, defaultBits: 16 },
  { type: 'BIT_EXTEND', cat: 'Buses, Splitters y Túneles', badge: 'EXT', name: 'Extensor de Bits (→64b)', w: 94, h: 56, scalableBits: true, defaultBits: 16 },
  { type: 'CROSSBAR_2X2', cat: 'Buses, Splitters y Túneles', badge: 'XBAR', name: 'Matriz Conmutadora 2×2', w: 106, h: 80, scalableBits: true, defaultBits: 8 },
  { type: 'PRIORITY_ARB', cat: 'Buses, Splitters y Túneles', badge: 'ARB4', name: 'Árbitro Prioridad 4-Vías', w: 110, h: 98 },
  { type: 'BUS_PACK4', cat: 'Buses, Splitters y Túneles', badge: 'PACK', name: 'Empaquetador Bus 4→1', w: 104, h: 92, scalableBits: true, defaultBits: 8 },
  { type: 'BUS_UNPACK4', cat: 'Buses, Splitters y Túneles', badge: 'UNPK', name: 'Desempaquetador Bus 1→4', w: 104, h: 92, scalableBits: true, defaultBits: 8 },

  // 4. Aritmética y ALU (1-64b)
  { type: 'HALF_ADDER', cat: 'Aritmética y ALU (1-64b)', badge: 'HA', name: 'Semisumador', w: 92, h: 68 },
  { type: 'FULL_ADDER', cat: 'Aritmética y ALU (1-64b)', badge: 'FA', name: 'Sumador Comp.', w: 96, h: 82 },
  { type: 'ADDER_4', cat: 'Aritmética y ALU (1-64b)', badge: 'ADD4', name: 'Sumador 4-Bit (pines)', w: 112, h: 190 },
  { type: 'ADDER_N', cat: 'Aritmética y ALU (1-64b)', badge: 'ADD-N', name: 'Sumador Bus (4-64b)', w: 108, h: 88, scalableBits: true, defaultBits: 16 },
  { type: 'SUB_N', cat: 'Aritmética y ALU (1-64b)', badge: 'SUB-N', name: 'Restador Bus (4-64b)', w: 108, h: 88, scalableBits: true, defaultBits: 16 },
  { type: 'INC_DEC_N', cat: 'Aritmética y ALU (1-64b)', badge: '±STEP', name: 'Inc/Dec Bus (4-64b)', w: 108, h: 82, scalableBits: true, defaultBits: 16 },
  { type: 'ABS_NEG_N', cat: 'Aritmética y ALU (1-64b)', badge: '|A|/-A', name: 'Neg/Abs/Swap (4-64b)', w: 112, h: 80, scalableBits: true, defaultBits: 16 },
  { type: 'MIN_MAX_N', cat: 'Aritmética y ALU (1-64b)', badge: 'MIN/X', name: 'Mín/Máx Bus (4-64b)', w: 110, h: 84, scalableBits: true, defaultBits: 16 },
  { type: 'POPCOUNT_N', cat: 'Aritmética y ALU (1-64b)', badge: 'POP', name: 'Contador Bits/CLZ (64b)', w: 112, h: 84, scalableBits: true, defaultBits: 32 },
  { type: 'MULT_2X2', cat: 'Aritmética y ALU (1-64b)', badge: 'MUL2', name: 'Multiplicador 2×2', w: 100, h: 118 },
  { type: 'MULT_N', cat: 'Aritmética y ALU (1-64b)', badge: 'MUL-N', name: 'Multiplicador (4-64b)', w: 108, h: 86, scalableBits: true, defaultBits: 16 },
  { type: 'DIV_N', cat: 'Aritmética y ALU (1-64b)', badge: 'DIV-N', name: 'Divisor/Módulo (4-64b)', w: 108, h: 86, scalableBits: true, defaultBits: 16 },
  { type: 'SHIFTER_N', cat: 'Aritmética y ALU (1-64b)', badge: 'SHF-N', name: 'Barrel Shifter (4-64b)', w: 112, h: 92, scalableBits: true, defaultBits: 16 },
  { type: 'ALU_4', cat: 'Aritmética y ALU (1-64b)', badge: 'ALU4', name: 'ALU 4-Bit (pines)', w: 120, h: 164 },
  { type: 'ALU_N', cat: 'Aritmética y ALU (1-64b)', badge: 'ALU64', name: 'ALU Completa (4-64b)', w: 128, h: 136, scalableBits: true, defaultBits: 32 },
  { type: 'COMP_2', cat: 'Aritmética y ALU (1-64b)', badge: 'CMP2', name: 'Comparador 2b', w: 100, h: 102 },
  { type: 'COMP_4', cat: 'Aritmética y ALU (1-64b)', badge: 'CMP4', name: 'Comparador 4-Bit', w: 104, h: 170 },
  { type: 'COMP_N', cat: 'Aritmética y ALU (1-64b)', badge: 'CMP-N', name: 'Comparador Bus (4-64b)', w: 108, h: 88, scalableBits: true, defaultBits: 16 },
  { type: 'MAC_N', cat: 'Aritmética y ALU (1-64b)', badge: 'MAC', name: 'Unidad DSP MAC (A×B+ACC)', w: 118, h: 126, scalableBits: true, defaultBits: 16 },
  { type: 'SAT_ADDER_N', cat: 'Aritmética y ALU (1-64b)', badge: 'SAT+', name: 'Sumador Saturado N-Bit', w: 108, h: 78, scalableBits: true, defaultBits: 8 },
  { type: 'SQRT_N', cat: 'Aritmética y ALU (1-64b)', badge: '√N', name: 'Raíz Cuadrada Entera √N', w: 102, h: 72, scalableBits: true, defaultBits: 16 },
  { type: 'COMP_WIN_N', cat: 'Aritmética y ALU (1-64b)', badge: 'WIN', name: 'Comparador Ventana [LO..HI]', w: 112, h: 86, scalableBits: true, defaultBits: 8 },

  // 5. MUX, DEMUX y Códigos
  { type: 'MUX_2', cat: 'MUX, DEMUX y Códigos', badge: 'MUX2', name: 'MUX 2:1 (1-64b)', w: 88, h: 82, scalableBits: true, defaultBits: 1 },
  { type: 'DEMUX_2', cat: 'MUX, DEMUX y Códigos', badge: 'DMX2', name: 'DEMUX 1:2 (1-64b)', w: 88, h: 74, scalableBits: true, defaultBits: 1 },
  { type: 'MUX_4', cat: 'MUX, DEMUX y Códigos', badge: 'MUX4', name: 'MUX 4:1 (1-64b)', w: 96, h: 118, scalableBits: true, defaultBits: 1 },
  { type: 'DEMUX_4', cat: 'MUX, DEMUX y Códigos', badge: 'DMX4', name: 'DEMUX 1:4 (1-64b)', w: 92, h: 118, scalableBits: true, defaultBits: 1 },
  { type: 'MUX_8', cat: 'MUX, DEMUX y Códigos', badge: 'MUX8', name: 'MUX 8:1 (1-64b)', w: 96, h: 176, scalableBits: true, defaultBits: 1 },
  { type: 'DEMUX_8', cat: 'MUX, DEMUX y Códigos', badge: 'DMX8', name: 'DEMUX 1:8 (1-64b)', w: 96, h: 176, scalableBits: true, defaultBits: 1 },
  { type: 'MUX_16', cat: 'MUX, DEMUX y Códigos', badge: 'MX16', name: 'MUX 16:1 (1-64b)', w: 106, h: 274, scalableBits: true, defaultBits: 1 },
  { type: 'DEMUX_16', cat: 'MUX, DEMUX y Códigos', badge: 'DX16', name: 'DEMUX 1:16 (1-64b)', w: 106, h: 274, scalableBits: true, defaultBits: 1 },
  { type: 'MUX_32', cat: 'MUX, DEMUX y Códigos', badge: 'MX32', name: 'MUX 32:1 (1-64b)', w: 120, h: 460, scalableBits: true, defaultBits: 1 },
  { type: 'DEMUX_32', cat: 'MUX, DEMUX y Códigos', badge: 'DX32', name: 'DEMUX 1:32 (1-64b)', w: 120, h: 460, scalableBits: true, defaultBits: 1 },
  { type: 'DEC_2TO4', cat: 'MUX, DEMUX y Códigos', badge: 'DEC4', name: 'Decodificador 2→4', w: 96, h: 102 },
  { type: 'DEC_3TO8', cat: 'MUX, DEMUX y Códigos', badge: 'DEC8', name: 'Decodificador 3→8', w: 100, h: 176 },
  { type: 'DEC_4TO16', cat: 'MUX, DEMUX y Códigos', badge: 'DC16', name: 'Decodificador 4→16', w: 108, h: 274 },
  { type: 'DEC_5TO32', cat: 'MUX, DEMUX y Códigos', badge: 'DC32', name: 'Decodificador 5→32', w: 118, h: 460 },
  { type: 'ENC_4TO2', cat: 'MUX, DEMUX y Códigos', badge: 'ENC4', name: 'Codificador 4→2', w: 104, h: 104 },
  { type: 'ENC_8TO3', cat: 'MUX, DEMUX y Códigos', badge: 'ENC8', name: 'Codificador 8→3', w: 106, h: 170 },
  { type: 'ENC_16TO4', cat: 'MUX, DEMUX y Códigos', badge: 'EN16', name: 'Codificador 16→4', w: 112, h: 274 },
  { type: 'ENC_32TO5', cat: 'MUX, DEMUX y Códigos', badge: 'EN32', name: 'Codificador 32→5', w: 118, h: 460 },
  { type: 'BCD_7SEG', cat: 'MUX, DEMUX y Códigos', badge: 'BCD7', name: 'Decod. BCD 7Seg', w: 106, h: 136 },
  { type: 'BIN2BCD_N', cat: 'MUX, DEMUX y Códigos', badge: 'B>BCD', name: 'Binario → 4×BCD', w: 112, h: 98, scalableBits: true, defaultBits: 16 },
  { type: 'PARITY_4', cat: 'MUX, DEMUX y Códigos', badge: 'PAR4', name: 'Paridad 4-Bit', w: 100, h: 104 },
  { type: 'PARITY_N', cat: 'MUX, DEMUX y Códigos', badge: 'PAR-N', name: 'Paridad Bus (4-64b)', w: 104, h: 66, scalableBits: true, defaultBits: 16 },
  { type: 'BIN2GRAY_4', cat: 'MUX, DEMUX y Códigos', badge: 'B>G', name: 'Binario → Gray 4b', w: 100, h: 118 },
  { type: 'GRAY2BIN_4', cat: 'MUX, DEMUX y Códigos', badge: 'G>B', name: 'Gray → Binario 4b', w: 100, h: 118 },
  { type: 'BIN2GRAY_N', cat: 'MUX, DEMUX y Códigos', badge: 'BG-N', name: 'Bin → Gray Bus (4-64b)', w: 104, h: 64, scalableBits: true, defaultBits: 16 },
  { type: 'GRAY2BIN_N', cat: 'MUX, DEMUX y Códigos', badge: 'GB-N', name: 'Gray → Bin Bus (4-64b)', w: 104, h: 64, scalableBits: true, defaultBits: 16 },
  { type: 'CRC8_GEN', cat: 'MUX, DEMUX y Códigos', badge: 'CRC8', name: 'Generador CRC-8 Serie', w: 112, h: 92 },
  { type: 'CRC16_GEN', cat: 'MUX, DEMUX y Códigos', badge: 'CRC16', name: 'Generador CRC-16 CCITT', w: 114, h: 88 },

  // 6. Secuenciales y Registros
  { type: 'SR_LATCH', cat: 'Secuenciales y Registros', badge: 'SR', name: 'Latch SR', w: 86, h: 68 },
  { type: 'LATCH_D', cat: 'Secuenciales y Registros', badge: 'LAT', name: 'Latch D (transparente)', w: 90, h: 74 },
  { type: 'RS_FF', cat: 'Secuenciales y Registros', badge: 'RS-FF', name: 'Flip-Flop RS (Clk)', w: 90, h: 82 },
  { type: 'D_FF', cat: 'Secuenciales y Registros', badge: 'D-FF', name: 'Flip-Flop D', w: 88, h: 72 },
  { type: 'JK_FF', cat: 'Secuenciales y Registros', badge: 'JK-FF', name: 'Flip-Flop JK', w: 90, h: 82 },
  { type: 'T_FF', cat: 'Secuenciales y Registros', badge: 'T-FF', name: 'Flip-Flop T', w: 88, h: 72 },
  { type: 'EDGE_DET', cat: 'Secuenciales y Registros', badge: 'EDGE', name: 'Detector de Flanco', w: 92, h: 60 },
  { type: 'PULSE_ONE', cat: 'Secuenciales y Registros', badge: '1SHOT', name: 'Monoestable (1-Pulso)', w: 96, h: 68 },
  { type: 'REG_4', cat: 'Secuenciales y Registros', badge: 'REG4', name: 'Registro 4-Bit (pines)', w: 102, h: 112 },
  { type: 'REG_N', cat: 'Secuenciales y Registros', badge: 'REG-N', name: 'Registro Bus (4-64b)', w: 108, h: 86, scalableBits: true, defaultBits: 16 },
  { type: 'REG_FILE_N', cat: 'Secuenciales y Registros', badge: 'RF8xN', name: 'Banco 8 Regs (2R+1W)', w: 128, h: 152, scalableBits: true, defaultBits: 16 },
  { type: 'COUNTER_4', cat: 'Secuenciales y Registros', badge: 'CNT4', name: 'Contador 4-Bit (pines)', w: 104, h: 98 },
  { type: 'COUNTER_N', cat: 'Secuenciales y Registros', badge: 'CNT-N', name: 'Contador Bus (4-64b)', w: 112, h: 104, scalableBits: true, defaultBits: 16 },
  { type: 'UDCOUNTER_4', cat: 'Secuenciales y Registros', badge: 'U/D', name: 'Contador Arriba/Abajo', w: 108, h: 132 },
  { type: 'COUNTER_BCD', cat: 'Secuenciales y Registros', badge: 'BCD', name: 'Contador BCD (0-9)', w: 108, h: 120 },
  { type: 'SHIFT_REG_4', cat: 'Secuenciales y Registros', badge: 'SHR', name: 'Reg. Desplazamiento 4b', w: 106, h: 118 },
  { type: 'SHIFT_REG_N', cat: 'Secuenciales y Registros', badge: 'SHR-N', name: 'Reg. Desplaz. Bus N-Bit', w: 112, h: 92, scalableBits: true, defaultBits: 16 },
  { type: 'FREQ_DIV', cat: 'Secuenciales y Registros', badge: 'DIV', name: 'Divisor de frecuencia', w: 100, h: 104 },
  { type: 'TIMER_N', cat: 'Secuenciales y Registros', badge: 'TMR', name: 'Temporizador / PWM N-Bit', w: 112, h: 86, scalableBits: true, defaultBits: 16 },
  { type: 'LFSR_4', cat: 'Secuenciales y Registros', badge: 'LFSR', name: 'Aleatorio LFSR 4b', w: 106, h: 114 },
  { type: 'LFSR_N', cat: 'Secuenciales y Registros', badge: 'RND-N', name: 'Aleatorio LFSR (8-64b)', w: 110, h: 82, scalableBits: true, defaultBits: 32 },
  { type: 'PWM_GEN', cat: 'Secuenciales y Registros', badge: 'PWM', name: 'Generador PWM 8-Bit', w: 114, h: 92 },
  { type: 'RING_CNT', cat: 'Secuenciales y Registros', badge: 'RING', name: 'Contador Anillo / Johnson 8b', w: 116, h: 96 },
  { type: 'MOD_COUNTER_N', cat: 'Secuenciales y Registros', badge: 'MOD-M', name: 'Contador Módulo-M Programable', w: 118, h: 94, scalableBits: true, defaultBits: 8 },
  { type: 'WATCHDOG_N', cat: 'Secuenciales y Registros', badge: 'WDT', name: 'Temporizador Watchdog Hardware', w: 118, h: 92, scalableBits: true, defaultBits: 8 },
  { type: 'DEBOUNCER', cat: 'Secuenciales y Registros', badge: 'DEB', name: 'Filtro Antirrebote 4-Ciclos', w: 98, h: 64 },
  { type: 'STOPWATCH_N', cat: 'Secuenciales y Registros', badge: 'CRON', name: 'Cronómetro Digital N-Bit', w: 118, h: 88, scalableBits: true, defaultBits: 16 },

  // 7. Memorias y CPU Cores
  { type: 'STACK_LIFO', cat: 'Memorias y CPU Cores', badge: 'STK', name: 'Pila Hardware LIFO (64b)', w: 116, h: 108, scalableBits: true, defaultBits: 16 },
  { type: 'FIFO_N', cat: 'Memorias y CPU Cores', badge: 'FIFO', name: 'Cola FIFO (32×64b)', w: 118, h: 114, scalableBits: true, defaultBits: 16 },
  { type: 'RAM_16X4', cat: 'Memorias y CPU Cores', badge: 'RAM4', name: 'RAM 16×4 editable', w: 124, h: 150 },
  { type: 'ROM_16X4', cat: 'Memorias y CPU Cores', badge: 'ROM4', name: 'ROM 16×4 editable', w: 124, h: 128 },
  { type: 'RAM_N', cat: 'Memorias y CPU Cores', badge: 'RAM+', name: 'RAM Grande (64K×64b)', w: 132, h: 124, scalableBits: true, defaultBits: 16 },
  { type: 'ROM_N', cat: 'Memorias y CPU Cores', badge: 'ROM+', name: 'ROM Grande (64K×64b)', w: 132, h: 106, scalableBits: true, defaultBits: 16 },
  { type: 'DUAL_RAM_N', cat: 'Memorias y CPU Cores', badge: 'DRAM', name: 'RAM Doble Puerto (64b)', w: 138, h: 132, scalableBits: true, defaultBits: 16 },
  { type: 'FSM', cat: 'Memorias y CPU Cores', badge: 'FSM', name: 'Máquina de Estados', w: 170, h: 160 },
  { type: 'LUT_TRIG', cat: 'Memorias y CPU Cores', badge: 'TRIG', name: 'Tabla Seno/Cos (16b)', w: 110, h: 78 },
  { type: 'RAYCAST_CORE', cat: 'Memorias y CPU Cores', badge: 'DOOM', name: 'Motor Raycaster 3D', w: 148, h: 176 },
  { type: 'ANIM32_GPU', cat: 'Memorias y CPU Cores', badge: 'GPU32', name: 'GPU Animación 32 Escenas', w: 196, h: 224 },
  { type: 'UART_TX', cat: 'Memorias y CPU Cores', badge: 'TX8N1', name: 'Transmisor UART 8N1', w: 122, h: 98 },
  { type: 'UART_RX', cat: 'Memorias y CPU Cores', badge: 'RX8N1', name: 'Receptor UART 8N1', w: 122, h: 98 },

  // 8. Salidas, Pantallas y Audio
  { type: 'LED', cat: 'Salidas, Pantallas y Audio', badge: 'LED', name: 'LED Digital', w: 56, h: 46 },
  { type: 'LED_RGB', cat: 'Salidas, Pantallas y Audio', badge: 'RGB', name: 'LED RGB 3-Bit', w: 68, h: 68 },
  { type: 'SEG7_DISPLAY', cat: 'Salidas, Pantallas y Audio', badge: '7SEG', name: 'Display 7-Seg', w: 88, h: 142 },
  { type: 'HEX_DISPLAY', cat: 'Salidas, Pantallas y Audio', badge: 'HEX', name: 'Display Hex 4b', w: 84, h: 86 },
  { type: 'HEX_DISPLAY_N', cat: 'Salidas, Pantallas y Audio', badge: 'HEX64', name: 'Display Bus (4-64b)', w: 136, h: 72, scalableBits: true, defaultBits: 16 },
  { type: 'DEC_DISPLAY_N', cat: 'Salidas, Pantallas y Audio', badge: 'DEC±', name: 'Display Decimal (± N-Bit)', w: 126, h: 68, scalableBits: true, defaultBits: 8 },
  { type: 'TRAFFIC_LIGHT', cat: 'Salidas, Pantallas y Audio', badge: 'SEM', name: 'Semáforo R/Ámbar/Verde', w: 68, h: 116 },
  { type: 'SEG7_MULTI', cat: 'Salidas, Pantallas y Audio', badge: '7SEG+', name: 'Display 7-Seg Multi', w: 116, h: 124, variableInputs: true },
  { type: 'LED_BAR_4', cat: 'Salidas, Pantallas y Audio', badge: 'BAR4', name: 'Barra 4 LEDs', w: 74, h: 88 },
  { type: 'LED_BAR_8', cat: 'Salidas, Pantallas y Audio', badge: 'BAR-N', name: 'Barra LED Bus (8/16b)', w: 134, h: 52, scalableBits: true, defaultBits: 8 },
  { type: 'LED_MATRIX_4X4', cat: 'Salidas, Pantallas y Audio', badge: 'MTX4', name: 'Matriz LED 4×4', w: 130, h: 132 },
  { type: 'LED_MATRIX_8X8', cat: 'Salidas, Pantallas y Audio', badge: 'MTX8', name: 'Matriz LED 8×8 (Bus)', w: 152, h: 156 },
  { type: 'LCD_TEXT', cat: 'Salidas, Pantallas y Audio', badge: 'LCD', name: 'Pantalla LCD 16×2 ASCII', w: 224, h: 136 },
  { type: 'TEXT_CONSOLE', cat: 'Salidas, Pantallas y Audio', badge: 'TERM', name: 'Consola Terminal 24×8', w: 224, h: 144 },
  { type: 'VU_METER_N', cat: 'Salidas, Pantallas y Audio', badge: 'VU', name: 'Vúmetro Barra RGB (4-64b)', w: 72, h: 124, scalableBits: true, defaultBits: 8 },
  { type: 'VGA_SCREEN', cat: 'Salidas, Pantallas y Audio', badge: 'VGA', name: 'Pantalla VGA 64×48', w: 236, h: 196 },
  { type: 'BUZZER', cat: 'Salidas, Pantallas y Audio', badge: 'BUZ', name: 'Zumbador Audio', w: 64, h: 48 },
  { type: 'TONE_GEN', cat: 'Salidas, Pantallas y Audio', badge: 'SYNTH', name: 'Sintetizador Audio Hz', w: 108, h: 84 },

  // 9. Utilidades
  { type: 'LABEL', cat: 'Utilidades', badge: 'TXT', name: 'Etiqueta Texto', w: 120, h: 34 },
  { type: 'PROBE', cat: 'Utilidades', badge: 'CH', name: 'Nodo Sonda (1-64b)', w: 68, h: 40, scalableBits: true, defaultBits: 1 }
];

const seqNames = (p: string, n: number) => Array.from({ length: n }, (_, i) => p + i);

export function cloneCleanSubNetlist(netlist: SubNetlistState): SubNetlistState {
  const cloned = deserializeCircuitData<SubNetlistState>(serializeCircuitData(netlist, false));
  for (const sc of cloned.components) {
    sc.spawnScale = 1;
    sc.spawnVel = 0;
    if (sc.internalState) {
      sc.internalState.q = 0;
      sc.internalState.qn = 1;
      sc.internalState.reg = [0, 0, 0, 0];
      sc.internalState.regBig = 0n;
      sc.internalState.count = 0;
      sc.internalState.countBig = 0n;
      sc.internalState.prevClk = 0;
      sc.internalState.seqIdx = 0;
      sc.internalState.fsmState = 0;
    }
  }
  return cloned;
}

export interface CreateComponentOptions {
  id?: string;
  label?: string;
  noteText?: string;
  inputCount?: number;
  bits?: number;
  addrBits?: number;
  tunnelTag?: string;
  tunnelDir?: 'in' | 'out';
  splitWidths?: number[];
  sliceHi?: number;
  sliceLo?: number;
  signedMode?: boolean;
  modBase?: number;
  color?: string;
  freqHz?: number | null;
  buzzerHz?: number;
  probe?: boolean;
  icDefId?: string | null;
  icSnapshot?: CustomICDef | null;
  noAnim?: boolean;
  initialValue?: number | bigint;
  hexVal?: number | bigint;
  seqBits?: number[];
  mem?: (number | bigint)[];
  customICs?: CustomICDef[];
}

export function createComponent(type: string, x: number, y: number, options: CreateComponentOptions = {}): LogicComponent {
  const meta = COMPONENT_CATALOG.find(m => m.type === type) || { w: 96, h: 72, name: type, defaultBits: 1 };
  const bits = options.bits ?? meta.defaultBits ?? 1;
  const addrBits = options.addrBits ?? (type === 'RAM_N' || type === 'ROM_N' || type === 'DUAL_RAM_N' ? 8 : 4);

  const comp: LogicComponent = {
    id: options.id || genId('c'),
    type,
    x: Math.round(x / 10) * 10,
    y: Math.round(y / 10) * 10,
    w: meta.w,
    h: meta.h,
    bits,
    addrBits,
    tunnelTag: options.tunnelTag || (type === 'TUNNEL' ? 'SIG' : undefined),
    tunnelDir: options.tunnelDir || (type === 'TUNNEL' ? 'out' : undefined),
    splitWidths: options.splitWidths,
    sliceHi: options.sliceHi ?? Math.min(bits - 1, 7),
    sliceLo: options.sliceLo ?? 0,
    signedMode: options.signedMode || false,
    modBase: options.modBase ?? (type === 'WATCHDOG_N' ? 16 : 10),
    label: options.label !== undefined ? options.label : '',
    noteText: options.noteText || 'Nota del circuito',
    inputCount: options.inputCount || 2,
    color: options.color || 'cyan',
    freqHz: options.freqHz !== undefined ? options.freqHz : null,
    buzzerHz: options.buzzerHz || 440,
    probe: Boolean(options.probe),
    rot: 0,
    flip: false,
    icDefId: options.icDefId || null,
    icSnapshot: options.icSnapshot || null,
    spawnScale: options.noAnim ? 1 : 0.2,
    spawnVel: options.noAnim ? 0 : 8.5,
    unstable: false,
    pins: [],
    pinValues: {},
    internalState: {
      value: options.initialValue ?? 0,
      q: 0,
      qn: 1,
      reg: [0, 0, 0, 0],
      regBig: typeof options.initialValue === 'bigint' ? options.initialValue : BigInt(options.initialValue ?? 0),
      count: 0,
      countBig: 0n,
      prevClk: 0,
      clockTimer: 0,
      clockOut: 0,
      hexVal: options.hexVal ?? 0,
      seqBits: options.seqBits || [1, 0, 1, 1, 0, 0, 1, 0],
      seqIdx: 0,
      subState: null
    }
  };

  if (type === 'LFSR_4') comp.internalState.count = 1;
  if (type === 'LFSR_N') comp.internalState.countBig = 0xACE1n;
  if (type === 'RAM_16X4') comp.internalState.mem = new Array(16).fill(0);
  if (type === 'ROM_16X4') comp.internalState.mem = [1, 3, 7, 15, 14, 12, 8, 0, 10, 5, 10, 5, 15, 0, 15, 0];
  if (type === 'RAM_N' || type === 'ROM_N' || type === 'DUAL_RAM_N') {
    const size = Math.min(65536, 1 << Math.max(4, Math.min(16, addrBits)));
    comp.internalState.mem = new Array(size).fill(0n);
    if (options.mem) {
      for (let i = 0; i < Math.min(size, options.mem.length); i++) {
        comp.internalState.mem[i] = options.mem[i];
      }
    }
  } else if (options.mem) {
    comp.internalState.mem = [...options.mem];
  }
  if (type === 'VGA_SCREEN') {
    comp.internalState.vgaW = 64;
    comp.internalState.vgaH = 48;
    comp.internalState.vgaBuf = new Uint8Array(64 * 48);
    comp.internalState.vgaFront = new Uint8Array(64 * 48);
    comp.internalState.prevSwap = 0;
    comp.internalState.prevClr = 0;
  }
  if (type === 'STACK_LIFO') {
    comp.internalState.stack = [];
    comp.internalState.sp = 0;
  }
  if (type === 'FIFO_N') {
    comp.internalState.fifo = [];
  }
  if (type === 'REG_FILE_N') {
    comp.internalState.regFile = new Array(8).fill(0n);
  }
  if (type === 'LCD_TEXT') {
    comp.internalState.lcdChars = new Array(32).fill(32);
  }
  if (type === 'FSM') {
    comp.internalState.fsm = { n: 4, next0: [0, 2, 0, 2], next1: [1, 1, 3, 1], out: [0, 0, 0, 1] };
    comp.internalState.fsmState = 0;
  }
  if (type === 'HIGH') comp.internalState.value = 1;
  if (type === 'LOW') comp.internalState.value = 0;
  if (type === 'CONST_N') comp.internalState.value = BigInt(options.initialValue ?? 1);
  if (type === 'NUM_STEPPER') comp.internalState.value = BigInt(options.initialValue ?? 0);
  if (type === 'HEX_KEY_N') comp.internalState.hexVal = BigInt(options.hexVal ?? 0);
  if (type === 'RING_CNT') comp.internalState.count = 1;
  if (type === 'UART_TX') {
    comp.internalState.uartTxBusy = 0;
    comp.internalState.uartTxShift = 0;
    comp.internalState.uartTxRem = 0;
    comp.internalState.uartTxOut = 1;
  }
  if (type === 'UART_RX') {
    comp.internalState.uartRxState = 0;
    comp.internalState.uartRxBit = 0;
    comp.internalState.uartRxShift = 0;
    comp.internalState.uartRxData = 0;
    comp.internalState.uartRxValid = 0;
    comp.internalState.uartRxErr = 0;
  }
  if (type === 'TEXT_CONSOLE') {
    comp.internalState.textLines = [''];
  }
  if (type === 'CRC16_GEN') {
    comp.internalState.crcVal = 0xffff;
  }
  if (type === 'ROTARY_ENC') {
    comp.internalState.encPos = Number(options.initialValue ?? 0) & 255;
  }
  if (type === 'SLIDER_ADC') {
    comp.internalState.adcVal = Number(options.initialValue ?? 64);
    comp.internalState.value = BigInt(options.initialValue ?? 64);
  }
  if (type === 'ANIM32_GPU') {
    comp.internalState.animScene = 0;
    comp.internalState.animSubFrame = 0;
    comp.internalState.animPx = 0;
    comp.internalState.animPy = 0;
    comp.internalState.animStep = 0;
  }

  if (type === 'CUSTOM_IC') {
    const def = (options.customICs || []).find(d => d.id === comp.icDefId) || comp.icSnapshot;
    if (def) {
      comp.icSnapshot = deserializeCircuitData<CustomICDef>(serializeCircuitData(def, false));
      comp.label = comp.label || def.name;
      comp.internalState.subState = cloneCleanSubNetlist(def.netlist);
    }
  }

  syncComponentPins(comp, options.customICs);
  return comp;
}

export function getSplitterChunks(comp: LogicComponent): number[] {
  const b = Math.max(2, Math.min(64, comp.bits || 8));
  if (comp.splitWidths && comp.splitWidths.length > 0 && comp.splitWidths.reduce((s, x) => s + x, 0) === b) {
    return comp.splitWidths;
  }
  if (b <= 8) return new Array(b).fill(1);
  if (b === 16) return [8, 8];
  if (b === 32) return [8, 8, 8, 8];
  if (b === 64) return [16, 16, 16, 16];
  return [Math.floor(b / 2), b - Math.floor(b / 2)];
}

export function syncComponentPins(comp: LogicComponent, customICs: CustomICDef[] = []): void {
  const pins: PinDef[] = [];
  const addPin = (id: string, dir: 'in' | 'out', lx: number, ly: number, label = '', width = 1) => {
    pins.push({ id, dir, lx, ly, label, width });
  };
  const b = Math.max(1, Math.min(64, comp.bits || 1));

  const placeRows = (
    left: Array<{ id: string; label: string; width?: number }>,
    right: Array<{ id: string; label: string; width?: number }>,
    bottom: Array<{ id: string; label: string; width?: number }> = [],
    minH = 60,
    rowPitch = 20
  ) => {
    const maxSide = Math.max(left.length, right.length, 1);
    comp.h = Math.max(minH, maxSide * rowPitch + (bottom.length ? 30 : 20));
    const spanL = left.length > 1 ? comp.h - (bottom.length ? 38 : 26) : 0;
    const spanR = right.length > 1 ? comp.h - (bottom.length ? 38 : 26) : 0;
    const yOff = bottom.length ? -8 : 0;
    left.forEach((p, i) => {
      const py = left.length === 1 ? yOff : yOff - spanL / 2 + (spanL / (left.length - 1)) * i;
      addPin(p.id, 'in', -comp.w / 2, py, p.label, p.width ?? 1);
    });
    right.forEach((p, i) => {
      const py = right.length === 1 ? yOff : yOff - spanR / 2 + (spanR / (right.length - 1)) * i;
      addPin(p.id, 'out', comp.w / 2, py, p.label, p.width ?? 1);
    });
    bottom.forEach((p, i) => {
      const spanB = bottom.length > 1 ? Math.min(comp.w - 36, (bottom.length - 1) * 26) : 0;
      const px = bottom.length === 1 ? 0 : -spanB / 2 + (spanB / (bottom.length - 1)) * i;
      addPin(p.id, 'in', px, comp.h / 2, p.label, p.width ?? 1);
    });
  };

  switch (comp.type) {
    case 'SWITCH':
    case 'BUTTON':
    case 'CLOCK':
    case 'HIGH':
    case 'LOW':
      addPin('out', 'out', comp.w / 2, 0, 'OUT', 1);
      break;

    case 'CONST_N':
    case 'HEX_KEY_N':
    case 'NUM_STEPPER':
      addPin('out', 'out', comp.w / 2, 0, `${b}b`, b);
      break;

    case 'DIP_SWITCH': {
      const n = Math.max(4, Math.min(16, b));
      comp.bits = n;
      comp.h = Math.max(56, n * 13 + 18);
      addPin('bus', 'out', comp.w / 2, 0, `${n}b`, n);
      break;
    }

    case 'HEX_KEY':
      comp.h = 88;
      addPin('b3', 'out', comp.w / 2, -27, 'B3');
      addPin('b2', 'out', comp.w / 2, -9, 'B2');
      addPin('b1', 'out', comp.w / 2, 9, 'B1');
      addPin('b0', 'out', comp.w / 2, 27, 'B0');
      break;

    case 'PULSE_GEN':
      addPin('clk', 'in', -comp.w / 2, 0, 'CLK');
      addPin('out', 'out', comp.w / 2, 0, 'OUT');
      break;

    case 'GAMEPAD':
      addPin('w', 'out', comp.w / 2, -36, 'UP');
      addPin('s', 'out', comp.w / 2, -18, 'DN');
      addPin('a', 'out', comp.w / 2, 0, 'LT');
      addPin('d', 'out', comp.w / 2, 18, 'RT');
      addPin('fire', 'out', comp.w / 2, 36, 'FIRE');
      addPin('bus', 'out', 0, comp.h / 2, 'PAD5', 5);
      break;

    case 'KEYBOARD_ASCII':
      addPin('clk', 'in', -comp.w / 2, 0, 'ACK');
      addPin('ascii', 'out', comp.w / 2, -14, 'ASC8', 8);
      addPin('ready', 'out', comp.w / 2, 14, 'RDY', 1);
      break;

    case 'BUFFER':
    case 'NOT':
    case 'PROBE':
      addPin('in0', 'in', -comp.w / 2, 0, b > 1 ? `A(${b})` : 'A', b);
      addPin('out', 'out', comp.w / 2, 0, b > 1 ? `Y(${b})` : 'Y', b);
      break;

    case 'AND':
    case 'NAND':
    case 'OR':
    case 'NOR':
    case 'XOR':
    case 'XNOR': {
      const n = Math.max(2, Math.min(4, comp.inputCount || 2));
      comp.h = n === 2 ? 56 : (n === 3 ? 68 : 82);
      const span = comp.h - 24;
      for (let i = 0; i < n; i++) {
        const py = -span / 2 + (span / (n - 1)) * i;
        addPin(`in${i}`, 'in', -comp.w / 2, py, String.fromCharCode(65 + i), b);
      }
      addPin('out', 'out', comp.w / 2, 0, 'Y', b);
      break;
    }

    case 'MAJ3':
      addPin('in0', 'in', -comp.w / 2, -20, 'A', b);
      addPin('in1', 'in', -comp.w / 2, 0, 'B', b);
      addPin('in2', 'in', -comp.w / 2, 20, 'C', b);
      addPin('out', 'out', comp.w / 2, 0, 'MAJ', b);
      break;

    case 'TRI_BUFFER':
      addPin('in0', 'in', -comp.w / 2, -10, 'IN', b);
      addPin('oe', 'in', 0, comp.h / 2, 'OE', 1);
      addPin('out', 'out', comp.w / 2, -10, 'OUT', b);
      break;

    case 'TUNNEL':
      if (comp.tunnelDir === 'in') {
        addPin('out', 'out', comp.w / 2, 0, `${b}b`, b);
      } else {
        addPin('in0', 'in', -comp.w / 2, 0, `${b}b`, b);
      }
      break;

    case 'SPLITTER': {
      const chunks = getSplitterChunks(comp);
      comp.w = 118;
      comp.h = Math.max(76, chunks.length * 22 + 52);
      addPin('bus', 'in', -comp.w / 2, 0, `${b}b`, b);
      const span = chunks.length > 1 ? comp.h - 52 : 0;
      let bitOffset = 0;
      chunks.forEach((cw, idx) => {
        const py = chunks.length === 1 ? 0 : -span / 2 + (span / (chunks.length - 1)) * idx;
        const lbl = cw === 1 ? `b${bitOffset}` : `[${bitOffset + cw - 1}:${bitOffset}]`;
        addPin(`p${idx}`, 'out', comp.w / 2, py, lbl, cw);
        bitOffset += cw;
      });
      break;
    }

    case 'MERGER': {
      const chunks = getSplitterChunks(comp);
      comp.w = 118;
      comp.h = Math.max(76, chunks.length * 22 + 52);
      const span = chunks.length > 1 ? comp.h - 52 : 0;
      let bitOffset = 0;
      chunks.forEach((cw, idx) => {
        const py = chunks.length === 1 ? 0 : -span / 2 + (span / (chunks.length - 1)) * idx;
        const lbl = cw === 1 ? `b${bitOffset}` : `[${bitOffset + cw - 1}:${bitOffset}]`;
        addPin(`p${idx}`, 'in', -comp.w / 2, py, lbl, cw);
        bitOffset += cw;
      });
      addPin('bus', 'out', comp.w / 2, 0, `${b}b`, b);
      break;
    }

    case 'BUS_SLICE': {
      const hi = Math.max(0, Math.min(b - 1, comp.sliceHi ?? Math.min(b - 1, 7)));
      const lo = Math.max(0, Math.min(hi, comp.sliceLo ?? 0));
      comp.sliceHi = hi;
      comp.sliceLo = lo;
      const outW = hi - lo + 1;
      addPin('in0', 'in', -comp.w / 2, 0, `IN(${b})`, b);
      addPin('out', 'out', comp.w / 2, 0, `[${hi}:${lo}]`, outW);
      break;
    }

    case 'BIT_EXTEND': {
      const inW = Math.max(1, Math.min(32, Math.floor(b / 2) || 4));
      addPin('in0', 'in', -comp.w / 2, 0, `${inW}b`, inW);
      addPin('out', 'out', comp.w / 2, 0, `${b}b`, b);
      break;
    }

    case 'SR_LATCH':
      addPin('s', 'in', -comp.w / 2, -16, 'S');
      addPin('r', 'in', -comp.w / 2, 16, 'R');
      addPin('q', 'out', comp.w / 2, -16, 'Q');
      addPin('qn', 'out', comp.w / 2, 16, 'Q̅');
      break;

    case 'LATCH_D':
      addPin('d', 'in', -comp.w / 2, -18, 'D');
      addPin('en', 'in', -comp.w / 2, 18, 'EN');
      addPin('q', 'out', comp.w / 2, -18, 'Q');
      addPin('qn', 'out', comp.w / 2, 18, 'Q̅');
      break;

    case 'D_FF':
      addPin('d', 'in', -comp.w / 2, -18, 'D');
      addPin('clk', 'in', -comp.w / 2, 18, 'CLK');
      addPin('q', 'out', comp.w / 2, -18, 'Q');
      addPin('qn', 'out', comp.w / 2, 18, 'Q̅');
      break;

    case 'T_FF':
      addPin('t', 'in', -comp.w / 2, -18, 'T');
      addPin('clk', 'in', -comp.w / 2, 18, 'CLK');
      addPin('q', 'out', comp.w / 2, -18, 'Q');
      addPin('qn', 'out', comp.w / 2, 18, 'Q̅');
      break;

    case 'RS_FF':
      addPin('s', 'in', -comp.w / 2, -24, 'S');
      addPin('clk', 'in', -comp.w / 2, 0, 'CLK');
      addPin('r', 'in', -comp.w / 2, 24, 'R');
      addPin('q', 'out', comp.w / 2, -18, 'Q');
      addPin('qn', 'out', comp.w / 2, 18, 'Q̅');
      break;

    case 'JK_FF':
      addPin('j', 'in', -comp.w / 2, -24, 'J');
      addPin('clk', 'in', -comp.w / 2, 0, 'CLK');
      addPin('k', 'in', -comp.w / 2, 24, 'K');
      addPin('q', 'out', comp.w / 2, -18, 'Q');
      addPin('qn', 'out', comp.w / 2, 18, 'Q̅');
      break;

    case 'EDGE_DET':
      addPin('in0', 'in', -comp.w / 2, -14, 'SIG');
      addPin('clk', 'in', -comp.w / 2, 14, 'CLK');
      addPin('rise', 'out', comp.w / 2, -14, 'RISE');
      addPin('fall', 'out', comp.w / 2, 14, 'FALL');
      break;

    case 'PULSE_ONE':
      addPin('trig', 'in', -comp.w / 2, -14, 'TRG');
      addPin('clk', 'in', -comp.w / 2, 14, 'CLK');
      addPin('q', 'out', comp.w / 2, 0, 'PLS');
      break;

    case 'REG_4':
      addPin('d0', 'in', -comp.w / 2, -36, 'D0');
      addPin('d1', 'in', -comp.w / 2, -18, 'D1');
      addPin('d2', 'in', -comp.w / 2, 0, 'D2');
      addPin('d3', 'in', -comp.w / 2, 18, 'D3');
      addPin('clk', 'in', -comp.w / 2, 38, 'CLK');
      addPin('rst', 'in', 0, comp.h / 2, 'RST');
      addPin('q0', 'out', comp.w / 2, -36, 'Q0');
      addPin('q1', 'out', comp.w / 2, -18, 'Q1');
      addPin('q2', 'out', comp.w / 2, 0, 'Q2');
      addPin('q3', 'out', comp.w / 2, 18, 'Q3');
      break;

    case 'REG_N':
      placeRows(
        [
          { id: 'd', label: `D(${b})`, width: b },
          { id: 'en', label: 'EN', width: 1 },
          { id: 'clk', label: 'CLK', width: 1 },
          { id: 'rst', label: 'RST', width: 1 }
        ],
        [{ id: 'q', label: `Q(${b})`, width: b }],
        [],
        86,
        20
      );
      break;

    case 'COUNTER_4':
      addPin('clk', 'in', -comp.w / 2, -20, 'CLK');
      addPin('en', 'in', -comp.w / 2, 0, 'EN');
      addPin('rst', 'in', -comp.w / 2, 20, 'RST');
      addPin('q3', 'out', comp.w / 2, -27, 'Q3');
      addPin('q2', 'out', comp.w / 2, -9, 'Q2');
      addPin('q1', 'out', comp.w / 2, 9, 'Q1');
      addPin('q0', 'out', comp.w / 2, 27, 'Q0');
      break;

    case 'COUNTER_N':
      placeRows(
        [
          { id: 'clk', label: 'CLK', width: 1 },
          { id: 'en', label: 'EN', width: 1 },
          { id: 'up', label: 'UP', width: 1 },
          { id: 'load', label: 'LD', width: 1 },
          { id: 'd', label: `D(${b})`, width: b },
          { id: 'rst', label: 'RST', width: 1 }
        ],
        [
          { id: 'q', label: `Q(${b})`, width: b },
          { id: 'co', label: 'CO', width: 1 }
        ],
        [],
        112,
        17
      );
      break;

    case 'UDCOUNTER_4':
      placeRows(
        [{ id: 'clk', label: 'CLK' }, { id: 'en', label: 'EN' }, { id: 'up', label: 'UP' }, { id: 'rst', label: 'RST' }],
        [...seqNames('q', 4).map(id => ({ id, label: id.toUpperCase() })), { id: 'co', label: 'CO' }],
        [],
        132,
        20
      );
      break;

    case 'COUNTER_BCD':
      placeRows(
        [{ id: 'clk', label: 'CLK' }, { id: 'en', label: 'EN' }, { id: 'rst', label: 'RST' }],
        [...seqNames('q', 4).map(id => ({ id, label: id.toUpperCase() })), { id: 'co', label: 'CO' }],
        [],
        120,
        20
      );
      break;

    case 'SHIFT_REG_4':
      placeRows(
        [{ id: 'd', label: 'D' }, { id: 'clk', label: 'CLK' }, { id: 'rst', label: 'RST' }],
        seqNames('q', 4).map(id => ({ id, label: id.toUpperCase() })),
        [],
        118,
        20
      );
      break;

    case 'SHIFT_REG_N':
      placeRows(
        [
          { id: 'sin', label: 'SIN', width: 1 },
          { id: 'd', label: `LD(${b})`, width: b },
          { id: 'load', label: 'SH/LD', width: 1 },
          { id: 'clk', label: 'CLK', width: 1 },
          { id: 'rst', label: 'RST', width: 1 }
        ],
        [
          { id: 'q', label: `Q(${b})`, width: b },
          { id: 'sout', label: 'SOUT', width: 1 }
        ],
        [],
        96,
        18
      );
      break;

    case 'FREQ_DIV':
      placeRows(
        [{ id: 'clk', label: 'CLK' }, { id: 'rst', label: 'RST' }],
        ['d2', 'd4', 'd8', 'd16'].map(id => ({ id, label: id.toUpperCase() })),
        [],
        104,
        20
      );
      break;

    case 'TIMER_N':
      placeRows(
        [
          { id: 'period', label: `PER(${b})`, width: b },
          { id: 'en', label: 'EN', width: 1 },
          { id: 'clk', label: 'CLK', width: 1 },
          { id: 'rst', label: 'RST', width: 1 }
        ],
        [
          { id: 'tick', label: 'TICK', width: 1 },
          { id: 'q', label: `CNT(${b})`, width: b }
        ],
        [],
        88,
        19
      );
      break;

    case 'LFSR_4':
      placeRows(
        [{ id: 'clk', label: 'CLK' }, { id: 'en', label: 'EN' }, { id: 'rst', label: 'RST' }],
        seqNames('q', 4).map(id => ({ id, label: id.toUpperCase() })),
        [],
        114,
        20
      );
      break;

    case 'LFSR_N':
      placeRows(
        [{ id: 'clk', label: 'CLK' }, { id: 'en', label: 'EN' }, { id: 'rst', label: 'RST' }],
        [{ id: 'q', label: `RND(${b})`, width: b }],
        [],
        82,
        20
      );
      break;

    case 'PWM_GEN':
      placeRows(
        [
          { id: 'duty', label: 'DUTY(8)', width: 8 },
          { id: 'en', label: 'EN', width: 1 },
          { id: 'clk', label: 'CLK', width: 1 }
        ],
        [
          { id: 'pwm', label: 'PWM', width: 1 },
          { id: 'cnt', label: 'CNT(8)', width: 8 }
        ],
        [{ id: 'rst', label: 'RST', width: 1 }],
        92,
        21
      );
      break;

    case 'RING_CNT':
      placeRows(
        [
          { id: 'clk', label: 'CLK', width: 1 },
          { id: 'en', label: 'EN', width: 1 },
          { id: 'jhn', label: 'JHN', width: 1 }
        ],
        [
          { id: 'q', label: 'Q(8)', width: 8 },
          { id: 'tc', label: 'TC', width: 1 }
        ],
        [{ id: 'rst', label: 'RST', width: 1 }],
        96,
        21
      );
      break;

    case 'STACK_LIFO':
      placeRows(
        [
          { id: 'd', label: `D(${b})`, width: b },
          { id: 'push', label: 'PUSH', width: 1 },
          { id: 'pop', label: 'POP', width: 1 },
          { id: 'clk', label: 'CLK', width: 1 },
          { id: 'rst', label: 'RST', width: 1 }
        ],
        [
          { id: 'q', label: `TOP(${b})`, width: b },
          { id: 'empty', label: 'EMP', width: 1 },
          { id: 'full', label: 'FULL', width: 1 }
        ],
        [],
        108,
        19
      );
      break;

    case 'FIFO_N':
      placeRows(
        [
          { id: 'd', label: `D(${b})`, width: b },
          { id: 'push', label: 'PUSH', width: 1 },
          { id: 'pop', label: 'POP', width: 1 },
          { id: 'clk', label: 'CLK', width: 1 },
          { id: 'rst', label: 'RST', width: 1 }
        ],
        [
          { id: 'q', label: `Q(${b})`, width: b },
          { id: 'empty', label: 'EMP', width: 1 },
          { id: 'full', label: 'FULL', width: 1 },
          { id: 'cnt', label: 'CNT(6)', width: 6 }
        ],
        [],
        114,
        19
      );
      break;

    case 'REG_FILE_N':
      placeRows(
        [
          { id: 'ra', label: 'RA(3)', width: 3 },
          { id: 'rb', label: 'RB(3)', width: 3 },
          { id: 'wa', label: 'WA(3)', width: 3 },
          { id: 'wd', label: `WD(${b})`, width: b },
          { id: 'we', label: 'WE', width: 1 },
          { id: 'clk', label: 'CLK', width: 1 },
          { id: 'rst', label: 'RST', width: 1 }
        ],
        [
          { id: 'qa', label: `QA(${b})`, width: b },
          { id: 'qb', label: `QB(${b})`, width: b }
        ],
        [],
        152,
        20
      );
      break;

    case 'HALF_ADDER':
      addPin('a', 'in', -comp.w / 2, -16, 'A');
      addPin('b', 'in', -comp.w / 2, 16, 'B');
      addPin('s', 'out', comp.w / 2, -16, 'S');
      addPin('c', 'out', comp.w / 2, 16, 'C');
      break;

    case 'FULL_ADDER':
      addPin('a', 'in', -comp.w / 2, -24, 'A');
      addPin('b', 'in', -comp.w / 2, 0, 'B');
      addPin('cin', 'in', -comp.w / 2, 24, 'Cin');
      addPin('s', 'out', comp.w / 2, -16, 'S');
      addPin('cout', 'out', comp.w / 2, 16, 'Cout');
      break;

    case 'ADDER_4':
      placeRows(
        [...seqNames('a', 4).map(id => ({ id, label: id.toUpperCase() })), ...seqNames('b', 4).map(id => ({ id, label: id.toUpperCase() })), { id: 'cin', label: 'CIN' }],
        [...seqNames('s', 4).map(id => ({ id, label: id.toUpperCase() })), { id: 'cout', label: 'COUT' }],
        [],
        190,
        19
      );
      break;

    case 'ADDER_N':
    case 'SUB_N':
      placeRows(
        [
          { id: 'a', label: `A(${b})`, width: b },
          { id: 'b', label: `B(${b})`, width: b },
          { id: 'cin', label: comp.type === 'SUB_N' ? 'BIN' : 'CIN', width: 1 }
        ],
        [
          { id: 'y', label: `Y(${b})`, width: b },
          { id: 'cout', label: comp.type === 'SUB_N' ? 'BOR' : 'COUT', width: 1 }
        ],
        [],
        88,
        22
      );
      break;

    case 'MULT_2X2':
      placeRows(
        ['a0', 'a1', 'b0', 'b1'].map(id => ({ id, label: id.toUpperCase() })),
        seqNames('p', 4).map(id => ({ id, label: id.toUpperCase() })),
        [],
        118,
        22
      );
      break;

    case 'MULT_N':
      placeRows(
        [{ id: 'a', label: `A(${b})`, width: b }, { id: 'b', label: `B(${b})`, width: b }],
        [{ id: 'p', label: `LO(${b})`, width: b }, { id: 'hi', label: `HI(${b})`, width: b }],
        [],
        86,
        24
      );
      break;

    case 'DIV_N':
      placeRows(
        [{ id: 'a', label: `A(${b})`, width: b }, { id: 'b', label: `B(${b})`, width: b }],
        [{ id: 'q', label: `Q(${b})`, width: b }, { id: 'r', label: `R(${b})`, width: b }],
        [],
        86,
        24
      );
      break;

    case 'SHIFTER_N':
      placeRows(
        [
          { id: 'a', label: `A(${b})`, width: b },
          { id: 'sh', label: 'AMT(6)', width: 6 },
          { id: 'op', label: 'OP(3)', width: 3 }
        ],
        [{ id: 'y', label: `Y(${b})`, width: b }],
        [],
        92,
        22
      );
      break;

    case 'INC_DEC_N':
      placeRows(
        [
          { id: 'a', label: `A(${b})`, width: b },
          { id: 'sub', label: 'DEC', width: 1 },
          { id: 'step', label: 'STP(4)', width: 4 }
        ],
        [
          { id: 'y', label: `Y(${b})`, width: b },
          { id: 'cout', label: 'CO', width: 1 }
        ],
        [],
        82,
        21
      );
      break;

    case 'ABS_NEG_N':
      placeRows(
        [
          { id: 'a', label: `A(${b})`, width: b },
          { id: 'op', label: 'OP(2)', width: 2 }
        ],
        [{ id: 'y', label: `Y(${b})`, width: b }],
        [],
        80,
        22
      );
      break;

    case 'MIN_MAX_N':
      placeRows(
        [
          { id: 'a', label: `A(${b})`, width: b },
          { id: 'b', label: `B(${b})`, width: b }
        ],
        [
          { id: 'min', label: `MIN(${b})`, width: b },
          { id: 'max', label: `MAX(${b})`, width: b }
        ],
        [],
        84,
        24
      );
      break;

    case 'POPCOUNT_N':
      placeRows(
        [{ id: 'd', label: `D(${b})`, width: b }],
        [
          { id: 'pop', label: 'POP(8)', width: 8 },
          { id: 'clz', label: 'CLZ(8)', width: 8 },
          { id: 'ctz', label: 'CTZ(8)', width: 8 }
        ],
        [],
        84,
        21
      );
      break;

    case 'BIN2BCD_N':
      placeRows(
        [{ id: 'd', label: `BIN(${Math.min(16, b)})`, width: Math.min(16, b) }],
        [
          { id: 'd3', label: 'D3(4)', width: 4 },
          { id: 'd2', label: 'D2(4)', width: 4 },
          { id: 'd1', label: 'D1(4)', width: 4 },
          { id: 'd0', label: 'D0(4)', width: 4 }
        ],
        [],
        98,
        20
      );
      break;

    case 'ALU_N':
      placeRows(
        [
          { id: 'a', label: `A(${b})`, width: b },
          { id: 'b', label: `B(${b})`, width: b },
          { id: 'op', label: 'OP(4)', width: 4 },
          { id: 'cin', label: 'CIN', width: 1 }
        ],
        [
          { id: 'y', label: `Y(${b})`, width: b },
          { id: 'z', label: 'Z', width: 1 },
          { id: 'cout', label: 'C', width: 1 },
          { id: 'neg', label: 'N', width: 1 },
          { id: 'ovf', label: 'V', width: 1 }
        ],
        [],
        136,
        21
      );
      break;

    case 'MAC_N':
      placeRows(
        [
          { id: 'a', label: `A(${b})`, width: b },
          { id: 'b', label: `B(${b})`, width: b },
          { id: 'en', label: 'EN', width: 1 },
          { id: 'clk', label: 'CLK', width: 1 }
        ],
        [
          { id: 'acc', label: `ACC(${b})`, width: b },
          { id: 'ovf', label: 'OVF', width: 1 }
        ],
        [{ id: 'clr', label: 'CLR', width: 1 }],
        126,
        21
      );
      break;

    case 'MUX_2':
      addPin('d0', 'in', -comp.w / 2, -18, 'D0', b);
      addPin('d1', 'in', -comp.w / 2, 18, 'D1', b);
      addPin('s0', 'in', 0, comp.h / 2, 'S0', 1);
      addPin('y', 'out', comp.w / 2, 0, 'Y', b);
      break;

    case 'DEMUX_2':
      addPin('din', 'in', -comp.w / 2, 0, 'IN', b);
      addPin('s0', 'in', 0, comp.h / 2, 'S0', 1);
      addPin('y0', 'out', comp.w / 2, -18, 'Y0', b);
      addPin('y1', 'out', comp.w / 2, 18, 'Y1', b);
      break;

    case 'MUX_4':
      addPin('d0', 'in', -comp.w / 2, -36, 'D0', b);
      addPin('d1', 'in', -comp.w / 2, -12, 'D1', b);
      addPin('d2', 'in', -comp.w / 2, 12, 'D2', b);
      addPin('d3', 'in', -comp.w / 2, 36, 'D3', b);
      addPin('s0', 'in', -14, comp.h / 2, 'S0', 1);
      addPin('s1', 'in', 14, comp.h / 2, 'S1', 1);
      addPin('y', 'out', comp.w / 2, 0, 'Y', b);
      break;

    case 'DEMUX_4':
      placeRows(
        [{ id: 'din', label: 'DIN', width: b }],
        seqNames('y', 4).map(id => ({ id, label: id.toUpperCase(), width: b })),
        [{ id: 's0', label: 'S0' }, { id: 's1', label: 'S1' }],
        118,
        20
      );
      break;

    case 'MUX_8':
      placeRows(
        seqNames('d', 8).map(id => ({ id, label: id.toUpperCase(), width: b })),
        [{ id: 'y', label: 'Y', width: b }],
        [{ id: 's0', label: 'S0' }, { id: 's1', label: 'S1' }, { id: 's2', label: 'S2' }],
        176,
        18
      );
      break;

    case 'DEMUX_8':
      placeRows(
        [{ id: 'din', label: 'DIN', width: b }],
        seqNames('y', 8).map(id => ({ id, label: id.toUpperCase(), width: b })),
        [{ id: 's0', label: 'S0' }, { id: 's1', label: 'S1' }, { id: 's2', label: 'S2' }],
        176,
        18
      );
      break;

    case 'MUX_16':
      placeRows(
        seqNames('d', 16).map(id => ({ id, label: id.toUpperCase(), width: b })),
        [{ id: 'y', label: 'Y', width: b }],
        [{ id: 's0', label: 'S0' }, { id: 's1', label: 'S1' }, { id: 's2', label: 'S2' }, { id: 's3', label: 'S3' }],
        274,
        15
      );
      break;

    case 'DEMUX_16':
      placeRows(
        [{ id: 'din', label: 'DIN', width: b }],
        seqNames('y', 16).map(id => ({ id, label: id.toUpperCase(), width: b })),
        [{ id: 's0', label: 'S0' }, { id: 's1', label: 'S1' }, { id: 's2', label: 'S2' }, { id: 's3', label: 'S3' }],
        274,
        15
      );
      break;

    case 'MUX_32':
      placeRows(
        seqNames('d', 32).map(id => ({ id, label: id.toUpperCase(), width: b })),
        [{ id: 'y', label: 'Y', width: b }],
        [{ id: 's0', label: 'S0' }, { id: 's1', label: 'S1' }, { id: 's2', label: 'S2' }, { id: 's3', label: 'S3' }, { id: 's4', label: 'S4' }],
        460,
        13
      );
      break;

    case 'DEMUX_32':
      placeRows(
        [{ id: 'din', label: 'DIN', width: b }],
        seqNames('y', 32).map(id => ({ id, label: id.toUpperCase(), width: b })),
        [{ id: 's0', label: 'S0' }, { id: 's1', label: 'S1' }, { id: 's2', label: 'S2' }, { id: 's3', label: 'S3' }, { id: 's4', label: 'S4' }],
        460,
        13
      );
      break;

    case 'DEC_2TO4':
      placeRows(
        [{ id: 'a0', label: 'A0' }, { id: 'a1', label: 'A1' }],
        seqNames('y', 4).map(id => ({ id, label: id.toUpperCase() })),
        [{ id: 'en', label: 'EN' }],
        102,
        18
      );
      break;

    case 'DEC_3TO8':
      placeRows(
        [{ id: 'a0', label: 'A0' }, { id: 'a1', label: 'A1' }, { id: 'a2', label: 'A2' }],
        seqNames('y', 8).map(id => ({ id, label: id.toUpperCase() })),
        [{ id: 'en', label: 'EN' }],
        176,
        18
      );
      break;

    case 'DEC_4TO16':
      placeRows(
        [{ id: 'a0', label: 'A0' }, { id: 'a1', label: 'A1' }, { id: 'a2', label: 'A2' }, { id: 'a3', label: 'A3' }],
        seqNames('y', 16).map(id => ({ id, label: id.toUpperCase() })),
        [{ id: 'en', label: 'EN' }],
        274,
        15
      );
      break;

    case 'DEC_5TO32':
      placeRows(
        [{ id: 'a0', label: 'A0' }, { id: 'a1', label: 'A1' }, { id: 'a2', label: 'A2' }, { id: 'a3', label: 'A3' }, { id: 'a4', label: 'A4' }],
        seqNames('y', 32).map(id => ({ id, label: id.toUpperCase() })),
        [{ id: 'en', label: 'EN' }],
        460,
        13
      );
      break;

    case 'ENC_4TO2':
      placeRows(
        seqNames('i', 4).map(id => ({ id, label: id.toUpperCase() })),
        [{ id: 'y0', label: 'Y0' }, { id: 'y1', label: 'Y1' }, { id: 'v', label: 'V' }],
        [],
        104,
        20
      );
      break;

    case 'ENC_8TO3':
      placeRows(
        seqNames('i', 8).map(id => ({ id, label: id.toUpperCase() })),
        [{ id: 'y0', label: 'Y0' }, { id: 'y1', label: 'Y1' }, { id: 'y2', label: 'Y2' }, { id: 'v', label: 'V' }],
        [],
        170,
        18
      );
      break;

    case 'ENC_16TO4':
      placeRows(
        seqNames('i', 16).map(id => ({ id, label: id.toUpperCase() })),
        [{ id: 'y0', label: 'Y0' }, { id: 'y1', label: 'Y1' }, { id: 'y2', label: 'Y2' }, { id: 'y3', label: 'Y3' }, { id: 'v', label: 'V' }],
        [],
        274,
        15
      );
      break;

    case 'ENC_32TO5':
      placeRows(
        seqNames('i', 32).map(id => ({ id, label: id.toUpperCase() })),
        [{ id: 'y0', label: 'Y0' }, { id: 'y1', label: 'Y1' }, { id: 'y2', label: 'Y2' }, { id: 'y3', label: 'Y3' }, { id: 'y4', label: 'Y4' }, { id: 'v', label: 'V' }],
        [],
        460,
        13
      );
      break;

    case 'PARITY_4':
      placeRows(
        seqNames('d', 4).map(id => ({ id, label: id.toUpperCase() })),
        [{ id: 'even', label: 'EVEN' }, { id: 'odd', label: 'ODD' }],
        [],
        104,
        20
      );
      break;

    case 'PARITY_N':
      placeRows(
        [{ id: 'd', label: `D(${b})`, width: b }],
        [{ id: 'even', label: 'EVEN' }, { id: 'odd', label: 'ODD' }],
        [],
        66,
        22
      );
      break;

    case 'BIN2GRAY_4':
      placeRows(
        seqNames('b', 4).map(id => ({ id, label: id.toUpperCase() })),
        seqNames('g', 4).map(id => ({ id, label: id.toUpperCase() })),
        [],
        118,
        22
      );
      break;

    case 'GRAY2BIN_4':
      placeRows(
        seqNames('g', 4).map(id => ({ id, label: id.toUpperCase() })),
        seqNames('b', 4).map(id => ({ id, label: id.toUpperCase() })),
        [],
        118,
        22
      );
      break;

    case 'BIN2GRAY_N':
      placeRows([{ id: 'b', label: `B(${b})`, width: b }], [{ id: 'g', label: `G(${b})`, width: b }], [], 64, 22);
      break;

    case 'GRAY2BIN_N':
      placeRows([{ id: 'g', label: `G(${b})`, width: b }], [{ id: 'b', label: `B(${b})`, width: b }], [], 64, 22);
      break;

    case 'CRC8_GEN':
      placeRows(
        [
          { id: 'din', label: 'DIN(8)', width: 8 },
          { id: 'en', label: 'EN', width: 1 },
          { id: 'clk', label: 'CLK', width: 1 }
        ],
        [{ id: 'crc', label: 'CRC(8)', width: 8 }],
        [{ id: 'rst', label: 'RST', width: 1 }],
        92,
        21
      );
      break;

    case 'LUT_TRIG':
      placeRows(
        [{ id: 'ang', label: 'ANG(8)', width: 8 }],
        [{ id: 'sin', label: 'SIN(16)', width: 16 }, { id: 'cos', label: 'COS(16)', width: 16 }],
        [],
        78,
        24
      );
      break;

    case 'UART_TX':
      placeRows(
        [
          { id: 'data', label: 'DATA(8)', width: 8 },
          { id: 'send', label: 'SEND', width: 1 },
          { id: 'clk', label: 'CLK', width: 1 }
        ],
        [
          { id: 'tx', label: 'TX', width: 1 },
          { id: 'busy', label: 'BUSY', width: 1 }
        ],
        [{ id: 'rst', label: 'RST', width: 1 }],
        98,
        21
      );
      break;

    case 'UART_RX':
      placeRows(
        [
          { id: 'rx', label: 'RX', width: 1 },
          { id: 'clk', label: 'CLK', width: 1 }
        ],
        [
          { id: 'data', label: 'DATA(8)', width: 8 },
          { id: 'valid', label: 'VAL', width: 1 },
          { id: 'err', label: 'ERR', width: 1 }
        ],
        [{ id: 'rst', label: 'RST', width: 1 }],
        98,
        21
      );
      break;

    case 'RAYCAST_CORE':
      placeRows(
        [
          { id: 'clk', label: 'CLK', width: 1 },
          { id: 'pad', label: 'PAD(5)', width: 5 },
          { id: 'mapd', label: 'MAP(8)', width: 8 },
          { id: 'rst', label: 'RST', width: 1 }
        ],
        [
          { id: 'px', label: 'PX(6)', width: 6 },
          { id: 'py', label: 'PY(6)', width: 6 },
          { id: 'col', label: 'COL(8)', width: 8 },
          { id: 'we', label: 'WE', width: 1 },
          { id: 'swap', label: 'SWAP', width: 1 },
          { id: 'mapa', label: 'MADR(8)', width: 8 },
          { id: 'sfx', label: 'SFX', width: 1 }
        ],
        [],
        162,
        20
      );
      break;

    case 'BCD_7SEG':
      addPin('d3', 'in', -comp.w / 2, -30, 'D3');
      addPin('d2', 'in', -comp.w / 2, -10, 'D2');
      addPin('d1', 'in', -comp.w / 2, 10, 'D1');
      addPin('d0', 'in', -comp.w / 2, 30, 'D0');
      ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach((seg, i) => {
        addPin(seg, 'out', comp.w / 2, -48 + i * 16, seg);
      });
      break;

    case 'COMP_2':
      addPin('a1', 'in', -comp.w / 2, -33, 'A1');
      addPin('a0', 'in', -comp.w / 2, -11, 'A0');
      addPin('b1', 'in', -comp.w / 2, 11, 'B1');
      addPin('b0', 'in', -comp.w / 2, 33, 'B0');
      addPin('gt', 'out', comp.w / 2, -24, 'A>B');
      addPin('eq', 'out', comp.w / 2, 0, 'A=B');
      addPin('lt', 'out', comp.w / 2, 24, 'A<B');
      break;

    case 'COMP_4':
      placeRows(
        [...seqNames('a', 4).map(id => ({ id, label: id.toUpperCase() })), ...seqNames('b', 4).map(id => ({ id, label: id.toUpperCase() }))],
        [{ id: 'gt', label: 'A>B' }, { id: 'eq', label: 'A=B' }, { id: 'lt', label: 'A<B' }],
        [],
        170,
        19
      );
      break;

    case 'COMP_N':
      placeRows(
        [{ id: 'a', label: `A(${b})`, width: b }, { id: 'b', label: `B(${b})`, width: b }],
        [{ id: 'gt', label: 'A>B' }, { id: 'eq', label: 'A=B' }, { id: 'lt', label: 'A<B' }],
        [],
        88,
        22
      );
      break;

    case 'LED':
    case 'BUZZER':
      addPin('in0', 'in', -comp.w / 2, 0, 'IN');
      break;

    case 'LED_RGB':
      addPin('r', 'in', -comp.w / 2, -18, 'R');
      addPin('g', 'in', -comp.w / 2, 0, 'G');
      addPin('b', 'in', -comp.w / 2, 18, 'B');
      break;

    case 'SEG7_DISPLAY':
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'].forEach((seg, i) => {
        addPin(seg, 'in', -comp.w / 2, -56 + i * 16, seg);
      });
      break;

    case 'HEX_DISPLAY':
      addPin('d3', 'in', -comp.w / 2, -27, 'D3');
      addPin('d2', 'in', -comp.w / 2, -9, 'D2');
      addPin('d1', 'in', -comp.w / 2, 9, 'D1');
      addPin('d0', 'in', -comp.w / 2, 27, 'D0');
      break;

    case 'HEX_DISPLAY_N':
      comp.w = Math.max(116, Math.min(240, 36 + Math.ceil(b / 4) * 14));
      addPin('d', 'in', -comp.w / 2, 0, `${b}b`, b);
      break;

    case 'DEC_DISPLAY_N':
      comp.w = Math.max(122, Math.min(230, 62 + Math.ceil(b * 0.31) * 9));
      addPin('d', 'in', -comp.w / 2, 0, `${b}b`, b);
      break;

    case 'TRAFFIC_LIGHT':
      addPin('r', 'in', -comp.w / 2, -30, 'R');
      addPin('y', 'in', -comp.w / 2, 0, 'Y');
      addPin('g', 'in', -comp.w / 2, 30, 'G');
      break;

    case 'LED_BAR_4':
      addPin('b3', 'in', -comp.w / 2, -27, 'B3');
      addPin('b2', 'in', -comp.w / 2, -9, 'B2');
      addPin('b1', 'in', -comp.w / 2, 9, 'B1');
      addPin('b0', 'in', -comp.w / 2, 27, 'B0');
      break;

    case 'LED_BAR_8': {
      const nb = b >= 16 ? 16 : 8;
      comp.bits = nb;
      comp.w = nb === 16 ? 210 : 134;
      addPin('d', 'in', -comp.w / 2, 0, `${nb}b`, nb);
      break;
    }

    case 'LED_MATRIX_4X4':
      seqNames('row', 4).forEach((id, i) => addPin(id, 'in', -comp.w / 2, -34.5 + i * 23, `R${i}`));
      seqNames('col', 4).forEach((id, i) => addPin(id, 'in', -34.5 + i * 23, comp.h / 2, `C${i}`));
      break;

    case 'LED_MATRIX_8X8':
      seqNames('r', 8).forEach((id, i) => addPin(id, 'in', -comp.w / 2, -56 + i * 16, `R${i}(8)`, 8));
      addPin('clr', 'in', 0, comp.h / 2, 'CLR', 1);
      break;

    case 'LCD_TEXT':
      addPin('char', 'in', -comp.w / 2, -45, 'CHR(8)', 8);
      addPin('x', 'in', -comp.w / 2, -15, 'X(4)', 4);
      addPin('y', 'in', -comp.w / 2, 15, 'Y(1)', 1);
      addPin('we', 'in', -comp.w / 2, 45, 'WE', 1);
      addPin('clk', 'in', -26, comp.h / 2, 'CLK', 1);
      addPin('clr', 'in', 26, comp.h / 2, 'CLR', 1);
      break;

    case 'TONE_GEN':
      placeRows(
        [
          { id: 'freq', label: 'HZ(12)', width: 12 },
          { id: 'wave', label: 'WAV(2)', width: 2 },
          { id: 'gate', label: 'GATE', width: 1 }
        ],
        [],
        [],
        84,
        22
      );
      break;

    case 'VGA_SCREEN':
      addPin('x', 'in', -comp.w / 2, -68, 'X(6)', 6);
      addPin('y', 'in', -comp.w / 2, -34, 'Y(6)', 6);
      addPin('col', 'in', -comp.w / 2, 0, 'COL(8)', 8);
      addPin('we', 'in', -comp.w / 2, 34, 'WE', 1);
      addPin('clk', 'in', -comp.w / 2, 68, 'CLK', 1);
      addPin('swap', 'in', -32, comp.h / 2, 'SWAP', 1);
      addPin('clr', 'in', 32, comp.h / 2, 'CLR', 1);
      break;

    case 'RAM_16X4':
      [0, 1, 2, 3].forEach(i => addPin(`a${i}`, 'in', -comp.w / 2, -54 + i * 18, `A${i}`));
      [0, 1, 2, 3].forEach(i => addPin(`d${i}`, 'in', -comp.w / 2, 18 + i * 12, `D${i}`));
      addPin('we', 'in', -24, comp.h / 2, 'WE');
      addPin('clk', 'in', 24, comp.h / 2, 'CLK');
      [0, 1, 2, 3].forEach(i => addPin(`q${i}`, 'out', comp.w / 2, -54 + i * 18, `Q${i}`));
      break;

    case 'ROM_16X4':
      [0, 1, 2, 3].forEach(i => addPin(`a${i}`, 'in', -comp.w / 2, -42 + i * 18, `A${i}`));
      [0, 1, 2, 3].forEach(i => addPin(`q${i}`, 'out', comp.w / 2, -42 + i * 18, `Q${i}`));
      break;

    case 'RAM_N': {
      const ab = Math.max(4, Math.min(16, comp.addrBits || 8));
      placeRows(
        [
          { id: 'addr', label: `A(${ab})`, width: ab },
          { id: 'd', label: `D(${b})`, width: b },
          { id: 'we', label: 'WE', width: 1 },
          { id: 'clk', label: 'CLK', width: 1 }
        ],
        [{ id: 'q', label: `Q(${b})`, width: b }],
        [],
        118,
        23
      );
      break;
    }

    case 'ROM_N': {
      const ab = Math.max(4, Math.min(16, comp.addrBits || 8));
      placeRows(
        [{ id: 'addr', label: `A(${ab})`, width: ab }],
        [{ id: 'q', label: `Q(${b})`, width: b }],
        [],
        102,
        24
      );
      break;
    }

    case 'DUAL_RAM_N': {
      const ab = Math.max(4, Math.min(16, comp.addrBits || 8));
      placeRows(
        [
          { id: 'aa', label: `AA(${ab})`, width: ab },
          { id: 'da', label: `DA(${b})`, width: b },
          { id: 'we', label: 'WE', width: 1 },
          { id: 'clk', label: 'CLK', width: 1 },
          { id: 'ab', label: `AB(${ab})`, width: ab }
        ],
        [
          { id: 'qa', label: `QA(${b})`, width: b },
          { id: 'qb', label: `QB(${b})`, width: b }
        ],
        [],
        132,
        21
      );
      break;
    }

    case 'FSM':
      addPin('clk', 'in', -comp.w / 2, -20, 'CLK');
      addPin('x', 'in', -comp.w / 2, 0, 'X');
      addPin('rst', 'in', -comp.w / 2, 20, 'RST');
      addPin('q2', 'out', comp.w / 2, -30, 'Q2');
      addPin('q1', 'out', comp.w / 2, -10, 'Q1');
      addPin('q0', 'out', comp.w / 2, 10, 'Q0');
      addPin('z', 'out', comp.w / 2, 30, 'Z');
      break;

    case 'ALU_4':
      [0, 1, 2, 3].forEach(i => addPin(`a${i}`, 'in', -comp.w / 2, -72 + i * 16, `A${i}`));
      [0, 1, 2, 3].forEach(i => addPin(`b${i}`, 'in', -comp.w / 2, -4 + i * 16, `B${i}`));
      addPin('cin', 'in', -comp.w / 2, 60, 'Cin');
      addPin('s0', 'in', -24, comp.h / 2, 'S0');
      addPin('s1', 'in', 0, comp.h / 2, 'S1');
      addPin('s2', 'in', 24, comp.h / 2, 'S2');
      [0, 1, 2, 3].forEach(i => addPin(`y${i}`, 'out', comp.w / 2, -48 + i * 16, `Y${i}`));
      addPin('cout', 'out', comp.w / 2, 24, 'Cout');
      addPin('z', 'out', comp.w / 2, 48, 'Z');
      break;

    case 'SEG7_MULTI': {
      const n = Math.max(2, Math.min(4, comp.inputCount || 2));
      comp.w = 48 + n * 34;
      comp.h = n * 58 + 8;
      for (let k = n - 1; k >= 0; k--) {
        const top = -comp.h / 2 + 8 + (n - 1 - k) * 58 + 8;
        for (let bIdx = 3; bIdx >= 0; bIdx--) {
          addPin(`g${k}_${bIdx}`, 'in', -comp.w / 2, top + (3 - bIdx) * 13, `${k}.${bIdx}`);
        }
      }
      break;
    }

    case 'CUSTOM_IC': {
      const def = customICs.find(d => d.id === comp.icDefId) || comp.icSnapshot;
      if (def) {
        const rows = Math.max(def.inputs.length, def.outputs.length, 2);
        comp.w = 104;
        comp.h = Math.max(60, rows * 20 + 24);
        def.inputs.forEach((inp, i) => {
          const py = def.inputs.length === 1 ? 0 : -((def.inputs.length - 1) * 18) / 2 + i * 18;
          addPin(`in_${i}`, 'in', -comp.w / 2, py, inp.name, inp.width || 1);
        });
        def.outputs.forEach((outp, i) => {
          const py = def.outputs.length === 1 ? 0 : -((def.outputs.length - 1) * 18) / 2 + i * 18;
          addPin(`out_${i}`, 'out', comp.w / 2, py, outp.name, outp.width || 1);
        });
      }
      break;
    }

    case 'ROTARY_ENC':
      placeRows(
        [],
        [
          { id: 'a', label: 'A', width: 1 },
          { id: 'b', label: 'B', width: 1 },
          { id: 'pos', label: 'POS(8)', width: 8 }
        ],
        [],
        94,
        20
      );
      break;

    case 'SLIDER_ADC':
      comp.w = 122;
      comp.h = 60;
      addPin('out', 'out', comp.w / 2, 0, `${b}b`, b);
      break;

    case 'CROSSBAR_2X2':
      placeRows(
        [
          { id: 'a', label: `A(${b})`, width: b },
          { id: 'b', label: `B(${b})`, width: b },
          { id: 'swap', label: 'SWAP', width: 1 }
        ],
        [
          { id: 'y0', label: `Y0(${b})`, width: b },
          { id: 'y1', label: `Y1(${b})`, width: b }
        ],
        [],
        106,
        22
      );
      break;

    case 'PRIORITY_ARB':
      placeRows(
        [
          { id: 'r0', label: 'R0', width: 1 },
          { id: 'r1', label: 'R1', width: 1 },
          { id: 'r2', label: 'R2', width: 1 },
          { id: 'r3', label: 'R3', width: 1 }
        ],
        [
          { id: 'g0', label: 'G0', width: 1 },
          { id: 'g1', label: 'G1', width: 1 },
          { id: 'g2', label: 'G2', width: 1 },
          { id: 'g3', label: 'G3', width: 1 },
          { id: 'idx', label: 'ID(2)', width: 2 },
          { id: 'valid', label: 'V', width: 1 }
        ],
        [],
        110,
        15
      );
      break;

    case 'BUS_PACK4': {
      const totalW = Math.min(64, b * 4);
      placeRows(
        [
          { id: 'i0', label: `I0(${b})`, width: b },
          { id: 'i1', label: `I1(${b})`, width: b },
          { id: 'i2', label: `I2(${b})`, width: b },
          { id: 'i3', label: `I3(${b})`, width: b }
        ],
        [{ id: 'out', label: `OUT(${totalW})`, width: totalW }],
        [],
        106,
        20
      );
      break;
    }

    case 'BUS_UNPACK4': {
      const totalW = Math.min(64, b * 4);
      placeRows(
        [{ id: 'in0', label: `IN(${totalW})`, width: totalW }],
        [
          { id: 'o0', label: `O0(${b})`, width: b },
          { id: 'o1', label: `O1(${b})`, width: b },
          { id: 'o2', label: `O2(${b})`, width: b },
          { id: 'o3', label: `O3(${b})`, width: b }
        ],
        [],
        106,
        20
      );
      break;
    }

    case 'SAT_ADDER_N':
      placeRows(
        [
          { id: 'a', label: `A(${b})`, width: b },
          { id: 'b', label: `B(${b})`, width: b }
        ],
        [
          { id: 's', label: `S(${b})`, width: b },
          { id: 'sat', label: 'SAT', width: 1 }
        ],
        [],
        108,
        22
      );
      break;

    case 'SQRT_N':
      placeRows(
        [{ id: 'in0', label: `X(${b})`, width: b }],
        [
          { id: 'root', label: `√(${b})`, width: b },
          { id: 'rem', label: `REM(${b})`, width: b }
        ],
        [],
        102,
        22
      );
      break;

    case 'COMP_WIN_N':
      placeRows(
        [
          { id: 'x', label: `X(${b})`, width: b },
          { id: 'lo', label: `LO(${b})`, width: b },
          { id: 'hi', label: `HI(${b})`, width: b }
        ],
        [
          { id: 'inw', label: 'IN', width: 1 },
          { id: 'below', label: '<LO', width: 1 },
          { id: 'above', label: '>HI', width: 1 }
        ],
        [],
        112,
        22
      );
      break;

    case 'MOD_COUNTER_N':
      placeRows(
        [
          { id: 'clk', label: 'CLK', width: 1 },
          { id: 'en', label: 'EN', width: 1 },
          { id: 'rst', label: 'RST', width: 1 },
          { id: 'mod', label: `M(${b})`, width: b }
        ],
        [
          { id: 'q', label: `Q(${b})`, width: b },
          { id: 'wrap', label: 'WRP', width: 1 }
        ],
        [],
        118,
        20
      );
      break;

    case 'WATCHDOG_N':
      placeRows(
        [
          { id: 'clk', label: 'CLK', width: 1 },
          { id: 'kick', label: 'KICK', width: 1 },
          { id: 'lim', label: `LIM(${b})`, width: b },
          { id: 'rst', label: 'RST', width: 1 }
        ],
        [
          { id: 'bark', label: 'BARK', width: 1 },
          { id: 'cnt', label: `CNT(${b})`, width: b }
        ],
        [],
        118,
        20
      );
      break;

    case 'DEBOUNCER':
      placeRows(
        [
          { id: 'in0', label: 'RAW', width: 1 },
          { id: 'clk', label: 'CLK', width: 1 }
        ],
        [{ id: 'out', label: 'CLN', width: 1 }],
        [],
        98,
        22
      );
      break;

    case 'STOPWATCH_N':
      placeRows(
        [
          { id: 'clk', label: 'CLK', width: 1 },
          { id: 'start', label: 'RUN', width: 1 },
          { id: 'lap', label: 'LAP', width: 1 },
          { id: 'rst', label: 'RST', width: 1 }
        ],
        [
          { id: 'q', label: `T(${b})`, width: b },
          { id: 'run', label: 'ACT', width: 1 }
        ],
        [],
        118,
        19
      );
      break;

    case 'CRC16_GEN':
      placeRows(
        [
          { id: 'd', label: 'D(8)', width: 8 },
          { id: 'clk', label: 'CLK', width: 1 },
          { id: 'en', label: 'EN', width: 1 },
          { id: 'rst', label: 'RST', width: 1 }
        ],
        [
          { id: 'crc', label: 'CRC(16)', width: 16 },
          { id: 'ok', label: 'OK', width: 1 }
        ],
        [],
        114,
        19
      );
      break;

    case 'VU_METER_N':
      comp.w = 72;
      comp.h = 124;
      addPin('in0', 'in', -comp.w / 2, 0, `${b}b`, b);
      break;

    case 'TEXT_CONSOLE':
      comp.w = 224;
      comp.h = 144;
      addPin('char', 'in', -comp.w / 2, -40, 'CHR(8)', 8);
      addPin('we', 'in', -comp.w / 2, -14, 'WE', 1);
      addPin('clk', 'in', -comp.w / 2, 14, 'CLK', 1);
      addPin('clr', 'in', -comp.w / 2, 40, 'CLR', 1);
      addPin('len', 'out', comp.w / 2, 0, 'LN(8)', 8);
      break;

    case 'ANIM32_GPU':
      comp.w = 196;
      comp.h = 224;
      addPin('clk', 'in', -comp.w / 2, -64, 'CLK', 1);
      addPin('scene', 'in', -comp.w / 2, -32, 'SCN(5)', 5);
      addPin('use_ext', 'in', -comp.w / 2, 0, 'EXT', 1);
      addPin('pause', 'in', -comp.w / 2, 32, 'HOLD', 1);
      addPin('rst', 'in', -comp.w / 2, 64, 'RST', 1);
      addPin('px', 'out', comp.w / 2, -92, 'PX(6)', 6);
      addPin('py', 'out', comp.w / 2, -75, 'PY(6)', 6);
      addPin('col', 'out', comp.w / 2, -58, 'COL(8)', 8);
      addPin('we', 'out', comp.w / 2, -41, 'WE', 1);
      addPin('swap', 'out', comp.w / 2, -24, 'SWAP', 1);
      addPin('scn', 'out', comp.w / 2, -7, 'SCN(5)', 5);
      addPin('lchar', 'out', comp.w / 2, 10, 'LCH(8)', 8);
      addPin('lx', 'out', comp.w / 2, 27, 'LX(4)', 4);
      addPin('ly', 'out', comp.w / 2, 44, 'LY(1)', 1);
      addPin('lwe', 'out', comp.w / 2, 61, 'LWE', 1);
      addPin('sfreq', 'out', comp.w / 2, 78, 'HZ(12)', 12);
      addPin('sgate', 'out', comp.w / 2, 95, 'GATE', 1);
      break;
  }

  comp.pins = pins;
}

export function orientPt(comp: LogicComponent, lx: number, ly: number): { x: number; y: number } {
  const x = comp.flip ? -lx : lx;
  switch (((comp.rot || 0) % 4 + 4) % 4) {
    case 1: return { x: -ly, y: x };
    case 2: return { x: -x, y: -ly };
    case 3: return { x: ly, y: -x };
    default: return { x, y: ly };
  }
}

export function pinWX(comp: LogicComponent, p: PinDef): number {
  return comp.x + orientPt(comp, p.lx, p.ly).x;
}

export function pinWY(comp: LogicComponent, p: PinDef): number {
  return comp.y + orientPt(comp, p.lx, p.ly).y;
}

export function getWorldPins(comp: LogicComponent): WorldPin[] {
  return comp.pins.map(p => {
    const o = orientPt(comp, p.lx, p.ly);
    return {
      comp,
      pinId: p.id,
      dir: p.dir,
      label: p.label,
      width: p.width || 1,
      x: comp.x + o.x,
      y: comp.y + o.y
    };
  });
}
