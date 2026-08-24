import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 일회성 데이터 적재 스크립트는 CommonJS(.cjs) 라 require 가 정상이다.
    // 앱 번들과 무관하므로 린트 대상에서 제외한다.
    "scripts/**",
  ]),
  {
    rules: {
      // any 는 대부분 map 콜백의 (item: any) 같은 자리로 런타임엔 무해하다.
      // CI 를 막지 않도록 경고로 두고, 점진적으로 실제 타입으로 줄여간다.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
