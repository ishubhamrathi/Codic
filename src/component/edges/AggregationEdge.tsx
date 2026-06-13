import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

export function AggregationEdge(props: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
    borderRadius: 8,
  });

  const markerId = `aggregation-${props.id}`;

  return (
    <>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 16 16"
          refX="16"
          refY="8"
          markerWidth="14"
          markerHeight="14"
          orient="auto-start-reverse"
        >
          <path d="M 0 8 L 8 0 L 16 8 L 8 16 Z" fill="#fff" stroke="#64748b" strokeWidth="1.5" />
        </marker>
      </defs>
      <BaseEdge
        path={edgePath}
        markerEnd={`url(#${markerId})`}
        style={{ stroke: '#64748b', strokeWidth: 1.5 }}
      />
    </>
  );
}
