"use client";

import { useState } from "react";

function defaultDateRange(): { after: string; before: string } {
  const now = new Date();
  const before = now.toISOString().split("T")[0];
  const after = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  return { after, before };
}

export default function AnalyzeForm() {
  const defaults = defaultDateRange();
  const [after, setAfter] = useState(defaults.after);
  const [before, setBefore] = useState(defaults.before);

  const loginUrl = `/api/auth/login?after=${encodeURIComponent(after)}&before=${encodeURIComponent(before)}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 justify-center">
        <label className="text-sm text-foreground/60">
          From
          <input
            type="date"
            value={after}
            onChange={(e) => setAfter(e.target.value)}
            className="block mt-1 rounded border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-foreground/60">
          To
          <input
            type="date"
            value={before}
            onChange={(e) => setBefore(e.target.value)}
            className="block mt-1 rounded border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </label>
      </div>
      <a
        href={loginUrl}
        className="inline-block rounded-lg bg-foreground text-background px-6 py-3 font-medium hover:opacity-90 transition-opacity"
      >
        Analyze Inbox
      </a>
    </div>
  );
}
