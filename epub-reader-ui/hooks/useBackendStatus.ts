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
    const ok = navigator.onLine && await ping(`${API_BASE_URL}/api/my-library`);
    setKnown(true);
    setStatus(ok ? "connected" : "offline");
  }, []);

  useEffect(() => {
    void check();
    // Le passage hors ligne doit se voir sans recharger la page.
    const recheck = () => void check();
    window.addEventListener("online", recheck);
    window.addEventListener("offline", recheck);
    return () => {
      window.removeEventListener("online", recheck);
      window.removeEventListener("offline", recheck);
    };
  }, [check]);

  return { status, known, check };
}