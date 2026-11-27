import { DEFAULT_DOOM_MAP } from '../engine/simulator';
import { LogicComponent, PinSignal, maskBits, toSignedN, toUintN } from '../engine/types';

export interface MemProgrammerHost {
  getComponent: (id: string | null) => LogicComponent | undefined;
  evaluateAndNotify: (saveHistory: boolean) => void;
  showToast: (msg: string, type?: 'info' | 'warn') => void;
  copyText: (text: string, okMsg: string) => void;
}

export interface MemProgrammerController {
  open: (comp: LogicComponent) => void;
  render: () => void;
  refreshLive: () => void;
  isOpen: () => boolean;
  bindEvents: () => void;
}

type MemTab = 'hex' | 'doom' | 'music' | 'guide';

const DOOM_TILE_META: Array<{ id: number; name: string; color: string }> = [
  { id: 0, name: 'Vacío', color: '#0f172a' },
  { id: 1, name: 'Ladrillo', color: '#dc2626' },
  { id: 2, name: 'Piedra Azul', color: '#2563eb' },
  { id: 3, name: 'Portal', color: '#10b981' },
  { id: 4, name: 'Metal Oro', color: '#f59e0b' }
];

const MUSIC_NOTES: Array<{ label: string; hz: number }> = [
  { label: 'Silencio', hz: 0 },
  { label: 'Do4 (262)', hz: 262 },
  { label: 'Re4 (294)', hz: 294 },
  { label: 'Mi4 (330)', hz: 330 },
  { label: 'Fa4 (349)', hz: 349 },
  { label: 'Sol4 (392)', hz: 392 },
  { label: 'La4 (440)', hz: 440 },
  { label: 'Si4 (494)', hz: 494 },
  { label: 'Do5 (523)', hz: 523 },
  { label: 'Re5 (587)', hz: 587 },
  { label: 'Mi5 (659)', hz: 659 },
  { label: 'Sol5 (784)', hz: 784 }
];

const WAVE_NAMES = ['SQR', 'SAW', 'TRI', 'SIN'];

const RISC_OPCODES = [
  'NOP', 'LDI', 'ADD', 'SUB', 'AND', 'OR', 'XOR', 'SHL',
  'SHR', 'CMP', 'JMP', 'JZ', 'JNZ', 'LD', 'ST', 'HALT'
];

function getEl<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function rgb332ToCss(v: number): string {
  const r = ((v >> 5) & 7) * 36;
  const g = ((v >> 2) & 7) * 36;
  const b = (v & 3) * 85;
  return `rgb(${r},${g},${b})`;
}

export function decodeMusicWord(raw: number): { freq: number; wave: number; gate: number } {
  return {
    freq: raw & 0x0fff,
    wave: (raw >> 12) & 0x3,
    gate: (raw >> 14) & 0x1
  };
}

export function encodeMusicWord(freq: number, wave: number, gate: number): number {
  return ((gate & 1) << 14) | ((wave & 3) << 12) | (freq & 0x0fff);
}

export function disassembleRisc16(word: number): string {
  const op = (word >> 12) & 0xf;
  const rd = (word >> 9) & 0x7;
  const ra = (word >> 6) & 0x7;
  const imm6 = word & 0x3f;
  const imm9 = word & 0x1ff;
  const mnem = RISC_OPCODES[op] || `OP${op}`;
  if (op === 0 || op === 15) return mnem;
  if (op === 1) return `${mnem} R${rd}, 0x${imm9.toString(16).toUpperCase()}`;
  if (op >= 10 && op <= 12) return `${mnem} 0x${(word & 0xfff).toString(16).toUpperCase()}`;
  return `${mnem} R${rd}, R${ra}, #${imm6}`;
}

