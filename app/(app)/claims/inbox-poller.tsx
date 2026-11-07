"use client";
// OWNER: Dev 2. Fetches brand replies from the mailbox when the dashboard opens, then refreshes.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function InboxPoller() {
  const router = useRouter();
  useEffect(() => {
    fetch("/api/email/poll", { method: "POST" })
      .then((r) => r.json())
      .then((r) => {
        if (r?.stored > 0) router.refresh();
      })
      .catch(() => undefined);
  }, [router]);
  return null;
}
