import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendNewsletterDto {
  @ApiProperty()
  @IsString()
  subject: string;

  @ApiProperty()
  @IsString()
  content: string;
}
