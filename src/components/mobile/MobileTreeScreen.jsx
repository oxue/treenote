import { useState, useRef, useCallback, useEffect } from 'react';
import './MobileTreeScreen.css';

/**
 * Strip markdown heading markers and return first line only.
 */
function displayText(text) {
  if (!text) return '';
  const firstLine = text.split('\n')[0];
  return firstLine.replace(/^#{1,6}\s+/, '');
}

/**
 * Resolve the children array at a given path within the tree.
 * path = [] → top-level tree array
 * path = [2, 0] → tree[2].children[0].children
 */
function getNodesAtPath(tree, path) {
  let nodes = tree;
  for (const idx of path) {
    const node = nodes[idx];
    if (!node || !node.children) return [];
    nodes = node.children;
  }
  return nodes;
}

/**
 * Build breadcrumb labels from path.
 * Returns [{label, path}] including "Root" for the top.
 */
function buildCrumbs(tree, path) {
  const crumbs = [{ label: 'Root', path: [] }];
  let nodes = tree;
  for (let i = 0; i < path.length; i++) {
    const node = nodes[path[i]];
    if (!node) break;
    crumbs.push({
      label: displayText(node.text) || 'Untitled',
      path: path.slice(0, i + 1),
    });
    nodes = node.children || [];
  }
  return crumbs;
}

// ─── Swipeable Node Row ──────────────────────────────────────

function MobileNodeRow({ node, index, onTap, onCheck, onDelete, onLongPress }) {
  const [swiped, setSwiped] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchMoved = useRef(false);
  const longPressTimer = useRef(null);
  const surfaceRef = useRef(null);

  const hasChildren = node.children && node.children.length > 0;
  const childCount = hasChildren ? node.children.length : 0;

  // Close swipe when tapping elsewhere
  useEffect(() => {
    if (!swiped) return;
    const handler = (e) => {
      if (surfaceRef.current && !surfaceRef.current.parentElement.contains(e.target)) {
        setSwiped(false);
      }
    };
    document.addEventListener('touchstart', handler, { passive: true });
    return () => document.removeEventListener('touchstart', handler);
  }, [swiped]);

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchMoved.current = false;

    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      touchMoved.current = true; // prevent tap after long press
      onLongPress(index, node);
    }, 500);
  }, [index, node, onLongPress]);

  const handleTouchMove = useCallback((e) => {
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX.current;
    const dy = touch.clientY - touchStartY.current;

    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      touchMoved.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    // Horizontal swipe detection
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < -30) {
        setSwiped(true);
      } else if (dx > 30) {
        setSwiped(false);
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (!touchMoved.current && !swiped) {
      onTap(index, node);
    }
  }, [swiped, index, node, onTap]);

  const handleCheck = useCallback((e) => {
    e.stopPropagation();
    setSwiped(false);
    onCheck(index);
  }, [index, onCheck]);

  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    setSwiped(false);
    onDelete(index);
  }, [index, onDelete]);

  return (
    <div className="mobile-node-outer">
      {/* Action buttons behind the surface */}
      <div className="mobile-node-actions">
        <button className="mobile-node-action-btn check" onClick={handleCheck} aria-label="Check">
          &#x2713;
        </button>
        <button className="mobile-node-action-btn delete" onClick={handleDelete} aria-label="Delete">
          &#x2715;
        </button>
      </div>

      {/* Slideable surface */}
      <div
        ref={surfaceRef}
        className={`mobile-node-surface${swiped ? ' swiped' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {node.priority && (
          <span className={`mobile-node-priority p-${node.priority}`} />
        )}

        <span className={`mobile-node-text${node.checked ? ' checked' : ''}`}>
          {displayText(node.text)}
        </span>

        {node.deadline && (
          <span className="mobile-node-deadline">{node.deadline}</span>
        )}

        {hasChildren && (
          <span className="mobile-node-badge">{childCount}</span>
        )}

        {hasChildren && (
          <span className="mobile-node-chevron">&rsaquo;</span>
        )}
      </div>
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function MobileTreeScreen({
  tree,
  path,
  onPathChange,
  onCheck,
  onDelete,
  onAddNode,
  onLongPress,
}) {
  const [slideDirection, setSlideDirection] = useState(null);
  const listRef = useRef(null);
  const edgeSwipeStartX = useRef(null);

  const nodes = getNodesAtPath(tree, path);
  const crumbs = buildCrumbs(tree, path);

  // Drill into a child node
  const handleTap = useCallback((index, node) => {
    if (node.children && node.children.length > 0) {
      setSlideDirection('left');
      onPathChange([...path, index]);
    }
  }, [path, onPathChange]);

  // Go up to a breadcrumb level
  const handleCrumbTap = useCallback((crumbPath) => {
    if (crumbPath.length < path.length) {
      setSlideDirection('right');
      onPathChange(crumbPath);
    }
  }, [path, onPathChange]);

  // Go up one level
  const goUp = useCallback(() => {
    if (path.length > 0) {
      setSlideDirection('right');
      onPathChange(path.slice(0, -1));
    }
  }, [path, onPathChange]);

  // Check / delete callbacks that include the current path context
  const handleCheck = useCallback((nodeIndex) => {
    onCheck(path, nodeIndex);
  }, [path, onCheck]);

  const handleDelete = useCallback((nodeIndex) => {
    onDelete(path, nodeIndex);
  }, [path, onDelete]);

  const handleLongPress = useCallback((nodeIndex, node) => {
    onLongPress(path, nodeIndex, node);
  }, [path, onLongPress]);

  const handleAdd = useCallback(() => {
    onAddNode(path);
  }, [path, onAddNode]);

  // Swipe right from left edge to go up
  const handleEdgeTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    if (touch.clientX < 20) {
      edgeSwipeStartX.current = touch.clientX;
    }
  }, []);

  const handleEdgeTouchEnd = useCallback((e) => {
    if (edgeSwipeStartX.current === null) return;
    const touch = e.changedTouches[0];
    if (touch.clientX - edgeSwipeStartX.current > 80) {
      goUp();
    }
    edgeSwipeStartX.current = null;
  }, [goUp]);

  // Clear slide animation class after it finishes
  useEffect(() => {
    if (!slideDirection) return;
    const timer = setTimeout(() => setSlideDirection(null), 260);
    return () => clearTimeout(timer);
  }, [slideDirection, path]);

  // Determine slide animation class
  let slideClass = '';
  if (slideDirection === 'left') slideClass = ' slide-enter-left';
  else if (slideDirection === 'right') slideClass = ' slide-enter-right';

  return (
    <div
      className="mobile-tree-screen"
      onTouchStart={handleEdgeTouchStart}
      onTouchEnd={handleEdgeTouchEnd}
    >
      {/* Breadcrumbs */}
      <nav className="mobile-breadcrumbs">
        {crumbs.map((crumb, i) => (
          <span key={i} style={{ display: 'contents' }}>
            {i > 0 && <span className="mobile-breadcrumb-sep">/</span>}
            <button
              className={`mobile-breadcrumb${i === crumbs.length - 1 ? ' current' : ''}`}
              onClick={() => handleCrumbTap(crumb.path)}
              disabled={i === crumbs.length - 1}
            >
              {crumb.label}
            </button>
          </span>
        ))}
      </nav>

      {/* Node list */}
      <div className="mobile-node-list-wrapper">
        <div ref={listRef} className={`mobile-node-list${slideClass}`} key={path.join('-')}>
          {nodes.length === 0 ? (
            <div className="mobile-empty-state">
              No items here. Tap + to add one.
            </div>
          ) : (
            nodes.map((node, i) => (
              <MobileNodeRow
                key={node.id || i}
                node={node}
                index={i}
                onTap={handleTap}
                onCheck={handleCheck}
                onDelete={handleDelete}
                onLongPress={handleLongPress}
              />
            ))
          )}
        </div>
      </div>

      {/* Edge swipe zone (invisible) */}
      {path.length > 0 && <div className="mobile-swipe-edge" />}

      {/* Floating action button */}
      <button className="mobile-fab" onClick={handleAdd} aria-label="Add node">
        +
      </button>
    </div>
  );
}
