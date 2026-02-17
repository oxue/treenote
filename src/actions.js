// Tree action helpers
// Each action takes the current tree + location, returns { tree, path, selectedIndex }

function cloneTree(tree) {
  return JSON.parse(JSON.stringify(tree));
}

function getNodesAt(tree, path) {
  let nodes = tree;
  for (const idx of path) {
    nodes = nodes[idx].children;
  }
  return nodes;
}

function getNodeAt(tree, path, index) {
  return getNodesAt(tree, path)[index];
}

function newNode(text = '') {
  return { text, checked: false, children: [] };
}

// Edit the text of the selected node
export function editNodeText(tree, path, selectedIndex, newText) {
  const newTree = cloneTree(tree);
  const node = getNodeAt(newTree, path, selectedIndex);
  const trimmed = newText.trim();
  node.text = trimmed || node.text;
  return { tree: newTree, path, selectedIndex };
}

// Insert a sibling below the selected node
export function insertSiblingBelow(tree, path, selectedIndex) {
  const newTree = cloneTree(tree);
  const siblings = getNodesAt(newTree, path);
  siblings.splice(selectedIndex + 1, 0, newNode());
  return { tree: newTree, path, selectedIndex: selectedIndex + 1 };
}

// Insert a sibling above the selected node
export function insertSiblingAbove(tree, path, selectedIndex) {
  const newTree = cloneTree(tree);
  const siblings = getNodesAt(newTree, path);
  siblings.splice(selectedIndex, 0, newNode());
  return { tree: newTree, path, selectedIndex };
}

// Insert a node between the selected node and its parent
// The new node takes the selected node's place in the parent's children,
// and the selected node becomes a child of the new node
export function insertParent(tree, path, selectedIndex) {
  if (path.length === 0) return null; // no parent to insert between at root
  const newTree = cloneTree(tree);
  const parentPath = path.slice(0, -1);
  const parentIdx = path[path.length - 1];
  const parentSiblings = getNodesAt(newTree, parentPath);
  const currentParent = parentSiblings[parentIdx];

  // Create new intermediate node that takes over current parent's children
  const intermediate = newNode();
  intermediate.children = currentParent.children;
  currentParent.children = [intermediate];

  // Navigate: same path, but now the children are one level deeper
  // We stay at the same depth, viewing the intermediate's children
  // Actually: the new node is at path=[...parentPath, parentIdx], index 0
  // and the old siblings are now at path=[...parentPath, parentIdx, 0]
  return { tree: newTree, path, selectedIndex: 0 };
}

// Insert a node between the selected node and its children
// The new node becomes the only child of the selected node,
// and the selected node's old children become children of the new node
export function insertChild(tree, path, selectedIndex) {
  const newTree = cloneTree(tree);
  const node = getNodeAt(newTree, path, selectedIndex);

  const intermediate = newNode();
  intermediate.children = node.children;
  node.children = [intermediate];

  // Navigate into the selected node to see the new intermediate
  return {
    tree: newTree,
    path: [...path, selectedIndex],
    selectedIndex: 0,
  };
}

// Delete node and all its children
export function deleteNodeWithChildren(tree, path, selectedIndex) {
  const newTree = cloneTree(tree);
  const siblings = getNodesAt(newTree, path);
  siblings.splice(selectedIndex, 1);
  const newIndex = Math.min(selectedIndex, siblings.length - 1);
  // If no siblings left, go up one level
  if (siblings.length === 0 && path.length > 0) {
    return { tree: newTree, path: path.slice(0, -1), selectedIndex: path[path.length - 1] };
  }
  return { tree: newTree, path, selectedIndex: Math.max(0, newIndex) };
}

// Delete node but move its children up to take its place among siblings
export function deleteNodeKeepChildren(tree, path, selectedIndex) {
  const newTree = cloneTree(tree);
  const siblings = getNodesAt(newTree, path);
  const node = siblings[selectedIndex];
  const children = node.children;
  siblings.splice(selectedIndex, 1, ...children);
  const newIndex = Math.min(selectedIndex, siblings.length - 1);
  if (siblings.length === 0 && path.length > 0) {
    return { tree: newTree, path: path.slice(0, -1), selectedIndex: path[path.length - 1] };
  }
  return { tree: newTree, path, selectedIndex: Math.max(0, newIndex) };
}

// Swap selected node with the one above
export function swapUp(tree, path, selectedIndex) {
  if (selectedIndex <= 0) return null;
  const newTree = cloneTree(tree);
  const siblings = getNodesAt(newTree, path);
  [siblings[selectedIndex - 1], siblings[selectedIndex]] = [siblings[selectedIndex], siblings[selectedIndex - 1]];
  return { tree: newTree, path, selectedIndex: selectedIndex - 1 };
}

// Swap selected node with the one below
export function swapDown(tree, path, selectedIndex) {
  const newTree = cloneTree(tree);
  const siblings = getNodesAt(newTree, path);
  if (selectedIndex >= siblings.length - 1) return null;
  [siblings[selectedIndex], siblings[selectedIndex + 1]] = [siblings[selectedIndex + 1], siblings[selectedIndex]];
  return { tree: newTree, path, selectedIndex: selectedIndex + 1 };
}

// Toggle checked state of the selected node
// When checking, move the node to the end of its siblings
export function toggleChecked(tree, path, selectedIndex) {
  const newTree = cloneTree(tree);
  const siblings = getNodesAt(newTree, path);
  const node = siblings[selectedIndex];
  node.checked = !node.checked;
  if (node.checked) {
    siblings.splice(selectedIndex, 1);
    siblings.push(node);
    return { tree: newTree, path, selectedIndex: Math.min(selectedIndex, siblings.length - 1) };
  }
  return { tree: newTree, path, selectedIndex };
}

// Delete all checked nodes at the current level
export function deleteCheckedNodes(tree, path, selectedIndex) {
  const newTree = cloneTree(tree);
  const siblings = getNodesAt(newTree, path);
  const unchecked = siblings.filter(n => !n.checked);
  if (unchecked.length === siblings.length) return null; // nothing to delete
  // Replace siblings in-place
  siblings.length = 0;
  unchecked.forEach(n => siblings.push(n));
  const newIndex = Math.min(selectedIndex, siblings.length - 1);
  if (siblings.length === 0 && path.length > 0) {
    return { tree: newTree, path: path.slice(0, -1), selectedIndex: path[path.length - 1] };
  }
  return { tree: newTree, path, selectedIndex: Math.max(0, newIndex) };
}

// Merge selected node's text into its parent (appending with newline)
// The node is removed; its children are promoted to siblings in its place
export function mergeIntoParent(tree, path, selectedIndex) {
  if (path.length === 0) return null; // root nodes have no parent to merge into
  const newTree = cloneTree(tree);
  const parentPath = path.slice(0, -1);
  const parentIdx = path[path.length - 1];
  const parent = getNodeAt(newTree, parentPath, parentIdx);
  const siblings = parent.children;
  const node = siblings[selectedIndex];
  // Append node text to parent
  parent.text = parent.text + '\n' + node.text;
  // Replace node with its children
  siblings.splice(selectedIndex, 1, ...node.children);
  const newIndex = Math.min(selectedIndex, siblings.length - 1);
  if (siblings.length === 0) {
    return { tree: newTree, path: parentPath, selectedIndex: parentIdx };
  }
  return { tree: newTree, path, selectedIndex: Math.max(0, newIndex) };
}

export { cloneTree, getNodeAt, getNodesAt };
