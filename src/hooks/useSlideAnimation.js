import { useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';

const COL_STEP = 460;

export default function useSlideAnimation(setPath, setSelectedIndex) {
  const sliderRef = useRef(null);
  const animatingRef = useRef(false);
  const pendingNav = useRef(null);

  const slideNavigate = useCallback((direction, newPath, newSelectedIndex) => {
    if (animatingRef.current) return;
    const slider = sliderRef.current;
    if (!slider) return;

    animatingRef.current = true;
    pendingNav.current = { path: newPath, selectedIndex: newSelectedIndex };

    const offset = direction === 'right' ? -COL_STEP : COL_STEP;
    slider.style.transition = 'transform 0.28s cubic-bezier(0.25, 0.1, 0.25, 1)';
    slider.style.transform = `translateX(${offset}px)`;

    const onEnd = () => {
      slider.removeEventListener('transitionend', onEnd);
      slider.style.transition = 'none';
      slider.style.transform = 'translateX(0)';
      if (pendingNav.current) {
        flushSync(() => {
          setPath(pendingNav.current.path);
          setSelectedIndex(pendingNav.current.selectedIndex);
          pendingNav.current = null;
        });
      }
      requestAnimationFrame(() => {
        slider.style.transition = '';
        animatingRef.current = false;
      });
    };
    slider.addEventListener('transitionend', onEnd, { once: true });

    setTimeout(() => {
      if (animatingRef.current) onEnd();
    }, 350);
  }, [setPath, setSelectedIndex]);

  return { sliderRef, animatingRef, slideNavigate };
}
