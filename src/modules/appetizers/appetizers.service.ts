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
      `CREATE appetizer — areaId=${dto.areaId} quantity=${dto.quantity}`,
    );

    const area = await this.prisma.area.findUnique({
      where: { id: dto.areaId },
      select: { id: true, isActive: true },
    });

    if (!area) throw new NotFoundException('Area not found');
    if (!area.isActive)
      throw new BadRequestException('Referenced area is inactive');

    const targetDateStr = dto.date.split('T')[0];
    if (!isDateTomorrowOrLaterColombia(targetDateStr)) {
      throw new BadRequestException(
        'Las solicitudes de aperitivos solo están permitidas para el día de mañana en adelante (Colombia timezone).',
      );
    }

    return this.prisma.appetizer.create({
      data: {
        quantity: dto.quantity,
        areaId: dto.areaId,
        date: new Date(targetDateStr + 'T00:00:00Z'),
        observations: dto.observations?.trim() ?? '',
        status: 'PENDIENTE',
        ...colombiaTimestamps(),
      },
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
      where.areaId = areaId;
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

  async findOne(id: string) {
    const item = await this.prisma.appetizer.findUnique({
      where: { id },
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

    if (!item) throw new NotFoundException('Appetizer request not found');
    return item;
  }

  async update(id: string, dto: UpdateAppetizerDto, userId: string) {
    this.logger.log(`UPDATE appetizer — id=${id}`);

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

    if (dto.quantity !== undefined) {
      data.quantity = dto.quantity;
    }

    if (dto.areaId !== undefined) {
      const area = await this.prisma.area.findUnique({
        where: { id: dto.areaId },
        select: { id: true, isActive: true },
      });
      if (!area) throw new NotFoundException('Area not found');
      if (!area.isActive)
        throw new BadRequestException('Referenced area is inactive');
      data.areaId = dto.areaId;
    }

    if (dto.date !== undefined) {
      const targetDateStr = dto.date.split('T')[0];
      if (!isAdmin && !isDateTomorrowOrLaterColombia(targetDateStr)) {
        throw new BadRequestException(
          'La nueva fecha de solicitud debe ser de mañana en adelante.',
        );
      }
      data.date = new Date(targetDateStr + 'T00:00:00Z');
    }

    if (dto.observations !== undefined) {
      data.observations = dto.observations.trim();
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    return this.prisma.appetizer.update({
      where: { id },
      data: {
        ...data,
        ...colombiaUpdatedAt(),
      },
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
