import { useCallback, useEffect, useRef, useState } from 'react';
import { Tldraw, getSnapshot } from 'tldraw';
import 'tldraw/tldraw.css';

type Props = {
  tldrawDocument?: unknown;
  onSnapshotChange?: (snapshot: unknown) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TldrawEditor = any;

const BRUSH_TOOLS = [
  { key: '1', label: 'Fine Liner', width: 1, icon: (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="currentColor">
      <path d="M16 2l1 7-1 2-1-2z" opacity="0.5"/>
      <rect x="15.3" y="11" width="1.4" height="11" rx="0.3"/>
      <circle cx="16" cy="24" r="0.8"/>
    </svg>
  )},
  { key: '2', label: 'Fountain Pen', width: 2, icon: (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="currentColor">
      <path d="M16 2l2 8-2 2-2-2z" opacity="0.5"/>
      <rect x="14.5" y="12" width="3" height="10" rx="0.5"/>
      <path d="M14.5 22l1.5 4 1.5-4z" opacity="0.7"/>
    </svg>
  )},
  { key: '3', label: 'Marker', width: 4, icon: (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="currentColor">
      <rect x="12" y="2" width="8" height="8" rx="1.5" opacity="0.5"/>
      <path d="M12 10h8l1 9H11z" opacity="0.8"/>
      <path d="M11 19h10l0.8 4H10.2z" opacity="0.6"/>
    </svg>
  )},
  { key: '4', label: 'Highlighter', width: 8, icon: (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="currentColor">
      <rect x="11" y="2" width="10" height="7" rx="1.5" opacity="0.35"/>
      <path d="M11 9h10v4l-1.5 9h-7L11 13z" opacity="0.3"/>
      <rect x="12" y="22" width="8" height="3" rx="1" opacity="0.45"/>
    </svg>
  )},
];

const COLORS = [
  { hex: '#000000', tldraw: 'black' },
  { hex: '#1971c2', tldraw: 'blue' },
  { hex: '#f08c00', tldraw: 'orange' },
  { hex: '#ffffff', tldraw: 'white' },
  { hex: '#e03131', tldraw: 'red' },
  { hex: '#ffd43b', tldraw: 'yellow' },
  { hex: '#2f9e44', tldraw: 'green' },
  { hex: '#9c36b5', tldraw: 'violet' },
  { hex: '#0ca789', tldraw: 'light-violet' },
];

const ALL_COLORS = [...COLORS];

const STROKE_OPTIONS = ['solid', 'dotted', 'dashed'] as const;
const FILL_OPTIONS = ['solid', 'hachure', 'none'] as const;

export function FreeDrawCanvas({ onSnapshotChange }: Props) {
  const editorRef = useRef<TldrawEditor | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTool, setActiveTool] = useState('draw');
  const [activeBrush, setActiveBrush] = useState(2);
  const [activeColor, setActiveColor] = useState('#000000');
  const [colorOrder, setColorOrder] = useState(ALL_COLORS);
  const [strokeStyle, setStrokeStyle] = useState<'solid' | 'dotted' | 'dashed'>('solid');
  const [fillStyle, setFillStyle] = useState<'hachure' | 'solid' | 'none'>('solid');

  const handleMount = useCallback((editor: TldrawEditor) => {
    editorRef.current = editor;
  }, []);

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  const handleStoreChange = useCallback(() => {
    if (!editorRef.current || !onSnapshotChange) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (!editorRef.current) return;
      const { document } = getSnapshot(editorRef.current.store);
      onSnapshotChange(document);
    }, 1500);
  }, [onSnapshotChange]);

  const selectTool = useCallback((tool: string) => {
    setActiveTool(tool);
    if (!editorRef.current) return;
    try { editorRef.current.setSelectedTool(tool); } catch { /* */ }
  }, []);

  const selectBrush = useCallback((width: number) => {
    setActiveBrush(width);
    setActiveTool('draw');
    if (!editorRef.current) return;
    try {
      editorRef.current.setSelectedTool('draw');
      editorRef.current.setStyleForNextShapes({ strokeWidth: width });
    } catch { /* */ }
  }, []);

  const selectColor = useCallback((hex: string, tldrawColor: string) => {
    setActiveColor(hex);
    setColorOrder(prev => {
      const idx = prev.findIndex(c => c.hex === hex);
      if (idx <= 0) return prev;
      const item = prev[idx];
      return [item, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });
    if (!editorRef.current) return;
    try { editorRef.current.setStyleForNextShapes({ color: tldrawColor }); } catch { /* */ }
  }, []);

  const selectShape = useCallback((tool: string) => {
    setActiveTool(tool);
    if (!editorRef.current) return;
    try {
      editorRef.current.setSelectedTool(tool);
      editorRef.current.setStyleForNextShapes({ fill: fillStyle, strokeStyle });
    } catch { /* */ }
  }, [fillStyle, strokeStyle]);

  const selectStrokeStyle = useCallback((style: 'solid' | 'dotted' | 'dashed') => {
    setStrokeStyle(style);
    if (!editorRef.current) return;
    try { editorRef.current.setStyleForNextShapes({ strokeStyle: style }); } catch { /* */ }
  }, []);

  const selectFillStyle = useCallback((fill: 'hachure' | 'solid' | 'none') => {
    setFillStyle(fill);
    if (!editorRef.current) return;
    try { editorRef.current.setStyleForNextShapes({ fill }); } catch { /* */ }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      const toolMap: Record<string, string> = {
        v: 'select', p: 'draw', d: 'draw', e: 'eraser',
        r: 'rectangle', o: 'ellipse', a: 'arrow', l: 'line', t: 'text',
      };
      if (toolMap[key]) setActiveTool(toolMap[key]);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderStrokePreview = (s: string) => (
    <svg width="20" height="4" viewBox="0 0 20 4">
      <line x1="0" y1="2" x2="20" y2="2" stroke="currentColor" strokeWidth="1.5"
        strokeDasharray={s === 'dotted' ? '1 3' : s === 'dashed' ? '5 2' : undefined}/>
    </svg>
  );

  const renderFillPreview = (f: string) => (
    <svg width="18" height="14" viewBox="0 0 18 14">
      <rect x="1" y="1" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"
        fill={f === 'solid' ? 'currentColor' : 'none'} opacity={f === 'solid' ? 0.25 : 1}/>
      {f === 'hachure' && <path d="M2 6L6 2M4 8L8 4M6 10L10 6M8 12L12 8" stroke="currentColor" strokeWidth="0.6"/>}
    </svg>
  );

  return (
    <div className="freedraw-canvas">
      <Tldraw
        persistenceKey={undefined}
        onMount={(editor) => {
          handleMount(editor);
          editor.store.listen(handleStoreChange, { source: 'user', scope: 'document' });
        }}
      />

      <div className="excalidraw-bottom-bar">
        {/* Select */}
        <button className={`excalidraw-tool-btn ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => selectTool('select')} title="Select (V)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2l14 10.5-5.5 1.5 3.5 7-2.5 1.2-3.5-7L4 22V2z"/></svg>
        </button>

        {/* Pen + Brush popup */}
        <div className="excalidraw-brush-group">
          <button className={`excalidraw-tool-btn ${activeTool === 'draw' ? 'active' : ''}`}
            onClick={() => selectTool('draw')}
            onDoubleClick={() => {
              const idx = BRUSH_TOOLS.findIndex(b => b.width === activeBrush);
              const next = BRUSH_TOOLS[(idx + 1) % BRUSH_TOOLS.length];
              selectBrush(next.width);
            }}
            title="Pen (P) — double-click to cycle">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor">
              <path d="M8 28c-1.5 0-3-1-3-2.5S8 21 8 21l10-10 3 3-10 10s0 0-1.5 3.5S8 28 8 28z" opacity="0.4"/>
              <path d="M18 11l3-3c.8-.8.8-2 0-2.8l-.2-.2c-.8-.8-2-.8-2.8 0l-3 3 3 3z"/>
              <circle cx="9" cy="26" r="1.5"/>
            </svg>
          </button>
          <div className="excalidraw-brush-popup">
            {BRUSH_TOOLS.map((b) => (
              <button key={b.key}
                className={`excalidraw-brush-btn ${activeTool === 'draw' && activeBrush === b.width ? 'active' : ''}`}
                onClick={() => selectBrush(b.width)} title={b.label}>
                {b.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Eraser */}
        <button className={`excalidraw-tool-btn ${activeTool === 'eraser' ? 'active' : ''}`}
          onClick={() => selectTool('eraser')} title="Eraser (E)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.2 3.6l4.2 4.2c.8.8.8 2 0 2.8L12 19c-1.6 1.6-4.2 1.6-5.8 0L3.2 16c-1.6-1.6-1.6-4.2 0-5.8L13.4 3.6c.8-.8 2-.8 2.8 0zM5 14.2l3.8 3.8c.8.8 2 .8 2.8 0L15.4 14 10.6 9.2 5 14.2z"/>
          </svg>
        </button>

        <div className="excalidraw-separator" />

        {/* Colors: 3 visible, expand right */}
        <div className="excalidraw-color-group">
          <div className="excalidraw-colors-visible">
            {colorOrder.slice(0, 3).map((c) => (
              <button key={c.hex}
                className={`excalidraw-color-btn ${c.hex === '#ffffff' ? 'excalidraw-color-btn--white' : ''} ${activeColor === c.hex ? 'active' : ''}`}
                style={{ background: c.hex }} onClick={() => selectColor(c.hex, c.tldraw)} />
            ))}
          </div>
          <div className="excalidraw-colors-expand">
            {colorOrder.slice(3).map((c) => (
              <button key={c.hex}
                className={`excalidraw-color-btn ${c.hex === '#ffffff' ? 'excalidraw-color-btn--white' : ''} ${activeColor === c.hex ? 'active' : ''}`}
                style={{ background: c.hex }} onClick={() => selectColor(c.hex, c.tldraw)} />
            ))}
          </div>
        </div>

        <div className="excalidraw-separator" />

        {/* Shapes: Rect, Ellipse, Arrow, Line + shared popup */}
        <div className="excalidraw-shapes">
          <div className="excalidraw-shape-group">
            <button className={`excalidraw-tool-btn ${activeTool === 'rectangle' ? 'active' : ''}`}
              onClick={() => selectShape('rectangle')} title="Rectangle (R)">
              <svg width="16" height="16" viewBox="0 0 24 24"
                fill={fillStyle === 'solid' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <rect x="3" y="5" width="18" height="14" rx="1" opacity={fillStyle === 'solid' ? 0.3 : 1}/>
              </svg>
            </button>
            <div className="excalidraw-shape-popup">
              <div className="excalidraw-popup-label">Stroke</div>
              <div className="excalidraw-popup-row">
                {STROKE_OPTIONS.map((s) => (
                  <button key={s} className={`excalidraw-popup-btn ${strokeStyle === s ? 'active' : ''}`}
                    onClick={() => selectStrokeStyle(s)} title={s}>
                    {renderStrokePreview(s)}
                  </button>
                ))}
              </div>
              <div className="excalidraw-popup-label">Fill</div>
              <div className="excalidraw-popup-row">
                {FILL_OPTIONS.map((f) => (
                  <button key={f} className={`excalidraw-popup-btn ${fillStyle === f ? 'active' : ''}`}
                    onClick={() => selectFillStyle(f)} title={f}>
                    {renderFillPreview(f)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="excalidraw-shape-group">
            <button className={`excalidraw-tool-btn ${activeTool === 'ellipse' ? 'active' : ''}`}
              onClick={() => selectShape('ellipse')} title="Ellipse (O)">
              <svg width="16" height="16" viewBox="0 0 24 24"
                fill={fillStyle === 'solid' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <ellipse cx="12" cy="12" rx="9" ry="7" opacity={fillStyle === 'solid' ? 0.3 : 1}/>
              </svg>
            </button>
            <div className="excalidraw-shape-popup">
              <div className="excalidraw-popup-label">Stroke</div>
              <div className="excalidraw-popup-row">
                {STROKE_OPTIONS.map((s) => (
                  <button key={s} className={`excalidraw-popup-btn ${strokeStyle === s ? 'active' : ''}`}
                    onClick={() => selectStrokeStyle(s)} title={s}>
                    {renderStrokePreview(s)}
                  </button>
                ))}
              </div>
              <div className="excalidraw-popup-label">Fill</div>
              <div className="excalidraw-popup-row">
                {FILL_OPTIONS.map((f) => (
                  <button key={f} className={`excalidraw-popup-btn ${fillStyle === f ? 'active' : ''}`}
                    onClick={() => selectFillStyle(f)} title={f}>
                    {renderFillPreview(f)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="excalidraw-shape-group">
            <button className={`excalidraw-tool-btn ${activeTool === 'arrow' ? 'active' : ''}`}
              onClick={() => selectShape('arrow')} title="Arrow (A)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray={strokeStyle === 'dotted' ? '2 3' : strokeStyle === 'dashed' ? '6 3' : undefined}>
                <line x1="5" y1="19" x2="19" y2="5"/>
                <polyline points="12 5 19 5 19 12"/>
              </svg>
            </button>
            <div className="excalidraw-shape-popup">
              <div className="excalidraw-popup-label">Stroke</div>
              <div className="excalidraw-popup-row">
                {STROKE_OPTIONS.map((s) => (
                  <button key={s} className={`excalidraw-popup-btn ${strokeStyle === s ? 'active' : ''}`}
                    onClick={() => selectStrokeStyle(s)} title={s}>
                    {renderStrokePreview(s)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="excalidraw-shape-group">
            <button className={`excalidraw-tool-btn ${activeTool === 'line' ? 'active' : ''}`}
              onClick={() => selectShape('line')} title="Line (L)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={strokeStyle === 'dotted' ? '2 3' : strokeStyle === 'dashed' ? '6 3' : undefined}>
                <line x1="5" y1="19" x2="19" y2="5"/>
              </svg>
            </button>
            <div className="excalidraw-shape-popup">
              <div className="excalidraw-popup-label">Stroke</div>
              <div className="excalidraw-popup-row">
                {STROKE_OPTIONS.map((s) => (
                  <button key={s} className={`excalidraw-popup-btn ${strokeStyle === s ? 'active' : ''}`}
                    onClick={() => selectStrokeStyle(s)} title={s}>
                    {renderStrokePreview(s)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button className={`excalidraw-tool-btn ${activeTool === 'text' ? 'active' : ''}`}
            onClick={() => selectTool('text')} title="Text (T)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 4v3h5.5v12h3V7H19V4H5z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
