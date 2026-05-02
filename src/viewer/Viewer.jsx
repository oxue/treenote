import { useState, useEffect, useCallback, useRef } from 'react';
import NodeContent from '../components/NodeContent';
import NodeMeta from '../components/NodeMeta';
import useSvgLines from '../hooks/useSvgLines';
import useSlideAnimation from '../hooks/useSlideAnimation';

// Read-only viewer for an exported tree snapshot.
// No edit affordances, no Supabase, no auth. The keyboard handler only does
// navigation; any other key triggers a "read-only" toast.
export default function Viewer({ data }) {
  const tree = data.tree || [];
  const theme = data.theme || 'dark';
  const boxWidth = data.boxWidth || 400;
  const sourceUrl = data.sourceUrl || '';
  const exportedAt = data.exportedAt || '';

  const [path, setPath] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [helpVisible, setHelpVisible] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  // Apply theme + box width once on mount.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const w = Math.max(200, Math.min(900, Number(boxWidth) || 400));
    document.documentElement.style.setProperty('--main-box-width', w + 'px');
  }, [theme, boxWidth]);

  const showToast = useCallback((msg, ms = 1200) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), ms);
  }, []);

  const getCurrentNodes = useCallback(() => {
    let nodes = tree;
    for (const idx of path) {
      if (!nodes[idx]) return [];
      nodes = nodes[idx].children || [];
    }
    return nodes;
  }, [tree, path]);

  const getParentNodes = useCallback(() => {
    if (path.length === 0) return [];
    let nodes = tree;
    for (let i = 0; i < path.length - 1; i++) {
      if (!nodes[path[i]]) return [];
      nodes = nodes[path[i]].children || [];
    }
    return nodes;
  }, [tree, path]);

  const getBreadcrumb = useCallback(() => {
    const crumbs = [];
    let nodes = tree;
    for (const idx of path) {
      const node = nodes[idx];
      if (!node) break;
      crumbs.push((node.text || '').split('\n')[0]);
      nodes = node.children || [];
    }
    return crumbs;
  }, [tree, path]);

  const currentNodes = getCurrentNodes();
  const parentNodes = getParentNodes();
  const parentSelectedIndex = path.length > 0 ? path[path.length - 1] : -1;
  const breadcrumb = getBreadcrumb();
  const selectedNode = currentNodes[selectedIndex];
  const childNodes = selectedNode ? (selectedNode.children || []) : [];

  const { sliderRef, animatingRef, slideNavigate } = useSlideAnimation(setPath, setSelectedIndex);
  const { parentColRef, currentColRef, childColRef, leftSvgRef, rightSvgRef, leftLines, rightLines } = useSvgLines({
    selectedIndex, path, tree,
    childNodesLength: childNodes.length,
    currentNodesLength: currentNodes.length,
    parentNodesLength: parentNodes.length,
  });

  // Keyboard navigation (read-only).
  useEffect(() => {
    function handleKeyDown(e) {
      if (animatingRef.current && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'h' || e.key === 'l')) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          setSelectedIndex(i => Math.max(0, i - 1));
          return;
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          setSelectedIndex(i => Math.min(currentNodes.length - 1, i + 1));
          return;
        case 'ArrowRight':
        case 'l': {
          e.preventDefault();
          const sel = currentNodes[selectedIndex];
          if (sel && sel.children && sel.children.length > 0) {
            slideNavigate('right', [...path, selectedIndex], 0);
          }
          return;
        }
        case 'ArrowLeft':
        case 'h':
        case 'Backspace':
          e.preventDefault();
          if (path.length > 0) {
            slideNavigate('left', path.slice(0, -1), path[path.length - 1]);
          }
          return;
        case 'Escape':
          e.preventDefault();
          if (helpVisible) setHelpVisible(false);
          else { setPath([]); setSelectedIndex(0); }
          return;
        case '?':
          e.preventDefault();
          setHelpVisible(v => !v);
          return;
        case 'Enter':
        case 'i':
        case 'x':
        case 'c':
        case 'q':
        case 'd':
        case 'm':
          e.preventDefault();
          showToast('Read-only snapshot');
          return;
        default:
          return;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentNodes, selectedIndex, path, slideNavigate, animatingRef, helpVisible, showToast]);

  const exportedDate = exportedAt ? exportedAt.slice(0, 10) : '';
  const sourceLabel = sourceUrl ? sourceUrl.replace(/^https?:\/\//, '') : '';

  return (
    <div className="app viewer-app">
      {bannerVisible && (
        <div className="viewer-banner">
          <span className="viewer-banner-text">
            Read-only snapshot &middot; Exported from Treenote
            {exportedDate && <> &middot; {exportedDate}</>}
            {sourceLabel && (
              <> &middot; <a href={sourceUrl} target="_blank" rel="noopener noreferrer">{sourceLabel}</a></>
            )}
          </span>
          <button
            className="viewer-banner-dismiss"
            onClick={() => setBannerVisible(false)}
            aria-label="Dismiss banner"
          >
            &times;
          </button>
        </div>
      )}

      {breadcrumb.length > 0 && (
        <div className="toolbar viewer-toolbar">
          <div className="breadcrumb">
            {breadcrumb.map((crumb, i) => (
              <span key={i}>
                {i > 0 && <span className="breadcrumb-separator"> &gt; </span>}
                <span
                  className={`breadcrumb-item ${i === breadcrumb.length - 1 ? 'current' : ''}`}
                  onClick={() => {
                    if (i < breadcrumb.length - 1) {
                      const newPath = path.slice(0, i);
                      const newSelected = path[i];
                      if (i === breadcrumb.length - 2) {
                        slideNavigate('left', newPath, newSelected);
                      } else {
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
        </div>
      )}

      {currentNodes.length === 0 ? (
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
                      onClick={() => slideNavigate('left', path.slice(0, -1), i)}
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
                const isSelected = i === selectedIndex;
                return (
                  <div
                    key={i}
                    className={`node-box ${isSelected ? 'selected' : ''} ${node.checked ? 'checked' : ''}`}
                    onClick={() => setSelectedIndex(i)}
                    onDoubleClick={() => {
                      if ((node.children || []).length > 0) {
                        slideNavigate('right', [...path, i], 0);
                      }
                    }}
                  >
                    <NodeMeta node={node} full />
                    <NodeContent text={node.text} markdown={node.markdown} />
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
                      onClick={() => slideNavigate('right', [...path, selectedIndex], i)}
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

      {toast && <div className="toast viewer-toast">{toast}</div>}

      {helpVisible && (
        <div className="viewer-help-overlay" onClick={() => setHelpVisible(false)}>
          <div className="viewer-help-panel" onClick={(e) => e.stopPropagation()}>
            <div className="viewer-help-title">Read-only snapshot &mdash; keys</div>
            <table className="viewer-help-table">
              <tbody>
                <tr><td>Move up/down</td><td><kbd>&uarr;</kbd>/<kbd>&darr;</kbd> or <kbd>j</kbd>/<kbd>k</kbd></td></tr>
                <tr><td>Drill into node</td><td><kbd>&rarr;</kbd> or <kbd>l</kbd></td></tr>
                <tr><td>Go back</td><td><kbd>&larr;</kbd>, <kbd>h</kbd>, or <kbd>Backspace</kbd></td></tr>
                <tr><td>Back to root</td><td><kbd>Esc</kbd></td></tr>
                <tr><td>Toggle this help</td><td><kbd>?</kbd></td></tr>
              </tbody>
            </table>
            <div className="viewer-help-hint">Press <kbd>?</kbd> or click outside to dismiss.</div>
          </div>
        </div>
      )}
    </div>
  );
}
