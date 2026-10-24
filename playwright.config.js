import { defineConfig, devices } from "@playwright/test";

// The userscript in real Edge (summarize-with-ai.e2e.js); the happy-dom suites stay on Vitest.
export default defineConfig({
	testDir: ".",
	testMatch: "*.e2e.js",
	// Measured fastest (dev-env/gates/tool-profiles.toml): each extra worker starts its own Edge.
	workers: 1,
	forbidOnly: true,
	reporter: "list",
	use: { ...devices["Desktop Edge"], channel: "msedge" },
});
