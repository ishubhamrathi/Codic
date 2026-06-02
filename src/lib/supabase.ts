import { createClient, type Session, type User } from '@supabase/supabase-js';
import type { DiagramSnapshot } from '../types/uml';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url!, anonKey!) : null;

export type AuthUser = User;

export const signUp = async (email: string, password: string, displayName?: string) => {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  return data;
};

export const signIn = async (email: string, password: string) => {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const sendOtp = async (email: string) => {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
  return data;
};

export const verifyOtp = async (email: string, token: string) => {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
  if (error) throw error;
  return data;
};

export type OAuthProvider = 'google' | 'github';

export const signInWithOAuth = async (provider: OAuthProvider) => {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}`,
    },
  });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const loadUserTheme = async (): Promise<'light' | 'dark'> => {
  if (!supabase) return 'light';
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'light';
  const { data } = await supabase
    .from('user_profiles')
    .select('theme')
    .eq('id', user.id)
    .single();
  return (data?.theme === 'dark') ? 'dark' : 'light';
};

export const saveUserTheme = async (theme: 'light' | 'dark') => {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('user_profiles')
    .upsert({ id: user.id, theme }, { onConflict: 'id' });
};

export const onAuthChange = (callback: (session: Session | null) => void) => {
  if (!supabase) {
    callback(null);
    return () => {};
  }
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => subscription.unsubscribe();
};

export const getCurrentUser = async (): Promise<AuthUser | null> => {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const saveDiagram = async (diagram: DiagramSnapshot) => {
  if (!supabase) {
    localStorage.setItem('uml:last-project', JSON.stringify(diagram));
    return { ...diagram, id: diagram.id ?? 'local-project' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const payload = {
    id: diagram.id,
    user_id: user.id,
    folder_id: diagram.folderId ?? null,
    name: diagram.name,
    nodes: diagram.nodes,
    edges: diagram.edges,
    updated_at: diagram.updatedAt,
  };

  const { data, error } = await supabase.from('uml_projects').upsert(payload).select().single();
  if (error) throw error;

  return {
    id: data.id as string,
    folderId: (data.folder_id as string | null) ?? undefined,
    name: data.name as string,
    nodes: data.nodes as DiagramSnapshot['nodes'],
    edges: data.edges as DiagramSnapshot['edges'],
    updatedAt: data.updated_at as string,
  };
};

export const loadUserProjects = async (): Promise<DiagramSnapshot[]> => {
  if (!supabase) {
    const raw = localStorage.getItem('uml:last-project');
    return raw ? [JSON.parse(raw) as DiagramSnapshot] : [];
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('uml_projects')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  if (error) throw error;

  return data.map((row) => ({
    id: row.id as string,
    folderId: (row.folder_id as string | null) ?? undefined,
    name: row.name as string,
    nodes: row.nodes as DiagramSnapshot['nodes'],
    edges: row.edges as DiagramSnapshot['edges'],
    updatedAt: row.updated_at as string,
  }));
};

export type FolderData = {
  id: string;
  name: string;
  parentId?: string;
  createdAt: string;
};

export const loadFolders = async (): Promise<FolderData[]> => {
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('uml_folders')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });
  if (error) throw error;

  return data.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    parentId: (row.parent_id as string | null) ?? undefined,
    createdAt: row.created_at as string,
  }));
};

export const createFolder = async (name: string, parentId?: string): Promise<FolderData> => {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('uml_folders')
    .insert({ user_id: user.id, name, parent_id: parentId ?? null })
    .select()
    .single();
  if (error) throw error;

  return {
    id: data.id as string,
    name: data.name as string,
    parentId: (data.parent_id as string | null) ?? undefined,
    createdAt: data.created_at as string,
  };
};

export const renameFolder = async (id: string, name: string): Promise<void> => {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('uml_folders').update({ name }).eq('id', id);
  if (error) throw error;
};

export const deleteFolder = async (id: string): Promise<void> => {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('uml_folders').delete().eq('id', id);
  if (error) throw error;
};

export const deleteProject = async (id: string): Promise<void> => {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('uml_projects').delete().eq('id', id);
  if (error) throw error;
};

export const renameProject = async (id: string, name: string): Promise<void> => {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('uml_projects').update({ name }).eq('id', id);
  if (error) throw error;
};

export const moveProject = async (id: string, folderId: string | null): Promise<void> => {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('uml_projects').update({ folder_id: folderId }).eq('id', id);
  if (error) throw error;
};

export const loadLocalDiagram = (): DiagramSnapshot | null => {
  const raw = localStorage.getItem('uml:last-project');
  return raw ? (JSON.parse(raw) as DiagramSnapshot) : null;
};
