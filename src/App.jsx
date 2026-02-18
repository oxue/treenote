import { useState, useEffect, useCallback, useRef } from 'react';
import { parseMarkdownTree, serializeTree } from './parser';
import {
  cloneTree,
  editNodeText,
  insertSiblingBelow,
  insertSiblingAbove,
  insertParent,
  insertChild,
  deleteNodeWithChildren,
  deleteNodeKeepChildren,
  swapUp,
  swapDown,
  toggleChecked,
  deleteCheckedNodes,
  mergeIntoParent,
  moveToParentLevel,
  moveToSibling,
} from './actions';
import ChildCount from './components/ChildCount';
import Linkify from './components/Linkify';
import SettingsModal from './components/SettingsModal';
import { DeleteConfirmModal, ClearCheckedModal } from './components/ConfirmModals';
import HotkeyLegend from './components/HotkeyLegend';
import QueueBar from './components/QueueBar';
import useEjectAnimation from './hooks/useEjectAnimation';
import useSlideAnimation from './hooks/useSlideAnimation';
import useSvgLines from './hooks/useSvgLines';
import './App.css';

export default function App() {
  const [tree, setTree] = useState(null);
  const [path, setPath] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState('visual');
  const [undoStack, setUndoStack] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [clearCheckedConfirm, setClearCheckedConfirm] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitial, setSettingsInitial] = useState({ path: '', physics: null });
  const [toast, setToast] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [physics, setPhysics] = useState({ vx: 1.2, vy: -1.2, gravity: 0.4, spin: 0.04 });
  const [focus, setFocus] = useState('graph');
  const editInputRef = useRef(null);
  const queueEditRef = useRef(null);
  const fileInputRef = useRef(null);

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

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e) {
      // Cmd+S saves in any mode
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (tree && window.treenote?.saveDefaultFile) {
          window.treenote.saveDefaultFile(serializeTree(tree)).then((ok) => {
            setToast(ok ? 'Saved' : 'Save failed');
            setTimeout(() => setToast(null), 1000);
          });
        }
        return;
      }

      if (mode === 'edit') return;

      // Settings modal — Escape closes it
      if (settingsOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setSettingsOpen(false);
        }
        return;
      }

      // Delete confirmation modal keys
      if (deleteConfirm) {
        e.preventDefault();
        if (e.key === '1') {
          applyAction(deleteNodeWithChildren(tree, path, selectedIndex));
          setDeleteConfirm(false);
        } else if (e.key === '2') {
          applyAction(deleteNodeKeepChildren(tree, path, selectedIndex));
          setDeleteConfirm(false);
        } else if (e.key === '3' || e.key === 'Escape') {
          setDeleteConfirm(false);
        }
        return;
      }

      // Clear checked confirmation modal keys
      if (clearCheckedConfirm) {
        e.preventDefault();
        if (e.key === '1' || e.key === 'Enter') {
          const result = deleteCheckedNodes(tree, path, selectedIndex);
          if (result) applyAction(result);
          setClearCheckedConfirm(false);
        } else if (e.key === '2' || e.key === 'Escape') {
          setClearCheckedConfirm(false);
        }
        return;
      }

      if (!tree) return;
      const nodes = getCurrentNodes();
      if (nodes.length === 0 && focus === 'graph') return;
      if (animatingRef.current && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) return;

      const isMeta = e.metaKey || e.ctrlKey;

      // Queue focus key bindings
      if (focus === 'queue') {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            if (isMeta) {
              // Insert temp box to the left
              setQueue(q => {
                const newQ = [...q];
                newQ.splice(queueIndex, 0, { type: 'temp', text: '', checked: false });
                return newQ;
              });
            } else if (e.shiftKey) {
              // Reorder left
              if (queueIndex > 0) {
                setQueue(q => {
                  const newQ = [...q];
                  [newQ[queueIndex - 1], newQ[queueIndex]] = [newQ[queueIndex], newQ[queueIndex - 1]];
                  return newQ;
                });
                setQueueIndex(i => i - 1);
              }
            } else {
              setQueueIndex(i => Math.max(0, i - 1));
            }
            break;
          case 'ArrowRight':
            e.preventDefault();
            if (isMeta) {
              // Insert temp box to the right
              setQueue(q => {
                const newQ = [...q];
                newQ.splice(queueIndex + 1, 0, { type: 'temp', text: '', checked: false });
                return newQ;
              });
              setQueueIndex(i => i + 1);
            } else if (e.shiftKey) {
              // Reorder right
              if (queueIndex < queue.length - 1) {
                setQueue(q => {
                  const newQ = [...q];
                  [newQ[queueIndex], newQ[queueIndex + 1]] = [newQ[queueIndex + 1], newQ[queueIndex]];
                  return newQ;
                });
                setQueueIndex(i => i + 1);
              }
            } else {
              setQueueIndex(i => Math.min(queue.length - 1, i + 1));
            }
            break;
          case 'ArrowDown':
            e.preventDefault();
            setFocus('graph');
            setSelectedIndex(0);
            break;
          case 'ArrowUp':
            e.preventDefault();
            break;
          case 'c':
            e.preventDefault();
            if (queue[queueIndex]) {
              if (queue[queueIndex].checked) {
                setQueue(q => q.map((it, idx) => idx === queueIndex ? { ...it, checked: false } : it));
              } else {
                ejectQueueItem(queueIndex);
              }
            }
            break;
          case 'x':
            e.preventDefault();
            if (queue.length > 0) {
              setQueue(q => q.filter((_, i) => i !== queueIndex));
              setQueueIndex(i => Math.min(i, queue.length - 2));
              if (queue.length <= 1) {
                setFocus('graph');
                setQueueIndex(0);
              }
            }
            break;
          case 'Enter':
            e.preventDefault();
            if (queue[queueIndex] && queue[queueIndex].type === 'temp') {
              setMode('edit');
            }
            break;
          case 'q':
            e.preventDefault();
            if (queue[queueIndex] && queue[queueIndex].type === 'ref') {
              const item = queue[queueIndex];
              setPath(item.path);
              setSelectedIndex(item.index);
              setFocus('graph');
            }
            break;
        }
        return;
      }

      // Graph focus key bindings
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (isMeta) {
            applyAction(insertSiblingAbove(tree, path, selectedIndex));
          } else if (e.altKey) {
            const result = moveToSibling(tree, path, selectedIndex, -1);
            if (result) applyAction(result);
          } else if (e.shiftKey) {
            const result = swapUp(tree, path, selectedIndex);
            if (result) applyAction(result);
          } else {
            if (selectedIndex <= 0) {
              // At top — enter queue if it has items
              if (queue.length > 0) {
                setFocus('queue');
                setQueueIndex(queue.length - 1);
              }
            } else {
              setSelectedIndex(i => i - 1);
            }
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (isMeta) {
            applyAction(insertSiblingBelow(tree, path, selectedIndex));
          } else if (e.altKey) {
            const result = moveToSibling(tree, path, selectedIndex, 1);
            if (result) applyAction(result);
          } else if (e.shiftKey) {
            const result = swapDown(tree, path, selectedIndex);
            if (result) applyAction(result);
          } else {
            // No wrap-around — stop at bottom
            setSelectedIndex(i => i >= nodes.length - 1 ? i : i + 1);
          }
          break;
        case 'ArrowRight': {
          e.preventDefault();
          if (isMeta) {
            const result = insertChild(tree, path, selectedIndex);
            if (result) applyAction(result);
          } else {
            const selected = nodes[selectedIndex];
            if (selected && selected.children.length > 0) {
              slideNavigate('right', [...path, selectedIndex], 0);
            }
          }
          break;
        }
        case 'ArrowLeft':
          e.preventDefault();
          if (isMeta) {
            const result = insertParent(tree, path, selectedIndex);
            if (result) applyAction(result);
          } else if (e.altKey) {
            const result = moveToParentLevel(tree, path, selectedIndex);
            if (result) applyAction(result);
          } else if (path.length > 0) {
            slideNavigate('left', path.slice(0, -1), path[path.length - 1]);
          }
          break;
        case 'Enter':
          e.preventDefault();
          enterEditMode();
          break;
        case 'z':
          e.preventDefault();
          undo();
          break;
        case 'c':
          e.preventDefault();
          if (selectedNode) {
            applyAction(toggleChecked(tree, path, selectedIndex));
          }
          break;
        case 'x':
          e.preventDefault();
          if (isMeta) {
            const hasChecked = nodes.some(n => n.checked);
            if (hasChecked) setClearCheckedConfirm(true);
          } else if (selectedNode) {
            if (selectedNode.children.length > 0) {
              setDeleteConfirm(true);
            } else {
              applyAction(deleteNodeWithChildren(tree, path, selectedIndex));
            }
          }
          break;
        case 'q':
          e.preventDefault();
          if (selectedNode) {
            setQueue(q => [...q, {
              type: 'ref',
              path: [...path],
              index: selectedIndex,
              text: selectedNode.text,
              checked: selectedNode.checked || false,
            }]);
          }
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tree, path, selectedIndex, selectedNode, mode, deleteConfirm, clearCheckedConfirm, settingsOpen, getCurrentNodes, slideNavigate, enterEditMode, undo, applyAction, focus, queue, queueIndex]);

  // Scroll selected item into view
  useEffect(() => {
    const el = currentColRef.current?.querySelector('.node-box.selected, .node-box.editing');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, path]);

  // Load default file and settings on startup (Electron only)
  useEffect(() => {
    if (window.treenote?.getDefaultFile) {
      window.treenote.getDefaultFile().then((content) => {
        if (content) {
          const parsed = parseMarkdownTree(content);
          setTree(parsed);
          setPath([]);
          setSelectedIndex(0);
        }
      });
    }
    if (window.treenote?.getSettings) {
      window.treenote.getSettings().then((config) => {
        if (config.physics) setPhysics(config.physics);
      });
    }
  }, []);

  function handleFileLoad(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseMarkdownTree(ev.target.result);
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
        {tree && (
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
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt"
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
                    setTree(parseMarkdownTree(content));
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
      <HotkeyLegend mode={mode} />
    </div>
  );
}
