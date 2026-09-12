// 読書面（読む）・確認面（確認）のモック突き合わせ用 fixture（2026-09-13）。
// 実アプリ（`App`）を**ネイティブ境界だけ**スタブして描く。UI は作り直さない。
//   ?open=<path>  : 「ファイルを開く」で返すパス（既定 /workspace/散文集/02_朝の余白.md）
//   ?theme=light|dark
// パス付き文書を開くには起動後に「ファイルを開く」を1回押す（plugin:dialog|open がパスを返す）。
import React from "react";
import { createRoot } from "react-dom/client";
import App from "../../../src/App";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);
const OPEN_PATH = params.get("open") ?? "/workspace/散文集/02_朝の余白.md";

// モック04/05 に寄せた検証用の散文集（6章）。各章は見開き（2ページ以上）になる長さ。
const BOOK = [
  "# はじめに",
  "",
  "この本は、暮らしの中にある小さな余白についての記録です。",
  "",
  "急いでいるわけではないのに、なぜか息が浅くなっている日があります。やることは終わっているのに、心だけが次の予定を探している日があります。そういう日のために、この本を書きました。",
  "",
  "ここに並ぶのは、特別な出来事ではありません。朝の光、机の上の空白、雨の音。どれも、見落とそうと思えばそのまま見落としてしまうようなものです。",
  "",
  "見落とさなかった日の記録を、ここに残します。",
  "",
  "# 第二章 朝の余白",
  "",
  "余白は、何もない場所ではない。まだことばになっていない考えや、見落としていた感情が、静かに姿を現すための場所なのだと思う。",
  "",
  "いつもなら、手を伸ばすはずの携帯電話を、その朝は机の隅に置いた。画面の向こうで始まっている一日を、少しだけ待たせてみる。",
  "",
  "カップから上がる湯気が、朝の光の中をゆっくりほどけていく。その行方を、しばらく目で追っていた。",
  "",
  "待たせてみると、一日は案外、急いでいなかった。急いでいたのは、こちらのほうだったのだ。",
  "",
  "窓を開けると、空気が入れ替わる。部屋の中の時間と、外の時間が、少しだけ混ざり合う。",
  "",
  "誰かに見せるためではない言葉が、頭の中に浮かんでは消えていく。捕まえようとしないほうが、長く残る。",
  "",
  "朝の余白は、一日のための準備ではない。それ自体が、一日の一部なのだと思う。",
  "",
  "# 第三章 散歩の途中で",
  "",
  "道と道のあいだにも、暮らしの余白がある。立ち止まって見上げると、知らなかった枝の形に気づく。",
  "",
  "目的地を決めない散歩は、少しだけ贅沢だ。歩いた距離ではなく、立ち止まった回数で測りたくなる。",
  "",
  "商店街の角で、古い看板を見つけた。文字は半分消えているのに、そこにあった時間だけは、はっきりと残っていた。",
  "",
  "犬を連れた人が、ゆっくりと追い越していく。急ぐ人と急がない人が、同じ道を使っている。",
  "",
  "帰り道は、行きとは違う道を選ぶ。同じ景色でも、向きが変われば、見えるものが変わる。",
  "",
  "玄関を開ける前に、一度だけ振り返る。街の音が、少し遠くなっている。",
  "",
  "散歩の効用は、歩いたことではなく、歩いている間に何を考えなくなれるかにある。",
  "",
  "# 第四章 机と窓辺",
  "",
  "机の上の余白も、書くための道具だと思う。物を置かない場所があると、そこに何かが置きたくなる。置きたくなったものは、たいてい、その日の自分に必要なものだ。",
  "",
  "窓辺には小さな鉢植えがある。名前はまだない。水をやるたびに、葉の向きが少しずつ変わる。",
  "",
  "光の方を向こうとする姿は、まっすぐで、少しだけうらやましい。",
  "",
  "夕方になると、机の上の影がのびていく。影の形を眺めていると、今日という日がどんな形だったか、少しずつ分かってくる気がする。",
  "",
  "道具は、使うために置く。でも、置いておくだけの道具にも、意味がある。",
  "",
  "引き出しの中は、まだ整理できていない。整理できていないものの一覧が、そのまま、これからやることの一覧になっている。",
  "",
  "机に向かう時間の半分は、机から離れて過ごしている。それでも、机があるから戻ってこられる。",
  "",
  "# 第五章 雨の日の記録",
  "",
  "雨の日は、音が近い。窓を打つ粒の数だけ、世界が細かくなる。書く手も、いつもより少しだけゆっくりになる。",
  "",
  "読み返すと、雨の日の記録だけが、なぜか行間が広い。急がなかった日のことは、よく覚えている。",
  "",
  "傘を持たずに出て、少し濡れて帰る。濡れることを許すと、雨は急にやさしくなる。",
  "",
  "軒先で雨宿りをしていると、知らない人と、雨の話だけをする。それだけで、少しだけ同じ場所にいる気持ちになる。",
  "",
  "雨が上がると、街の色が一段濃くなる。洗われた、というより、思い出された、という感じがする。",
  "",
  "窓ガラスについた雫が、一つずつ落ちていく。落ちる順番は、いつも、不規則だ。",
  "",
  "雨の日の予定は、たいてい半分しか実行できない。残りの半分は、次の晴れた日のために取っておく。",
  "",
  "# おわりに",
  "",
  "余白は、埋めるためにあるのではない。余白があるから、次の何かが入ってこられる。",
  "",
  "この本を閉じたあと、少しだけ、いつもの一日が違って見えたなら。それはたぶん、あなたの中にもともとあった余白のせいだと思う。",
  "",
  "書くことも、読むことも、結局は、余白との付き合い方なのかもしれない。",
  "",
].join("\n");

