import { createComponent } from './catalog';
import { evaluateCircuitDeterministic } from './simulator';
import { LogicComponent, Wire, bit, genId, isSignalNonZero } from './types';

export interface LearningLesson {
  id: string;
  num: number;
  title: string;
  level: 'Básico' | 'Intermedio' | 'Avanzado';
  summary: string;
  theory: string[];
  goalText: string;
  tip: string;
  buildStarter: () => { components: LogicComponent[]; wires: Wire[] };
  check: (components: LogicComponent[], wires: Wire[]) => { ok: boolean; feedback: string };
}

function makeWire(a: LogicComponent, pa: string, b: LogicComponent, pb: string, width = 1): Wire {
  return { id: genId('w'), fromCompId: a.id, fromPinId: pa, toCompId: b.id, toPinId: pb, signal: 0, width };
}

export const LEARNING_LESSONS: LearningLesson[] = [
  {
    id: 'lesson_01_bits',
    num: 1,
    title: 'Los Bits (0 y 1) e Interruptores',
    level: 'Básico',
    summary: 'Entiende cómo la electricidad representa ceros (apagado) y unos (encendido).',
    theory: [
      'Un bit es la unidad mínima de información: solo puede valer 0 (bajo/apagado) o 1 (alto/encendido).',
      'En el simulador, los Interruptores (SWITCH) generan 0 o 1 al hacer clic sobre ellos.',
      'Los cables brillan en color vivo cuando transportan un 1 y se oscurecen cuando llevan un 0.'
    ],
    goalText: 'Conecta el Interruptor al LED y enciéndelo para que el LED reciba un 1 lógico.',
    tip: 'Arrastra desde el pin derecho del Interruptor hasta el pin izquierdo del LED, y pulsa el Interruptor para activarlo.',
    buildStarter: () => {
      const sw = createComponent('SWITCH', -140, 0, { label: 'Entrada', initialValue: 0, noAnim: true });
      const led = createComponent('LED', 120, 0, { label: 'Salida', color: 'cyan', noAnim: true });
      return { components: [sw, led], wires: [] };
    },
    check: (comps, wires) => {
      const leds = comps.filter(c => c.type === 'LED');
      if (leds.length === 0) return { ok: false, feedback: 'Añade un componente LED al lienzo.' };
      if (wires.length === 0) return { ok: false, feedback: 'Aún no has conectado ningún cable al LED.' };
      const lit = leds.some(l => bit(l.pinValues.in0) === 1);
      return lit
        ? { ok: true, feedback: '¡Perfecto! El LED está encendido recibiendo un 1 lógico.' }
        : { ok: false, feedback: 'El cable está puesto, pero el LED recibe 0. Haz clic en el Interruptor para ponerlo a 1.' };
    }
  },
  {
    id: 'lesson_02_not',
    num: 2,
    title: 'La Puerta NOT (Inversor)',
    level: 'Básico',
    summary: 'La operación más sencilla: convierte 0 en 1 y 1 en 0.',
    theory: [
      'La puerta NOT (o inversor) tiene una entrada y una salida.',
      'Su salida siempre es lo contrario de su entrada: si entra 0, sale 1; si entra 1, sale 0.',
      'El pequeño círculo en la punta del triángulo indica negación lógica.'
    ],
    goalText: 'Usa una puerta NOT entre un Interruptor (en 0) y un LED para que el LED quede encendido.',
    tip: 'Conecta SWITCH → NOT → LED y deja el interruptor apagado (0).',
    buildStarter: () => {
      const sw = createComponent('SWITCH', -200, 0, { label: 'A', initialValue: 0, noAnim: true });
      const notG = createComponent('NOT', -20, 0, { label: 'NOT', noAnim: true });
      const led = createComponent('LED', 160, 0, { label: '¬A', color: 'emerald', noAnim: true });
      return { components: [sw, notG, led], wires: [makeWire(sw, 'out', notG, 'in0')] };
    },
    check: (comps, wires) => {
      const notG = comps.find(c => c.type === 'NOT');
      const leds = comps.filter(c => c.type === 'LED');
      if (!notG || leds.length === 0) return { ok: false, feedback: 'Necesitas una puerta NOT y un LED.' };
      const drivenByNot = wires.some(w => w.fromCompId === notG.id && leds.some(l => l.id === w.toCompId));
      if (!drivenByNot) return { ok: false, feedback: 'Conecta la salida del NOT al LED.' };
      return bit(notG.pinValues.out) === 1
        ? { ok: true, feedback: '¡Genial! Como entra un 0, la puerta NOT saca un 1 e ilumina el LED.' }
        : { ok: false, feedback: 'Ahora entra un 1 al NOT y saca 0. Apaga el interruptor para comprobar la inversión.' };
    }
  },
  {
    id: 'lesson_03_and_or',
    num: 3,
    title: 'Puertas AND y OR (Condiciones)',
    level: 'Básico',
    summary: 'Combina dos señales: «todas deben cumplirse» (AND) o «basta con una» (OR).',
    theory: [
      'La puerta AND saca 1 únicamente cuando TODAS sus entradas son 1.',
      'La puerta OR saca 1 cuando AL MENOS UNA de sus entradas vale 1.',
      'Con ellas puedes construir cerraduras de seguridad o alarmas con múltiples sensores.'
    ],
    goalText: 'Logra que el circuito active la salida usando una puerta AND (ambos interruptores en 1).',
    tip: 'Conecta A y B a la puerta AND, la salida de la AND al LED, y activa A=1 y B=1.',
    buildStarter: () => {
      const a = createComponent('SWITCH', -220, -40, { label: 'Llave A', initialValue: 1, noAnim: true });
      const b = createComponent('SWITCH', -220, 40, { label: 'Llave B', initialValue: 0, noAnim: true });
      const andG = createComponent('AND', -40, 0, { label: 'AND', noAnim: true });
      const led = createComponent('LED', 140, 0, { label: 'Abrir', color: 'amber', noAnim: true });
      return {
        components: [a, b, andG, led],
        wires: [makeWire(a, 'out', andG, 'in0'), makeWire(b, 'out', andG, 'in1'), makeWire(andG, 'out', led, 'in0')]
      };
    },
    check: (comps) => {
      const andG = comps.find(c => c.type === 'AND');
      if (!andG) return { ok: false, feedback: 'Coloca una puerta AND en el lienzo.' };
      if (bit(andG.pinValues.in0) === 1 && bit(andG.pinValues.in1) === 1 && bit(andG.pinValues.out) === 1) {
        return { ok: true, feedback: '¡Correcto! Con ambas entradas en 1, AND devuelve 1.' };
      }
      return { ok: false, feedback: 'Activa ambos interruptores (Llave A = 1 y Llave B = 1) para desbloquear la puerta AND.' };
    }
  },
  {
    id: 'lesson_04_xor',
    num: 4,
    title: 'La Puerta XOR (Detector de Diferencia)',
    level: 'Básico',
    summary: 'Descubre la puerta clave para sumar en binario y comparar dos bits.',
    theory: [
      'XOR significa «OR exclusivo»: saca 1 si las dos entradas son DISTINTAS (0 y 1, o 1 y 0).',
      'Si las dos entradas son iguales (0 y 0, o 1 y 1), XOR saca 0.',
      'Es la pieza fundamental para sumar dígitos binarios sin acarreo.'
    ],
    goalText: 'Construye con una XOR un circuito donde al cambiar cualquiera de los dos interruptores cambie el LED.',
    tip: 'Conecta los dos interruptores a la puerta XOR y su salida al LED. Prueba a dejar uno en 1 y otro en 0.',
    buildStarter: () => {
      const a = createComponent('SWITCH', -220, -40, { label: 'Bit A', initialValue: 1, noAnim: true });
      const b = createComponent('SWITCH', -220, 40, { label: 'Bit B', initialValue: 1, noAnim: true });
      const x = createComponent('XOR', -40, 0, { label: 'XOR', noAnim: true });
      const led = createComponent('LED', 140, 0, { label: 'Distintos', color: 'violet', noAnim: true });
      return {
        components: [a, b, x, led],
        wires: [makeWire(a, 'out', x, 'in0'), makeWire(b, 'out', x, 'in1'), makeWire(x, 'out', led, 'in0')]
      };
    },
    check: (comps) => {
      const x = comps.find(c => c.type === 'XOR');
      if (!x) return { ok: false, feedback: 'Añade una puerta XOR.' };
      return bit(x.pinValues.out) === 1
        ? { ok: true, feedback: '¡Bien! Al tener entradas distintas (1 y 0), XOR produce un 1.' }
        : { ok: false, feedback: 'Actualmente las entradas son iguales. Cambia uno de los interruptores.' };
    }
  },
  {
    id: 'lesson_05_half_adder',
    num: 5,
    title: 'Cómo Sumar en Binario (Semisumador)',
    level: 'Intermedio',
    summary: 'Une una XOR y una AND para sumar dos bits y calcular 1 + 1 = 10 (en binario = 2).',
    theory: [
      'En binario: 0+0=00, 0+1=01, 1+0=01, y 1+1=10 (2 en decimal).',
      'El bit de la derecha (SUMA) sigue exactamente la tabla de la puerta XOR.',
      'El bit de la izquierda o acarreo (CARRY) solo se activa con 1+1, es decir, ¡una puerta AND!'
    ],
    goalText: 'Conecta A=1 y B=1 a un semisumador (XOR + AND) y verifica Suma=0, Carry=1.',
    tip: 'Conecta A y B tanto a XOR (Suma) como a AND (Carry).',
    buildStarter: () => {
      const a = createComponent('SWITCH', -240, -50, { label: 'A', initialValue: 1, noAnim: true });
      const b = createComponent('SWITCH', -240, 50, { label: 'B', initialValue: 1, noAnim: true });
      const xorG = createComponent('XOR', -40, -50, { label: 'Suma', noAnim: true });
      const andG = createComponent('AND', -40, 50, { label: 'Carry', noAnim: true });
      const lSum = createComponent('LED', 140, -50, { label: 'S (1)', color: 'cyan', noAnim: true });
      const lCar = createComponent('LED', 140, 50, { label: 'C (2)', color: 'amber', noAnim: true });
      return {
        components: [a, b, xorG, andG, lSum, lCar],
        wires: [
          makeWire(a, 'out', xorG, 'in0'),
          makeWire(b, 'out', xorG, 'in1'),
          makeWire(xorG, 'out', lSum, 'in0'),
          makeWire(andG, 'out', lCar, 'in0')
        ]
      };
    },
    check: (comps) => {
      const xorG = comps.find(c => c.type === 'XOR');
      const andG = comps.find(c => c.type === 'AND');
      if (!xorG || !andG) return { ok: false, feedback: 'Necesitas una XOR y una AND.' };
      const sum0 = bit(xorG.pinValues.out) === 0;
      const car1 = bit(andG.pinValues.out) === 1;
      if (sum0 && car1) return { ok: true, feedback: '¡Exacto! 1 + 1 en binario da 10 (Carry=1, Suma=0).' };
      return { ok: false, feedback: 'Conecta A y B a las dos entradas de la puerta AND y activa A=1, B=1.' };
    }
  },
  {
    id: 'lesson_06_mux',
    num: 6,
    title: 'Multiplexor 2:1 (Selector de Datos)',
    level: 'Intermedio',
    summary: 'Elige qué señal pasa a la salida usando un pin selector S.',
    theory: [
      'Un multiplexor (MUX) actúa como un desvío ferroviario digital.',
      'Si el pin inferior S vale 0, deja pasar la entrada D0. Si S vale 1, deja pasar D1.',
      'Los MUX permiten que varios cables compartan un mismo destino en una CPU.'
    ],
    goalText: 'Configura D0=0, D1=1 y cambia el selector SEL a 1 para dirigir D1 al LED.',
    tip: 'Conecta el tercer interruptor al pin inferior "sel" del MUX_2.',
    buildStarter: () => {
      const d0 = createComponent('SWITCH', -240, -60, { label: 'D0=0', initialValue: 0, noAnim: true });
      const d1 = createComponent('SWITCH', -240, 20, { label: 'D1=1', initialValue: 1, noAnim: true });
      const sel = createComponent('SWITCH', -240, 110, { label: 'SEL', initialValue: 0, noAnim: true });
      const mux = createComponent('MUX_2', -20, 0, { label: 'MUX 2:1', bits: 1, noAnim: true });
      const led = createComponent('LED', 170, 0, { label: 'Salida Y', color: 'cyan', noAnim: true });
      return {
        components: [d0, d1, sel, mux, led],
        wires: [makeWire(d0, 'out', mux, 'd0'), makeWire(d1, 'out', mux, 'd1'), makeWire(mux, 'out', led, 'in0')]
      };
    },
    check: (comps) => {
      const mux = comps.find(c => c.type === 'MUX_2');
      if (!mux) return { ok: false, feedback: 'Coloca un MUX_2 en el lienzo.' };
      if (bit(mux.pinValues.sel) === 1 && bit(mux.pinValues.out) === 1) {
        return { ok: true, feedback: '¡Perfecto! El selector en 1 dejó pasar D1=1 hacia la salida.' };
      }
      return { ok: false, feedback: 'Conecta SEL al pin inferior del MUX y pon SEL=1 (con D1=1).' };
    }
  },
  {
    id: 'lesson_07_memory_dff',
    num: 7,
    title: 'Memoria Digital: Flip-Flop D y Reloj',
    level: 'Intermedio',
    summary: 'Guarda 1 bit de memoria que solo se actualiza cuando el reloj sube de 0 a 1.',
    theory: [
      'A diferencia de las puertas lógicas, un Flip-Flop D RECUERDA el último valor aunque cambie la entrada.',
      'Solo captura el valor del pin D en el instante exacto en que CLK sube de 0 a 1 (flanco de subida).',
      'Toda la memoria caché y registros de un procesador están hechos de millones de Flip-Flops.'
    ],
    goalText: 'Guarda un 1 dentro del Flip-Flop D usando D=1 y dando un pulso en CLK.',
    tip: 'Pon Dato=1, pulsa el botón CLK una vez, luego pon Dato=0 y observa que Q ¡sigue recordando el 1!',
    buildStarter: () => {
      const d = createComponent('SWITCH', -220, -40, { label: 'Dato D', initialValue: 1, noAnim: true });
      const clk = createComponent('BUTTON', -220, 45, { label: 'Pulso CLK', noAnim: true });
      const dff = createComponent('D_FF', -20, 0, { label: 'Memoria 1b', noAnim: true });
      const led = createComponent('LED', 170, -15, { label: 'Q Guardado', color: 'emerald', noAnim: true });
      return {
        components: [d, clk, dff, led],
        wires: [makeWire(d, 'out', dff, 'd'), makeWire(clk, 'out', dff, 'clk'), makeWire(dff, 'q', led, 'in0')]
      };
    },
    check: (comps) => {
      const dff = comps.find(c => c.type === 'D_FF');
      if (!dff) return { ok: false, feedback: 'Añade un Flip-Flop D (D_FF).' };
      return bit(dff.pinValues.q) === 1
        ? { ok: true, feedback: '¡Memoria grabada! Q almacena 1 gracias al flanco de subida del reloj.' }
        : { ok: false, feedback: 'Con Dato D = 1, haz clic en el pulsador CLK para capturar el bit en Q.' };
    }
  },
  {
    id: 'lesson_08_counter',
    num: 8,
    title: 'Contadores Automáticos y Display Hex',
    level: 'Avanzado',
    summary: 'Combina un Reloj (CLOCK), un Contador de 4 bits y un Display Hexadecimal.',
    theory: [
      'Un Contador avanza +1 en cada flanco de subida de su reloj mientras el pin EN (Enable) valga 1.',
      '4 bits permiten contar de 0 a 15 (0x0 hasta 0xF en sistema hexadecimal).',
      'Activa el reloj automático o usa el botón Paso en la barra superior para verlo contar.'
    ],
    goalText: 'Haz que el contador alcance un valor mayor que 0 y se vea en el Display.',
    tip: 'Conecta HIGH al pin "en" del contador y el Reloj al pin "clk".',
    buildStarter: () => {
      const clk = createComponent('CLOCK', -240, -35, { label: 'Reloj', freqHz: 2, noAnim: true });
      const en = createComponent('HIGH', -240, 45, { label: 'Enable=1', noAnim: true });
      const cnt = createComponent('COUNTER_4', -40, 0, { label: 'Contador 4b', noAnim: true });
      const hex = createComponent('HEX_DISPLAY', 160, 0, { label: 'Display 0..F', color: 'cyan', noAnim: true });
      return {
        components: [clk, en, cnt, hex],
        wires: [
          makeWire(clk, 'out', cnt, 'clk'),
          makeWire(cnt, 'q3', hex, 'd3'),
          makeWire(cnt, 'q2', hex, 'd2'),
          makeWire(cnt, 'q1', hex, 'd1'),
          makeWire(cnt, 'q0', hex, 'd0')
        ]
      };
    },
    check: (comps) => {
      const cnt = comps.find(c => c.type === 'COUNTER_4');
      if (!cnt) return { ok: false, feedback: 'Coloca un COUNTER_4 en el lienzo.' };
      const val = (bit(cnt.pinValues.q3) << 3) | (bit(cnt.pinValues.q2) << 2) | (bit(cnt.pinValues.q1) << 1) | bit(cnt.pinValues.q0);
      return val > 0
        ? { ok: true, feedback: `¡Excelente! El contador está funcionando (valor actual: ${val}).` }
        : { ok: false, feedback: 'Conecta "Enable=1" al pin EN del contador y deja correr el reloj (o pulsa Paso).' };
    }
  },
  {
    id: 'lesson_09_bus_alu',
    num: 9,
    title: 'Buses Multi-Bit (8–64b) y Sumador ALU',
    level: 'Avanzado',
    summary: 'Agrupa muchos bits en un solo cable grueso (Bus) para operar números enteros.',
    theory: [
      'En lugar de dibujar 16 o 64 cables separados, un Bus transporta un número completo en un único cable grueso.',
      'Los bloques terminados en _N (CONST_N, ADDER_N, ALU_N, DEC_DISPLAY_N) permiten cambiar su ancho de 1 a 64 bits.',
      'Los pines cuadrados indican siempre que transportan un bus multi-bit.'
    ],
    goalText: 'Suma dos buses de 8 bits usando ADDER_N para obtener una suma mayor de 10 en el display decimal.',
    tip: 'Cambia el valor de los Selectores Numéricos con sus botones − y + y conecta su salida al Sumador.',
    buildStarter: () => {
      const a = createComponent('NUM_STEPPER', -240, -50, { label: 'Número A', bits: 8, initialValue: 7n, noAnim: true });
      const b = createComponent('NUM_STEPPER', -240, 50, { label: 'Número B', bits: 8, initialValue: 5n, noAnim: true });
      const add = createComponent('ADDER_N', -20, 0, { label: 'Sumador 8b', bits: 8, noAnim: true });
      const disp = createComponent('DEC_DISPLAY_N', 190, 0, { label: 'Resultado', bits: 8, color: 'emerald', noAnim: true });
      return {
        components: [a, b, add, disp],
        wires: [makeWire(a, 'out', add, 'a', 8), makeWire(add, 'y', disp, 'd', 8)]
      };
    },
    check: (comps) => {
      const disp = comps.find(c => c.type === 'DEC_DISPLAY_N');
      if (!disp) return { ok: false, feedback: 'Añade un DEC_DISPLAY_N para ver el resultado.' };
      const val = Number(disp.pinValues.d ?? 0);
      return isSignalNonZero(disp.pinValues.d) && val > 10
        ? { ok: true, feedback: `¡Impecable! El bus de 8 bits transporta el valor decimal ${val}.` }
        : { ok: false, feedback: 'Conecta "Número B" al pin B del Sumador para que calcule A + B > 10.' };
    }
  },
  {
    id: 'lesson_10_rom_ascii',
    num: 10,
    title: 'Memorias ROM y Programación desde 0',
    level: 'Avanzado',
    summary: 'Almacena datos o texto en una memoria ROM y léelos con un contador.',
    theory: [
      'Una ROM (Read-Only Memory) es una tabla donde cada dirección (0, 1, 2…) guarda un dato fijo.',
      'Haz clic derecho en una ROM_N → "Editar Memoria (Hex)" para editar bytes, ver código ASCII o pintar mapas.',
      'Conectando un Contador al pin ADDR recorres automáticamente toda la memoria paso a paso.'
    ],
    goalText: 'Lee la ROM de saludo recorriendo sus posiciones y observa los caracteres ASCII en el Display.',
    tip: 'Haz clic derecho sobre la ROM para abrir el Programador Visual, o pulsa Paso/Simular para leer el mensaje.',
    buildStarter: () => {
      const clk = createComponent('CLOCK', -260, -40, { label: 'Reloj', freqHz: 3, noAnim: true });
      const hi = createComponent('HIGH', -260, 40, { noAnim: true });
      const cnt = createComponent('COUNTER_N', -110, 0, { label: 'Dir 0..7', bits: 4, noAnim: true });
      const msg = 'HOLA CPU';
      const rom = createComponent('ROM_N', 60, 0, {
        label: 'ROM Texto',
        bits: 8,
        addrBits: 4,
        mem: Array.from({ length: 16 }, (_, i) => BigInt(i < msg.length ? msg.charCodeAt(i) : 32)),
        noAnim: true
      });
      const lcd = createComponent('TEXT_CONSOLE', 250, 0, { label: 'Consola', noAnim: true });
      evaluateCircuitDeterministic([clk, hi, cnt, rom, lcd], [], 0, 2, []);
      return {
        components: [clk, hi, cnt, rom, lcd],
        wires: [
          makeWire(clk, 'out', cnt, 'clk'),
          makeWire(hi, 'out', cnt, 'en'),
          makeWire(hi, 'out', cnt, 'up'),
          makeWire(cnt, 'q', rom, 'addr', 4),
          makeWire(rom, 'q', lcd, 'char', 8),
          makeWire(hi, 'out', lcd, 'we'),
          makeWire(clk, 'out', lcd, 'clk')
        ]
      };
    },
    check: (comps) => {
      const con = comps.find(c => c.type === 'TEXT_CONSOLE');
      const lines = (con?.internalState.textLines || []).join('');
      return lines.length >= 2
        ? { ok: true, feedback: `¡Brillante! La ROM ya escribió "${lines.slice(0, 12)}" en la consola hardware.` }
        : { ok: false, feedback: 'Inicia la simulación o pulsa Paso 3 veces para que la ROM envíe caracteres a la Consola.' };
    }
  }
];
