"use client";
import { useEffect } from "react";
import { setPrefsRole } from "@/lib/client/prefs";

// Tells the voice guide who is using the page, so it reads out automatically only for pensioners.
export default function RoleSync({ role }: { role: string }) {
  useEffect(() => { setPrefsRole(role); }, [role]);
  return null;
}
