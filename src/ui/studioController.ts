import {
  computeTruthTable,
  synthesizeBooleanCircuit,
  TruthTableResult
} from '../engine/booleanSynth';
import {
  CATEGORIES,
  COMPONENT_CATALOG,
  cloneCleanSubNetlist,
  createComponent,
  getSplitterChunks,
  getWorldPins,
  pinWX,
  pinWY,
  syncComponentPins
} from '../engine/catalog';
import { CHALLENGES, ChallengeDef, ChallengeValidationResult, validateChallenge } from '../engine/challenges';
import { LEARNING_LESSONS, LearningLesson } from '../engine/lessons';
import {
  LogicScriptDiagnostic,
  compileLogicScript,
  exportCircuitToLogicScript,
  formatLogicScriptDiagnosticsForAI,
  generateLogicScriptAIPrompt,
  lsLayout
} from '../engine/logicscript';
import { exportCircuitToLogisimCirc } from '../engine/logisimExport';
import {
  advanceClocks,
  evaluateCircuitDeterministic,
  evaluateSequentialEdges,
  solveNetwork
} from '../engine/simulator';
import {
  AppSettings,
  CustomICDef,
  LogicComponent,
  NavigationMode,
  PerfProfile,
  PinSignal,
  QualityMode,
  ThemeId,
  Wire,
  WireStyle,
  WireVisibilityMode,
  WorldPin,
  bit,
  deserializeCircuitData,
  exportLsProData,
  formatSignalHex,
  genId,
  isSignalNonZero,
  maskBits,
  parseCircuitImport,
  serializeCircuitData,
  toSignedN,
  toUintN
} from '../engine/types';
import { PRESET_LIST, buildPresetCircuit } from '../presets/circuits';
import {
  CANVAS_THEMES,
  CHANNEL_COLORS,
  LED_PALETTE,
  RenderStateView,
  RippleFX,
  SparkFX,
  drawComponent,
  drawComponentGroups,
  drawPinTooltip,
  drawWires,
  evalPointOnWire,
  geomBounds,
  getSignalColor,
  getWireControlHandle,
  getWireGeometry,
  wireLane
} from './canvasRenderer';
import { createMemoryProgrammer } from './memProgrammer';
import { soundFX } from './sound';

const AUTOSAVE_KEY = 'logicstudio_pro_beta04_autosave';
const LEGACY_AUTOSAVE_KEY = 'logicstudio_pro_beta03_autosave';
const PREFS_KEY = 'logicstudio_pro_beta04_prefs';
const LEGACY_PREFS_KEY = 'logicstudio_pro_beta03_prefs';
const CHAL_KEY = 'logicstudio_pro_beta04_challenges';
const LEGACY_CHAL_KEY = 'logicstudio_pro_beta03_challenges';
const SCRIPT_KEY = 'logicstudio_pro_beta04_script';
const FAVS_KEY = 'logicstudio_pro_beta04_favs';
const LEGACY_FAVS_KEY = 'logicstudio_pro_beta03_favs';
const RECENT_KEY = 'logicstudio_pro_beta04_recent';
const LEGACY_RECENT_KEY = 'logicstudio_pro_beta03_recent';
const LEARN_KEY = 'logicstudio_pro_beta04_lessons';

