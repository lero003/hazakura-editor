import hazakuraMark from "../../assets/hazakura-mark.png";
import type { SafeEditorCopy } from "../../lib/locale/safeEditor";

export function StartPanel({
  copy,
  onNewFile,
  onOpenFile,
  onOpenFolder,
}: {
  copy: SafeEditorCopy;
  onNewFile: () => void | Promise<void>;
  onOpenFile: () => void | Promise<void>;
  onOpenFolder: () => void | Promise<void>;
}) {
  return (
    <div className="start-panel">
      <div className="start-panel-main">
        <div className="start-brand">
          <img className="start-logo" src={hazakuraMark} alt="" />
          <span className="start-kicker">Hazakura Editor</span>
        </div>
        <h1>{copy.startHeading}</h1>
        <p className="start-value-pitch">{copy.startValuePitch}</p>
        <ul className="start-purpose-hints" aria-label={copy.startValuePitch}>
          <li>{copy.startHintWrite}</li>
          <li>{copy.startHintRead}</li>
          <li>{copy.startHintVerify}</li>
        </ul>
        <div className="start-actions" aria-label={copy.startActions}>
          <button type="button" onClick={() => void onOpenFile()}>
            {copy.openFile}
          </button>
          <button type="button" onClick={() => void onOpenFolder()}>
            {copy.openFolder}
          </button>
          <button type="button" onClick={() => void onNewFile()}>
            {copy.newFile}
          </button>
        </div>
      </div>
    </div>
  );
}
