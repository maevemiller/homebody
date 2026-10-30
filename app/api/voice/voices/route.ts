// The account's voices, for the dev-only voice picker. Listing is free; only
// speaking costs. Never available in production.
export async function GET() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (process.env.NODE_ENV === "production" || !key) return Response.json({ voices: [] });
  const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } }).catch(() => null);
  if (!res?.ok) return Response.json({ voices: [], error: `Voice service said ${res?.status ?? "nothing"}` }, { status: 502 });
  const { voices = [] } = await res.json();
  return Response.json({
    voices: voices.map((v: { voice_id: string; name: string; labels?: Record<string, string>; preview_url?: string }) => ({
      id: v.voice_id,
      name: v.name,
      labels: v.labels ?? {},
      preview: v.preview_url,
    })),
  });
}
