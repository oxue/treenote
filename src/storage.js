import { supabase } from './supabaseClient';

export async function loadUserTree(userId) {
  const { data, error } = await supabase
    .from('user_trees')
    .select('tree_data')
    .eq('user_id', userId)
    .single();

  if (error && error.code === 'PGRST116') {
    // No row found — new user
    return null;
  }
  if (error) throw error;
  return data.tree_data;
}

export async function saveUserTree(userId, tree) {
  const { error } = await supabase
    .from('user_trees')
    .upsert(
      { user_id: userId, tree_data: tree, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
}

export async function loadUserQueue(userId) {
  const { data, error } = await supabase
    .from('user_trees')
    .select('queue_data')
    .eq('user_id', userId)
    .single();

  if (error && error.code === 'PGRST116') {
    return [];
  }
  if (error) throw error;
  return data.queue_data || [];
}

export async function saveUserQueue(userId, queue) {
  const { error } = await supabase
    .from('user_trees')
    .update({ queue_data: queue, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw error;
}

// --- Backup functions ---

export async function saveBackup(userId, tree) {
  const { error } = await supabase
    .from('tree_backups')
    .insert({
      user_id: userId,
      tree_data: tree,
      created_at: new Date().toISOString(),
    });
  if (error) throw error;
}

export async function loadBackups(userId, limit = 10) {
  const { data, error } = await supabase
    .from('tree_backups')
    .select('id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function restoreBackup(userId, backupId) {
  const { data, error } = await supabase
    .from('tree_backups')
    .select('tree_data')
    .eq('id', backupId)
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data.tree_data;
}

export async function deleteOldBackups(userId, keepCount = 20) {
  // Get the Nth newest backup's created_at as the cutoff
  const { data, error: fetchError } = await supabase
    .from('tree_backups')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(keepCount, keepCount);

  if (fetchError) throw fetchError;
  if (!data || data.length === 0) return; // fewer than keepCount backups

  const cutoff = data[0].created_at;
  const { error: deleteError } = await supabase
    .from('tree_backups')
    .delete()
    .eq('user_id', userId)
    .lte('created_at', cutoff);
  if (deleteError) throw deleteError;
}
