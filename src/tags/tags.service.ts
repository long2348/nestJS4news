import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tag } from './entities/tag.entity';
import { CreateTagDto } from './dto/create-tag.dto';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private readonly repo: Repository<Tag>,
  ) {}

  findAll(): Promise<Tag[]> {
    return this.repo.find();
  }

  async findBySlug(slug: string): Promise<Tag> {
    const tag = await this.repo.findOne({ where: { slug } });
    if (!tag) throw new NotFoundException('Tag not found');
    return tag;
  }

  findByIds(ids: number[]): Promise<Tag[]> {
    return this.repo.findBy({ id: In(ids) });
  }

  async create(dto: CreateTagDto): Promise<Tag> {
    const existing = await this.repo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug already exists');
    return this.repo.save(this.repo.create(dto));
  }

  async remove(id: number): Promise<void> {
    const tag = await this.repo.findOne({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');
    await this.repo.remove(tag);
  }
}
