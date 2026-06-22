import {
  Injectable, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article, ArticleStatus } from './entities/article.entity';
import { TagsService } from '../tags/tags.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { FilterArticleDto } from './dto/filter-article.dto';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly repo: Repository<Article>,
    private readonly tagsService: TagsService,
  ) {}

  async findAll(filter: FilterArticleDto) {
    const { page, limit, sortBy = 'publishedAt', order = 'DESC', q, categoryId, tag, status } = filter;
    const qb = this.repo.createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .leftJoinAndSelect('article.category', 'category')
      .leftJoinAndSelect('article.tags', 'tags');

    if (status) qb.andWhere('article.status = :status', { status });
    else qb.andWhere('article.status = :status', { status: ArticleStatus.PUBLISHED });
    if (q) qb.andWhere('(article.title LIKE :q OR article.summary LIKE :q)', { q: `%${q}%` });
    if (categoryId) qb.andWhere('article.categoryId = :categoryId', { categoryId });
    if (tag) qb.andWhere('tags.slug = :tag', { tag });

    qb.orderBy(`article.${sortBy}`, order)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  findBreaking(): Promise<Article[]> {
    return this.repo.find({
      where: { isBreaking: true, status: ArticleStatus.PUBLISHED },
      relations: ['author', 'category'],
      order: { publishedAt: 'DESC' },
    });
  }

  findTrending(): Promise<Article[]> {
    return this.repo.find({
      where: { isTrending: true, status: ArticleStatus.PUBLISHED },
      relations: ['author', 'category'],
      order: { publishedAt: 'DESC' },
    });
  }

  async findBySlug(slug: string): Promise<Article> {
    const article = await this.repo.findOne({
      where: { slug },
      relations: ['author', 'category', 'tags'],
    });
    if (!article) throw new NotFoundException('Article not found');
    await this.repo.increment({ id: article.id }, 'viewCount', 1);
    return article;
  }

  async create(authorId: number, dto: CreateArticleDto): Promise<Article> {
    const existing = await this.repo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug already exists');
    const tags = dto.tagIds?.length ? await this.tagsService.findByIds(dto.tagIds) : [];
    const { tagIds, ...rest } = dto;
    return this.repo.save(this.repo.create({ ...rest, authorId, tags }));
  }

  async update(id: number, userId: number, role: Role, dto: UpdateArticleDto): Promise<Article> {
    const article = await this.repo.findOne({ where: { id }, relations: ['tags'] });
    if (!article) throw new NotFoundException('Article not found');
    if (role === Role.EDITOR && article.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own articles');
    }
    const tags = dto.tagIds?.length ? await this.tagsService.findByIds(dto.tagIds) : article.tags;
    const { tagIds, ...rest } = dto;
    Object.assign(article, rest);
    article.tags = tags;
    return this.repo.save(article);
  }

  async publish(id: number): Promise<Article> {
    const article = await this.repo.findOne({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    article.status = ArticleStatus.PUBLISHED;
    article.publishedAt = new Date();
    return this.repo.save(article);
  }

  async toggleBreaking(id: number): Promise<Article> {
    const article = await this.repo.findOne({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    article.isBreaking = !article.isBreaking;
    return this.repo.save(article);
  }

  async toggleTrending(id: number): Promise<Article> {
    const article = await this.repo.findOne({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    article.isTrending = !article.isTrending;
    return this.repo.save(article);
  }

  async remove(id: number): Promise<void> {
    const article = await this.repo.findOne({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    await this.repo.remove(article);
  }
}
