import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OnDeviceModelsPane } from "./OnDeviceModelsPane";
import { getPreferencesCopy } from "../../lib/locale";

afterEach(cleanup);

describe("OnDeviceModelsPane", () => {
  // jsdom は Tauri ではないため、一覧は catalog を持たない状態へ正直に縮退する。
  // ここで見るのはページの構成で、配布状態の判定そのものは Rust 側のテストが持つ。

  it("is one page: heading, storage explanation, model list, and the recorded settings", async () => {
    render(<OnDeviceModelsPane copy={getPreferencesCopy("ja")} language="ja" />);

    expect(screen.getByRole("heading", { name: "オンデバイスモデル" })).toBeTruthy();
    expect(screen.getByText(/保存先は選べません/)).toBeTruthy();
    expect(await screen.findByText("Apple Intelligence")).toBeTruthy();
    expect(await screen.findByText(/まだ Core AI の生成を記録していません/)).toBeTruthy();
  });

  it("starts nothing on open: no download button and no model work without an explicit action", async () => {
    render(<OnDeviceModelsPane copy={getPreferencesCopy("en")} language="en" />);

    expect(await screen.findByText(/No Core AI model has been published/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("keeps the storage explanation out of a user-chosen folder", () => {
    // 保存先は Apple-hosted asset pack がプロセス単位で決めるため、選ばせる UI を作らない。
    render(<OnDeviceModelsPane copy={getPreferencesCopy("en")} language="en" />);

    expect(screen.getByText(/You cannot choose the location/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Choose|Browse|Save to/i })).toBeNull();
  });
});
