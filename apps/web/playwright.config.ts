import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:5173",
    headless: true
  },
  webServer: [
    {
      command: "npm run dev:api",
      url: "http://localhost:4000/api/health",
      cwd: "../..",
      reuseExistingServer: true
    },
    {
      command: "npm run dev:web",
      url: "http://localhost:5173",
      cwd: "../..",
      reuseExistingServer: true
    }
  ]
});
