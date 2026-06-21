import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  /** RUC del negocio (10/15/17/20 + 9 dígitos). */
  @Matches(/^(10|15|17|20)\d{9}$/, { message: 'RUC inválido' })
  ruc!: string;

  @IsString()
  @MinLength(2)
  razonSocial!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
