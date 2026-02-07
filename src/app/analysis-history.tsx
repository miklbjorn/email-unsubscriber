"use client";

import { useEffect, useState } from "react";
import type { SavedAnalysis } from "@/lib/db";

function formatDate(iso: string): string {
  return new Date(iso + "Z").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function AnalysisHistory({
  onSelect,
}: {
  onSelect: (id: string) => void;
}) {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analyses")
      .then((res) => (res.ok ? (res.json() as Promise<SavedAnalysis[]>) : []))
      .then((data) => setAnalyses(data))
      .catch(() => setAnalyses([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <p className="text-sm text-foreground/40 text-center py-4">
        Loading history...
      </p>
    );
  }

  if (analyses.length === 0) return null;

  return (
    <div className="w-full max-w-2xl space-y-3">
      <h2 className="text-sm font-semibold text-foreground/60">
        Past Analyses
      </h2>
      <div className="space-y-2">
        {analyses.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelect(a.id)}
            className="w-full text-left flex items-center gap-3 rounded-lg border border-foreground/10 px-4 py-3 text-sm hover:bg-foreground/5 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-foreground/50 text-xs">
                {formatDate(a.createdAt)} &middot;{" "}
                {formatRange(a.dateRangeStart, a.dateRangeEnd)}
              </p>
              <p className="mt-0.5">
                <span className="font-medium">{a.unsubscribableEmails}</span> of{" "}
                {a.totalEmails} emails ({a.percentage}%) from{" "}
                <span className="font-medium">{a.uniqueSenders}</span> senders
              </p>
            </div>
            <span className="text-foreground/30 text-xs">View →</span>
          </button>
        ))}
      </div>
    </div>
  );
}
