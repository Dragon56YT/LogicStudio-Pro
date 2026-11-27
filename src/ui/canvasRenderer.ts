import { getSplitterChunks, pinWX, pinWY } from '../engine/catalog';
import { SEG7_BCD_TABLE } from '../engine/simulator';
import { FUNNY_SCENES_32 } from '../presets/funnyAnimation32';
import {
  AppSettings,
  LogicComponent,
  PinSignal,
  ThemeId,
  Wire,
  WireStyle,
  WireVisibilityMode,
  WorldPin,
  bit,
  formatSignalCompact,
  formatSignalHex,
  isSignalNonZero,
  toSignedN,
  toUintN
} from '../engine/types';

export interface CanvasTheme {
  bg: string;
  gridDot: string;
  gridAxis: string;
  compFill: string;
  compStroke: string;
  compSelected: string;
  compText: string;
  subText: string;
  pinFill: string;
  pinStroke: string;
  sig1: string;
  sig0: string;
  sigZ: string;
  sigErr: string;
  warn: string;
}

export const CANVAS_THEMES: Record<ThemeId, CanvasTheme> = {
  cyber: {
    bg: '#070b14',
    gridDot: 'rgba(148, 163, 184, 0.18)',
    gridAxis: 'rgba(0, 245, 212, 0.12)',
    compFill: '#0f172a',
    compStroke: '#334155',
    compSelected: '#00f5d4',
    compText: '#f1f5f9',
    subText: '#94a3b8',
    pinFill: '#1e293b',
    pinStroke: '#64748b',
    sig1: '#00f5d4',
    sig0: '#334155',
    sigZ: '#f59e0b',
    sigErr: '#f43f5e',
    warn: '#f59e0b'
  },
  blueprint: {
    bg: '#08162b',
    gridDot: 'rgba(125, 211, 252, 0.24)',
    gridAxis: 'rgba(100, 255, 218, 0.16)',
    compFill: '#0d2342',
    compStroke: '#38bdf8',
    compSelected: '#64ffda',
    compText: '#e0f2fe',
    subText: '#93c5fd',
    pinFill: '#08162b',
    pinStroke: '#7dd3fc',
    sig1: '#64ffda',
    sig0: '#254e7a',
    sigZ: '#fbbf24',
    sigErr: '#fb7185',
    warn: '#fbbf24'
  },
  clean: {
    bg: '#eef2f6',
    gridDot: 'rgba(100, 116, 139, 0.26)',
    gridAxis: 'rgba(2, 132, 199, 0.15)',
    compFill: '#ffffff',
    compStroke: '#94a3b8',
    compSelected: '#0284c7',
    compText: '#0f172a',
    subText: '#475569',
    pinFill: '#f1f5f9',
    pinStroke: '#64748b',
    sig1: '#059669',
    sig0: '#94a3b8',
    sigZ: '#d97706',
    sigErr: '#e11d48',
    warn: '#d97706'
  }
};

export const LED_PALETTE: Record<string, { name: string; hex: string }> = {
  cyan: { name: 'Cian', hex: '#00f5d4' },
  emerald: { name: 'Esmeralda', hex: '#10b981' },
  rose: { name: 'Rojo / Coral', hex: '#f43f5e' },
  amber: { name: 'Ámbar', hex: '#f59e0b' },
  violet: { name: 'Violeta', hex: '#a855f7' },
  blue: { name: 'Azul', hex: '#3b82f6' }
};

export const CHANNEL_COLORS = ['#00f5d4', '#38bdf8', '#f43f5e', '#f59e0b', '#a855f7', '#10b981', '#ec4899', '#84cc16'];

export interface RippleFX {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
  color: string;
}

export interface SparkFX {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface RenderStateView {
  theme: ThemeId;
  components: LogicComponent[];
  wires: Wire[];
  selectedIds: Set<string>;
  selectedWireId: string | null;
  view: { x: number; y: number; zoom: number; targetX: number | null; targetY: number | null; targetZoom: number | null };
  simRunning: boolean;
  simTime: number;
  wireStyle: WireStyle;
  wireVisibility: WireVisibilityMode;
  mode: string;
  wiringFrom: { compId: string; pinId: string; dir: 'in' | 'out' } | null;
  mouseWorld: { x: number; y: number };
  snapPin: WorldPin | null;
  hoveredPin: WorldPin | null;
  hoveredWire: Wire | null;
  marqueeRect: { x: number; y: number; w: number; h: number } | null;
  ripples: RippleFX[];
  sparks: SparkFX[];
  snapGuides?: Array<{ axis: 'x' | 'y'; pos: number }>;
}

export type WireGeometry =
  | { type: 'orthogonal'; points: Array<{ x: number; y: number }>; cum: number[] }
  | { type: 'bezier'; p0: { x: number; y: number }; p1: { x: number; y: number }; p2: { x: number; y: number }; p3: { x: number; y: number } };

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

export function getSignalColor(theme: ThemeId, sig: PinSignal | undefined, unstable = false): string {
  const th = CANVAS_THEMES[theme];
  if (unstable || sig === 'ERR') return th.sigErr;
  if (sig === 'Z') return th.sigZ;
  return isSignalNonZero(sig) ? th.sig1 : th.sig0;
}

export function getWireGeometry(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  wireStyle: WireStyle,
  lane = 0,
  curveOffset = 0,
  waypoints?: Array<{ x: number; y: number }>
): WireGeometry {
  if (waypoints && waypoints.length > 0 && wireStyle === 'orthogonal') {
    const pts = [{ x: x1, y: y1 }, ...waypoints.map(p => ({ x: p.x, y: p.y })), { x: x2, y: y2 }];
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    return { type: 'orthogonal', points: pts, cum };
  }
  if (wireStyle === 'orthogonal') {
    const R = 22;
    let pts: Array<{ x: number; y: number }>;
    if (x2 - x1 >= R * 2) {
      let mx = (x1 + x2) / 2 + lane + curveOffset;
      mx = Math.max(x1 + R * 0.6, Math.min(x2 - R * 0.6, mx));
      pts =
        Math.abs(y1 - y2) < 0.5 && Math.abs(curveOffset) < 2
          ? [{ x: x1, y: y1 }, { x: x2, y: y2 }]
          : [{ x: x1, y: y1 }, { x: mx, y: y1 }, { x: mx, y: y2 }, { x: x2, y: y2 }];
    } else {
      const ox = x1 + R + Math.abs(lane) * 0.4;
      const ix = x2 - R - Math.abs(lane) * 0.4;
      const baseYm = Math.abs(y2 - y1) < 70 ? Math.max(y1, y2) + 48 + Math.abs(lane) : (y1 + y2) / 2 + lane;
      const ym = baseYm + curveOffset;
      pts = [{ x: x1, y: y1 }, { x: ox, y: y1 }, { x: x1 < ox ? ox : ox, y: ym }, { x: ix, y: ym }, { x: ix, y: y2 }, { x: x2, y: y2 }];
    }
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    return { type: 'orthogonal', points: pts, cum };
  }
  const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
  const arch = curveOffset * 1.333;
  return {
    type: 'bezier',
    p0: { x: x1, y: y1 },
    p1: { x: x1 + dx, y: y1 + arch },
    p2: { x: x2 - dx, y: y2 + arch },
    p3: { x: x2, y: y2 }
  };
}

export function getWireControlHandle(geom: WireGeometry): { x: number; y: number; axis: 'x' | 'y' } {
  if (geom.type === 'orthogonal') {
    const pts = geom.points;
    if (pts.length >= 6) {
      return { x: (pts[2].x + pts[3].x) / 2, y: pts[2].y, axis: 'y' };
    }
    if (pts.length >= 4) {
      return { x: pts[1].x, y: (pts[1].y + pts[2].y) / 2, axis: 'x' };
    }
    const mid = evalPointOnWire(geom, 0.5);
    return { x: mid.x, y: mid.y, axis: 'x' };
  }
  const mid = evalPointOnWire(geom, 0.5);
  return { x: mid.x, y: mid.y, axis: 'y' };
}

export function evalPointOnWire(geom: WireGeometry, t: number): { x: number; y: number } {
  if (geom.type === 'orthogonal') {
    const pts = geom.points;
    const cum = geom.cum;
    const total = cum[cum.length - 1] || 1;
    const target = Math.max(0, Math.min(1, t)) * total;
    for (let i = 1; i < pts.length; i++) {
      if (target <= cum[i] || i === pts.length - 1) {
        const seg = cum[i] - cum[i - 1];
        const lt = seg > 0 ? Math.min(1, (target - cum[i - 1]) / seg) : 0;
        return {
          x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * lt,
          y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * lt
        };
      }
    }
  } else {
    const u = 1 - t;
    return {
      x: u * u * u * geom.p0.x + 3 * u * u * t * geom.p1.x + 3 * u * t * t * geom.p2.x + t * t * t * geom.p3.x,
      y: u * u * u * geom.p0.y + 3 * u * u * t * geom.p1.y + 3 * u * t * t * geom.p2.y + t * t * t * geom.p3.y
    };
  }
  return { x: 0, y: 0 };
}

export function addGeomToPath(p: Path2D, g: WireGeometry): void {
  if (g.type === 'orthogonal') {
    const pts = g.points;
    p.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const c = pts[i + 1];
      const r = Math.min(8, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(c.x - b.x, c.y - b.y) / 2);
      p.arcTo(b.x, b.y, c.x, c.y, r);
    }
    const l = pts[pts.length - 1];
    p.lineTo(l.x, l.y);
  } else {
    p.moveTo(g.p0.x, g.p0.y);
    p.bezierCurveTo(g.p1.x, g.p1.y, g.p2.x, g.p2.y, g.p3.x, g.p3.y);
  }
}

