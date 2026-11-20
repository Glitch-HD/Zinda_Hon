"use client";
export default function LogoutButton() {
  return (
    <button className="btn btn-ghost btn-sm" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}>
      ↩︎ Log out
    </button>
  );
}
