"use client";
// OWNER: Dev 2. Jury demo progress, kept in this browser only (localStorage): which step of the tour we're on.
import { useSyncExternalStore } from "react";

export type DemoStep = "intro" | "scan" | "receipt" | "claim-list" | "agent" | "admin" | "final" | "final-claim" | "done";
export type DemoState = { step: DemoStep; baseline?: number; claimId?: string; seen?: string[] };

const KEY = "refundit-demo";
const EVENT = "refundit-demo";

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function getDemo(): DemoState | null {
  const raw = read();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DemoState;
  } catch {
    return null;
  }
}

export function setDemo(next: DemoState | null) {
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: the tour simply doesn't persist */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function patchDemo(p: Partial<DemoState>) {
  const cur = getDemo();
  if (cur) setDemo({ ...cur, ...p });
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Raw JSON string (stable between renders) of the demo state, null when the demo is off. */
export function useDemoRaw(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
