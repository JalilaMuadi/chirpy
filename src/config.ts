// src/config.ts
import type { MigrationConfig } from "drizzle-orm/migrator";

type APIConfig = {
  fileserverHits: number;
  platform: string;
};

type DBConfig = {
  url: string; 
  migrationConfig: MigrationConfig; 
};

export const config = {
  api: {
    fileserverHits: 0,
    platform: process.env.PLATFORM || "dev",
    jwtSecret: process.env.JWT_SECRET || "fallbacksecret",
    polkaKey: process.env.POLKA_KEY,
  }, 
  db: {
    url: process.env.DB_URL!,
    migrationConfig: {
        migrationsFolder: "./dist/db/migrations",
    },
  },
};
