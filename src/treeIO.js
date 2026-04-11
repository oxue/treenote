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
  return arr.map(item => {
    const node = {
      text: item.text || '',
      checked: !!item.checked,
      children: yamlToNodes(item.children || []),
    };
    if (item.markdown) node.markdown = true;
    if (item.deadline) node.deadline = item.deadline;
    if (item.deadlineTime) node.deadlineTime = item.deadlineTime;
    if (item.deadlineDuration) node.deadlineDuration = item.deadlineDuration;
    if (item.priority) node.priority = item.priority;
    return node;
  });
}

function nodesToYaml(nodes) {
  return nodes.map(node => {
    const out = {
      text: node.text,
      checked: node.checked,
    };
    if (node.markdown) out.markdown = true;
    if (node.deadline) out.deadline = node.deadline;
    if (node.deadlineTime) out.deadlineTime = node.deadlineTime;
    if (node.deadlineDuration) out.deadlineDuration = node.deadlineDuration;
    if (node.priority) out.priority = node.priority;
    out.children = nodesToYaml(node.children);
    return out;
  });
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
