import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Env } from '@autogenius/validation';

/**
 * Registered without `useGlobalPrefix`, so these are absolute paths outside the
 * `api/v1` namespace: the docs describe the API, they are not an API resource.
 */
export const SWAGGER_UI_PATH = 'api/docs';
export const SWAGGER_JSON_PATH = 'api/docs-json';

export function isSwaggerEnabled(env: Env): boolean {
  if (env.SWAGGER_ENABLED !== undefined) {
    return env.SWAGGER_ENABLED === 'true';
  }
  return env.NODE_ENV !== 'production';
}

export function setupSwagger(app: INestApplication, env: Env): boolean {
  if (!isSwaggerEnabled(env)) {
    return false;
  }

  const config = new DocumentBuilder()
    .setTitle('AutoGenius API')
    .setDescription('AutoGenius REST API documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Paste the accessToken returned by /auth/register, /auth/login or /auth/refresh.',
      },
      'bearer',
    )
    .addTag('Authentication', 'Registration, sign-in, token rotation and the current user.')
    .addTag('Vehicles', 'The signed-in user’s vehicle records.')
    .addTag('System', 'Service liveness.')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_UI_PATH, app, document, {
    jsonDocumentUrl: SWAGGER_JSON_PATH,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      tryItOutEnabled: true,
    },
  });

  return true;
}
