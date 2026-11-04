import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { parseEnv } from '@autogenius/validation';
import { loadLocalEnv } from './config/load-env';
import { setupSwagger, SWAGGER_UI_PATH } from './docs/openapi';
import { AppModule } from './app.module';

loadLocalEnv();

async function bootstrap(): Promise<void> {
  const env = parseEnv(process.env);
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  if (setupSwagger(app, env)) {
    new Logger('AutoGenius').log(`Swagger UI: http://localhost:${env.API_PORT}/${SWAGGER_UI_PATH}`);
  }
  await app.listen(env.API_PORT);
}

void bootstrap();
