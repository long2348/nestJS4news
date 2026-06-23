import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscriber } from './entities/subscriber.entity';
import { NewsletterLog } from './entities/newsletter-log.entity';
import { NewsletterService } from './newsletter.service';
import { NewsletterController } from './newsletter.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Subscriber, NewsletterLog])],
  providers: [NewsletterService],
  controllers: [NewsletterController],
})
export class NewsletterModule {}
