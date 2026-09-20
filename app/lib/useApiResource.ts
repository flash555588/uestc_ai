"use client";

import { useCallback, useEffect, useState } from "react";
import { api, formatApiError } from "@/app/lib/api";

export function useApiResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError("");
    try {
      setData(await api<T>(path));
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (!path) return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true);
      setError("");
      return api<T>(path)
        .then((result) => { if (active) setData(result); })
        .catch((requestError) => { if (active) setError(formatApiError(requestError)); })
        .finally(() => { if (active) setLoading(false); });
    });
    return () => { active = false; };
  }, [path]);

  return { data, loading, error, reload, setData };
}
