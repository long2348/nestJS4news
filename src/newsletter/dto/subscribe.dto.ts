import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubscribeDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}
