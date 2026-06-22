import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SearchService } from './search.service';
import { Article } from '../articles/entities/article.entity';

const mockRepo = {
  createQueryBuilder: jest.fn(),
};

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: getRepositoryToken(Article), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<SearchService>(SearchService);
    jest.clearAllMocks();
  });

  it('should return paginated results with meta', async () => {
    const mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 1 }], 1]),
    };
    mockRepo.createQueryBuilder.mockReturnValue(mockQb);
    const result = await service.search('test', 1, 10);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('meta');
    expect(result.meta.total).toBe(1);
  });
});
