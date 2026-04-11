import { emojis as emojiList } from '../emojiData';

export default function NodeEditor({
  node, editInputRef, onCommit,
  emojiPicker, setEmojiPicker, insertEmoji, updateEmojiPicker,
  settings,
}) {
  return (
    <>
      <span className="edit-icon">&#9998;</span>
      <textarea
        ref={editInputRef}
        className="node-text-input"
        defaultValue={node.text}
        rows={1}
        onInput={(e) => {
          e.target.style.height = 'auto';
          e.target.style.height = e.target.scrollHeight + 'px';
          updateEmojiPicker(e.target);
        }}
        onKeyDown={(e) => {
          if (emojiPicker.visible) {
            const filtered = emojiList.filter(em => em.shortcode.includes(emojiPicker.query.toLowerCase())).slice(0, 8);
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setEmojiPicker(prev => ({ ...prev, selectedIdx: Math.min(prev.selectedIdx + 1, filtered.length - 1) }));
              e.stopPropagation();
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setEmojiPicker(prev => ({ ...prev, selectedIdx: Math.max(prev.selectedIdx - 1, 0) }));
              e.stopPropagation();
              return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              if (filtered.length > 0) {
                e.preventDefault();
                insertEmoji(e.target, filtered[emojiPicker.selectedIdx]?.emoji || filtered[0].emoji);
                e.stopPropagation();
                return;
              }
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setEmojiPicker(prev => ({ ...prev, visible: false }));
              e.stopPropagation();
              return;
            }
          }
          if (e.key === 'Enter' && settings.enterNewline) {
            if (e.shiftKey) {
              e.preventDefault();
              onCommit(e.target.value);
              e.stopPropagation();
              return;
            }
          } else if (e.key === 'Enter' && !settings.enterNewline) {
            if (!e.shiftKey) {
              e.preventDefault();
              onCommit(e.target.value);
              e.stopPropagation();
              return;
            }
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onCommit(e.target.value);
          }
          e.stopPropagation();
        }}
        onBlur={(e) => {
          setEmojiPicker(prev => prev.visible ? { ...prev, visible: false } : prev);
          onCommit(e.target.value);
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </>
  );
}
