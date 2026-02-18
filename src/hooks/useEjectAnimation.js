import { useState, useEffect } from 'react';

export default function useEjectAnimation(physics, queue, setQueue, setFocus, setQueueIndex) {
  const [ejecting, setEjecting] = useState([]);

  useEffect(() => {
    if (ejecting.length === 0) return;
    let raf;
    const step = () => {
      setEjecting(prev => {
        const next = prev.map(item => ({
          ...item,
          x: item.x + item.vx,
          y: item.y + item.vy,
          rotation: item.rotation + item.vr,
          vy: item.vy + item.ay,
        }));
        return next.filter(item => item.y < 800);
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ejecting.length > 0]);

  function ejectQueueItem(index) {
    const el = document.querySelectorAll('.queue-box')[index];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const item = queue[index];
    setEjecting(prev => [...prev, {
      ...item,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      vx: physics.vx,
      vy: physics.vy,
      ay: physics.gravity,
      vr: (Math.random() * 2 - 1) * physics.spin,
      rotation: 0,
      id: Date.now(),
    }]);
    setQueue(q => q.filter((_, i) => i !== index));
    if (queue.length <= 1) {
      setFocus('graph');
      setQueueIndex(0);
    } else {
      setQueueIndex(i => Math.min(i, queue.length - 2));
    }
  }

  return { ejecting, ejectQueueItem };
}
