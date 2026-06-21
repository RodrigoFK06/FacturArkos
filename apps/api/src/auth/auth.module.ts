import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../common/config/env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    // global: true → JwtService disponible para los guards globales del AppModule.
    JwtModule.register({ global: true, secret: env.jwtSecret() }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
