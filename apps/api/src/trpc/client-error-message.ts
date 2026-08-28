export const INTERNAL_CLIENT_ERROR_MESSAGE =
  "Something went wrong. Please try again.";

export function toClientTrpcMessage(options: {
  code: string;
  message: string;
}): string {
  if (options.code !== "INTERNAL_SERVER_ERROR") {
    return options.message;
  }
  return INTERNAL_CLIENT_ERROR_MESSAGE;
}
