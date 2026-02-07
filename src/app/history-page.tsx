"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/lib/analysis";
import type { SavedAnalysisWithSenders } from "@/lib/db";
import AnalysisHistory from "./analysis-history";
import AnalysisResults from "./analysis-results";

function toAnalysisResult(saved: SavedAnalysisWithSenders): AnalysisResult {
  return {
    totalEmails: saved.totalEmails,
    unsubscribableEmails: saved.unsubscribableEmails,
    percentage: saved.percentage,
    uniqueSenders: saved.uniqueSenders,
    senders: saved.senders,
  };
}

export default function HistoryPage() {
  const [selected, setSelected] = useState<SavedAnalysisWithSenders | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSelect(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/analyses/${id}`);
      if (!res.ok) return;
      const data: SavedAnalysisWithSenders = await res.json();
      setSelected(data);
    } finally {
      setLoading(false);
    }
  }

  if (selected) {
    return (
      <div className="w-full max-w-2xl space-y-4">
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-foreground/50 hover:text-foreground transition-colors"
        >
          &larr; Back to history
        </button>
        <p className="text-xs text-foreground/40">
          Analysis from {selected.dateRangeStart} to {selected.dateRangeEnd}
        </p>
        <AnalysisResults analysis={toAnalysisResult(selected)} />
      </div>
    );
  }

  return (
    <>
      {loading && (
        <p className="text-sm text-foreground/40 text-center py-4">
          Loading analysis...
        </p>
      )}
      <AnalysisHistory onSelect={handleSelect} />
    </>
  );
}
