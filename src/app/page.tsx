export default function Home() {
	return (
		<div className="min-h-screen flex flex-col">
			<header className="border-b border-foreground/10 px-6 py-4">
				<h1 className="text-xl font-semibold">Email Unsubscriber</h1>
			</header>
			<main className="flex-1 flex items-center justify-center p-6">
				<div className="max-w-md w-full text-center space-y-4">
					<p className="text-foreground/60">
						Scan your Gmail inbox for newsletters and unsubscribe in one click.
					</p>
					<button
						className="rounded-lg bg-foreground text-background px-6 py-3 font-medium hover:opacity-90 transition-opacity"
						disabled
					>
						Sign in with Google
					</button>
					<p className="text-sm text-foreground/40">Coming soon</p>
				</div>
			</main>
		</div>
	);
}
