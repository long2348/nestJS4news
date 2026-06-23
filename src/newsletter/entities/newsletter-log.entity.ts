import { Entity, PrimaryGeneratedColumn, Column, BeforeInsert } from 'typeorm';

@Entity('newsletter_logs')
export class NewsletterLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'datetime' })
  sentAt: Date;

  @Column({ default: 0 })
  recipientCount: number;

  @BeforeInsert()
  setSentAt() {
    this.sentAt = new Date();
  }
}
