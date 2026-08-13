export async function onRequestGet(context) {
  const { env } = context;

  const listed = await env.AUDIO_BUCKET.list({ include: ["customMetadata"] });
  const tracks = listed.objects
    .map((obj) => ({
      key: obj.key,
      name: obj.customMetadata?.originalName || obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
      url: `/api/audio/${encodeURIComponent(obj.key)}`,
    }))
    .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));

  return new Response(JSON.stringify({ tracks }), {
    headers: { "content-type": "application/json" },
  });
}
