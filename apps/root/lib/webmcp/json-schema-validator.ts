import Ajv2020 from "ajv/dist/2020.js";

const jsonSchemaValidator = new Ajv2020({
  strict: true,
  allErrors: false,
});

export function validateJsonSchemaInput(
  schema: Record<string, unknown>,
  input: Record<string, unknown>,
): "valid" | "invalid_schema" | "invalid_arguments" {
  try {
    return jsonSchemaValidator.compile(schema)(input)
      ? "valid"
      : "invalid_arguments";
  } catch {
    return "invalid_schema";
  }
}
