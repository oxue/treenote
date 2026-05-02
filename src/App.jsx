import { useState, useEffect, useCallback, useRef } from 'react';
import { parseTree, serializeTree } from './treeIO';
import {
  cloneTree,
  editNodeText,
  deleteNodeWithChildren,
  deleteNodeKeepChildren,
  deleteCheckedNodes,
  ensureIds,
  findNodeById,
} from './actions';
import NodeContent from './components/NodeContent';
import NodeMeta from './components/NodeMeta';
import NodeEditor from './components/NodeEditor';
import SettingsModal from './components/SettingsModal';
import BackupModal from './components/BackupModal';
import { DeleteConfirmModal, ClearCheckedModal } from './components/ConfirmModals';
import useRealtimeSync from './hooks/useRealtimeSync';
import HotkeyLegend from './components/HotkeyLegend';
import QueueBar from './components/QueueBar';
import MetadataPanel from './components/MetadataPanel';
import CalendarFeedModal from './components/CalendarFeedModal';
import EmojiPicker from './components/EmojiPicker';
import useToast from './hooks/useToast';
import useEjectAnimation from './hooks/useEjectAnimation';
import useSlideAnimation from './hooks/useSlideAnimation';
import useSvgLines from './hooks/useSvgLines';
import useKeyboard from './hooks/useKeyboard';
import useSwapAnimation from './hooks/useSwapAnimation';
import useSettings from './hooks/useSettings';
import WebSettingsPanel from './components/WebSettingsPanel';
import { loadUserTree, saveUserTree, loadUserQueue, saveUserQueue, saveBackup, deleteOldBackups } from './storage';
import { exportNodeAsHtml } from './exportHtml';
import { supabase } from './supabaseClient';
import { Capacitor } from '@capacitor/core';
import './theme.css';
import './App.css';
import './components/deadline.css';

function getDefaultTree() {
  return [
    { text: 'Welcome to Treenote', checked: false, children: [
      { text: 'Navigation', checked: false, children: [
        { text: 'Arrow keys or hjkl to move around', checked: false, children: [] },
        { text: 'Right arrow drills into children', checked: false, children: [] },
        { text: 'Left arrow goes back to parent', checked: false, children: [] },
        { text: 'Arrow up at the top enters the queue', checked: false, children: [] },
      ]},
      { text: 'Editing', checked: false, children: [
        { text: 'Enter to edit a node', checked: false, children: [] },
        { text: 'Escape to save and exit edit mode', checked: false, children: [] },
        { text: 'Type :emoji for emoji picker', checked: false, children: [] },
      ]},
      { text: 'Adding and removing', checked: false, children: [
        { text: 'Cmd+Down to add a node below', checked: false, children: [] },
        { text: 'Cmd+Up to add above', checked: false, children: [] },
        { text: 'Cmd+Right to add a child', checked: false, children: [] },
        { text: 'x to delete, c to check off', checked: false, children: [] },
        { text: 'z to undo, Shift+Z to redo', checked: false, children: [] },
      ]},
      { text: 'Queue', checked: false, children: [
        { text: 'Press q to send a node to the queue', checked: false, children: [] },
        { text: 'Queue items appear at the top of the screen', checked: false, children: [] },
        { text: 'Press c in the queue to check off (with physics!)', checked: false, children: [] },
        { text: 'Shift+Left/Right to reorder queue items', checked: false, children: [] },
      ]},
      { text: 'Deadlines and metadata', checked: false, children: [
        { text: 'Press d to set a deadline, time, duration, or priority', checked: false, children: [] },
        { text: 'Tab switches between fields in the metadata panel', checked: false, children: [] },
        { text: 'Press f to get a calendar feed URL for Google/Apple Calendar', checked: false, children: [] },
      ]},
      { text: 'Other features', checked: false, children: [
        { text: 'Press m to toggle markdown rendering on a node', checked: false, children: [] },
        { text: 'Press s to open settings (themes, keybindings)', checked: false, children: [] },
        { text: 'Press b to open backup manager', checked: false, children: [] },
        { text: 'Press l to toggle the hotkey legend', checked: false, children: [] },
        { text: 'Cmd+S to save manually (auto-saves too)', checked: false, children: [] },
      ]},
    ]},
    { text: 'My first project', checked: false, children: [
      { text: 'Add your tasks here', checked: false, children: [] },
    ]},
  ];
}

