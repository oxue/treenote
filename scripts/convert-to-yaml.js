#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const mdPath = path.join(os.homedir(), 'Desktop', 'todo.md');
const yamlPath = path.join(os.homedir(), 'Desktop', 'todo.yaml');
const configPath = path.join(__dirname, '..', 'treenote.config.json');

// Reuse parser logic (ESM module, so we inline the parse here)
function parseMarkdownTree(text) {
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

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    stack[stack.length - 1].node.children.push(node);
    stack.push({ node, indent });
  }

  return root.children;
}

function nodesToYaml(nodes) {
  return nodes.map(node => ({
    text: node.text,
    checked: node.checked,
    children: nodesToYaml(node.children),
  }));
}

// Convert
if (!fs.existsSync(mdPath)) {
  console.log(`No file found at ${mdPath}, nothing to convert.`);
  process.exit(0);
}

const md = fs.readFileSync(mdPath, 'utf-8');
const tree = parseMarkdownTree(md);
const yamlContent = yaml.dump(nodesToYaml(tree), { lineWidth: -1 });
fs.writeFileSync(yamlPath, yamlContent, 'utf-8');
console.log(`Wrote ${yamlPath}`);

// Update config
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
config.defaultFile = '~/Desktop/todo.yaml';
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
console.log('Updated treenote.config.json');
