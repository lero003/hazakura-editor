import { describe, expect, it } from "vitest";
import {
  findYamlFrontmatter,
  stripYamlFrontmatter,
} from "./markdownFrontmatter";

describe("findYamlFrontmatter", () => {
  it("returns the body offset and closing line for a well-formed block", () => {
    const source = "---\ntitle: Test\n---\n# Body";

    expect(findYamlFrontmatter(source)).toEqual({
      bodyOffset: 20,
      endLine: 3,
    });
    expect(stripYamlFrontmatter(source)).toBe("# Body");
  });

  it("supports CRLF line endings", () => {
    const source = "---\r\ntitle: Test\r\n---\r\n# Body";

    expect(findYamlFrontmatter(source)).toEqual({
      bodyOffset: 23,
      endLine: 3,
    });
    expect(stripYamlFrontmatter(source)).toBe("# Body");
  });

  it("leaves an unclosed opener as ordinary Markdown", () => {
    const source = "---\ntitle: Test\n# Body";

    expect(findYamlFrontmatter(source)).toBeNull();
    expect(stripYamlFrontmatter(source)).toBe(source);
  });
});
