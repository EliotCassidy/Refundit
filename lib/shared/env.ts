// Server-side env access. Throws a clear error when a required variable is missing.
import "server-only";

export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name} (see .env.example)`);
  return value;
}

export const flags = {
  agentMock: () => process.env.AGENT_MOCK === "true",
  // Default to dry run unless explicitly disabled.
  agentDryRun: () => process.env.AGENT_DRY_RUN !== "false",
};
