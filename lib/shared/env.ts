// Server-side env access. Throws a clear error when a required variable is missing.
import "server-only";

export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name} (see .env.example)`);
  return value;
}

export const flags = {
  // Never simulate the agent in production (Vercel sets VERCEL_ENV), whatever AGENT_MOCK says.
  agentMock: () => process.env.AGENT_MOCK === "true" && process.env.VERCEL_ENV !== "production",
  // Default to dry run unless explicitly disabled.
  agentDryRun: () => process.env.AGENT_DRY_RUN !== "false",
};
