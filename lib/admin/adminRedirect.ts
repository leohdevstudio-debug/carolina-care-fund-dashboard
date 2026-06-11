const ADMIN_FALLBACK_PATH = "/admin";

export function sanitizeAdminNextPath(value: string | null | undefined): string {
  if (!value) {
    return ADMIN_FALLBACK_PATH;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return ADMIN_FALLBACK_PATH;
  }

  if (value === "/admin/login" || value.startsWith("/admin/login?")) {
    return ADMIN_FALLBACK_PATH;
  }

  if (value === "/admin" || value.startsWith("/admin/") || value.startsWith("/admin?")) {
    return value;
  }

  return ADMIN_FALLBACK_PATH;
}

export function buildAdminLoginHref(nextPath = ADMIN_FALLBACK_PATH): string {
  return `/admin/login?next=${encodeURIComponent(
    sanitizeAdminNextPath(nextPath)
  )}`;
}
