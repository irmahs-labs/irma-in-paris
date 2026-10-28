/**
 * The start of a JPEG, as far as the server reads one: the SOI marker, an
 * APP0 segment, and a baseline frame header (SOF0) giving its size. Enough
 * for jpegSize, not for a viewer.
 */
export const fakeJpeg = (
  width: number,
  height: number
): Uint8Array<ArrayBuffer> =>
  new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x01,
    0x00,
    0x00,
    0x01,
    0x00,
    0x01,
    0x00,
    0x00,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    Math.floor(height / 256),
    height % 256,
    Math.floor(width / 256),
    width % 256,
    0x03,
    0x01,
    0x22,
    0x00,
    0x02,
    0x11,
    0x01,
    0x03,
    0x11,
    0x01,
    0xff,
    0xd9,
  ]);
