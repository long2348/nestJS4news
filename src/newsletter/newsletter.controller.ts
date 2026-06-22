import { Controller, Post, Body, HttpCode, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NewsletterService } from './newsletter.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { SendNewsletterDto } from './dto/send-newsletter.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/enums/role.enum';

@ApiTags('newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  subscribe(@Body() dto: SubscribeDto) {
    return this.newsletterService.subscribe(dto.email);
  }

  @Post('unsubscribe')
  @HttpCode(200)
  unsubscribe(@Body() dto: SubscribeDto) {
    return this.newsletterService.unsubscribe(dto.email);
  }

  @Post('send')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  send(@Body() dto: SendNewsletterDto) {
    return this.newsletterService.send(dto);
  }
}
