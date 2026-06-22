import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('newsletter_logs')
export class NewsletterLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  sentAt: Date;

  @Column({ default: 0 })
  recipientCount: number;
}
