import { useEffect } from 'react';
import { serializeTree } from '../treeIO';
import {
  deleteNodeWithChildren,
  deleteNodeKeepChildren,
  deleteCheckedNodes,
} from '../actions';
import handleGraphKeys from './useGraphKeys';
import handleQueueKeys from './useQueueKeys';

export default function useKeyboard({
  tree, path, selectedIndex, selectedNode, mode, deleteConfirm, clearCheckedConfirm, settingsOpen, backupOpen,
  getCurrentNodes, slideNavigate, enterEditMode, undo, redo, applyAction, animatingRef, ejectQueueItem,
  focus, queue, queueIndex, pushUndo, prepareSwap,
  showToast, setSettingsOpen, setDeleteConfirm, setClearCheckedConfirm, setQueue, setQueueIndex,
  setFocus, setSelectedIndex, setPath, setMode,
  onSave, setBackupOpen,
  calendarOpen, setCalendarOpen,
  calendarFeedOpen, setCalendarFeedOpen,
  setLegendVisible,
  keybindingScheme,
  webSettingsOpen, setWebSettingsOpen,
  defaultMarkdown,
  onExport,
}) {
  const scheme = keybindingScheme || 'arrows';
  const insertOpts = defaultMarkdown ? { markdown: true } : {};

  useEffect(() => {
    function handleKeyDown(e) {
      // Cmd+S saves in any mode
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (tree && onSave) {
          onSave();
        } else if (tree && window.treenote?.saveDefaultFile) {
          window.treenote.saveDefaultFile(serializeTree(tree)).then((ok) => {
            showToast(ok ? 'Saved' : 'Save failed', 1000);
          });
        }
        return;
      }

      if (mode === 'edit') return;

      // Panels/modals that handle their own keys
      if (calendarOpen || calendarFeedOpen || webSettingsOpen) return;

      if (settingsOpen) {
        if (e.key === 'Escape') { e.preventDefault(); setSettingsOpen(false); }
        return;
      }
      if (backupOpen) {
        if (e.key === 'Escape') { e.preventDefault(); setBackupOpen(false); }
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

      if (focus === 'queue') {
        handleQueueKeys(e, {
          tree, scheme,
          applyAction, ejectQueueItem, pushUndo,
          queue, queueIndex,
          setQueue, setQueueIndex, setFocus, setSelectedIndex, setMode,
          setCalendarOpen, setCalendarFeedOpen, setWebSettingsOpen, setLegendVisible,
          setPath,
          undo, redo,
        });
        return;
      }

      handleGraphKeys(e, {
        tree, path, selectedIndex, selectedNode, nodes, scheme, insertOpts,
        getCurrentNodes, slideNavigate, enterEditMode, applyAction, animatingRef, prepareSwap,
        setDeleteConfirm, setClearCheckedConfirm, setQueue, setQueueIndex,
        setFocus, setSelectedIndex, setMode, setBackupOpen,
        setCalendarOpen, setCalendarFeedOpen, setLegendVisible,
        setSettingsOpen, setWebSettingsOpen,
        queue, undo, redo, onExport,
      });
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tree, path, selectedIndex, selectedNode, mode, deleteConfirm, clearCheckedConfirm, settingsOpen, backupOpen, getCurrentNodes, slideNavigate, enterEditMode, undo, redo, applyAction, focus, queue, queueIndex, pushUndo, animatingRef, ejectQueueItem, showToast, setSettingsOpen, setDeleteConfirm, setClearCheckedConfirm, setQueue, setQueueIndex, setFocus, setSelectedIndex, setPath, setMode, onSave, setBackupOpen, calendarOpen, setCalendarOpen, calendarFeedOpen, setCalendarFeedOpen, setLegendVisible, scheme, webSettingsOpen, setWebSettingsOpen, insertOpts, prepareSwap, onExport]);
}
