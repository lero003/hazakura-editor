import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MENU_LANGUAGE_STORAGE_KEY } from "../../types";
import {
  DOCUMENT_CONTENT_LANG,
  documentLanguageForMenuLanguage,
  isMenuLanguage,
  readStoredMenuLanguage,
  syncDocumentLanguageFromStorage,
} from "./documentLanguage";

describe("documentLanguageForMenuLanguage", () => {
  it("maps the kana presentation to Japanese and keeps en / ja apart", () => {
    expect(documentLanguageForMenuLanguage("en")).toBe("en");
    expect(documentLanguageForMenuLanguage("ja")).toBe("ja");
    expect(documentLanguageForMenuLanguage("kana")).toBe("ja");
  });
});

describe("DOCUMENT_CONTENT_LANG", () => {
  it("marks document regions as language-unknown instead of a UI language", () => {
    // 空文字は HTML の「言語不明」。ルートの `lang` を継承させないための値なので、
    // ここが `ja` / `en` に変わると本文へ UI 言語が漏れる。
    expect(DOCUMENT_CONTENT_LANG).toBe("");
  });
});

describe("isMenuLanguage", () => {
  it("accepts only the shipped menu languages", () => {
    expect(isMenuLanguage("en")).toBe(true);
    expect(isMenuLanguage("ja")).toBe(true);
    expect(isMenuLanguage("kana")).toBe(true);
    expect(isMenuLanguage("fr")).toBe(false);
    expect(isMenuLanguage(null)).toBe(false);
  });
});

describe("readStoredMenuLanguage", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it("falls back to en when nothing usable is stored", () => {
    expect(readStoredMenuLanguage()).toBe("en");

    window.localStorage.setItem(MENU_LANGUAGE_STORAGE_KEY, "fr");
    expect(readStoredMenuLanguage()).toBe("en");
  });

  it("reads the stored ja / kana preferences", () => {
    window.localStorage.setItem(MENU_LANGUAGE_STORAGE_KEY, "kana");
    expect(readStoredMenuLanguage()).toBe("kana");
  });
});

describe("syncDocumentLanguageFromStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "en";
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
  });

  it("applies a stored Japanese preference to the root element", () => {
    window.localStorage.setItem(MENU_LANGUAGE_STORAGE_KEY, "ja");

    expect(syncDocumentLanguageFromStorage()).toBe("ja");
    expect(document.documentElement.lang).toBe("ja");
  });

  it("applies the kana presentation as Japanese", () => {
    window.localStorage.setItem(MENU_LANGUAGE_STORAGE_KEY, "kana");

    expect(syncDocumentLanguageFromStorage()).toBe("ja");
    expect(document.documentElement.lang).toBe("ja");
  });

  it("keeps en for an empty or unexpected preference", () => {
    window.localStorage.setItem(MENU_LANGUAGE_STORAGE_KEY, "fr");

    expect(syncDocumentLanguageFromStorage()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });
});
