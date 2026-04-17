import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProteinDto } from './dto/create-protein.dto';
import { UpdateProteinDto } from './dto/update-protein.dto';
import { colombiaTimestamps, colombiaUpdatedAt } from '../../common/date.util';

interface PrismaError {
  code?: string;
}

@Injectable()
export class ProteinsService {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreateProteinDto) {
    const name = dto.name?.trim();

    try {
      return await this.prisma.proteinType.create({
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
        throw new ConflictException('Protein name already exists');
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

    return this.prisma.proteinType.findMany({
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
    return this.prisma.proteinType.findMany({
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
    const item = await this.prisma.proteinType.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!item) throw new NotFoundException('ProteinType not found');
    return item;
  }

  async toggle(id: string) {
    const exists = await this.prisma.proteinType.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!exists) throw new NotFoundException('ProteinType not found');

    return this.prisma.proteinType.update({
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

  async update(id: string, dto: UpdateProteinDto) {
    const exists = await this.prisma.proteinType.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('ProteinType not found');

    const name = dto.name?.trim();

    try {
      return await this.prisma.proteinType.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
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
      if ((e as PrismaError).code === 'P2002')
        throw new ConflictException('Protein name already exists');
      throw e;
    }
  }

  async delete(id: string) {
    const exists = await this.prisma.proteinType.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('ProteinType not found');

    try {
      await this.prisma.proteinType.delete({ where: { id } });
      return { deleted: true, id };
    } catch (e: unknown) {
      // Si está referenciada (menús/reservas), Postgres/Prisma suele lanzar error de FK
      // Prisma: P2003 (Foreign key constraint failed)
      if ((e as PrismaError).code === 'P2003') {
        throw new ConflictException(
          'Cannot delete: protein is referenced by menus/reservations. Deactivate it instead.',
        );
      }
      throw e;
    }
  }
}
