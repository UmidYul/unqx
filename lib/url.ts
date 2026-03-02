import { env } from "@/lib/env";

export function getBaseUrl(): string {
  return (env.NEXT_PUBLIC_APP_URL ?? env.NEXTAUTH_URL).replace(/\/$/, "");
}

export function absoluteUrl(pathname: string): string {
  const base = getBaseUrl();
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${normalizedPath}`;
}
