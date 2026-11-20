"use client";
import { useState } from "react";
export default function ApiKeyCreator() {
  const [name, setName] = useState("Mock bank integration");
  const [key, setKey] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <input className="input" style={{ maxWidth: 280 }} value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn" onClick={async () => {
        const res = await fetch("/api/admin/api-keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, scopes: ["cases:read", "messages:check", "mock:read"] }) });
        const d = await res.json(); setKey(d.key ?? d.error);
      }}>Create key</button>
      {key && <code className="block w-full break-all text-sm">{key}</code>}
    </div>
  );
}
