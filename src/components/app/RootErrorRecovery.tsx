import { Component, type ErrorInfo, type ReactNode } from "react";

type RootErrorRecoveryProps = {
  children: ReactNode;
};

type RootErrorRecoveryState = {
  error: Error | null;
  info: string | null;
};

type RootErrorRecoveryCopy = {
  title: string;
  body: string;
  diagnostics: string;
  reload: string;
  dismiss: string;
};

function getRootErrorRecoveryCopy(): RootErrorRecoveryCopy {
  if (document.documentElement.lang === "ja") {
    return {
      title: "編集セッションを保護しています",
      body:
        "予期しないエラーが発生しました。未保存のパス付き下書きや復旧候補はアプリ内ストレージに残っている場合があります。ソースファイルへの自動保存は行いません。",
      diagnostics: "診断情報",
      reload: "アプリを再読み込み",
      dismiss: "この画面を閉じて続行を試す",
    };
  }
  return {
    title: "Editing session protected",
    body:
      "An unexpected error occurred. Unsaved drafts and recovery candidates associated with file paths may still be available in app storage. Source files are not saved automatically.",
    diagnostics: "Diagnostics",
    reload: "Reload app",
    dismiss: "Close this screen and try to continue",
  };
}

/**
 * S-2: root-level recovery surface. A frontend exception should not
 * strand the entire editing session without a safe reload path.
 * Draft recovery remains in localStorage independently of this tree.
 */
export class RootErrorRecovery extends Component<
  RootErrorRecoveryProps,
  RootErrorRecoveryState
> {
  state: RootErrorRecoveryState = {
    error: null,
    info: null,
  };

  static getDerivedStateFromError(error: Error): Partial<RootErrorRecoveryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      info: errorInfo.componentStack ?? null,
    });
    // Keep console signal for diagnostics; never auto-write documents.
    console.error("Hazakura Editor root error", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleDismiss = () => {
    this.setState({ error: null, info: null });
  };

  render() {
    const { error, info } = this.state;
    if (!error) {
      return this.props.children;
    }
    const copy = getRootErrorRecoveryCopy();

    return (
      <div
        className="root-error-recovery"
        data-testid="root-error-recovery"
        role="alert"
      >
        <div className="root-error-recovery-card">
          <h1>{copy.title}</h1>
          <p>{copy.body}</p>
          <p className="root-error-recovery-detail" lang="">
            {error.message || "Unknown error"}
          </p>
          {info ? (
            <details className="root-error-recovery-stack">
              <summary>{copy.diagnostics}</summary>
              <pre lang="">{info}</pre>
            </details>
          ) : null}
          <div className="root-error-recovery-actions">
            <button type="button" onClick={this.handleReload}>
              {copy.reload}
            </button>
            <button type="button" onClick={this.handleDismiss}>
              {copy.dismiss}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
