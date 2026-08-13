const ALLOWED_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/flac",
]);
const MAX_BYTES = 100 * 1024 * 1024; // 100MB per file

function sanitizeName(name) {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const adminKey = request.headers.get("X-Admin-Key") || "";
  if (!env.ADMIN_UPLOAD_KEY || adminKey !== env.ADMIN_UPLOAD_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid form data" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const files = form.getAll("files").filter((f) => typeof f === "object" && "arrayBuffer" in f);
  if (!files.length) {
    return new Response(JSON.stringify({ error: "No files provided" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const results = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      results.push({ name: file.name, ok: false, error: "File too large (max 100MB)" });
      continue;
    }
    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      results.push({ name: file.name, ok: false, error: `Unsupported type: ${file.type}` });
      continue;
    }

    const key = `${Date.now()}-${sanitizeName(file.name)}`;
    try {
      await env.AUDIO_BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || "audio/mpeg" },
        customMetadata: { originalName: file.name },
      });
      results.push({ name: file.name, ok: true, key });
    } catch (err) {
      results.push({ name: file.name, ok: false, error: String(err) });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { "content-type": "application/json" },
  });
}
