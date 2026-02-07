import Link from "next/link";
import type { AnalysisResult } from "@/lib/analysis";
import AnalyzeForm from "./analyze-form";
import AnalysisResults from "./analysis-results";
import HistoryPage from "./history-page";

function decodeAnalysis(encoded: string): AnalysisResult | null {
	try {
		const json = new TextDecoder().decode(
			Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)),
		);
		return JSON.parse(json) as AnalysisResult;
	} catch {
		return null;
	}
}

export default async function Home({
	searchParams,
}: {
	searchParams: Promise<{
		auth?: string;
		error?: string;
		results?: string;
		analysis_id?: string;
	}>;
}) {
	const params = await searchParams;
	const analysis = params.results ? decodeAnalysis(params.results) : null;

	return (
		<div className="min-h-screen flex flex-col">
			<header className="border-b border-foreground/10 px-6 py-4">
				<h1 className="text-xl font-semibold">Email Unsubscriber</h1>
			</header>
			<main className="flex-1 flex flex-col items-center p-6">
				{/* Error state */}
				{params.error && (
					<div className="max-w-md w-full rounded-lg bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 px-4 py-3 text-sm text-center mb-6">
						Authentication failed: {params.error}
					</div>
				)}

				{/* Results view */}
				{params.auth === "success" && analysis ? (
					<>
						<AnalysisResults
							analysis={analysis}
							analysisId={params.analysis_id}
						/>
						<div className="mt-8">
							<Link
								href="/"
								className="text-sm text-foreground/50 hover:text-foreground transition-colors"
							>
								&larr; New Analysis
							</Link>
						</div>
					</>
				) : (
					/* Default form view */
					<div className="flex-1 flex flex-col items-center justify-center w-full gap-8">
						<div className="max-w-md w-full text-center space-y-4">
							<p className="text-foreground/60">
								Scan your Gmail inbox for newsletters and
								unsubscribe in one click.
							</p>
							<AnalyzeForm />
						</div>
						<HistoryPage />
					</div>
				)}
			</main>
		</div>
	);
}
