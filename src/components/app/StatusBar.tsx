import type { ChangeEvent } from "react";
import type {
  EditableLineEnding,
  EditorTab,
  TextEncoding,
} from "../../types";
import { formatLineEndingKind, formatTextEncoding } from "../../lib/format";

/**
 * 文字コードのチップは**1つだけ**にする（第二調整）。
 *
 * 「保存するときの文字コードを変える」と「ファイルをこの文字コードで読み直す」は
 * 別の操作だが、別チップに並べると利用者から見て違いが分からない。しかも
 * 「読み直す」だけが文字化けの復旧路で、安全側（未保存なら実行しない）でもある。
 * そこで1つの select の中を2群に分け、**読み直す側を先**に置く。
 * さらにこの select は「これから行う操作」を選ぶ面（アクション選択）にし、
 * **selected は常に中立の placeholder** にする（現在値はチップの表示側が示す）。
 * 以前は selected を `save:<現在の文字コード>` にしていたため、ネイティブの
 * select やキーボード/VoiceOver では「保存する文字コードを変える」側が選択中に
 * 見え、安全側を先頭に置いた狙いが実質的に弱まっていた。
 * 現在値の表示（`--status-text` ではない chrome の文字色）と併せて、
 * ライトテーマでも文字が沈まないようにする。
 */
const SAVE_ENCODING_PREFIX = "save:";
const REOPEN_ENCODING_PREFIX = "reopen:";

const TEXT_ENCODINGS: { label: string; value: TextEncoding }[] = [
  { label: "UTF-8", value: "utf-8" },
  { label: "UTF-8 BOM", value: "utf-8-bom" },
  { label: "Shift-JIS", value: "shift-jis" },
  { label: "EUC-JP", value: "euc-jp" },
];

type StatusBarProps = {
  activeDirty: boolean;
  activeTab: EditorTab | null;
  agentLabel: string | null;
  detail: string;
  secondaryDetail: string;
  dirtyLabel: string;
  /** チップの説明。読み直せないときは理由を足して出す。 */
  encodingChipTitle: string;
  encodingLabel: string;
  /** select の aria-label（アクション選択であることを示す）。 */
  encodingActionLabel: string;
  /** 未選択（中立）の表示。selected は常にこれ。 */
  encodingActionPlaceholder: string;
  /** 読み直せない理由（未保存の編集があるとき）。 */
  encodingReopenBlocked: string;
  encodingReopenGroup: string;
  encodingSaveGroup: string;
  lineEndingAriaLabel: string;
  lineEndingLabel: string;
  lModeEnabled: boolean;
  onConvertEncoding: (encoding: TextEncoding) => void;
  onReopenEncoding?: (encoding: TextEncoding) => void;
  onConvertLineEnding: (lineEnding: EditableLineEnding) => void;
  saveAffirmation: boolean;
  saveAffirmationKey: number | null;
  statusText: string;
};

