import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from '../common/enums/role.enum';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findAll(): Promise<User[]> {
    return this.repo.find();
  }

  async findById(id: number): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({
      where: { email },
      select: { id: true, email: true, password: true, role: true, isActive: true, fullName: true, avatar: true, createdAt: true, updatedAt: true },
    });
  }

  async create(data: { email: string; password: string; fullName: string }): Promise<User> {
    const existing = await this.repo.findOne({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already exists');
    return this.repo.save(this.repo.create(data));
  }

  async updateProfile(id: number, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findById(id);
    Object.assign(user, dto);
    return this.repo.save(user);
  }

  async updateRole(id: number, role: Role): Promise<User> {
    const user = await this.findById(id);
    user.role = role;
    return this.repo.save(user);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findById(id);
    await this.repo.remove(user);
  }
}