export default function App({ session }) {
  const userId = session?.user?.id;
  const [tree, setTree] = useState(null);
  const [path, setPath] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState('visual');
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [clearCheckedConfirm, setClearCheckedConfirm] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [settingsInitial, setSettingsInitial] = useState({ path: '', physics: null });
  const { toast, show: showToast } = useToast();
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [physics, setPhysics] = useState({ vx: 1.2, vy: -1.2, gravity: 0.4, spin: 0.04 });
  const [focus, setFocus] = useState('graph');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarFeedOpen, setCalendarFeedOpen] = useState(false);
  const [legendVisible, setLegendVisible] = useState(true);
  const [webSettingsOpen, setWebSettingsOpen] = useState(false);
  const [emojiPicker, setEmojiPicker] = useState({ visible: false, query: '', position: { top: 0, left: 0 }, selectedIdx: 0 });
  const { settings, updateSettings } = useSettings();
  const editInputRef = useRef(null);
  const selectedNodeRef = useRef(null);
  const queueEditRef = useRef(null);
  const fileInputRef = useRef(null);
  const loadedRef = useRef(false);
  const versionRef = useRef(0);
  const lastSyncedTreeRef = useRef(null);
  const lastSyncedQueueRef = useRef(null);
  const treeRef = useRef(null);
  const queueRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const queueSaveTimeoutRef = useRef(null);

  // Sync queue to widget via shared UserDefaults
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
      console.log('[Widget] Writing snapshot, items:', snapshot.length);
      WidgetBridge.setItem({
        key: 'queueSnapshot',
        value: JSON.stringify(snapshot),
        group: 'group.zenica.treenotequeue',
      }).then(res => {
        console.log('[Widget] setItem result:', JSON.stringify(res));
        return WidgetBridge.reloadAllTimelines();
      }).then(res => {
        console.log('[Widget] reloadTimelines result:', JSON.stringify(res));
      }).catch(err => {
        console.error('[Widget] Error:', err);
      });
    }).catch(err => console.error('[Widget] Import error:', err));
  }, [queue, tree]);

  const { ejecting, ejectQueueItem } = useEjectAnimation(physics, queue, setQueue, setFocus, setQueueIndex, focus);
  const { sliderRef, animatingRef, slideNavigate } = useSlideAnimation(setPath, setSelectedIndex);

  const getCurrentNodes = useCallback(() => {
    if (!tree) return [];
    let nodes = tree;
    for (const idx of path) {
      nodes = nodes[idx].children;
    }
    return nodes;
  }, [tree, path]);

  const getParentNodes = useCallback(() => {
    if (!tree || path.length === 0) return [];
    let nodes = tree;
    for (let i = 0; i < path.length - 1; i++) {
      nodes = nodes[path[i]].children;
    }
    return nodes;
  }, [tree, path]);

  const getBreadcrumb = useCallback(() => {
    if (!tree) return [];
    const crumbs = [];
    let nodes = tree;
    for (const idx of path) {
      const node = nodes[idx];
      const firstLine = (node.text || '').split('\n')[0];
      if (node.markdown) {
        const plain = firstLine
          .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')   // images
          .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')     // links
          .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')   // bold/italic
          .replace(/~~(.*?)~~/g, '$1')                  // strikethrough
          .replace(/`([^`]+)`/g, '$1')                  // inline code
          .replace(/^#{1,6}\s+/, '')                     // headings
          .replace(/^>\s?/gm, '')                        // blockquotes
          .replace(/^[-*+]\s+/, '')                      // list markers
          .replace(/^\d+\.\s+/, '');                     // ordered list markers
        crumbs.push(plain);
      } else {
        crumbs.push(firstLine);
      }
      nodes = node.children;
    }
    return crumbs;
  }, [tree, path]);

  const currentNodes = getCurrentNodes();
  const parentNodes = getParentNodes();
  const parentSelectedIndex = path.length > 0 ? path[path.length - 1] : -1;
  const breadcrumb = getBreadcrumb();
  const selectedNode = currentNodes[selectedIndex];
  const childNodes = selectedNode ? selectedNode.children : [];

  useEffect(() => { treeRef.current = tree; }, [tree]);
  useEffect(() => { queueRef.current = queue; }, [queue]);

  const cancelPendingSaves = useCallback(() => {
    if (saveTimeoutRef.current) { clearTimeout(saveTimeoutRef.current); saveTimeoutRef.current = null; }
    if (queueSaveTimeoutRef.current) { clearTimeout(queueSaveTimeoutRef.current); queueSaveTimeoutRef.current = null; }
  }, []);

  const hasModalOpen = deleteConfirm || clearCheckedConfirm || settingsOpen || backupOpen || calendarOpen || calendarFeedOpen || webSettingsOpen;

  const { broadcast, syncAvailable } = useRealtimeSync({
    userId,
    versionRef,
    mode,
    hasModalOpen,
    selectedNodeId: selectedNode?.id,
    setTree,
    setQueue,
    setPath,
    setSelectedIndex,
    showToast,
    lastSyncedTreeRef,
    lastSyncedQueueRef,
    cancelPendingSaves,
  });

  const { parentColRef, currentColRef, childColRef, leftSvgRef, rightSvgRef, leftLines, rightLines, updateLines } = useSvgLines({
    selectedIndex, path, tree,
    childNodesLength: childNodes.length,
    currentNodesLength: currentNodes.length,
    parentNodesLength: parentNodes.length,
  });

  // Apply an action result and push undo
  const applyAction = useCallback((result) => {
    if (!result || !tree) return;
    setUndoStack(stack => [...stack, { tree: cloneTree(tree), path, selectedIndex, queue: [...queue] }]);
    setRedoStack([]);
    setTree(result.tree);
    setPath(result.path);
    setSelectedIndex(result.selectedIndex);
  }, [tree, path, selectedIndex, queue]);

  const enterEditMode = useCallback(() => {
    if (!selectedNode) return;
    setMode('edit');
  }, [selectedNode]);

  const exitEditMode = useCallback(() => {
    setMode('visual');
  }, []);

  const commitEdit = useCallback((newText) => {
    if (!tree || !selectedNode) return;
    const trimmed = newText.trim();
    if (trimmed === selectedNode.text) {
      exitEditMode();
      return;
    }
    const result = editNodeText(tree, path, selectedIndex, newText);
    applyAction(result);
    exitEditMode();
  }, [tree, path, selectedIndex, selectedNode, applyAction, exitEditMode]);

  // Emoji picker helpers
  const getEmojiQuery = useCallback((textarea) => {
    const text = textarea.value;
    const cursor = textarea.selectionStart;
    const before = text.slice(0, cursor);
    const match = before.match(/:([a-zA-Z0-9_]*)$/);
    return match ? match[1] : null;
  }, []);

  const updateEmojiPicker = useCallback((textarea) => {
    const query = getEmojiQuery(textarea);
    if (query !== null) {
      const rect = textarea.getBoundingClientRect();
      setEmojiPicker(prev => ({
        visible: true,
        query,
        position: { top: rect.bottom + 4, left: rect.left },
        selectedIdx: query !== prev.query ? 0 : prev.selectedIdx,
      }));
    } else {
      setEmojiPicker(prev => prev.visible ? { ...prev, visible: false } : prev);
    }
  }, [getEmojiQuery]);

  const insertEmoji = useCallback((textarea, emoji) => {
    const text = textarea.value;
    const cursor = textarea.selectionStart;
    const before = text.slice(0, cursor);
    const colonIdx = before.lastIndexOf(':');
    const after = text.slice(cursor);
    const newText = before.slice(0, colonIdx) + emoji + after;
    textarea.value = newText;
    const newCursor = colonIdx + emoji.length;
    textarea.selectionStart = newCursor;
    textarea.selectionEnd = newCursor;
    setEmojiPicker({ visible: false, query: '', position: { top: 0, left: 0 }, selectedIdx: 0 });
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(stack => stack.slice(0, -1));
    setRedoStack(stack => [...stack, { tree: cloneTree(tree), path, selectedIndex, queue: [...queue] }]);
    setTree(prev.tree);
    setPath(prev.path);
    setSelectedIndex(prev.selectedIndex);
    if (prev.queue) setQueue(prev.queue);
  }, [undoStack, tree, path, selectedIndex, queue]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(stack => stack.slice(0, -1));
    setUndoStack(stack => [...stack, { tree: cloneTree(tree), path, selectedIndex, queue: [...queue] }]);
    setTree(next.tree);
    setPath(next.path);
    setSelectedIndex(next.selectedIndex);
    if (next.queue) setQueue(next.queue);
  }, [redoStack, tree, path, selectedIndex, queue]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (mode === 'edit' && focus === 'graph' && editInputRef.current) {
      const el = editInputRef.current;
      el.focus();
      if (el.value === '# ') {
        el.setSelectionRange(el.value.length, el.value.length);
      } else {
        el.select();
      }
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
    if (mode === 'edit' && focus === 'queue' && queueEditRef.current) {
      const el = queueEditRef.current;
      el.focus();
      if (el.value === '# ') {
        el.setSelectionRange(el.value.length, el.value.length);
      } else {
        el.select();
      }
    }
  }, [mode, focus]);

  const handleSave = useCallback(() => {
    if (!tree) return;
    if (userId) {
      saveUserTree(userId, tree, versionRef.current).then((result) => {
        if (result.success) {
          versionRef.current = result.version;
          broadcast(tree, result.version, queueRef.current);
          showToast('Saved', 1000);
        } else {
          // Version mismatch — silently apply server state
          ensureIds(result.serverTree);
          lastSyncedTreeRef.current = result.serverTree;
          setTree(result.serverTree);
          versionRef.current = result.version;
          showToast('Synced from another device');
        }
      }).catch(() => {
        showToast('Save failed', 1000);
      });
    }
  }, [tree, userId, broadcast, showToast]);

  const setNodeProperty = useCallback((prop, value) => {
    if (!tree || !selectedNode) return;
    const newTree = cloneTree(tree);
    let nodes = newTree;
    for (const idx of path) nodes = nodes[idx].children;
    nodes[selectedIndex][prop] = value;
    setUndoStack(stack => [...stack, { tree: cloneTree(tree), path, selectedIndex }]);
    setRedoStack([]);
    setTree(newTree);
  }, [tree, path, selectedIndex, selectedNode]);

  const pushUndo = useCallback(() => {
    setUndoStack(stack => [...stack, { tree: cloneTree(tree), path, selectedIndex, queue: [...queue] }]);
    setRedoStack([]);
  }, [tree, path, selectedIndex, queue]);

  const { prepareSwap } = useSwapAnimation(currentColRef, updateLines);

  const handleExport = useCallback(async (node) => {
    const target = node || selectedNode;
    if (!target) return;
    showToast('Exporting…', 1500);
    try {
      await exportNodeAsHtml(target, settings.theme, settings.boxWidth, window.location.origin);
      showToast('Exported ✓', 1500);
    } catch (err) {
      console.error('[export]', err);
      showToast('Export failed', 2000);
    }
  }, [selectedNode, settings.theme, settings.boxWidth, showToast]);

  useKeyboard({
    tree, path, selectedIndex, selectedNode, mode, deleteConfirm, clearCheckedConfirm, settingsOpen, backupOpen,
    getCurrentNodes, slideNavigate, enterEditMode, undo, redo, applyAction, animatingRef, ejectQueueItem,
    focus, queue, queueIndex, pushUndo, prepareSwap,
    showToast, setSettingsOpen, setDeleteConfirm, setClearCheckedConfirm, setQueue, setQueueIndex,
    setFocus, setSelectedIndex, setPath, setMode, setBackupOpen,
    onSave: userId ? handleSave : undefined,
    calendarOpen, setCalendarOpen,
    calendarFeedOpen, setCalendarFeedOpen,
    setLegendVisible,
    keybindingScheme: settings.keybindingScheme,
    webSettingsOpen, setWebSettingsOpen,
    defaultMarkdown: settings.defaultMarkdown,
    onExport: handleExport,
  });

  // Scroll selected item into view
  useEffect(() => {
    const el = currentColRef.current?.querySelector('.node-box.selected, .node-box.editing');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, path]);

  // Load tree on startup — always from Supabase when logged in
  useEffect(() => {
    loadedRef.current = false;
    if (userId) {
      // Backup current tree before overwriting with loaded data
      loadUserTree(userId).then(async ({ tree: existing, version }) => {
        versionRef.current = version;
        if (existing) {
          saveBackup(userId, existing).catch(() => {});
        }
        const data = existing;
        if (data) {
          ensureIds(data);
          setTree(data);
          setPath([]);
          setSelectedIndex(0);
        } else if (window.treenote?.getDefaultFile) {
          // New cloud user in Electron — migrate local file to cloud
          const content = await window.treenote.getDefaultFile();
          if (content) {
            const parsed = parseTree(content);
            ensureIds(parsed);
            setTree(parsed);
            setPath([]);
            setSelectedIndex(0);
            // Save local data to cloud
            saveUserTree(userId, parsed).catch(() => {});
          } else {
            const defaultTree = getDefaultTree();
            ensureIds(defaultTree);
            setTree(defaultTree);
          }
        } else {
          // New cloud user on web — default tree
          const defaultTree = [{ text: 'Welcome to Treenote', checked: false, children: [
            { text: 'Use arrow keys to navigate', checked: false, children: [] },
            { text: 'Press Enter to edit', checked: false, children: [] },
            { text: 'Press Cmd+Down to add items', checked: false, children: [] },
          ]}];
          ensureIds(defaultTree);
          setTree(defaultTree);
        }
        loadedRef.current = true;
      }).catch(() => {
        // Do NOT set a default tree — it would get auto-saved and wipe real data
        showToast('Failed to load notes. Please refresh.', 5000);
      });
    }
    // Load queue from cloud
    if (userId) {
      loadUserQueue(userId).then((data) => {
        if (data && data.length > 0) setQueue(data);
      }).catch(() => {});
    }
    if (window.treenote?.getSettings) {
      window.treenote.getSettings().then((config) => {
        if (config.physics) setPhysics(config.physics);
      });
    }
  }, [userId]);

  // Auto-save to Supabase when tree changes (debounced, with OCC)
  useEffect(() => {
    if (!userId || !tree || !loadedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = null;
    if (tree === lastSyncedTreeRef.current) return;
    saveTimeoutRef.current = setTimeout(() => {
      saveUserTree(userId, tree, versionRef.current).then((result) => {
        if (result.success) {
          versionRef.current = result.version;
          broadcast(tree, result.version, queueRef.current);
        } else {
          // Version mismatch — silently apply server state
          ensureIds(result.serverTree);
          lastSyncedTreeRef.current = result.serverTree;
          setTree(result.serverTree);
          versionRef.current = result.version;
          showToast('Synced from another device');
        }
      }).catch(() => {
        showToast('Auto-save failed');
      });
    }, 1500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [tree, userId, broadcast]);

  // Auto-save queue to Supabase when queue changes (debounced)
  useEffect(() => {
    if (!userId) return;
    if (queueSaveTimeoutRef.current) clearTimeout(queueSaveTimeoutRef.current);
    queueSaveTimeoutRef.current = null;
    if (queue === lastSyncedQueueRef.current) return;
    queueSaveTimeoutRef.current = setTimeout(() => {
      saveUserQueue(userId, queue)
        .then(() => broadcast(treeRef.current, versionRef.current, queue))
        .catch(() => {});
    }, 1500);
    return () => {
      if (queueSaveTimeoutRef.current) clearTimeout(queueSaveTimeoutRef.current);
    };
  }, [queue, userId, broadcast]);

  // Periodic auto-backup every 5 minutes
  useEffect(() => {
    if (!userId || !tree) return;
    const interval = setInterval(() => {
      saveBackup(userId, tree)
        .then(() => deleteOldBackups(userId, 20))
        .catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId, tree]);

  function handleFileLoad(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseTree(ev.target.result);
      ensureIds(parsed);
      setTree(parsed);
      setPath([]);
      setSelectedIndex(0);
      setUndoStack([]);
      setRedoStack([]);
      setMode('visual');
    };
    reader.readAsText(file);
  }

  function handleNodeClick(i) {
    if (focus === 'queue') {
      setFocus('graph');
      setMode('visual');
    }
    if (mode === 'edit' && i !== selectedIndex) {
      exitEditMode();
      setSelectedIndex(i);
    } else if (i === selectedIndex) {
      enterEditMode();
    } else {
      setSelectedIndex(i);
    }
  }

  return (
    <div className="app" onClick={(e) => {
      if (mode === 'edit' && focus === 'queue' && !e.target.closest('.queue-item')) {
        if (queueEditRef.current) {
          const newText = queueEditRef.current.value.trim();
          const item = queue[queueIndex];
          pushUndo();
          setQueue(q => q.map((it, idx) => idx === queueIndex ? { ...it, text: newText } : it));
          if (item && item.type === 'ref' && item.nodeId) {
            const found = findNodeById(tree, item.nodeId);
            if (found) {
              const result = editNodeText(tree, found.path, found.index, newText);
              if (result) {
                setTree(result.tree);
                setPath(result.path);
                setSelectedIndex(result.selectedIndex);
              }
            }
          }
        }
        setMode('visual');
      } else if (mode === 'edit' && focus === 'graph' && !e.target.closest('.node-box')) {
        if (editInputRef.current) {
          commitEdit(editInputRef.current.value);
        } else {
          exitEditMode();
        }
      }
    }}>
      <div className="toolbar">
        {tree && !userId && (
          <button className="load-btn" onClick={() => {
            if (window.treenote?.saveDefaultFile) {
              window.treenote.saveDefaultFile(serializeTree(tree)).then((ok) => {
                showToast(ok ? 'Saved' : 'Save failed', 1000);
              });
            }
          }}>
            Save
          </button>
        )}
        {tree && userId && (
          <button className="load-btn" onClick={handleSave}>
            <span className="save-dot" />Save
          </button>
        )}
        <button className="load-btn settings-btn" onClick={() => {
          if (window.treenote?.getSettings) {
            window.treenote.getSettings().then((config) => {
              setSettingsInitial({ path: config.defaultFile || '', physics: config.physics || physics });
              setSettingsOpen(true);
            });
          } else {
            setWebSettingsOpen(true);
          }
        }}>
          &#9881;
        </button>
        {userId && (
          <button className="load-btn" onClick={() => supabase.auth.signOut()}>
            Logout
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".yaml,.yml,.md,.txt"
          style={{ display: 'none' }}
          onChange={handleFileLoad}
        />
        <span className={`mode-indicator ${mode}`}>
          {mode}{syncAvailable && <span className="sync-dot" title="Update available">{'\u25CF'}</span>}
        </span>
        {breadcrumb.length > 0 && (
          <div className="breadcrumb">
            {breadcrumb.map((crumb, i) => (
              <span key={i}>
                {i > 0 && <span className="breadcrumb-separator"> &gt; </span>}
                <span
                  className={`breadcrumb-item ${i === breadcrumb.length - 1 ? 'current' : ''}`}
                  onClick={() => {
                    if (i < breadcrumb.length - 1) {
                      if (mode === 'edit') exitEditMode();
                      const newPath = path.slice(0, i);
                      const newSelected = path[i];
                      if (i === breadcrumb.length - 2) {
                        // One level up -- animate
                        slideNavigate('left', newPath, newSelected);
                      } else {
                        // Multiple levels -- jump directly
                        setPath(newPath);
                        setSelectedIndex(newSelected);
                      }
                    }
                  }}
                >
                  {crumb}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      <QueueBar
        queue={queue}
        queueIndex={queueIndex}
        focus={focus}
        mode={mode}
        ejecting={ejecting}
        queueEditRef={queueEditRef}
        tree={tree}
        settings={settings}
        onSelectItem={(i) => {
          if (focus === 'queue' && i === queueIndex) {
            setMode('edit');
          } else {
            setFocus('queue');
            setQueueIndex(i);
          }
        }}
        onUpdateText={(i, text) => {
          const item = queue[i];
          pushUndo();
          setQueue(q => q.map((it, idx) => idx === i ? { ...it, text } : it));
          if (item.type === 'ref' && item.nodeId) {
            const found = findNodeById(tree, item.nodeId);
            if (found) {
              const result = editNodeText(tree, found.path, found.index, text);
              if (result) {
                setTree(result.tree);
                setPath(result.path);
                setSelectedIndex(result.selectedIndex);
              }
            }
          }
        }}
        onExitEdit={() => setMode('visual')}
      />

      {!tree ? (
        <div className="empty-state">
          <span className="empty-state-icon">&#9776;</span>
          <span>Load a file to get started</span>
        </div>
      ) : currentNodes.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">&#8592;</span>
          <span>Empty node &mdash; press <kbd>Left</kbd> to go back</span>
        </div>
      ) : (
        <div className="columns-viewport">
          <div className="columns" ref={sliderRef}>
            {parentNodes.length > 0 ? (
              <>
                <div className="parent-list" ref={parentColRef}>
                  {parentNodes.map((node, i) => (
                    <div
                      key={i}
                      className={`parent-box ${i === parentSelectedIndex ? 'highlighted' : ''} ${node.checked ? 'checked' : ''}`}
                      onClick={() => {
                        if (mode === 'edit') exitEditMode();
                        slideNavigate('left', path.slice(0, -1), i);
                      }}
                    >
                      <NodeContent text={node.text} markdown={node.markdown} />
                      <NodeMeta node={node} />
                    </div>
                  ))}
                </div>
                <svg className="lines-svg" ref={leftSvgRef}>
                  <defs>
                    <linearGradient id="lineGradLeft" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="var(--line-color)" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="var(--line-color)" stopOpacity="0.4" />
                    </linearGradient>
                    <filter id="lineGlow">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  {leftLines.map((l, i) => (
                    <path
                      key={i}
                      d={`M 0 ${l.startY} C 30 ${l.startY}, 30 ${l.endY}, 60 ${l.endY}`}
                      stroke="url(#lineGradLeft)"
                      strokeWidth="1.5"
                      fill="none"
                      filter="url(#lineGlow)"
                    />
                  ))}
                </svg>
              </>
            ) : (
              <div className="column-spacer" />
            )}

            <div className="node-list" ref={currentColRef}>
              {currentNodes.map((node, i) => {
                const isSelected = i === selectedIndex && focus === 'graph';
                const isEditing = isSelected && mode === 'edit';

                return (
                  <div
                    key={i}
                    ref={i === selectedIndex ? selectedNodeRef : undefined}
                    className={`node-box ${isSelected && !isEditing ? 'selected' : ''} ${isEditing ? 'editing' : ''} ${node.checked ? 'checked' : ''}`}
                    onClick={() => handleNodeClick(i)}
                    onDoubleClick={() => {
                      if (mode === 'edit') return;
                      if (node.children.length > 0) {
                        slideNavigate('right', [...path, i], 0);
                      }
                    }}
                  >
                    {!isEditing && <NodeMeta node={node} full />}
                    {isEditing ? (
                      <NodeEditor
                        node={node}
                        editInputRef={editInputRef}
                        onCommit={commitEdit}
                        emojiPicker={emojiPicker}
                        setEmojiPicker={setEmojiPicker}
                        insertEmoji={insertEmoji}
                        updateEmojiPicker={updateEmojiPicker}
                        settings={settings}
                      />
                    ) : (
                      <NodeContent text={node.text} markdown={node.markdown} />
                    )}
                  </div>
                );
              })}
            </div>

            {childNodes.length > 0 && (
              <>
                <svg className="lines-svg" ref={rightSvgRef}>
                  <defs>
                    <linearGradient id="lineGradRight" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="var(--line-color)" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="var(--line-color)" stopOpacity="0.2" />
                    </linearGradient>
                  </defs>
                  {rightLines.map((l, i) => (
                    <path
                      key={i}
                      d={`M 0 ${l.startY} C 30 ${l.startY}, 30 ${l.endY}, 60 ${l.endY}`}
                      stroke="url(#lineGradRight)"
                      strokeWidth="1.5"
                      fill="none"
                      filter="url(#lineGlow)"
                    />
                  ))}
                </svg>
                <div className="child-list" ref={childColRef}>
                  {childNodes.map((child, i) => (
                    <div
                      key={i}
                      className={`child-box ${child.checked ? 'checked' : ''}`}
                      onClick={() => {
                        if (mode === 'edit') exitEditMode();
                        slideNavigate('right', [...path, selectedIndex], i);
                      }}
                    >
                      <NodeContent text={child.text} markdown={child.markdown} />
                      <NodeMeta node={child} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast === 'Saved' && <span className="toast-check">&#10003;</span>}{toast}</div>}
      <EmojiPicker
        query={emojiPicker.query}
        onSelect={(emoji) => {
          if (editInputRef.current) {
            insertEmoji(editInputRef.current, emoji);
            editInputRef.current.focus();
          }
        }}
        position={emojiPicker.position}
        visible={emojiPicker.visible}
        selectedIdx={emojiPicker.selectedIdx}
      />
      {deleteConfirm && (
        <DeleteConfirmModal
          onDeleteWithChildren={() => { applyAction(deleteNodeWithChildren(tree, path, selectedIndex)); setDeleteConfirm(false); }}
          onDeleteKeepChildren={() => { applyAction(deleteNodeKeepChildren(tree, path, selectedIndex)); setDeleteConfirm(false); }}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}
      {clearCheckedConfirm && (
        <ClearCheckedModal
          onConfirm={() => { const r = deleteCheckedNodes(tree, path, selectedIndex); if (r) applyAction(r); setClearCheckedConfirm(false); }}
          onCancel={() => setClearCheckedConfirm(false)}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          initialPath={settingsInitial.path}
          initialPhysics={settingsInitial.physics || physics}
          onSave={({ path: filePath, physics: newPhysics }) => {
            setPhysics(newPhysics);
            window.treenote.saveSettings({ defaultFile: filePath, physics: newPhysics }).then((ok) => {
              if (ok) {
                setSettingsOpen(false);
                showToast('Settings saved', 1000);
                window.treenote.getDefaultFile().then((content) => {
                  if (content) {
                    const parsed = parseTree(content);
                    ensureIds(parsed);
                    setTree(parsed);
                    setPath([]);
                    setSelectedIndex(0);
                    setUndoStack([]);
                    setRedoStack([]);
                  }
                });
              }
            });
          }}
        />
      )}
      {backupOpen && userId && (
        <BackupModal
          userId={userId}
          onClose={() => setBackupOpen(false)}
          onRestore={(treeData) => {
            ensureIds(treeData);
            setTree(treeData);
            setPath([]);
            setSelectedIndex(0);
            setUndoStack([]);
          }}
        />
      )}
      {calendarOpen && selectedNode && (
        <MetadataPanel
          node={selectedNode}
          onSetProperty={setNodeProperty}
          onClose={() => setCalendarOpen(false)}
        />
      )}
      {calendarFeedOpen && userId && (
        <CalendarFeedModal
          userId={userId}
          onClose={() => setCalendarFeedOpen(false)}
        />
      )}
      {webSettingsOpen && (
        <WebSettingsPanel
          onClose={() => setWebSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={updateSettings}
          onExport={() => handleExport(selectedNode)}
          selectedNodeText={selectedNode?.text || ''}
          electronSettings={window.treenote ? settingsInitial : null}
          onSaveElectronSettings={window.treenote ? ({ path: filePath, physics: newPhysics }) => {
            setPhysics(newPhysics);
            window.treenote.saveSettings({ defaultFile: filePath, physics: newPhysics }).then((ok) => {
              if (ok) {
                setWebSettingsOpen(false);
                showToast('Settings saved', 1000);
                window.treenote.getDefaultFile().then((content) => {
                  if (content) {
                    const parsed = parseTree(content);
                    ensureIds(parsed);
                    setTree(parsed);
                    setPath([]);
                    setSelectedIndex(0);
                    setUndoStack([]);
                    setRedoStack([]);
                  }
                });
              }
            });
          } : null}
        />
      )}
      {legendVisible && <HotkeyLegend mode={mode} focus={focus} keybindingScheme={settings.keybindingScheme} enterNewline={settings.enterNewline} />}
    </div>
  );
}
