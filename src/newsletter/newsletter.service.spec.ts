import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { Subscriber } from './entities/subscriber.entity';
import { NewsletterLog } from './entities/newsletter-log.entity';

const mockSubscriberRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
};
const mockLogRepo = {
  create: jest.fn(),
  save: jest.fn(),
};

describe('NewsletterService', () => {
  let service: NewsletterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsletterService,
        { provide: getRepositoryToken(Subscriber), useValue: mockSubscriberRepo },
        { provide: getRepositoryToken(NewsletterLog), useValue: mockLogRepo },
      ],
    }).compile();
    service = module.get<NewsletterService>(NewsletterService);
    jest.clearAllMocks();
  });

  it('should throw ConflictException if email already subscribed', async () => {
    mockSubscriberRepo.findOne.mockResolvedValue({ id: 1, isActive: true });
    await expect(service.subscribe('a@b.com')).rejects.toThrow(ConflictException);
  });

  it('should create subscriber', async () => {
    mockSubscriberRepo.findOne.mockResolvedValue(null);
    mockSubscriberRepo.create.mockReturnValue({ email: 'a@b.com' });
    mockSubscriberRepo.save.mockResolvedValue({ id: 1, email: 'a@b.com', isActive: true });
    const result = await service.subscribe('a@b.com');
    expect(result.email).toBe('a@b.com');
  });

  it('should throw NotFoundException on unsubscribe unknown email', async () => {
    mockSubscriberRepo.findOne.mockResolvedValue(null);
    await expect(service.unsubscribe('x@y.com')).rejects.toThrow(NotFoundException);
  });
});
