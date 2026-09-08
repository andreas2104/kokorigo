"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/config";

export type BackendStatus = "checking" | "connected" | "offline";

async function ping(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

export function useBackendStatus() {
  const [status, setStatus] = useState<BackendStatus>("checking");
  const [known, setKnown] = useState(false);

  const check = useCallback(async () => {
    setStatus("checking");
    const ok = await ping(`${API_BASE_URL}/api/my-library`);
    setKnown(true);
    setStatus(ok ? "connected" : "offline");
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return { status, known, check };
}