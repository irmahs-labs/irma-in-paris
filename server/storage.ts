import { AwsClient } from "aws4fetch";

/**
 * Garage, where the photos are, over its S3 API. Garage serves buckets by
 * path (`<endpoint>/<bucket>/<key>`) and calls its one region "garage", as
 * garage/garage.toml sets it.
 */
export interface Storage {
  put: (
    key: string,
    body: Uint8Array<ArrayBuffer>,
    type: string
  ) => Promise<void>;
  /** The object's bytes as a stream, or null when there is no such object. */
  get: (key: string) => Promise<Response | null>;
  remove: (key: string) => Promise<void>;
}

export const createStorage = ({
  endpoint,
  bucket,
  accessKeyId,
  secretAccessKey,
}: {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}): Storage => {
  const client = new AwsClient({
    accessKeyId,
    region: "garage",
    secretAccessKey,
    service: "s3",
  });

  const urlOf = (key: string) => `${endpoint}/${bucket}/${key}`;

  return {
    get: async (key) => {
      const response = await client.fetch(urlOf(key));

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Garage answered ${response.status} reading ${key}`);
      }

      return response;
    },
    put: async (key, body, type) => {
      const response = await client.fetch(urlOf(key), {
        body,
        headers: { "content-type": type },
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error(`Garage answered ${response.status} writing ${key}`);
      }
    },
    remove: async (key) => {
      const response = await client.fetch(urlOf(key), { method: "DELETE" });

      // Deleting what is already gone is fine.
      if (!response.ok && response.status !== 404) {
        throw new Error(`Garage answered ${response.status} deleting ${key}`);
      }
    },
  };
};

/** Where a photo's two sizes are kept. */
export const photoKey = (id: string, size: "large" | "thumb") =>
  `photos/${id}/${size}.jpg`;

/** Two bytes as one big-endian number, as JPEG headers write them. */
const uint16 = (bytes: Uint8Array, at: number) =>
  (bytes[at] ?? 0) * 256 + (bytes[at + 1] ?? 0);

/**
 * A JPEG's width and height, read from its frame header, or null when the
 * bytes are not a JPEG. The browser makes the JPEGs, so this is a check that
 * they are what they claim, not a decoder.
 */
export const jpegSize = (
  bytes: Uint8Array
): { width: number; height: number } | null => {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let at = 2;

  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) {
      return null;
    }

    const marker = bytes[at + 1] ?? 0;
    const length = uint16(bytes, at + 2);

    // SOF0 to SOF15 carry the size, except DHT (C4), JPG (C8) and DAC (CC).
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      const height = uint16(bytes, at + 5);
      const width = uint16(bytes, at + 7);

      return width > 0 && height > 0 ? { height, width } : null;
    }

    at += 2 + length;
  }

  return null;
};
