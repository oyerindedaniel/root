import type { HealthStatus } from "@repo/contracts";

export function getHealthStatus(): HealthStatus {
  return {
    status: "ok",
    service: "root-api",
    timestamp: new Date().toISOString(),
  };
}
