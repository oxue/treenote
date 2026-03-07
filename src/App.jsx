import { useState, useEffect, useCallback, useRef } from 'react';
import { parseTree, serializeTree } from './treeIO';
import {
  cloneTree,
  editNodeText,
  deleteNodeWithChildren,
  deleteNodeKeepChildren,
  deleteCheckedNodes,
} from './actions';
import ChildCount from './components/ChildCount';
import Linkify from './components/Linkify';
import SettingsModal from './components/SettingsModal';
import BackupModal from './components/BackupModal';
import { DeleteConfirmModal, ClearCheckedModal } from './components/ConfirmModals';
import HotkeyLegend from './components/HotkeyLegend';
import QueueBar from './components/QueueBar';
import useEjectAnimation from './hooks/useEjectAnimation';
import useSlideAnimation from './hooks/useSlideAnimation';
import useSvgLines from './hooks/useSvgLines';
import useKeyboard from './hooks/useKeyboard';
import { loadUserTree, saveUserTree, loadUserQueue, saveUserQueue, saveBackup, deleteOldBackups } from './storage';
import { supabase } from './supabaseClient';
import './App.css';

export default function App({ session }) {
  const userId = session?.user?.id;
  const [tree, setTree] = useState(null);
  const [path, setPath] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState('visual');
  const [undoStack, setUndoStack] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [clearCheckedConfirm, setClearCheckedConfirm] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [settingsInitial, setSettingsInitial] = useState({ path: '', physics: null });
  const [toast, setToast] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [physics, setPhysics] = useState({ vx: 1.2, vy: -1.2, gravity: 0.4, spin: 0.04 });
  const [focus, setFocus] = useState('graph');
  const editInputRef = useRef(null);
  const queueEditRef = useRef(null);
  const fileInputRef = useRef(null);
  const loadedRef = useRef(false);

  const { ejecting, ejectQueueItem } = useEjectAnimation(physics, queue, setQueue, setFocus, setQueueIndex);
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
      crumbs.push(nodes[idx].text);
      nodes = nodes[idx].children;
    }
    return crumbs;
  }, [tree, path]);

  const currentNodes = getCurrentNodes();
  const parentNodes = getParentNodes();
  const parentSelectedIndex = path.length > 0 ? path[path.length - 1] : -1;
  const breadcrumb = getBreadcrumb();
  const selectedNode = currentNodes[selectedIndex];
  const childNodes = selectedNode ? selectedNode.children : [];

  const { parentColRef, currentColRef, childColRef, leftSvgRef, rightSvgRef, leftLines, rightLines } = useSvgLines({
    selectedIndex, path, tree,
    childNodesLength: childNodes.length,
    currentNodesLength: currentNodes.length,
    parentNodesLength: parentNodes.length,
  });

  // Apply an action result and push undo
  const applyAction = useCallback((result) => {
    if (!result || !tree) return;
    setUndoStack(stack => [...stack, cloneTree(tree)]);
    setTree(result.tree);
    setPath(result.path);
    setSelectedIndex(result.selectedIndex);
  }, [tree]);

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

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prevTree = undoStack[undoStack.length - 1];
    setUndoStack(stack => stack.slice(0, -1));
    setTree(prevTree);
  }, [undoStack]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (mode === 'edit' && focus === 'graph' && editInputRef.current) {
      const el = editInputRef.current;
      el.focus();
      el.select();
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
    if (mode === 'edit' && focus === 'queue' && queueEditRef.current) {
      const el = queueEditRef.current;
      el.focus();
      el.select();
    }
  }, [mode, focus]);

  const handleSave = useCallback(() => {
    if (!tree) return;
    if (userId) {
      saveUserTree(userId, tree).then(() => {
        setToast('Saved');
        setTimeout(() => setToast(null), 1000);
      }).catch(() => {
        setToast('Save failed');
        setTimeout(() => setToast(null), 1000);
      });
    }
  }, [tree, userId]);

  useKeyboard({
    tree, path, selectedIndex, selectedNode, mode, deleteConfirm, clearCheckedConfirm, settingsOpen, backupOpen,
    getCurrentNodes, slideNavigate, enterEditMode, undo, applyAction, animatingRef, ejectQueueItem,
    focus, queue, queueIndex,
    setToast, setSettingsOpen, setDeleteConfirm, setClearCheckedConfirm, setQueue, setQueueIndex,
    setFocus, setSelectedIndex, setPath, setMode, setBackupOpen,
    onSave: userId ? handleSave : undefined,
  });

  // Scroll selected item into view
  useEffect(() => {
    const el = currentColRef.current?.querySelector('.node-box.selected, .node-box.editing');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, path]);

  // Auto-save debounce refs
  const saveTimeoutRef = useRef(null);
  const queueSaveTimeoutRef = useRef(null);

  // Load tree on startup — always from Supabase when logged in
  useEffect(() => {
    loadedRef.current = false;
    if (userId) {
      // Backup current tree before overwriting with loaded data
      loadUserTree(userId).then(async (existing) => {
        if (existing) {
          saveBackup(userId, existing).catch(() => {});
        }
        const data = existing;
        if (data) {
          setTree(data);
          setPath([]);
          setSelectedIndex(0);
        } else if (window.treenote?.getDefaultFile) {
          // New cloud user in Electron — migrate local file to cloud
          const content = await window.treenote.getDefaultFile();
          if (content) {
            const parsed = parseTree(content);
            setTree(parsed);
            setPath([]);
            setSelectedIndex(0);
            // Save local data to cloud
            saveUserTree(userId, parsed).catch(() => {});
          } else {
            setTree([{ text: 'Welcome to Treenote', checked: false, children: [
              { text: 'Use arrow keys to navigate', checked: false, children: [] },
              { text: 'Press Enter to edit', checked: false, children: [] },
              { text: 'Press Cmd+Down to add items', checked: false, children: [] },
            ]}]);
          }
        } else {
          // New cloud user on web — default tree
          setTree([{ text: 'Welcome to Treenote', checked: false, children: [
            { text: 'Use arrow keys to navigate', checked: false, children: [] },
            { text: 'Press Enter to edit', checked: false, children: [] },
            { text: 'Press Cmd+Down to add items', checked: false, children: [] },
          ]}]);
        }
        loadedRef.current = true;
      }).catch(() => {
        // Do NOT set a default tree — it would get auto-saved and wipe real data
        setToast('Failed to load notes. Please refresh.');
        setTimeout(() => setToast(null), 5000);
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

  // Auto-save to Supabase when tree changes (debounced)
  useEffect(() => {
    if (!userId || !tree || !loadedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveUserTree(userId, tree).catch(() => {
        setToast('Auto-save failed');
        setTimeout(() => setToast(null), 2000);
      });
    }, 1500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [tree, userId]);

  // Auto-save queue to Supabase when queue changes (debounced)
  useEffect(() => {
    if (!userId) return;
    if (queueSaveTimeoutRef.current) clearTimeout(queueSaveTimeoutRef.current);
    queueSaveTimeoutRef.current = setTimeout(() => {
      saveUserQueue(userId, queue).catch(() => {});
    }, 1500);
    return () => {
      if (queueSaveTimeoutRef.current) clearTimeout(queueSaveTimeoutRef.current);
    };
  }, [queue, userId]);

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
      setTree(parsed);
      setPath([]);
      setSelectedIndex(0);
      setUndoStack([]);
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
      if (mode === 'edit' && focus === 'queue' && !e.target.closest('.queue-box')) {
        if (queueEditRef.current) {
          const newText = queueEditRef.current.value.trim();
          setQueue(q => q.map((it, idx) => idx === queueIndex ? { ...it, text: newText } : it));
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
        <button className="load-btn" onClick={() => fileInputRef.current.click()}>
          Load File
        </button>
        {tree && !userId && (
          <button className="load-btn" onClick={() => {
            if (window.treenote?.saveDefaultFile) {
              window.treenote.saveDefaultFile(serializeTree(tree)).then((ok) => {
                setToast(ok ? 'Saved' : 'Save failed');
                setTimeout(() => setToast(null), 1000);
              });
            }
          }}>
            Save
          </button>
        )}
        {tree && userId && (
          <button className="load-btn" onClick={() => {
            saveUserTree(userId, tree).then(() => {
              setToast('Saved');
              setTimeout(() => setToast(null), 1000);
            }).catch(() => {
              setToast('Save failed');
              setTimeout(() => setToast(null), 1000);
            });
          }}>
            Save
          </button>
        )}
        {window.treenote?.getSettings && (
          <button className="load-btn settings-btn" onClick={() => {
            window.treenote.getSettings().then((config) => {
              setSettingsInitial({ path: config.defaultFile || '', physics: config.physics || physics });
              setSettingsOpen(true);
            });
          }}>
            &#9881;
          </button>
        )}
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
          {mode}
        </span>
        {breadcrumb.length > 0 && (
          <div className="breadcrumb">
            {breadcrumb.map((crumb, i) => (
              <span key={i}>
                {i > 0 && <span className="breadcrumb-separator"> &gt; </span>}
                <span className={`breadcrumb-item ${i === breadcrumb.length - 1 ? 'current' : ''}`}>
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
        onSelectItem={(i) => { setFocus('queue'); setQueueIndex(i); }}
        onUpdateText={(i, text) => setQueue(q => q.map((it, idx) => idx === i ? { ...it, text } : it))}
        onExitEdit={() => setMode('visual')}
      />

      {!tree ? (
        <div className="empty-state">Load a markdown file to get started</div>
      ) : currentNodes.length === 0 ? (
        <div className="empty-state">No children (press Left to go back)</div>
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
                      <span className="node-text"><Linkify text={node.text} /></span>
                      <div className="node-meta">
                        {node.checked && <span>&#10003;</span>}
                        <ChildCount children={node.children} />
                      </div>
                    </div>
                  ))}
                </div>
                <svg className="lines-svg" ref={leftSvgRef}>
                  {leftLines.map((l, i) => (
                    <path
                      key={i}
                      d={`M 0 ${l.startY} C 30 ${l.startY}, 30 ${l.endY}, 60 ${l.endY}`}
                      stroke="#e94560"
                      strokeWidth="1.5"
                      fill="none"
                      opacity="0.35"
                    />
                  ))}
                </svg>
              </>
            ) : (
              <div className="column-spacer" />
            )}

            <div className="node-list" ref={currentColRef}>
              {currentNodes.map((node, i) => {
                const isSelected = i === selectedIndex;
                const isEditing = isSelected && mode === 'edit';

                return (
                  <div
                    key={i}
                    className={`node-box ${isSelected && !isEditing ? 'selected' : ''} ${isEditing ? 'editing' : ''} ${node.checked ? 'checked' : ''}`}
                    onClick={() => handleNodeClick(i)}
                    onDoubleClick={() => {
                      if (mode === 'edit') return;
                      if (node.children.length > 0) {
                        slideNavigate('right', [...path, i], 0);
                      }
                    }}
                  >
                    {isEditing && <span className="edit-icon">&#9998;</span>}
                    {isEditing ? (
                      <textarea
                        ref={editInputRef}
                        className="node-text-input"
                        defaultValue={node.text}
                        rows={1}
                        onInput={(e) => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            commitEdit(e.target.value);
                          }
                          e.stopPropagation();
                        }}
                        onBlur={(e) => {
                          if (mode === 'edit') {
                            commitEdit(e.target.value);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="node-text"><Linkify text={node.text} /></span>
                    )}
                    <div className="node-meta">
                      {node.checked && <span>&#10003;</span>}
                      {node.children.length > 0 && (
                        <span className="child-count">{node.children.length}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {childNodes.length > 0 && (
              <>
                <svg className="lines-svg" ref={rightSvgRef}>
                  {rightLines.map((l, i) => (
                    <path
                      key={i}
                      d={`M 0 ${l.startY} C 30 ${l.startY}, 30 ${l.endY}, 60 ${l.endY}`}
                      stroke="#e94560"
                      strokeWidth="1.5"
                      fill="none"
                      opacity="0.5"
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
                      <span className="node-text"><Linkify text={child.text} /></span>
                      <div className="node-meta">
                        {child.checked && <span>&#10003;</span>}
                        <ChildCount children={child.children} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
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
                setToast('Settings saved');
                setTimeout(() => setToast(null), 1000);
                window.treenote.getDefaultFile().then((content) => {
                  if (content) {
                    setTree(parseTree(content));
                    setPath([]);
                    setSelectedIndex(0);
                    setUndoStack([]);
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
            setTree(treeData);
            setPath([]);
            setSelectedIndex(0);
            setUndoStack([]);
          }}
        />
      )}
      <HotkeyLegend mode={mode} />
    </div>
  );
}
