import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { colombiaTimestamps, colombiaUpdatedAt } from '../../common/date.util';

interface PrismaError {
  code?: string;
}

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAreaDto) {
    const name = dto.name?.trim();

    try {
      return await this.prisma.area.create({
        data: {
          name,
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
      if ((e as PrismaError).code === 'P2002') {
        throw new ConflictException('Area name already exists');
      }
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

    return this.prisma.area.findMany({
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

  async findAllActive() {
    return this.prisma.area.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
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
    const item = await this.prisma.area.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!item) throw new NotFoundException('Area not found');
    return item;
  }

  async update(id: string, dto: UpdateAreaDto) {
    const name = dto.name?.trim();

    const exists = await this.prisma.area.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Area not found');

    try {
      return await this.prisma.area.update({
        where: { id },
        data: {
          name,
          ...colombiaUpdatedAt(),
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
      if ((e as PrismaError).code === 'P2002') {
        throw new ConflictException('Area name already exists');
      }
      throw e;
    }
  }

  async toggle(id: string) {
    const exists = await this.prisma.area.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!exists) throw new NotFoundException('Area not found');

    return this.prisma.area.update({
      where: { id },
      data: {
        isActive: !exists.isActive,
        ...colombiaUpdatedAt(),
      },
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
    const exists = await this.prisma.area.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Area not found');

    try {
      await this.prisma.area.delete({ where: { id } });
      return { deleted: true, id };
    } catch (e: unknown) {
      if ((e as PrismaError).code === 'P2003') {
        throw new ConflictException(
          'Cannot delete: area is referenced by appetizers. Deactivate it instead.',
        );
      }
      throw e;
    }
  }
}
