import { defineConfig } from "@playwright/test";

const LIVE_URL = "https://clearpath-compliance-ten.vercel.app";
const useLive = process.env.TARGET === "live";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  timeout: 120_000,
  use: {
    baseURL: useLive ? LIVE_URL : "http://localhost:3000",
    screenshot: "off",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
