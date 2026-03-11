import { useRef, useEffect, useMemo } from 'react';
import { emojis } from '../emojiData';
import './EmojiPicker.css';

export default function EmojiPicker({ query, onSelect, position, visible, selectedIdx }) {
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    if (!visible) return [];
    return emojis.filter(e =>
      e.shortcode.includes(query.toLowerCase())
    ).slice(0, 8);
  }, [visible, query]);

  useEffect(() => {
    if (listRef.current && listRef.current.children[selectedIdx]) {
      listRef.current.children[selectedIdx].scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIdx]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div className="emoji-picker" style={{ top: position.top, left: position.left }}>
      <div className="emoji-picker-list" ref={listRef}>
        {filtered.map((e, i) => (
          <div
            key={e.shortcode}
            className={`emoji-picker-item ${i === selectedIdx ? 'selected' : ''}`}
            onMouseDown={(ev) => { ev.preventDefault(); onSelect(e.emoji, e.shortcode); }}
          >
            <span className="emoji-picker-emoji">{e.emoji}</span>
            <span className="emoji-picker-code">:{e.shortcode}:</span>
          </div>
        ))}
      </div>
    </div>
  );
}
