import { useRef, useCallback, useLayoutEffect } from 'react';

export default function useSwapAnimation(nodeListRef) {
  const swapInfoRef = useRef(null);

  const prepareSwap = useCallback((fromIndex, toIndex) => {
    const container = nodeListRef.current;
    if (!container) return;
    const boxes = container.querySelectorAll('.node-box');
    const fromBox = boxes[fromIndex];
    const toBox = boxes[toIndex];
    if (!fromBox || !toBox) return;

    swapInfoRef.current = {
      fromIndex,
      toIndex,
      fromTop: fromBox.getBoundingClientRect().top,
      toTop: toBox.getBoundingClientRect().top,
    };
  }, [nodeListRef]);

  useLayoutEffect(() => {
    const info = swapInfoRef.current;
    if (!info) return;
    swapInfoRef.current = null;

    const container = nodeListRef.current;
    if (!container) return;
    const boxes = container.querySelectorAll('.node-box');
    const boxA = boxes[info.fromIndex];
    const boxB = boxes[info.toIndex];
    if (!boxA || !boxB) return;

    const newATop = boxA.getBoundingClientRect().top;
    const newBTop = boxB.getBoundingClientRect().top;

    // With key={i}, React reuses DOM nodes — content swaps but DOM order stays.
    // boxA (at fromIndex) now shows what was at toIndex; offset it from toTop.
    // boxB (at toIndex) now shows what was at fromIndex; offset it from fromTop.
    const deltaA = info.toTop - newATop;
    const deltaB = info.fromTop - newBTop;

    boxA.style.transition = 'none';
    boxB.style.transition = 'none';
    boxA.style.transform = `translateY(${deltaA}px)`;
    boxB.style.transform = `translateY(${deltaB}px)`;

    // Force reflow so the browser registers the starting position
    void boxA.offsetHeight;

    requestAnimationFrame(() => {
      const dur = '0.2s';
      const ease = 'cubic-bezier(0.16, 1, 0.3, 1)';
      boxA.style.transition = `transform ${dur} ${ease}`;
      boxB.style.transition = `transform ${dur} ${ease}`;
      boxA.style.transform = '';
      boxB.style.transform = '';

      const cleanup = (el) => {
        const onEnd = () => {
          el.style.transition = '';
          el.style.transform = '';
        };
        el.addEventListener('transitionend', onEnd, { once: true });
        setTimeout(onEnd, 300);
      };
      cleanup(boxA);
      cleanup(boxB);
    });
  });

  return { prepareSwap };
}
