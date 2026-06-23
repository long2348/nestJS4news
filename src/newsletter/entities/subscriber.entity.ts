import { Entity, PrimaryGeneratedColumn, Column, BeforeInsert } from 'typeorm';

@Entity('subscribers')
export class Subscriber {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'datetime' })
  subscribedAt: Date;

  @BeforeInsert()
  setSubscribedAt() {
    this.subscribedAt = new Date();
  }
}
