import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
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
import { Code2, Download, MousePointer2, Save, Shapes, Sparkles } from 'lucide-react';
import { generateJavaCode } from './lib/codegen/java';
import { parseTextToNodes } from './lib/codegen/parser';
import { createMember, createUmlNode } from './lib/umlFactory';
import { isSupabaseConfigured, saveDiagram, loadUserProjects, loadUserTheme, saveUserTheme } from './lib/supabase';
import { AuthProvider } from './lib/AuthContext';
import { useAuth } from './lib/useAuth';
import { UmlNodeCard } from './component/UmlNodeCard';
import { AuthPage } from './component/Auth';
import { ProjectExplorer } from './component/ProjectExplorer';
import type { DiagramSnapshot, UmlEdge, UmlNode, UmlNodeData, UmlNodeKind, UmlRelationKind } from './types/uml';
import { InheritanceEdge } from './component/edges/InheritanceEdge';
import { CompositionEdge } from './component/edges/CompositionEdge';

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
const edgeTypes = { inheritance: InheritanceEdge, composition: CompositionEdge };
const relationOptions: UmlRelationKind[] = [
  'association',
  'aggregation',
  'composition',
  'inheritance',
  'implementation',
  'dependency',
];

function ExplorerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h4l2 2h6" />
      <rect x="2" y="4" width="12" height="9" rx="1.5" />
    </svg>
  );
}

function ProfileIcon({ initials }: { initials: string }) {
  return (
    <div className="activity-avatar">
      {initials}
    </div>
  );
}

