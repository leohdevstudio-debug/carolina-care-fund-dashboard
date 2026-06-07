type FetchLike = (
  input: string,
  init?: RequestInit & { cache?: RequestCache }
) => Promise<Response>;

type AdminFetchOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  prefer?: string;
  fetcher?: FetchLike;
};

export class SupabaseAdminRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SupabaseAdminRequestError";
    this.status = status;
  }
}

function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function buildRestUrl(baseUrl: string, resource: string, query: string): string {
  const url = `${baseUrl}/rest/v1/${resource}`;

  return query ? `${url}?${query}` : url;
}

export async function adminFetch<T>(
  resource: string,
  query: string,
  options: AdminFetchOptions = {}
): Promise<T> {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA ?? "fund";
  const fetcher = options.fetcher ?? fetch;

  const response = await fetcher(buildRestUrl(url, resource, query), {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      "Accept-Profile": schema,
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Profile": schema,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new SupabaseAdminRequestError(
      text || `Supabase admin request failed with ${response.status}`,
      response.status
    );
  }

  return response.json() as Promise<T>;
}
