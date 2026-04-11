import { useState, useCallback, useRef } from 'react';

export default function useToast(duration = 2000) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const show = useCallback((msg, ms) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(msg);
    timerRef.current = setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, ms || duration);
  }, [duration]);

  return { toast, show };
}
