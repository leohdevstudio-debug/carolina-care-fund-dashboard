const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA ?? "fund";

function assertEnv(): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
}

export async function fetchFromView<T>(
  viewName: string,
  query = "select=*"
): Promise<T> {
  assertEnv();

  const url = `${SUPABASE_URL}/rest/v1/${viewName}?${query}`;

  // Detect environment (development vs production)
  const isDev = process.env.NODE_ENV === "development";

  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Accept-Profile": SUPABASE_SCHEMA,
      Accept: "application/json",
    },

    // Dynamic caching strategy
    ...(isDev
      ? { cache: "no-store" } // always fresh in dev
      : { next: { revalidate: 30 } }), // cache 30s in production
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch ${viewName}: ${response.status} ${errorText}`
    );
  }

  return response.json();
}
