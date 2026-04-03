import { useState, useEffect, useCallback } from 'react';
import { loadUserTree, loadUserQueue, saveUserTree, saveUserQueue } from './storage';
import { findNodeById, cloneTree, ensureIds } from './actions';
import { supabase } from './supabaseClient';
import { Capacitor } from '@capacitor/core';
import MobileTreeScreen from './components/mobile/MobileTreeScreen';
import MobileQueueScreen from './components/mobile/MobileQueueScreen';
import MobileSettingsScreen from './components/mobile/MobileSettingsScreen';
import MobileEditScreen from './components/mobile/MobileEditScreen';
import useSettings from './hooks/useSettings';
import './MobileApp.css';

export default function MobileApp({ session }) {
  const userId = session.user.id;
  const [tree, setTree] = useState(null);
  const [queue, setQueue] = useState([]);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('tree'); // 'tree' | 'queue' | 'settings'
  const [treePath, setTreePath] = useState([]);
  const { settings, updateSettings } = useSettings();

  // Edit mode state
  const [editTarget, setEditTarget] = useState(null); // { type: 'tree'|'queue', path?, index?, node? }
  const [editVisible, setEditVisible] = useState(false);

  // Action menu state
  const [actionMenu, setActionMenu] = useState(null); // { path, index, node }

  // Load data
  useEffect(() => {
    async function load() {
      try {
        const { tree: treeData, version: v } = await loadUserTree(userId);
        const queueData = await loadUserQueue(userId);
        if (treeData) ensureIds(treeData);
        setTree(treeData);
        setQueue(queueData || []);
        setVersion(v);
      } catch (err) {
        console.error('Load error:', err);
      }
      setLoading(false);
    }
    load();
  }, [userId]);

  // Widget sync
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    import('capacitor-widget-bridge').then(({ WidgetBridge }) => {
      const snapshot = queue.slice(0, 10).map(item => {
        const node = item.type === 'ref' && item.nodeId && tree
          ? (() => { const r = findNodeById(tree, item.nodeId); return r ? r.node : null; })()
          : null;
        return {
          text: node ? node.text : (item.text || '...'),
          checked: node ? node.checked : item.checked,
          type: item.type,
          nodeId: item.nodeId || null,
          deadline: node ? node.deadline : item.deadline,
          priority: node ? node.priority : item.priority,
        };
      });
      WidgetBridge.setItem({
        key: 'queueSnapshot',
        value: JSON.stringify(snapshot),
        group: 'group.zenica.treenotequeue',
      }).then(() => WidgetBridge.reloadAllTimelines())
        .catch(err => console.error('[Widget]', err));
    }).catch(() => {});
  }, [queue, tree]);

  // --- Save helpers ---
  const saveTree = useCallback(async (newTree) => {
    setTree(newTree);
    try {
      const result = await saveUserTree(userId, newTree, version);
      if (result.success) setVersion(result.version);
    } catch (err) {
      console.error('Save tree error:', err);
    }
  }, [userId, version]);

  const saveQueue = useCallback(async (newQueue) => {
    setQueue(newQueue);
    try {
      await saveUserQueue(userId, newQueue);
    } catch (err) {
      console.error('Save queue error:', err);
    }
  }, [userId]);

  // --- Helper: get/set node at path ---
  const getNodeAtPath = useCallback((treePath, index) => {
    let nodes = tree;
    for (const idx of treePath) {
      nodes = nodes[idx].children;
    }
    return nodes[index];
  }, [tree]);

  const updateNodeAtPath = useCallback((treePath, index, updater) => {
    const newTree = cloneTree(tree);
    let nodes = newTree;
    for (const idx of treePath) {
      nodes = nodes[idx].children;
    }
    nodes[index] = updater(nodes[index]);
    return newTree;
  }, [tree]);

  // --- Tree actions ---
  const handleTreeCheck = useCallback((path, index) => {
    const newTree = updateNodeAtPath(path, index, node => ({
      ...node, checked: !node.checked,
    }));
    saveTree(newTree);
  }, [updateNodeAtPath, saveTree]);

  const handleTreeDelete = useCallback((path, index) => {
    const newTree = cloneTree(tree);
    let nodes = newTree;
    for (const idx of path) {
      nodes = nodes[idx].children;
    }
    nodes.splice(index, 1);
    saveTree(newTree);
  }, [tree, saveTree]);

  const handleTreeAddNode = useCallback((path) => {
    const newTree = cloneTree(tree);
    let nodes = newTree;
    for (const idx of path) {
      nodes = nodes[idx].children;
    }
    const newNode = { text: '', checked: false, children: [], id: crypto.randomUUID() };
    nodes.push(newNode);
    saveTree(newTree);
    // Open editor for the new node
    setEditTarget({ type: 'tree', path, index: nodes.length - 1, node: newNode });
    setEditVisible(true);
  }, [tree, saveTree]);

  const handleTreeLongPress = useCallback((path, index, node) => {
    setActionMenu({ path, index, node });
  }, []);

  // --- Queue actions ---
  const handleQueueToggleCheck = useCallback((index) => {
    const newQueue = [...queue];
    const item = newQueue[index];
    if (item.type === 'ref' && item.nodeId && tree) {
      const result = findNodeById(tree, item.nodeId);
      if (result) {
        const newTree = updateNodeAtPath(result.path, result.index, node => ({
          ...node, checked: !node.checked,
        }));
        saveTree(newTree);
        return;
      }
    }
    newQueue[index] = { ...item, checked: !item.checked };
    saveQueue(newQueue);
  }, [queue, tree, updateNodeAtPath, saveTree, saveQueue]);

  const handleQueueDelete = useCallback((index) => {
    const newQueue = queue.filter((_, i) => i !== index);
    saveQueue(newQueue);
  }, [queue, saveQueue]);

  const handleQueueEdit = useCallback((index) => {
    const item = queue[index];
    let node = null;
    if (item.type === 'ref' && item.nodeId && tree) {
      const result = findNodeById(tree, item.nodeId);
      if (result) node = result.node;
    }
    setEditTarget({
      type: 'queue',
      index,
      node: node || item,
      queueItem: item,
    });
    setEditVisible(true);
  }, [queue, tree]);

  const handleQueueAddTemp = useCallback(() => {
    setEditTarget({
      type: 'queue-new',
      node: { text: '', checked: false },
    });
    setEditVisible(true);
  }, []);

  const handleQueueShowInTree = useCallback((nodeId) => {
    if (!tree) return;
    const result = findNodeById(tree, nodeId);
    if (result) {
      setTreePath(result.path);
      setTab('tree');
    }
  }, [tree]);

  const handleQueueReorder = useCallback((from, to) => {
    const newQueue = [...queue];
    const [item] = newQueue.splice(from, 1);
    newQueue.splice(to, 0, item);
    saveQueue(newQueue);
  }, [queue, saveQueue]);

  const handleQueueClearChecked = useCallback(() => {
    const newQueue = queue.filter(item => {
      if (item.type === 'ref' && item.nodeId && tree) {
        const result = findNodeById(tree, item.nodeId);
        if (result) return !result.node.checked;
      }
      return !item.checked;
    });
    saveQueue(newQueue);
  }, [queue, tree, saveQueue]);

  // --- Edit save handler ---
  const handleEditSave = useCallback(({ text, deadline, deadlineTime, deadlineDuration, priority, markdown }) => {
    if (editTarget.type === 'tree') {
      const newTree = updateNodeAtPath(editTarget.path, editTarget.index, node => ({
        ...node, text, deadline: deadline || undefined, deadlineTime: deadlineTime || undefined,
        deadlineDuration: deadlineDuration || undefined, priority: priority || undefined,
        markdown: markdown || undefined,
      }));
      saveTree(newTree);
    } else if (editTarget.type === 'queue') {
      const item = editTarget.queueItem;
      if (item.type === 'ref' && item.nodeId && tree) {
        const result = findNodeById(tree, item.nodeId);
        if (result) {
          const newTree = updateNodeAtPath(result.path, result.index, node => ({
            ...node, text, deadline: deadline || undefined, deadlineTime: deadlineTime || undefined,
            deadlineDuration: deadlineDuration || undefined, priority: priority || undefined,
            markdown: markdown || undefined,
          }));
          saveTree(newTree);
        }
      } else {
        const newQueue = [...queue];
        newQueue[editTarget.index] = {
          ...item, text, deadline: deadline || undefined, deadlineTime: deadlineTime || undefined,
          deadlineDuration: deadlineDuration || undefined, priority: priority || undefined,
          markdown: markdown || undefined,
        };
        saveQueue(newQueue);
      }
    } else if (editTarget.type === 'queue-new') {
      const newItem = { type: 'temp', text, checked: false, deadline: deadline || undefined,
        priority: priority || undefined };
      saveQueue([...queue, newItem]);
    }
    setEditVisible(false);
    setEditTarget(null);
  }, [editTarget, tree, queue, updateNodeAtPath, saveTree, saveQueue]);

  // --- Action menu handlers ---
  const handleActionAddChild = useCallback(() => {
    if (!actionMenu) return;
    const { path, index } = actionMenu;
    const newTree = cloneTree(tree);
    let nodes = newTree;
    for (const idx of path) nodes = nodes[idx].children;
    const parent = nodes[index];
    const newNode = { text: '', checked: false, children: [], id: crypto.randomUUID() };
    parent.children.push(newNode);
    saveTree(newTree);
    setActionMenu(null);
    // Drill into the parent and edit the new child
    const newPath = [...path, index];
    setTreePath(newPath);
    setEditTarget({ type: 'tree', path: newPath, index: parent.children.length - 1, node: newNode });
    setEditVisible(true);
  }, [actionMenu, tree, saveTree]);

  const handleActionAddToQueue = useCallback(() => {
    if (!actionMenu) return;
    const node = actionMenu.node;
    const newItem = { type: 'ref', nodeId: node.id, checked: false };
    saveQueue([...queue, newItem]);
    setActionMenu(null);
  }, [actionMenu, queue, saveQueue]);

  const handleActionEdit = useCallback(() => {
    if (!actionMenu) return;
    setEditTarget({ type: 'tree', path: actionMenu.path, index: actionMenu.index, node: actionMenu.node });
    setEditVisible(true);
    setActionMenu(null);
  }, [actionMenu]);

  const handleActionToggleMarkdown = useCallback(() => {
    if (!actionMenu) return;
    const newTree = updateNodeAtPath(actionMenu.path, actionMenu.index, node => ({
      ...node, markdown: !node.markdown,
    }));
    saveTree(newTree);
    setActionMenu(null);
  }, [actionMenu, updateNodeAtPath, saveTree]);

  if (loading) {
    return <div className="mobile-app mobile-loading">Loading...</div>;
  }

  const editNode = editTarget?.node || {};

  return (
    <div className="mobile-app">
      {/* Main content area */}
      <div className="mobile-content">
        {tab === 'tree' && tree && (
          <MobileTreeScreen
            tree={tree}
            path={treePath}
            onPathChange={setTreePath}
            onCheck={handleTreeCheck}
            onDelete={handleTreeDelete}
            onAddNode={handleTreeAddNode}
            onLongPress={handleTreeLongPress}
          />
        )}
        {tab === 'queue' && (
          <MobileQueueScreen
            queue={queue}
            tree={tree}
            onToggleCheck={handleQueueToggleCheck}
            onDelete={handleQueueDelete}
            onEdit={handleQueueEdit}
            onAddTemp={handleQueueAddTemp}
            onShowInTree={handleQueueShowInTree}
            onReorder={handleQueueReorder}
            onClearChecked={handleQueueClearChecked}
          />
        )}
        {tab === 'settings' && (
          <MobileSettingsScreen
            session={session}
            settings={settings}
            onUpdateSettings={(key, value) => updateSettings({ [key]: value })}
            onLogout={() => supabase.auth.signOut()}
            onOpenBackups={() => {}}
            onOpenCalendarFeed={() => {}}
          />
        )}
      </div>

      {/* Tab bar */}
      <div className="mobile-tab-bar">
        <button className={`mobile-tab ${tab === 'tree' ? 'active' : ''}`} onClick={() => setTab('tree')}>
          <span className="mobile-tab-icon">🌲</span>
          <span className="mobile-tab-label">Tree</span>
        </button>
        <button className={`mobile-tab ${tab === 'queue' ? 'active' : ''}`} onClick={() => setTab('queue')}>
          <span className="mobile-tab-icon">📋</span>
          <span className="mobile-tab-label">Queue</span>
          {queue.length > 0 && <span className="mobile-tab-badge">{queue.length}</span>}
        </button>
        <button className={`mobile-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
          <span className="mobile-tab-icon">⚙️</span>
          <span className="mobile-tab-label">Settings</span>
        </button>
      </div>

      {/* Action menu (bottom sheet) */}
      {actionMenu && (
        <div className="mobile-action-overlay" onClick={() => setActionMenu(null)}>
          <div className="mobile-action-sheet" onClick={e => e.stopPropagation()}>
            <div className="mobile-action-handle" />
            <button className="mobile-action-btn" onClick={handleActionEdit}>Edit</button>
            <button className="mobile-action-btn" onClick={handleActionAddChild}>Add child</button>
            <button className="mobile-action-btn" onClick={handleActionAddToQueue}>Add to queue</button>
            <button className="mobile-action-btn" onClick={handleActionToggleMarkdown}>
              {actionMenu.node?.markdown ? 'Disable markdown' : 'Enable markdown'}
            </button>
            <button className="mobile-action-btn danger" onClick={() => {
              handleTreeDelete(actionMenu.path, actionMenu.index);
              setActionMenu(null);
            }}>Delete</button>
            <button className="mobile-action-btn cancel" onClick={() => setActionMenu(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Edit screen */}
      <MobileEditScreen
        visible={editVisible}
        initialText={editNode.text || ''}
        initialDeadline={editNode.deadline || null}
        initialDeadlineTime={editNode.deadlineTime || null}
        initialDeadlineDuration={editNode.deadlineDuration || null}
        initialPriority={editNode.priority || null}
        initialMarkdown={editNode.markdown || false}
        onSave={handleEditSave}
        onCancel={() => { setEditVisible(false); setEditTarget(null); }}
      />
    </div>
  );
}
