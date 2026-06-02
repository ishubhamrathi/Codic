import { useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { visibilitySymbol, createMember } from '../lib/umlFactory';
import type { UmlNode, UmlVisibility, UmlNodeData } from '../types/uml';

const stereotype = {
  class: 'class',
  abstract: 'abstract',
  interface: 'interface',
  enum: 'enum',
} as const;

const VIS_ORDER: UmlVisibility[] = ['public', 'private', 'protected', 'package'];

function InlineEdit({
  value,
  onCommit,
  className,
  placeholder,
  onArrowUp,
  onArrowDown,
  onEnter,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onEnter?: () => void;
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
      className={`uml-inline-input ${className ?? ''}`}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
          if (onEnter) onEnter();
        }
        if (e.key === 'Escape') {
          committed.current = true;
          onCommit(value);
        }
        if (e.key === 'ArrowUp' && onArrowUp) {
          e.preventDefault();
          commit();
          onArrowUp();
        }
        if (e.key === 'ArrowDown' && onArrowDown) {
          e.preventDefault();
          commit();
          onArrowDown();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}

function AddRow({
  placeholder,
  onCommit,
  onClose,
  onArrowDown,
}: {
  placeholder: string;
  onCommit: (v: string) => void;
  onClose?: () => void;
  onArrowDown?: () => void;
}) {
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div className="uml-node__row uml-node__add-row">
      <span className="uml-node__vis">+</span>
      <input
        ref={ref}
        className="uml-inline-input uml-inline-add"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft.trim()) onCommit(draft); else onCommit(''); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onCommit(draft); }
          if (e.key === 'Escape') { onCommit(''); }
          if (e.key === 'ArrowUp') { e.preventDefault(); onCommit(''); if (onClose) onClose(); }
          if (e.key === 'ArrowDown' && onArrowDown) { e.preventDefault(); onCommit(''); onArrowDown(); }
        }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export function UmlNodeCard({ id, data, selected }: NodeProps<UmlNode>) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<'fields' | 'methods' | 'enum' | null>(null);
  const { setNodes } = useReactFlow();

  const update = (patch: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
  };

  const cycleVisibility = (current: UmlVisibility): UmlVisibility => {
    const idx = VIS_ORDER.indexOf(current);
    return VIS_ORDER[(idx + 1) % VIS_ORDER.length];
  };

  const removeField = (idx: number) => {
    update({ fields: data.fields.filter((_, i) => i !== idx) });
    setEditing(null);
  };

  const removeMethod = (idx: number) => {
    update({ methods: data.methods.filter((_, i) => i !== idx) });
    setEditing(null);
  };

  const removeEnumValue = (idx: number) => {
    update({ enumValues: (data.enumValues ?? []).filter((_, i) => i !== idx) });
    setEditing(null);
  };

  const commitField = (idx: number, v: string) => {
    const [name, type] = v.split(':');
    const fields = [...data.fields];
    fields[idx] = { ...fields[idx], name: name?.trim() || fields[idx].name, type: type?.trim() || fields[idx].type };
    update({ fields });
    setEditing(null);
  };

  const commitMethod = (idx: number, v: string) => {
    const match = v.match(/^(.*?)\(\)\s*:\s*(.+)$/);
    const name = match?.[1]?.trim() || data.methods[idx].name;
    const type = match?.[2]?.trim() || data.methods[idx].type;
    const methods = [...data.methods];
    methods[idx] = { ...methods[idx], name, type };
    update({ methods });
    setEditing(null);
  };

  const fieldCount = data.fields.length;
  const methodCount = data.methods.length;

  const navDown = (current: string | null) => {
    if (current === 'name') {
      if (fieldCount > 0) setEditing('field-0');
      else if (methodCount > 0) setEditing('method-0');
      return;
    }
    if (current?.startsWith('field-')) {
      const idx = parseInt(current.split('-')[1]);
      if (idx < fieldCount - 1) setEditing(`field-${idx + 1}`);
      else setAdding('fields');
      return;
    }
    if (current?.startsWith('method-')) {
      const idx = parseInt(current.split('-')[1]);
      if (idx < methodCount - 1) setEditing(`method-${idx + 1}`);
      else setAdding('methods');
    }
  };

  const navUp = (current: string | null) => {
    if (current?.startsWith('method-')) {
      const idx = parseInt(current.split('-')[1]);
      if (idx > 0) setEditing(`method-${idx - 1}`);
      else if (fieldCount > 0) setEditing(`field-${fieldCount - 1}`);
      else setEditing('name');
      return;
    }
    if (current?.startsWith('field-')) {
      const idx = parseInt(current.split('-')[1]);
      if (idx > 0) setEditing(`field-${idx - 1}`);
      else setEditing('name');
    }
  };

  return (
    <div
      className={`uml-node ${selected ? 'selected' : ''}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!editing && !adding) setEditing('name');
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div className="uml-node__header">
        <span>{`<<${stereotype[data.kind]}>>`}</span>
        {editing === 'name' ? (
          <InlineEdit
            className="uml-inline-name"
            value={data.name}
            onArrowDown={() => navDown('name')}
            onEnter={() => navDown('name')}
            onCommit={(v) => { update({ name: v || data.name }); setEditing(null); }}
          />
        ) : (
          <strong
            className="uml-node__editable"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); setEditing('name'); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); setEditing('name'); }
              if (e.key === 'ArrowDown') { e.preventDefault(); navDown('name'); }
            }}
          >
            {data.name}
          </strong>
        )}
      </div>

      {data.kind === 'enum' ? (
        <div className="uml-node__section">
          {(data.enumValues?.length ? data.enumValues : []).map((value, idx) => (
            <div key={idx} className="uml-node__row">
              {editing === `enum-${idx}` ? (
                <InlineEdit
                  value={value}
                  onArrowUp={idx > 0 ? () => setEditing(`enum-${idx - 1}`) : undefined}
                  onArrowDown={idx < (data.enumValues?.length ?? 0) - 1
                    ? () => setEditing(`enum-${idx + 1}`)
                    : () => setAdding('enum')}
                  onEnter={idx < (data.enumValues?.length ?? 0) - 1
                    ? () => setEditing(`enum-${idx + 1}`)
                    : () => setAdding('enum')}
                  onCommit={(v) => {
                    const enumValues = [...(data.enumValues ?? [])];
                    enumValues[idx] = (v || value).toUpperCase();
                    update({ enumValues });
                    setEditing(null);
                  }}
                />
              ) : (
                <span
                  className="uml-node__editable"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setEditing(`enum-${idx}`); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); setEditing(`enum-${idx}`); }
                    if (e.key === 'ArrowUp' && idx > 0) { e.preventDefault(); setEditing(`enum-${idx - 1}`); }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      if (idx < (data.enumValues?.length ?? 0) - 1) setEditing(`enum-${idx + 1}`);
                      else setAdding('enum');
                    }
                  }}
                >
                  {value}
                </span>
              )}
              {editing === `enum-${idx}` && (
                <button className="uml-node__remove" onClick={() => removeEnumValue(idx)}>-</button>
              )}
            </div>
          ))}
          {adding === 'enum' ? (
            <AddRow
              placeholder="New value"
              onClose={() => {
                const ev = data.enumValues ?? [];
                if (ev.length > 0) setEditing(`enum-${ev.length - 1}`);
              }}
              onCommit={(v) => {
                if (v.trim()) {
                  const enumValues = [...(data.enumValues ?? []), v.trim().toUpperCase()];
                  update({ enumValues });
                }
                setAdding(null);
              }}
            />
          ) : (
            <div className="uml-node__row uml-node__placeholder" onClick={() => setAdding('enum')}>
              <span className="uml-node__vis">+</span>
              <span className="uml-node__add-hint">value</span>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="uml-node__section">
            {data.fields.map((field, idx) => (
              <div key={field.id} className="uml-node__row">
                <span
                  className="uml-node__vis"
                  onClick={(e) => {
                    e.stopPropagation();
                    const fields = [...data.fields];
                    fields[idx] = { ...field, visibility: cycleVisibility(field.visibility) };
                    update({ fields });
                  }}
                >
                  {visibilitySymbol[field.visibility]}
                </span>
                {editing === `field-${idx}` ? (
                  <InlineEdit
                    value={`${field.name}: ${field.type}`}
                    onArrowUp={() => navUp(`field-${idx}`)}
                    onArrowDown={() => navDown(`field-${idx}`)}
                    onEnter={() => navDown(`field-${idx}`)}
                    onCommit={(v) => commitField(idx, v)}
                  />
                ) : (
                  <span
                    className="uml-node__editable"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setEditing(`field-${idx}`); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); setEditing(`field-${idx}`); }
                      if (e.key === 'ArrowUp') { e.preventDefault(); navUp(`field-${idx}`); }
                      if (e.key === 'ArrowDown') { e.preventDefault(); navDown(`field-${idx}`); }
                    }}
                  >
                    {field.name}: {field.type}
                  </span>
                )}
                {editing === `field-${idx}` && (
                  <button className="uml-node__remove" onClick={() => removeField(idx)}>-</button>
                )}
              </div>
            ))}
            {adding === 'fields' ? (
              <AddRow
                placeholder="name: Type"
                onClose={() => { if (fieldCount > 0) setEditing(`field-${fieldCount - 1}`); else setEditing('name'); }}
                onArrowDown={() => { setAdding(null); if (methodCount > 0) setEditing('method-0'); }}
                onCommit={(v) => {
                  if (v.trim()) {
                    const [name, type] = v.split(':');
                    update({ fields: [...data.fields, createMember(name?.trim() || 'field', type?.trim() || 'String')] });
                  }
                  setAdding(null);
                }}
              />
            ) : (
              <div className="uml-node__row uml-node__placeholder" onClick={() => setAdding('fields')}>
                <span className="uml-node__vis">+</span>
                <span className="uml-node__add-hint">field</span>
              </div>
            )}
          </div>
          <div className="uml-node__section">
            {data.methods.map((method, idx) => (
              <div key={method.id} className="uml-node__row">
                <span
                  className="uml-node__vis"
                  onClick={(e) => {
                    e.stopPropagation();
                    const methods = [...data.methods];
                    methods[idx] = { ...method, visibility: cycleVisibility(method.visibility) };
                    update({ methods });
                  }}
                >
                  {visibilitySymbol[method.visibility]}
                </span>
                {editing === `method-${idx}` ? (
                  <InlineEdit
                    value={`${method.name}(): ${method.type}`}
                    onArrowUp={() => navUp(`method-${idx}`)}
                    onArrowDown={() => navDown(`method-${idx}`)}
                    onEnter={() => navDown(`method-${idx}`)}
                    onCommit={(v) => commitMethod(idx, v)}
                  />
                ) : (
                  <span
                    className="uml-node__editable"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setEditing(`method-${idx}`); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); setEditing(`method-${idx}`); }
                      if (e.key === 'ArrowUp') { e.preventDefault(); navUp(`method-${idx}`); }
                      if (e.key === 'ArrowDown') { e.preventDefault(); navDown(`method-${idx}`); }
                    }}
                  >
                    {method.name}(): {method.type}
                  </span>
                )}
                {editing === `method-${idx}` && (
                  <button className="uml-node__remove" onClick={() => removeMethod(idx)}>-</button>
                )}
              </div>
            ))}
            {adding === 'methods' ? (
              <AddRow
                placeholder="name(): ReturnType"
                onClose={() => { if (methodCount > 0) setEditing(`method-${methodCount - 1}`); else if (fieldCount > 0) setEditing(`field-${fieldCount - 1}`); else setEditing('name'); }}
                onArrowDown={() => setAdding(null)}
                onCommit={(v) => {
                  if (v.trim()) {
                    const match = v.match(/^(.*?)\(\)\s*:\s*(.+)$/);
                    const name = match?.[1]?.trim() || 'method';
                    const type = match?.[2]?.trim() || 'void';
                    update({ methods: [...data.methods, createMember(name, type, 'public')] });
                  }
                  setAdding(null);
                }}
              />
            ) : (
              <div className="uml-node__row uml-node__placeholder" onClick={() => setAdding('methods')}>
                <span className="uml-node__vis">+</span>
                <span className="uml-node__add-hint">method</span>
              </div>
            )}
          </div>
        </>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
