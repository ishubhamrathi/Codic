import { useCallback, useMemo, useState, type DragEvent } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Code2, Database, Download, LogOut, MousePointer2, Save, Shapes, Sparkles } from 'lucide-react';
import { generateJavaCode } from './lib/codegen/java';
import { parseTextToNodes } from './lib/codegen/parser';
import { createMember, createUmlNode } from './lib/umlFactory';
import { isSupabaseConfigured, loadUserProjects, saveDiagram } from './lib/supabase';
import { AuthProvider } from './lib/AuthContext';
import { useAuth } from './lib/useAuth';
import { UmlNodeCard } from './component/UmlNodeCard';
import { AuthPage } from './component/Auth';
import type { DiagramSnapshot, UmlEdge, UmlNode, UmlNodeData, UmlNodeKind, UmlRelationKind } from './types/uml';

const initialNodes: UmlNode[] = [
  {
    id: 'class-user',
    type: 'umlNode',
    position: { x: 120, y: 120 },
    data: {
      kind: 'class',
      name: 'User',
      fields: [createMember('id', 'Long'), createMember('email', 'String')],
      methods: [createMember('getEmail', 'String', 'public')],
    },
  },
  {
    id: 'interface-auth',
    type: 'umlNode',
    position: { x: 460, y: 130 },
    data: {
      kind: 'interface',
      name: 'Authenticatable',
      fields: [],
      methods: [createMember('authenticate', 'boolean', 'public')],
    },
  },
];

const initialEdges: UmlEdge[] = [
  {
    id: 'edge-user-auth',
    source: 'class-user',
    target: 'interface-auth',
    type: 'smoothstep',
    label: 'implements',
    data: { relation: 'implementation', label: 'implements' },
  },
];

const nodeTypes = { umlNode: UmlNodeCard };
const relationOptions: UmlRelationKind[] = [
  'association',
  'aggregation',
  'composition',
  'inheritance',
  'implementation',
  'dependency',
];

