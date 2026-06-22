import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getRepositoryToken(Category), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<CategoriesService>(CategoriesService);
    jest.clearAllMocks();
  });

  it('should return all categories with children', async () => {
    mockRepo.find.mockResolvedValue([{ id: 1, name: 'Thời sự', children: [] }]);
    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(mockRepo.find).toHaveBeenCalledWith({ where: { parentId: null }, relations: ['children'] });
  });

  it('should throw NotFoundException when slug not found', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await expect(service.findBySlug('not-exist')).rejects.toThrow(NotFoundException);
  });

  it('should throw ConflictException on duplicate slug', async () => {
    mockRepo.findOne.mockResolvedValueOnce({ id: 1 });
    await expect(service.create({ name: 'Thời sự', slug: 'thoi-su' }))
      .rejects.toThrow(ConflictException);
  });
});