export function createMemoryProgrammer(host: MemProgrammerHost): MemProgrammerController {
  let activeCompId: string | null = null;
  let activeTab: MemTab = 'hex';
  let doomBrush = 1;
  let doomPainting = false;
  let musicWave = 0;
  let memPage = 0;
  let memPageSize = 64;
  let selectedAddr = 0;
  let lastSearchQuery = '';
  let searchMatchCursor = -1;
  const matchedAddrs = new Set<number>();

  const isOpen = (): boolean => {
    const modal = getEl('mem-modal');
    return Boolean(modal && !modal.classList.contains('hidden') && activeCompId);
  };

  const ensureMemoryArray = (comp: LogicComponent): { mem: (number | bigint)[]; ab: number; b: number; size: number } => {
    const ab = Math.max(4, Math.min(16, comp.addrBits || 8));
    const b = Math.max(4, Math.min(64, comp.bits || 8));
    const size = 1 << ab;
    if (!comp.internalState.mem || comp.internalState.mem.length !== size) {
      const old = comp.internalState.mem || [];
      comp.internalState.mem = new Array(size).fill(0n);
      for (let i = 0; i < Math.min(old.length, size); i++) {
        comp.internalState.mem[i] = old[i];
      }
    }
    return { mem: comp.internalState.mem, ab, b, size };
  };

  const getActiveReadAddr = (comp: LogicComponent, ab: number, size: number): number | null => {
    const raw = comp.type === 'DUAL_RAM_N' ? comp.pinValues.aa : comp.pinValues.addr;
    if (raw === undefined || raw === 'Z' || raw === 'ERR') return null;
    return Number(toUintN(raw, ab)) & (size - 1);
  };

  const updateCellDetail = (addr: number, comp: LogicComponent): void => {
    const detail = getEl('mem-cell-detail');
    if (!detail) return;
    const { mem, ab, b, size } = ensureMemoryArray(comp);
    const safeAddr = Math.max(0, Math.min(size - 1, addr));
    const addrDigits = Math.ceil(ab / 4);
    const hexDigits = Math.ceil(b / 4);
    const u = toUintN(mem[safeAddr] as PinSignal, b);
    const s = toSignedN(u, b);
    const binFull = u.toString(2).padStart(b, '0');
    const binShown = b > 16 ? `…${binFull.slice(-16)}` : binFull;
    const lowByte = Number(u & 0xffn);
    const ascii = lowByte >= 32 && lowByte <= 126 ? `'${String.fromCharCode(lowByte)}'` : '·';
    detail.textContent =
      `Celda 0x${safeAddr.toString(16).toUpperCase().padStart(addrDigits, '0')} (${safeAddr}) | ` +
      `Hex: 0x${u.toString(16).toUpperCase().padStart(hexDigits, '0')} | ` +
      `Dec: ${u.toString()} | Signo: ${s.toString()} | Bin: ${binShown} | ASCII: ${ascii}`;
  };

  const renderDoomGrid = (comp: LogicComponent): void => {
    const grid = getEl('mem-doom-grid');
    if (!grid) return;
    const { mem, b, size } = ensureMemoryArray(comp);
    const readAddr = getActiveReadAddr(comp, comp.addrBits || 8, size);

    document.querySelectorAll<HTMLElement>('[data-doomtile]').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.doomtile) === doomBrush);
    });

    let html = '';
    const count = Math.min(256, size);
    for (let i = 0; i < count; i++) {
      const tileVal = Number(toUintN(mem[i] as PinSignal, b)) % 5;
      const meta = DOOM_TILE_META[tileVal] || DOOM_TILE_META[0];
      const x = i & 15;
      const y = i >> 4;
      const cls = ['doom-tile', readAddr === i ? 'reading' : '', selectedAddr === i ? 'selected' : '']
        .filter(Boolean)
        .join(' ');
      html += `<button type="button" class="${cls}" data-didx="${i}" title="(${x},${y}) 0x${i.toString(16).toUpperCase().padStart(2, '0')} = ${meta.name}" style="background:${meta.color};">${tileVal || ''}</button>`;
    }
    grid.innerHTML = html;

    const paintCell = (btn: HTMLElement) => {
      const idx = Number(btn.dataset.didx);
      mem[idx] = toUintN(BigInt(doomBrush), b);
      selectedAddr = idx;
      const meta = DOOM_TILE_META[doomBrush] || DOOM_TILE_META[0];
      btn.style.background = meta.color;
      btn.textContent = doomBrush ? String(doomBrush) : '';
      const coordEl = getEl('mem-doom-coord');
      if (coordEl) coordEl.textContent = `Celda (${idx & 15}, ${idx >> 4}) = Tile ${doomBrush} (${meta.name})`;
      updateCellDetail(idx, comp);
      host.evaluateAndNotify(false);
    };

    grid.querySelectorAll<HTMLElement>('.doom-tile').forEach(btn => {
      btn.onpointerdown = e => {
        e.preventDefault();
        doomPainting = true;
        paintCell(btn);
      };
      btn.onpointerenter = () => {
        const idx = Number(btn.dataset.didx);
        const coordEl = getEl('mem-doom-coord');
        if (coordEl) {
          const v = Number(toUintN(mem[idx] as PinSignal, b));
          coordEl.textContent = `Pos (${idx & 15}, ${idx >> 4}) • 0x${idx.toString(16).toUpperCase().padStart(2, '0')} = ${v}`;
        }
        if (doomPainting) paintCell(btn);
      };
    });
  };

  const renderMusicTracker = (comp: LogicComponent): void => {
    const list = getEl('mem-music-list');
    if (!list) return;
    const { mem, ab, b, size } = ensureMemoryArray(comp);
    const base = Math.max(0, Math.min(size - 16, selectedAddr & ~15));
    const addrDigits = Math.ceil(ab / 4);
    const hexDigits = Math.ceil(b / 4);
    const readAddr = getActiveReadAddr(comp, ab, size);

    let html = '';
    for (let i = base; i < Math.min(size, base + 16); i++) {
      const raw = Number(toUintN(mem[i] as PinSignal, b));
      const { freq, wave, gate } = decodeMusicWord(raw);
      const isSel = i === selectedAddr;
      const isReading = i === readAddr;
      const noteMatch = MUSIC_NOTES.find(n => Math.abs(n.hz - freq) <= 2);
      const noteTxt = gate === 0 || freq === 0 ? '— Silencio —' : `${noteMatch ? noteMatch.label : `${freq} Hz`} · ${WAVE_NAMES[wave]}`;
      html += `
        <button type="button" class="music-step-row ${isSel ? 'selected' : ''} ${isReading ? 'reading' : ''}" data-mstep="${i}">
          <span class="mono">0x${i.toString(16).toUpperCase().padStart(addrDigits, '0')}</span>
          <span class="mono" style="color:var(--accent);">0x${raw.toString(16).toUpperCase().padStart(hexDigits, '0')}</span>
          <span>${noteTxt}</span>
          <span class="mono" style="font-size:10px; color:var(--text-muted);">${gate ? 'ON' : 'OFF'}</span>
        </button>`;
    }
    list.innerHTML = html;

    list.querySelectorAll<HTMLElement>('[data-mstep]').forEach(btn => {
      btn.onclick = () => {
        selectedAddr = Number(btn.dataset.mstep);
        renderMusicTracker(comp);
        updateCellDetail(selectedAddr, comp);
      };
    });
  };

  const renderGuideTab = (comp: LogicComponent): void => {
    const disEl = getEl('mem-guide-disasm');
    if (!disEl) return;
    const { mem, ab, b, size } = ensureMemoryArray(comp);
    const addr = Math.max(0, Math.min(size - 1, selectedAddr));
    const val = Number(toUintN(mem[addr] as PinSignal, Math.min(32, b)));
    const lowByte = val & 0xff;
    const ascii = lowByte >= 32 && lowByte <= 126 ? `'${String.fromCharCode(lowByte)}'` : '(no imprimible)';
    const music = decodeMusicWord(val);
    const hexStr = '0x' + toUintN(mem[addr] as PinSignal, b).toString(16).toUpperCase().padStart(Math.ceil(b / 4), '0');

    disEl.innerHTML = `
      <div class="mem-guide-grid mono">
        <div><span>Dirección:</span> <strong>0x${addr.toString(16).toUpperCase().padStart(Math.ceil(ab / 4), '0')} (${addr})</strong></div>
        <div><span>Valor Hex / Dec:</span> <strong>${hexStr} / ${toUintN(mem[addr] as PinSignal, b).toString()}</strong></div>
        <div><span>Carácter ASCII:</span> <strong>${ascii}</strong></div>
        <div><span>Color RGB332:</span> <strong style="display:inline-flex;align-items:center;gap:6px;"><i style="display:inline-block;width:14px;height:14px;border-radius:4px;border:1px solid #fff;background:${rgb332ToCss(lowByte)};"></i> 0x${lowByte.toString(16).toUpperCase().padStart(2, '0')}</strong></div>
        <div><span>Word Musical (16b):</span> <strong>${music.gate ? 'ON' : 'OFF'} · ${music.freq}Hz · ${WAVE_NAMES[music.wave]}</strong></div>
        <div><span>Instr. RISC-16:</span> <strong>${disassembleRisc16(val & 0xffff)}</strong></div>
      </div>`;
  };

  const syncTabsUI = (): void => {
    document.querySelectorAll<HTMLElement>('[data-memtab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.memtab === activeTab);
    });
    (['hex', 'doom', 'music', 'guide'] as MemTab[]).forEach(tab => {
      getEl(`mem-panel-${tab}`)?.classList.toggle('hidden', activeTab !== tab);
    });
  };

  const refreshLive = (): void => {
    if (!isOpen()) return;
    const comp = host.getComponent(activeCompId);
    if (!comp) return;
    const { ab, b, size } = ensureMemoryArray(comp);
    const addrDigits = Math.ceil(ab / 4);
    const readAddr = getActiveReadAddr(comp, ab, size);
    const lastWrite = typeof comp.internalState.lastWrite === 'number' ? comp.internalState.lastWrite : null;
    const liveEl = getEl('mem-live-info');
    if (liveEl) {
      const rTxt = readAddr !== null ? `0x${readAddr.toString(16).toUpperCase().padStart(addrDigits, '0')}` : '—';
      const wTxt = lastWrite !== null && lastWrite >= 0 ? `0x${lastWrite.toString(16).toUpperCase().padStart(addrDigits, '0')}` : '—';
      liveEl.textContent = `Lectura actual: ${rTxt} • Última escritura: ${wTxt} • Capacidad: ${size} × ${b}b (${comp.type})`;
    }
    const grid = getEl('mem-hex-grid');
    if (grid && activeTab === 'hex') {
      grid.querySelectorAll<HTMLElement>('.mem-cell').forEach(cell => {
        const a = Number(cell.dataset.caddr);
        cell.classList.toggle('active-read', readAddr !== null && a === readAddr);
        cell.classList.toggle('written', lastWrite !== null && a === lastWrite);
        cell.classList.toggle('selected-cell', a === selectedAddr);
      });
    }
  };

  const render = (): void => {
    const comp = host.getComponent(activeCompId);
    if (!comp) return;
    const { mem, ab, b, size } = ensureMemoryArray(comp);
    const totalPages = Math.max(1, Math.ceil(size / memPageSize));
    memPage = Math.max(0, Math.min(totalPages - 1, memPage));
    const start = memPage * memPageSize;
    const end = Math.min(size, start + memPageSize) - 1;
    const hexDigits = Math.ceil(b / 4);
    const addrDigits = Math.ceil(ab / 4);
    const readAddr = getActiveReadAddr(comp, ab, size);

    const title = getEl('mem-modal-title');
    if (title) {
      const lbl = comp.label ? ` "${comp.label}"` : '';
      title.textContent = `Programador ${comp.type}${lbl} (${size} × ${b}b) — Pág. ${memPage + 1}/${totalPages}`;
    }

    syncTabsUI();

    const pageInfo = getEl('mem-page-info');
    if (pageInfo) {
      pageInfo.textContent = `0x${start.toString(16).toUpperCase().padStart(addrDigits, '0')}–0x${end.toString(16).toUpperCase().padStart(addrDigits, '0')}`;
    }

    const sizeSel = getEl<HTMLSelectElement>('mem-page-size');
    if (sizeSel && Number(sizeSel.value) !== memPageSize) {
      sizeSel.value = String(memPageSize);
    }

    const grid = getEl('mem-hex-grid');
    if (grid) {
      let html = '<div class="mem-hex-table">';
      for (let i = start; i <= end; i++) {
        const nVal = toUintN(mem[i] as PinSignal, b);
        const val = nVal.toString(16).toUpperCase().padStart(hexDigits, '0');
        const ascii = b === 8 && nVal >= 32n && nVal <= 126n ? ` '${String.fromCharCode(Number(nVal))}'` : '';
        const classes = [
          'mem-cell',
          comp.internalState.lastWrite === i ? 'written' : '',
          readAddr === i ? 'active-read' : '',
          selectedAddr === i ? 'selected-cell' : '',
          matchedAddrs.has(i) ? 'match-cell' : ''
        ]
          .filter(Boolean)
          .join(' ');
        html += `<label class="${classes}" data-caddr="${i}"><span class="mono">0x${i.toString(16).toUpperCase().padStart(addrDigits, '0')}${ascii}</span><input data-hmaddr="${i}" class="input-control mono" maxlength="${hexDigits}" value="${val}" /></label>`;
      }
      html += '</div>';
      grid.innerHTML = html;

      grid.querySelectorAll<HTMLInputElement>('[data-hmaddr]').forEach(inp => {
        inp.onfocus = () => {
          selectedAddr = Number(inp.dataset.hmaddr);
          inp.select();
          refreshLive();
          updateCellDetail(selectedAddr, comp);
        };
        inp.onchange = () => {
          const addr = Number(inp.dataset.hmaddr);
          const clean = inp.value.trim().replace(/^0x/i, '');
          let parsed = 0n;
          try {
            parsed = clean ? toUintN(BigInt('0x' + clean), b) : 0n;
          } catch {
            parsed = 0n;
          }
          mem[addr] = parsed;
          inp.value = parsed.toString(16).toUpperCase().padStart(hexDigits, '0');
          selectedAddr = addr;
          updateCellDetail(addr, comp);
          host.evaluateAndNotify(true);
          refreshLive();
        };
      });
    }

    if (activeTab === 'doom') renderDoomGrid(comp);
    if (activeTab === 'music') renderMusicTracker(comp);
    if (activeTab === 'guide') renderGuideTab(comp);

    const prevBtn = getEl<HTMLButtonElement>('mem-page-prev');
    const nextBtn = getEl<HTMLButtonElement>('mem-page-next');
    if (prevBtn) prevBtn.disabled = memPage <= 0;
    if (nextBtn) nextBtn.disabled = memPage >= totalPages - 1;

    refreshLive();
    updateCellDetail(selectedAddr, comp);
  };

  const open = (comp: LogicComponent): void => {
    activeCompId = comp.id;
    activeTab = 'hex';
    memPage = 0;
    selectedAddr = 0;
    matchedAddrs.clear();
    lastSearchQuery = '';
    searchMatchCursor = -1;
    render();
    getEl('mem-modal')?.classList.remove('hidden');
  };

  const jumpToAddress = (addr: number): void => {
    const comp = host.getComponent(activeCompId);
    if (!comp) return;
    const { size } = ensureMemoryArray(comp);
    const clamped = Math.max(0, Math.min(size - 1, addr));
    selectedAddr = clamped;
    memPage = Math.floor(clamped / memPageSize);
    render();
    const inp = document.querySelector<HTMLInputElement>(`[data-hmaddr="${clamped}"]`);
    inp?.focus();
  };

  const runSearch = (): void => {
    const comp = host.getComponent(activeCompId);
    const q = (getEl<HTMLInputElement>('mem-search-input')?.value || '').trim();
    if (!comp || !q) {
      matchedAddrs.clear();
      render();
      return;
    }
    const { mem, b, size } = ensureMemoryArray(comp);
    const matches: number[] = [];
    let targetVal: bigint | null = null;
    if (/^0x[0-9a-f]+$/i.test(q)) {
      targetVal = toUintN(BigInt(q), b);
    } else if (/^\d+$/.test(q)) {
      targetVal = toUintN(BigInt(q), b);
    } else if (/^[0-9a-f]+$/i.test(q) && q.length <= Math.ceil(b / 4)) {
      targetVal = toUintN(BigInt('0x' + q), b);
    }

    const qLower = q.toLowerCase();
    for (let i = 0; i < size; i++) {
      const u = toUintN(mem[i] as PinSignal, b);
      let hit = targetVal !== null && u === targetVal;
      if (!hit && b >= 8 && q.length >= 1) {
        const ch = Number(u & 0xffn);
        if (q.length === 1 && String.fromCharCode(ch).toLowerCase() === qLower) {
          hit = true;
        } else if (q.length > 1 && i + q.length <= size) {
          let sub = '';
          for (let k = 0; k < q.length; k++) {
            sub += String.fromCharCode(Number(toUintN(mem[i + k] as PinSignal, b) & 0xffn));
          }
          if (sub.toLowerCase() === qLower) hit = true;
        }
      }
      if (hit) matches.push(i);
    }

    matchedAddrs.clear();
    matches.forEach(a => matchedAddrs.add(a));

    if (matches.length === 0) {
      render();
      host.showToast(`Sin coincidencias para "${q}"`, 'warn');
      return;
    }

    if (lastSearchQuery === q) {
      searchMatchCursor = (searchMatchCursor + 1) % matches.length;
    } else {
      lastSearchQuery = q;
      searchMatchCursor = 0;
    }
    const targetAddr = matches[searchMatchCursor];
    jumpToAddress(targetAddr);
    host.showToast(`${matches.length} coincidencia(s) — mostrando #${searchMatchCursor + 1}`);
  };

  const applyPattern = (pattern: string): void => {
    const comp = host.getComponent(activeCompId);
    if (!comp) return;
    const { mem, b, size } = ensureMemoryArray(comp);
    const maxVal = maskBits(b);

    if (pattern === 'zero') {
      mem.fill(0n);
    } else if (pattern === 'ff') {
      mem.fill(maxVal);
    } else if (pattern === 'ramp') {
      for (let i = 0; i < size; i++) mem[i] = toUintN(BigInt(i), b);
    } else if (pattern === 'fib') {
      let a = 0n;
      let bb = 1n;
      for (let i = 0; i < size; i++) {
        mem[i] = toUintN(a, b);
        const nxt = toUintN(a + bb, b);
        a = bb;
        bb = nxt;
      }
    } else if (pattern === 'checker') {
      for (let i = 0; i < size; i++) {
        const pat = i % 2 === 0 ? 0xA5A5A5A5A5A5A5A5n : 0x5A5A5A5A5A5A5A5An;
        mem[i] = toUintN(pat, b);
      }
    } else if (pattern === 'random') {
      let seed = (Date.now() ^ (size * 2654435761)) >>> 0;
      for (let i = 0; i < size; i++) {
        seed = (1664525 * seed + 1013904223) >>> 0;
        const hi = BigInt(seed);
        seed = (1664525 * seed + 1013904223) >>> 0;
        const lo = BigInt(seed);
        mem[i] = toUintN((hi << 32n) | lo, b);
      }
    } else if (pattern === 'invert') {
      for (let i = 0; i < size; i++) {
        mem[i] = toUintN(~toUintN(mem[i] as PinSignal, b), b);
      }
    } else if (pattern === 'doom') {
      for (let i = 0; i < Math.min(size, DEFAULT_DOOM_MAP.length); i++) {
        mem[i] = toUintN(BigInt(DEFAULT_DOOM_MAP[i]), b);
      }
    }

    host.evaluateAndNotify(true);
    render();
    host.showToast(`Patrón "${pattern}" aplicado a ${size} celdas`);
  };

  const importMemoryText = (raw: string): void => {
    const comp = host.getComponent(activeCompId);
    if (!comp) return;
    const { mem, b, size } = ensureMemoryArray(comp);
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    if (lines.some(l => l.startsWith(':') && l.length >= 11)) {
      let count = 0;
      for (const l of lines) {
        if (!l.startsWith(':')) continue;
        const byteCount = parseInt(l.slice(1, 3), 16);
        const addr = parseInt(l.slice(3, 7), 16);
        const recType = parseInt(l.slice(7, 9), 16);
        if (recType === 0 && !Number.isNaN(byteCount) && !Number.isNaN(addr)) {
          for (let i = 0; i < byteCount && addr + i < size; i++) {
            const bHex = l.slice(9 + i * 2, 11 + i * 2);
            const v = parseInt(bHex, 16);
            if (!Number.isNaN(v)) {
              mem[addr + i] = toUintN(BigInt(v), b);
              count++;
            }
          }
        }
      }
      host.evaluateAndNotify(true);
      render();
      host.showToast(`Intel HEX importado (${count} bytes)`);
      return;
    }

    const tokens: string[] = [];
    for (const line of lines) {
      if (line.startsWith('#') || line.toLowerCase().startsWith('v2.0') || line.toLowerCase().startsWith('addr,')) continue;
      if (line.includes(',') && /^0x[0-9a-f]+,/i.test(line)) {
        const parts = line.split(',');
        if (parts[1]) tokens.push(parts[1].trim());
      } else {
        line.split(/[\s,;]+/).filter(Boolean).forEach(t => tokens.push(t));
      }
    }
    let count = 0;
    for (let i = 0; i < tokens.length && i < size; i++) {
      const tok = tokens[i];
      try {
        const val = /^0x/i.test(tok) || /[a-f]/i.test(tok) ? BigInt('0x' + tok.replace(/^0x/i, '')) : BigInt(tok);
        mem[i] = toUintN(val, b);
        count++;
      } catch {
        // skip
      }
    }
    host.evaluateAndNotify(true);
    render();
    host.showToast(`Importadas ${count} posiciones desde archivo`);
  };

  const bindEvents = (): void => {
    window.addEventListener('pointerup', () => {
      if (doomPainting) {
        doomPainting = false;
        host.evaluateAndNotify(true);
      }
    });

    document.querySelectorAll<HTMLElement>('[data-memtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = (btn.dataset.memtab as MemTab) || 'hex';
        render();
      });
    });

    document.querySelectorAll<HTMLElement>('[data-doomtile]').forEach(btn => {
      btn.addEventListener('click', () => {
        doomBrush = Number(btn.dataset.doomtile) || 0;
        const comp = host.getComponent(activeCompId);
        if (comp) renderDoomGrid(comp);
      });
    });

    getEl('mem-doom-base')?.addEventListener('click', () => applyPattern('doom'));
    getEl('mem-doom-walls')?.addEventListener('click', () => {
      const comp = host.getComponent(activeCompId);
      if (!comp) return;
      const { mem, b, size } = ensureMemoryArray(comp);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const idx = y * 16 + x;
          if (idx >= size) break;
          if (x === 0 || y === 0 || x === 15 || y === 15) mem[idx] = toUintN(1n, b);
        }
      }
      host.evaluateAndNotify(true);
      render();
      host.showToast('Bordes cerrados con muro rojo');
    });

    const musicPalette = getEl('mem-music-notes');
    if (musicPalette) {
      musicPalette.innerHTML = MUSIC_NOTES.map(
        n => `<button type="button" class="btn music-note-btn" data-mhz="${n.hz}">${n.label}</button>`
      ).join('');
      musicPalette.querySelectorAll<HTMLElement>('[data-mhz]').forEach(btn => {
        btn.addEventListener('click', () => {
          const comp = host.getComponent(activeCompId);
          if (!comp) return;
          const { mem, b, size } = ensureMemoryArray(comp);
          const hz = Number(btn.dataset.mhz) || 0;
          const word = encodeMusicWord(hz, musicWave, hz > 0 ? 1 : 0);
          mem[selectedAddr] = toUintN(BigInt(word), b);
          selectedAddr = (selectedAddr + 1) % size;
          host.evaluateAndNotify(true);
          render();
        });
      });
    }

    getEl<HTMLSelectElement>('mem-music-wave')?.addEventListener('change', e => {
      musicWave = Number((e.target as HTMLSelectElement).value) || 0;
    });

    getEl('mem-page-prev')?.addEventListener('click', () => {
      if (memPage > 0) {
        memPage--;
        render();
      }
    });

    getEl('mem-page-next')?.addEventListener('click', () => {
      memPage++;
      render();
    });

    getEl<HTMLSelectElement>('mem-page-size')?.addEventListener('change', e => {
      const nextSize = Number((e.target as HTMLSelectElement).value) || 64;
      memPageSize = nextSize;
      memPage = Math.floor(selectedAddr / memPageSize);
      render();
    });

    getEl('mem-jump-btn')?.addEventListener('click', () => {
      const raw = (getEl<HTMLInputElement>('mem-jump-addr')?.value || '').trim();
      if (!raw) return;
      const addr = /^0x/i.test(raw) || /[a-f]/i.test(raw)
        ? parseInt(raw.replace(/^0x/i, ''), 16)
        : parseInt(raw, 10);
      if (Number.isNaN(addr)) {
        host.showToast('Dirección inválida (usa ej. 0x20 o 32)', 'warn');
        return;
      }
      jumpToAddress(addr);
    });

    getEl<HTMLInputElement>('mem-jump-addr')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        getEl('mem-jump-btn')?.click();
      }
    });

    getEl('mem-search-btn')?.addEventListener('click', runSearch);
    getEl<HTMLInputElement>('mem-search-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runSearch();
      }
    });

    getEl('mem-apply-pattern')?.addEventListener('click', () => {
      const sel = getEl<HTMLSelectElement>('mem-pattern-select')?.value || 'zero';
      applyPattern(sel);
    });

    getEl('mem-copy-hex')?.addEventListener('click', () => {
      const comp = host.getComponent(activeCompId);
      if (!comp) return;
      const { mem, b } = ensureMemoryArray(comp);
      const digits = Math.ceil(b / 4);
      const dump = mem
        .map(v => toUintN(v as PinSignal, b).toString(16).toUpperCase().padStart(digits, '0'))
        .join(' ');
      host.copyText(dump, 'Volcado hexadecimal copiado');
    });

    getEl('mem-copy-ls')?.addEventListener('click', () => {
      const comp = host.getComponent(activeCompId);
      if (!comp) return;
      const { mem, b } = ensureMemoryArray(comp);
      let lastNonZero = -1;
      for (let i = mem.length - 1; i >= 0; i--) {
        if (toUintN(mem[i] as PinSignal, b) !== 0n) {
          lastNonZero = i;
          break;
        }
      }
      if (lastNonZero < 0) {
        host.copyText('mem=0x0', 'Línea mem= copiada');
        return;
      }
      const tokens: string[] = [];
      let i = 0;
      while (i <= lastNonZero) {
        const cur = '0x' + toUintN(mem[i] as PinSignal, b).toString(16).toUpperCase();
        let rep = 1;
        while (i + rep <= lastNonZero && '0x' + toUintN(mem[i + rep] as PinSignal, b).toString(16).toUpperCase() === cur) {
          rep++;
        }
        tokens.push(rep > 2 ? `${cur}*${rep}` : Array(rep).fill(cur).join(','));
        i += rep;
      }
      host.copyText(`mem=${tokens.join(',')}`, 'Línea mem= comprimida para LogicScript v2 copiada');
    });

    getEl('mem-export-hex')?.addEventListener('click', () => {
      const comp = host.getComponent(activeCompId);
      if (!comp) return;
      const { mem, b } = ensureMemoryArray(comp);
      const digits = Math.ceil(b / 4);
      const rows: string[] = ['v2.0 raw'];
      for (let i = 0; i < mem.length; i += 16) {
        rows.push(
          mem
            .slice(i, i + 16)
            .map(v => toUintN(v as PinSignal, b).toString(16).toUpperCase().padStart(digits, '0'))
            .join(' ')
        );
      }
      const blob = new Blob([rows.join('\n')], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(comp.label || comp.type).toLowerCase()}_mem.hex`;
      a.click();
      host.showToast('Memoria exportada a .hex (v2.0 raw)');
    });

    getEl('mem-export-csv')?.addEventListener('click', () => {
      const comp = host.getComponent(activeCompId);
      if (!comp) return;
      const { mem, ab, b } = ensureMemoryArray(comp);
      const addrDigits = Math.ceil(ab / 4);
      const digits = Math.ceil(b / 4);
      const lines = ['addr,hex,dec,signed,ascii'];
      for (let i = 0; i < mem.length; i++) {
        const u = toUintN(mem[i] as PinSignal, b);
        const s = toSignedN(u, b);
        const c = Number(u & 0xffn);
        const asc = c >= 32 && c <= 126 ? String.fromCharCode(c).replace(/"/g, '""') : '';
        lines.push(`0x${i.toString(16).toUpperCase().padStart(addrDigits, '0')},0x${u.toString(16).toUpperCase().padStart(digits, '0')},${u.toString()},${s.toString()},"${asc}"`);
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(comp.label || comp.type).toLowerCase()}_mem.csv`;
      a.click();
      host.showToast('Memoria exportada a .csv');
    });

    getEl('mem-import-hex-btn')?.addEventListener('click', () => {
      getEl('mem-import-file')?.click();
    });

    getEl<HTMLInputElement>('mem-import-file')?.addEventListener('change', e => {
      const inp = e.target as HTMLInputElement;
      const file = inp.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        importMemoryText(String(ev.target?.result || ''));
      };
      reader.readAsText(file);
      inp.value = '';
    });

    getEl('mem-load-batch')?.addEventListener('click', () => {
      const comp = host.getComponent(activeCompId);
      const inp = getEl<HTMLInputElement>('mem-batch-input');
      if (!comp || !inp) return;
      const { mem, b, size } = ensureMemoryArray(comp);
      const tokens = inp.value.trim().split(/[\s,;]+/).filter(Boolean);
      if (!tokens.length) return;
      let count = 0;
      const startAddr = Math.max(0, Math.min(size - 1, selectedAddr));
      for (let i = 0; i < tokens.length && startAddr + i < size; i++) {
        const tok = tokens[i];
        try {
          const val = /^0x/i.test(tok) || /[a-f]/i.test(tok) ? BigInt('0x' + tok.replace(/^0x/i, '')) : BigInt(tok);
          mem[startAddr + i] = toUintN(val, b);
          count++;
        } catch {
          // skip
        }
      }
      host.evaluateAndNotify(true);
      render();
      host.showToast(`${count} posiciones cargadas desde 0x${startAddr.toString(16).toUpperCase()}`);
    });

    getEl('mem-load-ascii')?.addEventListener('click', () => {
      const comp = host.getComponent(activeCompId);
      const inp = getEl<HTMLInputElement>('mem-batch-input');
      if (!comp || !inp) return;
      const { mem, b, size } = ensureMemoryArray(comp);
      const txt = inp.value;
      const startAddr = Math.max(0, Math.min(size - 1, selectedAddr));
      let count = 0;
      for (let i = 0; i < txt.length && startAddr + i < size; i++) {
        mem[startAddr + i] = toUintN(BigInt(txt.charCodeAt(i)), b);
        count++;
      }
      host.evaluateAndNotify(true);
      render();
      host.showToast(`${count} caracteres ASCII grabados desde 0x${startAddr.toString(16).toUpperCase()}`);
    });
  };

  return { open, render, refreshLive, isOpen, bindEvents };
}
