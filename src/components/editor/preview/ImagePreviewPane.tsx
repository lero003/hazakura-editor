import { useEffect, useRef, useState } from "react";
import type { ImagePreviewState, MenuLanguage } from "../../../types";
import { imagePreviewCopy } from "../../../lib/locale/imagePreview";
import {
  fitImageZoom,
  formatImageZoom,
  imageFormatLabel,
  nextImageZoom,
  relativeImagePath,
} from "../../../features/imagePreview/imageZoom";

type Props = {
  image: ImagePreviewState;
  title: string;
  menuLanguage?: MenuLanguage;
  /** 相対パスの表示にだけ使う。無い場合は名前だけを出す（推測で削らない）。 */
  workspaceRootPath?: string | null;
};

export function ImagePreviewPane(props: Props) {
  // Only image presentation resets. The document session and editor remain owned by the parent.
  return <ImageSurface key={props.image.url} {...props} />;
}

function ImageSurface({ image, title, menuLanguage = "en", workspaceRootPath = null }: Props) {
  const copy = imagePreviewCopy(menuLanguage);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  // null = 全体を表示（fit）。数値は手動の倍率で、100% は fit とは別物。
  const [zoom, setZoom] = useState<number | null>(null);
  const [stage, setStage] = useState<{ width: number; height: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const measure = () => setStage({ width: node.clientWidth, height: node.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const fit = dimensions && stage ? fitImageZoom(stage, dimensions) : null;
  const effectiveZoom = zoom ?? fit ?? 1;
  const format = imageFormatLabel(image.name);
  const displayPath = relativeImagePath(image.path, workspaceRootPath);

  return (
    <figure className="image-preview-pane" aria-label={`${title}: ${image.name}`}>
      <header className="image-preview-header">
        <span className="image-preview-title">{title}</span>
        <strong title={image.path}>{image.name}</strong>
        <span className="image-preview-readonly">{copy.readOnly}</span>
        <span className="image-preview-controls">
          <button type="button" aria-label={copy.zoomOut} title={copy.zoomOut}
            onClick={() => setZoom(nextImageZoom(effectiveZoom, -1))}>−</button>
          <span className="image-preview-zoom" aria-label={copy.zoom}>{formatImageZoom(effectiveZoom)}</span>
          <button type="button" aria-label={copy.zoomIn} title={copy.zoomIn}
            onClick={() => setZoom(nextImageZoom(effectiveZoom, 1))}>＋</button>
          <button type="button" className="image-preview-fit" aria-pressed={zoom === null}
            onClick={() => setZoom(null)}>{copy.fit}</button>
        </span>
      </header>
      <div className="image-preview-stage" ref={stageRef} aria-busy={!failed && !dimensions}>
        {failed ? <p role="alert">{copy.failed}</p> : <>
          {!dimensions ? <p role="status">{copy.loading}</p> : null}
          <img src={image.url} alt={image.name} draggable={false}
            // 表示変換だけで拡大する（再圧縮も保存もしない）。100% = 画像1px が CSS 1px。
            style={dimensions ? {
              width: `${Math.round(dimensions.width * effectiveZoom)}px`,
              height: "auto",
              maxWidth: "none",
              maxHeight: "none",
            } : undefined}
            onLoad={(event) => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            onError={() => setFailed(true)} />
        </>}
      </div>
      <figcaption className="image-preview-info">
        <span title={image.path}>{displayPath ?? image.name}</span>
        {dimensions && !failed ? <span aria-label={copy.dimensions}>{dimensions.width} × {dimensions.height} px</span> : null}
        {format && !failed ? <span>{format}</span> : null}
        <span>{image.size.toLocaleString()} B</span>
      </figcaption>
    </figure>
  );
}
