import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TagsService } from './tags.service';
import { Tag } from './entities/tag.entity';

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  findByIds: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  findBy: jest.fn(),
};

describe('TagsService', () => {
  let service: TagsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        { provide: getRepositoryToken(Tag), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<TagsService>(TagsService);
    jest.clearAllMocks();
  });

  it('should return all tags', async () => {
    mockRepo.find.mockResolvedValue([{ id: 1, name: 'Chính trị', slug: 'chinh-tri' }]);
    const result = await service.findAll();
    expect(result).toHaveLength(1);
  });

  it('should throw NotFoundException when slug not found', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await expect(service.findBySlug('not-exist')).rejects.toThrow(NotFoundException);
  });

  it('should throw ConflictException on duplicate slug', async () => {
    mockRepo.findOne.mockResolvedValue({ id: 1 });
    await expect(service.create({ name: 'Chính trị', slug: 'chinh-tri' }))
      .rejects.toThrow(ConflictException);
  });
});
