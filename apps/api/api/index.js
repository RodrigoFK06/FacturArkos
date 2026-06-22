// Entrypoint serverless para Vercel (Hobby gratis).
// NestJS no está pensado para serverless, así que:
//  - Cargamos el `dist` ya compilado por `nest build` (tsc con emitDecoratorMetadata),
//    NO la fuente TS — así Vercel/esbuild no rompe la metadata de los decoradores (DI).
//  - Cacheamos la instancia de la app entre invocaciones "calientes" (un solo bootstrap).
//  - Exportamos un handler (req, res) que delega en el Express interno de Nest.
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const helmet = require('helmet');
const { AppModule } = require('../dist/app.module');
const { env } = require('../dist/common/config/env');

let appPromise = null;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.enableCors({ origin: env.corsOrigins(), credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  await app.init();
  return app.getHttpAdapter().getInstance(); // la app Express subyacente
}

module.exports = async (req, res) => {
  if (!appPromise) appPromise = bootstrap();
  const expressApp = await appPromise;
  return expressApp(req, res);
};
