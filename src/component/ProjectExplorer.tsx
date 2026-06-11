import { useState, useEffect } from 'react';
import {
  loadFolders,
  loadUserProjects,
  createFolder,
  renameFolder,
  deleteFolder,
  renameProject,
  deleteProject,
  type FolderData,
} from '../lib/supabase';
import type { DiagramSnapshot } from '../types/uml';

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={open ? '#2563eb' : '#94a3b8'} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <path d="M2 5h5l1.5 1.5H14" />
          <path d="M2 5v7.5a1 1 0 001 1h10a1 1 0 001-1V6.5" />
        </>
      ) : (
        <path d="M2 5h5l1.5 1.5H14v6.5a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" />
      )}
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#94a3b8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9.5 2z" />
      <path d="M9 2v4h4" />
    </svg>
  );
}

function DrawFileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#94a3b8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9.5 2z" />
      <path d="M9 2v4h4" />
      <path d="M5 9c1-1 2-2 3-1s1 2 2 1" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function FilePlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9.5 2z" />
      <path d="M9 2v4h4" />
      <path d="M10 9v4M8 11h4" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s ease', flexShrink: 0 }}>
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4M6 7v4.5M8 7v4.5M10 7v4.5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#ca8a04" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </svg>
  );
}

type Props = {
  onLoadProject: (project: DiagramSnapshot) => void;
  onCreateProject: (folderId?: string) => void;
  onProjectRenamed?: (id: string, name: string) => void;
  currentProjectId?: string;
  recentProjectId?: string;
  refreshKey?: number;
};

export function ProjectExplorer({ onLoadProject, onCreateProject, onProjectRenamed, currentProjectId, recentProjectId, refreshKey }: Props) {
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [projects, setProjects] = useState<DiagramSnapshot[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [f, p] = await Promise.all([loadFolders(), loadUserProjects()]);
        if (!cancelled) { setFolders(f); setProjects(p); }
      } catch { /* ignored */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleCreateFolder = async (parentId?: string) => {
    const name = prompt('Folder name:');
    if (!name) return;
    const folder = await createFolder(name, parentId);
    setFolders((prev) => [...prev, folder]);
    if (parentId) setExpandedFolders((prev) => new Set(prev).add(parentId));
  };

  const handleRename = async (id: string, type: 'folder' | 'project') => {
    if (!renameValue.trim()) return;
    if (type === 'folder') {
      await renameFolder(id, renameValue);
      setFolders((prev) => prev.map((f) => f.id === id ? { ...f, name: renameValue } : f));
    } else {
      await renameProject(id, renameValue);
      setProjects((prev) => prev.map((p) => p.id === id ? { ...p, name: renameValue } : p));
      if (id === currentProjectId) {
        onProjectRenamed?.(id, renameValue);
      }
    }
    setRenamingId(null);
  };

  const handleDelete = async (id: string, type: 'folder' | 'project') => {
    if (!confirm(type === 'folder' ? 'Delete folder and contents?' : 'Delete project?')) return;
    try {
      if (type === 'folder') {
        await deleteFolder(id);
        setFolders((prev) => prev.filter((f) => f.id !== id));
        setProjects((prev) => prev.filter((p) => p.folderId !== id));
      } else {
        await deleteProject(id);
        setProjects((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (e) {
      console.warn('Delete failed:', e);
    }
  };

  const rootFolders = folders.filter((f) => !f.parentId);
  const rootProjects = projects.filter((p) => !p.folderId);
  const getChildren = (folderId: string) => ({
    subFolders: folders.filter((f) => f.parentId === folderId),
    folderProjects: projects.filter((p) => p.folderId === folderId),
  });

  const renderRenameInput = (_id: string, onSave: () => void) => (
    <input
      autoFocus
      value={renameValue}
      onChange={(e) => setRenameValue(e.target.value)}
      onBlur={() => onSave()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSave();
        if (e.key === 'Escape') setRenamingId(null);
      }}
      onClick={(e) => e.stopPropagation()}
      className="tree-rename-input"
    />
  );

  const renderFolder = (folder: FolderData, depth: number) => {
    const open = expandedFolders.has(folder.id);
    const { subFolders, folderProjects } = getChildren(folder.id);

    return (
      <div key={folder.id}>
        <div className="tree-item" style={{ paddingLeft: `${8 + depth * 12}px` }} onClick={() => toggleFolder(folder.id)}>
          <ChevronIcon open={open} />
          <FolderIcon open={open} />
          {renamingId === folder.id
            ? renderRenameInput(folder.id, () => handleRename(folder.id, 'folder'))
            : <span className="tree-label">{folder.name}</span>}
          <div className="tree-actions">
            <button onClick={(e) => { e.stopPropagation(); handleCreateFolder(folder.id); }} title="New subfolder"><PlusIcon /></button>
            <button onClick={(e) => { e.stopPropagation(); onCreateProject(folder.id); }} title="New project"><FilePlusIcon /></button>
            <button onClick={(e) => { e.stopPropagation(); setRenamingId(folder.id); setRenameValue(folder.name); }} title="Rename"><PencilIcon /></button>
            <button onClick={(e) => { e.stopPropagation(); handleDelete(folder.id, 'folder'); }} title="Delete"><TrashIcon /></button>
          </div>
        </div>
        {open && (
          <div>
            {subFolders.map((sf) => renderFolder(sf, depth + 1))}
            {folderProjects.map((p) => renderProject(p, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderProject = (project: DiagramSnapshot, depth: number) => {
    const isCurrent = project.id === currentProjectId;
    const isRecent = project.id === recentProjectId && !isCurrent;
    const isFreeDraw = project.type === 'freedraw';
    const isExcalidraw = project.type === 'excalidraw';

    return (
      <div
        key={project.id}
        className={`tree-item tree-item--file ${isCurrent ? 'tree-item--active' : ''} ${isRecent ? 'tree-item--recent' : ''}`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => onLoadProject(project)}
      >
        {isFreeDraw || isExcalidraw ? <DrawFileIcon /> : <FileIcon />}
        {renamingId === project.id
          ? renderRenameInput(project.id ?? '', () => project.id && handleRename(project.id, 'project'))
          : <span className="tree-label">{project.name}</span>}
        {isFreeDraw && <span className="tree-type-badge">draw</span>}
        {isExcalidraw && <span className="tree-type-badge tree-type-badge--excalidraw">excalidraw</span>}
        {isRecent && <ClockIcon />}
        <div className="tree-actions">
          <button onClick={(e) => { e.stopPropagation(); setRenamingId(project.id ?? ''); setRenameValue(project.name); }} title="Rename"><PencilIcon /></button>
          <button onClick={(e) => { e.stopPropagation(); project.id && handleDelete(project.id, 'project'); }} title="Delete"><TrashIcon /></button>
        </div>
      </div>
    );
  };

  return (
    <div className="panel-explorer">
      <div className="panel-explorer-header">
        <span>Explorer</span>
        <div className="panel-explorer-header-actions">
          <button className="panel-icon-btn" onClick={() => onCreateProject()} title="New file"><FilePlusIcon /></button>
          <button className="panel-icon-btn" onClick={() => handleCreateFolder()} title="New folder"><PlusIcon /></button>
        </div>
      </div>
      <div className="panel-explorer-tree">
        {loading
          ? <span className="panel-empty">Loading...</span>
          : rootFolders.length === 0 && rootProjects.length === 0
            ? <span className="panel-empty">No projects yet</span>
            : <>
              {rootFolders.map((f) => renderFolder(f, 0))}
              {rootProjects.map((p) => renderProject(p, 0))}
            </>
        }
      </div>
    </div>
  );
}
