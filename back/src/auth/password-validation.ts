import { applyDecorators, BadRequestException } from '@nestjs/common';
import { MaxLength, MinLength } from 'class-validator';

export const minPasswordChars = 12;
export const maxPasswordChars = 128;
export const passwordMinimumMessage = `Votre mot de passe doit contenir au moins ${minPasswordChars} caractères.`;
export const passwordMaximumMessage = `Votre mot de passe ne peut pas dépasser ${maxPasswordChars} caractères.`;

export const PasswordMaxLength = () =>
  MaxLength(maxPasswordChars, { message: passwordMaximumMessage });
export const NewPasswordLength = () =>
  applyDecorators(
    MinLength(minPasswordChars, { message: passwordMinimumMessage }),
    PasswordMaxLength(),
  );

export class PasswordValidationError extends BadRequestException {}
