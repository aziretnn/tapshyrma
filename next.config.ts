import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    // Модель ТЗ передаётся между сервером и клиентом целиком; лимит поднят
    // под документы с большим числом функциональных требований.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default config;
