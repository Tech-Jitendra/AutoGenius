import { Global, Module } from '@nestjs/common';
import { parseEnv, type Env } from '@autogenius/validation';

export const ENV = Symbol('ENV');

@Global()
@Module({
  providers: [
    {
      provide: ENV,
      useFactory: (): Env => parseEnv(process.env),
    },
  ],
  exports: [ENV],
})
export class ConfigModule {}
