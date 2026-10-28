import { describe, expect, it } from "vitest";

import { fakeJpeg } from "./fixtures/jpeg";
import { jpegSize, photoKey } from "./storage";

describe("jpegSize", () => {
  it("reads the size from the frame header", () => {
    expect(jpegSize(fakeJpeg(1600, 1200))).toEqual({
      height: 1200,
      width: 1600,
    });
    expect(jpegSize(fakeJpeg(480, 640))).toEqual({ height: 640, width: 480 });
  });

  it("refuses anything that is not a JPEG", () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ]);

    expect(jpegSize(png)).toBeNull();
    expect(jpegSize(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("photoKey", () => {
  it("keeps both sizes of a photo under its id", () => {
    expect(photoKey("abc", "large")).toBe("photos/abc/large.jpg");
    expect(photoKey("abc", "thumb")).toBe("photos/abc/thumb.jpg");
  });
});
