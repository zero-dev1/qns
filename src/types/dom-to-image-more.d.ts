declare module 'dom-to-image-more' {
  interface DomToImageOptions {
    filter?: (node: Node) => boolean;
    bgcolor?: string;
    width?: number;
    height?: number;
    style?: Record<string, string>;
    quality?: number;
    imagePlaceholder?: string;
    cacheBust?: boolean;
  }

  function toPng(node: Node, options?: DomToImageOptions): Promise<string>;
  function toJpeg(node: Node, options?: DomToImageOptions): Promise<string>;
  function toSvg(node: Node, options?: DomToImageOptions): Promise<string>;
  function toBlob(node: Node, options?: DomToImageOptions): Promise<Blob>;
  function toPixelData(node: Node, options?: DomToImageOptions): Promise<Uint8Array>;

  export default {
    toPng,
    toJpeg,
    toSvg,
    toBlob,
    toPixelData,
  };
}
