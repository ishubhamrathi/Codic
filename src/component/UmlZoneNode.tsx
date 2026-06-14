import { useState, useRef, useCallback, useEffect } from 'react';
import { useReactFlow, type NodeProps } from '@xyflow/react';
import type { UmlZone } from '../types/uml';

function InlineEdit({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const committed = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = useCallback(() => {
    if (committed.current) return;
    committed.current = true;
    onCommit(draft);
  }, [draft, onCommit]);

  return (
    <input
      ref={ref}
      className="uml-zone__name-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { committed.current = true; onCommit(value); }
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}

export function UmlZoneNode({ id, data, selected, width, height }: NodeProps<UmlZone>) {
  const [editing, setEditing] = useState(false);
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number; handle: string } | null>(null);
  const { setNodes } = useReactFlow();

  const update = (patch: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    );
  };

  const handleMouseDown = useCallback((e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: width ?? 400, startH: height ?? 300, handle };
    setResizing(true);
  }, [width, height]);

  useEffect(() => {
    if (!resizing) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = e.clientX - resizeRef.current.startX;
      const dy = e.clientY - resizeRef.current.startY;
      const { startW, startH, handle } = resizeRef.current;
      let newW = startW;
      let newH = startH;

      if (handle.includes('e')) newW = Math.max(200, startW + dx);
      if (handle.includes('w')) newW = Math.max(200, startW - dx);
      if (handle.includes('s')) newH = Math.max(150, startH + dy);
      if (handle.includes('n')) newH = Math.max(150, startH - dy);

      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, style: { ...n.style, width: newW, height: newH } } : n)),
      );
    };

    const onMouseUp = () => {
      resizeRef.current = null;
      setResizing(false);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [resizing, id, setNodes]);

  const w = width ?? 400;
  const h = height ?? 300;

  return (
    <div
      className={`uml-zone ${selected ? 'selected' : ''} ${resizing ? 'resizing' : ''}`}
      style={{ width: w, height: h }}
    >
      <div className="uml-zone__header">
        {editing ? (
          <InlineEdit
            value={data.name}
            onCommit={(v) => { update({ data: { ...data, name: v || data.name } }); setEditing(false); }}
          />
        ) : (
          <span
            className="uml-zone__name"
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
          >
            {data.name}
          </span>
        )}
      </div>

      <div className="uml-zone__body" />

      <div className="uml-zone__resize-handle uml-zone__resize-ne" onMouseDown={(e) => handleMouseDown(e, 'ne')} />
      <div className="uml-zone__resize-handle uml-zone__resize-se" onMouseDown={(e) => handleMouseDown(e, 'se')} />
      <div className="uml-zone__resize-handle uml-zone__resize-sw" onMouseDown={(e) => handleMouseDown(e, 'sw')} />
      <div className="uml-zone__resize-handle uml-zone__resize-nw" onMouseDown={(e) => handleMouseDown(e, 'nw')} />
    </div>
  );
}
