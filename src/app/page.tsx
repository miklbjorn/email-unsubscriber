import AnalyzeForm from "./analyze-form";

export default async function Home({
	searchParams,
}: {
	searchParams: Promise<{
		auth?: string;
		error?: string;
		totalMessages?: string;
		unsubscribable?: string;
	}>;
}) {
	const params = await searchParams;

	return (
		<div className="min-h-screen flex flex-col">
			<header className="border-b border-foreground/10 px-6 py-4">
				<h1 className="text-xl font-semibold">Email Unsubscriber</h1>
			</header>
			<main className="flex-1 flex items-center justify-center p-6">
				<div className="max-w-md w-full text-center space-y-4">
					{params.error && (
						<div className="rounded-lg bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 px-4 py-3 text-sm">
							Authentication failed: {params.error}
						</div>
					)}
					{params.auth === "success" && (
						<div className="rounded-lg bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 px-4 py-3 text-sm">
							Scanned {params.totalMessages ?? "?"} emails —{" "}
							{params.unsubscribable ?? "?"} have unsubscribe
							headers. Full analysis coming in a future update.
						</div>
					)}
					<p className="text-foreground/60">
						Scan your Gmail inbox for newsletters and unsubscribe in
						one click.
					</p>
					<AnalyzeForm />
				</div>
			</main>
		</div>
	);
}
