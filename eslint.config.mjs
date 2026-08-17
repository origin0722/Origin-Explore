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
    // 构建/打包产物与检查工具输出（生成代码，不参与 lint）
    ".packaging/**",
    "release/**",
    "qa-out/**",
    "docs/research/**",
    // 本地工具目录（gitignored，浏览器 profile 等第三方代码）
    ".dsh-vision-toolkit/**",
    ".dsh-vision-router/**",
  ]),
  // CommonJS 运行时文件（Electron 主进程/preload 与 Node 脚本）：require() 是正确用法，
  // 不套用面向 ESM/TS 的 import 规则。
  {
    files: ["electron/**/*.js", "scripts/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
