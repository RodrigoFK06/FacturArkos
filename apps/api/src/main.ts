import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { env } from './common/config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(helmet()); // cabeceras de seguridad
  app.setGlobalPrefix('api');
  app.enableCors({ origin: env.corsOrigins(), credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.enableShutdownHooks(); // cierre ordenado (libera Prisma, etc.)
  await app.listen(env.port());
  new Logger('Bootstrap').log(`FacturArkos API escuchando en http://localhost:${env.port()}/api`);
}

void bootstrap();
