import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { parseEnv } from '@autogenius/validation';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const env = parseEnv(process.env);
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  await app.listen(env.API_PORT);
}

void bootstrap();
