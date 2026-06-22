export type AppConfig = {
  databaseUrl: string;
  jwtSecret: string;
  port: number;
  frontendOrigin: string;
};

export function loadConfig(): AppConfig {
  return {
    databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
    jwtSecret: process.env.JWT_SECRET ?? 'development-secret-change-me',
    port: Number(process.env.PORT ?? 3000),
    frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  };
}
