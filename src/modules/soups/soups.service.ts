import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSoupDto } from './dto/create-soup.dto';
import { colombiaTimestamps, colombiaUpdatedAt } from '../../common/date.util';

interface PrismaError {
  code?: string;
}

@Injectable()
export class SoupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSoupDto) {
    const name = dto.name?.trim();

    try {
      return await this.prisma.soup.create({
        data: {
          name: name,
          isActive: dto.isActive ?? true,
          ...colombiaTimestamps(),
        },
        select: {
          id: true,
          name: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (e: unknown) {
      if ((e as PrismaError).code === 'P2002')
        throw new ConflictException('Soup name already exists');
      throw e;
    }
  }

  async findAll(params: {
    q?: string;
    active?: boolean;
    skip?: number;
    take?: number;
  }) {
    const { q, active, skip = 0, take = 50 } = params;

    if (take > 200) throw new BadRequestException('take max is 200');

    return this.prisma.soup.findMany({
      where: {
        ...(typeof active === 'boolean' ? { isActive: active } : {}),
        ...(q?.trim()
          ? { name: { contains: q.trim(), mode: 'insensitive' } }
          : {}),
      },
      orderBy: { name: 'asc' },
      skip,
      take,
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.soup.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!item) throw new NotFoundException('Soup not found');
    return item;
  }

  async toggle(id: string) {
    const exists = await this.prisma.soup.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!exists) throw new NotFoundException('Soup not found');

    return this.prisma.soup.update({
      where: { id },
      data: { isActive: !exists.isActive, ...colombiaUpdatedAt() },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async delete(id: string) {
    const exists = await this.prisma.soup.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Soup not found');

    try {
      await this.prisma.soup.delete({ where: { id } });
      return { deleted: true, id };
    } catch (e: unknown) {
      if ((e as PrismaError).code === 'P2003') {
        throw new ConflictException(
          'Cannot delete: soup is referenced by menus. Deactivate it instead.',
        );
      }
      throw e;
    }
  }
}
