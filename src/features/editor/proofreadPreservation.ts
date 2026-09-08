import { marked } from "marked";

/** Conservative mechanical guard for proofread_only, not a semantic verifier. */
export function preservesProofreadStructure(original: string, candidate: string): boolean {
  const collect = (text: string): string[] => {
    const protectedParts = [...text.matchAll(/\p{N}+(?:[.,]\p{N}+)*/gu)].map(match => `number:${match[0]}`);
    marked.walkTokens(marked.lexer(text), token => {
      if (["code", "codespan", "blockquote", "table"].includes(token.type)) {
        protectedParts.push(`${token.type}:${token.raw.trim()}`);
      } else if (token.type === "link" || token.type === "image") {
        protectedParts.push(`${token.type}:${token.href}:${token.title ?? ""}`);
      } else if (token.type === "heading") {
        protectedParts.push(`heading:${token.depth}`);
      } else if (token.type === "list") {
        protectedParts.push(`list:${token.ordered}:${token.start}:${token.items.length}`);
      }
    });
    return protectedParts;
  };
  return JSON.stringify(collect(original)) === JSON.stringify(collect(candidate));
}
