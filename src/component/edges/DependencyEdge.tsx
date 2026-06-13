import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

export function DependencyEdge(props: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
    borderRadius: 8,
  });

  const markerId = `dependency-${props.id}`;

  return (
    <>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 16 16"
          refX="16"
          refY="8"
          markerWidth="12"
          markerHeight="12"
          orient="auto-start-reverse"
        >
          <path d="M 0 2 L 12 8 L 0 14" fill="none" stroke="#64748b" strokeWidth="1.5" />
        </marker>
      </defs>
      <BaseEdge
        path={edgePath}
        markerEnd={`url(#${markerId})`}
        style={{ stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '5 3' }}
      />
    </>
  );
}
