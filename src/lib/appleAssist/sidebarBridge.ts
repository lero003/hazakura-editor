import type { AppleAssistApplyEvent, AppleAssistApplyStatusEvent, AppleAssistProposalStatusEvent } from "../../types";

type Controller = {
  request: (payload: AppleAssistApplyEvent) => void;
  cancel: (requestId: string) => Promise<boolean>;
  isBusy: () => boolean;
};
let controller: Controller | null = null;
let openSurface: ((mode: "open" | "toggle") => void) | null = null;
const proposalListeners = new Set<(status: AppleAssistProposalStatusEvent) => void>();
const applyListeners = new Set<(status: AppleAssistApplyStatusEvent) => void>();
const activityListeners = new Set<() => void>();

function notify<T>(listeners: Set<(value: T) => void>, value: T): void {
  for (const listener of listeners) {
    try { listener(value); }
    catch (error) { console.warn("Local Assist observer failed", error); }
  }
}

/** Same-webview routing only. Native commands retain their window/lane gates. */
export function registerLocalAssistController(next: Controller): () => void {
  controller = next;
  notifyLocalAssistActivity();
  return () => {
    if (controller !== next) return;
    controller = null;
    notifyLocalAssistActivity();
  };
}
export function requestSidebarProposal(payload: AppleAssistApplyEvent): boolean {
  if (!controller) return false;
  controller.request(payload);
  return true;
}
export async function cancelSidebarProposal(requestId: string): Promise<boolean> {
  return controller ? controller.cancel(requestId) : false;
}
export function isLocalAssistBusy(): boolean { return controller?.isBusy() ?? false; }
export function subscribeLocalAssistActivity(listener: () => void): () => void {
  activityListeners.add(listener);
  return () => { activityListeners.delete(listener); };
}
export function notifyLocalAssistActivity(): void { notify(activityListeners, undefined); }
export function subscribeSidebarProposalStatus(listener: (status: AppleAssistProposalStatusEvent) => void): () => void {
  proposalListeners.add(listener);
  return () => { proposalListeners.delete(listener); };
}
export function publishSidebarProposalStatus(status: AppleAssistProposalStatusEvent): void { notify(proposalListeners, status); }
export function subscribeSidebarApplyStatus(listener: (status: AppleAssistApplyStatusEvent) => void): () => void {
  applyListeners.add(listener);
  return () => { applyListeners.delete(listener); };
}
export function publishSidebarApplyStatus(status: AppleAssistApplyStatusEvent): void { notify(applyListeners, status); }
export function registerLocalAssistSurface(listener: (mode: "open" | "toggle") => void): () => void {
  openSurface = listener;
  return () => { if (openSurface === listener) openSurface = null; };
}
export function requestLocalAssistSurface(mode: "open" | "toggle"): boolean {
  if (!openSurface) return false;
  openSurface(mode);
  return true;
}
