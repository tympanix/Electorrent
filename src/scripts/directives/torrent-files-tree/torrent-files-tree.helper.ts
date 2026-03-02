/**
 * Builds a flat tree-like list of rows (folders + files) from TorrentFile[].
 * Folders have size = sum of file sizes inside; folders can be expanded/collapsed.
 */
import { TorrentFile } from "../../bittorrent/abstracttorrent";

export interface TorrentFileRow {
  depth: number;
  name: string;
  path: string;
  parentPath: string | null;
  size: number;
  file?: TorrentFile;
  isDirectory: boolean;
  /** All files in this folder's subtree (for folder rows only) */
  filesInSubtree: TorrentFile[];
}

interface TreeNode {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  file?: TorrentFile;
  totalSize: number;
  filesInSubtree: TorrentFile[];
}

function collectSizeAndFiles(node: TreeNode): void {
  if (node.file != null) {
    node.totalSize = node.file.size || 0;
    node.filesInSubtree = [node.file];
    return;
  }
  node.totalSize = 0;
  node.filesInSubtree = [];
  const children = Array.from(node.children.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  children.forEach((child) => {
    collectSizeAndFiles(child);
    node.totalSize += child.totalSize;
    node.filesInSubtree.push(...child.filesInSubtree);
  });
}

export function buildTorrentFileRows(files: TorrentFile[]): TorrentFileRow[] {
  if (!files || !files.length) return [];

  const root: TreeNode = {
    name: "",
    path: "",
    children: new Map<string, TreeNode>(),
    totalSize: 0,
    filesInSubtree: [],
  };

  files.forEach((file) => {
    const rawPath = (file.path || file.name || "").replace(/\\/g, "/");
    const parts = rawPath.split("/").filter(Boolean);
    if (!parts.length) return;

    let current = root;
    let currentPath = "";
    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let child = current.children.get(part);
      if (!child) {
        child = {
          name: part,
          path: currentPath,
          children: new Map<string, TreeNode>(),
          totalSize: 0,
          filesInSubtree: [],
        };
        current.children.set(part, child);
      }
      if (index === parts.length - 1) {
        child.file = file;
      }
      current = child;
    });
  });

  collectSizeAndFiles(root);

  const rows: TorrentFileRow[] = [];

  const traverse = (node: TreeNode, depth: number, parentPath: string | null) => {
    if (node === root) {
      const children = Array.from(node.children.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      children.forEach((child) => traverse(child, 0, null));
      return;
    }

    const isDirectory = node.file == null || node.children.size > 0;
    rows.push({
      depth,
      name: node.name,
      path: node.path,
      parentPath,
      size: node.totalSize,
      file: node.file,
      isDirectory,
      filesInSubtree: node.filesInSubtree,
    });

    const children = Array.from(node.children.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    children.forEach((child) => traverse(child, depth + 1, node.path));
  };

  traverse(root, 0, null);
  return rows;
}
