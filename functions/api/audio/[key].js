export async function onRequestGet(context) {
  const { env, params, request } = context;
  const key = decodeURIComponent(params.key);

  const rangeHeader = request.headers.get("range");
  const options = {};
  if (rangeHeader) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : undefined;
      options.range = end !== undefined ? { offset: start, length: end - start + 1 } : { offset: start };
    }
  }

  const object = await env.AUDIO_BUCKET.get(key, options);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=31536000, immutable");

  if (rangeHeader && object.range) {
    const total = object.size;
    const start = object.range.offset;
    const length = "length" in object.range ? object.range.length : total - start;
    headers.set("content-range", `bytes ${start}-${start + length - 1}/${total}`);
    headers.set("content-length", String(length));
    return new Response(object.body, { status: 206, headers });
  }

  headers.set("content-length", String(object.size));
  return new Response(object.body, { status: 200, headers });
}
