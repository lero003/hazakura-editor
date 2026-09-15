import type { EditorTab } from "../../types";

type PathEntry = {
  id: string;
  parts: string[];
};

/**
 * Duplicated tab names need the shortest ancestor segment that makes
 * their visible row label unique. `path` remains tab identity; the
 * result is display-only.
 */
export function shortestDistinguishingAncestor(
  tabs: EditorTab[],
): Map<string, string> {
  const duplicateNames = new Set(
    tabs
      .map((tab) => tab.name)
      .filter((name, index, names) =>
        names.indexOf(name) !== names.lastIndexOf(name)),
  );
  const labels = new Map<string, string>();
  if (duplicateNames.size === 0) {
    return labels;
  }

  for (const name of duplicateNames) {
    const pathSegments = tabs
      .filter((tab) => tab.name === name)
      .map((tab) => ({
        id: tab.id,
        parts: tab.path.split(/[\\/]+/).filter(Boolean).slice(0, -1),
      }));
    // Pick the shortest prefix of ancestor folders that separates the
    // duplicated tab names. Depth 1 tries only the closest folder, then
    // extends outward toward the root/home level until the labels differ.
    // The cap is the deepest ancestor list in the group, so a fixed
    // magic number can never silently stop short of a unique label.
    const maxDepth = pathSegments.reduce(
      (deepest, entry) => Math.max(deepest, entry.parts.length),
      1,
    );
    for (let depth = 1; depth <= maxDepth; depth += 1) {
      const candidate = new Map(
        pathSegments.map((entry) => [
          entry.id,
          entry.parts.slice(entry.parts.length - depth).join("/"),
        ]),
      );
      const labelsInGroup = [...candidate.values()];
      if (
        candidate.size === pathSegments.length &&
        new Set(labelsInGroup).size === pathSegments.length
      ) {
        for (const [id, label] of candidate.entries()) {
          labels.set(id, label);
        }
        break;
      }
    }
  }

  return labels;
}
