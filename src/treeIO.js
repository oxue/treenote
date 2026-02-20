import yaml from 'js-yaml';
import { parseMarkdownTree, serializeTree as serializeTreeAsMarkdown } from './parser';

export { serializeTreeAsMarkdown };

export function detectFormat(content) {
  const trimmed = content.trim();
  // YAML tree nodes start with "- text:" at top level
  if (/^- text:/m.test(trimmed)) return 'yaml';
  return 'markdown';
}

function yamlToNodes(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => ({
    text: item.text || '',
    checked: !!item.checked,
    children: yamlToNodes(item.children || []),
  }));
}

function nodesToYaml(nodes) {
  return nodes.map(node => ({
    text: node.text,
    checked: node.checked,
    children: nodesToYaml(node.children),
  }));
}

export function parseTree(content) {
  const format = detectFormat(content);
  if (format === 'yaml') {
    const data = yaml.load(content);
    return yamlToNodes(data);
  }
  return parseMarkdownTree(content);
}

export function serializeTree(tree) {
  return yaml.dump(nodesToYaml(tree), { lineWidth: -1 });
}
