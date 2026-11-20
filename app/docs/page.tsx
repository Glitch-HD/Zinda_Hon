"use client";
import Script from "next/script";

// Swagger UI for the public API, served from our own site (works without outside CDNs).
export default function Docs() {
  return (
    <div>
      <link rel="stylesheet" href="/swagger/swagger-ui.css" />
      <div id="swagger" style={{ background: "#fff", borderRadius: 12 }} />
      <Script src="/swagger/swagger-ui-bundle.js" strategy="afterInteractive"
        onReady={() => { (window as unknown as { SwaggerUIBundle: (o: object) => void }).SwaggerUIBundle({ url: "/api/openapi.json", dom_id: "#swagger" }); }} />
    </div>
  );
}
