import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  // 构建时注入版本号（客户端/服务端均可读），替掉组件里硬编码的版本字面量
  env: { APP_VERSION: pkg.version },
};

export default nextConfig;
