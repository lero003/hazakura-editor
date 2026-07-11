import { Component, type ErrorInfo, type ReactNode } from "react";

type RootErrorRecoveryProps = {
  children: ReactNode;
};

type RootErrorRecoveryState = {
  error: Error | null;
  info: string | null;
};

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

    return (
      <div
        className="root-error-recovery"
        data-testid="root-error-recovery"
        role="alert"
      >
        <div className="root-error-recovery-card">
          <h1>編集セッションを保護しています</h1>
          <p>
            予期しないエラーが発生しました。未保存のパス付き下書きや復旧候補は
            アプリ内ストレージに残っている場合があります。ソースファイルへの
            自動保存は行いません。
          </p>
          <p className="root-error-recovery-detail">
            {error.message || "Unknown error"}
          </p>
          {info ? (
            <details className="root-error-recovery-stack">
              <summary>診断情報</summary>
              <pre>{info}</pre>
            </details>
          ) : null}
          <div className="root-error-recovery-actions">
            <button type="button" onClick={this.handleReload}>
              アプリを再読み込み
            </button>
            <button type="button" onClick={this.handleDismiss}>
              この画面を閉じて続行を試す
            </button>
          </div>
          <p className="root-error-recovery-en" lang="en">
            Editing session protected. Unsaved recovery candidates may still be
            available after reload. Source files are never auto-written.
          </p>
        </div>
      </div>
    );
  }
}
