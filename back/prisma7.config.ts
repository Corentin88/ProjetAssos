import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Charge les variables d'environnement communes au projet.
config({ path: "../.env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});