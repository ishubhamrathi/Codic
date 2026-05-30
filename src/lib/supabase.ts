import { createClient } from '@supabase/supabase-js';
import type { DiagramSnapshot } from '../types/uml';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url!, anonKey!) : null;

export const saveDiagram = async (diagram: DiagramSnapshot) => {
  if (!supabase) {
    localStorage.setItem('uml:last-project', JSON.stringify(diagram));
    return { ...diagram, id: diagram.id ?? 'local-project' };
  }

  const payload = {
    id: diagram.id,
    name: diagram.name,
    nodes: diagram.nodes,
    edges: diagram.edges,
    updated_at: diagram.updatedAt,
  };

  const { data, error } = await supabase.from('uml_projects').upsert(payload).select().single();
  if (error) throw error;

  return {
    id: data.id as string,
    name: data.name as string,
    nodes: data.nodes as DiagramSnapshot['nodes'],
    edges: data.edges as DiagramSnapshot['edges'],
    updatedAt: data.updated_at as string,
  };
};

export const loadLocalDiagram = (): DiagramSnapshot | null => {
  const raw = localStorage.getItem('uml:last-project');
  return raw ? (JSON.parse(raw) as DiagramSnapshot) : null;
};
