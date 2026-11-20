"use client";
export default function LogoutButton() {
  return (
    <button className="btn btn-ghost btn-sm" data-say="باہر نکلیں" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}>
      ↩︎ <span className="en">Log out</span><span className="ur">باہر نکلیں</span>
    </button>
  );
}
