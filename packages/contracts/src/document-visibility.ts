import { z } from "zod";

export const WEBMCP_DOCUMENT_VISIBILITY_TYPE =
  "webmcp/document-visibility" as const;

export const documentVisibilityMessageSchema = z.object({
  type: z.literal(WEBMCP_DOCUMENT_VISIBILITY_TYPE),
  visible: z.boolean(),
});

export type DocumentVisibilityMessage = z.infer<
  typeof documentVisibilityMessageSchema
>;

export function documentVisibilityMessage(
  visible: boolean,
): DocumentVisibilityMessage {
  return {
    type: WEBMCP_DOCUMENT_VISIBILITY_TYPE,
    visible,
  };
}

export function allowsRichDom(visible: boolean): boolean {
  return visible;
}

export function parseDocumentVisibilityMessage(
  data: unknown,
  origin: string,
  expectedOrigin: string,
): boolean | null {
  if (origin !== expectedOrigin) {
    return null;
  }
  const parsed = documentVisibilityMessageSchema.safeParse(data);
  if (!parsed.success) {
    return null;
  }
  return parsed.data.visible;
}

export function createDocumentVisibilityGate(initialVisible = true) {
  let visible = initialVisible;
  function setVisible(next: boolean) {
    visible = next;
  }
  return {
    get visible() {
      return visible;
    },
    setVisible,
    applyMessage(data: unknown, origin: string, expectedOrigin: string) {
      const parsed = parseDocumentVisibilityMessage(
        data,
        origin,
        expectedOrigin,
      );
      if (parsed === null) {
        return false;
      }
      setVisible(parsed);
      return true;
    },
    shouldPresent() {
      return allowsRichDom(visible);
    },
  };
}
