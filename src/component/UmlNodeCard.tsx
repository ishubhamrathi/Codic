import { useState, useRef, useEffect } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { visibilitySymbol, createMember } from '../lib/umlFactory';
import type { UmlNode, UmlVisibility } from '../types/uml';

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

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      className={`uml-inline-input ${className ?? ''}`}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommit(draft);
          if (onEnter) onEnter();
        }
        if (e.key === 'Escape') onCommit(value);
        if (e.key === 'ArrowUp' && onArrowUp) { e.preventDefault(); onCommit(draft); onArrowUp(); }
        if (e.key === 'ArrowDown' && onArrowDown) { e.preventDefault(); onCommit(draft); onArrowDown(); }
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}

function AddRow({
  placeholder,
  onCommit,
}: {
  placeholder: string;
  onCommit: (v: string) => void;
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
          if (e.key === 'Escape') onCommit('');
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

  const fieldCount = data.fields.length;
  const methodCount = data.methods.length;
  const enumCount = (data.enumValues ?? []).length;

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

  const commitEnum = (idx: number, v: string) => {
    const enumValues = [...(data.enumValues ?? [])];
    enumValues[idx] = (v || value).toUpperCase();
    update({ enumValues });
    setEditing(null);
  };

  return (
    <div
      className={`uml-node ${selected ? 'selected' : ''}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!editing) setEditing('name');
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div className="uml-node__header">
        <span>{`<<${stereotype[data.kind]}>>`}</span>
        {editing === 'name' ? (
          <InlineEdit
            className="uml-inline-name"
            value={data.name}
            onCommit={(v) => { update({ name: v || data.name }); setEditing(null); }}
          />
        ) : (
          <strong>{data.name}</strong>
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
                  onArrowDown={idx < enumCount - 1
                    ? () => setEditing(`enum-${idx + 1}`)
                    : () => setAdding('enum')}
                  onEnter={idx < enumCount - 1
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
                  onClick={(e) => { e.stopPropagation(); setEditing(`enum-${idx}`); }}
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
                    onArrowUp={idx > 0 ? () => setEditing(`field-${idx - 1}`) : undefined}
                    onArrowDown={idx < fieldCount - 1
                      ? () => setEditing(`field-${idx + 1}`)
                      : () => setAdding('fields')}
                    onEnter={idx < fieldCount - 1
                      ? () => setEditing(`field-${idx + 1}`)
                      : () => setAdding('fields')}
                    onCommit={(v) => commitField(idx, v)}
                  />
                ) : (
                  <span
                    className="uml-node__editable"
                    onClick={(e) => { e.stopPropagation(); setEditing(`field-${idx}`); }}
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
                    onArrowUp={idx > 0 ? () => setEditing(`method-${idx - 1}`) : undefined}
                    onArrowDown={idx < methodCount - 1
                      ? () => setEditing(`method-${idx + 1}`)
                      : () => setAdding('methods')}
                    onEnter={idx < methodCount - 1
                      ? () => setEditing(`method-${idx + 1}`)
                      : () => setAdding('methods')}
                    onCommit={(v) => commitMethod(idx, v)}
                  />
                ) : (
                  <span
                    className="uml-node__editable"
                    onClick={(e) => { e.stopPropagation(); setEditing(`method-${idx}`); }}
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