export function geomBounds(g: WireGeometry): { x0: number; y0: number; x1: number; y1: number } {
  const pts = g.type === 'orthogonal' ? g.points : [g.p0, g.p1, g.p2, g.p3];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

export function wireLane(cFrom: LogicComponent, pinId: string, ci: number, wireStyle: WireStyle): number {
  if (wireStyle !== 'orthogonal') return 0;
  const idx = cFrom.pins.findIndex(p => p.id === pinId);
  return ((((idx * 5 + ci * 3) % 8) + 8) % 8 - 3.5) * 5;
}

export function drawWires(
  ctx: CanvasRenderingContext2D,
  st: RenderStateView,
  settings: AppSettings,
  vis: { x0: number; y0: number; x1: number; y1: number },
  fast: boolean
): void {
  const isFast = fast || Boolean(settings.ecoMode || settings.quality === 'eco' || settings.quality === 'low');
  const compMap = new Map<string, LogicComponent>();
  const compIdx = new Map<string, number>();
  st.components.forEach((c, i) => {
    compMap.set(c.id, c);
    compIdx.set(c.id, i);
  });

  const pinCount = new Map<string, number>();
  for (const w of st.wires) {
    const k = `${w.fromCompId}|${w.fromPinId}`;
    pinCount.set(k, (pinCount.get(k) || 0) + 1);
  }

  interface WireGroup {
    path: Path2D;
    col: string;
    on: boolean;
    bus: boolean;
    alpha: number;
  }

  const groups = new Map<string, WireGroup>();
  const special: Array<{ wire: Wire; geom: WireGeometry; col: string; sel: boolean; bus: boolean }> = [];
  const particles: WireGeometry[] = [];
  const dots = new Map<string, { x: number; y: number; col: string }>();
  const busLabels: Array<{ x: number; y: number; width: number; col: string; alpha: number }> = [];
  const ortho = st.wireStyle === 'orthogonal';

  // Detect hovered net for smart spotlighting without clutter
  let hoverNetKey: string | null = null;
  if (st.hoveredWire) {
    hoverNetKey = `${st.hoveredWire.fromCompId}|${st.hoveredWire.fromPinId}`;
  } else if (st.hoveredPin) {
    if (st.hoveredPin.dir === 'out') {
      hoverNetKey = `${st.hoveredPin.comp.id}|${st.hoveredPin.pinId}`;
    } else {
      const hw = st.wires.find(w => w.toCompId === st.hoveredPin!.comp.id && w.toPinId === st.hoveredPin!.pinId);
      if (hw) hoverNetKey = `${hw.fromCompId}|${hw.fromPinId}`;
    }
  }

  const hSegs: Array<{ y: number; x0: number; x1: number; net: string; col: string; bus: boolean; alpha: number }> = [];
  const vSegs: Array<{ x: number; y0: number; y1: number; net: string }> = [];

  for (const w of st.wires) {
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
      st.wireStyle,
      wireLane(cFrom, pFrom.id, compIdx.get(cFrom.id) || 0, st.wireStyle),
      w.curveOffset || 0,
      w.waypoints
    );
    const b = geomBounds(geom);
    if (b.x1 < vis.x0 || b.x0 > vis.x1 || b.y1 < vis.y0 || b.y0 > vis.y1) continue;

    const netKey = `${w.fromCompId}|${w.fromPinId}`;
    const isSelected = st.selectedWireId === w.id;
    const isHovered = st.hoveredWire?.id === w.id || (hoverNetKey !== null && hoverNetKey === netKey);
    const touchesSelected = st.selectedIds.has(cFrom.id) || st.selectedIds.has(cTo.id);
    const baseSigCol = getSignalColor(st.theme, w.signal, w.unstable);
    const col = w.customColor && !w.unstable && w.signal !== 'ERR' ? (isSignalNonZero(w.signal) ? w.customColor : CANVAS_THEMES[st.theme].sig0) : baseSigCol;
    const on = isSignalNonZero(w.signal);
    const busW = Math.max(pFrom.width || 1, pTo.width || 1, w.width || 1);
    const isBus = busW > 1;

    let wireAlpha = 1;
    if (st.wireVisibility === 'dim_inactive' && !on && !isSelected && !isHovered && !touchesSelected) {
      wireAlpha = 0.25;
    } else if (st.wireVisibility === 'selected_only' && !isSelected && !isHovered && !touchesSelected) {
      wireAlpha = 0.12;
    }
    if (hoverNetKey && hoverNetKey !== netKey && !isSelected && !touchesSelected) {
      wireAlpha = Math.min(wireAlpha, 0.22);
    }

    if (ortho && !isFast && geom.type === 'orthogonal' && wireAlpha > 0.3 && hSegs.length < 180) {
      for (let i = 1; i < geom.points.length; i++) {
        const a = geom.points[i - 1];
        const c = geom.points[i];
        if (Math.abs(a.y - c.y) < 0.5 && Math.abs(c.x - a.x) > 16) {
          hSegs.push({
            y: a.y,
            x0: Math.min(a.x, c.x) + 8,
            x1: Math.max(a.x, c.x) - 8,
            net: netKey,
            col,
            bus: isBus,
            alpha: wireAlpha
          });
        } else if (Math.abs(a.x - c.x) < 0.5 && Math.abs(c.y - a.y) > 16) {
          vSegs.push({
            x: a.x,
            y0: Math.min(a.y, c.y) + 8,
            y1: Math.max(a.y, c.y) - 8,
            net: netKey
          });
        }
      }
    }

    if (isSelected || isHovered) {
      special.push({ wire: w, geom, col, sel: isSelected, bus: isBus });
    } else {
      const key = `${on ? '1' : '0'}|${isBus ? 'B' : 'S'}|${wireAlpha}|${col}`;
      let g = groups.get(key);
      if (!g) {
        g = { path: new Path2D(), col, on, bus: isBus, alpha: wireAlpha };
        groups.set(key, g);
      }
      addGeomToPath(g.path, geom);
    }

    if (isBus && !isFast && settings.showWireLabels !== false && st.view.zoom >= 0.6 && wireAlpha > 0.2) {
      const mid = evalPointOnWire(geom, 0.5);
      busLabels.push({ x: mid.x, y: mid.y, width: busW, col, alpha: wireAlpha });
    }

    if (on && !isFast && settings.particles && st.simRunning && wireAlpha > 0.3) {
      particles.push(geom);
    }

    if (ortho && geom.type === 'orthogonal' && geom.points.length >= 3) {
      const k = `${w.fromCompId}|${w.fromPinId}`;
      if ((pinCount.get(k) || 0) > 1 && !dots.has(k)) {
        dots.set(k, { x: geom.points[1].x, y: geom.points[1].y, col });
      }
    }
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (!isFast) {
    groups.forEach(g => {
      if (g.on && g.alpha > 0.4) {
        ctx.globalAlpha = 0.17 * g.alpha;
        ctx.lineWidth = g.bus ? 10 : 8;
        ctx.strokeStyle = g.col;
        ctx.stroke(g.path);
      }
    });
  }

  groups.forEach(g => {
    ctx.globalAlpha = g.alpha;
    ctx.lineWidth = g.bus ? 4.0 : 2.5;
    ctx.strokeStyle = g.col;
    ctx.stroke(g.path);
  });
  ctx.globalAlpha = 1;

  // Bridge arcs at perpendicular orthogonal wire crossings so distinct nets stay unmistakable
  if (ortho && !isFast && hSegs.length > 0 && vSegs.length > 0 && st.view.zoom >= 0.45) {
    const bg = CANVAS_THEMES[st.theme].bg;
    for (const h of hSegs) {
      for (const v of vSegs) {
        if (h.net === v.net) continue;
        if (v.x > h.x0 && v.x < h.x1 && h.y > v.y0 && h.y < v.y1) {
          ctx.save();
          ctx.strokeStyle = bg;
          ctx.lineWidth = h.bus ? 9 : 7;
          ctx.beginPath();
          ctx.moveTo(v.x - 6, h.y);
          ctx.lineTo(v.x + 6, h.y);
          ctx.stroke();

          ctx.globalAlpha = h.alpha;
          ctx.strokeStyle = h.col;
          ctx.lineWidth = h.bus ? 3.8 : 2.4;
          ctx.beginPath();
          ctx.arc(v.x, h.y, 5, Math.PI, 0, false);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  for (const s of special) {
    const p = new Path2D();
    addGeomToPath(p, s.geom);
    ctx.globalAlpha = 0.26;
    ctx.lineWidth = s.sel ? 12 : 9.5;
    ctx.strokeStyle = s.col;
    ctx.stroke(p);
    ctx.globalAlpha = 1;
    ctx.lineWidth = s.sel ? (s.bus ? 5 : 4) : (s.bus ? 4.4 : 3.5);
    ctx.strokeStyle = s.sel ? '#ffffff' : s.col;
    ctx.stroke(p);

    // Draw articulated drag handle when selected or directly hovered
    if ((s.sel || st.hoveredWire?.id === s.wire.id) && st.view.zoom >= 0.4) {
      const h = getWireControlHandle(s.geom);
      const r = s.sel ? 6.5 : 5;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fillStyle = s.sel ? '#ffffff' : s.col;
      ctx.fill();
      ctx.strokeStyle = CANVAS_THEMES[st.theme].compFill;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }
  }

  if (dots.size) {
    dots.forEach(d => {
      ctx.fillStyle = d.col;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 3.4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Bus width badges (e.g. "64b")
  if (busLabels.length > 0 && busLabels.length <= 60) {
    const th = CANVAS_THEMES[st.theme];
    ctx.font = '800 8.5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const bl of busLabels) {
      ctx.save();
      ctx.globalAlpha = bl.alpha;
      const txt = `${bl.width}b`;
      const bw = txt.length * 5.6 + 8;
      roundRectPath(ctx, bl.x - bw / 2, bl.y - 7, bw, 14, 4);
      ctx.fillStyle = th.compFill;
      ctx.fill();
      ctx.strokeStyle = bl.col;
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.fillStyle = th.compText;
      ctx.fillText(txt, bl.x, bl.y + 0.5);
      ctx.restore();
    }
  }

  if (particles.length) {
    const phase = (st.simTime * 0.75) % 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (const g of particles) {
      for (let k = 0; k < 2; k++) {
        const pt = evalPointOnWire(g, (phase + k * 0.5) % 1);
        ctx.moveTo(pt.x + 2.7, pt.y);
        ctx.arc(pt.x, pt.y, 2.7, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }

  if (st.mode === 'WIRING' && st.wiringFrom) {
    const srcComp = compMap.get(st.wiringFrom.compId);
    const srcPin = srcComp?.pins.find(p => p.id === st.wiringFrom!.pinId);
    if (srcComp && srcPin) {
      const sx = pinWX(srcComp, srcPin);
      const sy = pinWY(srcComp, srcPin);
      const tx = st.snapPin ? st.snapPin.x : st.mouseWorld.x;
      const ty = st.snapPin ? st.snapPin.y : st.mouseWorld.y;
      const geom =
        st.wiringFrom.dir === 'out'
          ? getWireGeometry(sx, sy, tx, ty, st.wireStyle)
          : getWireGeometry(tx, ty, sx, sy, st.wireStyle);
      const w1 = srcPin.width || 1;
      const w2 = st.snapPin ? st.snapPin.width || 1 : w1;
      const mismatch = Boolean(
        st.snapPin &&
          st.snapPin.dir !== st.wiringFrom.dir &&
          st.snapPin.comp.id !== srcComp.id &&
          w1 !== w2
      );
      ctx.save();
      ctx.strokeStyle = mismatch ? CANVAS_THEMES[st.theme].warn : CANVAS_THEMES[st.theme].sig1;
      ctx.lineWidth = w1 > 1 ? 3.5 : 2.5;
      ctx.setLineDash(mismatch ? [4, 4] : [6, 5]);
      const p = new Path2D();
      addGeomToPath(p, geom);
      ctx.stroke(p);
      ctx.restore();
    }
  }
}

const SYMBOL_TYPES = new Set([
  'AND',
  'NAND',
  'OR',
  'NOR',
  'XOR',
  'XNOR',
  'NOT',
  'BUFFER',
  'TRI_BUFFER',
  'MUX_2',
  'MUX_4',
  'MUX_8',
  'MUX_16',
  'MUX_32',
  'DEMUX_2',
  'DEMUX_4',
  'DEMUX_8',
  'DEMUX_16',
  'DEMUX_32'
]);

function drawLogicSymbol(ctx: CanvasRenderingContext2D, comp: LogicComponent, th: CanvasTheme, pv: Record<string, PinSignal>): void {
  const t = comp.type;
  const w = comp.w;
  const h = comp.h;
  const lead = (x1: number, y1: number, x2: number, y2: number, v: PinSignal | undefined) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = isSignalNonZero(v) ? th.sig1 : th.compStroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  };
  ctx.lineJoin = 'round';
  if (t.indexOf('MUX') >= 0) {
    const x0 = -w / 2 + 3;
    const x1 = w / 2 - 3;
    const k = Math.min(20, h * 0.14);
    const pts =
      t.indexOf('DEMUX') === 0
        ? [
            [x0, -h / 2 + k],
            [x1, -h / 2 + 2],
            [x1, h / 2 - 2],
            [x0, h / 2 - k]
          ]
        : [
            [x0, -h / 2 + 2],
            [x1, -h / 2 + k],
            [x1, h / 2 - k],
            [x0, h / 2 - 2]
          ];
    comp.pins.forEach(p => {
      const v = pv[p.id];
      if (p.lx < -w / 2 + 4) lead(p.lx, p.ly, x0, p.ly, v);
      else if (p.lx > w / 2 - 4) lead(x1, p.ly, p.lx, p.ly, v);
      else lead(p.lx, p.ly, p.lx, p.ly - 7, v);
    });
    const on = comp.pins.some(p => p.dir === 'out' && isSignalNonZero(pv[p.id]));
    ctx.save();
    if (on) {
      ctx.shadowColor = th.sig1;
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.closePath();
    ctx.fillStyle = th.compFill;
    ctx.fill();
    ctx.strokeStyle = comp.unstable ? th.sigErr : on ? th.sig1 : th.compText;
    ctx.lineWidth = 1.9;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = th.subText;
    ctx.font = '800 9px monospace';
    ctx.textAlign = 'center';
    const bStr = (comp.bits || 1) > 1 ? ` ${comp.bits}b` : '';
    ctx.fillText((t.indexOf('DEMUX') === 0 ? 'DEMUX' : 'MUX') + bStr, 0, 0);
    return;
  }

  const bubble = t === 'NAND' || t === 'NOR' || t === 'XNOR' || t === 'NOT';
  const tri = t === 'TRI_BUFFER';
  const orLike = t === 'OR' || t === 'NOR' || t === 'XOR' || t === 'XNOR';
  const xorLike = t === 'XOR' || t === 'XNOR';
  const cy = tri ? -10 : 0;
  const hh = tri ? 16 : Math.min(h / 2 - 5, 30);
  const L = -w / 2 + 12;
  const R = w / 2 - 12 - (bubble ? 7 : 0);
  const xOff = (y: number) => (orLike ? (xorLike ? -6 : 0) + 6.5 * (1 - Math.pow((y - cy) / hh, 2)) : 0);
  const outOn = isSignalNonZero(pv.out);

  comp.pins.forEach(p => {
    if (p.dir === 'in') {
      if (p.id === 'oe') lead(0, h / 2, 0, cy + hh * (1 - (0 - L) / (R - L)), pv.oe);
      else lead(p.lx, p.ly, L + xOff(p.ly), p.ly, pv[p.id]);
    }
  });
  lead(R + (bubble ? 7 : 0), cy, w / 2, cy, pv.out);
  ctx.save();
  if (outOn) {
    ctx.shadowColor = th.sig1;
    ctx.shadowBlur = 9;
  }
  ctx.beginPath();
  if (t === 'AND' || t === 'NAND') {
    ctx.moveTo(L, -hh);
    ctx.lineTo(R - hh, -hh);
    ctx.arc(R - hh, 0, hh, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(L, hh);
    ctx.closePath();
  } else if (orLike) {
    const cx = (L + R) / 2 + 4;
    ctx.moveTo(L, -hh);
    ctx.quadraticCurveTo(cx, -hh, R, 0);
    ctx.quadraticCurveTo(cx, hh, L, hh);
    ctx.quadraticCurveTo(L + 13, 0, L, -hh);
    ctx.closePath();
  } else {
    ctx.moveTo(L, cy - hh);
    ctx.lineTo(R, cy);
    ctx.lineTo(L, cy + hh);
    ctx.closePath();
  }
  ctx.fillStyle = th.compFill;
  ctx.fill();
  ctx.strokeStyle = comp.unstable ? th.sigErr : outOn ? th.sig1 : th.compText;
  ctx.lineWidth = 1.9;
  ctx.stroke();
  if (xorLike) {
    ctx.beginPath();
    ctx.moveTo(L - 6, -hh);
    ctx.quadraticCurveTo(L + 7, 0, L - 6, hh);
    ctx.stroke();
  }
  if (bubble) {
    ctx.beginPath();
    ctx.arc(R + 3.5, cy, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = th.compFill;
    ctx.fill();
    ctx.stroke();
  }
  if ((comp.bits || 1) > 1) {
    ctx.fillStyle = th.subText;
    ctx.font = '800 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${comp.bits}b`, (L + R) / 2 - 2, cy);
  }
  ctx.restore();
}

// Reusable 64x48 offscreen canvas & ImageData for VGA_SCREEN
let vgaOffscreen: HTMLCanvasElement | null = null;
let vgaOffCtx: CanvasRenderingContext2D | null = null;
let vgaImgData: ImageData | null = null;
let vgaLastCompId: string | null = null;
let vgaLastVer = -1;

function ensureVgaSurface(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; img: ImageData } | null {
  if (typeof document === 'undefined') return null;
  if (!vgaOffscreen) {
    vgaOffscreen = document.createElement('canvas');
    vgaOffscreen.width = w;
    vgaOffscreen.height = h;
    vgaOffCtx = vgaOffscreen.getContext('2d');
    if (vgaOffCtx) vgaImgData = vgaOffCtx.createImageData(w, h);
    vgaLastCompId = null;
    vgaLastVer = -1;
  }
  if (!vgaOffCtx || !vgaImgData) return null;
  return { canvas: vgaOffscreen, ctx: vgaOffCtx, img: vgaImgData };
}

const LABELED_PINS_TYPES = new Set([
  'RAM_16X4',
  'ROM_16X4',
  'RAM_N',
  'ROM_N',
  'DUAL_RAM_N',
  'REG_FILE_N',
  'FIFO_N',
  'FSM',
  'ALU_4',
  'ALU_N',
  'ADDER_N',
  'SUB_N',
  'MULT_N',
  'DIV_N',
  'SHIFTER_N',
  'COMP_N',
  'INC_DEC_N',
  'ABS_NEG_N',
  'MIN_MAX_N',
  'POPCOUNT_N',
  'BIN2BCD_N',
  'REG_N',
  'COUNTER_N',
  'SHIFT_REG_N',
  'TIMER_N',
  'LFSR_N',
  'STACK_LIFO',
  'PARITY_N',
  'BIN2GRAY_N',
  'GRAY2BIN_N',
  'LUT_TRIG',
  'EDGE_DET',
  'PULSE_ONE',
  'BIT_EXTEND',
  'BUS_SLICE',
  'SPLITTER',
  'MERGER',
  'GAMEPAD',
  'KEYBOARD_ASCII',
  'VGA_SCREEN',
  'LCD_TEXT',
  'TONE_GEN',
  'RAYCAST_CORE',
  'SR_LATCH',
  'LATCH_D',
  'D_FF',
  'RS_FF',
  'JK_FF',
  'T_FF',
  'MAJ3',
  'REG_4',
  'COUNTER_4',
  'UDCOUNTER_4',
  'COUNTER_BCD',
  'SHIFT_REG_4',
  'FREQ_DIV',
  'LFSR_4',
  'HALF_ADDER',
  'FULL_ADDER',
  'ADDER_4',
  'MULT_2X2',
  'COMP_2',
  'COMP_4',
  'PARITY_4',
  'BIN2GRAY_4',
  'GRAY2BIN_4',
  'BCD_7SEG',
  'DEC_2TO4',
  'DEC_3TO8',
  'DEC_4TO16',
  'DEC_5TO32',
  'ENC_4TO2',
  'ENC_8TO3',
  'ENC_16TO4',
  'ENC_32TO5',
  'MAC_N',
  'PWM_GEN',
  'RING_CNT',
  'CRC8_GEN',
  'UART_TX',
  'UART_RX',
  'TRAFFIC_LIGHT',
  'ROTARY_ENC',
  'CROSSBAR_2X2',
  'PRIORITY_ARB',
  'BUS_PACK4',
  'BUS_UNPACK4',
  'SAT_ADDER_N',
  'SQRT_N',
  'COMP_WIN_N',
  'MOD_COUNTER_N',
  'WATCHDOG_N',
  'DEBOUNCER',
  'STOPWATCH_N',
  'CRC16_GEN',
  'TEXT_CONSOLE',
  'ANIM32_GPU',
  'CUSTOM_IC'
]);

export function drawComponent(
  ctx: CanvasRenderingContext2D,
  comp: LogicComponent,
  theme: ThemeId,
  selectedIds: Set<string>,
  snapPin: WorldPin | null,
  hoveredPin: WorldPin | null,
  zoom = 1,
  lowDetail = false
): void {
  const th = CANVAS_THEMES[theme];
  const isSelected = selectedIds.has(comp.id);
  const pv = comp.pinValues;
  const st = comp.internalState;
  const b = Math.max(1, Math.min(64, comp.bits || 1));

  ctx.save();
  ctx.translate(comp.x, comp.y);
  const scale = comp.spawnScale || 1;
  if (scale !== 1) ctx.scale(scale, scale);

  const oriented = comp.type !== 'LABEL' && ((comp.rot || 0) % 4 !== 0 || comp.flip);
  let origFillText: CanvasRenderingContext2D['fillText'] | null = null;
  if (oriented) {
    const rr = ((comp.rot || 0) * Math.PI) / 2;
    const fx = comp.flip ? -1 : 1;
    ctx.rotate(rr);
    ctx.scale(fx, 1);
    origFillText = CanvasRenderingContext2D.prototype.fillText;
    ctx.fillText = function (t: string, x: number, y: number, mw?: number) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(fx, 1);
      ctx.rotate(-rr);
      origFillText!.call(ctx, t, 0, 0, mw);
      ctx.restore();
    };
  }

  // Etiqueta de texto libre
  if (comp.type === 'LABEL') {
    ctx.font = '700 13px system-ui, sans-serif';
    const textW = Math.max(80, ctx.measureText(comp.noteText || 'Nota').width + 24);
    comp.w = textW;
    roundRectPath(ctx, -comp.w / 2, -comp.h / 2, comp.w, comp.h, 8);
    ctx.fillStyle = th.compFill;
    ctx.fill();
    ctx.strokeStyle = isSelected ? th.compSelected : th.compStroke;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();
    ctx.fillStyle = th.compText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(comp.noteText || 'Nota', 0, 0);
    ctx.restore();
    return;
  }

  // Túnel inalámbrico (forma de bandera direccional)
  if (comp.type === 'TUNNEL') {
    const isOut = comp.tunnelDir !== 'in';
    const hw = comp.w / 2;
    const hh = comp.h / 2;
    const sig = isOut ? pv.in0 : pv.out;
    const on = isSignalNonZero(sig);
    ctx.save();
    if (on) {
      ctx.shadowColor = th.sig1;
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    if (isOut) {
      ctx.moveTo(-hw, -hh);
      ctx.lineTo(hw - 12, -hh);
      ctx.lineTo(hw, 0);
      ctx.lineTo(hw - 12, hh);
      ctx.lineTo(-hw, hh);
    } else {
      ctx.moveTo(-hw + 12, -hh);
      ctx.lineTo(hw, -hh);
      ctx.lineTo(hw, hh);
      ctx.lineTo(-hw + 12, hh);
      ctx.lineTo(-hw, 0);
    }
    ctx.closePath();
    ctx.fillStyle = th.compFill;
    ctx.fill();
    ctx.strokeStyle = isSelected ? th.compSelected : on ? th.sig1 : th.compStroke;
    ctx.lineWidth = isSelected ? 2.3 : 1.6;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = on ? th.sig1 : th.compText;
    ctx.font = '800 10.5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tag = (comp.tunnelTag || 'SIG').slice(0, 9);
    ctx.fillText(tag, isOut ? -4 : 4, -4);
    ctx.fillStyle = th.subText;
    ctx.font = '700 8px monospace';
    ctx.fillText(`${isOut ? 'TX' : 'RX'} ${b}b`, isOut ? -4 : 4, 9);
  } else if (SYMBOL_TYPES.has(comp.type)) {
    if (isSelected) {
      roundRectPath(ctx, -comp.w / 2, -comp.h / 2, comp.w, comp.h, 10);
      ctx.strokeStyle = th.compSelected;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.shadowColor = th.compSelected;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
    }
  } else {
    roundRectPath(ctx, -comp.w / 2, -comp.h / 2, comp.w, comp.h, 10);
    ctx.fillStyle = th.compFill;
    if (isSelected) {
      ctx.shadowColor = th.compSelected;
      ctx.shadowBlur = 14;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = comp.unstable ? th.sigErr : isSelected ? th.compSelected : th.compStroke;
    ctx.lineWidth = isSelected ? 2.4 : 1.5;
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  switch (comp.type) {
    case 'TUNNEL':
      break;

    case 'SWITCH': {
      const on = st.value === 1;
      roundRectPath(ctx, -20, -10, 36, 20, 10);
      ctx.fillStyle = on ? th.sig1 : th.sig0;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(on ? 6 : -10, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'BUTTON': {
      const on = st.value === 1;
      ctx.fillStyle = on ? th.sig1 : th.pinFill;
      ctx.strokeStyle = th.sig1;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(-2, 0, on ? 10 : 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'CLOCK': {
      const on = pv.out === 1;
      ctx.strokeStyle = on ? th.sig1 : th.subText;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-18, 6);
      ctx.lineTo(-10, 6);
      ctx.lineTo(-10, -6);
      ctx.lineTo(0, -6);
      ctx.lineTo(0, 6);
      ctx.lineTo(10, 6);
      ctx.lineTo(10, -6);
      ctx.lineTo(16, -6);
      ctx.stroke();
      break;
    }

    case 'HIGH':
    case 'LOW': {
      const v = comp.type === 'HIGH' ? 1 : 0;
      ctx.fillStyle = v === 1 ? th.sig1 : th.subText;
      ctx.font = '800 15px monospace';
      ctx.fillText(String(v), -2, 0);
      break;
    }

    case 'CONST_N':
    case 'DIP_SWITCH': {
      const valStr = formatSignalHex(pv.out ?? pv.bus ?? 0n, b);
      ctx.fillStyle = th.subText;
      ctx.font = '700 8.5px monospace';
      ctx.fillText(`${comp.type === 'DIP_SWITCH' ? 'DIP' : 'CONST'} ${b}b`, -3, -10);
      ctx.fillStyle = th.sig1;
      ctx.font = `800 ${valStr.length > 10 ? 9.5 : 11.5}px monospace`;
      ctx.fillText(valStr.length > 16 ? `…${valStr.slice(-12)}` : valStr, -3, 7);
      break;
    }

    case 'HEX_KEY': {
      ctx.fillStyle = th.sig1;
      ctx.font = '800 22px monospace';
      ctx.fillText(Number(st.hexVal || 0).toString(16).toUpperCase(), -6, -4);
      ctx.fillStyle = th.subText;
      ctx.font = '600 9px system-ui, sans-serif';
      ctx.fillText('CLIC +1', -6, 22);
      break;
    }

    case 'HEX_KEY_N': {
      ctx.fillStyle = th.subText;
      ctx.font = '700 8px monospace';
      ctx.fillText(`HEX ${b}b`, -4, -14);
      ctx.fillStyle = th.sig1;
      ctx.font = '800 14px monospace';
      ctx.fillText(formatSignalHex(pv.out, b).slice(0, 10), -4, 3);
      ctx.fillStyle = th.subText;
      ctx.font = '600 8px system-ui, sans-serif';
      ctx.fillText('CLIC +1', -4, 19);
      break;
    }

    case 'NUM_STEPPER': {
      const val = toUintN(pv.out ?? 0n, b);
      ctx.fillStyle = th.subText;
      ctx.font = '700 8px monospace';
      ctx.fillText(`STEP ${b}b`, -4, -15);
      // Left "-" button
      roundRectPath(ctx, -49, -6, 22, 20, 5);
      ctx.fillStyle = 'rgba(100,116,139,0.22)';
      ctx.fill();
      ctx.strokeStyle = th.compStroke;
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.fillStyle = th.compText;
      ctx.font = '800 14px monospace';
      ctx.fillText('−', -38, 4);
      // Right "+" button
      roundRectPath(ctx, 19, -6, 22, 20, 5);
      ctx.fillStyle = 'rgba(100,116,139,0.22)';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = th.sig1;
      ctx.fillText('+', 30, 4);
      // Center value
      const decStr = val.toString();
      ctx.fillStyle = th.sig1;
      ctx.font = `800 ${decStr.length > 5 ? 9.5 : 12.5}px monospace`;
      ctx.fillText(decStr.length > 7 ? `0x${val.toString(16).toUpperCase().slice(-5)}` : decStr, -4, 4);
      break;
    }

    case 'PULSE_GEN': {
      ctx.fillStyle = th.compText;
      ctx.font = '700 10px monospace';
      ctx.fillText(st.seqBits.join(''), 0, -6);
      ctx.fillStyle = th.sig1;
      ctx.font = '700 9px monospace';
      ctx.fillText(`IDX:${st.seqIdx}`, 0, 10);
      break;
    }

    case 'GAMEPAD': {
      const g = st.gamepadBits || 0;
      ctx.fillStyle = th.subText;
      ctx.font = '800 8px monospace';
      ctx.fillText('GAMEPAD (WASD)', -10, -47);
      const drawBtn = (bx: number, by: number, lbl: string, active: boolean, wBtn = 22, hBtn = 19) => {
        roundRectPath(ctx, bx - wBtn / 2, by - hBtn / 2, wBtn, hBtn, 5);
        ctx.fillStyle = active ? th.sig1 : 'rgba(100,116,139,0.22)';
        ctx.fill();
        ctx.strokeStyle = active ? '#fff' : th.compStroke;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = active ? th.compFill : th.compText;
        ctx.font = '800 9.5px monospace';
        ctx.fillText(lbl, bx, by + 0.5);
      };
      drawBtn(-18, -24, 'W', (g & 1) !== 0);
      drawBtn(-42, -1, 'A', (g & 4) !== 0);
      drawBtn(-18, -1, 'S', (g & 2) !== 0);
      drawBtn(6, -1, 'D', (g & 8) !== 0);
      drawBtn(-18, 22, 'FIRE (E/J)', (g & 16) !== 0, 62, 18);
      break;
    }

    case 'KEYBOARD_ASCII': {
      const ch = st.lastKeyAscii || 0;
      const printable = ch >= 32 && ch <= 126 ? String.fromCharCode(ch) : '--';
      ctx.fillStyle = th.subText;
      ctx.font = '800 8.5px monospace';
      ctx.fillText('ASCII KEY', -8, -16);
      ctx.fillStyle = st.keyReady ? th.sig1 : th.compText;
      ctx.font = '800 18px monospace';
      ctx.fillText(printable, -8, 4);
      ctx.fillStyle = th.subText;
      ctx.font = '700 8.5px monospace';
      ctx.fillText(`0x${ch.toString(16).toUpperCase().padStart(2, '0')}`, -8, 22);
      break;
    }

    case 'LED': {
      const ledCol = (LED_PALETTE[comp.color] || LED_PALETTE.cyan).hex;
      const on = pv.in0 === 1;
      ctx.save();
      if (on) {
        ctx.shadowColor = ledCol;
        ctx.shadowBlur = 18;
      }
      ctx.fillStyle = on ? ledCol : 'rgba(100,116,139,0.22)';
      ctx.beginPath();
      ctx.arc(4, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = on ? '#ffffff' : th.pinStroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'LED_RGB': {
      const r = bit(pv.r) * 255;
      const g = bit(pv.g) * 255;
      const bl = bit(pv.b) * 255;
      const anyOn = r + g + bl > 0;
      const rgbStr = anyOn ? `rgb(${r},${g},${bl})` : 'rgba(100,116,139,0.22)';
      ctx.save();
      if (anyOn) {
        ctx.shadowColor = rgbStr;
        ctx.shadowBlur = 20;
      }
      ctx.fillStyle = rgbStr;
      ctx.beginPath();
      ctx.arc(6, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = anyOn ? '#ffffff' : th.pinStroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'SEG7_DISPLAY': {
      const segHex = (LED_PALETTE[comp.color] || LED_PALETTE.cyan).hex;
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      roundRectPath(ctx, -20, -62, 52, 124, 6);
      ctx.fill();
      const drawSeg = (x: number, y: number, w: number, h: number, on: boolean) => {
        ctx.save();
        if (on) {
          ctx.shadowColor = segHex;
          ctx.shadowBlur = 10;
        }
        ctx.fillStyle = on ? segHex : 'rgba(148,163,184,0.14)';
        roundRectPath(ctx, x, y, w, h, 2);
        ctx.fill();
        ctx.restore();
      };
      drawSeg(-6, -50, 24, 5, pv.a === 1);
      drawSeg(19, -44, 5, 38, pv.b === 1);
      drawSeg(19, 3, 5, 38, pv.c === 1);
      drawSeg(-6, 42, 24, 5, pv.d === 1);
      drawSeg(-12, 3, 5, 38, pv.e === 1);
      drawSeg(-12, -44, 5, 38, pv.f === 1);
      drawSeg(-6, -3, 24, 5, pv.g === 1);
      break;
    }

    case 'HEX_DISPLAY': {
      const hexCol = (LED_PALETTE[comp.color] || LED_PALETTE.cyan).hex;
      const val = (bit(pv.d3) << 3) | (bit(pv.d2) << 2) | (bit(pv.d1) << 1) | bit(pv.d0);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      roundRectPath(ctx, -14, -32, 44, 64, 8);
      ctx.fill();
      ctx.save();
      ctx.shadowColor = hexCol;
      ctx.shadowBlur = 12;
      ctx.fillStyle = hexCol;
      ctx.font = '800 28px monospace';
      ctx.fillText(val.toString(16).toUpperCase(), 8, 1);
      ctx.restore();
      break;
    }

    case 'HEX_DISPLAY_N': {
      const hexCol = (LED_PALETTE[comp.color] || LED_PALETTE.cyan).hex;
      const u = toUintN(pv.d, b);
      const hexStr = u.toString(16).toUpperCase().padStart(Math.ceil(b / 4), '0');
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      roundRectPath(ctx, -comp.w / 2 + 12, -26, comp.w - 20, 46, 7);
      ctx.fill();
      ctx.save();
      ctx.shadowColor = hexCol;
      ctx.shadowBlur = 10;
      ctx.fillStyle = hexCol;
      const fs = hexStr.length > 10 ? 13 : hexStr.length > 4 ? 17 : 22;
      ctx.font = `800 ${fs}px monospace`;
      ctx.fillText(hexStr, 4, -3);
      ctx.restore();
      ctx.fillStyle = th.subText;
      ctx.font = '700 8.5px monospace';
      ctx.fillText(`DEC: ${u.toString()}`, 4, 28);
      break;
    }

    case 'DEC_DISPLAY_N': {
      const decCol = (LED_PALETTE[comp.color] || LED_PALETTE.emerald).hex;
      const u = toUintN(pv.d, b);
      const valText = comp.signedMode ? toSignedN(u, b).toString() : u.toString();
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      roundRectPath(ctx, -comp.w / 2 + 12, -22, comp.w - 20, 38, 7);
      ctx.fill();
      ctx.save();
      ctx.shadowColor = decCol;
      ctx.shadowBlur = 9;
      ctx.fillStyle = decCol;
      const fs = valText.length > 14 ? 10 : valText.length > 9 ? 13 : valText.length > 5 ? 16 : 20;
      ctx.font = `800 ${fs}px monospace`;
      ctx.fillText(valText.length > 19 ? `…${valText.slice(-17)}` : valText, 4, -3);
      ctx.restore();
      ctx.fillStyle = th.subText;
      ctx.font = '700 8px monospace';
      ctx.fillText(`${comp.signedMode ? 'SGN' : 'UNS'} · ${formatSignalHex(pv.d ?? 0n, b)}`, 4, 24);
      break;
    }

    case 'TRAFFIC_LIGHT': {
      roundRectPath(ctx, -10, -48, 34, 96, 8);
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.fill();
      const lamps: Array<{ y: number; on: boolean; col: string }> = [
        { y: -30, on: bit(pv.r) === 1, col: '#ef4444' },
        { y: 0, on: bit(pv.y) === 1, col: '#f59e0b' },
        { y: 30, on: bit(pv.g) === 1, col: '#10b981' }
      ];
      for (const lp of lamps) {
        ctx.save();
        if (lp.on) {
          ctx.shadowColor = lp.col;
          ctx.shadowBlur = 14;
        }
        ctx.beginPath();
        ctx.arc(7, lp.y, 10.5, 0, Math.PI * 2);
        ctx.fillStyle = lp.on ? lp.col : 'rgba(100,116,139,0.22)';
        ctx.fill();
        ctx.strokeStyle = lp.on ? '#ffffff' : th.pinStroke;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }
      break;
    }

    case 'LED_BAR_4': {
      const barCol = (LED_PALETTE[comp.color] || LED_PALETTE.cyan).hex;
      [pv.b3, pv.b2, pv.b1, pv.b0].forEach((bv, i) => {
        const py = -27 + i * 18;
        ctx.save();
        if (bv === 1) {
          ctx.shadowColor = barCol;
          ctx.shadowBlur = 10;
        }
        ctx.fillStyle = bv === 1 ? barCol : 'rgba(100,116,139,0.22)';
        roundRectPath(ctx, -6, py - 5, 28, 10, 4);
        ctx.fill();
        ctx.restore();
      });
      break;
    }

    case 'LED_BAR_8': {
      const nb = b >= 16 ? 16 : 8;
      const barCol = (LED_PALETTE[comp.color] || LED_PALETTE.cyan).hex;
      const raw = toUintN(pv.d, nb);
      const xStart = -comp.w / 2 + 24;
      const avail = comp.w - 32;
      const step = avail / nb;
      const segW = Math.max(4, step - 3);
      for (let idx = 0; idx < nb; idx++) {
        const bitPos = nb - 1 - idx;
        const on = ((raw >> BigInt(bitPos)) & 1n) === 1n;
        const px = xStart + idx * step;
        ctx.save();
        if (on) {
          ctx.shadowColor = barCol;
          ctx.shadowBlur = 8;
        }
        ctx.fillStyle = on ? barCol : 'rgba(100,116,139,0.22)';
        roundRectPath(ctx, px, -11, segW, 22, 2.5);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = th.subText;
      ctx.font = '700 7.5px monospace';
      ctx.fillText(`BAR ${nb}b · ${formatSignalHex(raw, nb)}`, 8, 18);
      break;
    }

    case 'SEG7_MULTI': {
      const n = Math.max(2, Math.min(4, comp.inputCount || 2));
      const col = (LED_PALETTE[comp.color] || LED_PALETTE.cyan).hex;
      const ax = -comp.w / 2 + 30;
      const aw = comp.w - 38;
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      roundRectPath(ctx, ax, -comp.h / 2 + 6, aw, comp.h - 12, 8);
      ctx.fill();
      const dw = aw / n;
      for (let k = n - 1; k >= 0; k--) {
        const val =
          (bit(pv[`g${k}_3`]) << 3) | (bit(pv[`g${k}_2`]) << 2) | (bit(pv[`g${k}_1`]) << 1) | bit(pv[`g${k}_0`]);
        const segs = SEG7_BCD_TABLE[val];
        const gx = ax + (n - 1 - k) * dw + dw * 0.18;
        const gw = dw * 0.64;
        const gh = 70;
        const y0 = -gh / 2;
        const t = gw * 0.17;
        const rects = [
          [gx + t, y0, gw - 2 * t, t],
          [gx + gw - t, y0 + t, t, gh / 2 - 1.5 * t],
          [gx + gw - t, t / 2, t, gh / 2 - 1.5 * t],
          [gx + t, y0 + gh - t, gw - 2 * t, t],
          [gx, t / 2, t, gh / 2 - 1.5 * t],
          [gx, y0 + t, t, gh / 2 - 1.5 * t],
          [gx + t, -t / 2, gw - 2 * t, t]
        ];
        ctx.save();
        rects.forEach((r, i) => {
          const on = segs[i] === 1;
          if (on) {
            ctx.shadowColor = col;
            ctx.shadowBlur = 9;
          }
          ctx.fillStyle = on ? col : 'rgba(100,116,139,0.18)';
          roundRectPath(ctx, r[0], r[1], r[2], r[3], 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        });
        ctx.restore();
        const gTop = -comp.h / 2 + 8 + (n - 1 - k) * 58 + 8;
        ctx.fillStyle = th.subText;
        ctx.font = '700 8.5px monospace';
        ctx.fillText(`D${k}`, -comp.w / 2 + 16, gTop + 19);
      }
      break;
    }

    case 'LED_MATRIX_4X4': {
      const col = (LED_PALETTE[comp.color] || LED_PALETTE.cyan).hex;
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      roundRectPath(ctx, -50, -50, 100, 100, 8);
      ctx.fill();
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const on = bit(pv[`row${r}`]) === 1 && bit(pv[`col${c}`]) === 1;
          const cx = -34.5 + c * 23;
          const cy = -34.5 + r * 23;
          ctx.save();
          if (on) {
            ctx.shadowColor = col;
            ctx.shadowBlur = 10;
          }
          ctx.beginPath();
          ctx.arc(cx, cy, 8, 0, Math.PI * 2);
          ctx.fillStyle = on ? col : 'rgba(100,116,139,0.2)';
          ctx.fill();
          ctx.restore();
        }
      }
      break;
    }

    case 'LED_MATRIX_8X8': {
      const col = (LED_PALETTE[comp.color] || LED_PALETTE.cyan).hex;
      const clr = bit(pv.clr) === 1;
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      roundRectPath(ctx, -54, -66, 120, 128, 8);
      ctx.fill();
      for (let r = 0; r < 8; r++) {
        const rowByte = clr ? 0 : Number(toUintN(pv[`r${r}`], 8));
        for (let c = 0; c < 8; c++) {
          const on = ((rowByte >> (7 - c)) & 1) === 1;
          const cx = -42 + c * 13.5;
          const cy = -54 + r * 14.5;
          ctx.beginPath();
          ctx.arc(cx, cy, 4.6, 0, Math.PI * 2);
          ctx.fillStyle = on ? col : 'rgba(100,116,139,0.18)';
          ctx.fill();
        }
      }
      break;
    }

    case 'VGA_SCREEN': {
      const vw = st.vgaW || 64;
      const vh = st.vgaH || 48;
      const sx = -comp.w / 2 + 44;
      const sy = -comp.h / 2 + 18;
      const sw = comp.w - 56;
      const sh = comp.h - 46;
      ctx.fillStyle = '#03060a';
      roundRectPath(ctx, sx - 3, sy - 3, sw + 6, sh + 6, 6);
      ctx.fill();
      ctx.strokeStyle = th.compStroke;
      ctx.lineWidth = 1;
      ctx.stroke();

      const surf = ensureVgaSurface(vw, vh);
      const front = st.vgaFront;
      if (surf && front && front.length === vw * vh) {
        const curVer = st.vgaVersion ?? 0;
        if (vgaLastCompId !== comp.id || vgaLastVer !== curVer) {
          const u32 = new Uint32Array(surf.img.data.buffer);
          for (let i = 0; i < vw * vh; i++) {
            u32[i] = RGB332_ABGR[front[i]];
          }
          surf.ctx.putImageData(surf.img, 0, 0);
          vgaLastCompId = comp.id;
          vgaLastVer = curVer;
        }
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(surf.canvas, sx, sy, sw, sh);
        ctx.restore();
      }
      ctx.fillStyle = th.subText;
      ctx.font = '800 8.5px monospace';
      ctx.fillText('VGA 64×48 RGB332', sx + sw / 2, -comp.h / 2 + 10);
      break;
    }

    case 'RAYCAST_CORE': {
      ctx.fillStyle = th.sig1;
      ctx.font = '800 10.5px monospace';
      ctx.fillText('RAYCAST 3D', 0, -comp.h / 2 + 14);
      ctx.fillStyle = th.compText;
      ctx.font = '700 9px monospace';
      const px = ((st.rcX as number) ?? 2.5).toFixed(1);
      const py = ((st.rcY as number) ?? 2.5).toFixed(1);
      ctx.fillText(`POS ${px},${py}`, 0, -10);
      ctx.fillStyle = th.warn;
      ctx.fillText(`KILLS: ${(st.rcKills as number) || 0}`, 0, 8);
      ctx.fillStyle = th.subText;
      ctx.font = '700 8px monospace';
      ctx.fillText(`COL ${Number(st.rcColIdx || 0)}/64`, 0, 26);
      break;
    }

    case 'RAM_16X4':
    case 'ROM_16X4': {
      const isRam = comp.type === 'RAM_16X4';
      const mem = st.mem || new Array(16).fill(0);
      const addr = (bit(pv.a3) << 3) | (bit(pv.a2) << 2) | (bit(pv.a1) << 1) | bit(pv.a0);
      ctx.fillStyle = th.compText;
      ctx.font = '800 11px monospace';
      ctx.fillText(isRam ? 'RAM 16×4' : 'ROM 16×4', 0, -comp.h / 2 + 11);
      const cw = 15;
      const ch = 12;
      const gx0 = -2 * cw;
      const gy0 = -comp.h / 2 + 22;
      ctx.font = '700 8px monospace';
      for (let i = 0; i < 16; i++) {
        const cx = gx0 + (i % 4) * cw;
        const cy = gy0 + Math.floor(i / 4) * ch;
        const sel = i === addr;
        ctx.fillStyle = sel ? th.sig1 : 'rgba(100,116,139,0.18)';
        roundRectPath(ctx, cx + 1, cy + 1, cw - 2, ch - 2, 3);
        ctx.fill();
        ctx.fillStyle = sel ? th.compFill : th.compText;
        ctx.fillText((Number(mem[i]) & 15).toString(16).toUpperCase(), cx + cw / 2, cy + ch / 2 + 0.5);
      }
      ctx.fillStyle = th.subText;
      ctx.font = '700 9px monospace';
      ctx.fillText(
        `[${addr.toString(16).toUpperCase()}] = ${(Number(mem[addr]) & 15).toString(16).toUpperCase()}`,
        0,
        gy0 + 4 * ch + 12
      );
      break;
    }

    case 'LCD_TEXT': {
      const sx = -comp.w / 2 + 52;
      const sy = -comp.h / 2 + 16;
      const sw = comp.w - 62;
      const sh = comp.h - 46;
      const lcdHex = (LED_PALETTE[comp.color] || LED_PALETTE.emerald).hex;
      ctx.fillStyle = '#071b16';
      roundRectPath(ctx, sx, sy, sw, sh, 6);
      ctx.fill();
      ctx.strokeStyle = th.compStroke;
      ctx.lineWidth = 1;
      ctx.stroke();

      const chars = st.lcdChars || [];
      let line0 = '';
      let line1 = '';
      for (let i = 0; i < 16; i++) {
        const c0 = Number(chars[i] ?? 32);
        const c1 = Number(chars[16 + i] ?? 32);
        line0 += c0 >= 32 && c0 <= 126 ? String.fromCharCode(c0) : ' ';
        line1 += c1 >= 32 && c1 <= 126 ? String.fromCharCode(c1) : ' ';
      }
      ctx.save();
      ctx.fillStyle = lcdHex;
      ctx.font = '800 11.5px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(line0, sx + 9, sy + sh * 0.34);
      ctx.fillText(line1, sx + 9, sy + sh * 0.72);
      ctx.restore();
      ctx.fillStyle = th.subText;
      ctx.font = '800 8px monospace';
      ctx.fillText('LCD 16×2 ASCII', sx + sw / 2, -comp.h / 2 + 9);
      break;
    }

    case 'RAM_N':
    case 'ROM_N': {
      const isRam = comp.type === 'RAM_N';
      const ab = Math.max(4, Math.min(16, comp.addrBits || 8));
      const size = 1 << ab;
      const mem = st.mem || [];
      const addr = Number(toUintN(pv.addr, ab)) & (size - 1);
      const word = mem[addr] !== undefined ? toUintN(mem[addr] as PinSignal, b) : 0n;
      ctx.fillStyle = th.compText;
      ctx.font = '800 10.5px monospace';
      ctx.fillText(`${isRam ? 'RAM' : 'ROM'} ${size >= 1024 ? `${size / 1024}K` : size}×${b}b`, 0, -comp.h / 2 + 13);
      ctx.fillStyle = th.subText;
      ctx.font = '700 8.5px monospace';
      ctx.fillText(`[0x${addr.toString(16).toUpperCase()}]`, 0, -6);
      ctx.fillStyle = th.sig1;
      ctx.font = '800 11px monospace';
      const dStr = formatSignalHex(word, b);
      ctx.fillText(dStr.length > 11 ? `…${dStr.slice(-9)}` : dStr, 0, 12);
      break;
    }

    case 'DUAL_RAM_N': {
      const ab = Math.max(4, Math.min(16, comp.addrBits || 8));
      const size = 1 << ab;
      const aa = Number(toUintN(pv.aa, ab)) & (size - 1);
      const addrB = Number(toUintN(pv.ab, ab)) & (size - 1);
      ctx.fillStyle = th.compText;
      ctx.font = '800 10px monospace';
      ctx.fillText(`DRAM ${size >= 1024 ? `${size / 1024}K` : size}×${b}b`, 0, -comp.h / 2 + 13);
      ctx.fillStyle = th.subText;
      ctx.font = '700 8px monospace';
      ctx.fillText(`A:${aa.toString(16).toUpperCase()} B:${addrB.toString(16).toUpperCase()}`, 0, -7);
      ctx.fillStyle = th.sig1;
      ctx.font = '800 9.5px monospace';
      const qaS = formatSignalCompact(pv.qa ?? 0n, b);
      const qbS = formatSignalCompact(pv.qb ?? 0n, b);
      ctx.fillText(`${qaS.slice(-5)} | ${qbS.slice(-5)}`, 0, 14);
      break;
    }

    case 'REG_FILE_N': {
      ctx.fillStyle = th.compText;
      ctx.font = '800 10px monospace';
      ctx.fillText(`REGS 8×${b}b`, 0, -comp.h / 2 + 13);
      const ra = Number(toUintN(pv.ra, 3)) & 7;
      const rb = Number(toUintN(pv.rb, 3)) & 7;
      ctx.fillStyle = th.subText;
      ctx.font = '700 8.5px monospace';
      ctx.fillText(`R${ra} | R${rb}`, 0, -6);
      ctx.fillStyle = th.sig1;
      ctx.font = '800 9.5px monospace';
      const qa = formatSignalCompact(pv.qa ?? 0n, b);
      const qb = formatSignalCompact(pv.qb ?? 0n, b);
      ctx.fillText(`${qa.slice(-5)} / ${qb.slice(-5)}`, 0, 14);
      break;
    }

    case 'FIFO_N': {
      const cnt = Number(toUintN(pv.cnt, 6));
      ctx.fillStyle = th.compText;
      ctx.font = '800 10.5px monospace';
      ctx.fillText(`FIFO ${b}b`, 0, -comp.h / 2 + 13);
      ctx.fillStyle = th.subText;
      ctx.font = '700 8.5px monospace';
      ctx.fillText(`${cnt}/32`, 0, -6);
      ctx.fillStyle = th.sig1;
      ctx.font = '800 10.5px monospace';
      const qStr = formatSignalCompact(pv.q ?? 0n, b);
      ctx.fillText(qStr.length > 9 ? `…${qStr.slice(-7)}` : qStr, 0, 14);
      break;
    }

    case 'ALU_4': {
      const OPS = ['A+B', 'A−B', 'A&B', 'A|B', 'A^B', '~A', 'A+1', 'A«1'];
      ctx.fillStyle = th.compText;
      ctx.font = '800 12px monospace';
      ctx.fillText('ALU', 0, -comp.h / 2 + 12);
      ctx.fillStyle = th.sig1;
      ctx.font = '800 11px monospace';
      ctx.fillText(OPS[st.aluOp || 0] || 'ADD', 0, -comp.h / 2 + 30);
      ctx.fillStyle = th.subText;
      ctx.font = '700 9px monospace';
      ctx.fillText(
        `A=${(st.aluA || 0n).toString(16).toUpperCase()} B=${(st.aluB || 0n).toString(16).toUpperCase()}`,
        0,
        -8
      );
      ctx.save();
      ctx.shadowColor = th.sig1;
      ctx.shadowBlur = 10;
      ctx.fillStyle = th.sig1;
      ctx.font = '800 24px monospace';
      ctx.fillText((st.aluRes || 0n).toString(16).toUpperCase(), 0, 20);
      ctx.restore();
      break;
    }

    case 'ALU_N': {
      const OPS = ['ADD', 'SUB', 'AND', 'OR', 'XOR', 'NOT', 'INC', 'DEC', 'SHL', 'SHR', 'ASR', 'MUL', 'SLT', 'NEG', 'A', 'B'];
      ctx.fillStyle = th.compText;
      ctx.font = '800 11px monospace';
      ctx.fillText(`ALU ${b}b`, 0, -comp.h / 2 + 13);
      ctx.fillStyle = th.sig1;
      ctx.font = '800 11px monospace';
      ctx.fillText(OPS[st.aluOp || 0] || 'ADD', 0, -14);
      const resStr = formatSignalCompact(pv.y ?? 0n, b);
      ctx.fillStyle = th.sig1;
      ctx.font = `800 ${resStr.length > 8 ? 10 : 14}px monospace`;
      ctx.fillText(resStr.length > 10 ? `…${resStr.slice(-8)}` : resStr, 0, 10);
      break;
    }

    case 'MAC_N': {
      ctx.fillStyle = th.compText;
      ctx.font = '800 10.5px monospace';
      ctx.fillText(`MAC ${b}b`, 0, -comp.h / 2 + 14);
      ctx.fillStyle = th.subText;
      ctx.font = '700 8px monospace';
      ctx.fillText(comp.signedMode ? 'A×B+ACC (±)' : 'A×B+ACC', 0, -14);
      const accStr = formatSignalCompact(pv.acc ?? 0n, b);
      ctx.fillStyle = th.sig1;
      ctx.font = `800 ${accStr.length > 8 ? 9.5 : 13}px monospace`;
      ctx.fillText(accStr.length > 10 ? `…${accStr.slice(-8)}` : accStr, 0, 6);
      if (bit(pv.ovf) === 1) {
        ctx.fillStyle = th.sigErr;
        ctx.font = '800 8px monospace';
        ctx.fillText('OVF', 0, 22);
      }
      break;
    }

    case 'PWM_GEN': {
      const duty = Number(toUintN(pv.duty, 8));
      const pct = Math.round((duty / 255) * 100);
      const outOn = bit(pv.pwm) === 1;
      ctx.fillStyle = th.compText;
      ctx.font = '800 10px monospace';
      ctx.fillText('PWM 8b', 0, -comp.h / 2 + 13);
      // Duty bar
      roundRectPath(ctx, -22, -10, 44, 9, 4);
      ctx.fillStyle = 'rgba(100,116,139,0.22)';
      ctx.fill();
      if (duty > 0) {
        roundRectPath(ctx, -22, -10, Math.max(4, (44 * duty) / 255), 9, 4);
        ctx.fillStyle = outOn ? th.sig1 : th.subText;
        ctx.fill();
      }
      ctx.fillStyle = outOn ? th.sig1 : th.compText;
      ctx.font = '800 10px monospace';
      ctx.fillText(`${pct}%`, 0, 12);
      break;
    }

    case 'RING_CNT': {
      const q = Number(toUintN(pv.q, 8));
      const jhn = bit(pv.jhn) === 1;
      ctx.fillStyle = th.compText;
      ctx.font = '800 9.5px monospace';
      ctx.fillText(jhn ? 'JOHNSON' : 'RING 8b', 0, -comp.h / 2 + 13);
      for (let i = 0; i < 8; i++) {
        const bitOn = ((q >> (7 - i)) & 1) === 1;
        const bx = -21 + (i % 4) * 14;
        const by = i < 4 ? -8 : 8;
        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, Math.PI * 2);
        ctx.fillStyle = bitOn ? th.sig1 : 'rgba(100,116,139,0.22)';
        ctx.fill();
      }
      break;
    }

    case 'CRC8_GEN': {
      const crc = Number(toUintN(pv.crc, 8));
      ctx.fillStyle = th.compText;
      ctx.font = '800 10px monospace';
      ctx.fillText('CRC-8', 0, -comp.h / 2 + 13);
      ctx.fillStyle = th.sig1;
      ctx.font = '800 14px monospace';
      ctx.fillText(`0x${crc.toString(16).toUpperCase().padStart(2, '0')}`, 0, 4);
      break;
    }

    case 'UART_TX': {
      const busy = bit(pv.busy) === 1;
      const d = Number(toUintN(pv.data, 8));
      ctx.fillStyle = th.compText;
      ctx.font = '800 10px monospace';
      ctx.fillText('UART TX', 0, -comp.h / 2 + 13);
      ctx.fillStyle = busy ? th.warn : th.sig1;
      ctx.font = '800 9px monospace';
      ctx.fillText(busy ? 'SENDING' : 'IDLE', 0, -6);
      ctx.fillStyle = th.compText;
      ctx.font = '800 11px monospace';
      ctx.fillText(`0x${d.toString(16).toUpperCase().padStart(2, '0')}`, 0, 12);
      break;
    }

    case 'UART_RX': {
      const val = bit(pv.valid) === 1;
      const err = bit(pv.err) === 1;
      const d = Number(toUintN(pv.data, 8));
      const ch = d >= 32 && d <= 126 ? ` '${String.fromCharCode(d)}'` : '';
      ctx.fillStyle = th.compText;
      ctx.font = '800 10px monospace';
      ctx.fillText('UART RX', 0, -comp.h / 2 + 13);
      ctx.fillStyle = err ? th.sigErr : val ? th.sig1 : th.subText;
      ctx.font = '800 8.5px monospace';
      ctx.fillText(err ? 'FRAME ERR' : val ? 'VALID' : 'WAIT', 0, -6);
      ctx.fillStyle = th.sig1;
      ctx.font = '800 10.5px monospace';
      ctx.fillText(`0x${d.toString(16).toUpperCase().padStart(2, '0')}${ch}`, 0, 12);
      break;
    }

    case 'SPLITTER':
    case 'MERGER': {
      const chunks = getSplitterChunks(comp);
      ctx.fillStyle = th.compText;
      ctx.font = '800 9.5px monospace';
      ctx.fillText(comp.type === 'SPLITTER' ? `SPLIT ${b}b` : `MERGE ${b}b`, 0, -comp.h / 2 + 11);
      ctx.fillStyle = th.subText;
      ctx.font = '700 8px monospace';
      ctx.fillText(chunks.join(':'), 0, comp.h / 2 - 10);
      break;
    }

    case 'FSM': {
      const f = st.fsm || { n: 1, next0: [0], next1: [0], out: [0] };
      const cur = (st.fsmState || 0) % f.n;
      const R = 38;
      const r = 10;
      const pos = (i: number) => ({
        x: Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / f.n) * R,
        y: Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / f.n) * R + 2
      });
      const arrow = (i: number, j: number, color: string, off: number) => {
        const a = pos(i);
        const bp = pos(j);
        if (i === j) {
          const ang = Math.atan2(a.y - 2, a.x);
          const ox = a.x + Math.cos(ang) * (r + 4);
          const oy = a.y + Math.sin(ang) * (r + 4);
          ctx.beginPath();
          ctx.arc(ox + off * Math.sin(ang), oy - off * Math.cos(ang), 4.5, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.1;
          ctx.stroke();
          return;
        }
        const dx = bp.x - a.x;
        const dy = bp.y - a.y;
        const d = Math.hypot(dx, dy);
        const ux = dx / d;
        const uy = dy / d;
        const nx = -uy;
        const ny = ux;
        const sx = a.x + ux * r + nx * off;
        const sy = a.y + uy * r + ny * off;
        const ex = bp.x - ux * (r + 1) + nx * off;
        const ey = bp.y - uy * (r + 1) + ny * off;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.1;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - ux * 5 + nx * 2.8, ey - uy * 5 + ny * 2.8);
        ctx.lineTo(ex - ux * 5 - nx * 2.8, ey - uy * 5 - ny * 2.8);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      };
      for (let i = 0; i < f.n; i++) {
        arrow(i, f.next0[i] % f.n, 'rgba(148,163,184,0.55)', -2.5);
        arrow(i, f.next1[i] % f.n, th.sig1, 2.5);
      }
      for (let i = 0; i < f.n; i++) {
        const p = pos(i);
        const on = i === cur;
        ctx.save();
        if (on) {
          ctx.shadowColor = th.sig1;
          ctx.shadowBlur = 12;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = on ? th.sig1 : th.compFill;
        ctx.fill();
        ctx.strokeStyle = f.out[i] ? th.warn : th.compStroke;
        ctx.lineWidth = f.out[i] ? 2.4 : 1.4;
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = on ? th.compFill : th.compText;
        ctx.font = '800 9px monospace';
        ctx.fillText(`S${i}`, p.x, p.y + 0.5);
      }
      ctx.fillStyle = th.subText;
      ctx.font = '700 9px monospace';
      ctx.fillText(`S${cur} · Z=${f.out[cur] ? 1 : 0}`, 0, comp.h / 2 - 9);
      break;
    }

    case 'BUZZER': {
      const on = pv.in0 === 1;
      ctx.fillStyle = on ? th.warn : th.subText;
      ctx.font = '800 12px monospace';
      ctx.fillText(on ? '♪ ON' : 'BUZ', 4, 0);
      break;
    }

    case 'TONE_GEN': {
      const on = bit(pv.gate) === 1;
      const hz = Number(toUintN(pv.freq, 12));
      const wNames = ['SQR', 'SAW', 'TRI', 'SIN'];
      const wIdx = Number(toUintN(pv.wave, 2)) & 3;
      ctx.fillStyle = on ? th.warn : th.compText;
      ctx.font = '800 11px monospace';
      ctx.fillText(on ? `♪ ${hz}Hz` : `${hz} Hz`, 12, -8);
      ctx.fillStyle = on ? th.sig1 : th.subText;
      ctx.font = '800 9px monospace';
      ctx.fillText(wNames[wIdx], 12, 11);
      break;
    }

    case 'BUS_SLICE': {
      const hi = comp.sliceHi ?? Math.min(b - 1, 7);
      const lo = comp.sliceLo ?? 0;
      ctx.fillStyle = th.compText;
      ctx.font = '800 10px monospace';
      ctx.fillText('SLICE', 0, -10);
      ctx.fillStyle = th.sig1;
      ctx.font = '800 10.5px monospace';
      ctx.fillText(`[${hi}:${lo}]`, 0, 9);
      break;
    }

    case 'ROTARY_ENC': {
      const pos = Number(st.encPos ?? 0) & 255;
      const ang = ((pos % 16) * Math.PI) / 8 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(-8, -4, 17, 0, Math.PI * 2);
      ctx.fillStyle = th.pinFill;
      ctx.fill();
      ctx.strokeStyle = th.sig1;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 + Math.cos(ang) * 13, -4 + Math.sin(ang) * 13);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.fillStyle = th.subText;
      ctx.font = '800 9px monospace';
      ctx.fillText('−', -33, -4);
      ctx.fillText('+', 15, -4);
      ctx.fillStyle = th.sig1;
      ctx.font = '800 9px monospace';
      ctx.fillText(`0x${pos.toString(16).toUpperCase().padStart(2, '0')}`, -8, comp.h / 2 - 10);
      break;
    }

    case 'SLIDER_ADC': {
      const maxV = (1n << BigInt(b)) - 1n;
      const curV = toUintN(BigInt((st.adcVal as number | bigint | undefined) ?? 0), b);
      const frac = maxV > 0n ? Number((curV * 1000n) / maxV) / 1000 : 0;
      const tx0 = -44;
      const tx1 = 36;
      const tw = tx1 - tx0;
      const thumbX = tx0 + frac * tw;
      ctx.fillStyle = th.subText;
      ctx.font = '800 8.5px monospace';
      ctx.fillText(`ADC ${b}b`, -4, -comp.h / 2 + 12);
      roundRectPath(ctx, tx0, -2, tw, 6, 3);
      ctx.fillStyle = th.pinFill;
      ctx.fill();
      roundRectPath(ctx, tx0, -2, Math.max(4, thumbX - tx0), 6, 3);
      ctx.fillStyle = th.sig1;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(thumbX, 1, 7, 0, Math.PI * 2);
      ctx.fillStyle = th.compText;
      ctx.fill();
      ctx.strokeStyle = th.sig1;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = th.sig1;
      ctx.font = '800 9.5px monospace';
      ctx.fillText(`${Math.round(frac * 100)}% (${formatSignalCompact(curV, b)})`, -4, comp.h / 2 - 10);
      break;
    }

    case 'VU_METER_N': {
      const maxV = (1n << BigInt(b)) - 1n;
      const curV = toUintN(pv.in0 ?? 0n, b);
      const frac = maxV > 0n ? Number((curV * 1000n) / maxV) / 1000 : 0;
      const lit = Math.round(frac * 8);
      ctx.fillStyle = th.subText;
      ctx.font = '800 8.5px monospace';
      ctx.fillText(`VU ${b}b`, 6, -comp.h / 2 + 11);
      for (let i = 0; i < 8; i++) {
        const y = comp.h / 2 - 20 - i * 11;
        const on = i < lit;
        const barCol = i >= 6 ? '#f43f5e' : i >= 4 ? '#f59e0b' : '#10b981';
        roundRectPath(ctx, -10, y, 32, 8, 2);
        ctx.fillStyle = on ? barCol : th.pinFill;
        ctx.fill();
        if (on && !lowDetail) {
          ctx.strokeStyle = barCol;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
      break;
    }

    case 'TEXT_CONSOLE': {
      const lines = st.textLines || [];
      const bw = comp.w - 46;
      const bh = comp.h - 24;
      roundRectPath(ctx, -bw / 2 + 6, -bh / 2, bw, bh, 6);
      ctx.fillStyle = '#030811';
      ctx.fill();
      ctx.strokeStyle = th.sig1;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '700 9px monospace';
      const showLines = lines.slice(-7);
      for (let i = 0; i < 7; i++) {
        const txt = showLines[i] ?? '';
        const isLast = i === Math.max(0, showLines.length - 1);
        ctx.fillStyle = i === showLines.length - 1 ? '#6ee7b7' : '#34d399';
        ctx.fillText((txt + (isLast ? '_' : '')).slice(0, 24), -bw / 2 + 12, -bh / 2 + 10 + i * 14);
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = th.subText;
      ctx.font = '700 8px monospace';
      ctx.fillText(`CONSOLA SERIAL · ${lines.length}L`, 6, -comp.h / 2 + 6);
      break;
    }

    case 'ANIM32_GPU': {
      const scnIdx = Number(toUintN(pv.scn ?? (st.animScene ?? 0), 5)) % 32;
      const meta = FUNNY_SCENES_32[scnIdx];
      const frame = (st.animStep ?? 0) & 7;
      const cx = -2;
      ctx.fillStyle = th.compText;
      ctx.font = '800 10.5px monospace';
      ctx.fillText('ANIM32 GPU', cx, -comp.h / 2 + 18);
      roundRectPath(ctx, cx - 42, -50, 84, 26, 5);
      ctx.fillStyle = '#091426';
      ctx.fill();
      ctx.strokeStyle = th.sig1;
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.fillStyle = th.sig1;
      ctx.font = '800 12px monospace';
      ctx.fillText(`ESC ${String(scnIdx + 1).padStart(2, '0')}/32`, cx, -37);
      const rawTitle = (meta?.title || '').trim();
      const words = rawTitle.split(/\s+/);
      let line1 = '';
      let line2 = '';
      for (const w of words) {
        if ((line1 + ' ' + w).trim().length <= 14) line1 = (line1 + ' ' + w).trim();
        else if ((line2 + ' ' + w).trim().length <= 14) line2 = (line2 + ' ' + w).trim();
      }
      if (!line1) line1 = rawTitle.slice(0, 14);
      ctx.fillStyle = th.warn;
      ctx.font = '700 8.5px monospace';
      ctx.fillText(line1, cx, line2 ? -8 : -2, 86);
      if (line2) ctx.fillText(line2, cx, 4, 86);
      ctx.fillStyle = th.subText;
      ctx.font = '700 8px monospace';
      ctx.fillText(`SUBFRAME ${frame + 1}/8`, cx, 22);
      // 32-scene progress bar
      roundRectPath(ctx, cx - 40, 36, 80, 7, 3);
      ctx.fillStyle = th.pinFill;
      ctx.fill();
      roundRectPath(ctx, cx - 40, 36, Math.max(4, ((scnIdx + 1) / 32) * 80), 7, 3);
      ctx.fillStyle = th.sig1;
      ctx.fill();
      break;
    }

    case 'CROSSBAR_2X2': {
      const sw = bit(pv.swap) === 1;
      ctx.fillStyle = th.compText;
      ctx.font = '800 9px monospace';
      ctx.fillText('XBAR 2×2', 0, -comp.h / 2 + 12);
      ctx.strokeStyle = sw ? th.warn : th.sig1;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (sw) {
        ctx.moveTo(-18, -10);
        ctx.lineTo(18, 12);
        ctx.moveTo(-18, 12);
        ctx.lineTo(18, -10);
      } else {
        ctx.moveTo(-18, -10);
        ctx.lineTo(18, -10);
        ctx.moveTo(-18, 12);
        ctx.lineTo(18, 12);
      }
      ctx.stroke();
      ctx.fillStyle = sw ? th.warn : th.subText;
      ctx.font = '800 8px monospace';
      ctx.fillText(sw ? 'SWAP' : 'DIRECT', 0, comp.h / 2 - 10);
      break;
    }

    case 'PRIORITY_ARB': {
      const valid = bit(pv.valid) === 1;
      const win = Number(toUintN(pv.idx, 2));
      ctx.fillStyle = th.compText;
      ctx.font = '800 9.5px monospace';
      ctx.fillText('ARB 4:1', 0, -comp.h / 2 + 12);
      ctx.fillStyle = valid ? th.sig1 : th.subText;
      ctx.font = '800 12px monospace';
      ctx.fillText(valid ? `WIN G${win}` : 'IDLE', 0, 2);
      break;
    }

    case 'BUS_PACK4':
    case 'BUS_UNPACK4': {
      ctx.fillStyle = th.compText;
      ctx.font = '800 9.5px monospace';
      ctx.fillText(comp.type === 'BUS_PACK4' ? 'PACK 4×' : 'UNPACK', 0, -10);
      ctx.fillStyle = th.sig1;
      ctx.font = '800 10px monospace';
      ctx.fillText(`${b}b ↔ ${Math.min(64, b * 4)}b`, 0, 9);
      break;
    }

    case 'SAT_ADDER_N': {
      const sat = bit(pv.sat) === 1;
      ctx.fillStyle = th.compText;
      ctx.font = '800 13px monospace';
      ctx.fillText('+SAT', 0, -6);
      ctx.fillStyle = sat ? th.warn : th.subText;
      ctx.font = '800 8.5px monospace';
      ctx.fillText(sat ? 'CLAMP!' : `${b}b`, 0, 12);
      break;
    }

    case 'SQRT_N': {
      const r = formatSignalCompact(pv.root ?? 0n, b);
      ctx.fillStyle = th.compText;
      ctx.font = '800 14px monospace';
      ctx.fillText(`√${b}b`, 0, -8);
      ctx.fillStyle = th.sig1;
      ctx.font = '800 9.5px monospace';
      ctx.fillText(`=${r.length > 7 ? r.slice(0, 6) + '…' : r}`, 0, 12);
      break;
    }

    case 'COMP_WIN_N': {
      const inw = bit(pv.inw) === 1;
      const below = bit(pv.below) === 1;
      ctx.fillStyle = th.compText;
      ctx.font = '800 9px monospace';
      ctx.fillText('[LO..HI]', 0, -14);
      ctx.fillStyle = inw ? th.sig1 : th.warn;
      ctx.font = '800 10px monospace';
      ctx.fillText(inw ? 'DENTRO' : below ? '< LO' : '> HI', 0, 4);
      break;
    }

    case 'MOD_COUNTER_N': {
      const qv = formatSignalCompact(pv.q ?? 0n, b);
      const wrp = bit(pv.wrap) === 1;
      const mVal = comp.modBase ?? 10;
      ctx.fillStyle = th.compText;
      ctx.font = '800 9.5px monospace';
      ctx.fillText(`MOD-${mVal}`, 0, -16);
      ctx.fillStyle = wrp ? th.warn : th.sig1;
      ctx.font = '800 11px monospace';
      ctx.fillText(qv, 0, 4);
      break;
    }

    case 'WATCHDOG_N': {
      const bark = bit(pv.bark) === 1;
      const cnt = formatSignalCompact(pv.cnt ?? 0n, b);
      ctx.fillStyle = bark ? th.sigErr : th.compText;
      ctx.font = '800 9.5px monospace';
      ctx.fillText(bark ? 'BARK!' : 'WDOG', 0, -14);
      ctx.fillStyle = bark ? th.sigErr : th.sig1;
      ctx.font = '800 10px monospace';
      ctx.fillText(`T=${cnt}`, 0, 8);
      break;
    }

    case 'DEBOUNCER': {
      const cln = bit(pv.out) === 1;
      ctx.fillStyle = th.compText;
      ctx.font = '800 9px monospace';
      ctx.fillText('DEBOUNCE', 0, -9);
      ctx.fillStyle = cln ? th.sig1 : th.subText;
      ctx.font = '800 9px monospace';
      ctx.fillText(cln ? 'ESTABLE=1' : 'ESTABLE=0', 0, 9);
      break;
    }

    case 'STOPWATCH_N': {
      const running = bit(pv.run) === 1;
      const t = formatSignalCompact(pv.q ?? 0n, b);
      ctx.fillStyle = running ? th.sig1 : th.subText;
      ctx.font = '800 9px monospace';
      ctx.fillText(running ? '● RUN' : '❚❚ PAUSE', 0, -14);
      ctx.fillStyle = th.compText;
      ctx.font = '800 11px monospace';
      ctx.fillText(t, 0, 8);
      break;
    }

    case 'CRC16_GEN': {
      const crc = Number(toUintN(pv.crc ?? 0n, 16));
      const ok = bit(pv.ok) === 1;
      ctx.fillStyle = th.compText;
      ctx.font = '800 9.5px monospace';
      ctx.fillText('CRC-16', 0, -15);
      ctx.fillStyle = ok ? th.sig1 : th.warn;
      ctx.font = '800 10.5px monospace';
      ctx.fillText(`0x${crc.toString(16).toUpperCase().padStart(4, '0')}`, 0, 4);
      break;
    }

    case 'AND':
    case 'NAND':
    case 'OR':
    case 'NOR':
    case 'XOR':
    case 'XNOR':
    case 'NOT':
    case 'BUFFER':
    case 'TRI_BUFFER':
    case 'MUX_2':
    case 'MUX_4':
    case 'MUX_8':
    case 'MUX_16':
    case 'MUX_32':
    case 'DEMUX_2':
    case 'DEMUX_4':
    case 'DEMUX_8':
    case 'DEMUX_16':
    case 'DEMUX_32':
      drawLogicSymbol(ctx, comp, th, pv);
      break;

    default: {
      const SYM: Record<string, [string, string]> = {
        MAJ3: ['≥2', b > 1 ? `${b}b` : 'MAJ'],
        HALF_ADDER: ['Σ', 'HA'],
        FULL_ADDER: ['Σ', 'FA'],
        ADDER_4: ['Σ', 'ADD4'],
        ADDER_N: ['+', `${b}b`],
        SUB_N: ['−', `${b}b`],
        MULT_2X2: ['×', '2×2'],
        MULT_N: ['×', `${b}b`],
        DIV_N: ['÷', `${b}b`],
        SHIFTER_N: ['«»', `${b}b`],
        INC_DEC_N: ['±N', `${b}b`],
        ABS_NEG_N: ['|A|', `${b}b`],
        MIN_MAX_N: ['≶', `${b}b`],
        POPCOUNT_N: ['Σ1', `${b}b`],
        BIN2BCD_N: ['B>10', 'BCD'],
        COMP_2: ['=', 'CMP2'],
        COMP_4: ['=', 'CMP4'],
        COMP_N: ['=', `${b}b`],
        BCD_7SEG: ['8.', 'BCD→7'],
        DEC_2TO4: ['2→4', 'DEC'],
        DEC_3TO8: ['3→8', 'DEC'],
        DEC_4TO16: ['4→16', 'DEC'],
        DEC_5TO32: ['5→32', 'DEC'],
        ENC_4TO2: ['4→2', 'ENC'],
        ENC_8TO3: ['8→3', 'ENC'],
        ENC_16TO4: ['16→4', 'ENC'],
        ENC_32TO5: ['32→5', 'ENC'],
        PARITY_4: ['⊕', 'PAR4'],
        PARITY_N: ['⊕', `${b}b`],
        BIN2GRAY_4: ['B→G', '4b'],
        GRAY2BIN_4: ['G→B', '4b'],
        BIN2GRAY_N: ['B→G', `${b}b`],
        GRAY2BIN_N: ['G→B', `${b}b`],
        LUT_TRIG: ['sin/cos', 'LUT'],
        BIT_EXTEND: [comp.signedMode ? 'SEXT' : 'ZEXT', `${b}b`],
        EDGE_DET: ['⎊', 'EDGE'],
        PULSE_ONE: ['⎍', '1-PLS'],
        SR_LATCH: ['SR', ''],
        LATCH_D: ['D', 'LAT'],
        D_FF: ['D', 'FF'],
        RS_FF: ['RS', 'FF'],
        JK_FF: ['JK', 'FF'],
        T_FF: ['T', 'FF'],
        REG_4: ['REG', '4b'],
        REG_N: ['REG', `${b}b`],
        COUNTER_4: ['CTR', '4b'],
        COUNTER_N: ['CTR', `${b}b`],
        UDCOUNTER_4: ['U/D', '±1'],
        COUNTER_BCD: ['BCD', '÷10'],
        SHIFT_REG_4: ['SHR', '→'],
        SHIFT_REG_N: ['SHR', `${b}b`],
        FREQ_DIV: ['÷N', 'DIV'],
        TIMER_N: ['TMR', `${b}b`],
        LFSR_4: ['LFSR', '4b'],
        LFSR_N: ['LFSR', `${b}b`],
        STACK_LIFO: ['LIFO', `${b}b`],
        PROBE: ['CH', b > 1 ? `${b}b` : '']
      };
      const sym = SYM[comp.type];
      ctx.fillStyle = comp.type === 'CUSTOM_IC' ? th.sig1 : th.compText;
      if (sym) {
        ctx.font = '800 18px monospace';
        ctx.fillText(sym[0], 0, sym[1] ? -6 : 0);
        if (sym[1]) {
          ctx.fillStyle = th.subText;
          ctx.font = '800 9px monospace';
          ctx.fillText(sym[1], 0, 12);
        }
        // Live numeric readout on N-bit sequential chips
        if (['REG_N', 'COUNTER_N', 'SHIFT_REG_N', 'TIMER_N', 'LFSR_N', 'STACK_LIFO'].includes(comp.type)) {
          const val = formatSignalCompact(pv.q ?? 0n, b);
          ctx.fillStyle = th.sig1;
          ctx.font = '800 10px monospace';
          ctx.fillText(val.length > 9 ? `…${val.slice(-7)}` : val, 0, comp.h / 2 - 12);
        }
      } else {
        ctx.font = '800 11.5px monospace';
        ctx.fillText(comp.type === 'CUSTOM_IC' ? comp.label || 'IC' : comp.type, 0, 0);
      }
      break;
    }
  }

  // Etiquetas internas de pines (omitidas al hacer zoom lejano o en Modo Eco lejano para ahorrar renderizado)
  if (LABELED_PINS_TYPES.has(comp.type) && !(zoom < 0.52 || (lowDetail && zoom < 0.72))) {
    ctx.font = '700 8px monospace';
    ctx.fillStyle = th.subText;
    for (const p of comp.pins) {
      if (!p.label) continue;
      if (p.id === 'clk' && p.lx < -comp.w / 2 + 4) {
        ctx.beginPath();
        ctx.moveTo(p.lx, p.ly - 5);
        ctx.lineTo(p.lx + 8, p.ly);
        ctx.lineTo(p.lx, p.ly + 5);
        ctx.strokeStyle = th.sig1;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      if (p.id === 'qn') {
        ctx.beginPath();
        ctx.arc(p.lx - 4.5, p.ly, 3, 0, Math.PI * 2);
        ctx.strokeStyle = th.compText;
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }
      if (p.lx < -comp.w / 2 + 4) {
        ctx.textAlign = 'left';
        ctx.fillText(p.label, p.lx + (p.id === 'clk' ? 12 : 7), p.ly);
      } else if (p.lx > comp.w / 2 - 4) {
        ctx.textAlign = 'right';
        ctx.fillText(p.label, p.lx - 7, p.ly);
      } else if (p.ly > comp.h / 2 - 4) {
        ctx.textAlign = 'center';
        ctx.fillText(p.label, p.lx, p.ly - 8);
      }
    }
  }

  // Etiqueta superior personalizada
  if (comp.label && comp.type !== 'CUSTOM_IC' && zoom >= 0.4) {
    ctx.fillStyle = th.subText;
    ctx.font = '700 10.5px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(comp.label, 0, -comp.h / 2 - 9);
  }

  // Indicador de sonda activa
  if (comp.probe) {
    ctx.fillStyle = th.sig1;
    ctx.beginPath();
    ctx.arc(comp.w / 2 - 6, -comp.h / 2 + 6, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dibujar pines (cuadrado redondeado para buses > 1b, círculo para 1b)
  for (const p of comp.pins) {
    const sig = pv[p.id];
    const pw = p.width || 1;
    const isSnap = snapPin && snapPin.comp.id === comp.id && snapPin.pinId === p.id;
    const isHover = hoveredPin && hoveredPin.comp.id === comp.id && hoveredPin.pinId === p.id;
    const col = getSignalColor(theme, sig);
    const active = isSignalNonZero(sig) || sig === 'Z' || sig === 'ERR';

    if (pw > 1) {
      const sz = isSnap || isHover ? 10 : 8;
      roundRectPath(ctx, p.lx - sz / 2, p.ly - sz / 2, sz, sz, 2.2);
      ctx.fillStyle = active ? col : th.pinFill;
      ctx.fill();
      ctx.strokeStyle = isSnap || isHover ? '#ffffff' : th.pinStroke;
      ctx.lineWidth = isSnap || isHover ? 2 : 1.4;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(p.lx, p.ly, isSnap || isHover ? 5.8 : 4.2, 0, Math.PI * 2);
      ctx.fillStyle = active ? col : th.pinFill;
      ctx.fill();
      ctx.strokeStyle = isSnap || isHover ? '#ffffff' : th.pinStroke;
      ctx.lineWidth = isSnap || isHover ? 2 : 1.4;
      ctx.stroke();
    }
  }

  if (oriented && origFillText) {
    delete (ctx as unknown as { fillText?: unknown }).fillText;
  }
  ctx.restore();
}

export function drawPinTooltip(ctx: CanvasRenderingContext2D, st: RenderStateView): void {
  const th = CANVAS_THEMES[st.theme];
  const target = st.snapPin || st.hoveredPin;
  let text = '';
  let col = th.sig1;
  let ax = st.mouseWorld.x;
  let ay = st.mouseWorld.y;

  if (target) {
    const sig = target.comp.pinValues[target.pinId] ?? 0;
    col = getSignalColor(st.theme, sig);
    const pw = target.width || 1;
    const valStr = pw > 1 ? `${formatSignalHex(sig, pw)} (${pw}b)` : String(sig);
    text = `${target.label || target.pinId}: ${valStr}`;
    if (st.mode === 'WIRING' && st.wiringFrom && st.snapPin && st.snapPin.comp.id !== st.wiringFrom.compId) {
      const srcComp = st.components.find(c => c.id === st.wiringFrom!.compId);
      const srcPin = srcComp?.pins.find(p => p.id === st.wiringFrom!.pinId);
      const w1 = srcPin?.width || 1;
      if (w1 !== pw) {
        col = th.warn;
        text = `⚠ Ancho ${w1}b ≠ ${pw}b · ${target.label || target.pinId}`;
      }
    }
    ax = target.x;
    ay = target.y;
  } else if (st.hoveredWire && st.mode === 'IDLE') {
    const w = st.hoveredWire;
    const pw = w.width || 1;
    const sig = w.signal ?? 0;
    col = getSignalColor(st.theme, sig, w.unstable);
    if (pw > 1 && typeof sig === 'bigint') {
      text = `Bus ${pw}b: ${formatSignalHex(sig, pw)} (DEC: ${sig.toString()})`;
    } else if (pw > 1) {
      text = `Bus ${pw}b: ${formatSignalHex(sig, pw)}`;
    } else {
      text = `Cable: ${sig}`;
    }
  } else {
    return;
  }

  ctx.save();
  const z = st.view.zoom;
  const fs = Math.max(10, 11 / z);
  ctx.font = `700 ${fs}px monospace`;
  const padX = 7 / z;
  const boxH = 19 / z;
  const boxW = ctx.measureText(text).width + padX * 2;
  const bx = ax - boxW / 2;
  const by = ay - boxH - 10 / z;

  roundRectPath(ctx, bx, by, boxW, boxH, 5 / z);
  ctx.fillStyle = th.compFill;
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.4 / z;
  ctx.stroke();

  ctx.fillStyle = th.compText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + boxW / 2, by + boxH / 2);
  ctx.restore();
}

// Precomputed RGB332 -> little-endian ABGR 32-bit table for instant ImageData blits
const RGB332_ABGR = (() => {
  const lut = new Uint32Array(256);
  for (let c = 0; c < 256; c++) {
    const r = ((c >> 5) & 7) * 36;
    const g = ((c >> 2) & 7) * 36;
    const b = (c & 3) * 85;
    lut[c] = (255 << 24) | (b << 16) | (g << 8) | r;
  }
  return lut;
})();

export function drawComponentGroups(ctx: CanvasRenderingContext2D, st: RenderStateView): void {
  const groups = new Map<
    string,
    { id: string; name: string; colorKey: string; minX: number; minY: number; maxX: number; maxY: number; count: number; allSelected: boolean }
  >();
  for (const c of st.components) {
    if (!c.groupId) continue;
    const odd = (c.rot || 0) % 2 === 1;
    const hw = (odd ? c.h : c.w) / 2;
    const hh = (odd ? c.w : c.h) / 2;
    const g = groups.get(c.groupId);
    const isSel = st.selectedIds.has(c.id);
    if (!g) {
      groups.set(c.groupId, {
        id: c.groupId,
        name: c.groupName || 'Grupo',
        colorKey: c.groupColor || 'cyan',
        minX: c.x - hw,
        minY: c.y - hh,
        maxX: c.x + hw,
        maxY: c.y + hh,
        count: 1,
        allSelected: isSel
      });
    } else {
      g.minX = Math.min(g.minX, c.x - hw);
      g.minY = Math.min(g.minY, c.y - hh);
      g.maxX = Math.max(g.maxX, c.x + hw);
      g.maxY = Math.max(g.maxY, c.y + hh);
      g.count++;
      if (!isSel) g.allSelected = false;
    }
  }
  if (groups.size === 0) return;

  for (const g of groups.values()) {
    const hex = (LED_PALETTE[g.colorKey]?.hex) || (g.colorKey.startsWith('#') ? g.colorKey : '#00f5d4');
    const padX = 24;
    const padTop = 30;
    const padBot = 20;
    const rx = g.minX - padX;
    const ry = g.minY - padTop;
    const rw = g.maxX - g.minX + padX * 2;
    const rh = g.maxY - g.minY + padTop + padBot;

    ctx.save();
    roundRectPath(ctx, rx, ry, rw, rh, 14);
    ctx.fillStyle = hex;
    ctx.globalAlpha = g.allSelected ? 0.11 : 0.06;
    ctx.fill();

    ctx.globalAlpha = g.allSelected ? 0.85 : 0.48;
    ctx.strokeStyle = hex;
    ctx.lineWidth = g.allSelected ? 2 : 1.3;
    ctx.setLineDash([7, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (st.view.zoom >= 0.35) {
      const lbl = `${g.name} (${g.count})`;
      ctx.font = '800 10.5px system-ui, sans-serif';
      const bw = Math.max(54, ctx.measureText(lbl).width + 16);
      roundRectPath(ctx, rx + 8, ry - 11, bw, 20, 7);
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = CANVAS_THEMES[st.theme].compFill;
      ctx.fill();
      ctx.strokeStyle = hex;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = hex;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lbl, rx + 8 + bw / 2, ry - 1);
    }
    ctx.restore();
  }
}
