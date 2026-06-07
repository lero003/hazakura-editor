import type { ImagePreviewState } from "../../../types";

export function ImagePreviewPane({
  image,
  title,
}: {
  image: ImagePreviewState;
  title: string;
}) {
  return (
    <figure
      className="image-preview-pane"
      role="figure"
      aria-label={`${title}: ${image.name}`}
    >
      <header className="image-preview-header">
        <span className="image-preview-title">{title}</span>
        <strong title={image.path}>{image.name}</strong>
      </header>
      <div className="image-preview-stage">
        <img src={image.url} alt={image.name} />
      </div>
    </figure>
  );
}
