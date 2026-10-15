"use client";

import { useCallback, useState } from "react";

/** POSTs JSON to an auth endpoint and tracks pending / error state. Resolves to the parsed body on success, null on failure. */
export function useAuthRequest<T = Record<string, unknown>>(url: string) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (body: unknown): Promise<T | null> => {
      setPending(true);
      setError(null);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Something went wrong. Try again.");
          return null;
        }
        return data as T;
      } catch {
        setError("Can't reach the server. Check your connection and try again.");
        return null;
      } finally {
        setPending(false);
      }
    },
    [url],
  );

  return { pending, error, setError, submit };
}
