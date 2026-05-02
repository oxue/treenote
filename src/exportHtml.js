// Runtime HTML export. Fetches the prebuilt single-file viewer template from
// /viewer-template.html, splices the tree payload in via the
// <!--TREENOTE_DATA--> placeholder, and triggers a download.

export async function exportNodeAsHtml(node, theme, boxWidth, sourceUrl) {
  if (!node) throw new Error('no node selected');

  const stripped = stripBackendFields(node);
  const payload = {
    // We always export the subtree as a top-level array so the viewer's
    // path/index logic works the same as the main app.
    tree: [stripped],
    theme: theme || 'dark',
    boxWidth: boxWidth || 400,
    exportedAt: new Date().toISOString(),
    sourceUrl: sourceUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
  };

  const res = await fetch('/viewer-template.html', { cache: 'no-store' });
  if (!res.ok) throw new Error('viewer template not available');
  let html = await res.text();

  // Escape `<` to defang any `</script>` substrings inside node text. JSON
  // strings preserve the escape as a real `<` once parsed.
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  const inject = `<script>window.__TREENOTE_DATA__ = ${json};</script>`;
  if (!html.includes('<!--TREENOTE_DATA-->')) {
    throw new Error('viewer template missing TREENOTE_DATA placeholder');
  }
  html = html.replace('<!--TREENOTE_DATA-->', inject);

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = makeFilename(node);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revoke to next tick so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Strip server/runtime-only fields. Keeps content + metadata users see.
const KEEP_FIELDS = ['text', 'children', 'checked', 'markdown', 'deadline', 'deadlineTime', 'deadlineDuration', 'priority'];

function stripBackendFields(node) {
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const key of KEEP_FIELDS) {
    if (key in node) out[key] = node[key];
  }
  // Always normalize children to an array.
  out.children = Array.isArray(node.children) ? node.children.map(stripBackendFields) : [];
  // Always include a checked field — NodeMeta inspects it.
  if (typeof out.checked !== 'boolean') out.checked = !!out.checked;
  return out;
}

function makeFilename(node) {
  const date = formatDate(new Date());
  const text = (node && typeof node.text === 'string') ? node.text : '';
  let slug = text
    .toLowerCase()
    .slice(0, 60)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  if (!slug) slug = 'export';
  return `treenote-${slug}-${date}.html`;
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}
