import { useState, useEffect, useCallback, useRef } from 'react';

export default function useSvgLines({ selectedIndex, path, tree, childNodesLength, currentNodesLength, parentNodesLength }) {
  const parentColRef = useRef(null);
  const currentColRef = useRef(null);
  const childColRef = useRef(null);
  const leftSvgRef = useRef(null);
  const rightSvgRef = useRef(null);
  const [leftLines, setLeftLines] = useState([]);
  const [rightLines, setRightLines] = useState([]);

  const updateLines = useCallback(() => {
    if (currentColRef.current && childColRef.current && rightSvgRef.current) {
      const selectedEl = currentColRef.current.querySelector('.node-box.selected, .node-box.editing');
      const childEls = childColRef.current.querySelectorAll('.child-box');
      if (selectedEl && childEls.length > 0) {
        const svgRect = rightSvgRef.current.getBoundingClientRect();
        const parentRect = selectedEl.getBoundingClientRect();
        const startY = parentRect.top + parentRect.height / 2 - svgRect.top;
        setRightLines(Array.from(childEls).map((el) => {
          const r = el.getBoundingClientRect();
          return { startY, endY: r.top + r.height / 2 - svgRect.top };
        }));
      } else {
        setRightLines([]);
      }
    } else {
      setRightLines([]);
    }

    if (parentColRef.current && currentColRef.current && leftSvgRef.current) {
      const parentEl = parentColRef.current.querySelector('.parent-box.highlighted');
      const currentEls = currentColRef.current.querySelectorAll('.node-box');
      if (parentEl && currentEls.length > 0) {
        const svgRect = leftSvgRef.current.getBoundingClientRect();
        const parentRect = parentEl.getBoundingClientRect();
        const startY = parentRect.top + parentRect.height / 2 - svgRect.top;
        setLeftLines(Array.from(currentEls).map((el) => {
          const r = el.getBoundingClientRect();
          return { startY, endY: r.top + r.height / 2 - svgRect.top };
        }));
      } else {
        setLeftLines([]);
      }
    } else {
      setLeftLines([]);
    }
  }, []);

  useEffect(() => {
    updateLines();
  }, [selectedIndex, path, tree, childNodesLength, currentNodesLength, parentNodesLength, updateLines]);

  return { parentColRef, currentColRef, childColRef, leftSvgRef, rightSvgRef, leftLines, rightLines };
}
