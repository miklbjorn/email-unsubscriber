"use client";

import { useState } from "react";
import type { AnalysisResult, SenderSummary } from "@/lib/analysis";

type SortField = "count" | "name";

const linkTypeBadge: Record<string, { label: string; className: string }> = {
  "one-click": {
    label: "one-click",
    className:
      "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  },
  http: {
    label: "http",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  mailto: {
    label: "mailto",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
};

function sortSenders(
  senders: SenderSummary[],
  field: SortField,
): SenderSummary[] {
  return [...senders].sort((a, b) => {
    if (field === "count") return b.messageCount - a.messageCount;
    return a.name.localeCompare(b.name);
  });
}

export default function AnalysisResults({
  analysis,
  analysisId,
}: {
  analysis: AnalysisResult;
  analysisId?: string;
}) {
  const [sortBy, setSortBy] = useState<SortField>("count");
  const [clicked, setClicked] = useState<Set<string>>(
    () =>
      new Set(
        analysis.senders
          .filter((s) => s.clickedAt)
          .map((s) => s.email),
      ),
  );
  const sorted = sortSenders(analysis.senders, sortBy);

  function handleUnsubscribeClick(senderEmail: string) {
    setClicked((prev) => new Set(prev).add(senderEmail));

    if (analysisId) {
      fetch(`/api/analyses/${analysisId}/senders`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderEmail }),
      }).catch(() => {
        // Best-effort — link already opened in new tab
      });
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Overview stats */}
      <div className="rounded-lg border border-foreground/10 px-5 py-4 text-sm">
        <p>
          <span className="font-semibold">{analysis.unsubscribableEmails}</span>{" "}
          of {analysis.totalEmails} emails ({analysis.percentage}%) are
          bulk/newsletter emails from{" "}
          <span className="font-semibold">{analysis.uniqueSenders}</span> unique
          senders.
        </p>
      </div>

      {/* Empty state */}
      {analysis.senders.length === 0 && (
        <p className="text-center text-foreground/50 py-8">
          No unsubscribable emails found in this date range.
        </p>
      )}

      {/* Sender list */}
      {analysis.senders.length > 0 && (
        <div className="space-y-3">
          {/* Sort controls */}
          <div className="flex items-center gap-2 text-xs text-foreground/50">
            <span>Sort by:</span>
            <button
              onClick={() => setSortBy("count")}
              className={`px-2 py-1 rounded ${sortBy === "count" ? "bg-foreground/10 text-foreground" : "hover:bg-foreground/5"}`}
            >
              Email count
            </button>
            <button
              onClick={() => setSortBy("name")}
              className={`px-2 py-1 rounded ${sortBy === "name" ? "bg-foreground/10 text-foreground" : "hover:bg-foreground/5"}`}
            >
              Sender name
            </button>
          </div>

          {/* Sender rows */}
          <div className="space-y-2">
            {sorted.map((sender) => {
              const badge = linkTypeBadge[sender.linkType];
              const isClicked = clicked.has(sender.email);
              return (
                <div
                  key={sender.email}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                    isClicked
                      ? "border-foreground/5 opacity-60"
                      : "border-foreground/10"
                  }`}
                >
                  {/* Sender info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-medium truncate ${isClicked ? "line-through" : ""}`}
                    >
                      {sender.name}
                    </p>
                    <p className="text-foreground/50 text-xs truncate">
                      {sender.email}
                    </p>
                  </div>

                  {/* Email count */}
                  <span className="text-foreground/50 text-xs whitespace-nowrap">
                    {sender.messageCount}{" "}
                    {sender.messageCount === 1 ? "email" : "emails"}
                  </span>

                  {/* Link type badge */}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${badge.className}`}
                  >
                    {badge.label}
                  </span>

                  {/* Unsubscribe link */}
                  {isClicked ? (
                    <span className="text-xs font-medium px-3 py-1.5 rounded whitespace-nowrap text-foreground/40">
                      ✓ Clicked
                    </span>
                  ) : (
                    <a
                      href={sender.unsubscribeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleUnsubscribeClick(sender.email)}
                      className="text-xs font-medium px-3 py-1.5 rounded bg-foreground text-background hover:opacity-90 transition-opacity whitespace-nowrap"
                    >
                      Unsubscribe
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
