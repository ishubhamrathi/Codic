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
import { Code2, Download, MousePointer2, Save, Shapes, Sparkles, LayoutGrid, Pen, Keyboard } from 'lucide-react';
import { generateJavaCode } from './lib/codegen/java';
import { parseTextToNodes } from './lib/codegen/parser';
import { createMember, createUmlNode, createUmlZone } from './lib/umlFactory';
import { isSupabaseConfigured, saveDiagram, loadUserProjects, loadProjectById, loadFolders, loadUserTheme, saveUserTheme, loadLocalDiagram, type FolderData } from './lib/supabase';
import { AuthProvider } from './lib/AuthContext';
import { useAuth } from './lib/useAuth';
import { UmlNodeCard } from './component/UmlNodeCard';
import { UmlZoneNode } from './component/UmlZoneNode';
import { AuthPage } from './component/Auth';
import { ProjectExplorer } from './component/ProjectExplorer';
import { CreateProjectModal } from './component/CreateProjectModal';
import { FreeDrawCanvas } from './component/FreeDrawCanvas';
import { ExcalidrawCanvas } from './component/ExcalidrawCanvas';
import { InputModal } from './component/Dialogs';
import type { DiagramSnapshot, ProjectType, UmlEdge, UmlNode, UmlNodeData, UmlNodeKind, UmlRelationKind, UmlZone } from './types/uml';
import { InheritanceEdge } from './component/edges/InheritanceEdge';
import { CompositionEdge } from './component/edges/CompositionEdge';
import { ImplementationEdge } from './component/edges/ImplementationEdge';
import { AggregationEdge } from './component/edges/AggregationEdge';
import { AssociationEdge } from './component/edges/AssociationEdge';
import { DependencyEdge } from './component/edges/DependencyEdge';
import { ErrorBoundary } from './component/ErrorBoundary';

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
    type: 'implementation',
    data: { relation: 'implementation' },
  },
];

const nodeTypes = { umlNode: UmlNodeCard, umlZone: UmlZoneNode };
const edgeTypes = {
  inheritance: InheritanceEdge,
  composition: CompositionEdge,
  implementation: ImplementationEdge,
  aggregation: AggregationEdge,
  association: AssociationEdge,
  dependency: DependencyEdge,
};
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

type AnyNode = { id: string; parentId?: string; type?: string; position?: { x: number; y: number }; style?: Record<string, unknown>; data?: Record<string, unknown>; [k: string]: unknown };

function sortNodes(nodes: AnyNode[]): AnyNode[] {
  const sorted: AnyNode[] = [];
  const remaining = [...nodes];
  const added = new Set<string>();

  const addNode = (node: AnyNode) => {
    if (added.has(node.id)) return;
    if (node.parentId) {
      const parent = nodes.find((n) => n.id === node.parentId);
      if (parent) addNode(parent);
    }
    sorted.push(node);
    added.add(node.id);
  };

  while (remaining.length > 0) {
    const node = remaining.shift()!;
    addNode(node);
  }

  return sorted;
}

function resizeZoneToFitChildren(nodes: AnyNode[], zoneId: string): AnyNode[] {
  const ZONE_PADDING = 40;
  const HEADER_HEIGHT = 32;
  const MIN_W = 200;
  const MIN_H = 150;

  const zone = nodes.find((n) => n.id === zoneId && n.type === 'umlZone');
  if (!zone) return nodes;

  const children = nodes.filter((n) => (n as any).parentId === zoneId && n.type === 'umlNode');
  if (children.length === 0) return nodes;

  let maxRight = 0;
  let maxBottom = 0;
  for (const child of children) {
    const cw = ((child as any).measured?.width ?? 160);
    const ch = ((child as any).measured?.height ?? 120);
    const cx = (child.position?.x ?? 0);
    const cy = (child.position?.y ?? 0);
    if (cx + cw > maxRight) maxRight = cx + cw;
    if (cy + ch > maxBottom) maxBottom = cy + ch;
  }

  const newW = Math.max(MIN_W, maxRight + ZONE_PADDING);
  const newH = Math.max(MIN_H, maxBottom + HEADER_HEIGHT + ZONE_PADDING);

  const curW = (zone.style as any)?.width ?? 400;
  const curH = (zone.style as any)?.height ?? 300;
  if (newW <= curW && newH <= curH) return nodes;

  return nodes.map((n) =>
    n.id === zoneId
      ? { ...n, style: { ...n.style, width: newW, height: newH } }
      : n
  );
}

