import { toolHandleKey } from "@repo/contracts";

import type { RegisteredTool } from "./model-context";

export class ToolHandleRegistry {
  private handles = new Map<string, RegisteredTool>();

  set(instanceId: string, origin: string, name: string, tool: RegisteredTool) {
    this.handles.set(toolHandleKey(instanceId, origin, name), tool);
  }

  get(instanceId: string, origin: string, name: string) {
    return this.handles.get(toolHandleKey(instanceId, origin, name));
  }

  invalidateInstance(instanceId: string) {
    for (const key of [...this.handles.keys()]) {
      if (key.startsWith(`${instanceId}:`)) {
        this.handles.delete(key);
      }
    }
  }

  clear() {
    this.handles.clear();
  }
}
