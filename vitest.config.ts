import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

// @/ 별칭(tsconfig paths)을 그대로 쓰기 위해 vite-tsconfig-paths 를 붙인다.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
})
