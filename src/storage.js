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