function Editor() {
  const { user, signOut } = useAuth();
  const [projectId, setProjectId] = useState<string>();
  const [projectName, setProjectName] = useState('Untitled UML Project');
  const [nodes, setNodes, onNodesChange] = useNodesState<UmlNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<UmlEdge>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(initialNodes[0].id);
  const [selectedRelation, setSelectedRelation] = useState<UmlRelationKind>('association');
  const [textInput, setTextInput] = useState('class Order {\n- id: Long\n- total: BigDecimal\n+ calculateTotal(): BigDecimal\n}');
  const [status, setStatus] = useState('Local draft ready');
  const { screenToFlowPosition } = useReactFlow();

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const generatedCode = useMemo(() => generateJavaCode(nodes, edges), [nodes, edges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            label: selectedRelation,
            data: { relation: selectedRelation, label: selectedRelation },
          },
          current,
        ),
      );
    },
    [selectedRelation, setEdges],
  );

  const onDragStart = (event: DragEvent<HTMLButtonElement>, kind: UmlNodeKind) => {
    event.dataTransfer.setData('application/uml-node-kind', kind);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData('application/uml-node-kind') as UmlNodeKind;
    if (!kind) return;
    const newNode = createUmlNode(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }), nodes.length + 1);
    setNodes((current) => current.concat(newNode));
    setSelectedNodeId(newNode.id);
  };

  const updateSelectedNode = (patch: Partial<UmlNodeData>) => {
    if (!selectedNode) return;
    setNodes((current) =>
      current.map((node) => (node.id === selectedNode.id ? { ...node, data: { ...node.data, ...patch } } : node)),
    );
  };

  const saveCurrentDiagram = async () => {
    const saved = await saveDiagram({
      id: projectId,
      name: projectName,
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    });
    setProjectId(saved.id);
    setStatus(isSupabaseConfigured ? 'Saved to Supabase' : 'Saved to browser storage');
  };

  const loadSavedDiagram = async () => {
    try {
      const projects = await loadUserProjects();
      if (!projects.length) {
        setStatus('No saved projects found');
        return;
      }
      const local = projects[0];
      setProjectId(local.id);
      setProjectName(local.name);
      setNodes(local.nodes);
      setEdges(local.edges);
      setSelectedNodeId(local.nodes[0]?.id);
      setStatus('Loaded project');
    } catch {
      setStatus('Failed to load projects');
    }
  };

  const importText = () => {
    const imported = parseTextToNodes(textInput);
    if (!imported.length) return;
    setNodes((current) => current.concat(imported));
    setSelectedNodeId(imported[0].id);
    setStatus('Text converted to visual UML nodes');
  };

  const exportJson = () => {
    const snapshot: DiagramSnapshot = {
      id: projectId,
      name: projectName,
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    };
    navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    setStatus('Diagram JSON copied');
  };

  const handleNodesChange = (changes: NodeChange<UmlNode>[]) => {
    onNodesChange(changes);
  };

  const handleEdgesChange = (changes: EdgeChange<UmlEdge>[]) => {
    onEdgesChange(changes);
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Shapes size={22} />
          <div>
            <h1>UML Studio</h1>
            <p>Visual design to Java class code.</p>
          </div>
        </div>

        {user && (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label>{user.email}</label>
              <button onClick={signOut} style={{ padding: '4px 8px', minHeight: 'auto' }}>
                <LogOut size={14} />
              </button>
            </div>
          </section>
        )}

        <section>
          <label>Project</label>
          <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
          <div className="button-row">
            <button onClick={saveCurrentDiagram}>
              <Save size={16} /> Save
            </button>
            <button onClick={loadSavedDiagram}>
              <Database size={16} /> Load
            </button>
          </div>
          <p className="status">{status}</p>
        </section>

        <section>
          <label>Drop UML Nodes</label>
          {(['class', 'abstract', 'interface', 'enum'] as UmlNodeKind[]).map((kind) => (
            <button className="palette-item" draggable key={kind} onDragStart={(event) => onDragStart(event, kind)}>
              <MousePointer2 size={16} />
              {kind}
            </button>
          ))}
        </section>

        <section>
          <label>New Relation</label>
          <select value={selectedRelation} onChange={(event) => setSelectedRelation(event.target.value as UmlRelationKind)}>
            {relationOptions.map((relation) => (
              <option key={relation} value={relation}>
                {relation}
              </option>
            ))}
          </select>
        </section>
      </aside>

      <section className="workspace">
        <div className="topbar">
          <strong>Whiteboard</strong>
          <span>{nodes.length} nodes · {edges.length} relations</span>
        </div>
        <div className="canvas" onDrop={onDrop} onDragOver={(event) => event.preventDefault()}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            fitView
          >
            <Background />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </div>
      </section>

      <aside className="inspector">
        <section>
          <label>Inspector</label>
          {selectedNode ? (
            <>
              <input value={selectedNode.data.name} onChange={(event) => updateSelectedNode({ name: event.target.value })} />
              <select
                value={selectedNode.data.kind}
                onChange={(event) => updateSelectedNode({ kind: event.target.value as UmlNodeKind })}
              >
                <option value="class">Class</option>
                <option value="abstract">Abstract Class</option>
                <option value="interface">Interface</option>
                <option value="enum">Enum</option>
              </select>
              <textarea
                value={
                  selectedNode.data.kind === 'enum'
                    ? selectedNode.data.enumValues?.join('\n')
                    : selectedNode.data.fields.map((field) => `${field.name}: ${field.type}`).join('\n')
                }
                onChange={(event) =>
                  selectedNode.data.kind === 'enum'
                    ? updateSelectedNode({ enumValues: event.target.value.split('\n').filter(Boolean) })
                    : updateSelectedNode({
                        fields: event.target.value
                          .split('\n')
                          .filter(Boolean)
                          .map((line) => {
                            const [name, type] = line.split(':');
                            return createMember(name.trim(), type?.trim() || 'String');
                          }),
                      })
                }
                rows={5}
                placeholder="fieldName: Type"
              />
              {selectedNode.data.kind !== 'enum' && (
                <textarea
                  value={selectedNode.data.methods.map((method) => `${method.name}: ${method.type}`).join('\n')}
                  onChange={(event) =>
                    updateSelectedNode({
                      methods: event.target.value
                        .split('\n')
                        .filter(Boolean)
                        .map((line) => {
                          const [name, type] = line.split(':');
                          return createMember(name.trim(), type?.trim() || 'void', 'public');
                        }),
                    })
                  }
                  rows={5}
                  placeholder="methodName: ReturnType"
                />
              )}
            </>
          ) : (
            <p>Select a node to edit it.</p>
          )}
        </section>

        <section>
          <label>
            <Sparkles size={15} /> Text or Code to Visual
          </label>
          <textarea value={textInput} onChange={(event) => setTextInput(event.target.value)} rows={8} />
          <button onClick={importText}>Generate visual nodes</button>
        </section>

        <section className="code-panel">
          <label>
            <Code2 size={15} /> Java Code
          </label>
          <pre>{generatedCode}</pre>
          <button onClick={() => navigator.clipboard.writeText(generatedCode)}>
            <Download size={16} /> Copy Java
          </button>
          <button onClick={exportJson}>Copy Project JSON</button>
        </section>
      </aside>
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100svh',
        background: 'var(--bg)',
      }}>
        <p style={{ color: 'var(--muted)' }}>Loading...</p>
      </div>
    );
  }

  if (!user && isSupabaseConfigured) {
    return <AuthPage />;
  }

  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}
