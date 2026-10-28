/**
 * A photo as the server keeps it: a JPEG at most `maxSide` pixels on its
 * longer side, drawn the right way up. Drawing it again leaves out
 * everything else the camera wrote into the file, its GPS position
 * included, so where a photo was taken never leaves the admin's device.
 */
export interface Shrunk {
  blob: Blob;
  width: number;
  height: number;
}

export const shrink = async (
  file: Blob,
  maxSide: number,
  quality = 0.85
): Promise<Shrunk> => {
  // Browsers turn the picture by its EXIF orientation here.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("This browser cannot draw the photo");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvas.convertToBlob({ quality, type: "image/jpeg" });

  return { blob, height, width };
};

/** The sizes the server takes: see MAX_SIDE in server/app.ts. */
export const LARGE_SIDE = 1600;
export const THUMB_SIDE = 480;
