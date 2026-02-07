"use client";

import { useEffect, useState } from "react";
import type { AnalysisResult } from "@/lib/analysis";
import type { SavedAnalysisWithSenders } from "@/lib/db";
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

export default function AnalysisById({ analysisId }: { analysisId: string }) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch(`/api/analyses/${analysisId}`);
        if (!res.ok) {
          setError(res.status === 401 ? "not_authenticated" : "not_found");
          return;
        }
        const data: SavedAnalysisWithSenders = await res.json();
        if (active) {
          setAnalysis(toAnalysisResult(data));
        }
      } catch {
        if (active) setError("load_failed");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [analysisId]);

  if (loading) {
    return (
      <p className="text-sm text-foreground/40 text-center py-4">
        Loading analysis...
      </p>
    );
  }

  if (error || !analysis) {
    const message =
      error === "not_authenticated"
        ? "Please run a new analysis to re-authenticate."
        : "Could not load analysis results.";
    return (
      <div className="max-w-md w-full rounded-lg bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 px-4 py-3 text-sm text-center">
        {message}
      </div>
    );
  }

  return <AnalysisResults analysis={analysis} analysisId={analysisId} />;
}
