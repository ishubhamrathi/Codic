import { useCallback, useRef } from 'react';
import {
    Background,
    ReactFlow,
    useNodesState,
    useEdgesState,
    addEdge,
    useReactFlow,
    ReactFlowProvider,
    type Connection,
    type Edge,
    type Node,
    type OnConnectEnd,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

const initialNodes: Node[] = [
    {
        id: '0',
        type: 'input',
        data: { label: 'Node' },
        position: { x: 0, y: 50 },
    },
];

let id = 1;
const getId = () => `${id++}`;
const nodeOrigin: [number, number] = [0.5, 0];

const AddNodeOnEdgeDrop = () => {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const { screenToFlowPosition } = useReactFlow();
    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [],
    );

    const onConnectEnd: OnConnectEnd = useCallback(
        (event: MouseEvent | TouchEvent, connectionState: any) => {
            if (!connectionState.isValid) {
                const nodeId = getId();
                const { clientX, clientY } =
                    'changedTouches' in event ? event.changedTouches[0] : event;
                const newNode: Node = {
                    id: nodeId,
                    type: 'input',
                    position: screenToFlowPosition({
                        x: clientX,
                        y: clientY,
                    }),
                    data: { label: `Node ${nodeId}` },
                };

                setNodes((nds) => nds.concat(newNode));
                setEdges((eds) =>
                    eds.concat({ id: nodeId, source: connectionState.fromNode!.id, target: nodeId }),
                );
            }
        },
        [screenToFlowPosition],
    );

    return (
        <div className="wrapper" ref={reactFlowWrapper}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectEnd={onConnectEnd}
                fitView
                fitViewOptions={{ padding: 2 }}
                nodeOrigin={nodeOrigin}
            >
                <Background />
            </ReactFlow>
        </div>
    );
};

export default () => (
    <ReactFlowProvider>
        <AddNodeOnEdgeDrop />
    </ReactFlowProvider>
);
