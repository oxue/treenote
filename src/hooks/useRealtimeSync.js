import { useEffect, useRef, useState, useCallback } from 'react';
import { loadUserTree, loadUserQueue } from '../storage';
import { ensureIds, findNodeById } from '../actions';
import { supabase } from '../supabaseClient';

export default function useRealtimeSync({
  userId,
  versionRef,
  mode,
  hasModalOpen,
  selectedNodeId,
  setTree,
  setQueue,
  setPath,
  setSelectedIndex,
  setToast,
  lastSyncedTreeRef,
  lastSyncedQueueRef,
  cancelPendingSaves,
}) {
  const bcRef = useRef(null);
  const pendingSyncRef = useRef(null);
  const modeRef = useRef(mode);
  const hasModalOpenRef = useRef(hasModalOpen);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const [syncAvailable, setSyncAvailable] = useState(false);

  // Keep refs in sync
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { hasModalOpenRef.current = hasModalOpen; }, [hasModalOpen]);
  useEffect(() => { selectedNodeIdRef.current = selectedNodeId; }, [selectedNodeId]);

  // Apply sync payload to app state
  const applySync = useCallback((syncTree, syncVersion, syncQueue) => {
    const treeNewer = syncVersion > versionRef.current;

    if (treeNewer && syncTree) {
      ensureIds(syncTree);
      cancelPendingSaves();
      lastSyncedTreeRef.current = syncTree;
      setTree(syncTree);
      versionRef.current = syncVersion;

      // Re-resolve selected node by ID in the new tree
      const nodeId = selectedNodeIdRef.current;
      if (nodeId) {
        const found = findNodeById(syncTree, nodeId);
        if (found) {
          setPath(found.path);
          setSelectedIndex(found.index);
        } else {
          setPath([]);
          setSelectedIndex(0);
        }
      }

      setToast('Synced from another device');
      setTimeout(() => setToast(null), 2000);
    }

    if (syncQueue !== undefined) {
      lastSyncedQueueRef.current = syncQueue;
      setQueue(syncQueue);
    }

    pendingSyncRef.current = null;
    setSyncAvailable(false);
  }, [versionRef, lastSyncedTreeRef, lastSyncedQueueRef, cancelPendingSaves, setTree, setQueue, setPath, setSelectedIndex, setToast]);

  // Route incoming sync: apply immediately or defer if editing/modal open
  const handleIncoming = useCallback((syncTree, syncVersion, syncQueue) => {
    if (syncVersion <= versionRef.current && syncQueue === undefined) return;

    if (modeRef.current === 'edit' || hasModalOpenRef.current) {
      pendingSyncRef.current = { tree: syncTree, version: syncVersion, queue: syncQueue };
      setSyncAvailable(true);
    } else {
      applySync(syncTree, syncVersion, syncQueue);
    }
  }, [versionRef, applySync]);

  // Apply deferred sync when exiting edit mode or closing modal
  useEffect(() => {
    if (mode === 'visual' && !hasModalOpen && pendingSyncRef.current) {
      const { tree, version, queue } = pendingSyncRef.current;
      applySync(tree, version, queue);
    }
  }, [mode, hasModalOpen, applySync]);

  // Layer 1: BroadcastChannel (same-device tab sync)
  useEffect(() => {
    if (!userId) return;
    const bc = new BroadcastChannel('treenote-sync');
    bcRef.current = bc;
    bc.onmessage = (e) => {
      const { tree, version, queue } = e.data;
      handleIncoming(tree, version, queue);
    };
    return () => { bc.close(); bcRef.current = null; };
  }, [userId, handleIncoming]);

  // Layer 2: Supabase Realtime (cross-device sync)
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('tree-sync')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_trees',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const v = payload.new.version;
        if (v > versionRef.current) {
          handleIncoming(payload.new.tree_data, v, undefined);
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userId, handleIncoming, versionRef]);

  // Layer 3: Pull-on-focus fallback
  useEffect(() => {
    if (!userId) return;
    const onVisChange = () => {
      if (document.visibilityState !== 'visible') return;
      loadUserTree(userId).then(({ tree, version }) => {
        if (version > versionRef.current) {
          loadUserQueue(userId).then((q) => {
            handleIncoming(tree, version, q || []);
          }).catch(() => handleIncoming(tree, version, undefined));
        }
      }).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, [userId, handleIncoming, versionRef]);

  // Broadcast function — called by App.jsx after successful saves
  const broadcast = useCallback((tree, version, queue) => {
    if (bcRef.current) {
      bcRef.current.postMessage({ tree, version, queue });
    }
  }, []);

  return { broadcast, syncAvailable };
}
