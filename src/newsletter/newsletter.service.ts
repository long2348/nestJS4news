import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscriber } from './entities/subscriber.entity';
import { NewsletterLog } from './entities/newsletter-log.entity';
import { SendNewsletterDto } from './dto/send-newsletter.dto';

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    @InjectRepository(Subscriber)
    private readonly subscriberRepo: Repository<Subscriber>,
    @InjectRepository(NewsletterLog)
    private readonly logRepo: Repository<NewsletterLog>,
  ) {}

  async subscribe(email: string): Promise<Subscriber> {
    const existing = await this.subscriberRepo.findOne({ where: { email } });
    if (existing?.isActive) throw new ConflictException('Email already subscribed');
    if (existing) {
      existing.isActive = true;
      return this.subscriberRepo.save(existing);
    }
    return this.subscriberRepo.save(this.subscriberRepo.create({ email }));
  }

  async unsubscribe(email: string): Promise<void> {
    const sub = await this.subscriberRepo.findOne({ where: { email } });
    if (!sub) throw new NotFoundException('Email not found');
    sub.isActive = false;
    await this.subscriberRepo.save(sub);
  }

  async send(dto: SendNewsletterDto): Promise<NewsletterLog> {
    const subscribers = await this.subscriberRepo.find({ where: { isActive: true } });
    this.logger.log(`Sending newsletter "${dto.subject}" to ${subscribers.length} subscribers`);
    return this.logRepo.save(
      this.logRepo.create({ ...dto, recipientCount: subscribers.length }),
    );
  }
}
