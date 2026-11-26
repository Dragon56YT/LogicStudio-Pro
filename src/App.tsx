import { useEffect } from 'react';
import { initLogicStudio } from './ui/studioController';

export default function App() {
  useEffect(() => {
    return initLogicStudio();
  }, []);

  return (
    <>
      {/* BARRA SUPERIOR DE HERRAMIENTAS */}
      <header className="topbar">
        <div className="topbar-group">
          <div className="brand-box">
            <div className="brand-logo" title="LogicStudio Pro Beta 0.3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h6a6 6 0 0 1 0 12H4z" />
                <path d="M2 9h2M2 15h2M16 12h6" />
              </svg>
            </div>
            <div className="brand-title-wrap">
              <div className="brand-title-row">
                <span className="brand-name">LogicStudio</span>
                <span className="beta-badge">0.3</span>
              </div>
              <span className="brand-credit">A. Arbós • 1–64b</span>
            </div>
          </div>

          <div className="divider-v" />

          <select id="preset-selector" className="select-control" style={{ maxWidth: 136 }} aria-label="Cargar circuito de ejemplo precargado" title="Cargar circuito de ejemplo precargado">
            <option value="demo">1. Demo Bienvenida + LED RGB</option>
          </select>
        </div>

        {/* Controles de Simulación y Visualización */}
        <div className="topbar-group">
          <button id="btn-sim-toggle" className="btn btn-accent" title="Iniciar o Pausar simulación (Espacio)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
            <span id="sim-toggle-label">Simulando</span>
          </button>

          <button id="btn-sim-step" className="btn btn-icon" aria-label="Avanzar un paso" title="Avanzar un ciclo de reloj manualmente">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </button>

          <div className="clock-pill" title="Frecuencia global del reloj del sistema">
            <input id="global-clock-hz" type="range" min="0.5" max="15" step="0.5" defaultValue="2" aria-label="Frecuencia de reloj" />
            <span id="global-clock-label" className="mono" style={{ fontWeight: 700, minWidth: 33 }}>2.0Hz</span>
          </div>

          <select id="clock-mult-selector" className="select-control mono" style={{ width: 52 }} defaultValue="1" aria-label="Multiplicador de ciclos de reloj" title="Multiplicador de ciclos de simulación (TURBO para VGA / DOOM 3D)">
            <option value="1">×1</option>
            <option value="10">×10</option>
            <option value="100">×100</option>
            <option value="3000">TURBO</option>
          </select>

          <button id="btn-wire-style" className="btn" title="Alternar trazado de cables (Curvas Bézier / Ortogonal 90°)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 18 C 12 18, 12 6, 20 6" />
            </svg>
            <span id="wire-style-label">Bézier</span>
          </button>

          <button id="btn-wire-vis" className="btn" title="Alternar visibilidad de cables (Todos / Atenuar inactivos / Solo selección)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span id="wire-vis-label">Todos</span>
          </button>

          <button id="btn-probe-mode" className="btn btn-icon" aria-label="Modo Sonda Lógica" title="Activar/Desactivar Sonda Lógica Flotante (Tecla P)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </button>

          <select id="theme-selector" className="select-control" style={{ maxWidth: 82 }} defaultValue="cyber" aria-label="Tema visual del estudio" title="Cambiar tema visual del estudio">
            <option value="cyber">Cyber Dark</option>
            <option value="blueprint">Blueprint</option>
            <option value="clean">Clean Lab</option>
          </select>

          <button id="btn-sound-toggle" className="btn btn-icon btn-active" aria-label="Activar o silenciar sonido" title="Activar/Silenciar efectos de sonido WebAudio">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          </button>
        </div>

        {/* Herramientas Avanzadas y Archivo */}
        <div className="topbar-group">
          <button id="btn-bool-synth" className="btn" style={{ padding: '0 6px' }} aria-label="Sintetizador Booleano" title="Sintetizador Booleano: convierte expresiones en circuitos">
            <span className="mono" style={{ fontWeight: 800, color: 'var(--accent)' }}>ƒ(x)</span>
          </button>

          <button id="btn-custom-ic" className="btn btn-icon" aria-label="Crear Chip IC" title="Empaquetar el circuito actual como un Chip Integrado (IC)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <rect x="9" y="9" width="6" height="6" />
              <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
            </svg>
          </button>

          <button id="btn-truth-table" className="btn btn-icon" aria-label="Tabla de Verdad" title="Generar Tabla de Verdad completa automáticamente">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
            </svg>
          </button>

          <button id="btn-toggle-analyzer" className="btn btn-active" title="Mostrar/Ocultar Analizador Lógico">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 17 9 17 9 7 15 7 15 17 21 17" />
            </svg>
            <span>Onda</span>
          </button>

          <div className="divider-v" />

          <button id="btn-undo" className="btn btn-icon" aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
            </svg>
          </button>

          <button id="btn-redo" className="btn btn-icon" aria-label="Rehacer" title="Rehacer (Ctrl+Y)" disabled>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 7v6h-6" />
              <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
            </svg>
          </button>

          <button id="btn-cmd-palette" className="btn" style={{ padding: '0 5px' }} title="Paleta rápida de comandos (Ctrl+K)">
            <span className="mono">⌘K</span>
          </button>

          <button id="btn-save-json" className="btn btn-icon" aria-label="Descargar JSON" title="Descargar circuito en JSON">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

          <button id="btn-load-json" className="btn btn-icon" aria-label="Abrir JSON" title="Abrir archivo de circuito JSON">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </button>
          <input id="file-json-input" type="file" accept=".json" className="hidden" />

          <button id="btn-export-png" className="btn btn-icon" aria-label="Exportar PNG" title="Exportar captura de imagen PNG">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>

          <button id="btn-clear-canvas" className="btn btn-icon btn-danger" aria-label="Limpiar lienzo" title="Limpiar todo el lienzo">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>

          <button id="btn-script" className="btn" title="LogicScript: construye circuitos de hasta 64 bits con código o IA">&lt;/&gt; Script</button>
          <button id="btn-challenges" className="btn" title="Modo ejercicios: retos con validación automática">🎯 Retos</button>
          <button id="btn-settings" className="btn btn-icon" aria-label="Ajustes" title="Ajustes">⚙</button>
          <button id="btn-shortcuts" className="btn btn-icon" aria-label="Atajos de teclado" title="Atajos de teclado (?)">⌨</button>
          <button id="btn-credits" className="btn btn-icon" aria-label="Créditos y Guía Rápida" title="Créditos y Guía Rápida">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        </div>
      </header>

      {/* ÁREA PRINCIPAL DE TRABAJO */}
      <main className="workspace">
        {/* Biblioteca de Componentes (Izquierda) */}
        <aside id="sidebar-left" className="sidebar-left">
          <div className="sidebar-header">
            <div className="sidebar-title-row">
              <span>Componentes</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button id="btn-lib-expand" className="sidebar-mini-btn" aria-label="Expandir categorías" title="Expandir todas las categorías">▾</button>
                <button id="btn-lib-collapse" className="sidebar-mini-btn" aria-label="Colapsar categorías" title="Colapsar todas las categorías">▸</button>
                <button id="btn-lib-hide" className="sidebar-mini-btn" aria-label="Ocultar biblioteca" title="Ocultar biblioteca (tecla B)">«</button>
              </span>
            </div>
            <div className="search-box">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input id="component-search" type="text" className="input-control" placeholder="Buscar ALU 64b, CRC16, ADC..." aria-label="Buscar componentes" />
            </div>
            <div className="lib-filter-row">
              <select id="lib-cat-filter" className="select-control" aria-label="Filtrar categoría de componentes" title="Filtrar por categoría">
                <option value="ALL">Todas las categorías</option>
              </select>
              <button id="btn-lib-favs" type="button" className="btn" title="Mostrar solo componentes favoritos">★ Favs</button>
            </div>
            <div id="lib-bits-bar" className="lib-bits-bar" title="Ancho de bus predeterminado para componentes escalables">
              <span className="lib-bits-label">Bus:</span>
              {[4, 8, 16, 32, 64].map(bw => (
                <button key={bw} type="button" className="lib-bit-chip mono" data-bits={bw} aria-label={`Ancho predeterminado ${bw} bits`}>
                  {bw}b
                </button>
              ))}
            </div>
            <div id="lib-recent-strip" className="lib-recent-strip hidden" />
          </div>
          <div id="library-container" className="library-scroll" />
        </aside>

        {/* Columna Central: Lienzo + Analizador Lógico */}
        <section className="center-column">
          <div id="canvas-wrapper" className="canvas-wrapper">
            <canvas id="main-canvas" data-testid="main-canvas" />
            <div id="challenge-bar" className="chal-bar hidden">
              <span>🎯 <strong id="chal-bar-title">Reto</strong></span>
              <span id="chal-bar-status" className="chal-status">Sin validar</span>
              <button id="chal-bar-validate" className="btn btn-accent" style={{ height: 24 }}>Validar</button>
              <button id="chal-bar-open" className="btn" style={{ height: 24 }} title="Ver detalle">Detalle</button>
              <button id="chal-bar-close" className="btn btn-icon" aria-label="Salir del reto" style={{ height: 24, width: 24 }} title="Salir del reto">✕</button>
            </div>
            <button id="btn-lib-show" className="sidebar-mini-btn lib-fab" aria-label="Mostrar biblioteca" title="Mostrar biblioteca (tecla B)" style={{ width: 30, height: 30, background: 'var(--bg-panel)' }}>»</button>

            {/* Barra Flotante de Ayuda Rápida */}
            <div className="floating-help">
              <span><strong>Clic</strong> Switch/Hex</span>
              <span>•</span>
              <span><strong>Arrastrar Pin</strong> Cablear</span>
              <span>•</span>
              <span><strong>Trackpad</strong> Mover/Pinch</span>
              <span>•</span>
              <span><strong>F2 / Der.</strong> Etiqueta</span>
              <span>•</span>
              <span><strong>Espacio</strong> Pausa/Mover</span>
            </div>

            {/* HUD Flotante de Sonda Lógica */}
            <div id="probe-hud" className="probe-hud hidden">
              <div className="probe-hud-header">
                <span>SONDA LÓGICA EN VIVO</span>
                <span id="probe-target-name" className="mono">Sin señal</span>
              </div>
              <div className="probe-grid">
                <div className="probe-stat">
                  <div className="probe-stat-label">Estado Lógico</div>
                  <div id="probe-state-val" className="probe-stat-val mono">--</div>
                </div>
                <div className="probe-stat">
                  <div className="probe-stat-label">Frecuencia</div>
                  <div id="probe-freq-val" className="probe-stat-val mono">0.0 Hz</div>
                </div>
                <div className="probe-stat">
                  <div className="probe-stat-label">Ciclo Trabajo</div>
                  <div id="probe-duty-val" className="probe-stat-val mono">0%</div>
                </div>
                <div className="probe-stat">
                  <div className="probe-stat-label">Flancos</div>
                  <div id="probe-edges-val" className="probe-stat-val mono">0</div>
                </div>
              </div>
              <canvas id="probe-mini-canvas" width="198" height="44" style={{ width: '100%', height: 44, borderRadius: 7, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', display: 'block' }} />
            </div>

            {/* Controles de Zoom */}
            <div className="zoom-controls">
              <button id="btn-zoom-out" className="btn btn-icon" aria-label="Alejar" title="Alejar">−</button>
              <span id="zoom-readout" className="zoom-readout mono">100%</span>
              <button id="btn-zoom-in" className="btn btn-icon" aria-label="Acercar" title="Acercar">+</button>
              <button id="btn-zoom-fit" className="btn" title="Centrar y ajustar circuito (Tecla F)">Centrar (F)</button>
              <button id="btn-zoom-sel" className="btn" title="Acercar a la selección (Shift+F)">Sel.</button>
            </div>

            {/* Minimapa Interactivo */}
            <div className="minimap-box" title="Clic o arrastra para navegar por el lienzo">
              <span className="minimap-tag">Minimapa</span>
              <canvas id="minimap-canvas" width="168" height="108" />
            </div>
          </div>

          {/* Panel Inferior: Analizador Lógico Multicanal */}
          <div id="analyzer-panel" className="analyzer-panel">
            <div className="analyzer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--accent)' }}>●</span>
                <span>ANALIZADOR LÓGICO MULTICANAL (OSCILOSCOPIO DIGITAL)</span>
                <span id="analyzer-channel-count" className="mono" style={{ color: 'var(--text-muted)', fontSize: 10 }}>0 canales</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button id="btn-analyzer-pause" className="btn" style={{ height: 22, fontSize: '10.5px' }}>Pausar Traza</button>
                <button id="btn-analyzer-clear" className="btn" style={{ height: 22, fontSize: '10.5px' }}>Limpiar</button>
              </div>
            </div>
            <div className="analyzer-body">
              <canvas id="analyzer-canvas" />
            </div>
          </div>
        </section>

        {/* Panel Derecho: Inspector Contextual de Propiedades */}
        <aside id="sidebar-right" className="sidebar-right hidden">
          <div className="inspector-header">
            <span id="inspector-title">Propiedades</span>
            <button id="btn-close-inspector" className="btn btn-icon" aria-label="Cerrar inspector" style={{ width: 24, height: 24 }}>✕</button>
          </div>
          <div id="inspector-body" className="inspector-body" />
        </aside>
      </main>

      {/* PIE DE ESTADO INFERIOR */}
      <footer className="statusbar">
        <div className="status-group">
          <span>
            <span id="status-sim-dot" className="status-dot" />
            <strong id="status-sim-text">SIMULACIÓN ACTIVA</strong>
          </span>
          <span id="status-counts" className="mono">0 componentes • 0 cables</span>
          <span id="status-coords" className="mono">X: 0, Y: 0</span>
          <span id="status-fps" className="mono hidden">60 FPS</span>
          <span id="autosave-pill" className="mono">💾 Autoguardado activo</span>
        </div>
        <div className="status-group">
          <span>
            LogicStudio Pro <strong>Beta 0.3</strong> • Desarrollado por <strong>Alejandro Arbós Gómez</strong>
          </span>
        </div>
      </footer>

      {/* ELEMENTOS FLOTANTES Y VENTANAS MODALES */}
      <input id="inline-edit-input" type="text" className="inline-editor hidden" aria-label="Editar etiqueta" />
      <div id="context-menu" className="context-menu hidden" />
      <div id="toast-container" className="toast-container" />

      {/* Modal 1: Sintetizador Booleano */}
      <div id="bool-synth-modal" className="modal-backdrop hidden">
        <div className="modal-card">
          <div className="modal-header">
            <div className="modal-title">
              <span className="mono" style={{ color: 'var(--accent)' }}>ƒ(x)</span>
              <span>Sintetizador Booleano Automático</span>
            </div>
            <button className="btn btn-icon modal-close" aria-label="Cerrar sintetizador" data-modal="bool-synth-modal">✕</button>
          </div>
          <div className="modal-body">
            <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              Escribe una expresión lógica y LogicStudio Pro generará y cableará automáticamente las entradas, puertas lógicas y salida LED en el lienzo.
            </p>
            <div className="field-group">
              <label className="field-label" htmlFor="bool-expr-input">
                Expresión Booleana (Variables: A-F, X-Z | Operadores: AND, OR, NOT, NAND, NOR, XOR, XNOR, &amp;, |, !, ^)
              </label>
              <input id="bool-expr-input" type="text" className="input-control mono" style={{ height: 36, fontSize: 13 }} defaultValue="(A AND B) OR (NOT C)" placeholder="Ej: (A XOR B) AND C" />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn bool-example" data-expr="(A AND B) OR (NOT C)">(A AND B) OR (NOT C)</button>
              <button className="btn bool-example" data-expr="(A XOR B) XOR C">Suma 1-Bit: (A XOR B) XOR C</button>
              <button className="btn bool-example" data-expr="(A AND B) OR (C AND (A XOR B))">Acarreo: Cout</button>
              <button className="btn bool-example" data-expr="(A XNOR B) AND (C XNOR D)">Igualdad 2-Bit</button>
            </div>
            <div id="bool-synth-error" style={{ color: 'var(--danger)', fontSize: '11.5px', fontWeight: 600 }} className="hidden" />
          </div>
          <div className="modal-footer">
            <button className="btn modal-close" data-modal="bool-synth-modal">Cancelar</button>
            <button id="btn-run-bool-synth" className="btn btn-accent">Sintetizar Circuito</button>
          </div>
        </div>
      </div>

      {/* Modal 2: Creador de Chips Integrados (Custom IC) */}
      <div id="custom-ic-modal" className="modal-backdrop hidden">
        <div className="modal-card">
          <div className="modal-header">
            <div className="modal-title">
              <span>Empaquetar como Chip Integrado (Custom IC)</span>
            </div>
            <button className="btn btn-icon modal-close" aria-label="Cerrar creador de IC" data-modal="custom-ic-modal">✕</button>
          </div>
          <div className="modal-body">
            <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              Convierte el circuito actual del lienzo en un bloque integrado reutilizable. Las entradas (<span className="mono">SWITCH / BUTTON / HIGH / LOW / CONST_N</span>) serán los pines izquierdos y las salidas (<span className="mono">LED / PROBE / HEX_DISPLAY_N</span>) serán los pines derechos.
            </p>
            <div className="field-group">
              <label className="field-label" htmlFor="custom-ic-name">Nombre del Chip IC (máx. 14 caracteres)</label>
              <input id="custom-ic-name" type="text" maxLength={14} className="input-control mono" defaultValue="MI_CHIP_01" />
            </div>
            <div id="custom-ic-summary" style={{ padding: 10, borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', fontSize: 12 }} />
          </div>
          <div className="modal-footer">
            <button className="btn modal-close" data-modal="custom-ic-modal">Cancelar</button>
            <button id="btn-confirm-custom-ic" className="btn btn-accent">Guardar en Mis Chips (IC)</button>
          </div>
        </div>
      </div>

      {/* Modal 3: Tabla de Verdad Automática */}
      <div id="truth-table-modal" className="modal-backdrop hidden">
        <div className="modal-card wide">
          <div className="modal-header">
            <div className="modal-title">
              <span>Tabla de Verdad Automática</span>
            </div>
            <button className="btn btn-icon modal-close" aria-label="Cerrar tabla de verdad" data-modal="truth-table-modal">✕</button>
          </div>
          <div className="modal-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span id="tt-info-text" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                Haz clic en cualquier fila para inyectar esa combinación directamente en el circuito.
              </span>
              <button id="btn-export-tt-csv" className="btn">Descargar CSV</button>
            </div>
            <div id="tt-container" className="tt-table-wrap" />
          </div>
          <div className="modal-footer">
            <button className="btn btn-accent modal-close" data-modal="truth-table-modal">Cerrar</button>
          </div>
        </div>
      </div>

      {/* Modal 4: Paleta Rápida de Comandos (Ctrl+K) */}
      <div id="cmd-palette-modal" className="modal-backdrop hidden">
        <div className="modal-card">
          <div className="modal-header">
            <div className="modal-title">
              <span>Paleta Rápida de Comandos y Componentes</span>
            </div>
            <button className="btn btn-icon modal-close" aria-label="Cerrar paleta de comandos" data-modal="cmd-palette-modal">✕</button>
          </div>
          <div className="modal-body">
            <input id="cmd-palette-input" type="text" className="input-control" style={{ height: 36, fontSize: 13 }} placeholder="Escribe un componente (ALU_N, TUNNEL, VGA_SCREEN...) o acción..." aria-label="Buscar comando o componente" />
            <div id="cmd-palette-list" style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 290, overflowY: 'auto' }} />
          </div>
        </div>
      </div>

      {/* Modal: LogicScript y Exportador Logisim-evolution */}
      <div id="script-modal" className="modal-backdrop hidden">
        <div className="modal-card" style={{ maxWidth: 880 }}>
          <div className="modal-header">
            <div className="modal-title"><span>&lt;/&gt; Script del Circuito y Exportar a Logisim-evolution</span></div>
            <button className="btn btn-icon modal-close" aria-label="Cerrar LogicScript" data-modal="script-modal">✕</button>
          </div>
          <div className="modal-body">
            <div className="script-tabs">
              <button type="button" id="script-tab-ls" className="script-tab active">&lt;/&gt; LogicScript (Circuito actual)</button>
              <button type="button" id="script-tab-circ" className="script-tab">⬡ Logisim-evolution (.circ)</button>
              <span style={{ flex: 1 }} />
              <button id="script-copy-prompt" className="btn btn-accent" title="Copia un prompt maestro Beta 0.3 con todos los chips de 1–64 bits para cualquier IA">🤖 Copiar prompt IA</button>
            </div>

            <div id="script-panel-ls" className="script-panel">
              <textarea
                id="script-input"
                className="script-editor"
                spellCheck={false}
                aria-label="Editor de LogicScript"
                placeholder={'Transcripción LogicScript del circuito actual en tu lienzo.\n\nPuedes editar el código aquí o pegar código generado por una IA y pulsar "Construir":\nplace a = CONST_N bits=64 value=0xDEAD_BEEF_CAFE_BABE label="A"\nplace alu = ALU_N bits=64\nconnect a.out -> alu.a'}
              />
              <div className="script-toolbar" style={{ marginTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" id="script-replace" defaultChecked style={{ accentColor: 'var(--accent)' }} /> Reemplazar el circuito actual
                </label>
                <span style={{ flex: 1 }} />
                <button id="script-export" className="btn" title="Transcribe en tiempo real tu circuito actual del lienzo a LogicScript">↻ Transcribir circuito actual</button>
                <button id="script-copy" className="btn">📋 Copiar script</button>
                <button id="script-run" className="btn btn-accent">▶ Construir (Ctrl+Enter)</button>
              </div>
              <div id="script-error-tools" className="script-error-tools hidden" style={{ marginTop: 8 }}>
                <span style={{ fontSize: 11.5, color: 'var(--danger)', fontWeight: 700 }}>Diagnóstico listo para IA:</span>
                <span style={{ flex: 1 }} />
                <button id="script-copy-err" className="btn btn-danger" title="Copia el error exacto, línea y sugerencia para que una IA lo corrija">📋 Copiar error para IA</button>
                <button id="script-copy-err-all" className="btn" title="Copia el diagnóstico junto con todo el script actual">📋 Copiar error + script</button>
              </div>
              <div id="script-out" className="script-out" style={{ marginTop: 8 }} />
            </div>

            <div id="script-panel-circ" className="script-panel hidden">
              <div className="script-toolbar" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Transcripción directa de tu circuito abierto a formato estándar <strong>Logisim-evolution (.circ XML)</strong>:
                </span>
                <span style={{ flex: 1 }} />
                <button id="logisim-refresh" className="btn">↻ Actualizar desde lienzo</button>
                <button id="logisim-copy" className="btn">📋 Copiar XML .circ</button>
                <button id="logisim-download" className="btn btn-accent">💾 Descargar .circ</button>
              </div>
              <textarea
                id="logisim-output"
                className="script-editor"
                readOnly
                spellCheck={false}
                aria-label="XML Logisim-evolution del circuito actual"
              />
              <div id="logisim-out" className="script-out" style={{ marginTop: 8 }} />
            </div>

            <details className="script-help">
              <summary>Referencia rápida LogicScript v2 y compatibilidad Logisim-evolution</summary>
              <pre>{`# Sintaxis LogicScript v2 (1–64 bits):
const BITS = 64
let off = 10 + 20 * 2
macro bloque(idx, px, py)
  place k{idx} = CONST_N bits=8 value={idx*4} at {px},{py}
  place vu{idx} = VU_METER_N bits=8 at +160,+0
  connect k{idx}.out -> vu{idx}.in0
endmacro
call bloque(0, -100, 0)
place rom = ROM_N bits=8 addrBits=5 mem="HOLA",0x0A,0x00*4
connect cnt.q0..q3 -> mux.d0..d3
for i in 0..7 ... end  # Soporta bucles anidados y aritmética {i*2+1}`}</pre>
            </details>
          </div>
        </div>
      </div>

      {/* Modal: Editor Hexadecimal y Programador de Memoria RAM / ROM */}
      <div id="mem-modal" className="modal-backdrop hidden">
        <div className="modal-card wide" style={{ maxWidth: 860 }}>
          <div className="modal-header">
            <div className="modal-title">
              <span id="mem-modal-title">Programador Hexadecimal RAM / ROM</span>
            </div>
            <button className="btn btn-icon modal-close" aria-label="Cerrar editor de memoria" data-modal="mem-modal">✕</button>
          </div>
          <div className="modal-body">
            <div className="mem-toolbar-row">
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                <button id="mem-page-prev" className="btn">← Ant.</button>
                <span id="mem-page-info" className="mono mem-page-pill">0x00–0x3F</span>
                <button id="mem-page-next" className="btn">Sig. →</button>
                <select id="mem-page-size" className="select-control mono" aria-label="Celdas por página" title="Celdas por página">
                  <option value="64">64/pág</option>
                  <option value="128">128/pág</option>
                  <option value="256">256/pág</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                <input id="mem-jump-addr" type="text" className="input-control mono" style={{ width: 68 }} placeholder="0x00" aria-label="Ir a dirección hexadecimal" />
                <button id="mem-jump-btn" className="btn">Ir Addr</button>
                <input id="mem-search-input" type="text" className="input-control mono" style={{ width: 126 }} placeholder="Buscar hex/ASCII" aria-label="Buscar valor o texto en memoria" />
                <button id="mem-search-btn" className="btn">Buscar</button>
              </div>
            </div>

            <div id="mem-live-info" className="mem-live-info mono">
              Lectura actual: 0x00 • Última escritura: — • Capacidad: 256 × 8b
            </div>

            <div className="mem-toolbar-row">
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                <select id="mem-pattern-select" className="select-control" aria-label="Patrón de llenado de memoria">
                  <option value="zero">0x00 (Limpiar todo)</option>
                  <option value="ff">0xFF / Máx (Todo 1s)</option>
                  <option value="ramp">0, 1, 2… (Rampa lineal)</option>
                  <option value="fib">Fibonacci modular</option>
                  <option value="checker">Alterno 0xA5 / 0x5A</option>
                  <option value="random">Aleatorio pseudo-PRNG</option>
                  <option value="invert">Invertir bits (~Mem)</option>
                  <option value="doom">Mapa Dungeon DOOM 16×16</option>
                </select>
                <button id="mem-apply-pattern" className="btn btn-accent">Aplicar Patrón</button>
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <button id="mem-import-hex-btn" className="btn" title="Importar archivo .hex, .txt o .csv">📂 Importar</button>
                <input id="mem-import-file" type="file" accept=".hex,.txt,.csv" className="hidden" />
                <button id="mem-export-hex" className="btn">💾 .hex</button>
                <button id="mem-export-csv" className="btn">📊 .csv</button>
                <button id="mem-copy-hex" className="btn">📋 Hex</button>
                <button id="mem-copy-ls" className="btn" title="Copiar línea mem= para LogicScript">📋 mem=</button>
              </div>
            </div>

            <div className="mem-batch-bar">
              <input
                id="mem-batch-input"
                type="text"
                className="input-control mono"
                placeholder="Desde celda sel. (o 0x00): hex/dec (0F, 80, 255) o ASCII"
                aria-label="Secuencia hexadecimal o texto ASCII para programar memoria"
              />
              <button id="mem-load-batch" className="btn btn-accent">Cargar Hex/Dec</button>
              <button id="mem-load-ascii" className="btn">Cargar ASCII</button>
            </div>
            <div id="mem-hex-grid" style={{ maxHeight: 310, overflowY: 'auto' }} />
            <div id="mem-cell-detail" className="mem-cell-detail mono">
              Celda 0x00 | Hex: 0x00 | Dec: 0 | Signo: 0 | Bin: 00000000 | ASCII: ·
            </div>
          </div>
          <div className="modal-footer">
            <span style={{ marginRight: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
              Cada edición queda en el historial Deshacer (Ctrl+Z).
            </span>
            <button className="btn btn-accent modal-close" data-modal="mem-modal">Listo</button>
          </div>
        </div>
      </div>

      {/* Modal: Ajustes (Guardados en localStorage) */}
      <div id="settings-modal" className="modal-backdrop hidden">
        <div className="modal-card" style={{ maxWidth: 590 }}>
          <div className="modal-header">
            <div className="modal-title"><span>⚙ Ajustes y Optimización (guardados automáticamente)</span></div>
            <button className="btn btn-icon modal-close" aria-label="Cerrar ajustes" data-modal="settings-modal">✕</button>
          </div>
          <div className="modal-body">
            <div className="perf-profile-box">
              <div className="field-label" style={{ marginBottom: 6 }}>Perfil rápido de rendimiento (PC / Portátil bajos recursos)</div>
              <div className="perf-profile-grid">
                <button type="button" className="btn perf-profile-btn" data-profile="high">Alta Calidad</button>
                <button type="button" className="btn perf-profile-btn" data-profile="balanced">Balanceado</button>
                <button type="button" className="btn perf-profile-btn" data-profile="eco">Portátil Eco</button>
                <button type="button" className="btn perf-profile-btn" data-profile="potato">Ultra Ligero</button>
              </div>
            </div>
            <div className="set-row">
              <div>
                <strong>Límite de FPS de pantalla</strong>
                <span>Limitar a 30 o 15 FPS ahorra mucha CPU/batería en portátiles o circuitos VGA grandes.</span>
              </div>
              <select id="set-fps" className="select-control mono" style={{ width: 132 }}>
                <option value="60">60 FPS</option>
                <option value="30">30 FPS</option>
                <option value="15">15 FPS (Eco)</option>
                <option value="10">10 FPS (Ultra)</option>
              </select>
            </div>
            <div className="set-row">
              <div>
                <strong>Presupuesto ciclos TURBO/frame</strong>
                <span>Ciclos máximos por fotograma en modo TURBO (VGA/DOOM/Anim32). Menor = UI más fluida.</span>
              </div>
              <select id="set-turbo-cycles" className="select-control mono" style={{ width: 132 }}>
                <option value="2048">2048 (Máx)</option>
                <option value="1024">1024</option>
                <option value="512">512 (Def.)</option>
                <option value="256">256 (Ligero)</option>
                <option value="128">128 (Patata)</option>
              </select>
            </div>
            <div className="set-row">
              <div>
                <strong>Doble clic para editar etiqueta</strong>
                <span>Desactivado por defecto para no interrumpir clics rápidos. Usa F2 o clic derecho.</span>
              </div>
              <input type="checkbox" id="set-dbl" className="set-check" />
            </div>
            <div className="set-row">
              <div>
                <strong>Abrir Osciloscopio al iniciar</strong>
                <span>Si lo desactivas, el panel del analizador permanecerá cerrado al abrir la app.</span>
              </div>
              <input type="checkbox" id="set-analyzer-start" className="set-check" />
            </div>
            <div className="set-row">
              <div>
                <strong>Modo de navegación (Trackpad / Ratón)</strong>
                <span>Auto detecta gestos de 2 dedos (pan) y pinch (zoom) en trackpad; Ratón usa la rueda para zoom.</span>
              </div>
              <select id="set-nav" className="select-control" style={{ width: 132 }}>
                <option value="auto">Auto (Híbrido)</option>
                <option value="trackpad">Trackpad</option>
                <option value="mouse">Ratón</option>
              </select>
            </div>
            <div className="set-row">
              <div>
                <strong>Ancho de bus predeterminado (1–64 bits)</strong>
                <span>Ancho inicial al añadir nuevos bloques escalables (ALU_N, Registros, RAM_N…).</span>
              </div>
              <select id="set-def-bits" className="select-control mono" style={{ width: 132 }}>
                <option value="4">4 bits</option>
                <option value="8">8 bits</option>
                <option value="16">16 bits</option>
                <option value="32">32 bits</option>
                <option value="64">64 bits</option>
              </select>
            </div>
            <div className="set-row">
              <div>
                <strong>Estilo de cables predeterminado</strong>
                <span>Ortogonal organiza los buses en carriles limpios con esquinas redondeadas.</span>
              </div>
              <select id="set-wire" className="select-control" style={{ width: 132 }}>
                <option value="bezier">Bézier</option>
                <option value="orthogonal">Ortogonal</option>
              </select>
            </div>
            <div className="set-row">
              <div>
                <strong>Visibilidad de cables (Anti-lío)</strong>
                <span>Atenúa cables en 0 o muestra solo los conectados al componente seleccionado.</span>
              </div>
              <select id="set-wire-vis" className="select-control" style={{ width: 132 }}>
                <option value="all">Todos visibles</option>
                <option value="dim_inactive">Atenuar inactivos</option>
                <option value="selected_only">Solo selección</option>
              </select>
            </div>
            <div className="set-row">
              <div>
                <strong>Calidad gráfica</strong>
                <span>Auto ajusta sombras y brillo si bajan los FPS en circuitos enormes.</span>
              </div>
              <select id="set-quality" className="select-control" style={{ width: 132 }}>
                <option value="auto">Auto</option>
                <option value="high">Alta</option>
                <option value="low">Baja</option>
                <option value="eco">Eco (PC lento)</option>
              </select>
            </div>
            <div className="set-row">
              <div>
                <strong>Modo Eco (PC / Portátiles bajos recursos)</strong>
                <span>Reduce DPR a 1×, limita FPS inactivos y desactiva brillos y partículas para ahorrar batería y CPU.</span>
              </div>
              <input type="checkbox" id="set-eco" className="set-check" />
            </div>
            <div className="set-row">
              <div>
                <strong>Partículas en los cables</strong>
                <span>Pulsos luminosos viajando por señales y buses activos.</span>
              </div>
              <input type="checkbox" id="set-particles" className="set-check" />
            </div>
            <div className="set-row">
              <div>
                <strong>Mostrar rejilla de puntos en el lienzo</strong>
                <span>Desactivarla acelera el renderizado en pantallas grandes o hardware antiguo.</span>
              </div>
              <input type="checkbox" id="set-grid" className="set-check" />
            </div>
            <div className="set-row">
              <div>
                <strong>Etiquetas de ancho (8b/64b) sobre cables</strong>
                <span>Desactivarlo limpia la vista y reduce dibujado de texto en buses densos.</span>
              </div>
              <input type="checkbox" id="set-wire-labels" className="set-check" />
            </div>
            <div className="set-row">
              <div>
                <strong>Reducir animaciones de interfaz</strong>
                <span>Desactiva transiciones CSS y efectos de rebote para respuesta instantánea.</span>
              </div>
              <input type="checkbox" id="set-reduce-anim" className="set-check" />
            </div>
            <div className="set-row">
              <div>
                <strong>Mostrar contador FPS en barra inferior</strong>
                <span>Oculto por defecto para mantener la barra limpia.</span>
              </div>
              <input type="checkbox" id="set-fps-hud" className="set-check" />
            </div>
            <div className="set-row">
              <div>
                <strong>Ajustar a la cuadrícula</strong>
                <span>Los componentes saltan de 10 en 10 px al moverlos.</span>
              </div>
              <input type="checkbox" id="set-snap" className="set-check" />
            </div>
            <div className="set-row">
              <div>
                <strong>Mostrar minimapa flotante</strong>
                <span>Vista rápida del circuito en la esquina inferior derecha.</span>
              </div>
              <input type="checkbox" id="set-minimap" className="set-check" />
            </div>
            <div className="set-row">
              <div>
                <strong>Mostrar barra de ayuda rápida</strong>
                <span>Leyenda superior de atajos básicos sobre el lienzo.</span>
              </div>
              <input type="checkbox" id="set-helpbar" className="set-check" />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              <button id="set-tidy" className="btn btn-accent">Ordenar circuito automáticamente (O)</button>
              <button id="set-reset" className="btn">Restablecer ajustes</button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Atajos */}
      <div id="shortcuts-modal" className="modal-backdrop hidden">
        <div className="modal-card" style={{ maxWidth: 560 }}>
          <div className="modal-header">
            <div className="modal-title"><span>⌨ Atajos de teclado y Trackpad</span></div>
            <button className="btn btn-icon modal-close" aria-label="Cerrar atajos" data-modal="shortcuts-modal">✕</button>
          </div>
          <div className="modal-body">
            <div className="kbd-grid">
              <div className="kbd-row"><span>Simular / pausar</span><span className="kbd">Espacio</span></div>
              <div className="kbd-row"><span>Mover lienzo (Trackpad)</span><span className="kbd">2 Dedos</span></div>
              <div className="kbd-row"><span>Zoom (Trackpad)</span><span className="kbd">Pinch / Ctrl+Rueda</span></div>
              <div className="kbd-row"><span>Paleta de comandos</span><span className="kbd">Ctrl K</span></div>
              <div className="kbd-row"><span>Rotar / rotar inverso</span><span className="kbd">R · Shift R</span></div>
              <div className="kbd-row"><span>Voltear</span><span className="kbd">H</span></div>
              <div className="kbd-row"><span>Copiar / cortar / pegar</span><span className="kbd">Ctrl C X V</span></div>
              <div className="kbd-row"><span>Duplicar</span><span className="kbd">Ctrl D</span></div>
              <div className="kbd-row"><span>Deshacer / rehacer</span><span className="kbd">Ctrl Z / Y</span></div>
              <div className="kbd-row"><span>Guardar JSON</span><span className="kbd">Ctrl S</span></div>
              <div className="kbd-row"><span>Borrar selección</span><span className="kbd">Supr</span></div>
              <div className="kbd-row"><span>Mover selección</span><span className="kbd">Flechas · Shift</span></div>
              <div className="kbd-row"><span>Centrar vista</span><span className="kbd">F</span></div>
              <div className="kbd-row"><span>Modo sonda</span><span className="kbd">P</span></div>
              <div className="kbd-row"><span>Ocultar biblioteca</span><span className="kbd">B</span></div>
              <div className="kbd-row"><span>Construir script</span><span className="kbd">Ctrl Enter</span></div>
              <div className="kbd-row"><span>Editar etiqueta</span><span className="kbd">F2</span></div>
              <div className="kbd-row"><span>Ordenar circuito</span><span className="kbd">O</span></div>
              <div className="kbd-row"><span>Controles DOOM / Gamepad</span><span className="kbd">WASD · J / F</span></div>
              <div className="kbd-row"><span>Esta ayuda</span><span className="kbd">?</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Modo Ejercicios */}
      <div id="challenges-modal" className="modal-backdrop hidden">
        <div className="modal-card" style={{ maxWidth: 640 }}>
          <div className="modal-header">
            <div className="modal-title"><span>🎯 Modo Ejercicios — Retos de Lógica</span></div>
            <button className="btn btn-icon modal-close" aria-label="Cerrar retos" data-modal="challenges-modal">✕</button>
          </div>
          <div className="modal-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              <span id="chal-progress-text" className="mono" style={{ fontWeight: 800, color: 'var(--accent)' }}>0/0</span>
              <div style={{ flex: 1, height: 6, borderRadius: 99, background: 'var(--bg-input)', overflow: 'hidden' }}>
                <div id="chal-progress-fill" style={{ height: '100%', width: 0, background: 'linear-gradient(90deg,var(--accent),var(--accent-secondary))', transition: 'width 0.4s ease' }} />
              </div>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              Construye el circuito en el lienzo usando <strong>Interruptores</strong> con la etiqueta de cada entrada y <strong>LEDs</strong> con la etiqueta de cada salida. Pulsa <strong>Preparar lienzo</strong> para colocarlos automáticamente.
            </p>
            <div id="chal-list" className="chal-list" />
            <div id="chal-detail" />
          </div>
        </div>
      </div>

      {/* Modal 5: Créditos y Guía Rápida */}
      <div id="credits-modal" className="modal-backdrop hidden">
        <div className="modal-card">
          <div className="modal-header">
            <div className="modal-title">
              <span>LogicStudio Pro — Versión Beta 0.3</span>
            </div>
            <button className="btn btn-icon modal-close" aria-label="Cerrar créditos" data-modal="credits-modal">✕</button>
          </div>
          <div className="modal-body">
            <div style={{ padding: 14, borderRadius: 12, background: 'var(--accent-soft)', border: '1px solid var(--border-strong)' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>
                Creado y diseñado por Alejandro Arbós Gómez
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                Simulador interactivo de electrónica digital y arquitectura de computadores de hasta 64 bits en tiempo real, con buses, túneles inalámbricos, memorias masivas, pantallas VGA y motor 3D DOOM.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: '11.5px' }}>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                <span className="kbd">Espacio</span> Pausa / Arrastrar lienzo
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                <span className="kbd">F2</span> Editar etiqueta sin doble clic
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                <span className="kbd">2 Dedos / Pinch</span> Navegación Trackpad
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                <span className="kbd">Ctrl+K</span> Paleta rápida de chips
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                <span className="kbd">WASD / F</span> Controles Gamepad DOOM
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                <span className="kbd">O</span> Ordenar circuito automáticamente
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <span style={{ marginRight: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>© 2026 Alejandro Arbós Gómez • Beta 0.3</span>
            <button className="btn btn-accent modal-close" data-modal="credits-modal">¡Entendido!</button>
          </div>
        </div>
      </div>

      {/* Modal 6: Confirmación Limpiar Lienzo */}
      <div id="confirm-clear-modal" className="modal-backdrop hidden">
        <div className="modal-card" style={{ maxWidth: 400 }}>
          <div className="modal-header">
            <div className="modal-title"><span>Limpiar Lienzo</span></div>
            <button className="btn btn-icon modal-close" aria-label="Cerrar confirmación" data-modal="confirm-clear-modal">✕</button>
          </div>
          <div className="modal-body">
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              ¿Deseas eliminar todos los componentes y cables actuales del área de trabajo? Podrás revertirlo con <span className="kbd">Ctrl+Z</span>.
            </p>
          </div>
          <div className="modal-footer">
            <button className="btn modal-close" data-modal="confirm-clear-modal">Cancelar</button>
            <button id="btn-confirm-clear" className="btn btn-danger" style={{ background: 'var(--danger)', color: '#fff' }}>Limpiar Todo</button>
          </div>
        </div>
      </div>
    </>
  );
}
