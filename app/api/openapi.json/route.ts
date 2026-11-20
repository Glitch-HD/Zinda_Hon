import { NextResponse } from "next/server";

// OpenAPI description of the public REST API (shown with Swagger UI at /docs).
const spec = {
  openapi: "3.0.3",
  info: {
    title: "Zinda Hon public API (PROTOTYPE)",
    version: "1.0.0",
    description: "Prototype, not an official service. All identity, pension, bank and death-registry data is simulated. Create a key in the Admin page; send it in the x-api-key header. Each key has scopes and a per-minute rate limit.",
  },
  servers: [{ url: "/" }],
  components: {
    securitySchemes: { ApiKey: { type: "apiKey", in: "header", name: "x-api-key" } },
    schemas: { Error: { type: "object", properties: { error: { type: "string" } } } },
  },
  security: [{ ApiKey: [] }],
  paths: {
    "/api/v1/cases/{pensionNo}": {
      get: {
        summary: "Proof-of-life status for a pension number (scope cases:read)",
        description: "Only returned if the pensioner shares their case status with this department.",
        parameters: [{ name: "pensionNo", in: "path", required: true, schema: { type: "string", example: "PEN-K-1001" } }],
        responses: { "200": { description: "Status", content: { "application/json": { schema: { type: "object", properties: { pensionNo: { type: "string" }, year: { type: "integer" }, status: { type: "string", enum: ["DUE", "IN_PROGRESS", "NEEDS_PROOF", "WITH_OFFICER", "VERIFIED", "STOPPED"] }, simulated: { type: "boolean" } } } } } }, "401": { description: "Missing or invalid key" }, "403": { description: "No consent or wrong scope" }, "404": { description: "Not found" }, "429": { description: "Rate limited" } },
      },
    },
    "/api/v1/messages/check": {
      post: {
        summary: "Check whether an SMS or WhatsApp message is a scam (scope messages:check)",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["text"], properties: { text: { type: "string", example: "Mubarak! Aap ki pension ki imdadi raqam 25,000 jari ho gayi. Fee 500 Easypaisa bhejain: 0300-1234567" }, sender: { type: "string" } } } } } },
        responses: { "200": { description: "Result", content: { "application/json": { schema: { type: "object", properties: { label: { type: "string", enum: ["scam", "genuine", "unsure"] }, confidence: { type: "number" }, route: { type: "string", enum: ["warn_user", "reassure_user", "human_review"] }, signs: { type: "array", items: { type: "string" } } } } } } } },
      },
    },
    "/api/v1/mock/nadra/{cnic}": { get: { summary: "MOCK identity lookup (scope mock:read)", parameters: [{ name: "cnic", in: "path", required: true, schema: { type: "string", example: "00000-1000001-2" } }], responses: { "200": { description: "Matching simulated records" }, "404": { description: "No record" } } } },
    "/api/v1/mock/bank/{account}": { get: { summary: "MOCK bank account activity (scope mock:read)", parameters: [{ name: "account", in: "path", required: true, schema: { type: "string", example: "MB-5001" } }], responses: { "200": { description: "Simulated account" }, "404": { description: "No account" } } } },
    "/api/v1/mock/death-registry/{cnic}": { get: { summary: "MOCK death registry lookup (scope mock:read)", parameters: [{ name: "cnic", in: "path", required: true, schema: { type: "string", example: "00000-1000005-7" } }], responses: { "200": { description: "found true/false" } } } },
    "/api/health": { get: { summary: "Health check (no key needed)", security: [], responses: { "200": { description: "OK" } } } },
  },
};

export function GET() {
  return NextResponse.json(spec);
}