const GAP_X = 60;
const GAP_Y = 80;
const ZONE_PAD = 40;
const ZONE_HEADER = 36;

function autoArrange(nodes: (UmlNode | UmlZone)[], edges: UmlEdge[]): (UmlNode | UmlZone)[] {
  if (nodes.length === 0) return nodes;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edgesBySource = new Map<string, UmlEdge[]>();
  const edgesByTarget = new Map<string, UmlEdge[]>();
  for (const e of edges) {
    if (!edgesBySource.has(e.source)) edgesBySource.set(e.source, []);
    edgesBySource.get(e.source)!.push(e);
    if (!edgesByTarget.has(e.target)) edgesByTarget.set(e.target, []);
    edgesByTarget.get(e.target)!.push(e);
  }

  const isZone = (n: UmlNode | UmlZone): n is UmlZone => n.type === 'umlZone';

  const result: (UmlNode | UmlZone)[] = [];

  const topLevel = nodes.filter((n) => !n.parentId);
  const childOf = new Map<string, (UmlNode | UmlZone)[]>();
  for (const n of nodes) {
    if (n.parentId) {
      if (!childOf.has(n.parentId)) childOf.set(n.parentId, []);
      childOf.get(n.parentId)!.push(n);
    }
  }

  const zoneChildren = new Map<string, UmlNode[]>();
  const freeNodes: UmlNode[] = [];
  for (const n of nodes) {
    if (isZone(n)) continue;
    if (n.parentId && isZone(nodeMap.get(n.parentId)!)) {
      if (!zoneChildren.has(n.parentId)) zoneChildren.set(n.parentId, []);
      zoneChildren.get(n.parentId)!.push(n as UmlNode);
    } else if (!n.parentId) {
      freeNodes.push(n as UmlNode);
    }
  }

  const allArrangeable = [...freeNodes, ...nodes.filter(isZone)];

  const nodeMapA = new Map(allArrangeable.map((n) => [n.id, n]));
  const childrenA = new Map<string, Set<string>>();
  const parentsA = new Map<string, Set<string>>();
  allArrangeable.forEach((n) => {
    childrenA.set(n.id, new Set());
    parentsA.set(n.id, new Set());
  });

  for (const e of edges) {
    const src = nodeMapA.has(e.source) ? e.source : null;
    const tgt = nodeMapA.has(e.target) ? e.target : null;
    if (src && tgt) {
      childrenA.get(src)!.add(tgt);
      parentsA.get(tgt)!.add(src);
    }
    if (src && !tgt) {
      const targetNode = nodeMap.get(e.target);
      if (targetNode && targetNode.parentId && nodeMapA.has(targetNode.parentId)) {
        childrenA.get(src)!.add(targetNode.parentId);
        parentsA.get(targetNode.parentId)!.add(src);
      }
    }
    if (!src && tgt) {
      const sourceNode = nodeMap.get(e.source);
      if (sourceNode && sourceNode.parentId && nodeMapA.has(sourceNode.parentId)) {
        childrenA.get(sourceNode.parentId)!.add(tgt);
        parentsA.get(tgt)!.add(sourceNode.parentId);
      }
    }
  }

  const roots = allArrangeable.filter((n) => parentsA.get(n.id)!.size === 0);
  const visited = new Set<string>();
  const levels: string[][] = [];

  function bfs(startIds: string[]) {
    let queue = startIds;
    while (queue.length > 0) {
      levels.push([...queue]);
      const next: string[] = [];
      for (const id of queue) {
        visited.add(id);
        for (const child of childrenA.get(id) ?? []) {
          if (!visited.has(child)) {
            next.push(child);
          }
        }
      }
      queue = next;
    }
  }

  bfs(roots.map((n) => n.id));

  const unvisited = allArrangeable.filter((n) => !visited.has(n.id));
  if (unvisited.length > 0) {
    bfs(unvisited.map((n) => n.id));
  }

  function arrangeChildrenInsideZone(zone: UmlZone): UmlNode[] {
    const children = zoneChildren.get(zone.id) ?? [];
    if (children.length === 0) return [];

    const childEdges: UmlEdge[] = [];
    for (const e of edges) {
      if (nodeMap.has(e.source) && nodeMap.has(e.target)) {
        const sNode = nodeMap.get(e.source)!;
        const tNode = nodeMap.get(e.target)!;
        const sInZone = sNode.parentId === zone.id;
        const tInZone = tNode.parentId === zone.id;
        if (sInZone && tInZone) childEdges.push(e);
      }
    }

    const cMap = new Map<string, Set<string>>();
    const pMap = new Map<string, Set<string>>();
    children.forEach((n) => {
      cMap.set(n.id, new Set());
      pMap.set(n.id, new Set());
    });
    for (const e of childEdges) {
      if (cMap.has(e.source) && cMap.has(e.target)) {
        cMap.get(e.source)!.add(e.target);
        pMap.get(e.target)!.add(e.source);
      }
    }

    const cRoots = children.filter((n) => pMap.get(n.id)!.size === 0);
    const cVisited = new Set<string>();
    const cLevels: string[][] = [];

    function cBfs(startIds: string[]) {
      let queue = startIds;
      while (queue.length > 0) {
        cLevels.push([...queue]);
        const next: string[] = [];
        for (const id of queue) {
          cVisited.add(id);
          for (const cid of cMap.get(id) ?? []) {
            if (!cVisited.has(cid)) next.push(cid);
          }
        }
        queue = next;
      }
    }

    cBfs(cRoots.map((n) => n.id));
    const cUnvisited = children.filter((n) => !cVisited.has(n.id));
    if (cUnvisited.length > 0) cBfs(cUnvisited.map((n) => n.id));

    const arranged = new Map<string, { x: number; y: number }>();
    let cy = ZONE_HEADER + 10;
    for (const level of cLevels) {
      let levelMaxH = 0;
      let totalW = 0;
      const widths = level.map((id) => {
        const nd = nodeMap.get(id)! as UmlNode;
        const w = nodeWidth(nd.data as UmlNodeData);
        totalW += w;
        return w;
      });
      totalW += (level.length - 1) * 20;
      let cx = ZONE_PAD;
      level.forEach((id, idx) => {
        const nd = nodeMap.get(id)! as UmlNode;
        const w = widths[idx];
        const h = nodeHeight(nd.data as UmlNodeData);
        if (h > levelMaxH) levelMaxH = h;
        arranged.set(id, { x: cx, y: cy });
        cx += w + 20;
      });
      cy += levelMaxH + 20;
    }

    const zoneW = Math.max(300, arranged.size > 0
      ? Math.max(...[...arranged.entries()].map(([id, pos]) => {
          const nd = nodeMap.get(id)! as UmlNode;
          return pos.x + nodeWidth(nd.data as UmlNodeData) + ZONE_PAD;
        }))
      : 300);
    const zoneH = Math.max(200, cy + 20);

    const zoneIdx = result.findIndex((n) => n.id === zone.id);
    if (zoneIdx >= 0) {
      result[zoneIdx] = { ...zone, style: { ...zone.style, width: zoneW, height: zoneH } };
    }

    return children.map((n) => {
      const pos = arranged.get(n.id);
      return pos ? { ...n, position: pos } : n;
    });
  }

  let currentY = 0;
  for (const level of levels) {
    let levelMaxH = 0;
    let totalW = 0;

    const sizes = level.map((id) => {
      const node = nodeMapA.get(id)!;
      if (isZone(node)) {
        const zw = (node.style as any)?.width ?? 400;
        const zh = (node.style as any)?.height ?? 300;
        totalW += zw;
        return { w: zw, h: zh };
      }
      const d = node.data as UmlNodeData;
      const w = nodeWidth(d);
      const h = nodeHeight(d);
      totalW += w;
      return { w, h };
    });

    totalW += (level.length - 1) * GAP_X;
    let x = -totalW / 2;

    level.forEach((id, posIdx) => {
      const node = nodeMapA.get(id)!;
      const { w, h } = sizes[posIdx];
      if (h > levelMaxH) levelMaxH = h;

      result.push({ ...node, position: { x, y: currentY } });
      x += w + GAP_X;
    });

    currentY += levelMaxH + GAP_Y;
  }

  for (const zone of result.filter(isZone)) {
    const arrangedChildren = arrangeChildrenInsideZone(zone);
    result.push(...arrangedChildren);
  }

  return result;
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
  const [nodes, setNodes, onNodesChange] = useNodesState<UmlNode | UmlZone>(initialNodes);
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
    zones: false,
    relations: false,
  });
  const [relationModalOpen, setRelationModalOpen] = useState(false);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const [projectType, setProjectType] = useState<ProjectType>('uml');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalFolderId, setCreateModalFolderId] = useState<string | undefined>(undefined);
  const [tldrawDocument, setTldrawDocument] = useState<Record<string, unknown> | null | undefined>(undefined);
  const [excalidrawDocument, setExcalidrawDocument] = useState<unknown>(undefined);
  const { screenToFlowPosition } = useReactFlow();

  const toggleInspectorSection = (key: string) => {
    setInspectorCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const startRelation = () => {
    if (!selectedNodeId) return;
    setRelationModalOpen(true);
  };

  const handleRelationConfirm = (targetId: string) => {
    setRelationModalOpen(false);
    if (!targetId || targetId === selectedNodeId) return;
    const targetNode = nodes.find((n) => n.id === targetId);
    if (!targetNode) return;
    const edgeType = selectedRelation;
    setEdges((current) =>
      addEdge(
        {
          id: `e-${selectedNodeId}-${targetId}`,
          source: selectedNodeId,
          target: targetId,
          type: edgeType as any,
          data: { relation: selectedRelation },
        },
        current,
      ),
    );
    setStatus(`Relation: ${selectedRelation} added`);
  };

  const selectedNode = nodes.find((node) => node.id === selectedNodeId && node.type === 'umlNode') as UmlNode | undefined;
  const generatedCode = useMemo(() => generateJavaCode(nodes, edges), [nodes, edges]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const urlProjectId = new URLSearchParams(window.location.search).get('project');

        if (isSupabaseConfigured) {
          if (urlProjectId) {
            const project = await loadProjectById(urlProjectId);
            if (cancelled) return;
            if (project) {
              setProjectId(project.id ?? crypto.randomUUID());
              setProjectFolderId(project.folderId);
              setProjectName(project.name);
              setProjectType(project.type ?? 'uml');
              setNodes(project.nodes);
              setEdges(project.edges);
              setTldrawDocument(project.tldrawDocument ?? undefined);
              setExcalidrawDocument(project.excalidrawDocument ?? undefined);
              setSelectedNodeId(project.nodes[0]?.id);
              setRecentProjectId(project.id);
              setAllProjects([]);
              setAllFolders([]);
              projectLoaded.current = true;
              return;
            }
          }

          const [projects, folders] = await Promise.all([loadUserProjects(), loadFolders()]);
          if (cancelled) return;
          setAllProjects(projects);
          setAllFolders(folders);
          if (projects.length > 0) {
            const latest = projects[0];
            setProjectId(latest.id ?? crypto.randomUUID());
            setProjectFolderId(latest.folderId);
            setProjectName(latest.name);
            setProjectType(latest.type ?? 'uml');
            setNodes(latest.nodes);
            setEdges(latest.edges);
            setTldrawDocument(latest.tldrawDocument ?? undefined);
            setExcalidrawDocument(latest.excalidrawDocument ?? undefined);
            setSelectedNodeId(latest.nodes[0]?.id);
            setRecentProjectId(latest.id);
            if (latest.id) {
              history.replaceState(null, '', `?project=${latest.id}`);
            }
            projectLoaded.current = true;
            return;
          }
        }
        const local = loadLocalDiagram();
        if (local) {
          setProjectId(local.id ?? crypto.randomUUID());
          setProjectFolderId(local.folderId);
          setProjectName(local.name);
          setProjectType(local.type ?? 'uml');
          setNodes(local.nodes);
          setEdges(local.edges);
          setTldrawDocument(local.tldrawDocument ?? undefined);
          setExcalidrawDocument(local.excalidrawDocument ?? undefined);
          setSelectedNodeId(local.nodes[0]?.id);
          setRecentProjectId(local.id);
          projectLoaded.current = true;
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

  useEffect(() => {
    const handlePopState = async () => {
      const urlProjectId = new URLSearchParams(window.location.search).get('project');
      if (!urlProjectId || !isSupabaseConfigured) return;
      const project = await loadProjectById(urlProjectId);
      if (project) {
        setProjectId(project.id ?? crypto.randomUUID());
        setProjectFolderId(project.folderId);
        setProjectName(project.name);
        setProjectType(project.type ?? 'uml');
        setNodes(project.nodes);
        setEdges(project.edges);
        setTldrawDocument(project.tldrawDocument ?? undefined);
        setExcalidrawDocument(project.excalidrawDocument ?? undefined);
        setSelectedNodeId(project.nodes[0]?.id);
        setRecentProjectId(project.id);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(true);
  const projectLoaded = useRef(false);

  useEffect(() => {
    if (skipSave.current) { skipSave.current = false; return; }
    if (!projectLoaded.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await saveDiagram({
          id: projectId,
          folderId: projectFolderId,
          name: projectName,
          type: projectType,
          nodes,
          edges,
          tldrawDocument,
          excalidrawDocument,
          updatedAt: new Date().toISOString(),
        });
        setStatus('Auto-saved');
      } catch (e) {
        console.warn('Auto-save failed:', e);
        setStatus('Auto-save failed');
      }
    }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [nodes, edges, projectName, projectType, tldrawDocument, excalidrawDocument]);

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
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            type: selectedRelation as any,
            data: { relation: selectedRelation },
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

  const onZoneDragStart = (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData('application/uml-zone-kind', 'zone');
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const zoneKind = event.dataTransfer.getData('application/uml-zone-kind');
    if (zoneKind) {
      const newZone = createUmlZone(screenToFlowPosition({ x: event.clientX, y: event.clientY }), nodes.filter(n => n.type === 'umlZone').length + 1);
      setNodes((current) => current.concat(newZone));
      return;
    }
    const kind = event.dataTransfer.getData('application/uml-node-kind') as UmlNodeKind;
    if (!kind) return;
    const newNode = createUmlNode(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }), nodes.length + 1);
    setNodes((current) => current.concat(newNode));
    setSelectedNodeId(newNode.id);
  };

  const onNodeDragStop = useCallback((_: any, node: any) => {
    if (node.type !== 'umlNode') return;
    const allNodes = nodesRef.current;
    const zones = allNodes.filter((n): n is UmlZone => n.type === 'umlZone');
    const nodeW = (node.measured?.width ?? 160);
    const nodeH = (node.measured?.height ?? 120);
    const nodeCx = node.position.x + nodeW / 2;
    const nodeCy = node.position.y + nodeH / 2;

    let placedInZone = false;
    for (const zone of zones) {
      const zw = (zone.style as any)?.width ?? 400;
      const zh = (zone.style as any)?.height ?? 300;
      const zLeft = zone.position.x;
      const zTop = zone.position.y;
      const zRight = zLeft + zw;
      const zBottom = zTop + zh;

      if (nodeCx >= zLeft && nodeCx <= zRight && nodeCy >= zTop && nodeCy <= zBottom) {
        const relX = node.position.x - zone.position.x;
        const relY = node.position.y - zone.position.y;
        setNodes((nds) => {
          const updated = nds.map((n) =>
            n.id === node.id
              ? { ...n, parentId: zone.id, position: { x: relX, y: relY }, data: { ...n.data, packageName: zone.data.name } }
              : n
          );
          return sortNodes(resizeZoneToFitChildren(updated, zone.id));
        });
        placedInZone = true;
        break;
      }
    }

    if (!placedInZone) {
      const prevParentId = (node as any).parentId;
      setNodes((nds) => {
        const updated = nds.map((n) =>
          n.id === node.id && prevParentId
            ? { ...n, parentId: undefined, data: { ...n.data, packageName: undefined } }
            : n
        );
        if (prevParentId) return sortNodes(resizeZoneToFitChildren(updated, prevParentId));
        return updated;
      });
    }
  }, [setNodes]);

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
      type: projectType,
      nodes,
      edges,
      tldrawDocument,
      excalidrawDocument,
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
    setProjectType(project.type ?? 'uml');
    setNodes(project.nodes);
    setEdges(project.edges);
    setTldrawDocument(project.tldrawDocument ?? undefined);
    setExcalidrawDocument(project.excalidrawDocument ?? undefined);
    setSelectedNodeId(project.nodes[0]?.id);
    setRecentProjectId(project.id);
    setStatus('Loaded project');
    projectLoaded.current = true;
    if (project.id) {
      history.pushState(null, '', `?project=${project.id}`);
    }
  };

  const handleCreateProject = async (folderId?: string) => {
    setCreateModalFolderId(folderId);
    setShowCreateModal(true);
  };

  const handleCreateProjectWithType = async (type: ProjectType, name: string) => {
    setShowCreateModal(false);
    const id = crypto.randomUUID();
    setProjectId(id);
    setProjectFolderId(createModalFolderId);
    setProjectName(name);
    setProjectType(type);

    if (type === 'uml') {
      setNodes([]);
      setEdges([]);
      setTldrawDocument(undefined);
      setExcalidrawDocument(undefined);
    } else if (type === 'freedraw') {
      setNodes([]);
      setEdges([]);
      setTldrawDocument(null);
      setExcalidrawDocument(undefined);
    } else {
      setNodes([]);
      setEdges([]);
      setTldrawDocument(undefined);
      setExcalidrawDocument(null);
    }

    setStatus('New project created');
    await saveDiagram({
      id,
      folderId: createModalFolderId,
      name,
      type,
      nodes: [],
      edges: [],
      updatedAt: new Date().toISOString(),
    });
    setExplorerRefreshKey((k) => k + 1);
    projectLoaded.current = true;
    history.pushState(null, '', `?project=${id}`);
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
      type: projectType,
      nodes,
      edges,
      tldrawDocument,
      excalidrawDocument,
      updatedAt: new Date().toISOString(),
    };
    navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    setStatus('Diagram JSON copied');
  };

  const handleTldrawSnapshotChange = (snapshot: unknown) => {
    setTldrawDocument(snapshot as Record<string, unknown> | null);
  };

  const handleExcalidrawChange = (elements: readonly unknown[], appState: unknown) => {
    setExcalidrawDocument({ elements, appState });
  };

  const onNodeClickHandler = useCallback((_: any, node: any) => {
    setSelectedNodeId(node.id);
  }, []);

  const isUml = projectType === 'uml';
  const isExcalidraw = projectType === 'excalidraw';

  const handleNodesChange = useCallback((changes: NodeChange<UmlNode | UmlZone>[]) => {
    onNodesChange(changes);
  }, [onNodesChange]);

  const handleEdgesChange = useCallback((changes: EdgeChange<UmlEdge>[]) => {
    onEdgesChange(changes);
  }, [onEdgesChange]);

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
      {showCreateModal && (
        <CreateProjectModal
          onSelect={(type, name) => handleCreateProjectWithType(type, name)}
          onClose={() => setShowCreateModal(false)}
        />
      )}
      {relationModalOpen && (
        <InputModal
          title="Add Relation"
          placeholder="Target node ID (e.g. class-user)"
          confirmLabel="Connect"
          onConfirm={handleRelationConfirm}
          onCancel={() => setRelationModalOpen(false)}
        />
      )}

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
            onProjectRenamed={(_id, name) => setProjectName(name)}
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
            <span className={`topbar-type-badge ${isUml ? 'topbar-type-badge--uml' : isExcalidraw ? 'topbar-type-badge--excalidraw' : 'topbar-type-badge--draw'}`}>
              {isUml ? 'UML' : isExcalidraw ? 'Excalidraw' : 'Free Draw'}
            </span>
          </div>
          <div className="topbar-right">
            {isUml && <span className="topbar-status">{nodes.length} nodes · {edges.length} relations</span>}
            {isUml && (
              <button className="topbar-btn" onClick={handleAutoArrange} title="Auto arrange">
                <LayoutGrid size={14} />
              </button>
            )}
            <button className="topbar-btn" onClick={saveCurrentDiagram} title="Save">
              <Save size={14} />
            </button>
            <span className="topbar-dot">{status}</span>
          </div>
        </div>
        {isUml ? (
          <div className="canvas" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClickHandler}
              onNodeDragStop={onNodeDragStop}
              connectionLineType="straight"
              connectionMode="loose"
              fitView
            >
              <Background />
              <MiniMap pannable zoomable />
              <Controls />
            </ReactFlow>
          </div>
        ) : isExcalidraw ? (
          <div className="canvas">
            <ErrorBoundary>
              <ExcalidrawCanvas
                excalidrawDocument={excalidrawDocument}
                onDocumentChange={handleExcalidrawChange}
                theme={theme}
              />
            </ErrorBoundary>
          </div>
        ) : (
          <div className="canvas">
            <FreeDrawCanvas
              tldrawDocument={tldrawDocument}
              onSnapshotChange={handleTldrawSnapshotChange}
            />
          </div>
        )}
      </section>

      {/* Inspector */}
      <aside className={`inspector ${inspectorOpen ? '' : 'inspector--collapsed'}`}>
        <button className="inspector-toggle" onClick={() => setInspectorOpen(!inspectorOpen)} title={inspectorOpen ? 'Collapse inspector' : 'Expand inspector'}>
          <SidePanelToggle open={inspectorOpen} />
        </button>
        {inspectorOpen && (<>
        {isUml && (
        <section className={`inspector-section${inspectorCollapsed.inspector ? ' collapsed' : ''}`}>
          <label className="inspector-section-header" onClick={() => toggleInspectorSection('inspector')}>
            <InspectorChevron open={!inspectorCollapsed.inspector} /> Inspector
          </label>
          {!inspectorCollapsed.inspector && (
          <div className="inspector-section-body">
            {selectedNode && 'fields' in selectedNode.data ? (
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
          </div>
          )}
        </section>
        )}

        {isUml && (
        <section className={`inspector-section${inspectorCollapsed.textToVisual ? ' collapsed' : ''}`}>
          <label className="inspector-section-header" onClick={() => toggleInspectorSection('textToVisual')}>
            <InspectorChevron open={!inspectorCollapsed.textToVisual} />
            <Sparkles size={14} /> Text to Visual
          </label>
          <div className="inspector-section-body">
            <textarea value={textInput} onChange={(event) => setTextInput(event.target.value)} rows={6} />
            <button onClick={importText}>Generate nodes</button>
          </div>
        </section>
        )}

        {isUml && (
        <section className={`inspector-section code-panel${inspectorCollapsed.code ? ' collapsed' : ''}`}>
          <label className="inspector-section-header" onClick={() => toggleInspectorSection('code')}>
            <InspectorChevron open={!inspectorCollapsed.code} />
            <Code2 size={14} /> Java Code
          </label>
          {!inspectorCollapsed.code && (
          <div className="inspector-section-body">
            <pre>{generatedCode}</pre>
            <button onClick={() => navigator.clipboard.writeText(generatedCode)}>
              <Download size={14} /> Copy
            </button>
            <button onClick={exportJson}>Export JSON</button>
          </div>
          )}
        </section>
        )}

        {isUml && (
        <section className={`inspector-section${inspectorCollapsed.nodes ? ' collapsed' : ''}`}>
          <label className="inspector-section-header" onClick={() => toggleInspectorSection('nodes')}>
            <InspectorChevron open={!inspectorCollapsed.nodes} /> Nodes
          </label>
          <div className="inspector-section-body">
            {(['class', 'abstract', 'interface', 'enum'] as UmlNodeKind[]).map((kind) => (
              <button className={`palette-item palette-item--${kind}`} draggable key={kind} onDragStart={(event) => onDragStart(event, kind)}>
                <MousePointer2 size={14} />
                {kind}
              </button>
            ))}
          </div>
        </section>
        )}

        {isUml && (
        <section className={`inspector-section${inspectorCollapsed.zones ? ' collapsed' : ''}`}>
          <label className="inspector-section-header" onClick={() => toggleInspectorSection('zones')}>
            <InspectorChevron open={!inspectorCollapsed.zones} /> Zones
          </label>
          <div className="inspector-section-body">
            <button className="palette-item palette-item--zone" draggable onDragStart={onZoneDragStart}>
              <Shapes size={14} />
              Zone
            </button>
          </div>
        </section>
        )}

        {isUml && (
        <section className={`inspector-section${inspectorCollapsed.relations ? ' collapsed' : ''}`}>
          <label className="inspector-section-header" onClick={() => toggleInspectorSection('relations')}>
            <InspectorChevron open={!inspectorCollapsed.relations} /> Relation
          </label>
          <div className="inspector-section-body">
            <div className="relation-group">
              <span className="relation-group-label">is-a</span>
              {(['inheritance', 'implementation'] as UmlRelationKind[]).map((rel) => (
                <button
                  key={rel}
                  className={`palette-item ${selectedRelation === rel ? 'palette-item--active' : ''}`}
                  onClick={() => setSelectedRelation(rel)}
                >
                  <span className="relation-icon">
                    <svg width="20" height="12" viewBox="0 0 20 12">
                      <line x1="0" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M 14 1 L 20 6 L 14 11 Z" fill={rel === 'implementation' ? 'none' : '#fff'} stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </span>
                  {rel}
                </button>
              ))}
            </div>
            <div className="relation-group">
              <span className="relation-group-label">has-a</span>
              {(['composition', 'aggregation'] as UmlRelationKind[]).map((rel) => (
                <button
                  key={rel}
                  className={`palette-item ${selectedRelation === rel ? 'palette-item--active' : ''}`}
                  onClick={() => setSelectedRelation(rel)}
                >
                  <span className="relation-icon">
                    <svg width="20" height="12" viewBox="0 0 20 12">
                      <line x1="6" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M 0 6 L 6 1 L 12 6 L 6 11 Z" fill={rel === 'composition' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </span>
                  {rel}
                </button>
              ))}
            </div>
            <div className="relation-group">
              <span className="relation-group-label">other</span>
              {(['association', 'dependency'] as UmlRelationKind[]).map((rel) => (
                <button
                  key={rel}
                  className={`palette-item ${selectedRelation === rel ? 'palette-item--active' : ''}`}
                  onClick={() => setSelectedRelation(rel)}
                >
                  <span className="relation-icon">
                    <svg width="20" height="12" viewBox="0 0 20 12">
                      <line x1="0" y1="6" x2="16" y2="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray={rel === 'dependency' ? '3 2' : 'none'} />
                      <path d="M 16 2 L 20 6 L 16 10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </span>
                  {rel}
                </button>
              ))}
            </div>
            {selectedRelation && selectedNodeId && (
              <button onClick={startRelation}>Link selected to…</button>
            )}
          </div>
        </section>
        )}

        {!isUml && (
        <section className="inspector-section">
          <label className="inspector-section-header">
            <Pen size={14} /> {isExcalidraw ? 'Excalidraw' : 'Free Draw'}
          </label>
          <div className="inspector-section-body">
            <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
              {isExcalidraw
                ? 'Use the toolbar on the left for hand-drawn style shapes, text, arrows, and freehand drawing.'
                : 'Use the toolbar on the left to draw. Supports shapes, text, arrows, and freehand.'}
            </p>
          </div>
        </section>
        )}

        {!isUml && (
        <section className={`inspector-section${inspectorCollapsed.penTablet ? ' collapsed' : ''}`}>
          <label className="inspector-section-header" onClick={() => toggleInspectorSection('penTablet')}>
            <InspectorChevron open={!inspectorCollapsed.penTablet} />
            <Keyboard size={14} /> Pen Tablet Setup
          </label>
          <div className="inspector-section-body">
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 8px 0' }}>
              In <strong>Huion Tablet</strong> software, map your pen buttons to these keys:
            </p>
            <div className="shortcut-list">
              <div className="shortcut-item">
                <span className="shortcut-keys">
                  <kbd>Pen Btn 1 → E</kbd>
                </span>
                <span className="shortcut-desc">Eraser tool</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-keys">
                  <kbd>Pen Btn 2 → V</kbd>
                </span>
                <span className="shortcut-desc">Selection tool</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-keys">
                  <kbd>Eraser → E</kbd>
                </span>
                <span className="shortcut-desc">Toggle eraser on pen flip</span>
              </div>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '12px 0 8px 0', fontWeight: 600 }}>
              Keyboard Shortcuts:
            </p>
            <div className="shortcut-list">
              <div className="shortcut-item">
                <span className="shortcut-keys">
                  <kbd>P</kbd>
                </span>
                <span className="shortcut-desc">Pen / Freehand</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-keys">
                  <kbd>E</kbd>
                </span>
                <span className="shortcut-desc">Eraser</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-keys">
                  <kbd>V</kbd>
                </span>
                <span className="shortcut-desc">Selection</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-keys">
                  <kbd>R</kbd>
                </span>
                <span className="shortcut-desc">Rectangle</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-keys">
                  <kbd>O</kbd>
                </span>
                <span className="shortcut-desc">Ellipse</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-keys">
                  <kbd>D</kbd>
                </span>
                <span className="shortcut-desc">Diamond</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-keys">
                  <kbd>A</kbd>
                </span>
                <span className="shortcut-desc">Arrow</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-keys">
                  <kbd>L</kbd>
                </span>
                <span className="shortcut-desc">Line</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-keys">
                  <kbd>T</kbd>
                </span>
                <span className="shortcut-desc">Text</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-keys">
                  <kbd>H</kbd>
                </span>
                <span className="shortcut-desc">Hand (Pan)</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-keys">
                  <kbd>Ctrl+Z</kbd>
                </span>
                <span className="shortcut-desc">Undo</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-keys">
                  <kbd>Ctrl+Shift+Z</kbd>
                </span>
                <span className="shortcut-desc">Redo</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-keys">
                  <kbd>Space+Drag</kbd>
                </span>
                <span className="shortcut-desc">Pan Canvas</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-keys">
                  <kbd>Ctrl+Scroll</kbd>
                </span>
                <span className="shortcut-desc">Zoom</span>
              </div>
            </div>
          </div>
        </section>
        )}
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