let callbackId = 0;
(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {
  transformCallback: (callback: unknown) => {
    callbackId += 1;
    (window as unknown as Record<string, unknown>)[`_${callbackId}`] = callback;
    return callbackId;
  },
  unregisterListener: () => {},
  metadata: {
    currentWindow: { label: "main" },
    currentWebview: { label: "main", windowLabel: "main" },
  },
  invoke: async (command: string, args?: Record<string, unknown>) => {
    switch (command) {
      case "plugin:dialog|open":
        // 「ファイルを開く」等の選択ダイアログ。ディレクトリ要求には null。
        return args?.options && (args.options as { directory?: boolean }).directory
          ? null
          : OPEN_PATH;
      case "plugin:dialog|message":
        return true;
      case "plugin:dialog|confirm":
        return true;
      case "get_file_metadata":
        return {
          path: (args?.path as string) ?? OPEN_PATH,
          size: BOOK.length,
          modified_ms: Date.parse("2026-09-13T05:00:00+09:00"),
          fingerprint: "fp-book",
          large_file_warning: false,
        };
      case "check_apple_assist_availability":
        return { kind: "unsupported" };
      case "open_text_file": {
        const openPath = (args?.path as string) ?? OPEN_PATH;
        return {
          path: openPath,
          name: openPath.split("/").pop() ?? "02_朝の余白.md",
          contents: BOOK,
          encoding: "utf-8",
          line_ending: "lf",
          size: BOOK.length,
          modified_ms: null,
          fingerprint: "fp-book",
          large_file_warning: false,
        };
      }
      case "list_recent_workspaces":
      case "list_recent_entries":
      case "list_backups":
      case "drain_opened_files":
      case "list_workspace_directory":
        return [];
      default:
        return null;
    }
  },
};

(window as unknown as { __TAURI_EVENT_PLUGIN_INTERNALS__?: unknown })
  .__TAURI_EVENT_PLUGIN_INTERNALS__ = {
  registerListener: () => 1,
  unregisterListener: () => {},
};

document.documentElement.dataset.theme = params.get("theme") ?? "light";
// 検証時はメニュー言語を固定する（既定 ja）。?lang=en|kana で切り替え。
window.localStorage.setItem(
  "hazakura-note-menu-language",
  params.get("lang") ?? "ja",
);

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
