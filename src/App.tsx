import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
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
import { Code2, Download, MousePointer2, Save, Shapes, Sparkles, LayoutGrid } from 'lucide-react';
import { generateJavaCode } from './lib/codegen/java';
import { parseTextToNodes } from './lib/codegen/parser';
import { createMember, createUmlNode } from './lib/umlFactory';
import { isSupabaseConfigured, saveDiagram, loadUserProjects, loadFolders, loadUserTheme, saveUserTheme, type FolderData } from './lib/supabase';
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

function nodeHeight(d: UmlNodeData): number {
  const header = 52;
  const rowH = 24;
  const sectionPad = 20;
  if (d.kind === 'enum') {
    const count = d.enumValues?.length ?? 0;
    return header + sectionPad + Math.max(count, 1) * rowH + 14;
  }
  const fieldRows = Math.max(d.fields.length, 1);
  const methodRows = Math.max(d.methods.length, 1);
  return header + sectionPad + fieldRows * rowH + sectionPad + methodRows * rowH + 14;
}

function nodeWidth(d: UmlNodeData): number {
  let maxLen = d.name.length;
  if (d.kind === 'enum') {
    for (const v of d.enumValues ?? []) maxLen = Math.max(maxLen, v.length);
  } else {
    for (const f of d.fields) maxLen = Math.max(maxLen, `${f.name}: ${f.type}`.length);
    for (const m of d.methods) maxLen = Math.max(maxLen, `${m.name}(): ${m.type}`.length);
  }
  return Math.max(160, Math.min(360, maxLen * 7.5 + 48));
}

function autoArrange(nodes: UmlNode[], edges: UmlEdge[]): UmlNode[] {
  if (nodes.length === 0) return nodes;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, Set<string>>();
  const parents = new Map<string, Set<string>>();

  nodes.forEach((n) => {
    children.set(n.id, new Set());
    parents.set(n.id, new Set());
  });

  edges.forEach((e) => {
    if (nodeMap.has(e.source) && nodeMap.has(e.target)) {
      children.get(e.source)!.add(e.target);
      parents.get(e.target)!.add(e.source);
    }
  });

  const roots = nodes.filter((n) => parents.get(n.id)!.size === 0);
  const visited = new Set<string>();
  const levels: string[][] = [];

  function bfs(startIds: string[]) {
    let queue = startIds;
    while (queue.length > 0) {
      levels.push([...queue]);
      const next: string[] = [];
      for (const id of queue) {
        visited.add(id);
        for (const child of children.get(id) ?? []) {
          if (!visited.has(child)) {
            next.push(child);
          }
        }
      }
      queue = next;
    }
  }

  bfs(roots.map((n) => n.id));

  const unvisited = nodes.filter((n) => !visited.has(n.id));
  if (unvisited.length > 0) {
    bfs(unvisited.map((n) => n.id));
  }

  const GAP_X = 60;
  const GAP_Y = 80;

  const arranged = new Map<string, { x: number; y: number }>();

  let currentY = 0;

  levels.forEach((level) => {
    let levelMaxH = 0;
    let totalW = 0;

    const widths = level.map((id) => {
      const d = nodeMap.get(id)!.data;
      const w = nodeWidth(d);
      totalW += w;
      return w;
    });

    totalW += (level.length - 1) * GAP_X;
    let x = -totalW / 2;

    level.forEach((id, posIdx) => {
      const d = nodeMap.get(id)!.data;
      const w = widths[posIdx];
      const h = nodeHeight(d);
      if (h > levelMaxH) levelMaxH = h;

      arranged.set(id, { x, y: currentY });
      x += w + GAP_X;
    });

    currentY += levelMaxH + GAP_Y;
  });

  return nodes.map((n) => {
    const pos = arranged.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });
}

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

function SidePanelToggle({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 0.2s ease', transform: open ? 'rotate(0)' : 'rotate(180deg)' }}>
      <rect x="1" y="2" width="14" height="12" rx="2" />
      <path d="M10 2v12" />
    </svg>
  );
}

function Editor() {
  const { user, signOut } = useAuth();
  const [dataLoading, setDataLoading] = useState(true);
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
  const [, setAllProjects] = useState<DiagramSnapshot[]>([]);
  const [, setAllFolders] = useState<FolderData[]>([]);
  const [, setThemeLoaded] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('uml:theme') as 'light' | 'dark' | null;
    const initial = saved || 'light';
    document.documentElement.setAttribute('data-theme', initial);
    return initial;
  });
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
      try {
        if (!isSupabaseConfigured) return;
        const [projects, folders] = await Promise.all([loadUserProjects(), loadFolders()]);
        if (cancelled) return;
        setAllProjects(projects);
        setAllFolders(folders);
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
      } finally {
        if (!cancelled) setDataLoading(false);
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
        localStorage.setItem('uml:theme', saved);
      }
      if (!cancelled) setThemeLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(true);

  useEffect(() => {
    if (skipSave.current) { skipSave.current = false; return; }
    if (!isSupabaseConfigured) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await saveDiagram({
          id: projectId,
          folderId: projectFolderId,
          name: projectName,
          nodes,
          edges,
          updatedAt: new Date().toISOString(),
        });
        setStatus('Auto-saved');
      } catch (e) {
        console.warn('Auto-save failed:', e);
        setStatus('Auto-save failed');
      }
    }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [nodes, edges, projectName]);

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
    setStatus(isSupabaseConfigured ? 'Saved to Cloud' : 'Saved to browser storage');
  };

  const handleAutoArrange = () => {
    const arranged = autoArrange(nodes, edges);
    setNodes(arranged);
    setStatus('Auto-arranged nodes');
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

  if (dataLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading diagram...</p>
      </div>
    );
  }

  return (
    <main className={`app-layout ${!activePanel ? 'no-side-panel' : ''} ${!inspectorOpen ? 'inspector-collapsed' : ''}`}>
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
      <div className={`side-panel ${!activePanel ? 'side-panel--hidden' : ''}`}>
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
                  <span>Dark Mode</span>
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
            <button className="topbar-btn" onClick={handleAutoArrange} title="Auto arrange">
              <LayoutGrid size={14} />
            </button>
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
          <SidePanelToggle open={inspectorOpen} />
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
