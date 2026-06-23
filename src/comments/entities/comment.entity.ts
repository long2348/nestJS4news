import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, JoinColumn, BeforeInsert,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  content: string;

  @Column()
  authorId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column()
  articleId: number;

  @Column({ nullable: true })
  parentId: number;

  @ManyToOne(() => Comment, (c) => c.replies, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentId' })
  parent: Comment;

  @OneToMany(() => Comment, (c) => c.parent)
  replies: Comment[];

  @Column({ default: false })
  isApproved: boolean;

  @Column({ type: 'timestamp' })
  createdAt: Date;

  @BeforeInsert()
  setCreatedAt() {
    this.createdAt = new Date();
  }
}
