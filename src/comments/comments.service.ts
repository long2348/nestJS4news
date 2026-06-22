import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly repo: Repository<Comment>,
  ) {}

  findByArticle(articleId: number): Promise<Comment[]> {
    return this.repo.find({
      where: { articleId, parentId: IsNull() },
      relations: { author: true, replies: { author: true } },
      order: { createdAt: 'DESC' },
    });
  }

  create(
    authorId: number,
    articleId: number,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    return this.repo.save(this.repo.create({ ...dto, authorId, articleId }));
  }

  async approve(id: number): Promise<Comment> {
    const comment = await this.repo.findOne({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    comment.isApproved = true;
    return this.repo.save(comment);
  }

  async remove(id: number, userId: number, role: Role): Promise<void> {
    const comment = await this.repo.findOne({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (role !== Role.ADMIN && comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.repo.remove(comment);
  }
}
