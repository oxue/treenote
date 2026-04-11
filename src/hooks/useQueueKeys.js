import {
  toggleChecked,
  toggleMarkdown,
  findNodeById,
} from '../actions';
import { isUp, isDown, isLeft, isRight, isToggleLegend } from '../keybindings';

export default function handleQueueKeys(e, {
  tree, scheme,
  applyAction, ejectQueueItem, pushUndo,
  queue, queueIndex,
  setQueue, setQueueIndex, setFocus, setSelectedIndex, setMode,
  setCalendarOpen, setCalendarFeedOpen, setWebSettingsOpen, setLegendVisible,
  setPath,
  undo, redo,
}) {
  const isMeta = e.metaKey || e.ctrlKey;

  // Directional navigation in queue
  if (isLeft(e, scheme)) {
    e.preventDefault();
    if (isMeta) {
      setQueue(q => {
        const newQ = [...q];
        newQ.splice(queueIndex, 0, { type: 'temp', text: '', checked: false });
        return newQ;
      });
    } else if (e.shiftKey) {
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
    return true;
  }
  if (isRight(e, scheme)) {
    e.preventDefault();
    if (isMeta) {
      setQueue(q => {
        const newQ = [...q];
        newQ.splice(queueIndex + 1, 0, { type: 'temp', text: '', checked: false });
        return newQ;
      });
      setQueueIndex(i => i + 1);
    } else if (e.shiftKey) {
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
    return true;
  }
  if (isDown(e, scheme)) {
    e.preventDefault();
    setFocus('graph');
    setSelectedIndex(0);
    return true;
  }
  if (isUp(e, scheme)) {
    e.preventDefault();
    return true;
  }

  // Non-directional queue keys
  switch (e.key) {
    case 'c':
      e.preventDefault();
      if (queue[queueIndex]) {
        pushUndo();
        const item = queue[queueIndex];
        if (item.checked) {
          setQueue(q => q.map((it, idx) => idx === queueIndex ? { ...it, checked: false } : it));
          if (item.type === 'ref' && item.nodeId) {
            const found = findNodeById(tree, item.nodeId);
            if (found) applyAction(toggleChecked(tree, found.path, found.index));
          }
        } else {
          if (item.type === 'ref' && item.nodeId) {
            const found = findNodeById(tree, item.nodeId);
            if (found) applyAction(toggleChecked(tree, found.path, found.index));
          }
          ejectQueueItem(queueIndex);
        }
      }
      break;
    case 'x':
      e.preventDefault();
      if (queue.length > 0) {
        pushUndo();
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
      if (queue[queueIndex]) {
        setMode('edit');
      }
      break;
    case 'q':
      e.preventDefault();
      if (queue[queueIndex] && queue[queueIndex].type === 'ref' && queue[queueIndex].nodeId) {
        const found = findNodeById(tree, queue[queueIndex].nodeId);
        if (found) {
          setPath(found.path);
          setSelectedIndex(found.index);
          setFocus('graph');
        }
      }
      break;
    case 'd':
      e.preventDefault();
      if (queue[queueIndex] && queue[queueIndex].type === 'ref' && queue[queueIndex].nodeId) {
        const found = findNodeById(tree, queue[queueIndex].nodeId);
        if (found) {
          setPath(found.path);
          setSelectedIndex(found.index);
          setCalendarOpen(true);
        }
      }
      break;
    case 'm':
      e.preventDefault();
      if (queue[queueIndex] && queue[queueIndex].type === 'ref' && queue[queueIndex].nodeId) {
        const found = findNodeById(tree, queue[queueIndex].nodeId);
        if (found) {
          applyAction(toggleMarkdown(tree, found.path, found.index));
        }
      }
      break;
    case 'f':
      e.preventDefault();
      setCalendarFeedOpen(true);
      break;
    case 's':
      e.preventDefault();
      setWebSettingsOpen(true);
      break;
    case 'z':
    case 'Z':
      e.preventDefault();
      if (e.shiftKey) { redo(); } else { undo(); }
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
