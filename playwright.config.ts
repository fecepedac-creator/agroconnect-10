import {defineConfig, devices} from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", {open: "never"}]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --mode e2e --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    env: {
      ...process.env,
      VITE_USE_FIREBASE_EMULATORS: "true",
      VITE_FIREBASE_PROJECT_ID: "demo-mundoconnect",
      VITE_FIREBASE_API_KEY: "demo-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: "demo-mundoconnect.firebaseapp.com",
      VITE_FIREBASE_STORAGE_BUCKET: "demo-mundoconnect.appspot.com",
      VITE_FIREBASE_MESSAGING_SENDER_ID: "123456789",
      VITE_FIREBASE_APP_ID: "1:123456789:web:e2e",
    },
  },
  projects: [
    {
      name: "chromium",
      use: {...devices["Desktop Chrome"]},
    },
    {
      name: "mobile-chromium",
      use: {...devices["Pixel 7"]},
      testMatch: /public-sectors\.spec\.ts/,
    },
  ],
});