function InspectorChevron({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s ease', flexShrink: 0 }}>
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

function Editor() {
  const { user, signOut } = useAuth();
  const [projectId, setProjectId] = useState<string>(crypto.randomUUID());
  const [projectFolderId, setProjectFolderId] = useState<string | undefined>(undefined);
  const [projectName, setProjectName] = useState('Untitled UML Project');
  const [nodes, setNodes, onNodesChange] = useNodesState<UmlNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<UmlEdge>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(initialNodes[0].id);
  const [selectedRelation, setSelectedRelation] = useState<UmlRelationKind>('association');
  const [textInput, setTextInput] = useState('class Order {\n- id: Long\n- total: BigDecimal\n+ calculateTotal(): BigDecimal\n}');
  const [status, setStatus] = useState('Local draft ready');
  const [recentProjectId, setRecentProjectId] = useState<string | undefined>();
  const [activePanel, setActivePanel] = useState<'explorer' | 'profile' | null>('explorer');
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [explorerRefreshKey, setExplorerRefreshKey] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [inspectorCollapsed, setInspectorCollapsed] = useState<Record<string, boolean>>({
    inspector: false,
    textToVisual: false,
    code: true,
    nodes: false,
    relations: false,
  });
  const { screenToFlowPosition } = useReactFlow();

  const toggleInspectorSection = (key: string) => {
    setInspectorCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const startRelation = () => {
    if (!selectedNodeId) return;
    const targetId = prompt('Target node ID:');
    if (!targetId || targetId === selectedNodeId) return;
    const targetNode = nodes.find((n) => n.id === targetId);
    if (!targetNode) return;
    const edgeType = (selectedRelation === 'inheritance' || selectedRelation === 'composition')
      ? selectedRelation
      : 'smoothstep';
    setEdges((current) =>
      addEdge(
        {
          id: `e-${selectedNodeId}-${targetId}`,
          source: selectedNodeId,
          target: targetId,
          type: edgeType as any,
          label: selectedRelation,
          data: { relation: selectedRelation, label: selectedRelation },
        },
        current,
      ),
    );
    setStatus(`Relation: ${selectedRelation} added`);
  };

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const generatedCode = useMemo(() => generateJavaCode(nodes, edges), [nodes, edges]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured) return;
      const projects = await loadUserProjects();
      if (cancelled) return;
      if (projects.length > 0) {
        const latest = projects[0];
        setProjectId(latest.id ?? crypto.randomUUID());
        setProjectFolderId(latest.folderId);
        setProjectName(latest.name);
        setNodes(latest.nodes);
        setEdges(latest.edges);
        setSelectedNodeId(latest.nodes[0]?.id);
        setRecentProjectId(latest.id);
      } else {
        const saved = await saveDiagram({
          id: crypto.randomUUID(),
          name: projectName,
          nodes,
          edges,
          updatedAt: new Date().toISOString(),
        });
        setProjectId(saved.id);
        setRecentProjectId(saved.id);
        setExplorerRefreshKey((k) => k + 1);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadUserTheme();
      if (!cancelled) {
        setTheme(saved);
        document.documentElement.setAttribute('data-theme', saved);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleTheme = async () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    await saveUserTheme(next);
  };

  const userDisplayName = user?.user_metadata?.display_name
    || user?.email?.split('@')[0]
    || 'User';
  const userInitials = userDisplayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const onConnect = useCallback(
    (connection: Connection) => {
      const edgeType = (selectedRelation === 'inheritance' || selectedRelation === 'composition')
        ? selectedRelation
        : 'smoothstep';
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            type: edgeType as any,
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
      folderId: projectFolderId,
      name: projectName,
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    });
    setProjectId(saved.id);
    setRecentProjectId(saved.id);
    setExplorerRefreshKey((k) => k + 1);
    setStatus(isSupabaseConfigured ? 'Saved to Supabase' : 'Saved to browser storage');
  };

  const loadProject = (project: DiagramSnapshot) => {
    setProjectId(project.id ?? crypto.randomUUID());
    setProjectFolderId(project.folderId);
    setProjectName(project.name);
    setNodes(project.nodes);
    setEdges(project.edges);
    setSelectedNodeId(project.nodes[0]?.id);
    setRecentProjectId(project.id);
    setStatus('Loaded project');
  };

  const handleCreateProject = async (folderId?: string) => {
    const name = prompt('Project name:');
    if (!name) return;
    const id = crypto.randomUUID();
    setProjectId(id);
    setProjectFolderId(folderId);
    setProjectName(name);
    setNodes([]);
    setEdges([]);
    setStatus('New project created');
    await saveDiagram({
      id,
      folderId,
      name,
      nodes: [],
      edges: [],
      updatedAt: new Date().toISOString(),
    });
    setExplorerRefreshKey((k) => k + 1);
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
      folderId: projectFolderId,
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
    <main className="app-layout">
      {/* Activity Bar - leftmost narrow strip */}
      <div className="activity-bar">
        <div className="activity-bar-top">
          <button
            className={`activity-btn ${activePanel === 'explorer' ? 'active' : ''}`}
            onClick={() => setActivePanel(activePanel === 'explorer' ? null : 'explorer')}
            title="Explorer"
          >
            <ExplorerIcon />
          </button>
        </div>
        <div className="activity-bar-bottom">
          <button
            className={`activity-btn ${activePanel === 'profile' ? 'active' : ''}`}
            onClick={() => setActivePanel(activePanel === 'profile' ? null : 'profile')}
            title={userDisplayName}
          >
            <ProfileIcon initials={userInitials} />
          </button>
        </div>
      </div>

      {/* Side Panel */}
      {activePanel && (
        <div className="side-panel">
          {activePanel === 'explorer' && (
            <ProjectExplorer
              onLoadProject={loadProject}
              onCreateProject={handleCreateProject}
              currentProjectId={projectId}
              recentProjectId={recentProjectId}
              refreshKey={explorerRefreshKey}
            />
          )}
          {activePanel === 'profile' && (
            <div className="panel-profile">
              <div className="panel-profile-header">
                <span>Account</span>
              </div>
              <div className="panel-profile-body">
                <div className="panel-profile-avatar">{userInitials}</div>
                <div className="panel-profile-name">{userDisplayName}</div>
                <div className="panel-profile-email">{user?.email ?? 'No email'}</div>
                <div className="panel-profile-meta">
                  <span className="panel-profile-badge">Authenticated</span>
                </div>
                <div className="panel-profile-theme">
                  <span>Theme</span>
                  <button
                    className={`theme-toggle ${theme === 'dark' ? 'theme-toggle--dark' : ''}`}
                    onClick={toggleTheme}
                    title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                  >
                    <span className="theme-toggle__knob" />
                  </button>
                </div>
                <button className="panel-profile-signout" onClick={signOut}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6" />
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Workspace */}
      <section className="workspace">
        <div className="topbar">
          <div className="topbar-left">
            <div className="brand-mini">
              <Shapes size={16} />
              <span>Codic</span>
            </div>
          </div>
          <div className="topbar-right">
            <span className="topbar-status">{nodes.length} nodes · {edges.length} relations</span>
            <button className="topbar-btn" onClick={saveCurrentDiagram} title="Save">
              <Save size={14} />
            </button>
            <span className="topbar-dot">{status}</span>
          </div>
        </div>
        <div className="canvas" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
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

      {/* Inspector */}
      <aside className={`inspector ${inspectorOpen ? '' : 'inspector--collapsed'}`}>
        <button className="inspector-toggle" onClick={() => setInspectorOpen(!inspectorOpen)} title={inspectorOpen ? 'Collapse inspector' : 'Expand inspector'}>
          <InspectorChevron open={inspectorOpen} />
        </button>
        {inspectorOpen && (<>
        <section>
          <label className="inspector-section-header" onClick={() => toggleInspectorSection('inspector')}>
            <InspectorChevron open={!inspectorCollapsed.inspector} /> Inspector
          </label>
          {!inspectorCollapsed.inspector && (
            selectedNode ? (
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
            )
          )}
        </section>

        <section>
          <label className="inspector-section-header" onClick={() => toggleInspectorSection('textToVisual')}>
            <InspectorChevron open={!inspectorCollapsed.textToVisual} />
            <Sparkles size={14} /> Text to Visual
          </label>
          {!inspectorCollapsed.textToVisual && (
            <>
              <textarea value={textInput} onChange={(event) => setTextInput(event.target.value)} rows={6} />
              <button onClick={importText}>Generate nodes</button>
            </>
          )}
        </section>

        <section className="code-panel">
          <label className="inspector-section-header" onClick={() => toggleInspectorSection('code')}>
            <InspectorChevron open={!inspectorCollapsed.code} />
            <Code2 size={14} /> Java Code
          </label>
          {!inspectorCollapsed.code && (
            <>
              <pre>{generatedCode}</pre>
              <button onClick={() => navigator.clipboard.writeText(generatedCode)}>
                <Download size={14} /> Copy
              </button>
              <button onClick={exportJson}>Export JSON</button>
            </>
          )}
        </section>

        <section>
          <label className="inspector-section-header" onClick={() => toggleInspectorSection('nodes')}>
            <InspectorChevron open={!inspectorCollapsed.nodes} /> Nodes
          </label>
          {!inspectorCollapsed.nodes && (
            <>
              {(['class', 'abstract', 'interface', 'enum'] as UmlNodeKind[]).map((kind) => (
                <button className="palette-item" draggable key={kind} onDragStart={(event) => onDragStart(event, kind)}>
                  <MousePointer2 size={14} />
                  {kind}
                </button>
              ))}
            </>
          )}
        </section>

        <section>
          <label className="inspector-section-header" onClick={() => toggleInspectorSection('relations')}>
            <InspectorChevron open={!inspectorCollapsed.relations} /> Relation
          </label>
          {!inspectorCollapsed.relations && (
            <>
              {relationOptions.map((rel) => (
                <button
                  key={rel}
                  className={`palette-item ${selectedRelation === rel ? 'palette-item--active' : ''}`}
                  onClick={() => setSelectedRelation(rel)}
                >
                  <MousePointer2 size={14} />
                  {rel}
                </button>
              ))}
              {selectedRelation && selectedNodeId && (
                <button onClick={startRelation}>Link selected to…</button>
              )}
            </>
          )}
        </section>
        </>)}
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
      <div className="loading-screen">
        <p>Loading...</p>
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
