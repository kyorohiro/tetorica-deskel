declare module "procreate-swatches" {
  export function createSwatchesFile(
    name: string,
    colors: readonly (readonly [readonly [number, number, number], "rgb"])[],
    outputType?: "uint8array" | "blob" | "arraybuffer"
  ): Uint8Array | Blob | ArrayBuffer;
}