import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { findNodeById } from '../../actions';
import './MobileQueueScreen.css';

const SWIPE_THRESHOLD = 80;

/** Strip leading markdown heading markers (e.g. "## Title" → "Title") */
function stripHeading(text) {
  if (!text) return '';
  return text.replace(/^#{1,6}\s+/, '');
}

/** Resolve display info for a queue item, pulling from tree node for ref items */
function resolveItem(item, tree) {
  if (item.type === 'ref' && tree) {
    const result = findNodeById(tree, item.nodeId);
    if (result) {
      const node = result.node;
      return {
        text: node.text || item.text || '',
        checked: item.checked,
        deadline: node.deadline || item.deadline,
        priority: node.priority || item.priority,
        type: 'ref',
        nodeId: item.nodeId,
      };
    }
  }
  return {
    text: item.text || '',
    checked: item.checked || false,
    deadline: item.deadline,
    priority: item.priority,
    type: item.type,
    nodeId: item.nodeId,
  };
}

/** Sort queue: unchecked first, checked at end, preserving relative order */
function sortedQueue(queue, tree) {
  return queue.map((item, i) => ({ ...resolveItem(item, tree), originalIndex: i }))
    .sort((a, b) => (a.checked === b.checked ? 0 : a.checked ? 1 : -1));
}

export default function MobileQueueScreen({
  queue = [],
  tree,
  onToggleCheck,
  onDelete,
  onEdit,
  onAddTemp,
  onShowInTree,
  onReorder,
  onClearChecked,
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState(null);
  const pagerRef = useRef(null);
  const touchRef = useRef({ startX: 0, startY: 0, currentX: 0, currentY: 0, swiping: false, direction: null });
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 });
  const [swipeDirection, setSwipeDirection] = useState(null); // 'check' | 'delete'
  const longPressTimer = useRef(null);

  const items = useMemo(() => sortedQueue(queue, tree), [queue, tree]);
  const uncheckedCount = items.filter(i => !i.checked).length;
  const hasChecked = items.some(i => i.checked);

  // Clamp active index when items change
  useEffect(() => {
    if (activeIndex >= items.length && items.length > 0) {
      setActiveIndex(items.length - 1);
    }
  }, [items.length, activeIndex]);

  // Scroll to active card on index change
  useEffect(() => {
    const pager = pagerRef.current;
    if (!pager) return;
    const wrapper = pager.children[activeIndex];
    if (wrapper) {
      wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeIndex]);

  // Handle scroll-snap settling to update active index
  const handleScroll = useCallback(() => {
    const pager = pagerRef.current;
    if (!pager || !pager.children.length) return;
    const scrollLeft = pager.scrollLeft;
    const wrapperWidth = pager.children[0].offsetWidth;
    const newIndex = Math.round(scrollLeft / wrapperWidth);
    if (newIndex >= 0 && newIndex < items.length && newIndex !== activeIndex) {
      setActiveIndex(newIndex);
    }
  }, [items.length, activeIndex]);

  // --- Touch gesture handlers on the card ---
  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      swiping: false,
      direction: null,
    };
    setSwipeOffset({ x: 0, y: 0 });
    setSwipeDirection(null);

    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      if (onReorder && items[activeIndex]) {
        onReorder(items[activeIndex].originalIndex, null);
      }
    }, 600);
  }, [activeIndex, items, onReorder]);

  const handleTouchMove = useCallback((e) => {
    const touch = e.touches[0];
    const dx = touch.clientX - touchRef.current.startX;
    const dy = touch.clientY - touchRef.current.startY;
    touchRef.current.currentX = touch.clientX;
    touchRef.current.currentY = touch.clientY;

    // Cancel long press on any significant movement
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      clearTimeout(longPressTimer.current);
    }

    // Determine direction once past threshold
    if (!touchRef.current.direction && (Math.abs(dx) > 15 || Math.abs(dy) > 15)) {
      if (Math.abs(dy) > Math.abs(dx)) {
        touchRef.current.direction = 'vertical';
        touchRef.current.swiping = true;
      } else {
        // Horizontal — let scroll-snap handle it
        touchRef.current.direction = 'horizontal';
        return;
      }
    }

    if (touchRef.current.direction === 'vertical') {
      e.preventDefault();
      setSwipeOffset({ x: 0, y: dy });
      if (dy > SWIPE_THRESHOLD * 0.5) {
        setSwipeDirection('check');
      } else if (dy < -SWIPE_THRESHOLD * 0.5) {
        setSwipeDirection('delete');
      } else {
        setSwipeDirection(null);
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
    const dy = touchRef.current.currentY - touchRef.current.startY;

    if (touchRef.current.direction === 'vertical') {
      if (dy > SWIPE_THRESHOLD && onToggleCheck && items[activeIndex]) {
        // Swipe down → check off
        onToggleCheck(items[activeIndex].originalIndex);
      } else if (dy < -SWIPE_THRESHOLD && items[activeIndex]) {
        // Swipe up → delete (with confirmation)
        setConfirmDeleteIndex(activeIndex);
      }
    }

    setSwipeOffset({ x: 0, y: 0 });
    setSwipeDirection(null);
    touchRef.current = { startX: 0, startY: 0, currentX: 0, currentY: 0, swiping: false, direction: null };
  }, [activeIndex, items, onToggleCheck]);

  const handleConfirmDelete = useCallback(() => {
    if (confirmDeleteIndex != null && onDelete && items[confirmDeleteIndex]) {
      onDelete(items[confirmDeleteIndex].originalIndex);
    }
    setConfirmDeleteIndex(null);
  }, [confirmDeleteIndex, items, onDelete]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteIndex(null);
  }, []);

  // --- Render helpers ---
  function renderBadges(item) {
    const badges = [];
    if (item.deadline) {
      badges.push(
        <span key="deadline" className="mq-badge mq-badge-deadline">
          {item.deadline}
        </span>
      );
    }
    if (item.priority) {
      badges.push(
        <span key="priority" className={`mq-badge mq-badge-priority-${item.priority}`}>
          {item.priority}
        </span>
      );
    }
    badges.push(
      <span key="type" className={`mq-badge mq-badge-${item.type}`}>
        {item.type}
      </span>
    );
    return badges;
  }

  function renderCard(item, index) {
    const isActive = index === activeIndex;
    const isConfirming = confirmDeleteIndex === index;
    const title = stripHeading(item.text);
    const bodyLines = item.text.split('\n').slice(1).join('\n').trim();

    const cardStyle = isActive && swipeOffset.y !== 0
      ? { transform: `translateY(${swipeOffset.y * 0.5}px)` }
      : {};

    const cardClasses = [
      'mq-card',
      item.checked && 'mq-card-checked',
      item.type === 'temp' && 'mq-card-temp',
      isActive && swipeOffset.y !== 0 && 'mq-card-swiping',
    ].filter(Boolean).join(' ');

    return (
      <div className="mq-card-wrapper" key={item.originalIndex}>
        <div
          className={cardClasses}
          style={cardStyle}
          onTouchStart={isActive ? handleTouchStart : undefined}
          onTouchMove={isActive ? handleTouchMove : undefined}
          onTouchEnd={isActive ? handleTouchEnd : undefined}
        >
          {/* Swipe hint overlay */}
          {isActive && swipeDirection === 'check' && (
            <div className="mq-swipe-hint mq-swipe-hint-check">CHECK OFF</div>
          )}
          {isActive && swipeDirection === 'delete' && (
            <div className="mq-swipe-hint mq-swipe-hint-delete">DELETE</div>
          )}

          {/* Delete confirmation overlay */}
          {isConfirming && (
            <div className="mq-confirm">
              <span className="mq-confirm-text">Delete this item?</span>
              <div className="mq-confirm-actions">
                <button className="mq-confirm-btn mq-confirm-btn-cancel" onClick={handleCancelDelete}>
                  Cancel
                </button>
                <button className="mq-confirm-btn mq-confirm-btn-delete" onClick={handleConfirmDelete}>
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Top row: checkbox + title */}
          <div className="mq-card-top">
            <button
              className={`mq-checkbox ${item.checked ? 'mq-checkbox-checked' : ''}`}
              onClick={() => onToggleCheck && onToggleCheck(item.originalIndex)}
            >
              {item.checked ? '\u2713' : ''}
            </button>
            <div
              className="mq-card-title"
              onClick={() => onEdit && onEdit(item.originalIndex)}
            >
              {title}
            </div>
          </div>

          {/* Body text */}
          {bodyLines && (
            <div
              className="mq-card-body"
              onClick={() => onEdit && onEdit(item.originalIndex)}
            >
              {bodyLines}
            </div>
          )}

          {/* Badges */}
          <div className="mq-badges">
            {renderBadges(item)}
          </div>

          {/* Show in tree (ref items only) */}
          {item.type === 'ref' && item.nodeId && onShowInTree && (
            <button
              className="mq-show-in-tree"
              onClick={() => onShowInTree(item.nodeId)}
            >
              Show in tree
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- Main render ---
  if (items.length === 0) {
    return (
      <div className="mq-screen">
        <div className="mq-header">
          <div className="mq-header-left">
            <span className="mq-label">Queue</span>
            <span className="mq-count">0 left</span>
          </div>
          <button className="mq-add-btn" onClick={onAddTemp}>+</button>
        </div>
        <div className="mq-empty">
          <div className="mq-empty-icon">&#9744;</div>
          <div className="mq-empty-text">
            Queue is empty.<br />
            Tap + to add an item.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mq-screen">
      {/* Header */}
      <div className="mq-header">
        <div className="mq-header-left">
          <span className="mq-label">Queue</span>
          <span className="mq-count">{uncheckedCount} left</span>
        </div>
        <button className="mq-add-btn" onClick={onAddTemp}>+</button>
      </div>

      {/* Card pager */}
      <div className="mq-pager" ref={pagerRef} onScroll={handleScroll}>
        {items.map((item, index) => renderCard(item, index))}
      </div>

      {/* Page dots */}
      <div className="mq-dots">
        {items.map((item, index) => (
          <div
            key={item.originalIndex}
            className={[
              'mq-dot',
              index === activeIndex && 'mq-dot-active',
              item.checked && 'mq-dot-checked',
            ].filter(Boolean).join(' ')}
            onClick={() => {
              setActiveIndex(index);
              const pager = pagerRef.current;
              if (pager && pager.children[index]) {
                pager.children[index].scrollIntoView({ behavior: 'smooth', inline: 'center' });
              }
            }}
          />
        ))}
      </div>

      {/* Clear checked button */}
      {hasChecked && (
        <div className="mq-bottom">
          <button className="mq-clear-btn" onClick={onClearChecked}>
            Clear checked
          </button>
        </div>
      )}
    </div>
  );
}
