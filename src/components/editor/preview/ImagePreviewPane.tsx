import { useState } from "react";
import type { ImagePreviewState, MenuLanguage } from "../../../types";
import { imagePreviewCopy } from "../../../lib/locale/imagePreview";

type Props = { image: ImagePreviewState; title: string; menuLanguage?: MenuLanguage };
export function ImagePreviewPane(props: Props) {
  // Only image presentation resets. The document session and editor remain owned by the parent.
  return <ImageSurface key={props.image.url} {...props} />;
}
function ImageSurface({ image, title, menuLanguage = "en" }: Props) {
  const copy = imagePreviewCopy(menuLanguage);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  return (
    <figure className="image-preview-pane" aria-label={`${title}: ${image.name}`}>
      <header className="image-preview-header">
        <span className="image-preview-title">{title}</span>
        <strong title={image.path}>{image.name}</strong>
        <span className="image-preview-readonly">{copy.readOnly}</span>
      </header>
      <div className="image-preview-stage" aria-busy={!failed && !dimensions}>
        {failed ? <p role="alert">{copy.failed}</p> : <>
          {!dimensions ? <p role="status">{copy.loading}</p> : null}
          <img src={image.url} alt={image.name} draggable={false}
            onLoad={(event) => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            onError={() => setFailed(true)} />
        </>}
      </div>
      <figcaption className="image-preview-info">
        <span title={image.path}>{image.name}</span>
        {dimensions && !failed ? <span aria-label={copy.dimensions}>{dimensions.width} × {dimensions.height} px</span> : null}
        <span>{image.size.toLocaleString()} B</span>
      </figcaption>
    </figure>
  );
}
