/**
 * Shared helpers for the CSS contract tests under `src/styles/`.
 *
 * These tests read the stylesheets as text; keeping the small text utilities in
 * one module avoids the several near-identical copies that used to live in each
 * test file.
 */

/** Removes `/* ... *\/` comments so selector/declaration checks see real rules. */
export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Body of the first rule whose selector starts the match (single-block rules). */
export function ruleBody(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    css.match(new RegExp(`${escapedSelector}\\s*{(?<body>[^}]*)}`, "s"))?.groups
      ?.body ?? ""
  );
}