export function StatusBar({
  activeDirty,
  activeTab,
  agentLabel,
  detail,
  secondaryDetail,
  dirtyLabel,
  encodingChipTitle,
  encodingActionLabel,
  encodingActionPlaceholder,
  encodingLabel,
  encodingReopenBlocked,
  encodingReopenGroup,
  encodingSaveGroup,
  lineEndingAriaLabel,
  lineEndingLabel,
  lModeEnabled,
  onConvertEncoding,
  onReopenEncoding,
  onConvertLineEnding,
  saveAffirmation,
  saveAffirmationKey,
  statusText,
}: StatusBarProps) {
  // この select は「これから行う操作」を選ぶ面。selected は常に中立で、現在の文字コードは
  // チップの表示（「文字コード UTF-8」）が示す。
  const handleEncodingAction = (event: ChangeEvent<HTMLSelectElement>) => {
    const action = event.target.value;
    // controlled なので React が props の値（中立）へ戻すが、state が変わらない選択でも
    // 確実に戻す。次に開いたとき、直前の操作が選択中に見えないようにする。
    event.target.value = "";
    if (!action) {
      return;
    }
    onEncodingChoice(action);
  };
  const showFormatControls = Boolean(activeTab && !lModeEnabled);
  const fullDetail = joinStatusDetail(detail, secondaryDetail);
  const visibleDetail = showFormatControls ? detail : fullDetail;
  // 読み直しは「ディスクのファイルがある」「未保存の編集が無い」ときだけ。
  // 実行側（reopenTabFromDisk）と同じ条件をここで先に出し、押せない理由を title に書く。
  const reopenAvailable =
    Boolean(activeTab?.path) && !activeDirty && Boolean(onReopenEncoding);
  const encodingTitle = reopenAvailable
    ? encodingChipTitle
    : `${encodingChipTitle} — ${encodingReopenBlocked}`;

  const onEncodingChoice = (choice: string) => {
    if (choice.startsWith(REOPEN_ENCODING_PREFIX)) {
      onReopenEncoding?.(
        choice.slice(REOPEN_ENCODING_PREFIX.length) as TextEncoding,
      );
      return;
    }
    if (choice.startsWith(SAVE_ENCODING_PREFIX)) {
      onConvertEncoding(
        choice.slice(SAVE_ENCODING_PREFIX.length) as TextEncoding,
      );
    }
  };

  return (
    <footer className="status-bar lmode-surface">
      <span className="status-bar-segment status-bar-status" role="status" aria-live="polite">
        {saveAffirmation ? (
          <span
            aria-hidden="true"
            className="save-affirmation"
            key={saveAffirmationKey ?? "save-affirmation"}
          >
            ✓
          </span>
        ) : null}
        {statusText}
        {dirtyLabel ? (
          <span
            className="status-bar-unsaved-pill"
            aria-label={dirtyLabel}
            title={dirtyLabel}
          >
            {dirtyLabel}
          </span>
        ) : null}
      </span>
      {agentLabel ? (
        <span className="status-bar-segment status-agent-indicator" title="Agent mode active">
          <span className="status-agent-dot" />
          {agentLabel}
        </span>
      ) : null}
      {showFormatControls && activeTab ? (
        <span className="status-bar-format-group">
          <span className="status-bar-segment status-bar-detail" title={fullDetail}>
            {visibleDetail}
          </span>
          <label className="status-bar-segment status-bar-format-chip">
            <span className="status-bar-format-label">{lineEndingLabel}</span>
            <span className="status-bar-format-value" aria-hidden="true">
              {formatLineEndingKind(activeTab.line_ending)}
            </span>
            <select
              aria-label={lineEndingAriaLabel}
              className="status-bar-format-select"
              value={activeTab.line_ending}
              onChange={(event) =>
                onConvertLineEnding(event.target.value as EditableLineEnding)
              }
            >
              <option value="lf">LF</option>
              <option value="crlf">CRLF</option>
            </select>
          </label>
          <label className="status-bar-segment status-bar-format-chip" title={encodingTitle}>
            <span className="status-bar-format-label">{encodingLabel}</span>
            <span className="status-bar-format-value" aria-hidden="true">
              {formatTextEncoding(activeTab.encoding, "en")}
            </span>
            <select
              aria-label={encodingActionLabel}
              className="status-bar-format-select"
              value=""
              onChange={handleEncodingAction}
            >
              {/* 中立。ここが selected のまま戻るので、開いた直後に「保存側が選択中」に
                  見えることがない。 */}
              <option value="">{encodingActionPlaceholder}</option>
              {activeTab.path ? (
                <optgroup label={encodingReopenGroup}>
                  {TEXT_ENCODINGS.map((encoding) => (
                    <option
                      disabled={!reopenAvailable}
                      key={`${REOPEN_ENCODING_PREFIX}${encoding.value}`}
                      value={`${REOPEN_ENCODING_PREFIX}${encoding.value}`}
                    >
                      {encoding.label}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <optgroup label={encodingSaveGroup}>
                {TEXT_ENCODINGS.map((encoding) => (
                  <option
                    key={`${SAVE_ENCODING_PREFIX}${encoding.value}`}
                    value={`${SAVE_ENCODING_PREFIX}${encoding.value}`}
                  >
                    {encoding.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
        </span>
      ) : (
        <span className="status-bar-segment status-bar-detail" title={fullDetail}>
          {visibleDetail}
        </span>
      )}
    </footer>
  );
}

function joinStatusDetail(primary: string, secondary: string): string {
  return [primary, secondary].filter(Boolean).join(" · ");
}
