const URL_RE = /(https?:\/\/[^\s]+)/g;

export default function Linkify({ text }) {
  const parts = text.split(URL_RE);
  return parts.map((part, i) =>
    URL_RE.test(part)
      ? <a key={i} href={part} className="node-link" onClick={(e) => e.stopPropagation()} target="_blank" rel="noopener noreferrer">{part}</a>
      : part
  );
}