function readStorageWithFallback(newKey: string, legacyKey?: string): string | null {
  try {
    const v = localStorage.getItem(newKey);
    if (v !== null) return v;
    return legacyKey ? localStorage.getItem(legacyKey) : null;
  } catch {
    return null;
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  dblclickEdit: false,
  openAnalyzerOnStart: true,
  quality: 'auto',
  perfProfile: 'balanced',
  fpsCap: 60,
  ecoMode: false,
  particles: true,
  snap: true,
  defaultWireStyle: 'bezier',
  wireVisibility: 'all',
  navigationMode: 'auto',
  showMinimap: true,
  showFloatingHelp: true,
  showGrid: true,
  showWireLabels: true,
  showFpsCounter: false,
  reduceAnimations: false,
  turboMaxCycles: 512,
  defaultBitWidth: 8,
  clockMultiplier: 1
};

interface ProbeStat {
  edges: number;
  lastVal: number;
  highTime: number;
  totalTime: number;
  windowTime: number;
  windowEdges: number;
  freqHz: number;
  history: number[];
}

export function initLogicStudio(): () => void {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;

  const SETTINGS: AppSettings = { ...DEFAULT_SETTINGS };
  const isEcoMode = () =>
    Boolean(
      SETTINGS.ecoMode ||
        SETTINGS.quality === 'eco' ||
        SETTINGS.perfProfile === 'eco' ||
        SETTINGS.perfProfile === 'potato'
    );
  const FX = {
    degraded: false,
    ema: 16.7,
    lastInteract: 0,
    halfRate: false,
    checkAt: 0,
    retest: Infinity
  };

  let initFavs: string[] = [];
  let initRecents: string[] = [];
  try {
    initFavs = JSON.parse(readStorageWithFallback(FAVS_KEY, LEGACY_FAVS_KEY) || '[]') || [];
    initRecents = JSON.parse(readStorageWithFallback(RECENT_KEY, LEGACY_RECENT_KEY) || '[]') || [];
  } catch {
    initFavs = [];
    initRecents = [];
  }

  const state = {
    theme: 'cyber' as ThemeId,
    components: [] as LogicComponent[],
    wires: [] as Wire[],
    customICs: [] as CustomICDef[],
    collapsedCats: new Set<string>(),
    animCat: null as string | null,
    catFilter: 'ALL',
    favsOnly: false,
    favoriteTypes: new Set<string>(Array.isArray(initFavs) ? initFavs : []),
    recentTypes: Array.isArray(initRecents) ? initRecents.slice(0, 6) : ([] as string[]),

    selectedIds: new Set<string>(),
    selectedWireId: null as string | null,
    clipboard: null as { comps: LogicComponent[]; wires: Wire[] } | null,
    pasteOffsetCount: 0,

    view: {
      x: 0,
      y: 0,
      zoom: 1,
      targetX: null as number | null,
      targetY: null as number | null,
      targetZoom: null as number | null
    },

    simRunning: true,
    globalClockHz: 2.0,
    clockMultiplier: 1,
    simTime: 0,
    oscillationTickTimer: 0,

    wireStyle: 'bezier' as WireStyle,
    wireVisibility: 'all' as WireVisibilityMode,
    probeMode: false,

    ripples: [] as RippleFX[],
    sparks: [] as SparkFX[],
    snapGuides: [] as Array<{ axis: 'x' | 'y'; pos: number }>,

    mode: 'IDLE' as 'IDLE' | 'PANNING' | 'DRAGGING_COMP' | 'MARQUEE' | 'WIRING' | 'DRAGGING_WIRE_HANDLE',
    spacePressed: false,
    spaceDidPan: false,
    dragMoved: false,
    wireDragMoved: false,
    dragWireHandle: null as { wireId: string; axis: 'x' | 'y'; startOffset: number } | null,
    dragStartWorld: { x: 0, y: 0 },
    dragStartScreen: { x: 0, y: 0 },
    dragInitialPositions: new Map<string, { x: number; y: number }>(),
    marqueeRect: null as { x: number; y: number; w: number; h: number } | null,
    activePressId: null as string | null,
    activeGamepadId: null as string | null,
    activeSliderId: null as string | null,
    inlineEditCompId: null as string | null,

    wiringFrom: null as { compId: string; pinId: string; dir: 'in' | 'out' } | null,
    mouseWorld: { x: 0, y: 0 },
    mouseScreen: { x: 0, y: 0 },
    snapPin: null as WorldPin | null,
    hoveredPin: null as WorldPin | null,
    hoveredWire: null as Wire | null,

    probeStats: new Map<string, ProbeStat>(),
    history: [] as string[],
    historyIndex: -1,
    nudgeTimer: 0 as unknown as ReturnType<typeof setTimeout>,

    analyzerOpen: true,
    analyzerPaused: false,
    analyzerDirty: true,
    analyzerSamples: [] as Array<Record<string, number>>,
    maxAnalyzerSamples: 200,
    analyzerTimer: 0
  };

  const mainCanvas = $('main-canvas') as HTMLCanvasElement;
  const mainCtx = mainCanvas.getContext('2d')!;
  const minimapCanvas = $('minimap-canvas') as HTMLCanvasElement;
  const minimapCtx = minimapCanvas.getContext('2d')!;
  const analyzerCanvas = $('analyzer-canvas') as HTMLCanvasElement;
  const analyzerCtx = analyzerCanvas.getContext('2d')!;

  function showToast(msg: string, type: 'info' | 'warn' = 'info'): void {
    const container = $('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast-msg ${type === 'warn' ? 'warn' : ''}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.25s ease';
      setTimeout(() => el.remove(), 260);
    }, 2300);
  }

  function screenToWorld(sx: number, sy: number) {
    return {
      x: (sx - state.view.x) / state.view.zoom,
      y: (sy - state.view.y) / state.view.zoom
    };
  }

  function worldToScreen(wx: number, wy: number) {
    return {
      x: wx * state.view.zoom + state.view.x,
      y: wy * state.view.zoom + state.view.y
    };
  }

  function spawnRipple(x: number, y: number, color: string | null = null, maxR = 42): void {
    if (isEcoMode()) return;
    state.ripples.push({
      x,
      y,
      r: 4,
      maxR,
      alpha: 0.85,
      color: color || CANVAS_THEMES[state.theme].sig1
    });
  }

  function spawnSparks(x: number, y: number, count = 14): void {
    if (isEcoMode()) return;
    const col = CANVAS_THEMES[state.theme].sigErr;
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = 45 + Math.random() * 90;
      state.sparks.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.42,
        maxLife: 0.42,
        color: col
      });
    }
  }

  // =========================================================================
  // PREFERENCIAS Y AUTOGUARDADO EN LOCALSTORAGE
  // =========================================================================
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleAutosave(snap: string): void {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      let saved = true;
      try {
        localStorage.setItem(AUTOSAVE_KEY, snap);
      } catch {
        saved = false;
      }
      const pill = $('autosave-pill');
      if (pill) {
        pill.textContent = saved ? `💾 Guardado ${new Date().toLocaleTimeString()}` : '⚠ Sin autoguardado';
        pill.classList.remove('flash');
        void pill.offsetWidth;
        pill.classList.add('flash');
      }
    }, isEcoMode() ? 1600 : 600);
  }

  function savePrefs(): void {
    try {
      SETTINGS.defaultWireStyle = state.wireStyle;
      SETTINGS.wireVisibility = state.wireVisibility;
      SETTINGS.clockMultiplier = state.clockMultiplier;
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          theme: state.theme,
          wireStyle: state.wireStyle,
          wireVisibility: state.wireVisibility,
          sound: soundFX.enabled,
          hz: state.globalClockHz,
          clockMultiplier: state.clockMultiplier,
          settings: SETTINGS,
          libHidden: $('sidebar-left')?.classList.contains('collapsed') || false
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }

  function applyVisualSettings(): void {
    const miniBox = document.querySelector('.minimap-box') as HTMLElement | null;
    if (miniBox) miniBox.classList.toggle('hidden', !SETTINGS.showMinimap);
    const helpBar = document.querySelector('.floating-help') as HTMLElement | null;
    if (helpBar) helpBar.classList.toggle('hidden', !SETTINGS.showFloatingHelp);
    document.body.classList.toggle(
      'reduce-anim',
      Boolean(SETTINGS.reduceAnimations || SETTINGS.perfProfile === 'potato')
    );
    $('status-fps')?.classList.toggle('hidden', !SETTINGS.showFpsCounter);
    updateWireVisButton();
  }

  function updateWireVisButton(): void {
    const lbl = $('wire-vis-label');
    const btn = $('btn-wire-vis');
    if (!lbl || !btn) return;
    if (state.wireVisibility === 'all') {
      lbl.textContent = 'Todos';
      btn.classList.remove('btn-active');
    } else if (state.wireVisibility === 'dim_inactive') {
      lbl.textContent = 'Activos';
      btn.classList.add('btn-active');
    } else {
      lbl.textContent = 'Foco';
      btn.classList.add('btn-active');
    }
  }

  function setAnalyzerOpen(open: boolean): void {
    state.analyzerOpen = open;
    $('analyzer-panel')?.classList.toggle('hidden', !open);
    $('btn-toggle-analyzer')?.classList.toggle('btn-active', open);
    markDirty(250);
  }

  // =========================================================================
  // HIT-TESTING
  // =========================================================================
  function hitTestPin(worldPos: { x: number; y: number }, radius = 12): WorldPin | null {
    let best: WorldPin | null = null;
    let minD = radius;
    for (const c of state.components) {
      const m = Math.max(c.w, c.h) / 2 + radius + 8;
      if (Math.abs(worldPos.x - c.x) > m || Math.abs(worldPos.y - c.y) > m) continue;
      for (const wp of getWorldPins(c)) {
        const d = Math.hypot(wp.x - worldPos.x, wp.y - worldPos.y);
        if (d < minD) {
          minD = d;
          best = wp;
        }
      }
    }
    return best;
  }

  function findCompatibleSnapPin(worldPos: { x: number; y: number }, radius = 16): WorldPin | null {
    if (!state.wiringFrom) return null;
    let best: WorldPin | null = null;
    let minD = radius;
    for (const c of state.components) {
      if (c.id === state.wiringFrom.compId) continue;
      const m = Math.max(c.w, c.h) / 2 + radius + 8;
      if (Math.abs(worldPos.x - c.x) > m || Math.abs(worldPos.y - c.y) > m) continue;
      for (const wp of getWorldPins(c)) {
        if (wp.dir === state.wiringFrom.dir) continue;
        const d = Math.hypot(wp.x - worldPos.x, wp.y - worldPos.y);
        if (d < minD) {
          minD = d;
          best = wp;
        }
      }
    }
    return best;
  }

  function hitTestComponent(worldPos: { x: number; y: number }): LogicComponent | null {
    for (let i = state.components.length - 1; i >= 0; i--) {
      const c = state.components[i];
      const odd = (c.rot || 0) % 2 === 1;
      const hw = (odd ? c.h : c.w) / 2;
      const hh = (odd ? c.w : c.h) / 2;
      if (Math.abs(worldPos.x - c.x) <= hw && Math.abs(worldPos.y - c.y) <= hh) {
        return c;
      }
    }
    return null;
  }

  function hitTestWire(worldPos: { x: number; y: number }, tol = 8): Wire | null {
    const compMap = new Map<string, LogicComponent>();
    const compIdx = new Map<string, number>();
    state.components.forEach((c, i) => {
      compMap.set(c.id, c);
      compIdx.set(c.id, i);
    });
    for (let i = state.wires.length - 1; i >= 0; i--) {
      const w = state.wires[i];
      const cFrom = compMap.get(w.fromCompId);
      const cTo = compMap.get(w.toCompId);
      if (!cFrom || !cTo) continue;
      const pFrom = cFrom.pins.find(p => p.id === w.fromPinId);
      const pTo = cTo.pins.find(p => p.id === w.toPinId);
      if (!pFrom || !pTo) continue;
      const geom = getWireGeometry(
        pinWX(cFrom, pFrom),
        pinWY(cFrom, pFrom),
        pinWX(cTo, pTo),
        pinWY(cTo, pTo),
        state.wireStyle,
        wireLane(cFrom, pFrom.id, compIdx.get(cFrom.id) || 0, state.wireStyle),
        w.curveOffset || 0,
        w.waypoints
      );
      const b = geomBounds(geom);
      if (worldPos.x < b.x0 - tol || worldPos.x > b.x1 + tol || worldPos.y < b.y0 - tol || worldPos.y > b.y1 + tol) {
        continue;
      }
      for (let s = 0; s <= 24; s++) {
        const pt = evalPointOnWire(geom, s / 24);
        if (Math.hypot(pt.x - worldPos.x, pt.y - worldPos.y) <= tol) return w;
      }
    }
    return null;
  }

  function hitTestWireHandle(worldPos: { x: number; y: number }, tol = 10): { wire: Wire; axis: 'x' | 'y' } | null {
    const compMap = new Map(state.components.map(c => [c.id, c]));
    const compIdx = new Map(state.components.map((c, i) => [c.id, i]));
    const candidateIds = new Set<string>();
    if (state.selectedWireId) candidateIds.add(state.selectedWireId);
    if (state.hoveredWire) candidateIds.add(state.hoveredWire.id);
    for (const wid of candidateIds) {
      const w = state.wires.find(x => x.id === wid);
      if (!w) continue;
      const cFrom = compMap.get(w.fromCompId);
      const cTo = compMap.get(w.toCompId);
      if (!cFrom || !cTo) continue;
      const pFrom = cFrom.pins.find(p => p.id === w.fromPinId);
      const pTo = cTo.pins.find(p => p.id === w.toPinId);
      if (!pFrom || !pTo) continue;
      const geom = getWireGeometry(
        pinWX(cFrom, pFrom),
        pinWY(cFrom, pFrom),
        pinWX(cTo, pTo),
        pinWY(cTo, pTo),
        state.wireStyle,
        wireLane(cFrom, pFrom.id, compIdx.get(cFrom.id) || 0, state.wireStyle),
        w.curveOffset || 0,
        w.waypoints
      );
      const handle = getWireControlHandle(geom);
      if (Math.hypot(handle.x - worldPos.x, handle.y - worldPos.y) <= tol) {
        return { wire: w, axis: handle.axis };
      }
    }
    return null;
  }

  // =========================================================================
  // SIMULACIÓN, SONDA Y OSCILOSCOPIO
  // =========================================================================
  function getMonitoredChannels() {
    const channels: Array<{ id: string; name: string; val: number }> = [];
    for (const c of state.components) {
      const autoWatch = ['CLOCK', 'PROBE', 'SWITCH', 'BUTTON', 'LED', 'COUNTER_4', 'COUNTER_N'].includes(c.type);
      if (!c.probe && !autoWatch) continue;
      if (channels.length >= 6) break;
      let val = 0;
      if (c.pinValues.out !== undefined) val = bit(c.pinValues.out);
      else if (c.pinValues.in0 !== undefined) val = bit(c.pinValues.in0);
      else if (c.pinValues.q !== undefined) val = bit(c.pinValues.q);
      else if (c.pinValues.q0 !== undefined) val = bit(c.pinValues.q0);
      const name = c.label || `${c.type}_${c.id.slice(-2)}`;
      channels.push({ id: c.id, name, val });
    }
    return channels;
  }

  function recordAnalyzerSample(): void {
    state.analyzerDirty = true;
    const channels = getMonitoredChannels();
    const sample: Record<string, number> = {};
    for (const ch of channels) sample[ch.id] = ch.val;
    state.analyzerSamples.push(sample);
    if (state.analyzerSamples.length > state.maxAnalyzerSamples) {
      state.analyzerSamples.shift();
    }
  }

  function updateProbeStats(dt: number): void {
    for (const w of state.wires) {
      let stat = state.probeStats.get(w.id);
      if (!stat) {
        stat = { edges: 0, lastVal: bit(w.signal), highTime: 0, totalTime: 0, windowTime: 0, windowEdges: 0, freqHz: 0, history: [] };
        state.probeStats.set(w.id, stat);
      }
      const cur = bit(w.signal);
      if (cur !== stat.lastVal) {
        stat.edges++;
        stat.windowEdges++;
        stat.lastVal = cur;
      }
      stat.totalTime += dt;
      if (cur === 1) stat.highTime += dt;
      stat.windowTime += dt;
      if (stat.windowTime >= 1.0) {
        stat.freqHz = stat.windowEdges / 2 / stat.windowTime;
        stat.windowTime = 0;
        stat.windowEdges = 0;
      }
      if (state.analyzerTimer === 0) {
        stat.history.push(cur);
        if (stat.history.length > 48) stat.history.shift();
      }
    }
  }

  function updateProbeHUD(): void {
    const hud = $('probe-hud');
    if (!hud) return;
    if (!state.probeMode) {
      hud.classList.add('hidden');
      return;
    }
    hud.classList.remove('hidden');

    const targetWire = state.hoveredWire;
    const targetPin = state.hoveredPin;

    if (!targetWire && !targetPin) {
      $('probe-target-name')!.textContent = 'Pasa sobre cable/pin';
      $('probe-state-val')!.textContent = '--';
      $('probe-freq-val')!.textContent = '0.0 Hz';
      $('probe-duty-val')!.textContent = '0%';
      $('probe-edges-val')!.textContent = '0';
      return;
    }

    if (targetWire) {
      const stat = state.probeStats.get(targetWire.id);
      const pw = targetWire.width || 1;
      const sig = targetWire.unstable ? 'OSC' : pw > 1 ? formatSignalHex(targetWire.signal, pw) : String(targetWire.signal ?? 0);
      $('probe-target-name')!.textContent = pw > 1 ? `Bus ${pw}b` : `Cable #${targetWire.id.slice(-3)}`;
      $('probe-state-val')!.textContent = sig;
      $('probe-freq-val')!.textContent = `${(stat ? stat.freqHz : 0).toFixed(1)} Hz`;
      const duty = stat && stat.totalTime > 0 ? Math.round((stat.highTime / stat.totalTime) * 100) : isSignalNonZero(targetWire.signal) ? 100 : 0;
      $('probe-duty-val')!.textContent = `${duty}%`;
      $('probe-edges-val')!.textContent = String(stat ? stat.edges : 0);

      const mc = $('probe-mini-canvas') as HTMLCanvasElement | null;
      const mctx = mc?.getContext('2d');
      if (mc && mctx) {
        mctx.clearRect(0, 0, mc.width, mc.height);
        if (stat && stat.history.length > 1) {
          mctx.strokeStyle = CANVAS_THEMES[state.theme].sig1;
          mctx.lineWidth = 2;
          mctx.beginPath();
          stat.history.forEach((v, i) => {
            const x = (i / (stat.history.length - 1)) * mc.width;
            const y = v === 1 ? 10 : mc.height - 10;
            if (i === 0) mctx.moveTo(x, y);
            else {
              const prevY = stat.history[i - 1] === 1 ? 10 : mc.height - 10;
              mctx.lineTo(x, prevY);
              mctx.lineTo(x, y);
            }
          });
          mctx.stroke();
        }
      }
    } else if (targetPin) {
      const sig = targetPin.comp.pinValues[targetPin.pinId] ?? 0;
      const pw = targetPin.width || 1;
      $('probe-target-name')!.textContent = `${targetPin.label || targetPin.pinId} (${pw}b)`;
      $('probe-state-val')!.textContent = pw > 1 ? formatSignalHex(sig, pw) : String(sig);
      $('probe-freq-val')!.textContent = '--';
      $('probe-duty-val')!.textContent = isSignalNonZero(sig) ? '100%' : '0%';
      $('probe-edges-val')!.textContent = '--';
    }
  }

  function stepSimulation(dt: number, forceManualPulse = false): boolean {
    if (!state.simRunning && !forceManualPulse) return false;

    if (forceManualPulse) {
      for (const c of state.components) {
        if (c.type === 'CLOCK') {
          c.internalState.clockOut = c.internalState.clockOut === 1 ? 0 : 1;
        }
      }
      evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
      recordAnalyzerSample();
      markDirty(250);
      return true;
    }

    const eco = isEcoMode();
    const mult = state.clockMultiplier || 1;
    state.simTime += dt;
    let simChanged = false;

    if (mult >= 1000) {
      // Modo TURBO para CPU, VGA, Anim32 y DOOM Raycaster (respeta presupuesto configurable)
      const clocks = state.components.filter(c => c.type === 'CLOCK');
      const hasRaster = state.components.some(
        c => c.type === 'RAYCAST_CORE' || c.type === 'VGA_SCREEN' || c.type === 'ANIM32_GPU'
      );
      const maxCyc = Math.max(64, SETTINGS.turboMaxCycles ?? (hasRaster ? 512 : 256));
      const targetCycles = eco ? Math.min(maxCyc, hasRaster ? 256 : 128) : maxCyc;
      const budgetMs = SETTINGS.perfProfile === 'potato' ? 3 : eco ? 4 : 8;
      const t0 = performance.now();
      for (let i = 0; i < targetCycles; i++) {
        for (const clk of clocks) clk.internalState.clockOut = 0;
        solveNetwork(state.components, state.wires, false, state.customICs);
        evaluateSequentialEdges(state.components);

        for (const clk of clocks) clk.internalState.clockOut = 1;
        solveNetwork(state.components, state.wires, false, state.customICs);
        if (evaluateSequentialEdges(state.components)) {
          solveNetwork(state.components, state.wires, false, state.customICs);
        }
        if ((i & 31) === 31 && performance.now() - t0 > budgetMs) break;
      }
      simChanged = clocks.length > 0;
      if (simChanged) markDirty(120);
    } else if (mult > 1) {
      const subDt = dt / mult;
      for (let i = 0; i < mult; i++) {
        if (advanceClocks(state.components, subDt, state.globalClockHz)) simChanged = true;
        solveNetwork(state.components, state.wires, false, state.customICs);
        if (evaluateSequentialEdges(state.components)) {
          simChanged = true;
          solveNetwork(state.components, state.wires, false, state.customICs);
        }
      }
      if (simChanged) markDirty(120);
    } else {
      simChanged = evaluateCircuitDeterministic(state.components, state.wires, dt, state.globalClockHz, state.customICs);
    }

    for (const c of state.components) {
      if (c.type === 'BUZZER' && c.pinValues.in0 === 1) {
        soundFX.playBuzzer(c.buzzerHz || 440);
      } else if (c.type === 'TONE_GEN' && bit(c.pinValues.gate) === 1) {
        const hz = Number(toUintN(c.pinValues.freq, 12));
        if (hz >= 20) {
          const waves: OscillatorType[] = ['square', 'sawtooth', 'triangle', 'sine'];
          const wIdx = Number(toUintN(c.pinValues.wave, 2)) & 3;
          soundFX.playBuzzer(hz, waves[wIdx]);
        }
      }
    }

    state.oscillationTickTimer += dt;
    if (state.oscillationTickTimer >= 0.08) {
      state.oscillationTickTimer = 0;
      const hasOsc = state.components.some(c => c.unstable);
      if (hasOsc) {
        for (const c of state.components) {
          if (c.unstable && c.type === 'NOT') {
            c.pinValues.out = c.pinValues.out === 1 ? 0 : 1;
          }
        }
        solveNetwork(state.components, state.wires, false, state.customICs);
        simChanged = true;
      }
    }

    updateProbeStats(dt);
    state.analyzerTimer += dt;
    const analyzerInterval = eco ? 0.12 : 0.045;
    if (state.analyzerTimer >= analyzerInterval) {
      state.analyzerTimer = 0;
      if (!state.analyzerPaused && state.analyzerOpen) recordAnalyzerSample();
    }
    if (state.probeMode) updateProbeHUD();
    return simChanged;
  }

  // =========================================================================
  // RENDERIZADO PRINCIPAL Y MINIMAPA
  // =========================================================================
  const RS = { dirty: true, until: 0, miniAt: 0, w: 0, h: 0, ro: null as ResizeObserver | boolean | null };
  function markDirty(ms = 0): void {
    RS.dirty = true;
    if (ms) RS.until = Math.max(RS.until, performance.now() + ms);
  }

  function setShadows(ctx: CanvasRenderingContext2D, on: boolean): void {
    const c = ctx as CanvasRenderingContext2D & { __noShadow?: boolean };
    if (on) {
      if (c.__noShadow) {
        delete (ctx as unknown as { shadowBlur?: number }).shadowBlur;
        c.__noShadow = false;
      }
    } else if (!c.__noShadow) {
      const desc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
      desc?.set?.call(ctx, 0);
      Object.defineProperty(ctx, 'shadowBlur', {
        configurable: true,
        get() {
          return 0;
        },
        set() {}
      });
      c.__noShadow = true;
    }
  }

  function renderMinimap(viewW: number, viewH: number): void {
    if (!SETTINGS.showMinimap) return;
    const ctx = minimapCtx;
    const mw = minimapCanvas.width;
    const mh = minimapCanvas.height;
    const th = CANVAS_THEMES[state.theme];

    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, mw, mh);
    if (state.components.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of state.components) {
      minX = Math.min(minX, c.x - 80);
      minY = Math.min(minY, c.y - 80);
      maxX = Math.max(maxX, c.x + 80);
      maxY = Math.max(maxY, c.y + 80);
    }
    const cw = Math.max(400, maxX - minX);
    const ch = Math.max(300, maxY - minY);
    const scale = Math.min((mw - 12) / cw, (mh - 12) / ch);
    const ox = (mw - cw * scale) / 2 - minX * scale;
    const oy = (mh - ch * scale) / 2 - minY * scale;

    for (const c of state.components) {
      ctx.fillStyle = state.selectedIds.has(c.id) ? th.sig1 : th.compStroke;
      ctx.fillRect(
        ox + (c.x - c.w / 2) * scale,
        oy + (c.y - c.h / 2) * scale,
        Math.max(3, c.w * scale),
        Math.max(2, c.h * scale)
      );
    }

    const topLeft = screenToWorld(0, 0);
    const botRight = screenToWorld(viewW, viewH);
    ctx.strokeStyle = th.sig1;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(
      ox + topLeft.x * scale,
      oy + topLeft.y * scale,
      (botRight.x - topLeft.x) * scale,
      (botRight.y - topLeft.y) * scale
    );
  }

  function syncCanvasBounds(): void {
    const wrap = $('canvas-wrapper');
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const cw = Math.round(wrap.clientWidth || rect.width);
    const ch = Math.round(wrap.clientHeight || rect.height);
    if (cw > 0 && ch > 0 && (cw !== RS.w || ch !== RS.h)) {
      RS.w = cw;
      RS.h = ch;
    }
  }

  function renderMainCanvas(): void {
    const wrap = $('canvas-wrapper');
    if (!wrap) return;
    if (!RS.ro) {
      syncCanvasBounds();
      if (window.ResizeObserver) {
        RS.ro = new ResizeObserver(() => {
          syncCanvasBounds();
          markDirty(250);
        });
        RS.ro.observe(wrap);
      } else {
        RS.ro = true;
      }
    } else {
      syncCanvasBounds();
    }
    const W = RS.w;
    const H = RS.h;
    if (W <= 0 || H <= 0) return;

    const now = performance.now();
    const eco = isEcoMode();
    const q = SETTINGS.quality;
    const fast = eco || q === 'low' || now - FX.lastInteract < 140 || state.mode === 'PANNING' || state.view.targetX !== null;
    const glow = eco ? false : q === 'high' ? true : q === 'low' ? false : !(FX.degraded || fast);
    const lowRes = eco || q === 'low' || (q === 'auto' && FX.degraded && FX.ema > 40);
    const dpr = Math.min(window.devicePixelRatio || 1, eco ? 1 : lowRes ? 1.25 : 2);
    const bw = Math.floor(W * dpr);
    const bh = Math.floor(H * dpr);
    if (mainCanvas.width !== bw || mainCanvas.height !== bh) {
      mainCanvas.width = bw;
      mainCanvas.height = bh;
    }

    const ctx = mainCtx;
    const th = CANVAS_THEMES[state.theme];
    setShadows(ctx, glow);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, W, H);

    if (SETTINGS.showGrid !== false) {
      let step = 20 * state.view.zoom;
      while (step < (eco ? 36 : 12) || (W / step) * (H / step) > (eco ? 900 : 2600)) step *= 2;
      const offsetX = ((state.view.x % step) + step) % step;
      const offsetY = ((state.view.y % step) + step) % step;
      ctx.fillStyle = th.gridDot;
      ctx.beginPath();
      for (let gx = offsetX; gx < W; gx += step) {
        for (let gy = offsetY; gy < H; gy += step) {
          ctx.rect(gx - 1, gy - 1, 2, 2);
        }
      }
      ctx.fill();
    }

    ctx.translate(state.view.x, state.view.y);
    ctx.scale(state.view.zoom, state.view.zoom);
    const z = state.view.zoom;
    const vis = {
      x0: -state.view.x / z - 80,
      y0: -state.view.y / z - 80,
      x1: (W - state.view.x) / z + 80,
      y1: (H - state.view.y) / z + 80
    };

    ctx.strokeStyle = th.gridAxis;
    ctx.lineWidth = 1 / z;
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.lineTo(40, 0);
    ctx.moveTo(0, -40);
    ctx.lineTo(0, 40);
    ctx.stroke();

    if (state.snapGuides.length > 0) {
      ctx.save();
      ctx.strokeStyle = th.sig1;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1 / z;
      ctx.setLineDash([4 / z, 4 / z]);
      ctx.beginPath();
      for (const g of state.snapGuides) {
        if (g.axis === 'x') {
          ctx.moveTo(g.pos, vis.y0);
          ctx.lineTo(g.pos, vis.y1);
        } else {
          ctx.moveTo(vis.x0, g.pos);
          ctx.lineTo(vis.x1, g.pos);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    const rView: RenderStateView = {
      theme: state.theme,
      components: state.components,
      wires: state.wires,
      selectedIds: state.selectedIds,
      selectedWireId: state.selectedWireId,
      view: state.view,
      simRunning: state.simRunning,
      simTime: state.simTime,
      wireStyle: state.wireStyle,
      wireVisibility: state.wireVisibility,
      mode: state.mode,
      wiringFrom: state.wiringFrom,
      mouseWorld: state.mouseWorld,
      snapPin: state.snapPin,
      hoveredPin: state.hoveredPin,
      hoveredWire: state.hoveredWire,
      marqueeRect: state.marqueeRect,
      ripples: state.ripples,
      sparks: state.sparks,
      snapGuides: state.snapGuides
    };

    drawComponentGroups(ctx, rView);
    drawWires(ctx, rView, SETTINGS, vis, fast);

    for (const comp of state.components) {
      const m = Math.max(comp.w, comp.h) / 2 + 40;
      if (comp.x + m < vis.x0 || comp.x - m > vis.x1 || comp.y + m < vis.y0 || comp.y - m > vis.y1) continue;
      drawComponent(ctx, comp, state.theme, state.selectedIds, state.snapPin, state.hoveredPin, z, lowRes);
    }

    for (const r of state.ripples) {
      ctx.save();
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = Math.max(0, r.alpha);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const s of state.sparks) {
      ctx.save();
      ctx.fillStyle = s.color;
      ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawPinTooltip(ctx, rView);

    if (state.mode === 'MARQUEE' && state.marqueeRect) {
      const r = state.marqueeRect;
      ctx.fillStyle = 'rgba(0, 245, 212, 0.1)';
      ctx.strokeStyle = th.sig1;
      ctx.lineWidth = 1.2 / z;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }

    ctx.restore();
    if (now - RS.miniAt > (eco ? 450 : 110)) {
      RS.miniAt = now;
      renderMinimap(W, H);
    }
  }

  function renderAnalyzerCanvas(): void {
    if (!state.analyzerOpen) return;
    const wrap = analyzerCanvas.parentElement;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = isEcoMode() ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    if (
      analyzerCanvas.width !== Math.floor(rect.width * dpr) ||
      analyzerCanvas.height !== Math.floor(rect.height * dpr)
    ) {
      analyzerCanvas.width = Math.floor(rect.width * dpr);
      analyzerCanvas.height = Math.floor(rect.height * dpr);
    }

    const ctx = analyzerCtx;
    ctx.save();
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;
    const th = CANVAS_THEMES[state.theme];

    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, W, H);

    const channels = getMonitoredChannels();
    const countEl = $('analyzer-channel-count');
    if (countEl) countEl.textContent = `${channels.length} canal(es)`;

    if (channels.length === 0) {
      ctx.fillStyle = th.subText;
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Añade un Reloj, Interruptor, LED o Nodo Sonda para visualizar las ondas digitales en tiempo real', W / 2, H / 2);
      ctx.restore();
      return;
    }

    const labelColW = 128;
    const rowH = H / channels.length;

    channels.forEach((ch, idx) => {
      const yTop = idx * rowH;
      const color = CHANNEL_COLORS[idx % CHANNEL_COLORS.length];

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, yTop + rowH);
      ctx.lineTo(W, yTop + rowH);
      ctx.stroke();

      ctx.fillStyle = th.compText;
      ctx.font = '700 11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch.name.slice(0, 12), 10, yTop + rowH / 2);

      ctx.fillStyle = ch.val === 1 ? color : th.subText;
      ctx.fillText(String(ch.val), labelColW - 22, yTop + rowH / 2);

      const samples = state.analyzerSamples;
      if (samples.length > 1) {
        const plotW = W - labelColW - 12;
        const highY = yTop + 6;
        const lowY = yTop + rowH - 6;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        samples.forEach((s, si) => {
          const v = s[ch.id] === 1 ? 1 : 0;
          const x = labelColW + (si / (state.maxAnalyzerSamples - 1)) * plotW;
          const y = v === 1 ? highY : lowY;
          if (si === 0) ctx.moveTo(x, y);
          else {
            const prevV = samples[si - 1][ch.id] === 1 ? 1 : 0;
            const prevY = prevV === 1 ? highY : lowY;
            ctx.lineTo(x, prevY);
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
      }
    });

    ctx.restore();
  }

  // =========================================================================
  // BIBLIOTECA DE COMPONENTES
  // =========================================================================
  const thumbCache = new Map<string, string | null>();
  const thumbQueue: Array<{ type: string; badgeEl: HTMLElement }> = [];
  let thumbPumpId = 0;

  function libThumb(type: string): string | null {
    if (type === 'CUSTOM_IC') return null;
    const key = `${state.theme}|${type}`;
    if (thumbCache.has(key)) return thumbCache.get(key) || null;
    let url: string | null = null;
    try {
      const c = createComponent(type, 0, 0, { noAnim: true });
      const cw = 84;
      const ch = 56;
      const dpr = 1;
      const cv = document.createElement('canvas');
      cv.width = cw * dpr;
      cv.height = ch * dpr;
      const cx = cv.getContext('2d');
      if (cx) {
        cx.scale(dpr, dpr);
        cx.translate(cw / 2, ch / 2);
        const k = Math.min(1, (cw - 6) / (c.w + 16), (ch - 4) / (c.h + 14));
        cx.scale(k, k);
        drawComponent(cx, c, state.theme, new Set(), null, null, 1, isEcoMode());
        url = cv.toDataURL();
      }
    } catch {
      url = null;
    }
    thumbCache.set(key, url);
    return url;
  }

  function pumpThumbQueue(): void {
    thumbPumpId = 0;
    const batch = 8;
    let done = 0;
    while (thumbQueue.length > 0 && done < batch) {
      const job = thumbQueue.shift()!;
      if (!job.badgeEl.isConnected) continue;
      const url = libThumb(job.type);
      if (url) {
        const img = document.createElement('img');
        img.className = 'lib-thumb';
        img.src = url;
        img.alt = '';
        img.draggable = false;
        job.badgeEl.replaceWith(img);
      }
      done++;
    }
    if (thumbQueue.length > 0) {
      thumbPumpId = requestAnimationFrame(pumpThumbQueue);
    }
  }

  function saveFavorites(): void {
    try {
      localStorage.setItem(FAVS_KEY, JSON.stringify([...state.favoriteTypes]));
    } catch {
      // ignore
    }
  }

  function pushRecentType(type: string): void {
    if (type === 'CUSTOM_IC') return;
    state.recentTypes = [type, ...state.recentTypes.filter(t => t !== type)].slice(0, 6);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(state.recentTypes));
    } catch {
      // ignore
    }
    renderRecentStrip();
  }

  function renderRecentStrip(): void {
    const strip = $('lib-recent-strip');
    if (!strip) return;
    if (state.recentTypes.length === 0) {
      strip.classList.add('hidden');
      strip.innerHTML = '';
      return;
    }
    strip.classList.remove('hidden');
    strip.innerHTML =
      `<span style="font-size:9.5px; color:var(--text-muted); font-weight:700;">Recientes:</span>` +
      state.recentTypes
        .map(t => {
          const m = COMPONENT_CATALOG.find(c => c.type === t);
          if (!m) return '';
          return `<button type="button" class="lib-recent-chip mono" data-rectype="${t}" title="Añadir ${m.name}">${m.badge || m.type}</button>`;
        })
        .join('');
    strip.querySelectorAll<HTMLElement>('[data-rectype]').forEach(btn => {
      btn.onclick = () => {
        const wrap = $('canvas-wrapper')!.getBoundingClientRect();
        const cw = screenToWorld(wrap.width / 2 + (Math.random() - 0.5) * 40, wrap.height / 2 + (Math.random() - 0.5) * 40);
        addComponentToCanvas(btn.dataset.rectype!, cw.x, cw.y);
      };
    });
  }

  function renderComponentLibrary(): void {
    const container = $('library-container');
    const searchEl = $<HTMLInputElement>('component-search');
    if (!container || !searchEl) return;
    const query = (searchEl.value || '').trim().toLowerCase();
    const prevScroll = container.scrollTop;
    container.innerHTML = '';
    let shownCats = 0;

    renderRecentStrip();

    for (const cat of CATEGORIES) {
      if (state.catFilter !== 'ALL' && cat !== state.catFilter) continue;

      let items: Array<{ type: string; icDefId?: string; badge: string; name: string; scalableBits?: boolean; defaultBits?: number }> = [];
      if (cat === 'Mis Chips (IC)') {
        items = state.customICs.map(ic => ({
          type: 'CUSTOM_IC',
          icDefId: ic.id,
          badge: 'IC',
          name: ic.name
        }));
      } else {
        items = COMPONENT_CATALOG.filter(c => c.cat === cat);
      }

      if (state.favsOnly) {
        items = items.filter(it => state.favoriteTypes.has(it.type));
      }

      if (query) {
        items = items.filter(
          it =>
            it.name.toLowerCase().includes(query) ||
            it.badge.toLowerCase().includes(query) ||
            it.type.toLowerCase().includes(query)
        );
      }

      if (items.length === 0 && (cat !== 'Mis Chips (IC)' || state.favsOnly || query)) continue;

      const isCollapsed = state.collapsedCats.has(cat) && !query && !state.favsOnly && state.catFilter === 'ALL';
      const box = document.createElement('div');
      box.className = 'lib-category';

      const header = document.createElement('button');
      header.className = 'lib-cat-header';
      header.innerHTML = `<span>${cat} (${items.length})</span><span class="chev ${isCollapsed ? '' : 'open'}">▸</span>`;
      header.setAttribute('aria-expanded', String(!isCollapsed));
      header.onclick = () => {
        if (state.collapsedCats.has(cat)) {
          state.collapsedCats.delete(cat);
          state.animCat = cat;
        } else {
          state.collapsedCats.add(cat);
        }
        renderComponentLibrary();
      };
      box.appendChild(header);

      if (!isCollapsed) {
        const grid = document.createElement('div');
        grid.className = 'lib-cat-grid' + (state.animCat === cat ? ' anim' : '');

        if (items.length === 0 && cat === 'Mis Chips (IC)') {
          const emptyMsg = document.createElement('div');
          emptyMsg.style.cssText = 'grid-column:1/-1; font-size:10.5px; color:var(--text-muted); padding:4px; text-align:center;';
          emptyMsg.textContent = 'Usa "Crear IC" en la barra superior para guardar bloques.';
          grid.appendChild(emptyMsg);
        } else {
          for (const it of items) {
            const card = document.createElement('div');
            card.className = 'lib-item';
            card.draggable = true;
            const cacheKey = `${state.theme}|${it.type}`;
            const cachedThumb = it.type !== 'CUSTOM_IC' && thumbCache.has(cacheKey) ? thumbCache.get(cacheKey) || null : null;
            card.title = it.name;
            const defB = SETTINGS.defaultBitWidth || it.defaultBits || 8;
            const shownB = it.type === 'LED_BAR_8' ? (defB >= 16 ? 16 : 8) : it.type === 'DIP_SWITCH' ? Math.max(4, Math.min(16, defB)) : defB;
            const widthBadge = it.scalableBits ? `<span class="lib-item-width mono">${shownB}b</span>` : '';
            const isFav = state.favoriteTypes.has(it.type);
            const favBtn = it.type !== 'CUSTOM_IC'
              ? `<button type="button" class="lib-fav-btn ${isFav ? 'active' : ''}" data-fav="${it.type}" aria-label="Favorito ${it.name}" title="${isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}">${isFav ? '★' : '☆'}</button>`
              : '';
            card.innerHTML = cachedThumb
              ? `${favBtn}${widthBadge}<img class="lib-thumb" src="${cachedThumb}" alt="" draggable="false"><span class="lib-item-name">${it.name}</span>`
              : `${favBtn}${widthBadge}<span class="lib-item-badge mono">${it.badge}</span><span class="lib-item-name">${it.name}</span>`;
            const favEl = card.querySelector<HTMLElement>('[data-fav]');
            if (favEl) {
              favEl.onclick = ev => {
                ev.stopPropagation();
                if (state.favoriteTypes.has(it.type)) state.favoriteTypes.delete(it.type);
                else state.favoriteTypes.add(it.type);
                saveFavorites();
                renderComponentLibrary();
              };
            }
            if (!cachedThumb && it.type !== 'CUSTOM_IC') {
              const badgeEl = card.querySelector('.lib-item-badge') as HTMLElement | null;
              if (badgeEl) thumbQueue.push({ type: it.type, badgeEl });
            }
            card.ondragstart = e => {
              e.dataTransfer?.setData('application/json', JSON.stringify({ type: it.type, icDefId: it.icDefId || null }));
            };
            card.onclick = () => {
              const wrap = $('canvas-wrapper')!.getBoundingClientRect();
              const cw = screenToWorld(wrap.width / 2 + (Math.random() - 0.5) * 40, wrap.height / 2 + (Math.random() - 0.5) * 40);
              addComponentToCanvas(it.type, cw.x, cw.y, { icDefId: it.icDefId || null });
            };
            grid.appendChild(card);
          }
          if (thumbQueue.length > 0 && !thumbPumpId) {
            thumbPumpId = requestAnimationFrame(pumpThumbQueue);
          }
        }
        box.appendChild(grid);
      }

      container.appendChild(box);
      shownCats++;
    }
    state.animCat = null;
    if (shownCats === 0) {
      const none = document.createElement('div');
      none.className = 'lib-empty';
      none.textContent = state.favsOnly
        ? 'No tienes componentes favoritos todavía (pulsa ☆ en cualquier bloque).'
        : `Sin resultados para "${query}"`;
      container.appendChild(none);
    }
    container.scrollTop = prevScroll;
  }

  function setLibraryHidden(hide: boolean): void {
    $('sidebar-left')?.classList.toggle('collapsed', hide);
    $('btn-lib-show')?.classList.toggle('show', hide);
  }

  // =========================================================================
  // HISTORIAL Y EDICIÓN
  // =========================================================================
  function updateStatusBar(): void {
    const el = $('status-counts');
    if (el) el.textContent = `${state.components.length} componentes • ${state.wires.length} cables`;
  }

  function updateHistoryButtons(): void {
    const u = $<HTMLButtonElement>('btn-undo');
    const r = $<HTMLButtonElement>('btn-redo');
    if (u) u.disabled = state.historyIndex <= 0;
    if (r) r.disabled = state.historyIndex >= state.history.length - 1;
  }

  function saveHistorySnapshot(): void {
    const snap = serializeCircuitData({
      components: state.components,
      wires: state.wires,
      customICs: state.customICs
    });
    if (state.history[state.historyIndex] === snap) return;
    scheduleAutosave(snap);
    if (state.historyIndex < state.history.length - 1) {
      state.history = state.history.slice(0, state.historyIndex + 1);
    }
    state.history.push(snap);
    const maxHist = isEcoMode() || state.components.some(c => (c.internalState.mem?.length || 0) >= 4096) ? 15 : 45;
    while (state.history.length > maxHist) state.history.shift();
    state.historyIndex = state.history.length - 1;
    updateHistoryButtons();
    updateStatusBar();
  }

  function restoreSnapshot(snapStr: string): void {
    const data = deserializeCircuitData<{
      components?: LogicComponent[];
      wires?: Wire[];
      customICs?: CustomICDef[];
    }>(snapStr);
    state.components = data.components || [];
    state.wires = data.wires || [];
    if (data.customICs) state.customICs = data.customICs;
    state.selectedIds.clear();
    state.selectedWireId = null;
    evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
    renderComponentLibrary();
    updateInspector();
    updateHistoryButtons();
    updateStatusBar();
    markDirty(300);
  }

  function undo(): void {
    if (state.historyIndex <= 0) return;
    state.historyIndex--;
    restoreSnapshot(state.history[state.historyIndex]);
    showToast('Deshecho');
  }

  function redo(): void {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex++;
    restoreSnapshot(state.history[state.historyIndex]);
    showToast('Rehecho');
  }

  function addComponentToCanvas(
    type: string,
    wx: number,
    wy: number,
    options: Parameters<typeof createComponent>[3] = {}
  ): void {
    const meta = COMPONENT_CATALOG.find(m => m.type === type);
    const opts = { ...options, customICs: state.customICs, noAnim: options.noAnim ?? isEcoMode() };
    if (meta?.scalableBits && opts.bits === undefined) {
      opts.bits = SETTINGS.defaultBitWidth || meta.defaultBits || 8;
    }
    const comp = createComponent(type, wx, wy, opts);
    state.components.push(comp);
    state.selectedIds = new Set([comp.id]);
    state.selectedWireId = null;
    pushRecentType(type);
    spawnRipple(comp.x, comp.y);
    soundFX.playPop(780);
    evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
    saveHistorySnapshot();
    updateInspector();
    updateStatusBar();
    markDirty(300);
  }

  function deleteSelection(): void {
    if (state.selectedWireId) {
      state.wires = state.wires.filter(w => w.id !== state.selectedWireId);
      state.selectedWireId = null;
      soundFX.playClick(false);
      evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
      saveHistorySnapshot();
      updateInspector();
      markDirty(250);
      return;
    }
    if (state.selectedIds.size > 0) {
      for (const id of state.selectedIds) {
        const c = state.components.find(x => x.id === id);
        if (c) spawnSparks(c.x, c.y);
      }
      state.components = state.components.filter(c => !state.selectedIds.has(c.id));
      state.wires = state.wires.filter(w => !state.selectedIds.has(w.fromCompId) && !state.selectedIds.has(w.toCompId));
      state.selectedIds.clear();
      soundFX.playClick(false);
      evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
      saveHistorySnapshot();
      updateInspector();
      markDirty(250);
    }
  }

  function spawnClones(srcComps: LogicComponent[], srcWires: Wire[], offset: number): void {
    const idMap = new Map<string, string>();
    const groupIdMap = new Map<string, string>();
    const newComps: LogicComponent[] = [];
    for (const orig of srcComps) {
      const clone = deserializeCircuitData<LogicComponent>(serializeCircuitData(orig, false));
      clone.id = genId('c');
      if (orig.groupId) {
        let mappedGrp = groupIdMap.get(orig.groupId);
        if (!mappedGrp) {
          mappedGrp = genId('grp');
          groupIdMap.set(orig.groupId, mappedGrp);
        }
        clone.groupId = mappedGrp;
      }
      clone.x += offset;
      clone.y += offset;
      clone.spawnScale = 0.2;
      clone.spawnVel = 8.5;
      if (clone.type === 'CUSTOM_IC') {
        const def = state.customICs.find(d => d.id === clone.icDefId) || clone.icSnapshot;
        if (def) clone.internalState.subState = cloneCleanSubNetlist(def.netlist);
      }
      idMap.set(orig.id, clone.id);
      newComps.push(clone);
    }
    const newWires: Wire[] = srcWires
      .filter(w => idMap.has(w.fromCompId) && idMap.has(w.toCompId))
      .map(w => ({
        id: genId('w'),
        fromCompId: idMap.get(w.fromCompId)!,
        fromPinId: w.fromPinId,
        toCompId: idMap.get(w.toCompId)!,
        toPinId: w.toPinId,
        signal: 0,
        width: w.width,
        curveOffset: w.curveOffset,
        waypoints: w.waypoints ? w.waypoints.map(pt => ({ ...pt })) : undefined,
        customColor: w.customColor
      }));
    state.components.push(...newComps);
    state.wires.push(...newWires);
    state.selectedIds = new Set(newComps.map(c => c.id));
    state.selectedWireId = null;
    soundFX.playPop(720);
    evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
    saveHistorySnapshot();
    updateInspector();
    updateStatusBar();
    markDirty(300);
  }

  function duplicateSelection(): void {
    if (state.selectedIds.size === 0) return;
    const comps = state.components.filter(c => state.selectedIds.has(c.id));
    spawnClones(comps, state.wires, 24);
  }

  const GROUP_COLORS = ['#00f5d4', '#38bdf8', '#a855f7', '#f59e0b', '#10b981', '#f43f5e'];
  const WIRE_COLORS = ['#00f5d4', '#38bdf8', '#10b981', '#f59e0b', '#f43f5e', '#a855f7'];

  function groupSelection(customName?: string): void {
    const comps = state.components.filter(c => state.selectedIds.has(c.id));
    if (comps.length < 2) {
      showToast('Selecciona 2 o más componentes para agruparlos', 'warn');
      return;
    }
    const existingGroups = new Set(state.components.map(c => c.groupId).filter(Boolean));
    const gid = genId('grp');
    const gname = (customName || `Módulo ${existingGroups.size + 1}`).trim();
    const gcolor = GROUP_COLORS[existingGroups.size % GROUP_COLORS.length];
    comps.forEach(c => {
      c.groupId = gid;
      c.groupName = gname;
      c.groupColor = gcolor;
    });
    soundFX.playPop(820);
    saveHistorySnapshot();
    updateInspector();
    markDirty(250);
    showToast(`Grupo "${gname}" creado (${comps.length} elementos)`);
  }

  function ungroupSelection(): void {
    const comps = state.components.filter(c => state.selectedIds.has(c.id) && c.groupId);
    if (comps.length === 0) {
      showToast('Los elementos seleccionados no pertenecen a ningún grupo', 'warn');
      return;
    }
    comps.forEach(c => {
      delete c.groupId;
      delete c.groupName;
      delete c.groupColor;
    });
    soundFX.playClick(false);
    saveHistorySnapshot();
    updateInspector();
    markDirty(250);
    showToast(`Desagrupados ${comps.length} componente(s)`);
  }

  function copySelection(cut = false): void {
    if (state.selectedIds.size === 0) return;
    const comps = state.components.filter(c => state.selectedIds.has(c.id));
    const wires = state.wires.filter(w => state.selectedIds.has(w.fromCompId) && state.selectedIds.has(w.toCompId));
    state.clipboard = deserializeCircuitData(serializeCircuitData({ comps, wires }, false));
    state.pasteOffsetCount = 0;
    showToast(cut ? 'Cortado' : `Copiado (${comps.length})`);
    if (cut) deleteSelection();
  }

  function pasteClipboard(): void {
    if (!state.clipboard || !state.clipboard.comps.length) {
      showToast('Portapapeles vacío', 'warn');
      return;
    }
    state.pasteOffsetCount++;
    spawnClones(state.clipboard.comps, state.clipboard.wires, 24 * state.pasteOffsetCount);
  }

  function rotateSelection(dir = 1): void {
    const cs = state.components.filter(c => state.selectedIds.has(c.id) && c.type !== 'LABEL');
    if (!cs.length) return;
    cs.forEach(c => {
      c.rot = (((c.rot || 0) + dir) % 4 + 4) % 4;
    });
    soundFX.playClick(true);
    saveHistorySnapshot();
    markDirty(250);
  }

  function flipSelection(): void {
    const cs = state.components.filter(c => state.selectedIds.has(c.id) && c.type !== 'LABEL');
    if (!cs.length) return;
    cs.forEach(c => {
      c.flip = !c.flip;
    });
    soundFX.playClick(true);
    saveHistorySnapshot();
    markDirty(250);
  }

  function alignSelection(mode: string): void {
    const cs = state.components.filter(c => state.selectedIds.has(c.id));
    if (cs.length < 2) return;
    const ext = (c: LogicComponent) => {
      const o = (c.rot || 0) % 2 === 1;
      return { hw: (o ? c.h : c.w) / 2, hh: (o ? c.w : c.h) / 2 };
    };
    const minL = Math.min(...cs.map(c => c.x - ext(c).hw));
    const maxR = Math.max(...cs.map(c => c.x + ext(c).hw));
    const minT = Math.min(...cs.map(c => c.y - ext(c).hh));
    const maxB = Math.max(...cs.map(c => c.y + ext(c).hh));
    const g = (v: number) => Math.round(v / 10) * 10;

    if (mode === 'dist-h' || mode === 'dist-v') {
      if (cs.length < 3) {
        showToast('Distribuir necesita 3 o más componentes', 'warn');
        return;
      }
      const key = mode === 'dist-h' ? 'x' : 'y';
      cs.sort((a, b) => a[key] - b[key]);
      const first = cs[0][key];
      const step = (cs[cs.length - 1][key] - first) / (cs.length - 1);
      cs.forEach((c, i) => {
        c[key] = g(first + i * step);
      });
    } else {
      cs.forEach(c => {
        const e = ext(c);
        if (mode === 'left') c.x = g(minL + e.hw);
        else if (mode === 'right') c.x = g(maxR - e.hw);
        else if (mode === 'hcenter') c.x = g((minL + maxR) / 2);
        else if (mode === 'top') c.y = g(minT + e.hh);
        else if (mode === 'bottom') c.y = g(maxB - e.hh);
        else if (mode === 'vcenter') c.y = g((minT + maxB) / 2);
      });
    }
    soundFX.playPop(640);
    saveHistorySnapshot();
    markDirty(250);
  }

  function nudgeSelection(dx: number, dy: number): void {
    if (state.selectedIds.size === 0) return;
    for (const c of state.components) {
      if (state.selectedIds.has(c.id)) {
        c.x += dx;
        c.y += dy;
      }
    }
    markDirty(200);
    clearTimeout(state.nudgeTimer);
    state.nudgeTimer = setTimeout(saveHistorySnapshot, 350);
  }

  function centerAndFitView(): void {
    const wrap = $('canvas-wrapper')?.getBoundingClientRect();
    if (!wrap) return;
    if (state.components.length === 0) {
      state.view.targetX = wrap.width / 2;
      state.view.targetY = wrap.height / 2;
      state.view.targetZoom = 1;
      markDirty(400);
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of state.components) {
      minX = Math.min(minX, c.x - c.w / 2 - 40);
      minY = Math.min(minY, c.y - c.h / 2 - 40);
      maxX = Math.max(maxX, c.x + c.w / 2 + 40);
      maxY = Math.max(maxY, c.y + c.h / 2 + 40);
    }
    const cw = Math.max(200, maxX - minX);
    const ch = Math.max(160, maxY - minY);
    const targetZoom = Math.max(0.35, Math.min(1.25, Math.min((wrap.width - 80) / cw, (wrap.height - 80) / ch)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    state.view.targetZoom = targetZoom;
    state.view.targetX = wrap.width / 2 - cx * targetZoom;
    state.view.targetY = wrap.height / 2 - cy * targetZoom;
    markDirty(400);
  }

  function zoomToSelection(): void {
    const wrap = $('canvas-wrapper')?.getBoundingClientRect();
    if (!wrap) return;
    let targetComps = state.components.filter(c => state.selectedIds.has(c.id));
    if (targetComps.length === 0 && state.selectedWireId) {
      const w = state.wires.find(x => x.id === state.selectedWireId);
      if (w) {
        targetComps = state.components.filter(c => c.id === w.fromCompId || c.id === w.toCompId);
      }
    }
    if (targetComps.length === 0) {
      centerAndFitView();
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of targetComps) {
      minX = Math.min(minX, c.x - c.w / 2 - 50);
      minY = Math.min(minY, c.y - c.h / 2 - 50);
      maxX = Math.max(maxX, c.x + c.w / 2 + 50);
      maxY = Math.max(maxY, c.y + c.h / 2 + 50);
    }
    const cw = Math.max(160, maxX - minX);
    const ch = Math.max(120, maxY - minY);
    const targetZoom = Math.max(0.45, Math.min(1.65, Math.min((wrap.width - 80) / cw, (wrap.height - 80) / ch)));
    state.view.targetZoom = targetZoom;
    state.view.targetX = wrap.width / 2 - ((minX + maxX) / 2) * targetZoom;
    state.view.targetY = wrap.height / 2 - ((minY + maxY) / 2) * targetZoom;
    markDirty(350);
  }

  function disconnectPinWires(compId: string, pinId: string): void {
    const before = state.wires.length;
    state.wires = state.wires.filter(
      w => !((w.fromCompId === compId && w.fromPinId === pinId) || (w.toCompId === compId && w.toPinId === pinId))
    );
    if (state.wires.length !== before) {
      evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
      saveHistorySnapshot();
      updateInspector();
      markDirty(250);
      showToast('Pin desconectado');
    }
  }

  function cleanOrphanWires(): void {
    const compMap = new Map(state.components.map(c => [c.id, c]));
    const before = state.wires.length;
    state.wires = state.wires.filter(w => {
      const cf = compMap.get(w.fromCompId);
      const ct = compMap.get(w.toCompId);
      if (!cf || !ct) return false;
      return cf.pins.some(p => p.id === w.fromPinId) && ct.pins.some(p => p.id === w.toPinId);
    });
    const removed = before - state.wires.length;
    if (removed > 0) {
      evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
      saveHistorySnapshot();
      updateInspector();
      markDirty(250);
      showToast(`Limpiados ${removed} cable(s) huérfano(s)`);
    } else {
      showToast('No hay cables huérfanos o rotos');
    }
  }

  // =========================================================================
  // EDITOR HEXADECIMAL DE MEMORIA (RAM_N / ROM_N / DUAL_RAM_N)
  // =========================================================================
  function convertWireToTunnel(wireId: string): void {
    const w = state.wires.find(x => x.id === wireId);
    if (!w) return;
    const cFrom = state.components.find(c => c.id === w.fromCompId);
    const cTo = state.components.find(c => c.id === w.toCompId);
    const pFrom = cFrom?.pins.find(p => p.id === w.fromPinId);
    const pTo = cTo?.pins.find(p => p.id === w.toPinId);
    if (!cFrom || !cTo || !pFrom || !pTo) return;
    const bits = Math.max(1, Math.min(64, pFrom.width || pTo.width || w.width || 1));
    const baseTag = (cFrom.label || pFrom.label || 'NET').replace(/[^A-Za-z0-9_]/g, '_').toUpperCase().slice(0, 10) || 'NET';
    let tag = baseTag;
    let seq = 1;
    while (state.components.some(c => c.type === 'TUNNEL' && c.tunnelTag === tag)) {
      tag = `${baseTag}_${seq++}`;
    }

    const sx = pinWX(cFrom, pFrom);
    const sy = pinWY(cFrom, pFrom);
    const tx = createComponent('TUNNEL', sx + 70, sy, { bits, tunnelDir: 'out', tunnelTag: tag });
    state.components.push(tx);

    const dx = pinWX(cTo, pTo);
    const dy = pinWY(cTo, pTo);
    const rx = createComponent('TUNNEL', dx - 70, dy, { bits, tunnelDir: 'in', tunnelTag: tag });
    state.components.push(rx);

    state.wires = state.wires.filter(x => x.id !== w.id);
    state.wires.push(
      { id: genId('w'), fromCompId: cFrom.id, fromPinId: pFrom.id, toCompId: tx.id, toPinId: 'in0', signal: 0, width: bits },
      { id: genId('w'), fromCompId: rx.id, fromPinId: 'out', toCompId: cTo.id, toPinId: pTo.id, signal: 0, width: bits }
    );
    state.selectedWireId = null;
    state.selectedIds = new Set([tx.id, rx.id]);
    evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
    saveHistorySnapshot();
    updateInspector();
    soundFX.playPop(760);
    showToast(`Cable convertido en túnel inalámbrico "${tag}"`);
    markDirty(250);
  }

  function convertLongWiresToTunnels(minDist = 380, onlySelection = false): void {
    const longWires = state.wires.filter(w => {
      if (onlySelection && !state.selectedIds.has(w.fromCompId) && !state.selectedIds.has(w.toCompId)) return false;
      const cFrom = state.components.find(c => c.id === w.fromCompId);
      const cTo = state.components.find(c => c.id === w.toCompId);
      const pFrom = cFrom?.pins.find(p => p.id === w.fromPinId);
      const pTo = cTo?.pins.find(p => p.id === w.toPinId);
      if (!cFrom || !cTo || !pFrom || !pTo) return false;
      if (cFrom.type === 'TUNNEL' || cTo.type === 'TUNNEL') return false;
      if (onlySelection) return true;
      return Math.hypot(pinWX(cTo, pTo) - pinWX(cFrom, pFrom), pinWY(cTo, pTo) - pinWY(cFrom, pFrom)) >= minDist;
    });
    if (longWires.length === 0) {
      showToast(onlySelection ? 'La selección no tiene cables para convertir' : 'No hay cables largos (>380px) para convertir', 'warn');
      return;
    }
    const txByNet = new Map<string, LogicComponent>();
    let converted = 0;
    for (const w of longWires) {
      const cFrom = state.components.find(c => c.id === w.fromCompId);
      const cTo = state.components.find(c => c.id === w.toCompId);
      const pFrom = cFrom?.pins.find(p => p.id === w.fromPinId);
      const pTo = cTo?.pins.find(p => p.id === w.toPinId);
      if (!cFrom || !cTo || !pFrom || !pTo) continue;
      const netKey = `${cFrom.id}|${pFrom.id}`;
      const bits = Math.max(1, Math.min(64, pFrom.width || pTo.width || w.width || 1));
      let tx = txByNet.get(netKey);
      if (!tx) {
        const baseTag = (cFrom.label || pFrom.label || 'BUS').replace(/[^A-Za-z0-9_]/g, '_').toUpperCase().slice(0, 8) || 'BUS';
        let tag = baseTag;
        let seq = 1;
        while (state.components.some(c => c.type === 'TUNNEL' && c.tunnelTag === tag)) {
          tag = `${baseTag}_${seq++}`;
        }
        tx = createComponent('TUNNEL', pinWX(cFrom, pFrom) + 70, pinWY(cFrom, pFrom), { bits, tunnelDir: 'out', tunnelTag: tag });
        state.components.push(tx);
        state.wires.push({ id: genId('w'), fromCompId: cFrom.id, fromPinId: pFrom.id, toCompId: tx.id, toPinId: 'in0', signal: 0, width: bits });
        txByNet.set(netKey, tx);
      }
      const rx = createComponent('TUNNEL', pinWX(cTo, pTo) - 70, pinWY(cTo, pTo), { bits, tunnelDir: 'in', tunnelTag: tx.tunnelTag });
      state.components.push(rx);
      state.wires = state.wires.filter(x => x.id !== w.id);
      state.wires.push({ id: genId('w'), fromCompId: rx.id, fromPinId: 'out', toCompId: cTo.id, toPinId: pTo.id, signal: 0, width: bits });
      converted++;
    }
    state.selectedIds.clear();
    state.selectedWireId = null;
    evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
    saveHistorySnapshot();
    updateInspector();
    soundFX.playPop(820);
    showToast(`${converted} cable(s) convertidos en túneles inalámbricos`);
    markDirty(300);
  }

  const memProgrammer = createMemoryProgrammer({
    getComponent: id => (id ? state.components.find(c => c.id === id) : undefined),
    evaluateAndNotify: saveHist => {
      evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
      if (saveHist) saveHistorySnapshot();
      markDirty(200);
    },
    showToast,
    copyText: (txt, msg) => void copyText(txt, msg)
  });

  function openMemoryEditor(comp: LogicComponent): void {
    memProgrammer.open(comp);
  }

  // =========================================================================
  // INSPECTOR CONTEXTUAL DE PROPIEDADES Y PINES EN VIVO
  // =========================================================================
  function formatWireBases(sig: PinSignal | undefined, pw: number): { hex: string; dec: string; sdec: string; bin: string } {
    if (sig === 'Z' || sig === 'ERR') return { hex: sig, dec: sig, sdec: sig, bin: sig };
    const u = toUintN(sig, pw);
    const s = toSignedN(u, pw);
    const binFull = u.toString(2).padStart(pw, '0');
    return {
      hex: formatSignalHex(sig, pw),
      dec: u.toString(),
      sdec: s.toString(),
      bin: pw > 16 ? `…${binFull.slice(-16)}` : binFull
    };
  }

  function updateLiveInspectorSignals(): void {
    const panel = $('sidebar-right');
    if (!panel || panel.classList.contains('hidden')) return;

    if (state.selectedWireId) {
      const w = state.wires.find(x => x.id === state.selectedWireId);
      if (!w) return;
      const bases = formatWireBases(w.signal, w.width || 1);
      const hEl = $('insp-wire-hex');
      const dEl = $('insp-wire-dec');
      const sEl = $('insp-wire-sdec');
      const bEl = $('insp-wire-bin');
      if (hEl) hEl.textContent = bases.hex;
      if (dEl) dEl.textContent = bases.dec;
      if (sEl) sEl.textContent = bases.sdec;
      if (bEl) bEl.textContent = bases.bin;
      return;
    }

    document.querySelectorAll<HTMLElement>('[data-live-pin]').forEach(el => {
      const [cid, pid] = (el.dataset.livePin || '').split('|');
      const c = state.components.find(x => x.id === cid);
      if (!c) return;
      const p = c.pins.find(x => x.id === pid);
      const pw = p?.width || 1;
      const txt = formatSignalHex(c.pinValues[pid] ?? 0, pw);
      if (el.textContent !== txt) el.textContent = txt;
    });
  }

  function updateInspector(): void {
    const panel = $('sidebar-right');
    const body = $('inspector-body');
    const title = $('inspector-title');
    if (!panel || !body || !title) return;

    if (state.selectedIds.size === 0 && !state.selectedWireId) {
      panel.classList.add('hidden');
      return;
    }

    panel.classList.remove('hidden');

    if (state.selectedWireId) {
      const w = state.wires.find(x => x.id === state.selectedWireId);
      if (!w) {
        panel.classList.add('hidden');
        return;
      }
      const pw = w.width || 1;
      const cFrom = state.components.find(c => c.id === w.fromCompId);
      const cTo = state.components.find(c => c.id === w.toCompId);
      const bases = formatWireBases(w.signal, pw);
      title.textContent = pw > 1 ? `Bus (${pw} bits)` : 'Conductor Seleccionado';
      body.innerHTML = `
        <div class="insp-id-card">
          <div class="insp-id-row">
            <span style="color:var(--text-muted);">Origen → Destino</span>
            <span class="mono" style="color:var(--accent); font-weight:700;">${pw} bit(s)</span>
          </div>
          <div class="mono" style="font-size:11px; color:var(--text-primary);">
            ${(cFrom?.label || cFrom?.type || '?')}.${w.fromPinId} → ${(cTo?.label || cTo?.type || '?')}.${w.toPinId}
          </div>
        </div>
        <div class="insp-id-card mono" style="font-size:11px;">
          <div class="insp-id-row"><span>Hex:</span><strong id="insp-wire-hex" style="color:var(--accent);">${bases.hex}</strong></div>
          <div class="insp-id-row"><span>Dec:</span><strong id="insp-wire-dec">${bases.dec}</strong></div>
          <div class="insp-id-row"><span>Signo:</span><strong id="insp-wire-sdec">${bases.sdec}</strong></div>
          <div class="insp-id-row"><span>Bin:</span><strong id="insp-wire-bin">${bases.bin}</strong></div>
        </div>
        <div class="field-group">
          <label class="field-label">Color Personalizado y Curvatura (${Math.round(w.curveOffset || 0)} px)</label>
          <div class="color-swatches">
            <button type="button" class="btn" data-wcol="" style="height:24px; padding:0 8px; font-size:10.5px;">Auto</button>
            ${WIRE_COLORS.map(
              col =>
                `<button type="button" class="swatch-btn ${w.customColor === col ? 'active' : ''}" data-wcol="${col}" style="background:${col};" title="Color ${col}"></button>`
            ).join('')}
          </div>
          <button id="insp-wire-reset" class="btn" style="margin-top:4px;">↺ Resetear Trazado (Doble clic)</button>
        </div>
        <div class="tool-grid two">
          <button id="insp-wire-zoom" class="btn">🔍 Enfocar</button>
          <button id="insp-wire-tunnel" class="btn">📡 A Túnel</button>
        </div>
        <button id="insp-del-wire" class="btn btn-danger">Eliminar Conductor (Supr)</button>
      `;
      body.querySelectorAll<HTMLElement>('[data-wcol]').forEach(btn => {
        btn.onclick = () => {
          w.customColor = btn.dataset.wcol || undefined;
          saveHistorySnapshot();
          updateInspector();
          markDirty(200);
        };
      });
      $('insp-wire-reset')!.onclick = () => {
        w.curveOffset = 0;
        w.waypoints = undefined;
        saveHistorySnapshot();
        updateInspector();
        markDirty(200);
        showToast('Trazado del cable reiniciado');
      };
      $('insp-wire-zoom')!.onclick = zoomToSelection;
      $('insp-wire-tunnel')!.onclick = () => convertWireToTunnel(state.selectedWireId!);
      $('insp-del-wire')!.onclick = deleteSelection;
      return;
    }

    if (state.selectedIds.size > 1) {
      title.textContent = `${state.selectedIds.size} Seleccionados`;
      body.innerHTML = `
        <div class="field-group">
          <label class="field-label">Alinear selección</label>
          <div class="tool-grid">
            <button class="btn" data-al="left" title="Alinear a la izquierda">⇤</button>
            <button class="btn" data-al="hcenter" title="Centrar horizontalmente">↔</button>
            <button class="btn" data-al="right" title="Alinear a la derecha">⇥</button>
            <button class="btn" data-al="top" title="Alinear arriba">⤒</button>
            <button class="btn" data-al="vcenter" title="Centrar verticalmente">↕</button>
            <button class="btn" data-al="bottom" title="Alinear abajo">⤓</button>
            <button class="btn" data-al="dist-h" title="Distribuir horizontalmente (3+)">⇹ Dist. H</button>
            <button class="btn" data-al="dist-v" title="Distribuir verticalmente (3+)">⇳ Dist. V</button>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">Orientación</label>
          <div class="tool-grid two">
            <button id="insp-rot-multi" class="btn">⟳ Rotar (R)</button>
            <button id="insp-flip-multi" class="btn">⇋ Voltear (H)</button>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">Agrupar y Organización</label>
          <div class="tool-grid two">
            <button id="insp-group-multi" class="btn btn-accent">⊞ Agrupar (Ctrl+G)</button>
            <button id="insp-ungroup-multi" class="btn">⊟ Desagrupar</button>
            <button id="insp-zoom-multi" class="btn">🔍 Zoom (Shift+F)</button>
            <button id="insp-tunnels-multi" class="btn">📡 Cables→Túnel</button>
          </div>
        </div>
        <button id="insp-dup-multi" class="btn">Duplicar Selección (Ctrl+D)</button>
        <button id="insp-del-multi" class="btn btn-danger">Eliminar Selección (Supr)</button>
      `;
      body.querySelectorAll<HTMLElement>('[data-al]').forEach(b => {
        b.onclick = () => alignSelection(b.dataset.al!);
      });
      $('insp-rot-multi')!.onclick = () => rotateSelection(1);
      $('insp-flip-multi')!.onclick = flipSelection;
      $('insp-group-multi')!.onclick = () => groupSelection();
      $('insp-ungroup-multi')!.onclick = ungroupSelection;
      $('insp-zoom-multi')!.onclick = zoomToSelection;
      $('insp-tunnels-multi')!.onclick = () => convertLongWiresToTunnels(0, true);
      $('insp-dup-multi')!.onclick = duplicateSelection;
      $('insp-del-multi')!.onclick = deleteSelection;
      return;
    }

    const compId = [...state.selectedIds][0];
    const comp = state.components.find(c => c.id === compId);
    if (!comp) {
      panel.classList.add('hidden');
      return;
    }

    const meta = COMPONENT_CATALOG.find(m => m.type === comp.type);
    title.textContent = meta ? meta.name : comp.type;
    const b = Math.max(1, Math.min(64, comp.bits || 1));

    let html = `
      <div class="insp-id-card">
        <div class="insp-id-row">
          <span class="mono" style="color:var(--text-muted);">${comp.type} · #${comp.id.slice(-5)}</span>
          <button type="button" id="insp-copy-id" class="btn" style="height:20px; font-size:10px; padding:0 6px;">Copiar ID</button>
        </div>
        <div class="insp-xy-grid">
          <label>X <input id="insp-pos-x" type="number" step="10" class="input-control mono" value="${Math.round(comp.x)}" /></label>
          <label>Y <input id="insp-pos-y" type="number" step="10" class="input-control mono" value="${Math.round(comp.y)}" /></label>
        </div>
      </div>
    `;

    if (comp.type === 'LABEL') {
      html += `
        <div class="field-group">
          <label class="field-label">Texto de la Nota</label>
          <input id="insp-note" type="text" class="input-control" value="${comp.noteText.replace(/"/g, '&quot;')}" />
        </div>
      `;
    } else {
      html += `
        <div class="field-group">
          <label class="field-label">Etiqueta del Componente</label>
          <input id="insp-label" type="text" class="input-control" placeholder="Ej: A, CLK, SALIDA" value="${comp.label.replace(/"/g, '&quot;')}" />
        </div>
      `;
    }

    if (meta?.scalableBits) {
      const bitOpts =
        comp.type === 'LED_BAR_8'
          ? [8, 16]
          : comp.type === 'BIN2BCD_N'
          ? [4, 8, 16]
          : comp.type === 'RAM_N' || comp.type === 'ROM_N' || comp.type === 'DUAL_RAM_N'
          ? [4, 8, 16, 32, 64]
          : [
              'CONST_N', 'DIP_SWITCH', 'HEX_KEY_N', 'NUM_STEPPER', 'SLIDER_ADC', 'HEX_DISPLAY_N', 'DEC_DISPLAY_N', 'VU_METER_N',
              'ALU_N', 'ADDER_N', 'SUB_N', 'MULT_N', 'DIV_N', 'SHIFTER_N', 'COMP_N', 'COMP_WIN_N', 'INC_DEC_N',
              'ABS_NEG_N', 'MIN_MAX_N', 'POPCOUNT_N', 'MAC_N', 'SAT_ADDER_N', 'SQRT_N', 'CROSSBAR_2X2',
              'REG_N', 'REG_FILE_N', 'FIFO_N', 'COUNTER_N', 'MOD_COUNTER_N', 'WATCHDOG_N', 'STOPWATCH_N',
              'SHIFT_REG_N', 'TIMER_N', 'LFSR_N', 'STACK_LIFO', 'PARITY_N',
              'BIN2GRAY_N', 'GRAY2BIN_N', 'SPLITTER', 'MERGER', 'BIT_EXTEND', 'BUS_SLICE', 'BUS_PACK4', 'BUS_UNPACK4'
            ].includes(comp.type)
          ? [2, 4, 8, 16, 32, 64]
          : [1, 2, 4, 8, 16, 32, 64];
      html += `
        <div class="field-group">
          <label class="field-label">Ancho de Bits (Bus 1–64b)</label>
          <div class="insp-bit-chips">
            ${bitOpts.map(w => `<button type="button" data-chipbits="${w}" class="insp-bit-chip mono ${b === w ? 'active' : ''}">${w}b</button>`).join('')}
          </div>
          <select id="insp-bits" class="select-control mono">
            ${bitOpts.map(w => `<option value="${w}" ${b === w ? 'selected' : ''}>${w} bit${w > 1 ? 's' : ''}</option>`).join('')}
          </select>
        </div>
      `;
    }

    if (comp.type === 'MOD_COUNTER_N' || comp.type === 'WATCHDOG_N') {
      const curMod = comp.modBase ?? (comp.type === 'WATCHDOG_N' ? 16 : 10);
      html += `
        <div class="field-group">
          <label class="field-label">${comp.type === 'WATCHDOG_N' ? 'Límite Watchdog (si pin LIM=0)' : 'Módulo Base (si pin M=0)'}</label>
          <input id="insp-modbase" type="number" min="2" max="65535" class="input-control mono" value="${curMod}" />
        </div>
      `;
    }

    if (comp.type === 'SLIDER_ADC') {
      const maxU = maskBits(b);
      const curU = toUintN((comp.internalState.adcVal ?? comp.internalState.value ?? 0) as PinSignal, b);
      const pct = maxU > 0n ? Math.round(Number((curU * 1000n) / maxU) / 10) : 0;
      html += `
        <div class="field-group">
          <label class="field-label">Deslizador ADC (${pct}% — ${formatSignalHex(curU, b)})</label>
          <input id="insp-slider-pct" type="range" min="0" max="1000" value="${maxU > 0n ? Number((curU * 1000n) / maxU) : 0}" style="accent-color:var(--accent);" />
        </div>
      `;
    }

    if (comp.type === 'ROTARY_ENC') {
      const pos = Number(comp.internalState.encPos || 0) & 255;
      html += `
        <div class="field-group">
          <label class="field-label">Posición Encoder (${pos} / 0x${pos.toString(16).toUpperCase().padStart(2, '0')})</label>
          <div class="tool-grid two">
            <button type="button" id="insp-rot-dec" class="btn">− Paso CCW</button>
            <button type="button" id="insp-rot-inc" class="btn">+ Paso CW</button>
          </div>
        </div>
      `;
    }

    if (comp.type === 'BUS_SLICE') {
      const hi = Math.max(0, Math.min(b - 1, comp.sliceHi ?? Math.min(b - 1, 7)));
      const lo = Math.max(0, Math.min(hi, comp.sliceLo ?? 0));
      html += `
        <div class="field-group">
          <label class="field-label">Rango de Bits [HI : LO] (0..${b - 1})</label>
          <div class="insp-slice-row">
            <label><span>Bit Alto (HI)</span><input id="insp-slice-hi" type="number" min="0" max="${b - 1}" value="${hi}" class="input-control mono" /></label>
            <label><span>Bit Bajo (LO)</span><input id="insp-slice-lo" type="number" min="0" max="${b - 1}" value="${lo}" class="input-control mono" /></label>
          </div>
        </div>
      `;
    }

    if (comp.type === 'CONST_N' || comp.type === 'DIP_SWITCH' || comp.type === 'HEX_KEY_N' || comp.type === 'NUM_STEPPER' || comp.type === 'SLIDER_ADC') {
      const curVal =
        comp.type === 'HEX_KEY_N'
          ? BigInt(comp.internalState.hexVal || 0)
          : comp.type === 'SLIDER_ADC'
          ? BigInt((comp.internalState.adcVal ?? comp.internalState.value ?? 0) as number | bigint)
          : BigInt(comp.internalState.value || 0);
      const hexStr = '0x' + toUintN(curVal, b).toString(16).toUpperCase();
      html += `
        <div class="field-group">
          <label class="field-label">Valor (${b}b Hex o Decimal)</label>
          <input id="insp-bus-val" type="text" class="input-control mono" value="${hexStr}" />
          <div style="font-size:10.5px; color:var(--text-muted);" class="mono">DEC: ${toUintN(curVal, b).toString()}</div>
        </div>
      `;
    }

    if (comp.type === 'TUNNEL') {
      html += `
        <div class="field-group">
          <label class="field-label">Nombre de Señal (Tag)</label>
          <input id="insp-tunnel-tag" type="text" class="input-control mono" value="${(comp.tunnelTag || 'SIG').replace(/"/g, '&quot;')}" />
        </div>
        <div class="field-group">
          <label class="field-label">Dirección del Túnel</label>
          <select id="insp-tunnel-dir" class="select-control">
            <option value="out" ${comp.tunnelDir !== 'in' ? 'selected' : ''}>Emisor (TX → aire)</option>
            <option value="in" ${comp.tunnelDir === 'in' ? 'selected' : ''}>Receptor (aire → RX)</option>
          </select>
        </div>
      `;
    }

    if (comp.type === 'SPLITTER' || comp.type === 'MERGER') {
      html += `
        <div class="field-group">
          <label class="field-label">Distribución de Bits (ej: 8,8 o 16,16,16,16)</label>
          <input id="insp-split" type="text" class="input-control mono" value="${getSplitterChunks(comp).join(',')}" />
        </div>
      `;
    }

    if (['ALU_N', 'MULT_N', 'DIV_N', 'COMP_N', 'ABS_NEG_N', 'MIN_MAX_N', 'BIT_EXTEND', 'MAC_N', 'DEC_DISPLAY_N', 'SAT_ADDER_N', 'COMP_WIN_N'].includes(comp.type)) {
      html += `
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px;">
          <input id="insp-signed" type="checkbox" ${comp.signedMode ? 'checked' : ''} style="accent-color:var(--accent);" />
          <span>Modo con Signo (Complemento a 2)</span>
        </label>
      `;
    }

    if (meta?.variableInputs) {
      html += `
        <div class="field-group">
          <label class="field-label">${comp.type === 'SEG7_MULTI' ? 'Número de Dígitos (2 a 4)' : 'Número de Entradas (2 a 4)'}</label>
          <select id="insp-inputs" class="select-control">
            <option value="2" ${comp.inputCount === 2 ? 'selected' : ''}>2 ${comp.type === 'SEG7_MULTI' ? 'Dígitos' : 'Entradas'}</option>
            <option value="3" ${comp.inputCount === 3 ? 'selected' : ''}>3 ${comp.type === 'SEG7_MULTI' ? 'Dígitos' : 'Entradas'}</option>
            <option value="4" ${comp.inputCount === 4 ? 'selected' : ''}>4 ${comp.type === 'SEG7_MULTI' ? 'Dígitos' : 'Entradas'}</option>
          </select>
        </div>
      `;
    }

    if (['LED', 'SEG7_DISPLAY', 'SEG7_MULTI', 'HEX_DISPLAY', 'HEX_DISPLAY_N', 'DEC_DISPLAY_N', 'LED_BAR_4', 'LED_BAR_8', 'LCD_TEXT', 'LED_MATRIX_4X4', 'LED_MATRIX_8X8', 'VU_METER_N'].includes(comp.type)) {
      html += `
        <div class="field-group">
          <label class="field-label">Color del Indicador</label>
          <div class="color-swatches">
            ${Object.entries(LED_PALETTE)
              .map(
                ([k, v]) =>
                  `<button data-col="${k}" title="${v.name}" class="swatch-btn ${comp.color === k ? 'active' : ''}" style="background:${v.hex};"></button>`
              )
              .join('')}
          </div>
        </div>
      `;
    }

    if (comp.type === 'CLOCK') {
      const curHz = comp.freqHz !== null ? comp.freqHz : state.globalClockHz;
      html += `
        <div class="field-group">
          <label class="field-label">Frecuencia Propia (${curHz.toFixed(1)} Hz)</label>
          <input id="insp-hz" type="range" min="0.5" max="30" step="0.5" value="${curHz}" style="accent-color:var(--accent);" />
        </div>
      `;
    }

    if (comp.type === 'PULSE_GEN') {
      html += `
        <div class="field-group">
          <label class="field-label">Secuencia Programable de 8 Bits</label>
          <div class="seq-bits-row">
            ${comp.internalState.seqBits
              .map((sb, idx) => `<button data-bidx="${idx}" class="seq-bit-btn mono ${sb === 1 ? 'on' : ''}">${sb}</button>`)
              .join('')}
          </div>
        </div>
      `;
    }

    if (comp.type !== 'LABEL') {
      html += `
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px;">
          <input id="insp-probe" type="checkbox" ${comp.probe ? 'checked' : ''} style="accent-color:var(--accent);" />
          <span>Mostrar en Osciloscopio</span>
        </label>
      `;
    }

    if (comp.type === 'RAM_16X4' || comp.type === 'ROM_16X4') {
      if (!comp.internalState.mem) comp.internalState.mem = new Array(16).fill(0);
      html += `
        <div class="field-group">
          <label class="field-label">Contenido de memoria (hex, 16×4b)</label>
          <div class="mem-grid">
            ${comp.internalState.mem
              .map(
                (v, i) =>
                  `<label class="mem-cell"><span class="mono">${i.toString(16).toUpperCase()}</span><input data-maddr="${i}" class="input-control mono" maxlength="1" value="${(Number(v) & 15).toString(16).toUpperCase()}" /></label>`
              )
              .join('')}
          </div>
          <div class="tool-grid two">
            <button id="mem-zero" class="btn">Poner a 0</button>
            <button id="mem-count" class="btn">Cargar 0…F</button>
          </div>
        </div>
      `;
    }

    if (comp.type === 'RAM_N' || comp.type === 'ROM_N' || comp.type === 'DUAL_RAM_N') {
      const ab = Math.max(4, Math.min(16, comp.addrBits || 8));
      const addrOptions = Array.from(new Set([4, 5, 6, 8, 10, 12, 14, 16, ab])).sort((a, c) => a - c);
      html += `
        <div class="field-group">
          <label class="field-label">Capacidad de Direcciones (AddrBits)</label>
          <select id="insp-addrbits" class="select-control mono">
            ${addrOptions.map(a => `<option value="${a}" ${ab === a ? 'selected' : ''}>${a} bits (${(1 << a).toLocaleString()} palabras)</option>`).join('')}
          </select>
          <button id="insp-open-hex" class="btn btn-accent" style="margin-top:4px;">Editar Memoria Hex (${1 << ab}×${b}b)</button>
        </div>
      `;
    }

    if (comp.type === 'FSM' && comp.internalState.fsm) {
      const f = comp.internalState.fsm;
      const opt = (sel: number) =>
        Array.from({ length: f.n }, (_, k) => `<option value="${k}" ${sel === k ? 'selected' : ''}>S${k}</option>`).join('');
      html += `
        <div class="field-group">
          <label class="field-label">Número de estados</label>
          <select id="fsm-n" class="select-control">
            ${[2, 3, 4, 5, 6, 7, 8].map(k => `<option value="${k}" ${f.n === k ? 'selected' : ''}>${k} estados</option>`).join('')}
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">Tabla de transiciones (Moore)</label>
          <div class="fsm-table">
            <div class="fsm-row head"><span></span><span>X=0 →</span><span>X=1 →</span><span>Z</span></div>
            ${Array.from(
              { length: f.n },
              (_, i) => `
              <div class="fsm-row">
                <span class="mono">S${i}</span>
                <select data-fsm="n0" data-i="${i}" class="select-control">${opt(f.next0[i])}</select>
                <select data-fsm="n1" data-i="${i}" class="select-control">${opt(f.next1[i])}</select>
                <input data-fsm="out" data-i="${i}" type="checkbox" ${f.out[i] ? 'checked' : ''} style="accent-color:var(--accent);" />
              </div>`
            ).join('')}
          </div>
          <button id="fsm-reset" class="btn">Volver al estado S0</button>
        </div>
      `;
    }

    if (comp.pins.length > 0) {
      const wiredPins = new Set<string>();
      for (const w of state.wires) {
        if (w.fromCompId === comp.id) wiredPins.add(w.fromPinId);
        if (w.toCompId === comp.id) wiredPins.add(w.toPinId);
      }
      html += `
        <details class="insp-details" open>
          <summary>Pines en Vivo (${comp.pins.length})</summary>
          <div class="insp-pins-list">
            ${comp.pins
              .map(p => {
                const pw = p.width || 1;
                const valTxt = formatSignalHex(comp.pinValues[p.id] ?? 0, pw);
                const cutBtn = wiredPins.has(p.id)
                  ? `<button type="button" class="insp-pin-cut" data-cutpin="${p.id}" title="Desconectar cables de este pin">✕</button>`
                  : '';
                return `
                  <div class="insp-pin-row">
                    <span class="mono">${p.dir === 'in' ? '→' : '←'} <strong>${p.label || p.id}</strong></span>
                    <span style="display:flex; align-items:center; gap:3px;">
                      <span class="insp-pin-val mono" data-live-pin="${comp.id}|${p.id}">${valTxt}</span>
                      ${cutBtn}
                    </span>
                  </div>
                `;
              })
              .join('')}
          </div>
        </details>
      `;
    }

    if (comp.groupId) {
      const grpColor = comp.groupColor || '#00f5d4';
      const grpCount = state.components.filter(x => x.groupId === comp.groupId).length;
      html += `
        <div class="insp-id-card">
          <div class="insp-id-row">
            <span style="font-weight:700; color:${grpColor};">⊞ Grupo (${grpCount} elementos)</span>
          </div>
          <input id="insp-group-name" type="text" class="input-control" placeholder="Nombre del grupo" value="${(comp.groupName || 'Bloque').replace(/"/g, '&quot;')}" />
          <div class="color-swatches">
            ${GROUP_COLORS.map(
              gc => `<button type="button" class="swatch-btn ${grpColor === gc ? 'active' : ''}" data-gcol="${gc}" style="background:${gc};" title="Color de grupo"></button>`
            ).join('')}
          </div>
          <div class="tool-grid two">
            <button id="insp-group-select" class="btn">Seleccionar Grupo</button>
            <button id="insp-group-remove" class="btn">Sacar del Grupo</button>
          </div>
        </div>
      `;
    }

    if (comp.type !== 'LABEL') {
      html += `
        <div class="field-group">
          <label class="field-label">Orientación y Acciones</label>
          <div class="tool-grid two">
            <button id="insp-rot" class="btn">⟳ Rotar (R)</button>
            <button id="insp-flip" class="btn">⇋ Voltear (H)</button>
            <button id="insp-reset-chip" class="btn">↺ Reset</button>
            <button id="insp-zoom-chip" class="btn">🔍 Zoom</button>
          </div>
          <div class="tool-grid two">
            <button id="insp-copy-ls" class="btn">📋 Snippet LS</button>
            <button id="insp-dup" class="btn">Duplicar</button>
          </div>
        </div>
      `;
    } else {
      html += `<button id="insp-dup" class="btn">Duplicar (Ctrl+D)</button>`;
    }

    html += `<button id="insp-del" class="btn btn-danger">Eliminar (Supr)</button>`;

    body.innerHTML = html;

    $('insp-copy-id')?.addEventListener('click', () => {
      void copyText(comp.id, `ID "${comp.id}" copiado`);
    });

    const posX = $<HTMLInputElement>('insp-pos-x');
    const posY = $<HTMLInputElement>('insp-pos-y');
    if (posX && posY) {
      const applyPos = () => {
        const nx = parseFloat(posX.value);
        const ny = parseFloat(posY.value);
        if (!Number.isNaN(nx)) comp.x = SETTINGS.snap ? Math.round(nx / 10) * 10 : Math.round(nx);
        if (!Number.isNaN(ny)) comp.y = SETTINGS.snap ? Math.round(ny / 10) * 10 : Math.round(ny);
        posX.value = String(Math.round(comp.x));
        posY.value = String(Math.round(comp.y));
        saveHistorySnapshot();
        markDirty(200);
      };
      posX.onchange = applyPos;
      posY.onchange = applyPos;
    }

    body.querySelectorAll<HTMLElement>('[data-cutpin]').forEach(btn => {
      btn.onclick = () => disconnectPinWires(comp.id, btn.dataset.cutpin!);
    });

    const noteInp = $<HTMLInputElement>('insp-note');
    if (noteInp) {
      noteInp.oninput = e => {
        comp.noteText = (e.target as HTMLInputElement).value;
        markDirty(150);
      };
      noteInp.onchange = saveHistorySnapshot;
    }

    const lblInp = $<HTMLInputElement>('insp-label');
    if (lblInp) {
      lblInp.oninput = e => {
        comp.label = (e.target as HTMLInputElement).value;
        markDirty(150);
      };
      lblInp.onchange = saveHistorySnapshot;
    }

    const applyBitWidth = (newBits: number) => {
      comp.bits = newBits;
      syncComponentPins(comp, state.customICs);
      const validIds = new Set(comp.pins.map(p => p.id));
      state.wires = state.wires.filter(
        w => !((w.toCompId === comp.id && !validIds.has(w.toPinId)) || (w.fromCompId === comp.id && !validIds.has(w.fromPinId)))
      );
      evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
      saveHistorySnapshot();
      updateInspector();
      markDirty(250);
    };

    const bitsSel = $<HTMLSelectElement>('insp-bits');
    if (bitsSel) {
      bitsSel.onchange = e => applyBitWidth(Number((e.target as HTMLSelectElement).value));
    }
    body.querySelectorAll<HTMLElement>('[data-chipbits]').forEach(btn => {
      btn.onclick = () => applyBitWidth(Number(btn.dataset.chipbits));
    });

    const modInp = $<HTMLInputElement>('insp-modbase');
    if (modInp) {
      modInp.onchange = () => {
        const m = Math.max(2, Math.min(65535, parseInt(modInp.value, 10) || 10));
        comp.modBase = m;
        modInp.value = String(m);
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        saveHistorySnapshot();
        markDirty(200);
      };
    }

    const sliderPct = $<HTMLInputElement>('insp-slider-pct');
    if (sliderPct) {
      sliderPct.oninput = () => {
        const frac = Math.max(0, Math.min(1, Number(sliderPct.value) / 1000));
        const maxU = maskBits(b);
        const scaled = maxU <= 1000000n ? BigInt(Math.round(frac * Number(maxU))) : (BigInt(Math.round(frac * 10000)) * maxU) / 10000n;
        comp.internalState.adcVal = scaled <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(scaled) : scaled;
        comp.internalState.value = scaled;
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        updateLiveInspectorSignals();
        markDirty(180);
      };
      sliderPct.onchange = () => {
        saveHistorySnapshot();
        updateInspector();
      };
    }

    const stepRot = (delta: number) => {
      comp.internalState.encPos = (Number(comp.internalState.encPos || 0) + delta) & 255;
      evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
      saveHistorySnapshot();
      updateInspector();
      markDirty(180);
    };
    $('insp-rot-dec')?.addEventListener('click', () => stepRot(-1));
    $('insp-rot-inc')?.addEventListener('click', () => stepRot(1));

    const sliceHiInp = $<HTMLInputElement>('insp-slice-hi');
    const sliceLoInp = $<HTMLInputElement>('insp-slice-lo');
    if (sliceHiInp && sliceLoInp) {
      const applySlice = () => {
        let lo = Math.max(0, Math.min(b - 1, parseInt(sliceLoInp.value, 10) || 0));
        let hi = Math.max(0, Math.min(b - 1, parseInt(sliceHiInp.value, 10) || 0));
        if (lo > hi) [lo, hi] = [hi, lo];
        comp.sliceLo = lo;
        comp.sliceHi = hi;
        syncComponentPins(comp, state.customICs);
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        saveHistorySnapshot();
        updateInspector();
        markDirty(250);
      };
      sliceHiInp.onchange = applySlice;
      sliceLoInp.onchange = applySlice;
    }

    const busValInp = $<HTMLInputElement>('insp-bus-val');
    if (busValInp) {
      busValInp.onchange = () => {
        const raw = busValInp.value.trim();
        let parsed = 0n;
        try {
          parsed = raw ? toUintN(BigInt(raw), b) : 0n;
        } catch {
          parsed = 0n;
        }
        if (comp.type === 'HEX_KEY_N') comp.internalState.hexVal = parsed;
        else if (comp.type === 'SLIDER_ADC') {
          comp.internalState.adcVal = parsed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(parsed) : parsed;
          comp.internalState.value = parsed;
        } else comp.internalState.value = parsed;
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        saveHistorySnapshot();
        updateInspector();
        markDirty(250);
      };
    }

    const tTag = $<HTMLInputElement>('insp-tunnel-tag');
    if (tTag) {
      tTag.oninput = () => {
        comp.tunnelTag = tTag.value.trim().toUpperCase() || 'SIG';
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        markDirty(200);
      };
      tTag.onchange = saveHistorySnapshot;
    }

    const tDir = $<HTMLSelectElement>('insp-tunnel-dir');
    if (tDir) {
      tDir.onchange = () => {
        comp.tunnelDir = tDir.value === 'in' ? 'in' : 'out';
        syncComponentPins(comp, state.customICs);
        state.wires = state.wires.filter(w => w.fromCompId !== comp.id && w.toCompId !== comp.id);
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        saveHistorySnapshot();
        updateInspector();
        markDirty(250);
      };
    }

    const splitInp = $<HTMLInputElement>('insp-split');
    if (splitInp) {
      splitInp.onchange = () => {
        const parts = splitInp.value
          .split(',')
          .map(x => parseInt(x.trim(), 10))
          .filter(x => x > 0);
        if (parts.length > 0) {
          comp.splitWidths = parts;
          comp.bits = Math.min(64, parts.reduce((a, c) => a + c, 0));
          syncComponentPins(comp, state.customICs);
          const validIds = new Set(comp.pins.map(p => p.id));
          state.wires = state.wires.filter(
            w => !((w.toCompId === comp.id && !validIds.has(w.toPinId)) || (w.fromCompId === comp.id && !validIds.has(w.fromPinId)))
          );
          evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
          saveHistorySnapshot();
          updateInspector();
          markDirty(250);
        }
      };
    }

    const signedChk = $<HTMLInputElement>('insp-signed');
    if (signedChk) {
      signedChk.onchange = () => {
        comp.signedMode = signedChk.checked;
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        saveHistorySnapshot();
        markDirty(200);
      };
    }

    const inpSel = $<HTMLSelectElement>('insp-inputs');
    if (inpSel) {
      inpSel.onchange = e => {
        comp.inputCount = Number((e.target as HTMLSelectElement).value);
        syncComponentPins(comp, state.customICs);
        const validIds = new Set(comp.pins.map(p => p.id));
        state.wires = state.wires.filter(w => !(w.toCompId === comp.id && !validIds.has(w.toPinId)));
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        saveHistorySnapshot();
        markDirty(250);
      };
    }

    body.querySelectorAll<HTMLElement>('.swatch-btn').forEach(btn => {
      btn.onclick = () => {
        comp.color = btn.dataset.col || 'cyan';
        saveHistorySnapshot();
        updateInspector();
        markDirty(200);
      };
    });

    const hzInp = $<HTMLInputElement>('insp-hz');
    if (hzInp) {
      hzInp.oninput = e => {
        comp.freqHz = Number((e.target as HTMLInputElement).value);
        updateInspector();
      };
      hzInp.onchange = saveHistorySnapshot;
    }

    body.querySelectorAll<HTMLElement>('.seq-bit-btn').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.bidx);
        comp.internalState.seqBits[idx] = comp.internalState.seqBits[idx] === 1 ? 0 : 1;
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        saveHistorySnapshot();
        updateInspector();
        markDirty(200);
      };
    });

    const probeChk = $<HTMLInputElement>('insp-probe');
    if (probeChk) {
      probeChk.onchange = e => {
        comp.probe = (e.target as HTMLInputElement).checked;
        saveHistorySnapshot();
        markDirty(200);
      };
    }

    const rotBtn = $('insp-rot');
    if (rotBtn) rotBtn.onclick = () => rotateSelection(1);
    const flipBtn = $('insp-flip');
    if (flipBtn) flipBtn.onclick = flipSelection;
    $('insp-zoom-chip')?.addEventListener('click', zoomToSelection);
    $('insp-copy-ls')?.addEventListener('click', () => {
      const snippet = exportCircuitToLogicScript([comp], []);
      void copyText(snippet, 'Snippet LogicScript del chip copiado');
    });
    $('insp-reset-chip')?.addEventListener('click', () => {
      const fresh = createComponent(comp.type, comp.x, comp.y, {
        bits: comp.bits,
        addrBits: comp.addrBits,
        label: comp.label,
        color: comp.color,
        modBase: comp.modBase,
        noAnim: true,
        customICs: state.customICs
      });
      comp.internalState = fresh.internalState;
      evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
      saveHistorySnapshot();
      updateInspector();
      markDirty(250);
      showToast('Estado interno reiniciado');
    });

    body.querySelectorAll<HTMLInputElement>('[data-maddr]').forEach(inp => {
      inp.onfocus = () => inp.select();
      inp.onchange = () => {
        const v = parseInt(inp.value, 16);
        comp.internalState.mem![Number(inp.dataset.maddr)] = isNaN(v) ? 0 : v & 15;
        inp.value = Number(comp.internalState.mem![Number(inp.dataset.maddr)]).toString(16).toUpperCase();
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        saveHistorySnapshot();
        markDirty(200);
      };
    });
    const memZero = $('mem-zero');
    if (memZero) {
      memZero.onclick = () => {
        comp.internalState.mem = new Array(16).fill(0);
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        saveHistorySnapshot();
        updateInspector();
      };
    }
    const memCount = $('mem-count');
    if (memCount) {
      memCount.onclick = () => {
        comp.internalState.mem = Array.from({ length: 16 }, (_, i) => i);
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        saveHistorySnapshot();
        updateInspector();
      };
    }

    const abSel = $<HTMLSelectElement>('insp-addrbits');
    if (abSel) {
      abSel.onchange = () => {
        comp.addrBits = Number(abSel.value);
        syncComponentPins(comp, state.customICs);
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        saveHistorySnapshot();
        updateInspector();
        markDirty(250);
      };
    }
    const openHexBtn = $('insp-open-hex');
    if (openHexBtn) {
      openHexBtn.onclick = () => openMemoryEditor(comp);
    }

    const fsmN = $<HTMLSelectElement>('fsm-n');
    if (fsmN && comp.internalState.fsm) {
      fsmN.onchange = e => {
        const f = comp.internalState.fsm!;
        const n = Number((e.target as HTMLSelectElement).value);
        const fit = (arr: number[], def: (i: number) => number) => Array.from({ length: n }, (_, i) => (i < arr.length ? arr[i] : def(i)));
        f.next0 = fit(f.next0, i => i).map(v => v % n);
        f.next1 = fit(f.next1, i => (i + 1) % n).map(v => v % n);
        f.out = fit(f.out, () => 0);
        f.n = n;
        if ((comp.internalState.fsmState || 0) >= n) comp.internalState.fsmState = 0;
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        saveHistorySnapshot();
        updateInspector();
        markDirty(200);
      };
      body.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-fsm]').forEach(el => {
        el.onchange = () => {
          const f = comp.internalState.fsm!;
          const i = Number(el.dataset.i);
          if (el.dataset.fsm === 'n0') f.next0[i] = Number(el.value);
          else if (el.dataset.fsm === 'n1') f.next1[i] = Number(el.value);
          else f.out[i] = (el as HTMLInputElement).checked ? 1 : 0;
          evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
          saveHistorySnapshot();
          markDirty(200);
        };
      });
      $('fsm-reset')!.onclick = () => {
        comp.internalState.fsmState = 0;
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        markDirty(200);
      };
    }

    const grpNameInp = $<HTMLInputElement>('insp-group-name');
    if (grpNameInp && comp.groupId) {
      grpNameInp.oninput = () => {
        const gid = comp.groupId;
        const val = grpNameInp.value;
        state.components.forEach(x => {
          if (x.groupId === gid) x.groupName = val;
        });
        markDirty(150);
      };
      grpNameInp.onchange = saveHistorySnapshot;
    }
    body.querySelectorAll<HTMLElement>('[data-gcol]').forEach(btn => {
      btn.onclick = () => {
        const gid = comp.groupId;
        const gcol = btn.dataset.gcol;
        if (!gid || !gcol) return;
        state.components.forEach(x => {
          if (x.groupId === gid) x.groupColor = gcol;
        });
        saveHistorySnapshot();
        updateInspector();
        markDirty(200);
      };
    });
    $('insp-group-select')?.addEventListener('click', () => {
      const gid = comp.groupId;
      if (!gid) return;
      state.selectedIds = new Set(state.components.filter(x => x.groupId === gid).map(x => x.id));
      updateInspector();
      markDirty(200);
    });
    $('insp-group-remove')?.addEventListener('click', ungroupSelection);

    $('insp-dup')!.onclick = duplicateSelection;
    $('insp-del')!.onclick = deleteSelection;
  }

  // =========================================================================
  // PRESETS, SINTETIZADOR, TABLA VERDAD, CUSTOM IC, RETOS, LOGICSCRIPT
  // =========================================================================
  function loadPresetCircuit(key: string): void {
    const built = buildPresetCircuit(key);
    state.components = built.components;
    state.wires = built.wires;
    state.analyzerSamples = [];
    state.selectedIds.clear();
    state.selectedWireId = null;

    if (built.recommendedMultiplier) {
      state.clockMultiplier = built.recommendedMultiplier;
      const mulSel = $<HTMLSelectElement>('clock-mult-selector');
      if (mulSel) mulSel.value = String(built.recommendedMultiplier);
      // Warm-up raster burst so VGA / DOOM 3D scene is visible immediately on load
      const clocks = state.components.filter(c => c.type === 'CLOCK');
      for (let i = 0; i < 4100; i++) {
        for (const clk of clocks) clk.internalState.clockOut = 0;
        solveNetwork(state.components, state.wires, false, state.customICs);
        evaluateSequentialEdges(state.components);
        for (const clk of clocks) clk.internalState.clockOut = 1;
        solveNetwork(state.components, state.wires, false, state.customICs);
        if (evaluateSequentialEdges(state.components)) {
          solveNetwork(state.components, state.wires, false, state.customICs);
        }
      }
    } else if (state.clockMultiplier >= 1000) {
      state.clockMultiplier = 1;
      const mulSel = $<HTMLSelectElement>('clock-mult-selector');
      if (mulSel) mulSel.value = '1';
    }

    evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
    saveHistorySnapshot();
    centerAndFitView();
    updateInspector();
    markDirty(400);
  }

  let lastTruthTableCSV = '';
  function openTruthTableModal(): void {
    const container = $('tt-container')!;
    const tt: TruthTableResult | null = computeTruthTable(state.components, state.wires, state.customICs);
    if (!tt) {
      container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-secondary);">Necesitas al menos una entrada (<span class="mono">SWITCH/BUTTON</span>) y una salida (<span class="mono">LED/PROBE</span>) en el lienzo.</div>`;
      $('truth-table-modal')?.classList.remove('hidden');
      return;
    }

    lastTruthTableCSV = tt.csv;
    let html = `<table class="tt-table"><thead><tr>`;
    tt.inHeaders.forEach(h => {
      html += `<th>${h}</th>`;
    });
    tt.outHeaders.forEach(h => {
      html += `<th style="color:var(--accent);">${h}</th>`;
    });
    html += `</tr></thead><tbody>`;

    tt.rows.forEach((row, rIdx) => {
      html += `<tr data-ridx="${rIdx}" title="Clic para probar esta fila en el circuito">`;
      row.inBits.forEach(bv => {
        html += `<td class="mono"><span class="bit-pill-${bv}">${bv}</span></td>`;
      });
      row.outBits.forEach(bv => {
        html += `<td class="mono"><span class="bit-pill-${bv}">${bv}</span></td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;

    container.querySelectorAll<HTMLElement>('tbody tr').forEach(tr => {
      tr.onclick = () => {
        const row = tt.rows[Number(tr.dataset.ridx)];
        tt.usedInputIds.forEach((id, idx) => {
          const inp = state.components.find(c => c.id === id);
          if (inp) inp.internalState.value = row.inBits[idx];
        });
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        saveHistorySnapshot();
        soundFX.playClick(true);
        showToast('Combinación inyectada en el circuito');
        markDirty(200);
      };
    });

    $('truth-table-modal')?.classList.remove('hidden');
  }

  function openCustomICModal(): void {
    const inputs = state.components.filter(c => ['SWITCH', 'BUTTON', 'HIGH', 'LOW', 'CONST_N'].includes(c.type));
    const outputs = state.components.filter(c => ['LED', 'PROBE', 'HEX_DISPLAY_N'].includes(c.type));
    $('custom-ic-summary')!.innerHTML = `
      <div>• Pines de Entrada detectados: <strong>${inputs.length}</strong> (${inputs.map((c, i) => c.label || `IN${i}`).join(', ') || 'Ninguno'})</div>
      <div style="margin-top:4px;">• Pines de Salida detectados: <strong>${outputs.length}</strong> (${outputs.map((c, i) => c.label || `OUT${i}`).join(', ') || 'Ninguno'})</div>
    `;
    $('custom-ic-modal')?.classList.remove('hidden');
  }

  function createCustomICFromCanvas(): void {
    const name = (($<HTMLInputElement>('custom-ic-name')?.value || 'CHIP_IC').trim().toUpperCase());
    const inputs = state.components.filter(c => ['SWITCH', 'BUTTON', 'HIGH', 'LOW', 'CONST_N'].includes(c.type));
    const outputs = state.components.filter(c => ['LED', 'PROBE', 'HEX_DISPLAY_N'].includes(c.type));

    if (inputs.length === 0 || outputs.length === 0) {
      showToast('El IC necesita al menos 1 entrada y 1 salida LED/Sonda/Display', 'warn');
      return;
    }

    const netCopy = deserializeCircuitData<{ components: LogicComponent[]; wires: Wire[] }>(
      serializeCircuitData({ components: state.components, wires: state.wires }, false)
    );
    const def: CustomICDef = {
      id: genId('ic'),
      name,
      inputs: inputs.map((c, i) => ({ compId: c.id, name: c.label || `I${i}`, width: c.bits || 1 })),
      outputs: outputs.map((c, i) => ({
        compId: c.id,
        pinId: c.type === 'HEX_DISPLAY_N' ? 'd' : 'in0',
        name: c.label || `O${i}`,
        width: c.bits || 1
      })),
      netlist: netCopy
    };

    state.customICs.push(def);
    renderComponentLibrary();
    $('custom-ic-modal')?.classList.add('hidden');
    soundFX.playPop(880);
    showToast(`Chip "${name}" guardado en Mis Chips (IC)`);
  }

  // =========================================================================
  // EDICIÓN INLINE, MENÚ CONTEXTUAL Y PALETA CTRL+K
  // =========================================================================
  function openInlineEditor(comp: LogicComponent): void {
    const input = $<HTMLInputElement>('inline-edit-input');
    if (!input) return;
    const rect = mainCanvas.getBoundingClientRect();
    const scr = worldToScreen(comp.x, comp.y);
    state.inlineEditCompId = comp.id;
    input.value = comp.type === 'LABEL' ? comp.noteText || '' : comp.label || '';
    input.style.left = `${Math.max(10, Math.min(window.innerWidth - 180, rect.left + scr.x - 75))}px`;
    input.style.top = `${Math.max(54, Math.min(window.innerHeight - 44, rect.top + scr.y - 16))}px`;
    input.classList.remove('hidden');
    input.focus();
    input.select();
  }

  function commitInlineEditor(save = true): void {
    const input = $<HTMLInputElement>('inline-edit-input');
    if (!input || input.classList.contains('hidden')) return;
    if (save && state.inlineEditCompId) {
      const comp = state.components.find(c => c.id === state.inlineEditCompId);
      if (comp) {
        if (comp.type === 'LABEL') comp.noteText = input.value.trim() || 'Nota';
        else comp.label = input.value.trim();
        saveHistorySnapshot();
        updateInspector();
        markDirty(200);
      }
    }
    state.inlineEditCompId = null;
    input.classList.add('hidden');
  }

  function hideContextMenu(): void {
    $('context-menu')?.classList.add('hidden');
  }

  function showContextMenu(sx: number, sy: number, wPos: { x: number; y: number }): void {
    const menu = $('context-menu');
    if (!menu) return;
    const compHit = hitTestComponent(wPos);
    const wireHit = compHit ? null : hitTestWire(wPos, 9 / state.view.zoom);
    const items: Array<{ label: string; danger?: boolean; action: () => void }> = [];

    if (compHit) {
      if (!state.selectedIds.has(compHit.id)) {
        state.selectedIds = new Set([compHit.id]);
        state.selectedWireId = null;
        updateInspector();
      }
      items.push({ label: 'Editar etiqueta / texto (F2)', action: () => openInlineEditor(compHit) });
      if (compHit.type === 'RAM_N' || compHit.type === 'ROM_N' || compHit.type === 'DUAL_RAM_N') {
        items.push({ label: 'Abrir Editor Hexadecimal', action: () => openMemoryEditor(compHit) });
      }
      items.push({ label: 'Duplicar selección (Ctrl+D)', action: duplicateSelection });
      if (state.selectedIds.size >= 2) {
        items.push({ label: '⊞ Agrupar selección (Ctrl+G)', action: () => groupSelection() });
      }
      if (compHit.groupId) {
        items.push({
          label: 'Seleccionar grupo entero',
          action: () => {
            state.selectedIds = new Set(state.components.filter(x => x.groupId === compHit.groupId).map(x => x.id));
            updateInspector();
            markDirty(200);
          }
        });
        items.push({ label: '⊟ Sacar del grupo (Ctrl+Shift+G)', action: ungroupSelection });
      }
      if (compHit.type !== 'LABEL') {
        items.push({ label: 'Rotar 90° (R)', action: () => rotateSelection(1) });
        items.push({ label: 'Voltear (H)', action: flipSelection });
        items.push({
          label: compHit.probe ? 'Quitar del Osciloscopio' : 'Enviar al Osciloscopio',
          action: () => {
            compHit.probe = !compHit.probe;
            saveHistorySnapshot();
            updateInspector();
            markDirty(200);
          }
        });
      }
      items.push({ label: 'Eliminar (Supr)', danger: true, action: deleteSelection });
    } else if (wireHit) {
      state.selectedIds.clear();
      state.selectedWireId = wireHit.id;
      updateInspector();
      items.push({
        label: '↺ Resetear curvatura del cable',
        action: () => {
          wireHit.curveOffset = 0;
          wireHit.waypoints = undefined;
          saveHistorySnapshot();
          updateInspector();
          markDirty(200);
          showToast('Trazado del cable reiniciado');
        }
      });
      items.push({ label: 'Convertir cable en Túnel inalámbrico', action: () => convertWireToTunnel(wireHit.id) });
      items.push({ label: 'Cambiar estilo Bézier / Ortogonal', action: () => $('btn-wire-style')?.click() });
      items.push({ label: 'Eliminar conductor (Supr)', danger: true, action: deleteSelection });
    } else {
      items.push({ label: 'Centrar y ajustar vista (F)', action: centerAndFitView });
      items.push({ label: 'Ordenar circuito automáticamente (O)', action: autoTidy });
      items.push({ label: 'Despejar cables largos → Túneles', action: () => convertLongWiresToTunnels(380) });
      items.push({ label: 'Limpiar cables huérfanos', action: cleanOrphanWires });
      items.push({ label: 'Sintetizador Booleano ƒ(x)', action: () => $('bool-synth-modal')?.classList.remove('hidden') });
      items.push({ label: 'Generar Tabla de Verdad', action: openTruthTableModal });
    }

    menu.innerHTML = items
      .map((it, idx) => `<button data-idx="${idx}" class="context-item ${it.danger ? 'danger' : ''}">${it.label}</button>`)
      .join('');
    menu.classList.remove('hidden');
    const mh = menu.offsetHeight || 160;
    const mw = menu.offsetWidth || 220;
    menu.style.left = `${Math.max(6, Math.min(window.innerWidth - mw - 8, sx))}px`;
    menu.style.top = `${Math.max(6, Math.min(window.innerHeight - mh - 8, sy))}px`;

    menu.querySelectorAll<HTMLElement>('.context-item').forEach(btn => {
      btn.onclick = () => {
        hideContextMenu();
        items[Number(btn.dataset.idx)].action();
      };
    });
  }

  function renderCommandPaletteList(q: string): void {
    const list = $('cmd-palette-list');
    if (!list) return;
    const query = q.trim().toLowerCase();
    const entries = [
      { tag: 'ACCIÓN', label: 'Abrir Modo Aprendizaje desde 0', run: openLearnModal },
      { tag: 'ACCIÓN', label: 'Agrupar componentes seleccionados (Ctrl+G)', run: () => groupSelection() },
      { tag: 'ACCIÓN', label: 'Desagrupar componentes seleccionados (Ctrl+Shift+G)', run: ungroupSelection },
      { tag: 'ACCIÓN', label: 'Sintetizador Booleano ƒ(x)', run: () => $('bool-synth-modal')?.classList.remove('hidden') },
      { tag: 'ACCIÓN', label: 'Generar Tabla de Verdad Automática', run: openTruthTableModal },
      { tag: 'ACCIÓN', label: 'Empaquetar Circuito como Chip IC', run: openCustomICModal },
      { tag: 'ACCIÓN', label: 'Centrar y Ajustar Vista (F)', run: centerAndFitView },
      { tag: 'ACCIÓN', label: 'Alternar Visibilidad de Cables (Todos / Activos / Foco)', run: () => $('btn-wire-vis')?.click() },
      { tag: 'ACCIÓN', label: 'Despejar cables largos → Túneles inalámbricos (>380px)', run: () => convertLongWiresToTunnels(380) },
      { tag: 'ACCIÓN', label: 'Exportar circuito actual a Logisim-evolution (.circ)', run: () => { $('btn-script')?.click(); $('script-tab-circ')?.click(); } },
      { tag: 'ACCIÓN', label: 'Exportar Captura PNG', run: () => $('btn-export-png')?.click() },
      { tag: 'ACCIÓN', label: 'Abrir editor LogicScript (circuito actual + Logisim)', run: () => $('btn-script')?.click() },
      { tag: 'ACCIÓN', label: 'Abrir Modo Ejercicios (Retos)', run: () => $('btn-challenges')?.click() },
      { tag: 'ACCIÓN', label: 'Ordenar circuito automáticamente (O)', run: autoTidy },
      { tag: 'ACCIÓN', label: 'Ajustes (trackpad, doble clic, osciloscopio, cables…)', run: () => $('btn-settings')?.click() },
      { tag: 'ACCIÓN', label: 'Atajos de teclado (?)', run: () => $('btn-shortcuts')?.click() },
      ...state.components
        .filter(c => c.label)
        .map(c => ({
          tag: 'EN LIENZO',
          label: `Ir a "${c.label}" (${c.type})`,
          run: () => {
            const wrap = $('canvas-wrapper')!.getBoundingClientRect();
            state.selectedIds = new Set([c.id]);
            state.view.targetZoom = Math.max(0.85, state.view.zoom);
            state.view.targetX = wrap.width / 2 - c.x * state.view.targetZoom;
            state.view.targetY = wrap.height / 2 - c.y * state.view.targetZoom;
            updateInspector();
            markDirty(300);
          }
        })),
      ...COMPONENT_CATALOG.map(c => ({
        tag: 'COMPONENTE',
        label: `Añadir ${c.name} (${c.badge})`,
        run: () => {
          const wrap = $('canvas-wrapper')!.getBoundingClientRect();
          const cw = screenToWorld(wrap.width / 2, wrap.height / 2);
          addComponentToCanvas(c.type, cw.x, cw.y);
        }
      }))
    ].filter(e => !query || e.label.toLowerCase().includes(query) || e.tag.toLowerCase().includes(query));

    list.innerHTML = entries
      .slice(0, 16)
      .map(
        (e, idx) => `
        <button data-idx="${idx}" class="context-item">
          <span>${e.label}</span>
          <span class="beta-badge">${e.tag}</span>
        </button>
      `
      )
      .join('');

    list.querySelectorAll<HTMLElement>('button').forEach(btn => {
      btn.onclick = () => {
        $('cmd-palette-modal')?.classList.add('hidden');
        entries[Number(btn.dataset.idx)].run();
      };
    });
  }

  function openCommandPalette(): void {
    const modal = $('cmd-palette-modal');
    const input = $<HTMLInputElement>('cmd-palette-input');
    if (!modal || !input) return;
    modal.classList.remove('hidden');
    input.value = '';
    renderCommandPaletteList('');
    input.focus();
  }

  function autoTidy(): void {
    const comps = state.components.filter(c => c.type !== 'LABEL');
    if (!comps.length) {
      showToast('No hay nada que ordenar', 'warn');
      return;
    }
    lsLayout(comps, state.wires, 0, 0);
    saveHistorySnapshot();
    centerAndFitView();
    soundFX.playPop(700);
    showToast('Circuito ordenado automáticamente');
  }

  // =========================================================================
  // MODO EJERCICIOS (RETOS)
  // =========================================================================
  let chalDone: Record<string, boolean> = {};
  try {
    chalDone = JSON.parse(readStorageWithFallback(CHAL_KEY, LEGACY_CHAL_KEY) || '{}') || {};
  } catch {
    chalDone = {};
  }
  let activeChal: ChallengeDef | null = null;
  let chalResult: ChallengeValidationResult | null = null;

  const findLabeled = (name: string, types: string[]) =>
    state.components.find(c => types.includes(c.type) && (c.label || '').trim().toUpperCase() === name.toUpperCase());

  function prepareChallengeCanvas(ch: ChallengeDef): void {
    let added = 0;
    const make = (type: string, label: string, x: number, y: number) => {
      state.components.push(createComponent(type, x, y, { label }));
      added++;
    };
    const wrap = $('canvas-wrapper')!.getBoundingClientRect();
    const cx = (wrap.width / 2 - state.view.x) / state.view.zoom;
    const cy = (wrap.height / 2 - state.view.y) / state.view.zoom;
    ch.inputs.forEach((n, i) => {
      if (!findLabeled(n, ['SWITCH'])) make('SWITCH', n, cx - 220, cy + (i - (ch.inputs.length - 1) / 2) * 60);
    });
    ch.outputs.forEach((n, i) => {
      if (!findLabeled(n, ['LED', 'PROBE'])) make('LED', n, cx + 220, cy + (i - (ch.outputs.length - 1) / 2) * 60);
    });
    if (added) {
      evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
      saveHistorySnapshot();
      updateStatusBar();
      soundFX.playPop(780);
      showToast(`Lienzo preparado (${added} componentes)`);
      markDirty(250);
    } else {
      showToast('Ya tienes todas las entradas y salidas');
    }
  }

  function updateChallengeBar(): void {
    const bar = $('challenge-bar');
    if (!bar) return;
    bar.classList.toggle('hidden', !activeChal);
    document.body.classList.toggle('challenge-active', Boolean(activeChal));
    if (!activeChal) return;
    $('chal-bar-title')!.textContent = activeChal.title;
    const st = $('chal-bar-status')!;
    st.className = 'chal-status';
    if (!chalResult) st.textContent = chalDone[activeChal.id] ? '✔ Completado' : 'Sin validar';
    else if (chalResult.missing.length) {
      st.textContent = `Falta: ${chalResult.missing[0]}${chalResult.missing.length > 1 ? ` +${chalResult.missing.length - 1}` : ''}`;
      st.classList.add('bad');
    } else if (chalResult.ok) {
      st.textContent = '✔ ¡Correcto!';
      st.classList.add('ok');
    } else {
      const bad = chalResult.rows.filter(r => !r.ok).length;
      st.textContent = `✖ ${bad} de ${chalResult.rows.length} fallan`;
      st.classList.add('bad');
    }
  }

  function renderChallengeList(): void {
    const doneCount = CHALLENGES.filter(c => chalDone[c.id]).length;
    $('chal-progress-text')!.textContent = `${doneCount}/${CHALLENGES.length}`;
    ($('chal-progress-fill') as HTMLElement).style.width = `${(doneCount / CHALLENGES.length) * 100}%`;
    const list = $('chal-list')!;
    let lastGroup = '';
    list.innerHTML = CHALLENGES.map((c, i) => {
      const head =
        c.group !== lastGroup
          ? `<div class="chal-group">${c.group} · ${CHALLENGES.filter(x => x.group === c.group && chalDone[x.id]).length}/${CHALLENGES.filter(x => x.group === c.group).length}</div>`
          : '';
      lastGroup = c.group;
      return `${head}<button class="chal-card ${chalDone[c.id] ? 'done' : ''} ${activeChal && activeChal.id === c.id ? 'active' : ''}" data-cid="${c.id}">
        <span class="chal-num">${chalDone[c.id] ? '✓' : i + 1}</span>
        <span class="chal-meta"><strong>${c.title}</strong><span>${c.inputs.length} entradas · ${c.outputs.length} salidas${c.steps ? ' · con reloj' : ''}</span></span>
        <span class="chal-stars">${'★'.repeat(c.level)}${'☆'.repeat(3 - c.level)}</span>
      </button>`;
    }).join('');
    list.querySelectorAll<HTMLElement>('.chal-card').forEach(b => {
      b.onclick = () => {
        activeChal = CHALLENGES.find(c => c.id === b.dataset.cid) || null;
        chalResult = null;
        renderChallengeList();
        renderChallengeDetail();
        updateChallengeBar();
      };
    });
  }

  function renderChallengeDetail(): void {
    const box = $('chal-detail')!;
    if (!activeChal) {
      box.innerHTML = '';
      return;
    }
    const ch = activeChal;
    let table = '';
    if (chalResult) {
      if (chalResult.missing.length) {
        table = `<p style="color:var(--danger); font-size:11.5px;">Faltan en el lienzo: ${chalResult.missing.join(', ')}.</p>`;
      } else {
        const rows = chalResult.rows.slice().sort((a, b) => (a.ok === b.ok ? 0 : a.ok ? 1 : -1));
        const shown = rows.slice(0, 16);
        table = `<table class="chal-table mono"><thead><tr><th>${ch.steps ? 'Paso' : 'Entradas'}</th><th>Esperado</th><th>Obtenido</th><th></th></tr></thead><tbody>
          ${shown.map(r => `<tr class="${r.ok ? '' : 'bad'}"><td>${r.label || '—'}</td><td>${r.exp}</td><td>${r.got}</td><td>${r.ok ? '✔' : '✖'}</td></tr>`).join('')}
        </tbody></table>${rows.length > shown.length ? `<p style="font-size:10.5px; color:var(--text-muted);">Mostrando 16 de ${rows.length} filas (primero las que fallan).</p>` : ''}`;
      }
    }
    box.innerHTML = `
      <div class="chal-detail">
        <strong style="font-size:13px;">${ch.title}</strong>
        <p style="font-size:12px; color:var(--text-secondary);">${ch.desc}</p>
        ${ch.hint ? `<div class="chal-hint-box">💡 <strong>Pista:</strong> ${ch.hint}</div>` : ''}
        <div class="chal-io"><span>Entradas:</span>${ch.inputs.map(n => `<span class="chal-pill in">${n}</span>`).join('')}<span style="margin-left:8px;">Salidas:</span>${ch.outputs.map(n => `<span class="chal-pill out">${n}</span>`).join('')}</div>
        ${ch.steps ? '<p style="font-size:11px; color:var(--text-muted);">Conecta el interruptor CLK a los relojes de tus flip-flops: se pulsa solo al validar.</p>' : ''}
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button id="chal-prepare" class="btn">Preparar lienzo</button>
          <button id="chal-validate" class="btn btn-accent">Validar mi circuito</button>
          <button id="chal-close-go" class="btn">Ir al lienzo</button>
        </div>
        ${table}
      </div>`;
    if (!chalResult) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    $('chal-prepare')!.onclick = () => prepareChallengeCanvas(ch);
    $('chal-validate')!.onclick = runChallengeValidation;
    $('chal-close-go')!.onclick = () => $('challenges-modal')?.classList.add('hidden');
  }

  function runChallengeValidation(): void {
    if (!activeChal) return;
    chalResult = validateChallenge(activeChal, state.components, state.wires, state.customICs);
    if (chalResult.ok) {
      const first = !chalDone[activeChal.id];
      chalDone[activeChal.id] = true;
      try {
        localStorage.setItem(CHAL_KEY, JSON.stringify(chalDone));
      } catch {
        // ignore
      }
      soundFX.playPop(988);
      const wrap = $('canvas-wrapper')!.getBoundingClientRect();
      const c = screenToWorld(wrap.width / 2, wrap.height / 2);
      spawnSparks(c.x, c.y, 28);
      spawnRipple(c.x, c.y, null, 90);
      showToast(first ? '🎉 ¡Reto superado!' : '✔ Circuito correcto');
    } else if (!chalResult.missing.length) {
      soundFX.playClick(false);
      showToast('El circuito aún no cumple la tabla', 'warn');
    } else {
      showToast('Faltan entradas o salidas etiquetadas', 'warn');
    }
    renderChallengeList();
    renderChallengeDetail();
    updateChallengeBar();
  }

  // =========================================================================
  // LOGICSCRIPT Y AJUSTES
  // =========================================================================
  async function copyText(text: string, okMsg: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      showToast(okMsg);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      ta.remove();
      showToast(ok ? okMsg : 'No se pudo copiar automáticamente', ok ? 'info' : 'warn');
    }
  }

  function initSettingsUI(): void {
    const sync = () => {
      ($<HTMLInputElement>('set-dbl')!).checked = SETTINGS.dblclickEdit;
      ($<HTMLInputElement>('set-analyzer-start')!).checked = SETTINGS.openAnalyzerOnStart;
      ($<HTMLSelectElement>('set-nav')!).value = SETTINGS.navigationMode;
      ($<HTMLSelectElement>('set-quality')!).value = SETTINGS.quality;
      const ecoInp = $<HTMLInputElement>('set-eco');
      if (ecoInp) ecoInp.checked = Boolean(SETTINGS.ecoMode);
      ($<HTMLInputElement>('set-particles')!).checked = SETTINGS.particles;
      ($<HTMLInputElement>('set-snap')!).checked = SETTINGS.snap;
      ($<HTMLSelectElement>('set-wire')!).value = state.wireStyle;
      ($<HTMLSelectElement>('set-wire-vis')!).value = state.wireVisibility;
      ($<HTMLSelectElement>('set-def-bits')!).value = String(SETTINGS.defaultBitWidth);
      ($<HTMLInputElement>('set-minimap')!).checked = SETTINGS.showMinimap;
      ($<HTMLInputElement>('set-helpbar')!).checked = SETTINGS.showFloatingHelp;

      const fpsSel = $<HTMLSelectElement>('set-fps');
      if (fpsSel) fpsSel.value = String(SETTINGS.fpsCap || 60);
      const turboSel = $<HTMLSelectElement>('set-turbo-cycles');
      if (turboSel) turboSel.value = String(SETTINGS.turboMaxCycles || 512);
      const gridInp = $<HTMLInputElement>('set-grid');
      if (gridInp) gridInp.checked = SETTINGS.showGrid !== false;
      const wlInp = $<HTMLInputElement>('set-wire-labels');
      if (wlInp) wlInp.checked = SETTINGS.showWireLabels !== false;
      const redInp = $<HTMLInputElement>('set-reduce-anim');
      if (redInp) redInp.checked = Boolean(SETTINGS.reduceAnimations);
      const fpsHudInp = $<HTMLInputElement>('set-fps-hud');
      if (fpsHudInp) fpsHudInp.checked = Boolean(SETTINGS.showFpsCounter);

      document.querySelectorAll<HTMLElement>('.perf-profile-btn').forEach(btn => {
        btn.classList.toggle('btn-active', btn.dataset.profile === (SETTINGS.perfProfile || 'balanced'));
      });
    };

    const applyPerfProfile = (prof: PerfProfile) => {
      SETTINGS.perfProfile = prof;
      if (prof === 'high') {
        SETTINGS.quality = 'high';
        SETTINGS.ecoMode = false;
        SETTINGS.fpsCap = 60;
        SETTINGS.particles = true;
        SETTINGS.showGrid = true;
        SETTINGS.showWireLabels = true;
        SETTINGS.reduceAnimations = false;
        SETTINGS.turboMaxCycles = 2048;
      } else if (prof === 'balanced') {
        SETTINGS.quality = 'auto';
        SETTINGS.ecoMode = false;
        SETTINGS.fpsCap = 60;
        SETTINGS.particles = true;
        SETTINGS.showGrid = true;
        SETTINGS.showWireLabels = true;
        SETTINGS.reduceAnimations = false;
        SETTINGS.turboMaxCycles = 512;
      } else if (prof === 'eco') {
        SETTINGS.quality = 'eco';
        SETTINGS.ecoMode = true;
        SETTINGS.fpsCap = 30;
        SETTINGS.particles = false;
        SETTINGS.showGrid = true;
        SETTINGS.showWireLabels = false;
        SETTINGS.reduceAnimations = true;
        SETTINGS.turboMaxCycles = 256;
      } else {
        SETTINGS.quality = 'eco';
        SETTINGS.ecoMode = true;
        SETTINGS.fpsCap = 15;
        SETTINGS.particles = false;
        SETTINGS.showGrid = false;
        SETTINGS.showWireLabels = false;
        SETTINGS.reduceAnimations = true;
        SETTINGS.turboMaxCycles = 128;
      }
      FX.degraded = false;
      applyVisualSettings();
      savePrefs();
      sync();
      state.analyzerDirty = true;
      markDirty(300);
      const labels: Record<PerfProfile, string> = {
        high: 'Alta Calidad',
        balanced: 'Balanceado',
        eco: 'Portátil Eco',
        potato: 'Ultra Ligero (Máx. ahorro)'
      };
      showToast(`Perfil aplicado: ${labels[prof]}`);
    };

    document.querySelectorAll<HTMLElement>('.perf-profile-btn').forEach(btn => {
      btn.onclick = () => applyPerfProfile((btn.dataset.profile as PerfProfile) || 'balanced');
    });

    $('btn-settings')!.onclick = () => {
      sync();
      $('settings-modal')?.classList.remove('hidden');
    };
    $<HTMLSelectElement>('set-fps')?.addEventListener('change', e => {
      SETTINGS.fpsCap = (Number((e.target as HTMLSelectElement).value) || 60) as 60 | 30 | 15 | 10;
      savePrefs();
      markDirty(200);
    });
    $<HTMLSelectElement>('set-turbo-cycles')?.addEventListener('change', e => {
      SETTINGS.turboMaxCycles = Number((e.target as HTMLSelectElement).value) || 512;
      savePrefs();
    });
    $<HTMLInputElement>('set-dbl')!.onchange = e => {
      SETTINGS.dblclickEdit = (e.target as HTMLInputElement).checked;
      savePrefs();
      showToast(SETTINGS.dblclickEdit ? 'Doble clic para editar etiqueta: activado' : 'Doble clic para editar: desactivado (usa F2)');
    };
    $<HTMLInputElement>('set-analyzer-start')!.onchange = e => {
      SETTINGS.openAnalyzerOnStart = (e.target as HTMLInputElement).checked;
      savePrefs();
      showToast(SETTINGS.openAnalyzerOnStart ? 'Osciloscopio al abrir: activado' : 'Osciloscopio al abrir: oculto');
    };
    $<HTMLSelectElement>('set-nav')!.onchange = e => {
      SETTINGS.navigationMode = (e.target as HTMLSelectElement).value as NavigationMode;
      savePrefs();
    };
    $<HTMLSelectElement>('set-quality')!.onchange = e => {
      SETTINGS.quality = (e.target as HTMLSelectElement).value as QualityMode;
      if (SETTINGS.quality === 'eco') SETTINGS.ecoMode = true;
      const ecoInp = $<HTMLInputElement>('set-eco');
      if (ecoInp) ecoInp.checked = Boolean(SETTINGS.ecoMode);
      FX.degraded = false;
      savePrefs();
      state.analyzerDirty = true;
      markDirty(300);
    };
    $<HTMLInputElement>('set-eco')?.addEventListener('change', e => {
      SETTINGS.ecoMode = (e.target as HTMLInputElement).checked;
      if (!SETTINGS.ecoMode && SETTINGS.quality === 'eco') {
        SETTINGS.quality = 'auto';
        const qSel = $<HTMLSelectElement>('set-quality');
        if (qSel) qSel.value = 'auto';
      }
      FX.degraded = false;
      savePrefs();
      state.analyzerDirty = true;
      markDirty(300);
      showToast(SETTINGS.ecoMode ? 'Modo Eco activado (ahorro CPU/batería)' : 'Modo Eco desactivado');
    });
    $<HTMLInputElement>('set-particles')!.onchange = e => {
      SETTINGS.particles = (e.target as HTMLInputElement).checked;
      savePrefs();
      markDirty(300);
    };
    $<HTMLInputElement>('set-grid')?.addEventListener('change', e => {
      SETTINGS.showGrid = (e.target as HTMLInputElement).checked;
      savePrefs();
      markDirty(250);
    });
    $<HTMLInputElement>('set-wire-labels')?.addEventListener('change', e => {
      SETTINGS.showWireLabels = (e.target as HTMLInputElement).checked;
      savePrefs();
      markDirty(250);
    });
    $<HTMLInputElement>('set-reduce-anim')?.addEventListener('change', e => {
      SETTINGS.reduceAnimations = (e.target as HTMLInputElement).checked;
      applyVisualSettings();
      savePrefs();
    });
    $<HTMLInputElement>('set-fps-hud')?.addEventListener('change', e => {
      SETTINGS.showFpsCounter = (e.target as HTMLInputElement).checked;
      applyVisualSettings();
      savePrefs();
    });
    $<HTMLInputElement>('set-snap')!.onchange = e => {
      SETTINGS.snap = (e.target as HTMLInputElement).checked;
      savePrefs();
    };
    $<HTMLSelectElement>('set-wire')!.onchange = e => {
      const val = (e.target as HTMLSelectElement).value as WireStyle;
      if (state.wireStyle !== val) $('btn-wire-style')?.click();
      savePrefs();
      markDirty(300);
    };
    $<HTMLSelectElement>('set-wire-vis')!.onchange = e => {
      state.wireVisibility = (e.target as HTMLSelectElement).value as WireVisibilityMode;
      updateWireVisButton();
      savePrefs();
      markDirty(300);
    };
    $<HTMLSelectElement>('set-def-bits')!.onchange = e => {
      SETTINGS.defaultBitWidth = Number((e.target as HTMLSelectElement).value) || 8;
      syncLibBitsBar();
      renderComponentLibrary();
      savePrefs();
    };
    $<HTMLInputElement>('set-minimap')!.onchange = e => {
      SETTINGS.showMinimap = (e.target as HTMLInputElement).checked;
      applyVisualSettings();
      savePrefs();
    };
    $<HTMLInputElement>('set-helpbar')!.onchange = e => {
      SETTINGS.showFloatingHelp = (e.target as HTMLInputElement).checked;
      applyVisualSettings();
      savePrefs();
    };
    $('set-tidy')!.onclick = () => {
      $('settings-modal')?.classList.add('hidden');
      autoTidy();
    };
    $('set-reset')!.onclick = () => {
      Object.assign(SETTINGS, DEFAULT_SETTINGS);
      state.wireStyle = DEFAULT_SETTINGS.defaultWireStyle;
      state.wireVisibility = DEFAULT_SETTINGS.wireVisibility;
      state.clockMultiplier = DEFAULT_SETTINGS.clockMultiplier;
      FX.degraded = false;
      $('wire-style-label')!.textContent = 'Bézier';
      applyVisualSettings();
      syncLibBitsBar();
      renderComponentLibrary();
      savePrefs();
      sync();
      markDirty(300);
      showToast('Ajustes restablecidos');
    };
  }

  function syncLibBitsBar(): void {
    const bw = SETTINGS.defaultBitWidth || 8;
    document.querySelectorAll<HTMLElement>('#lib-bits-bar [data-bits]').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.bits) === bw);
    });
    const defSel = $<HTMLSelectElement>('set-def-bits');
    if (defSel) defSel.value = String(bw);
  }

  function initScriptUI(): void {
    const modal = $('script-modal');
    const ta = $<HTMLTextAreaElement>('script-input');
    const out = $('script-out');
    const errTools = $('script-error-tools');
    const logisimTa = $<HTMLTextAreaElement>('logisim-output');
    const logisimOut = $('logisim-out');
    const tabLs = $('script-tab-ls');
    const tabCirc = $('script-tab-circ');
    const panelLs = $('script-panel-ls');
    const panelCirc = $('script-panel-circ');
    if (!modal || !ta || !out) return;

    let lastErrors: LogicScriptDiagnostic[] = [];
    let lastWarnings: string[] = [];

    const jumpToLine = (lineNo: number) => {
      const lines = ta.value.split(/\r?\n/);
      let offset = 0;
      const targetIdx = Math.max(0, Math.min(lines.length - 1, lineNo - 1));
      for (let i = 0; i < targetIdx; i++) {
        offset += lines[i].length + 1;
      }
      const lineLen = lines[targetIdx]?.length || 0;
      ta.focus();
      ta.setSelectionRange(offset, offset + lineLen);
    };

    const refreshLogisim = () => {
      if (!logisimTa || !logisimOut) return;
      const res = exportCircuitToLogisimCirc(state.components, state.wires, 'main');
      logisimTa.value = res.xml;
      logisimOut.className = 'script-out ok';
      logisimOut.innerHTML =
        `<strong>✔ Transcrito a Logisim-evolution (.circ):</strong> ${res.compCount} componente(s) y ${res.wireCount} conexión(es) desde tu circuito actual.` +
        (res.warnings.length
          ? res.warnings
              .slice(0, 6)
              .map(w => `<div class="warn">ℹ ${w.replace(/</g, '&lt;')}</div>`)
              .join('')
          : '');
    };

    const setActiveTab = (which: 'ls' | 'circ') => {
      tabLs?.classList.toggle('active', which === 'ls');
      tabCirc?.classList.toggle('active', which === 'circ');
      panelLs?.classList.toggle('hidden', which !== 'ls');
      panelCirc?.classList.toggle('hidden', which !== 'circ');
      if (which === 'circ') refreshLogisim();
    };

    tabLs?.addEventListener('click', () => setActiveTab('ls'));
    tabCirc?.addEventListener('click', () => setActiveTab('circ'));

    const run = () => {
      const replace = $<HTMLInputElement>('script-replace')?.checked ?? true;
      const res = compileLogicScript(ta.value, state.components, replace, state.customICs);
      lastErrors = res.errors;
      lastWarnings = res.warnings;

      if (res.errors.length) {
        errTools?.classList.remove('hidden');
        out.className = 'script-out bad';
        const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        out.innerHTML =
          `<strong>✖ ${res.errors.length} error${res.errors.length > 1 ? 'es' : ''} (clic en un error para ir a la línea)</strong>` +
          res.errors
            .slice(0, 12)
            .map(
              e => `
              <button type="button" class="script-err-item" data-errline="${e.line}">
                <span><strong>Línea ${e.line}:</strong> ${esc(e.msg)}</span>
                ${e.sourceLine ? `<span class="script-err-code mono">${esc(e.sourceLine.trim())}</span>` : ''}
                ${e.suggestion ? `<span class="script-err-hint">💡 ${esc(e.suggestion)}</span>` : ''}
              </button>`
            )
            .join('') +
          (res.errors.length > 12 ? `<div>… y ${res.errors.length - 12} más</div>` : '');
        out.querySelectorAll<HTMLElement>('[data-errline]').forEach(btn => {
          btn.onclick = () => jumpToLine(Number(btn.dataset.errline));
        });
        return;
      }

      errTools?.classList.add('hidden');
      if (replace) {
        state.components = res.components || [];
        state.wires = res.wireList || [];
        state.analyzerSamples = [];
      } else {
        state.components.push(...(res.components || []));
        state.wires.push(...(res.wireList || []));
      }
      state.selectedIds.clear();
      state.selectedWireId = null;
      saveHistorySnapshot();
      centerAndFitView();
      updateInspector();
      soundFX.playPop(820);
      markDirty(350);

      out.className = 'script-out ok';
      out.innerHTML =
        `<strong>✔ Circuito construido:</strong> ${res.comps} componentes y ${res.wires} cables.` +
        (res.warnings.length
          ? res.warnings
              .slice(0, 6)
              .map(w => `<div class="warn">⚠ ${w.replace(/</g, '&lt;')}</div>`)
              .join('')
          : '');
      showToast(`Construido: ${res.comps} componentes`);
      try {
        localStorage.setItem(SCRIPT_KEY, ta.value);
      } catch {
        // ignore
      }
    };

    $('btn-script')!.onclick = () => {
      ta.value = exportCircuitToLogicScript(state.components, state.wires);
      lastErrors = [];
      lastWarnings = [];
      errTools?.classList.add('hidden');
      out.className = 'script-out';
      out.innerHTML = '';
      refreshLogisim();
      setActiveTab('ls');
      modal.classList.remove('hidden');
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(0, 0);
        ta.scrollTop = 0;
      }, 50);
    };
    $('script-run')!.onclick = run;
    $('script-export')!.onclick = () => {
      ta.value = exportCircuitToLogicScript(state.components, state.wires);
      lastErrors = [];
      lastWarnings = [];
      errTools?.classList.add('hidden');
      out.className = 'script-out ok';
      out.innerHTML = '<strong>Circuito actual transcrito.</strong> Puedes editarlo, construirlo o pasárselo a una IA.';
    };
    $('script-copy')!.onclick = () => copyText(ta.value, 'Script copiado');
    $('script-copy-err')?.addEventListener('click', () => {
      const txt = formatLogicScriptDiagnosticsForAI(ta.value, lastErrors, lastWarnings, false);
      void copyText(txt, 'Diagnóstico de error copiado para pegar a una IA');
    });
    $('script-copy-err-all')?.addEventListener('click', () => {
      const txt = formatLogicScriptDiagnosticsForAI(ta.value, lastErrors, lastWarnings, true);
      void copyText(txt, 'Diagnóstico + script completo copiados para IA');
    });
    $('script-copy-prompt')!.onclick = () =>
      copyText(generateLogicScriptAIPrompt(), 'Prompt para IA copiado: pégalo en tu chat y añade tu petición');
    $('logisim-refresh')?.addEventListener('click', () => {
      refreshLogisim();
      showToast('XML Logisim-evolution actualizado desde tu lienzo');
    });
    $('logisim-copy')?.addEventListener('click', () => {
      if (logisimTa) copyText(logisimTa.value, 'XML Logisim-evolution (.circ) copiado');
    });
    $('logisim-download')?.addEventListener('click', () => {
      if (!logisimTa) return;
      refreshLogisim();
      const blob = new Blob([logisimTa.value], { type: 'application/xml;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'circuito_logisim_evolution.circ';
      a.click();
      showToast('Archivo .circ descargado para Logisim-evolution');
    });
    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = ta.selectionStart;
        ta.setRangeText('  ', s, ta.selectionEnd, 'end');
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        run();
      }
    });
    $('btn-shortcuts')!.onclick = () => $('shortcuts-modal')?.classList.remove('hidden');
  }

  // =========================================================================
  // EVENTOS DE RATÓN, TRACKPAD, MULTI-TOUCH Y TECLADO
  // =========================================================================
  function loadJsonFile(file: File): void {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = String(ev.target?.result || '');
        const parsed = parseCircuitImport(text);
        state.components = parsed.components;
        state.wires = parsed.wires;
        state.customICs = parsed.customICs;
        state.selectedIds.clear();
        state.selectedWireId = null;
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        renderComponentLibrary();
        updateInspector();
        saveHistorySnapshot();
        centerAndFitView();
        showToast(parsed.format === 'lspro' ? `Proyecto .lspro (v${parsed.version}) cargado` : 'Circuito JSON cargado');
      } catch {
        showToast('No se pudo leer el archivo (.lspro / .json)', 'warn');
      }
    };
    reader.onerror = () => showToast('Error leyendo el archivo', 'warn');
    reader.readAsText(file);
  }

  let recentTrackpadAt = 0;
  let lastWireHitAt = 0;
  const activePointers = new Map<number, { sx: number; sy: number }>();
  let prevPinchDist: number | null = null;
  let prevPinchMid: { sx: number; sy: number } | null = null;

  function applyZoomAtScreen(sx: number, sy: number, factor: number): void {
    const newZoom = Math.max(0.25, Math.min(3.0, state.view.zoom * factor));
    state.view.x = sx - (sx - state.view.x) * (newZoom / state.view.zoom);
    state.view.y = sy - (sy - state.view.y) * (newZoom / state.view.zoom);
    state.view.zoom = newZoom;
    state.view.targetX = null;
    const readout = $('zoom-readout');
    if (readout) readout.textContent = `${Math.round(newZoom * 100)}%`;
    markDirty(200);
  }

  function handleGamepadClick(comp: LogicComponent, wPos: { x: number; y: number }): boolean {
    const lx = wPos.x - comp.x;
    const ly = wPos.y - comp.y;
    let bitMask = 0;
    if (Math.abs(lx - -18) <= 13 && Math.abs(ly - -24) <= 11) bitMask = 1; // W
    else if (Math.abs(lx - -42) <= 13 && Math.abs(ly - -1) <= 11) bitMask = 4; // A
    else if (Math.abs(lx - -18) <= 13 && Math.abs(ly - -1) <= 11) bitMask = 2; // S
    else if (Math.abs(lx - 6) <= 13 && Math.abs(ly - -1) <= 11) bitMask = 8; // D
    else if (Math.abs(lx - -18) <= 28 && Math.abs(ly - 22) <= 11) bitMask = 16; // FIRE
    if (!bitMask) return false;
    comp.internalState.gamepadBits = (comp.internalState.gamepadBits || 0) | bitMask;
    state.activeGamepadId = comp.id;
    evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
    markDirty(200);
    return true;
  }

  function toLocalCoords(comp: LogicComponent, wPos: { x: number; y: number }) {
    let lx = wPos.x - comp.x;
    let ly = wPos.y - comp.y;
    const rot = ((comp.rot || 0) % 4 + 4) % 4;
    for (let i = 0; i < rot; i++) {
      const nx = ly;
      const ny = -lx;
      lx = nx;
      ly = ny;
    }
    if (comp.flip) lx = -lx;
    return { lx, ly };
  }

  function handleStepperClick(comp: LogicComponent, wPos: { x: number; y: number }, shift: boolean): boolean {
    const { lx, ly } = toLocalCoords(comp, wPos);
    let delta = 0n;
    const step = shift ? 10n : 1n;
    if (Math.abs(lx - -38) <= 13 && Math.abs(ly - 4) <= 12) delta = -step;
    else if (Math.abs(lx - 30) <= 13 && Math.abs(ly - 4) <= 12) delta = step;
    if (delta === 0n) return false;
    const bw = comp.bits || 8;
    const cur = BigInt(comp.internalState.value || 0);
    comp.internalState.value = toUintN(cur + delta, bw);
    spawnRipple(comp.x, comp.y);
    soundFX.playClick(delta > 0n);
    evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
    saveHistorySnapshot();
    updateInspector();
    markDirty(200);
    return true;
  }

  function handleRotaryClick(comp: LogicComponent, wPos: { x: number; y: number }, shift: boolean): boolean {
    const { lx } = toLocalCoords(comp, wPos);
    const delta = lx < -8 ? (shift ? -8 : -1) : (shift ? 8 : 1);
    comp.internalState.encPos = (Number(comp.internalState.encPos || 0) + delta) & 255;
    spawnRipple(comp.x, comp.y);
    soundFX.playClick(delta > 0);
    evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
    saveHistorySnapshot();
    updateInspector();
    markDirty(200);
    return true;
  }

  function handleSliderInput(comp: LogicComponent, wPos: { x: number; y: number }, hitOnly: boolean): boolean {
    const { lx, ly } = toLocalCoords(comp, wPos);
    if (hitOnly && (lx < -52 || lx > 44 || Math.abs(ly) > 18)) return false;
    const tx0 = -44;
    const tx1 = 36;
    const frac = Math.max(0, Math.min(1, (lx - tx0) / (tx1 - tx0)));
    const b = Math.max(1, Math.min(64, comp.bits || 8));
    const maxU = maskBits(b);
    const scaled = maxU <= 1000000n ? BigInt(Math.round(frac * Number(maxU))) : (BigInt(Math.round(frac * 10000)) * maxU) / 10000n;
    comp.internalState.adcVal = scaled <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(scaled) : scaled;
    comp.internalState.value = scaled;
    evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
    updateLiveInspectorSignals();
    markDirty(180);
    return true;
  }

  function initEvents(): () => void {
    const cleanups: Array<() => void> = [];
    const on = <E extends Event = Event>(target: EventTarget, type: string, fn: (e: E) => void, opts?: AddEventListenerOptions | boolean) => {
      target.addEventListener(type, fn as EventListener, opts);
      cleanups.push(() => target.removeEventListener(type, fn as EventListener, opts));
    };

    $('component-search')?.addEventListener('input', renderComponentLibrary);
    const catFilterEl = $<HTMLSelectElement>('lib-cat-filter');
    if (catFilterEl) {
      catFilterEl.innerHTML =
        '<option value="ALL">Todas las categorías</option>' +
        CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
      catFilterEl.onchange = () => {
        state.catFilter = catFilterEl.value || 'ALL';
        renderComponentLibrary();
      };
    }
    const favToggleBtn = $('btn-lib-favs');
    if (favToggleBtn) {
      favToggleBtn.onclick = () => {
        state.favsOnly = !state.favsOnly;
        favToggleBtn.classList.toggle('btn-active', state.favsOnly);
        renderComponentLibrary();
      };
    }

    const canvasWrap = $('canvas-wrapper')!;

    on(canvasWrap, 'dragover', e => e.preventDefault());
    on(canvasWrap, 'drop', (e: DragEvent) => {
      e.preventDefault();
      const dropped = e.dataTransfer?.files?.[0];
      if (dropped && /\.(lspro|json)$/i.test(dropped.name)) {
        loadJsonFile(dropped);
        return;
      }
      const raw = e.dataTransfer?.getData('application/json');
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        if (!data?.type) return;
        const rect = mainCanvas.getBoundingClientRect();
        const wPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        addComponentToCanvas(data.type, wPos.x, wPos.y, { icDefId: data.icDefId || null });
      } catch {
        // ignore
      }
    });

    on(mainCanvas, 'pointerdown', (e: PointerEvent) => {
      hideContextMenu();
      commitInlineEditor(true);

      const rect = mainCanvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const wPos = screenToWorld(sx, sy);

      activePointers.set(e.pointerId, { sx, sy });
      if (activePointers.size === 2) {
        const pts = [...activePointers.values()];
        prevPinchDist = Math.hypot(pts[1].sx - pts[0].sx, pts[1].sy - pts[0].sy);
        prevPinchMid = { sx: (pts[0].sx + pts[1].sx) / 2, sy: (pts[0].sy + pts[1].sy) / 2 };
        state.mode = 'PANNING';
        return;
      }

      state.view.targetX = null;
      state.dragStartScreen = { x: sx, y: sy };
      state.dragStartWorld = { x: wPos.x, y: wPos.y };

      if (e.button === 1 || state.spacePressed) {
        state.mode = 'PANNING';
        if (state.spacePressed) state.spaceDidPan = true;
        mainCanvas.style.cursor = 'grabbing';
        return;
      }

      if (e.button !== 0) return;

      const pinHit = hitTestPin(wPos, 13 / state.view.zoom);
      if (pinHit) {
        state.mode = 'WIRING';
        state.wiringFrom = { compId: pinHit.comp.id, pinId: pinHit.pinId, dir: pinHit.dir };
        state.mouseWorld = wPos;
        return;
      }

      const handleHit = hitTestWireHandle(wPos, 11 / state.view.zoom);
      if (handleHit) {
        state.selectedIds.clear();
        state.selectedWireId = handleHit.wire.id;
        state.mode = 'DRAGGING_WIRE_HANDLE';
        state.wireDragMoved = false;
        state.dragWireHandle = {
          wireId: handleHit.wire.id,
          axis: handleHit.axis,
          startOffset: handleHit.wire.curveOffset || 0
        };
        mainCanvas.style.cursor = handleHit.axis === 'x' ? 'ew-resize' : 'ns-resize';
        updateInspector();
        markDirty(150);
        return;
      }

      const compHit = hitTestComponent(wPos);
      if (compHit) {
        if (compHit.type === 'SWITCH') {
          compHit.internalState.value = compHit.internalState.value === 1 ? 0 : 1;
          spawnRipple(compHit.x, compHit.y);
          soundFX.playClick(compHit.internalState.value === 1);
          evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
          saveHistorySnapshot();
        } else if (compHit.type === 'BUTTON') {
          compHit.internalState.value = 1;
          state.activePressId = compHit.id;
          spawnRipple(compHit.x, compHit.y);
          soundFX.playClick(true);
          evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        } else if (compHit.type === 'HEX_KEY') {
          compHit.internalState.hexVal = (Number(compHit.internalState.hexVal || 0) + (e.shiftKey ? 15 : 1)) & 0x0f;
          spawnRipple(compHit.x, compHit.y);
          soundFX.playClick(true);
          evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
          saveHistorySnapshot();
        } else if (compHit.type === 'HEX_KEY_N') {
          const bw = compHit.bits || 8;
          const cur = BigInt(compHit.internalState.hexVal || 0);
          compHit.internalState.hexVal = toUintN(cur + (e.shiftKey ? -1n : 1n), bw);
          spawnRipple(compHit.x, compHit.y);
          soundFX.playClick(true);
          evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
          saveHistorySnapshot();
        } else if (compHit.type === 'ROTARY_ENC') {
          if (handleRotaryClick(compHit, wPos, e.shiftKey)) {
            state.selectedIds = new Set([compHit.id]);
            updateInspector();
          }
        } else if (compHit.type === 'SLIDER_ADC') {
          if (handleSliderInput(compHit, wPos, true)) {
            state.activeSliderId = compHit.id;
            state.selectedIds = new Set([compHit.id]);
            state.selectedWireId = null;
            updateInspector();
            soundFX.playClick(true);
            return;
          }
        } else if (compHit.type === 'GAMEPAD') {
          if (handleGamepadClick(compHit, wPos)) {
            state.selectedIds = new Set([compHit.id]);
            updateInspector();
            return;
          }
        } else if (compHit.type === 'NUM_STEPPER') {
          if (handleStepperClick(compHit, wPos, e.shiftKey)) {
            state.selectedIds = new Set([compHit.id]);
            updateInspector();
            return;
          }
        }

        if (e.shiftKey) {
          if (state.selectedIds.has(compHit.id)) state.selectedIds.delete(compHit.id);
          else state.selectedIds.add(compHit.id);
        } else if (!state.selectedIds.has(compHit.id)) {
          state.selectedIds = new Set([compHit.id]);
        }
        state.selectedWireId = null;

        state.mode = 'DRAGGING_COMP';
        state.dragMoved = false;
        state.dragInitialPositions.clear();
        for (const id of state.selectedIds) {
          const c = state.components.find(x => x.id === id);
          if (c) state.dragInitialPositions.set(id, { x: c.x, y: c.y });
        }
        updateInspector();
        markDirty(200);
        return;
      }

      const wireHit = hitTestWire(wPos, 8 / state.view.zoom);
      if (wireHit) {
        state.selectedIds.clear();
        state.selectedWireId = wireHit.id;
        updateInspector();
        markDirty(200);
        return;
      }

      if (!e.shiftKey) {
        state.selectedIds.clear();
        state.selectedWireId = null;
        updateInspector();
      }
      state.mode = 'MARQUEE';
      state.marqueeRect = { x: wPos.x, y: wPos.y, w: 0, h: 0 };
    });

    on(window, 'pointermove', (e: PointerEvent) => {
      const rect = mainCanvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const wPos = screenToWorld(sx, sy);

      if (activePointers.has(e.pointerId)) {
        activePointers.set(e.pointerId, { sx, sy });
        if (activePointers.size === 2 && prevPinchDist !== null && prevPinchMid) {
          const pts = [...activePointers.values()];
          const dist = Math.hypot(pts[1].sx - pts[0].sx, pts[1].sy - pts[0].sy);
          const mid = { sx: (pts[0].sx + pts[1].sx) / 2, sy: (pts[0].sy + pts[1].sy) / 2 };
          state.view.x += mid.sx - prevPinchMid.sx;
          state.view.y += mid.sy - prevPinchMid.sy;
          if (prevPinchDist > 10 && dist > 10) {
            applyZoomAtScreen(mid.sx, mid.sy, dist / prevPinchDist);
          }
          prevPinchDist = dist;
          prevPinchMid = mid;
          return;
        }
      }

      state.mouseScreen = { x: sx, y: sy };
      state.mouseWorld = wPos;
      const coordEl = $('status-coords');
      if (coordEl) coordEl.textContent = `X: ${Math.round(wPos.x)}, Y: ${Math.round(wPos.y)}`;

      if (state.activeSliderId) {
        const sc = state.components.find(c => c.id === state.activeSliderId);
        if (sc) {
          handleSliderInput(sc, wPos, false);
          return;
        }
      }

      if (state.mode === 'PANNING') {
        state.view.x += sx - state.dragStartScreen.x;
        state.view.y += sy - state.dragStartScreen.y;
        state.dragStartScreen = { x: sx, y: sy };
        markDirty(150);
        return;
      }

      if (state.mode === 'DRAGGING_WIRE_HANDLE' && state.dragWireHandle) {
        const w = state.wires.find(x => x.id === state.dragWireHandle!.wireId);
        if (w) {
          const delta =
            state.dragWireHandle.axis === 'x'
              ? wPos.x - state.dragStartWorld.x
              : wPos.y - state.dragStartWorld.y;
          let raw = state.dragWireHandle.startOffset + delta;
          if (!e.shiftKey) raw = Math.round(raw / 5) * 5;
          raw = Math.max(-360, Math.min(360, raw));
          if (raw !== (w.curveOffset || 0)) state.wireDragMoved = true;
          w.curveOffset = raw;
          markDirty(150);
        }
        return;
      }

      if (state.mode === 'DRAGGING_COMP') {
        const dx = wPos.x - state.dragStartWorld.x;
        const dy = wPos.y - state.dragStartWorld.y;
        state.snapGuides = [];
        let alignDx = 0;
        let alignDy = 0;
        if (state.dragInitialPositions.size === 1) {
          const [[leadId, initPos]] = [...state.dragInitialPositions.entries()];
          const snapV = (v: number) => (SETTINGS.snap ? Math.round(v / 10) * 10 : Math.round(v));
          const cx = snapV(initPos.x + dx);
          const cy = snapV(initPos.y + dy);
          let bestX = 7;
          let bestY = 7;
          let gx: number | null = null;
          let gy: number | null = null;
          for (const other of state.components) {
            if (other.id === leadId) continue;
            const ddx = Math.abs(other.x - cx);
            if (ddx < bestX) {
              bestX = ddx;
              alignDx = other.x - cx;
              gx = other.x;
            }
            const ddy = Math.abs(other.y - cy);
            if (ddy < bestY) {
              bestY = ddy;
              alignDy = other.y - cy;
              gy = other.y;
            }
          }
          if (gx !== null) state.snapGuides.push({ axis: 'x', pos: gx });
          if (gy !== null) state.snapGuides.push({ axis: 'y', pos: gy });
        }

        for (const [id, initPos] of state.dragInitialPositions.entries()) {
          const c = state.components.find(x => x.id === id);
          if (c) {
            const snapV = (v: number) => (SETTINGS.snap ? Math.round(v / 10) * 10 : Math.round(v));
            const nx = snapV(initPos.x + dx) + alignDx;
            const ny = snapV(initPos.y + dy) + alignDy;
            if (nx !== c.x || ny !== c.y) state.dragMoved = true;
            c.x = nx;
            c.y = ny;
          }
        }
        markDirty(150);
        return;
      }

      if (state.mode === 'MARQUEE') {
        state.marqueeRect = {
          x: Math.min(state.dragStartWorld.x, wPos.x),
          y: Math.min(state.dragStartWorld.y, wPos.y),
          w: Math.abs(wPos.x - state.dragStartWorld.x),
          h: Math.abs(wPos.y - state.dragStartWorld.y)
        };
        markDirty(150);
        return;
      }

      if (state.mode === 'WIRING') {
        state.snapPin = findCompatibleSnapPin(wPos, 18 / state.view.zoom);
        markDirty(150);
        return;
      }

      state.hoveredPin = hitTestPin(wPos, 11 / state.view.zoom);
      if (state.hoveredPin) {
        state.hoveredWire = null;
      } else {
        const nowMove = performance.now();
        if (nowMove - lastWireHitAt >= 35) {
          lastWireHitAt = nowMove;
          state.hoveredWire = hitTestWire(wPos, 8 / state.view.zoom);
        }
      }
      if (state.probeMode) updateProbeHUD();
    });

    on(window, 'pointerup', (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) {
        prevPinchDist = null;
        prevPinchMid = null;
      }

      if (state.activeSliderId) {
        state.activeSliderId = null;
        saveHistorySnapshot();
        updateInspector();
      }

      if (state.activePressId) {
        const btnComp = state.components.find(c => c.id === state.activePressId);
        if (btnComp && btnComp.type === 'BUTTON') {
          btnComp.internalState.value = 0;
          soundFX.playClick(false);
          evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        }
        state.activePressId = null;
      }

      if (state.activeGamepadId) {
        const gp = state.components.find(c => c.id === state.activeGamepadId);
        if (gp) {
          gp.internalState.gamepadBits = 0;
          evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        }
        state.activeGamepadId = null;
      }

      if (state.mode === 'WIRING' && state.wiringFrom) {
        if (state.snapPin) {
          const outEnd =
            state.wiringFrom.dir === 'out'
              ? { compId: state.wiringFrom.compId, pinId: state.wiringFrom.pinId }
              : { compId: state.snapPin.comp.id, pinId: state.snapPin.pinId };
          const inEnd =
            state.wiringFrom.dir === 'in'
              ? { compId: state.wiringFrom.compId, pinId: state.wiringFrom.pinId }
              : { compId: state.snapPin.comp.id, pinId: state.snapPin.pinId };

          const exists = state.wires.some(
            w =>
              w.fromCompId === outEnd.compId &&
              w.fromPinId === outEnd.pinId &&
              w.toCompId === inEnd.compId &&
              w.toPinId === inEnd.pinId
          );

          if (!exists) {
            const srcComp = state.components.find(c => c.id === outEnd.compId);
            const srcPin = srcComp?.pins.find(p => p.id === outEnd.pinId);
            const dstComp = state.components.find(c => c.id === inEnd.compId);
            const dstPin = dstComp?.pins.find(p => p.id === inEnd.pinId);
            const existingIn = state.wires.filter(w => w.toCompId === inEnd.compId && w.toPinId === inEnd.pinId);
            const isTri =
              srcComp?.type === 'TRI_BUFFER' ||
              existingIn.some(w => state.components.find(c => c.id === w.fromCompId)?.type === 'TRI_BUFFER');
            if (existingIn.length > 0 && !isTri) {
              state.wires = state.wires.filter(w => !(w.toCompId === inEnd.compId && w.toPinId === inEnd.pinId));
            }

            const wSrc = srcPin?.width || 1;
            const wDst = dstPin?.width || 1;
            state.wires.push({
              id: genId('w'),
              fromCompId: outEnd.compId,
              fromPinId: outEnd.pinId,
              toCompId: inEnd.compId,
              toPinId: inEnd.pinId,
              signal: 0,
              width: wSrc
            });
            if (wSrc !== wDst) {
              showToast(`Bus adaptado de ${wSrc}b a ${wDst}b`, 'warn');
            }
            spawnRipple(state.snapPin.x, state.snapPin.y, null, 28);
            soundFX.playPop(920);
            evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
            saveHistorySnapshot();
          }
        }
      } else if (state.mode === 'DRAGGING_WIRE_HANDLE') {
        state.dragWireHandle = null;
        if (state.wireDragMoved) {
          saveHistorySnapshot();
          updateInspector();
        }
      } else if (state.mode === 'DRAGGING_COMP') {
        if (state.dragMoved) {
          saveHistorySnapshot();
          updateInspector();
        }
      } else if (state.mode === 'MARQUEE' && state.marqueeRect) {
        const r = state.marqueeRect;
        if (r.w > 4 || r.h > 4) {
          for (const c of state.components) {
            if (c.x >= r.x && c.x <= r.x + r.w && c.y >= r.y && c.y <= r.y + r.h) {
              state.selectedIds.add(c.id);
            }
          }
          updateInspector();
        }
      }

      state.mode = 'IDLE';
      state.snapGuides = [];
      state.wiringFrom = null;
      state.snapPin = null;
      state.marqueeRect = null;
      mainCanvas.style.cursor = state.spacePressed ? 'grab' : 'default';
      markDirty(200);
    });

    // Trackpad + Mouse smart wheel navigation
    on(mainCanvas, 'wheel', () => {
      FX.lastInteract = performance.now();
    }, { passive: true, capture: true });

    on(
      mainCanvas,
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        const rect = mainCanvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const now = performance.now();

        let shouldZoom = false;
        if (SETTINGS.navigationMode === 'mouse') {
          shouldZoom = true;
        } else if (SETTINGS.navigationMode === 'trackpad') {
          shouldZoom = e.ctrlKey || e.metaKey;
        } else {
          // Auto mode: pinch gesture (ctrlKey/metaKey) -> zoom; two-finger swipe -> pan
          if (e.ctrlKey || e.metaKey) {
            shouldZoom = true;
          } else {
            const looksTrackpad =
              Math.abs(e.deltaX) > 0 ||
              !Number.isInteger(e.deltaY) ||
              (e.deltaMode === 0 && Math.abs(e.deltaY) < 48);
            if (looksTrackpad) recentTrackpadAt = now;
            shouldZoom = !looksTrackpad && now - recentTrackpadAt > 500;
          }
        }

        if (shouldZoom) {
          const clampedY = Math.max(-120, Math.min(120, e.deltaY));
          const speed = e.ctrlKey || e.metaKey ? 0.0045 : 0.0016;
          applyZoomAtScreen(sx, sy, Math.exp(-clampedY * speed));
        } else {
          const scale = e.deltaMode === 1 ? 24 : 1;
          state.view.x -= e.deltaX * scale;
          state.view.y -= e.deltaY * scale;
          state.view.targetX = null;
          markDirty(150);
        }
      },
      { passive: false }
    );

    // Safari trackpad pinch gestures
    let gestureLastScale = 1;
    on(mainCanvas, 'gesturestart', (e: Event) => {
      e.preventDefault();
      gestureLastScale = 1;
    });
    on(mainCanvas, 'gesturechange', (e: Event & { scale?: number; clientX?: number; clientY?: number }) => {
      e.preventDefault();
      if (typeof e.scale === 'number' && gestureLastScale > 0) {
        const rect = mainCanvas.getBoundingClientRect();
        applyZoomAtScreen(
          (e.clientX || rect.left + rect.width / 2) - rect.left,
          (e.clientY || rect.top + rect.height / 2) - rect.top,
          e.scale / gestureLastScale
        );
        gestureLastScale = e.scale;
      }
    });

    // Doble clic: desactivado por defecto y NUNCA interfiere con controles interactivos
    const INTERACTIVE_SKIP_DBLCLICK = new Set([
      'SWITCH',
      'BUTTON',
      'HEX_KEY',
      'HEX_KEY_N',
      'NUM_STEPPER',
      'GAMEPAD',
      'ROTARY_ENC',
      'SLIDER_ADC'
    ]);
    on(mainCanvas, 'dblclick', (e: MouseEvent) => {
      const rect = mainCanvas.getBoundingClientRect();
      const wPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const compHit = hitTestComponent(wPos);
      if (compHit) {
        if (SETTINGS.dblclickEdit && !INTERACTIVE_SKIP_DBLCLICK.has(compHit.type)) {
          openInlineEditor(compHit);
        }
        return;
      }
      const wireHit = hitTestWire(wPos, 9 / state.view.zoom);
      if (wireHit) {
        wireHit.curveOffset = 0;
        wireHit.waypoints = undefined;
        saveHistorySnapshot();
        updateInspector();
        markDirty(200);
        showToast('Trazado del cable reiniciado');
      }
    });

    on(mainCanvas, 'contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      const rect = mainCanvas.getBoundingClientRect();
      showContextMenu(e.clientX, e.clientY, screenToWorld(e.clientX - rect.left, e.clientY - rect.top));
    });

    const inlineInp = $<HTMLInputElement>('inline-edit-input')!;
    on(inlineInp, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitInlineEditor(true);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        commitInlineEditor(false);
      }
    });
    on(inlineInp, 'blur', () => commitInlineEditor(true));

    on(minimapCanvas, 'pointerdown', (e: PointerEvent) => {
      if (state.components.length === 0) return;
      const rect = minimapCanvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const c of state.components) {
        minX = Math.min(minX, c.x - 80);
        minY = Math.min(minY, c.y - 80);
        maxX = Math.max(maxX, c.x + 80);
        maxY = Math.max(maxY, c.y + 80);
      }
      const cw = Math.max(400, maxX - minX);
      const ch = Math.max(300, maxY - minY);
      const scale = Math.min((minimapCanvas.width - 12) / cw, (minimapCanvas.height - 12) / ch);
      const ox = (minimapCanvas.width - cw * scale) / 2 - minX * scale;
      const oy = (minimapCanvas.height - ch * scale) / 2 - minY * scale;
      const wx = (mx - ox) / scale;
      const wy = (my - oy) / scale;
      const wrapRect = canvasWrap.getBoundingClientRect();
      state.view.targetX = wrapRect.width / 2 - wx * state.view.zoom;
      state.view.targetY = wrapRect.height / 2 - wy * state.view.zoom;
      state.view.targetZoom = state.view.zoom;
      markDirty(350);
    });

    // Topbar & Modals
    const presetSel = $<HTMLSelectElement>('preset-selector')!;
    presetSel.innerHTML = PRESET_LIST.map(p => `<option value="${p.id}">${p.label}</option>`).join('');
    presetSel.onchange = e => {
      loadPresetCircuit((e.target as HTMLSelectElement).value);
      showToast('Circuito de ejemplo cargado');
      (e.target as HTMLSelectElement).blur();
    };

    $('btn-sim-toggle')!.onclick = () => {
      state.simRunning = !state.simRunning;
      const btn = $('btn-sim-toggle')!;
      const lbl = $('sim-toggle-label')!;
      const statusTxt = $('status-sim-text')!;
      const statusDot = $('status-sim-dot')!;
      if (state.simRunning) {
        btn.classList.add('btn-accent');
        lbl.textContent = 'Simulando';
        statusTxt.textContent = 'SIMULACIÓN ACTIVA';
        statusDot.style.background = 'var(--accent)';
      } else {
        btn.classList.remove('btn-accent');
        lbl.textContent = 'Pausado';
        statusTxt.textContent = 'SIMULACIÓN EN PAUSA';
        statusDot.style.background = 'var(--warn)';
      }
    };

    $('btn-sim-step')!.onclick = () => {
      stepSimulation(0, true);
      soundFX.playClick(true);
    };

    const clkHz = $<HTMLInputElement>('global-clock-hz')!;
    clkHz.oninput = e => {
      state.globalClockHz = Number((e.target as HTMLInputElement).value);
      $('global-clock-label')!.textContent = `${state.globalClockHz.toFixed(1)}Hz`;
    };
    clkHz.onchange = e => {
      (e.target as HTMLInputElement).blur();
      savePrefs();
    };

    const multSel = $<HTMLSelectElement>('clock-mult-selector');
    if (multSel) {
      multSel.onchange = e => {
        state.clockMultiplier = Number((e.target as HTMLSelectElement).value) || 1;
        (e.target as HTMLSelectElement).blur();
        savePrefs();
        showToast(state.clockMultiplier >= 1000 ? 'Modo TURBO activo (ideal DOOM / VGA)' : `Velocidad ×${state.clockMultiplier}`);
      };
    }

    $('btn-wire-style')!.onclick = () => {
      state.wireStyle = state.wireStyle === 'bezier' ? 'orthogonal' : 'bezier';
      $('wire-style-label')!.textContent = state.wireStyle === 'bezier' ? 'Bézier' : 'Ortogonal';
      savePrefs();
      markDirty(250);
    };

    const wireVisBtn = $('btn-wire-vis');
    if (wireVisBtn) {
      wireVisBtn.onclick = () => {
        const order: WireVisibilityMode[] = ['all', 'dim_inactive', 'selected_only'];
        state.wireVisibility = order[(order.indexOf(state.wireVisibility) + 1) % order.length];
        updateWireVisButton();
        savePrefs();
        markDirty(250);
      };
    }

    $('btn-probe-mode')!.onclick = () => {
      state.probeMode = !state.probeMode;
      $('btn-probe-mode')!.classList.toggle('btn-active', state.probeMode);
      updateProbeHUD();
    };

    $<HTMLSelectElement>('theme-selector')!.onchange = e => {
      const val = (e.target as HTMLSelectElement).value as ThemeId;
      state.theme = val;
      document.documentElement.setAttribute('data-theme', val);
      (e.target as HTMLSelectElement).blur();
      savePrefs();
      renderComponentLibrary();
      markDirty(300);
    };

    $('btn-sound-toggle')!.onclick = () => {
      soundFX.enabled = !soundFX.enabled;
      $('btn-sound-toggle')!.classList.toggle('btn-active', soundFX.enabled);
      showToast(soundFX.enabled ? 'Sonido WebAudio activado' : 'Sonido silenciado');
      savePrefs();
    };

    $('btn-bool-synth')!.onclick = () => {
      $('bool-synth-error')!.classList.add('hidden');
      $('bool-synth-modal')?.classList.remove('hidden');
    };
    document.querySelectorAll<HTMLElement>('.bool-example').forEach(btn => {
      btn.onclick = () => {
        ($<HTMLInputElement>('bool-expr-input')!).value = btn.dataset.expr || '';
      };
    });
    $('btn-run-bool-synth')!.onclick = () => {
      try {
        const built = synthesizeBooleanCircuit($<HTMLInputElement>('bool-expr-input')!.value);
        state.components = built.components;
        state.wires = built.wires;
        state.analyzerSamples = [];
        saveHistorySnapshot();
        centerAndFitView();
        updateInspector();
        markDirty(300);
        $('bool-synth-modal')?.classList.add('hidden');
        showToast('Circuito sintetizado automáticamente');
      } catch (err) {
        const errBox = $('bool-synth-error')!;
        errBox.textContent = (err as Error).message;
        errBox.classList.remove('hidden');
      }
    };

    $('btn-custom-ic')!.onclick = openCustomICModal;
    $('btn-confirm-custom-ic')!.onclick = createCustomICFromCanvas;

    $('btn-truth-table')!.onclick = openTruthTableModal;
    $('btn-export-tt-csv')!.onclick = () => {
      if (!lastTruthTableCSV) return;
      const blob = new Blob([lastTruthTableCSV], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'tabla_verdad_logicstudio.csv';
      a.click();
    };

    $('btn-toggle-analyzer')!.onclick = () => setAnalyzerOpen(!state.analyzerOpen);
    $('btn-analyzer-pause')!.onclick = () => {
      state.analyzerPaused = !state.analyzerPaused;
      $('btn-analyzer-pause')!.textContent = state.analyzerPaused ? 'Reanudar Traza' : 'Pausar Traza';
    };
    $('btn-analyzer-clear')!.onclick = () => {
      state.analyzerSamples = [];
      state.analyzerDirty = true;
    };

    $('btn-undo')!.onclick = undo;
    $('btn-redo')!.onclick = redo;
    $('btn-cmd-palette')!.onclick = openCommandPalette;
    $<HTMLInputElement>('cmd-palette-input')!.oninput = e => renderCommandPaletteList((e.target as HTMLInputElement).value);

    $('btn-group')?.addEventListener('click', () => {
      if (state.selectedIds.size >= 2) {
        groupSelection();
      } else if ([...state.selectedIds].some(id => state.components.find(c => c.id === id)?.groupId)) {
        ungroupSelection();
      } else {
        showToast('Selecciona 2 o más componentes para agruparlos (Ctrl+G)', 'warn');
      }
    });

    $('btn-save-json')!.onclick = () => {
      const payload = exportLsProData({
        author: 'Alejandro Arbós Gómez',
        components: state.components,
        wires: state.wires,
        customICs: state.customICs
      });
      const blob = new Blob([payload], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'circuito_logicstudio_beta04.lspro';
      a.click();
      showToast('Proyecto guardado (.lspro)');
    };

    $('btn-load-json')!.onclick = () => $('file-json-input')?.click();
    $<HTMLInputElement>('file-json-input')!.onchange = e => {
      const inp = e.target as HTMLInputElement;
      const file = inp.files?.[0];
      if (file) loadJsonFile(file);
      inp.value = '';
    };

    $('btn-export-png')!.onclick = () => {
      const a = document.createElement('a');
      a.href = mainCanvas.toDataURL('image/png');
      a.download = 'logicstudio_pro_beta04.png';
      a.click();
      showToast('Captura PNG exportada');
    };

    $('btn-clear-canvas')!.onclick = () => $('confirm-clear-modal')?.classList.remove('hidden');
    $('btn-confirm-clear')!.onclick = () => {
      state.components = [];
      state.wires = [];
      state.analyzerSamples = [];
      state.selectedIds.clear();
      state.selectedWireId = null;
      saveHistorySnapshot();
      updateInspector();
      markDirty(250);
      $('confirm-clear-modal')?.classList.add('hidden');
      showToast('Lienzo limpiado');
    };

    $('btn-credits')!.onclick = () => $('credits-modal')?.classList.remove('hidden');

    // Memory Hex Editor modal bindings
    memProgrammer.bindEvents();

    document.querySelectorAll<HTMLElement>('.modal-close').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.modal;
        if (id) $(id)?.classList.add('hidden');
      };
    });
    document.querySelectorAll<HTMLElement>('.modal-backdrop').forEach(bg => {
      bg.addEventListener('pointerdown', e => {
        if (e.target === bg) bg.classList.add('hidden');
      });
    });

    $('btn-close-inspector')!.onclick = () => {
      state.selectedIds.clear();
      state.selectedWireId = null;
      updateInspector();
      markDirty(200);
    };

    const zoomAroundCenter = (factor: number) => {
      const wrap = canvasWrap.getBoundingClientRect();
      applyZoomAtScreen(wrap.width / 2, wrap.height / 2, factor);
    };
    $('btn-zoom-in')!.onclick = () => zoomAroundCenter(1.2);
    $('btn-zoom-out')!.onclick = () => zoomAroundCenter(1 / 1.2);
    $('btn-zoom-fit')!.onclick = centerAndFitView;
    $('btn-zoom-sel')?.addEventListener('click', zoomToSelection);

    // Teclado global + Gamepad WASD/Fuego (E / J / Enter, F queda libre para ajustar vista) + Keyboard ASCII
    const gamepadKeyMap: Record<string, number> = {
      w: 1,
      arrowup: 1,
      s: 2,
      arrowdown: 2,
      a: 4,
      arrowleft: 4,
      d: 8,
      arrowright: 8,
      enter: 16,
      j: 16,
      e: 16
    };

    on(window, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '') && document.activeElement?.id !== 'inline-edit-input') {
          (document.activeElement as HTMLElement).blur();
        }
        hideContextMenu();
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
        if (state.mode === 'WIRING') {
          state.mode = 'IDLE';
          state.wiringFrom = null;
          state.snapPin = null;
        }
        return;
      }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCommandPalette();
        return;
      }
      if (document.querySelector('.modal-backdrop:not(.hidden)')) return;

      // Forward to KEYBOARD_ASCII chips
      const kbChips = state.components.filter(c => c.type === 'KEYBOARD_ASCII');
      if (kbChips.length > 0 && e.key.length === 1 && !mod) {
        const code = e.key.charCodeAt(0) & 0xff;
        kbChips.forEach(kb => {
          kb.internalState.lastKeyAscii = code;
          kb.internalState.keyReady = 1;
        });
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
      }

      // Forward to GAMEPAD chips (WASD / Arrow / J / Enter) when no component selected or W/A/S/D pressed
      const gpChips = state.components.filter(c => c.type === 'GAMEPAD');
      const kLow = e.key.toLowerCase();
      if (gpChips.length > 0 && !mod && gamepadKeyMap[kLow]) {
        const allowArrow = state.selectedIds.size === 0 || !e.key.startsWith('Arrow');
        if (allowArrow) {
          e.preventDefault();
          gpChips.forEach(gp => {
            gp.internalState.gamepadBits = (gp.internalState.gamepadBits || 0) | gamepadKeyMap[kLow];
          });
          evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
          markDirty(150);
          return;
        }
      }

      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        $('btn-save-json')?.click();
        return;
      }
      if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelection(false);
        return;
      }
      if (mod && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        copySelection(true);
        return;
      }
      if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if (e.key.startsWith('Arrow') && !mod) {
        e.preventDefault();
        const step = e.shiftKey ? 50 : 10;
        nudgeSelection(
          e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0,
          e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        );
        return;
      }
      if (e.key === 'F2') {
        const c = state.components.find(x => state.selectedIds.has(x.id));
        if (c) {
          e.preventDefault();
          openInlineEditor(c);
        }
        return;
      }
      if (!mod && !e.altKey && kLow === 'o') {
        autoTidy();
        return;
      }
      if (e.key === '?') {
        $('btn-shortcuts')?.click();
        return;
      }
      if (!mod && !e.altKey && kLow === 'r') {
        rotateSelection(e.shiftKey ? -1 : 1);
        return;
      }
      if (!mod && !e.altKey && kLow === 'h') {
        flipSelection();
        return;
      }
      if (!mod && !e.altKey && kLow === 'b') {
        setLibraryHidden(!$('sidebar-left')?.classList.contains('collapsed'));
        savePrefs();
        return;
      }
      if (mod && kLow === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && kLow === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && kLow === 'd') {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (mod && kLow === 'g') {
        e.preventDefault();
        if (e.shiftKey) ungroupSelection();
        else groupSelection();
        return;
      }
      if (mod && kLow === 'a') {
        e.preventDefault();
        state.selectedIds = new Set(state.components.map(c => c.id));
        updateInspector();
        markDirty(200);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelection();
        return;
      }
      if (kLow === 'f' && !mod && !e.altKey) {
        if (e.shiftKey) {
          zoomToSelection();
          return;
        }
        centerAndFitView();
        return;
      }
      if (kLow === 'p' && !mod && !e.altKey) {
        $('btn-probe-mode')?.click();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (!state.spacePressed) {
          state.spacePressed = true;
          state.spaceDidPan = false;
          mainCanvas.style.cursor = 'grab';
        }
      }
    });

    on(window, 'keyup', (e: KeyboardEvent) => {
      const kLow = e.key.toLowerCase();
      const gpChips = state.components.filter(c => c.type === 'GAMEPAD');
      if (gpChips.length > 0) {
        const mask = gamepadKeyMap[kLow] || 0;
        if (mask) {
          gpChips.forEach(gp => {
            gp.internalState.gamepadBits = (gp.internalState.gamepadBits || 0) & ~mask;
          });
          evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        }
      }

      if (e.code === 'Space') {
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')) e.preventDefault();
        const toggle = state.spacePressed && !state.spaceDidPan;
        state.spacePressed = false;
        state.spaceDidPan = false;
        mainCanvas.style.cursor = 'default';
        if (toggle) $('btn-sim-toggle')?.click();
      }
    });

    return () => cleanups.forEach(fn => fn());
  }

  // =========================================================================
  // BUCLE DE ANIMACIÓN 60 FPS E INICIALIZACIÓN
  // =========================================================================
  initSettingsUI();
  initScriptUI();

  // =========================================================================
  // MODO APRENDIZAJE DESDE 0
  // =========================================================================
  let learnDone: Record<string, boolean> = {};
  try {
    learnDone = JSON.parse(readStorageWithFallback(LEARN_KEY) || '{}') || {};
  } catch {
    learnDone = {};
  }
  let activeLesson: LearningLesson = LEARNING_LESSONS[0];
  let lessonResult: { ok: boolean; feedback: string } | null = null;

  function renderLearnModal(): void {
    const doneCount = LEARNING_LESSONS.filter(l => learnDone[l.id]).length;
    const pText = $('learn-progress-text');
    const pFill = $('learn-progress-fill') as HTMLElement | null;
    if (pText) pText.textContent = `${doneCount}/${LEARNING_LESSONS.length}`;
    if (pFill) pFill.style.width = `${(doneCount / LEARNING_LESSONS.length) * 100}%`;

    const listEl = $('learn-list');
    if (listEl) {
      listEl.innerHTML = LEARNING_LESSONS.map(
        l => `
        <button type="button" class="learn-step-btn ${learnDone[l.id] ? 'done' : ''} ${activeLesson.id === l.id ? 'active' : ''}" data-lid="${l.id}">
          <span class="learn-step-num">${learnDone[l.id] ? '✓' : l.num}</span>
          <span style="display:flex; flex-direction:column; gap:1px; min-width:0;">
            <strong style="font-size:11.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${l.title}</strong>
            <span style="font-size:10px; color:var(--text-muted);">${l.level}</span>
          </span>
        </button>`
      ).join('');
      listEl.querySelectorAll<HTMLElement>('[data-lid]').forEach(btn => {
        btn.onclick = () => {
          const found = LEARNING_LESSONS.find(x => x.id === btn.dataset.lid);
          if (found) {
            activeLesson = found;
            lessonResult = null;
            renderLearnModal();
          }
        };
      });
    }

    const detEl = $('learn-detail');
    if (detEl) {
      const idx = LEARNING_LESSONS.findIndex(x => x.id === activeLesson.id);
      const nextLesson = idx >= 0 && idx + 1 < LEARNING_LESSONS.length ? LEARNING_LESSONS[idx + 1] : null;
      detEl.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <strong style="font-size:14.5px; color:var(--text-primary);">Lección ${activeLesson.num}: ${activeLesson.title}</strong>
          <span class="beta-badge">${activeLesson.level}</span>
        </div>
        <p style="font-size:12px; color:var(--text-secondary);">${activeLesson.summary}</p>
        <div class="learn-theory">
          ${activeLesson.theory.map(p => `<p style="margin:0 0 6px 0;">• ${p}</p>`).join('')}
        </div>
        <div class="learn-goal-box">
          <strong>🎯 Objetivo práctico:</strong> ${activeLesson.goalText}
        </div>
        <div class="learn-tip-box">
          💡 <strong>Pista:</strong> ${activeLesson.tip}
        </div>
        ${
          lessonResult
            ? `<div class="learn-status-banner ${lessonResult.ok ? 'ok' : 'bad'}">${lessonResult.ok ? '✔ ' : '✖ '}${lessonResult.feedback}</div>`
            : ''
        }
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:auto;">
          <button type="button" id="learn-load-starter" class="btn">📂 Cargar Plantilla</button>
          <button type="button" id="learn-check-btn" class="btn btn-accent">✓ Comprobar Lección</button>
          <button type="button" id="learn-go-canvas" class="btn">Ir al Lienzo</button>
          ${nextLesson ? `<button type="button" id="learn-next-btn" class="btn">Siguiente (${nextLesson.num}) →</button>` : ''}
        </div>
      `;
      $('learn-load-starter')!.onclick = () => {
        const built = activeLesson.buildStarter();
        state.components = built.components;
        state.wires = built.wires;
        state.analyzerSamples = [];
        state.selectedIds.clear();
        state.selectedWireId = null;
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        saveHistorySnapshot();
        centerAndFitView();
        updateInspector();
        markDirty(300);
        lessonResult = null;
        $('learn-modal')?.classList.add('hidden');
        soundFX.playPop(780);
        showToast(`Plantilla cargada: Lección ${activeLesson.num}`);
      };
      $('learn-check-btn')!.onclick = () => {
        evaluateCircuitDeterministic(state.components, state.wires, 0, state.globalClockHz, state.customICs);
        lessonResult = activeLesson.check(state.components, state.wires);
        if (lessonResult.ok) {
          learnDone[activeLesson.id] = true;
          try {
            localStorage.setItem(LEARN_KEY, JSON.stringify(learnDone));
          } catch {
            // ignore
          }
          soundFX.playPop(980);
        } else {
          soundFX.playClick(false);
        }
        renderLearnModal();
      };
      $('learn-go-canvas')!.onclick = () => $('learn-modal')?.classList.add('hidden');
      $('learn-next-btn')?.addEventListener('click', () => {
        if (nextLesson) {
          activeLesson = nextLesson;
          lessonResult = null;
          renderLearnModal();
        }
      });
    }
  }

  function openLearnModal(): void {
    lessonResult = null;
    renderLearnModal();
    $('learn-modal')?.classList.remove('hidden');
  }

  $('btn-learn')?.addEventListener('click', openLearnModal);

  $('btn-challenges')!.onclick = () => {
    renderChallengeList();
    renderChallengeDetail();
    $('challenges-modal')?.classList.remove('hidden');
  };
  $('chal-bar-validate')!.onclick = runChallengeValidation;
  $('chal-bar-open')!.onclick = () => {
    renderChallengeList();
    renderChallengeDetail();
    $('challenges-modal')?.classList.remove('hidden');
  };
  $('chal-bar-close')!.onclick = () => {
    activeChal = null;
    chalResult = null;
    updateChallengeBar();
    renderChallengeList();
    renderChallengeDetail();
  };

  $('btn-lib-expand')!.onclick = () => {
    state.collapsedCats.clear();
    state.animCat = null;
    renderComponentLibrary();
  };
  $('btn-lib-collapse')!.onclick = () => {
    CATEGORIES.forEach(c => state.collapsedCats.add(c));
    renderComponentLibrary();
  };
  $('btn-lib-hide')!.onclick = () => {
    setLibraryHidden(true);
    savePrefs();
  };
  $('btn-lib-show')!.onclick = () => {
    setLibraryHidden(false);
    savePrefs();
  };
  $('component-search')!.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      (e.target as HTMLInputElement).value = '';
      renderComponentLibrary();
      (e.target as HTMLInputElement).blur();
    }
  });

  const dirtyEvs = [
    'pointerdown',
    'pointermove',
    'pointerup',
    'wheel',
    'keydown',
    'keyup',
    'click',
    'dblclick',
    'change',
    'input',
    'contextmenu',
    'drop',
    'dragover',
    'touchstart'
  ];
  const onAnyDirty = () => markDirty(300);
  dirtyEvs.forEach(ev => document.addEventListener(ev, onAnyDirty, { capture: true, passive: true }));
  const onResize = () => {
    syncCanvasBounds();
    markDirty(350);
  };
  window.addEventListener('resize', onResize);
  document.addEventListener('fullscreenchange', onResize);
  document.addEventListener('webkitfullscreenchange', onResize);

  document.querySelectorAll<HTMLElement>('#lib-bits-bar [data-bits]').forEach(btn => {
    btn.onclick = () => {
      const bw = Number(btn.dataset.bits) || 8;
      SETTINGS.defaultBitWidth = bw;
      syncLibBitsBar();
      renderComponentLibrary();
      savePrefs();
      showToast(`Ancho predeterminado: ${bw} bits`);
    };
  });

  const cleanupEvents = initEvents();

  // Cargar preferencias desde localStorage
  let loadedPrefs = false;
  try {
    const prefs = JSON.parse(readStorageWithFallback(PREFS_KEY, LEGACY_PREFS_KEY) || 'null');
    if (prefs) {
      loadedPrefs = true;
      if (['cyber', 'blueprint', 'clean'].includes(prefs.theme)) {
        state.theme = prefs.theme;
        document.documentElement.setAttribute('data-theme', prefs.theme);
        ($<HTMLSelectElement>('theme-selector')!).value = prefs.theme;
      }
      if (prefs.wireStyle === 'orthogonal') {
        state.wireStyle = 'orthogonal';
        $('wire-style-label')!.textContent = 'Ortogonal';
      }
      if (prefs.wireVisibility && ['all', 'dim_inactive', 'selected_only'].includes(prefs.wireVisibility)) {
        state.wireVisibility = prefs.wireVisibility;
      }
      if (prefs.sound === false) {
        soundFX.enabled = false;
        $('btn-sound-toggle')?.classList.remove('btn-active');
      }
      if (prefs.libHidden) setLibraryHidden(true);
      if (prefs.settings) Object.assign(SETTINGS, prefs.settings);
      if (prefs.hz) {
        const hz = $<HTMLInputElement>('global-clock-hz')!;
        hz.value = String(prefs.hz);
        hz.dispatchEvent(new Event('input'));
      }
      if (prefs.clockMultiplier) {
        state.clockMultiplier = Number(prefs.clockMultiplier) || 1;
        const ms = $<HTMLSelectElement>('clock-mult-selector');
        if (ms) ms.value = String(state.clockMultiplier);
      }
    }
  } catch {
    // ignore corrupt prefs
  }
  if (!loadedPrefs) {
    const devMem = (navigator as { deviceMemory?: number }).deviceMemory;
    if (typeof devMem === 'number' && devMem <= 2) {
      SETTINGS.ecoMode = true;
    }
  }

  setAnalyzerOpen(SETTINGS.openAnalyzerOnStart);
  applyVisualSettings();
  syncLibBitsBar();
  renderComponentLibrary();

  loadPresetCircuit('demo');
  try {
    const saved = readStorageWithFallback(AUTOSAVE_KEY, LEGACY_AUTOSAVE_KEY);
    if (saved) {
      const parsed = deserializeCircuitData<{ components?: LogicComponent[] }>(saved);
      if (parsed && Array.isArray(parsed.components) && parsed.components.length > 0) {
        state.history = [];
        state.historyIndex = -1;
        restoreSnapshot(saved);
        saveHistorySnapshot();
        centerAndFitView();
        showToast('Sesión anterior restaurada');
      }
    }
  } catch {
    // ignore corrupt autosave
  }

  const onBlur = () => {
    state.spacePressed = false;
    state.spaceDidPan = false;
    window.dispatchEvent(new Event('pointerup'));
  };
  const onBeforeUnload = () => {
    try {
      localStorage.setItem(
        AUTOSAVE_KEY,
        serializeCircuitData({
          components: state.components,
          wires: state.wires,
          customICs: state.customICs
        })
      );
    } catch {
      // ignore
    }
  };
  window.addEventListener('blur', onBlur);
  window.addEventListener('beforeunload', onBeforeUnload);

  let lastFrameTime = performance.now();
  let lastRenderAt = 0;
  let lastInspAt = 0;
  let lastFpsHudAt = performance.now();
  let fpsCounterFrames = 0;
  let frameN = 0;
  let rafId = 0;

  const onVisibilityChange = () => {
    if (!document.hidden) {
      lastFrameTime = performance.now();
      markDirty(200);
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  function updateVisualAnimations(dt: number): void {
    for (const c of state.components) {
      if (c.spawnScale !== undefined && (c.spawnScale !== 1 || Math.abs(c.spawnVel || 0) > 0.01)) {
        const force = (1 - c.spawnScale) * 200;
        c.spawnVel = ((c.spawnVel || 0) + force * dt) * Math.exp(-15 * dt);
        c.spawnScale += c.spawnVel * dt;
        if (Math.abs(1 - c.spawnScale) < 0.004 && Math.abs(c.spawnVel) < 0.02) {
          c.spawnScale = 1;
          c.spawnVel = 0;
        }
      }
    }

    if (state.view.targetX !== null && state.view.targetY !== null && state.view.targetZoom !== null) {
      const ease = 1 - Math.exp(-12 * dt);
      state.view.x += (state.view.targetX - state.view.x) * ease;
      state.view.y += (state.view.targetY - state.view.y) * ease;
      state.view.zoom += (state.view.targetZoom - state.view.zoom) * ease;
      const zr = $('zoom-readout');
      if (zr) zr.textContent = `${Math.round(state.view.zoom * 100)}%`;
      if (Math.hypot(state.view.targetX - state.view.x, state.view.targetY - state.view.y) < 0.6) {
        state.view.x = state.view.targetX;
        state.view.y = state.view.targetY;
        state.view.zoom = state.view.targetZoom;
        state.view.targetX = null;
      }
    }

    for (let i = state.ripples.length - 1; i >= 0; i--) {
      const r = state.ripples[i];
      r.r += (r.maxR - r.r) * Math.min(1, dt * 8);
      r.alpha -= dt * 1.9;
      if (r.alpha <= 0) state.ripples.splice(i, 1);
    }

    for (let i = state.sparks.length - 1; i >= 0; i--) {
      const s = state.sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0) state.sparks.splice(i, 1);
    }
  }

  function mainLoop(now: number): void {
    if (document.hidden) {
      lastFrameTime = now;
      rafId = requestAnimationFrame(mainLoop);
      return;
    }
    const rawDt = now - lastFrameTime;
    const dt = Math.min(0.05, Math.max(0.001, rawDt / 1000));
    lastFrameTime = now;
    frameN++;
    FX.ema += (Math.min(rawDt, 120) - FX.ema) * 0.08;
    if (SETTINGS.quality === 'auto' && !SETTINGS.ecoMode && now > FX.checkAt) {
      FX.checkAt = now + 1000;
      if (!FX.degraded && FX.ema > 26 && state.components.length > 0) {
        FX.degraded = true;
        FX.retest = now + 25000;
      } else if (FX.degraded && now > FX.retest) {
        FX.degraded = false;
        FX.retest = Infinity;
      }
    }
    const eco = isEcoMode();
    FX.halfRate = eco || (SETTINGS.quality !== 'high' && (SETTINGS.quality === 'low' ? FX.ema > 30 : FX.degraded && FX.ema > 30));

    const simChanged = stepSimulation(dt, false);
    const hasActiveParticles =
      state.simRunning && SETTINGS.particles && !eco && state.wires.some(w => isSignalNonZero(w.signal));
    const animating =
      hasActiveParticles ||
      state.ripples.length > 0 ||
      state.sparks.length > 0 ||
      state.view.targetX !== null ||
      now < RS.until ||
      state.components.some(c => c.spawnScale !== undefined && c.spawnScale !== 1);
    updateVisualAnimations(dt);

    const fpsCap = SETTINGS.fpsCap || 60;
    const minFrameMs = fpsCap < 60 ? 1000 / fpsCap - 1 : 0;
    const capThrottled = minFrameMs > 0 && state.mode === 'IDLE' && now - lastRenderAt < minFrameMs;
    const ecoThrottled = eco && !RS.dirty && now - lastRenderAt < 33;
    const wasDirty = RS.dirty;

    if ((RS.dirty || simChanged || animating) && !capThrottled && !ecoThrottled && !(FX.halfRate && !RS.dirty && !simChanged && (frameN & 1))) {
      renderMainCanvas();
      RS.dirty = false;
      lastRenderAt = now;
      fpsCounterFrames++;
    }
    if ((state.analyzerDirty || wasDirty) && !capThrottled && !(eco && now - lastRenderAt < 33)) {
      renderAnalyzerCanvas();
      state.analyzerDirty = false;
    }

    if (now - lastInspAt >= (eco ? 360 : 140)) {
      lastInspAt = now;
      updateLiveInspectorSignals();
      memProgrammer.refreshLive();
    }

    if (SETTINGS.showFpsCounter && now - lastFpsHudAt >= 500) {
      const fpsEl = $('status-fps');
      if (fpsEl) {
        const measured = Math.round((fpsCounterFrames * 1000) / Math.max(1, now - lastFpsHudAt));
        fpsEl.textContent = `${measured} FPS`;
      }
      fpsCounterFrames = 0;
      lastFpsHudAt = now;
    }

    rafId = requestAnimationFrame(mainLoop);
  }

  rafId = requestAnimationFrame(mainLoop);

  return () => {
    cancelAnimationFrame(rafId);
    if (thumbPumpId) cancelAnimationFrame(thumbPumpId);
    if (RS.ro instanceof ResizeObserver) RS.ro.disconnect();
    cleanupEvents();
    dirtyEvs.forEach(ev => document.removeEventListener(ev, onAnyDirty, { capture: true }));
    window.removeEventListener('resize', onResize);
    document.removeEventListener('fullscreenchange', onResize);
    document.removeEventListener('webkitfullscreenchange', onResize);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('beforeunload', onBeforeUnload);
  };
}
