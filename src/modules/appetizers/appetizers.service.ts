import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAppetizerDto } from './dto/create-appetizer.dto';
import { UpdateAppetizerDto } from './dto/update-appetizer.dto';
import {
  colombiaTimestamps,
  colombiaUpdatedAt,
  isDateTomorrowOrLaterColombia,
  todayColombia,
} from '../../common/date.util';

@Injectable()
export class AppetizersService {
  private readonly logger = new Logger(AppetizersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAppetizerDto) {
    this.logger.log(
      `CREATE consolidated appetizer — date=${dto.date} detailsCount=${dto.details?.length}`,
    );

    const targetDateStr = dto.date.split('T')[0];
    const targetDate = new Date(targetDateStr + 'T00:00:00Z');

    // 1. Check uniqueness of date
    const existing = await this.prisma.appetizer.findUnique({
      where: { date: targetDate },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        `Ya existe un registro de refrigerios para la fecha ${targetDateStr}.`,
      );
    }

    // 2. Validate areas
    const areaIds = dto.details.map((d) => d.areaId);
    const uniqueAreaIds = [...new Set(areaIds)];
    const areas = await this.prisma.area.findMany({
      where: { id: { in: uniqueAreaIds } },
      select: { id: true, isActive: true },
    });

    const activeAreaMap = new Map(areas.map((a) => [a.id, a.isActive]));
    for (const id of uniqueAreaIds) {
      if (!activeAreaMap.has(id)) {
        throw new NotFoundException(`Área con ID ${id} no encontrada.`);
      }
      if (!activeAreaMap.get(id)) {
        throw new BadRequestException(`El área con ID ${id} se encuentra inactiva.`);
      }
    }

    // 3. Calculate total quantity
    const totalQuantity = dto.details.reduce((sum, d) => sum + d.quantity, 0);

    // 4. Create in transaction
    return this.prisma.$transaction(async (tx) => {
      return tx.appetizer.create({
        data: {
          quantity: totalQuantity,
          date: targetDate,
          observations: dto.observations?.trim() ?? '',
          status: 'PENDIENTE',
          ...colombiaTimestamps(),
          details: {
            create: dto.details.map((d) => ({
              areaId: d.areaId,
              quantity: d.quantity,
            })),
          },
        },
        include: {
          details: {
            include: {
              area: {
                select: {
                  id: true,
                  name: true,
                  isActive: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },
        },
      });
    });
  }

  async findAll(params: {
    q?: string;
    date?: string;
    areaId?: string;
    skip?: number;
    take?: number;
  }) {
    const { q, date, areaId, skip = 0, take = 50 } = params;

    if (take > 1000) throw new BadRequestException('take max is 1000');

    const where: any = {};

    if (areaId) {
      where.details = {
        some: {
          areaId,
        },
      };
    }

    if (date) {
      const targetDateStr = date.split('T')[0];
      where.date = new Date(targetDateStr + 'T00:00:00Z');
    }

    if (q?.trim()) {
      where.observations = { contains: q.trim(), mode: 'insensitive' };
    }

    return this.prisma.appetizer.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
      include: {
        details: {
          include: {
            area: {
              select: {
                id: true,
                name: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.appetizer.findUnique({
      where: { id },
      include: {
        details: {
          include: {
            area: {
              select: {
                id: true,
                name: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });

    if (!item) throw new NotFoundException('Appetizer request not found');
    return item;
  }

  async update(id: string, dto: UpdateAppetizerDto, userId: string) {
    this.logger.log(`UPDATE consolidated appetizer — id=${id}`);

    const exists = await this.prisma.appetizer.findUnique({
      where: { id },
      select: { id: true, date: true },
    });
    if (!exists) throw new NotFoundException('Appetizer request not found');

    let isAdmin = false;
    if (userId) {
      const profile = await this.prisma.profile.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (profile && profile.role === 'ADMIN') {
        isAdmin = true;
      }
    }

    const currentDateStr = exists.date.toISOString().slice(0, 10);
    if (!isAdmin && !isDateTomorrowOrLaterColombia(currentDateStr)) {
      throw new BadRequestException(
        'No se puede actualizar una solicitud de aperitivo para el día de hoy o fechas pasadas.',
      );
    }

    const data: any = {};

    if (dto.date !== undefined) {
      const targetDateStr = dto.date.split('T')[0];
      if (!isAdmin && !isDateTomorrowOrLaterColombia(targetDateStr)) {
        throw new BadRequestException(
          'La nueva fecha de solicitud debe ser de mañana en adelante.',
        );
      }
      const targetDate = new Date(targetDateStr + 'T00:00:00Z');

      const conflict = await this.prisma.appetizer.findFirst({
        where: {
          date: targetDate,
          id: { not: id },
        },
        select: { id: true },
      });
      if (conflict) {
        throw new BadRequestException(
          `Ya existe un registro de refrigerios para la fecha ${targetDateStr}.`,
        );
      }

      data.date = targetDate;
    }

    if (dto.observations !== undefined) {
      data.observations = dto.observations.trim();
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    if (dto.details !== undefined) {
      // Validate areas in details
      const areaIds = dto.details.map((d) => d.areaId);
      const uniqueAreaIds = [...new Set(areaIds)];
      const areas = await this.prisma.area.findMany({
        where: { id: { in: uniqueAreaIds } },
        select: { id: true, isActive: true },
      });

      const activeAreaMap = new Map(areas.map((a) => [a.id, a.isActive]));
      for (const areaId of uniqueAreaIds) {
        if (!activeAreaMap.has(areaId)) {
          throw new NotFoundException(`Área con ID ${areaId} no encontrada.`);
        }
        if (!activeAreaMap.get(areaId)) {
          throw new BadRequestException(`El área con ID ${areaId} se encuentra inactiva.`);
        }
      }

      const totalQuantity = dto.details.reduce((sum, d) => sum + d.quantity, 0);

      return this.prisma.$transaction(async (tx) => {
        // Clear previous details
        await tx.appetizerDetail.deleteMany({
          where: { appetizerId: id },
        });

        // Insert new details
        await tx.appetizerDetail.createMany({
          data: dto.details!.map((d) => ({
            appetizerId: id,
            areaId: d.areaId,
            quantity: d.quantity,
          })),
        });

        // Update appetizer
        return tx.appetizer.update({
          where: { id },
          data: {
            ...data,
            quantity: totalQuantity,
            ...colombiaUpdatedAt(),
          },
          include: {
            details: {
              include: {
                area: {
                  select: {
                    id: true,
                    name: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
              },
            },
          },
        });
      });
    }

    // No details update
    return this.prisma.appetizer.update({
      where: { id },
      data: {
        ...data,
        ...colombiaUpdatedAt(),
      },
      include: {
        details: {
          include: {
            area: {
              select: {
                id: true,
                name: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });
  }

  async delete(id: string, userId: string) {
    this.logger.log(`DELETE appetizer — id=${id}`);

    const exists = await this.prisma.appetizer.findUnique({
      where: { id },
      select: { id: true, date: true },
    });
    if (!exists) throw new NotFoundException('Appetizer request not found');

    let isAdmin = false;
    if (userId) {
      const profile = await this.prisma.profile.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (profile && profile.role === 'ADMIN') {
        isAdmin = true;
      }
    }

    const currentDateStr = exists.date.toISOString().slice(0, 10);
    if (!isAdmin && !isDateTomorrowOrLaterColombia(currentDateStr)) {
      throw new BadRequestException(
        'No se puede eliminar una solicitud de aperitivo para el día de hoy o fechas pasadas.',
      );
    }

    await this.prisma.appetizer.delete({ where: { id } });
    return { deleted: true, id };
  }

  async findDetails(appetizerId: string) {
    const exists = await this.prisma.appetizer.findUnique({
      where: { id: appetizerId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Appetizer request not found');

    return this.prisma.appetizerDetail.findMany({
      where: { appetizerId },
      include: {
        area: {
          select: {
            id: true,
            name: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async updateCurrentDayAppetizersStatus() {
    this.logger.log('UPDATE current day appetizers status to ENTREGADO');
    const todayStr = todayColombia();
    const date = new Date(todayStr + 'T00:00:00Z');

    const result = await this.prisma.appetizer.updateMany({
      where: {
        date,
        status: 'PENDIENTE',
      },
      data: {
        status: 'ENTREGADO',
        ...colombiaUpdatedAt(),
      },
    });

    this.logger.log(
      `Updated ${result.count} appetizer(s) to ENTREGADO status for date=${todayStr}`,
    );
    return result;
  }
}
