export const maxDuration = 300;

export async function POST(request: Request) {
  const apiUrl = process.env.API_URL ?? "http://api:8000";
  const body = await request.text();

  const res = await fetch(`${apiUrl}/api/v1/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(290_000),
  });

  const data = await res.text();
  return new Response(data, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
