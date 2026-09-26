import { describe, expect, it } from "vitest";
import { buildStoredZip } from "./epubZip";

const encoder = new TextEncoder();

describe("EPUB ZIP serialization", () => {
  it("writes an uncompressed mimetype first with its known CRC-32", () => {
    const mimetype = encoder.encode("application/epub+zip");
    const archive = buildStoredZip([{ path: "mimetype", bytes: mimetype }]);
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);

    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint16(8, true)).toBe(0); // ZIP store method
    expect(view.getUint32(14, true)).toBe(0x2cab616f); // CRC-32 fixture
    expect(view.getUint32(18, true)).toBe(mimetype.length);
    expect(view.getUint32(22, true)).toBe(mimetype.length);
    const payloadOffset = 30 + view.getUint16(26, true);
    expect(new TextDecoder().decode(archive.slice(payloadOffset, payloadOffset + mimetype.length)))
      .toBe("application/epub+zip");
  });

  it("points the central directory at both entries and their local headers", () => {
    const archive = buildStoredZip([
      { path: "mimetype", bytes: encoder.encode("application/epub+zip") },
      { path: "OEBPS/content.xhtml", bytes: encoder.encode("<p>桜</p>") },
    ]);
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
    const end = archive.byteLength - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const centralStart = view.getUint32(end + 16, true);
    const centralSize = view.getUint32(end + 12, true);
    expect(centralStart + centralSize).toBe(end);

    let position = centralStart;
    for (const path of ["mimetype", "OEBPS/content.xhtml"]) {
      expect(view.getUint32(position, true)).toBe(0x02014b50);
      const pathLength = view.getUint16(position + 28, true);
      expect(new TextDecoder().decode(archive.slice(position + 46, position + 46 + pathLength)))
        .toBe(path);
      expect(view.getUint32(view.getUint32(position + 42, true), true)).toBe(0x04034b50);
      position += 46 + pathLength;
    }
    expect(position).toBe(end);
  });
});
