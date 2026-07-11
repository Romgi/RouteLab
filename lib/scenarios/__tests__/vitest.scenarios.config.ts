import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../../../", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/scenarios/__tests__/scenarios.test.ts"],
  },
});
