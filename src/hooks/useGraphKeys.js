import {
  insertSiblingBelow,
  insertSiblingAbove,
  insertParent,
  insertChild,
  deleteNodeWithChildren,
  deleteNodeKeepChildren,
  deleteCheckedNodes,
  swapUp,
  swapDown,
  toggleChecked,
  moveToParentLevel,
  moveToSibling,
  toggleMarkdown,
} from '../actions';
import { isUp, isDown, isLeft, isRight, isVimNavKey, isToggleLegend } from '../keybindings';

export default function handleGraphKeys(e, {
  tree, path, selectedIndex, selectedNode, nodes, scheme, insertOpts,
  getCurrentNodes, slideNavigate, enterEditMode, applyAction, animatingRef, prepareSwap,
  setDeleteConfirm, setClearCheckedConfirm, setQueue, setQueueIndex,
  setFocus, setSelectedIndex, setMode, setBackupOpen,
  setCalendarOpen, setCalendarFeedOpen, setLegendVisible,
  setSettingsOpen, setWebSettingsOpen,
  queue, undo, redo,
}) {
  if (animatingRef.current && (isRight(e, scheme) || isLeft(e, scheme))) return;

  const isMeta = e.metaKey || e.ctrlKey;

  // Directional navigation
  if (isUp(e, scheme)) {
    e.preventDefault();
    if (isMeta) {
      applyAction(insertSiblingAbove(tree, path, selectedIndex, insertOpts));
      setMode('edit');
    } else if (e.altKey) {
      const result = moveToSibling(tree, path, selectedIndex, -1);
      if (result) applyAction(result);
    } else if (e.shiftKey) {
      prepareSwap(selectedIndex, selectedIndex - 1);
      const result = swapUp(tree, path, selectedIndex);
      if (result) applyAction(result);
    } else {
      if (selectedIndex <= 0) {
        if (queue.length > 0) {
          setFocus('queue');
          setQueueIndex(0);
        }
      } else {
        setSelectedIndex(i => i - 1);
      }
    }
    return true;
  }
  if (isDown(e, scheme)) {
    e.preventDefault();
    if (isMeta) {
      applyAction(insertSiblingBelow(tree, path, selectedIndex, insertOpts));
      setMode('edit');
    } else if (e.altKey) {
      const result = moveToSibling(tree, path, selectedIndex, 1);
      if (result) applyAction(result);
    } else if (e.shiftKey) {
      prepareSwap(selectedIndex, selectedIndex + 1);
      const result = swapDown(tree, path, selectedIndex);
      if (result) applyAction(result);
    } else {
      setSelectedIndex(i => i >= nodes.length - 1 ? i : i + 1);
    }
    return true;
  }
  if (isRight(e, scheme)) {
    e.preventDefault();
    if (isMeta) {
      const result = insertChild(tree, path, selectedIndex, insertOpts);
      if (result) { applyAction(result); setMode('edit'); }
    } else {
      const selected = nodes[selectedIndex];
      if (selected && selected.children.length > 0) {
        slideNavigate('right', [...path, selectedIndex], 0);
      }
    }
    return true;
  }
  if (isLeft(e, scheme)) {
    e.preventDefault();
    if (isMeta) {
      const result = insertParent(tree, path, selectedIndex, insertOpts);
      if (result) { applyAction(result); setMode('edit'); }
    } else if (e.altKey) {
      const result = moveToParentLevel(tree, path, selectedIndex);
      if (result) applyAction(result);
    } else if (path.length > 0) {
      slideNavigate('left', path.slice(0, -1), path[path.length - 1]);
    }
    return true;
  }

  // In vim mode, if a shifted/alt/meta vim nav key wasn't caught above, don't fall through
  if (isVimNavKey(e, scheme)) return true;

  // Non-directional graph keys
  switch (e.key) {
    case 'Enter':
      e.preventDefault();
      enterEditMode();
      break;
    case 'z':
    case 'Z':
      e.preventDefault();
      if (e.shiftKey) { redo(); } else { undo(); }
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
          nodeId: selectedNode.id,
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
    case 'd':
      e.preventDefault();
      if (selectedNode) {
        setCalendarOpen(true);
      }
      break;
    case 'f':
      e.preventDefault();
      setCalendarFeedOpen(true);
      break;
    case 's':
      e.preventDefault();
      if (window.treenote?.getSettings) {
        setSettingsOpen(true);
      } else {
        setWebSettingsOpen(true);
      }
      break;
    default:
      if (isToggleLegend(e, scheme)) {
        e.preventDefault();
        setLegendVisible(v => !v);
      }
      break;
  }
  return true;
}
