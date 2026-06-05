# Documentation Index

Status: Operational
Scope: Current documentation map
Authority: High
Last reviewed: 2026-06-04

This directory separates current guidance from historical material. Use current documents for implementation and release decisions. Use `docs/archive/` only for past rationale or old planning context.

## Current Canonical Docs

- `product-brief.md`: product direction, users, non-goals, and assist direction.
- `security-boundary.md`: safety constraints for file handling and execution boundaries.
- `agent-workbench-boundary.md`: optional CLI-agent workbench trust boundary.
- `assist-surface-strategy.md`: future assist-surface direction.
- `roadmap.md`: active release sequence and phase boundaries.
- `current-status.md`: current implementation and release state.

## Current Operational Docs

- `development-automation.md`: recurring agent/automation operating rules.
- `external-agent-review-workflow.md`: external implementation agent plus Codex review workflow.
- `source-release-checklist.md`: source-preview release readiness.
- `dmg-preview-checklist.md`: warning-expected DMG preview readiness.
- `smoke-checklist.md`: manual smoke checklist.
- `handoff.md`: concise handoff for the next coding agent.

## Current Planning Backlogs

- `l-mode-plan.md`: L Mode / えるモード planning memo.
- `apple-local-assist-distribution-plan.md`: Apple Local Assist / App Store distribution planning memo.
- `apple-local-assist-v0.12-design-review.md`: Apple Local Assist v0.12 スライス 1〜6 の設計選択・ゲート・残課題レビュー記録。
- `apple-local-assist-live-helper-plan.md`: `src-helpers/apple-assist/` fixture mode / live mode 分離と live mode 実装前の設計メモ。
- `apple-local-assist-rust-supervisor-plan.md`: helper sidecar を呼ぶ Rust supervisor 層の設計メモ。
- `apple-local-assist-ui-unavailable-state-plan.md`: 4 状態 (`available` / `unavailable` / `disabled` / `unsupported`) の UI 提示方針と v0.12.x での移行計画。
- `authoring-feature-readiness.md`: incomplete authoring/export/Agent-adjacent feature claims.

## Historical And Archive Areas

- `archive/`: old setup notes, early MVP plans, superseded roadmaps, older goal prompts, past release review briefs, and detailed status history.
- `releases/`: release-note bodies used for published or prepared GitHub Releases.
- `archive/reviews/`: historical review gates and design decisions that may still be referenced from code comments.
