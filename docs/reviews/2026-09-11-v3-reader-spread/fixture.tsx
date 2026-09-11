// 実機指摘②（読む＝全幅の見開き読書面）と④（電子書籍の余白）の証跡。
// 実コンポーネント EBookPane を、アプリの読書面と同じ `.ebook-reading-focus-surface`
// の中で描く。ネイティブ（画像・保存）は呼ばない。表示だけ。
//   ?theme=light|dark   ?w=1440|1024   （幅は JS からは変えられないので CDP で変える）
import React from "react";
import { createRoot } from "react-dom/client";
import EBookPane from "../../../src/components/editor/preview/EBookPane";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get("theme") ?? "light";

const paragraph = (n: number) =>
  `余白は、何もない場所ではない。まだことばになっていない考えや、見落としていた感情が、静かに姿を現すための場所なのだと思う。（段落${n}）\n\nカップから上がる湯気が、朝の光の中をゆっくりほどけていく。その行方を、しばらく目で追っていた。窓の外では、鳥が一羽、枝から枝へと移っていく。\n`;

// 見開きは「1列目が埋まって2列目へ続く」ことで初めて成立する。章の本文を
// 1列（455×約600px）に収まらない長さにして、2列目に続きが出る状態を作る。
const source = [
  "# 第一章 朝の余白",
  "",
  ...Array.from({ length: 6 }, (_, index) => paragraph(index + 1)),
  "",
  "# 第二章 机と窓辺",
  "",
  ...Array.from({ length: 4 }, (_, index) => paragraph(index + 7)),
].join("\n");

createRoot(document.getElementById("root") as HTMLElement).render(
  <main className="app-shell v3-shell" style={{ display: "grid", height: "100vh" }}>
    <div aria-label="電子書籍" className="ebook-reading-focus-surface">
      <EBookPane
        documentKey="fixture-reader"
        documentPath="/随筆/chapters/02_朝の余白.md"
        initialLocation={{ chapterIndex: 0, pageIndex: 0 }}
        mediaAccess={{ approvedRoots: [], loadRemoteImages: false, outsideImages: "ask" }}
        menuLanguage="ja"
        onApproveLocalImageParent={() => {}}
        onExitReadingFocus={() => {}}
        onLocationChange={() => {}}
        onOpenLocalLink={() => {}}
        readingFocusActive
        searchSourceLine={null}
        source={source}
        workspaceRoot="/随筆"
      />
    </div>
  </main>,
);
