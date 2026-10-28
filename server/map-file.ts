import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

/**
 * The map of Paris, one PMTiles file, served the way MapLibre reads it: a
 * few KB at a time with HTTP Range requests, never the whole 45 MB.
 */
export interface ByteRange {
  start: number;
  end: number;
}

/**
 * The one range a `Range: bytes=…` header asks for, clamped to the file;
 * null for no header, undefined when it asks for something the file does
 * not have (or several ranges, which MapLibre never sends).
 */
export const rangeOf = (
  header: string | undefined,
  size: number
): ByteRange | null | undefined => {
  if (!header) {
    return null;
  }

  const parts = header.match(/^bytes=(?<from>\d*)-(?<to>\d*)$/u)?.groups;

  if (!parts || (parts.from === "" && parts.to === "")) {
    return undefined;
  }

  // "bytes=-500" is the last 500 bytes.
  const range =
    parts.from === ""
      ? { end: size - 1, start: Math.max(0, size - Number(parts.to)) }
      : {
          end: Math.min(
            size - 1,
            parts.to === "" ? size - 1 : Number(parts.to)
          ),
          start: Number(parts.from),
        };

  return range.start <= range.end && range.start < size ? range : undefined;
};

/** Answers GET and HEAD for the file at `path`, whole or a range of it. */
export const serveRanges = async (
  path: string,
  request: Request
): Promise<Response> => {
  const file = await stat(path).catch(() => null);

  if (!file?.isFile()) {
    return new Response("The map has not been downloaded yet", { status: 404 });
  }

  // Changes when the map is refreshed, so the browser's cached ranges are dropped.
  const etag = `"${file.size.toString(16)}-${Math.floor(file.mtimeMs).toString(16)}"`;

  const headers = new Headers({
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=86400",
    "content-type": "application/octet-stream",
    etag,
  });

  const range = rangeOf(request.headers.get("range") ?? undefined, file.size);

  if (range === undefined) {
    headers.set("content-range", `bytes */${file.size}`);

    return new Response(null, { headers, status: 416 });
  }

  const { start, end } = range ?? { end: file.size - 1, start: 0 };

  headers.set("content-length", String(end - start + 1));

  if (range) {
    headers.set("content-range", `bytes ${start}-${end}/${file.size}`);
  }

  const status = range ? 206 : 200;

  if (request.method === "HEAD") {
    return new Response(null, { headers, status });
  }

  // SAFETY: Node's web stream and the DOM's ReadableStream are the same at runtime
  const body = Readable.toWeb(
    createReadStream(path, { end, start })
  ) as ReadableStream;

  return new Response(body, { headers, status });
};
