import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { Article } from './entities/article.entity';
import { TagsService } from '../tags/tags.service';
import { Role } from '../common/enums/role.enum';

const mockRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
  increment: jest.fn(),
};
const mockTagsService = { findByIds: jest.fn() };

describe('ArticlesService', () => {
  let service: ArticlesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: getRepositoryToken(Article), useValue: mockRepo },
        { provide: TagsService, useValue: mockTagsService },
      ],
    }).compile();
    service = module.get<ArticlesService>(ArticlesService);
    jest.clearAllMocks();
  });

  describe('findBySlug', () => {
    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findBySlug('not-exist')).rejects.toThrow(NotFoundException);
    });

    it('should increment viewCount and return article', async () => {
      const article = { id: 1, slug: 'bai-viet', viewCount: 5 };
      mockRepo.findOne.mockResolvedValue(article);
      mockRepo.increment.mockResolvedValue({});
      const result = await service.findBySlug('bai-viet');
      expect(mockRepo.increment).toHaveBeenCalledWith({ id: 1 }, 'viewCount', 1);
      expect(result).toEqual(article);
    });
  });

  describe('update', () => {
    it('should throw ForbiddenException if editor updates another author article', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 1, authorId: 99 });
      await expect(service.update(1, 1, Role.EDITOR, { title: 'New' }))
        .rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to update any article', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 1, authorId: 99, tags: [] });
      mockRepo.save.mockResolvedValue({ id: 1, title: 'Updated' });
      mockTagsService.findByIds.mockResolvedValue([]);
      const result = await service.update(1, 1, Role.ADMIN, { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });
  });
});
