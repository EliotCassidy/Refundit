"use client";
// OWNER: Dev 2. While some claims are 'submitting', call /sync for each every 5s
// (polling fallback for the H webhook) and refresh the server-rendered page.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ syncClaimIds, intervalMs = 5000 }: { syncClaimIds: string[]; intervalMs?: number }) {
  const router = useRouter();
  const key = syncClaimIds.join(",");

  useEffect(() => {
    if (!key) return;
    const ids = key.split(",");
    const timer = setInterval(async () => {
      await Promise.allSettled(ids.map((id) => fetch(`/api/claims/${id}/sync`, { method: "POST" })));
      router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [key, intervalMs, router]);

  return null;
}
