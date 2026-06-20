// Shared Markdown image policy for surfaces that render image URLs directly
// into the WebView. Workspace image files are handled separately through the
// bounded Rust image commands.

export const MAX_EMBEDDED_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

export function isAllowedEmbeddedImageSource(src: string): boolean {
  if (src.length > MAX_EMBEDDED_IMAGE_BYTES) {
    return false;
  }
  return /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(src);
}
