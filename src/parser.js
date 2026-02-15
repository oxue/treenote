export function serializeTree(nodes, depth = 0) {
  const indent = '    '.repeat(depth);
  let out = '';
  for (const node of nodes) {
    const check = node.checked ? 'x' : ' ';
    out += `${indent}- [${check}] ${node.text}\n`;
    if (node.children.length > 0) {
      out += serializeTree(node.children, depth + 1);
    }
  }
  return out;
}

export function parseMarkdownTree(text) {
  const lines = text.split('\n');
  const root = { text: 'Root', checked: false, children: [] };
  const stack = [{ node: root, indent: -1 }];

  for (const line of lines) {
    const match = line.match(/^(\s*)-\s+\[([ x])\]\s+(.+)/);
    if (!match) continue;

    const indent = match[1].length;
    const checked = match[2] === 'x';
    const text = match[3].trim();
    const node = { text, checked, children: [] };

    // Pop stack until we find a parent with less indentation
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    stack[stack.length - 1].node.children.push(node);
    stack.push({ node, indent });
  }

  return root.children;
}
