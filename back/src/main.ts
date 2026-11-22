import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureHttp } from './http.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureHttp(app);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}
await bootstrap();
