import { Handle, Position, type NodeProps } from '@xyflow/react';
import { visibilitySymbol } from '../lib/umlFactory';
import type { UmlNode } from '../types/uml';

const stereotype = {
  class: 'class',
  abstract: 'abstract',
  interface: 'interface',
  enum: 'enum',
} as const;

export function UmlNodeCard({ data, selected }: NodeProps<UmlNode>) {
  return (
    <div className={`uml-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="uml-node__header">
        <span>{`<<${stereotype[data.kind]}>>`}</span>
        <strong>{data.name}</strong>
      </div>
      {data.kind === 'enum' ? (
        <div className="uml-node__section">
          {(data.enumValues?.length ? data.enumValues : ['VALUE']).map((value) => (
            <div key={value}>{value}</div>
          ))}
        </div>
      ) : (
        <>
          <div className="uml-node__section">
            {data.fields.length ? (
              data.fields.map((field) => (
                <div key={field.id}>
                  {visibilitySymbol[field.visibility]} {field.name}: {field.type}
                </div>
              ))
            ) : (
              <em>No fields</em>
            )}
          </div>
          <div className="uml-node__section">
            {data.methods.length ? (
              data.methods.map((method) => (
                <div key={method.id}>
                  {visibilitySymbol[method.visibility]} {method.name}(): {method.type}
                </div>
              ))
            ) : (
              <em>No methods</em>
            )}
          </div>
        </>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
