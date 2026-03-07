import { useEffect } from 'react';
import { serializeTree } from '../treeIO';
import {
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
  moveToParentLevel,
  moveToSibling,
  toggleMarkdown,
} from '../actions';

export default function useKeyboard({
  tree, path, selectedIndex, selectedNode, mode, deleteConfirm, clearCheckedConfirm, settingsOpen, backupOpen,
  getCurrentNodes, slideNavigate, enterEditMode, undo, redo, applyAction, animatingRef, ejectQueueItem,
  focus, queue, queueIndex,
  setToast, setSettingsOpen, setDeleteConfirm, setClearCheckedConfirm, setQueue, setQueueIndex,
  setFocus, setSelectedIndex, setPath, setMode,
  onSave, setBackupOpen,
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      // Cmd+S saves in any mode
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (tree && onSave) {
          onSave();
        } else if (tree && window.treenote?.saveDefaultFile) {
          window.treenote.saveDefaultFile(serializeTree(tree)).then((ok) => {
            setToast(ok ? 'Saved' : 'Save failed');
            setTimeout(() => setToast(null), 1000);
          });
        }
        return;
      }

      if (mode === 'edit') return;

      // Settings / backup modal — Escape closes it
      if (settingsOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setSettingsOpen(false);
        }
        return;
      }

      if (backupOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setBackupOpen(false);
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
            setMode('edit');
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
            setMode('edit');
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
            if (result) { applyAction(result); setMode('edit'); }
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
            if (result) { applyAction(result); setMode('edit'); }
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
        case 'Z':
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
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
        case 'm':
          e.preventDefault();
          if (selectedNode) {
            applyAction(toggleMarkdown(tree, path, selectedIndex));
          }
          break;
        case 'b':
          e.preventDefault();
          setBackupOpen(true);
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tree, path, selectedIndex, selectedNode, mode, deleteConfirm, clearCheckedConfirm, settingsOpen, backupOpen, getCurrentNodes, slideNavigate, enterEditMode, undo, redo, applyAction, focus, queue, queueIndex, animatingRef, ejectQueueItem, setToast, setSettingsOpen, setDeleteConfirm, setClearCheckedConfirm, setQueue, setQueueIndex, setFocus, setSelectedIndex, setPath, setMode, onSave, setBackupOpen]);
}
