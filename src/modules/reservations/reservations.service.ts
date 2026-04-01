import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import {
  colombiaTimestamps,
  colombiaUpdatedAt,
  isDateTomorrowOrLaterColombia,
  nowColombia,
  todayColombia,
} from '../../common/date.util';

interface PrismaError {
  code?: string;
  stack?: string;
}

const INCLUDE_RELATIONS = {
  proteinType: { select: { id: true, name: true } },
  menu: { select: { id: true, date: true, dayOfWeek: true } },
  sideDishes: {
    select: {
      id: true,
      sideDishId: true,
      nameSnapshot: true,
    },
  },
} as const;

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(private readonly prisma: PrismaService) { }

  /* ───────── helpers ───────── */

  /**
   * Returns the date string (YYYY-MM-DD) for a given menu.
   */
  private menuDateStr(menuDate: Date): string {
    return menuDate.toISOString().slice(0, 10);
  }

  /* ───────── CREATE ───────── */

  async create(dto: CreateReservationDto) {
    const cc = dto.cc.trim();
    this.logger.log(`CREATE reservation — cc=${cc} menuId=${dto.menuId}`);

    // 1. Validate user in whitelist
    const user = await this.prisma.whitelistEntry.findUnique({
      where: { cc },
      select: { id: true, cc: true, name: true, enabled: true },
    });
    if (!user) {
      this.logger.warn(`CREATE rejected — cc=${cc} not in whitelist`);
      throw new NotFoundException('CC not found in whitelist');
    }
    if (!user.enabled) {
      this.logger.warn(`CREATE rejected — cc=${cc} disabled in whitelist`);
      throw new ForbiddenException('User is disabled in the whitelist');
    }

    // 2. Validate menu exists
    const menu = await this.prisma.menu.findUnique({
      where: { id: dto.menuId },
      select: {
        id: true,
        date: true,
        defaultProteinTypeId: true,
        proteinOptions: { select: { proteinTypeId: true } },
        sideOptions: {
          select: {
            sideDishId: true,
            sideDish: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!menu) throw new NotFoundException('Menu not found');

    const dateStr = this.menuDateStr(menu.date);

    // 3. Determine if reservation is valid (tomorrow or later)
    const canChoose = isDateTomorrowOrLaterColombia(dateStr);

    let proteinTypeId: string;
    if (canChoose) {
      // Validate protein is in menu options
      const validProteins = menu.proteinOptions.map(
        (o: { proteinTypeId: string }) => o.proteinTypeId,
      );
      if (!validProteins.includes(dto.proteinTypeId)) {
        throw new BadRequestException(
          'Selected protein is not available in this menu',
        );
      }
      proteinTypeId = dto.proteinTypeId;
    } else {
      // Same-day or past: auto-assign default protein
      if (!menu.defaultProteinTypeId) {
        throw new BadRequestException(
          'Menu has no default protein and same-day reservations cannot choose',
        );
      }
      proteinTypeId = menu.defaultProteinTypeId;
    }

    // 4. Auto-assign side dishes from menu options
    const sideDishesData = menu.sideOptions
      .filter((o: any) => o.sideDish != null)
      .map((o: any) => ({
        sideDishId: o.sideDish.id,
        nameSnapshot: o.sideDish.name,
      }));

    // 5. Create reservation
    try {
      return await this.prisma.reservation.create({
        data: {
          menuId: menu.id,
          whitelistEntryId: user.id,
          cc: user.cc,
          name: user.name,
          proteinTypeId,
          status: canChoose ? 'RESERVADA' : 'AUTO_ASIGNADA',
          sideDishes: sideDishesData.length
            ? { create: sideDishesData }
            : undefined,
          ...colombiaTimestamps(),
        },
        include: INCLUDE_RELATIONS,
      });
    } catch (e: unknown) {
      const pe = e as PrismaError;
      if (pe.code === 'P2002') {
        this.logger.warn(
          `CREATE conflict — cc=${cc} menuId=${dto.menuId} duplicate`,
        );
        throw new ConflictException(
          'A reservation for this menu and CC already exists',
        );
      }
      this.logger.error(
        `CREATE failed — cc=${cc} menuId=${dto.menuId}`,
        pe.stack,
      );
      throw e;
    }
    this.logger.log(
      `CREATE success — cc=${cc} menuId=${dto.menuId} status=${canChoose ? 'RESERVADA' : 'AUTO_ASIGNADA'}`,
    );
  }

  /* ───────── UPDATE (change protein) ───────── */

  async update(id: string, dto: UpdateReservationDto) {
    const cc = dto.cc.trim();
    this.logger.log(`UPDATE reservation — id=${id} cc=${cc}`);

    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        menu: {
          select: {
            date: true,
            proteinOptions: { select: { proteinTypeId: true } },
          },
        },
      },
    });
    if (!reservation) {
      this.logger.warn(`UPDATE rejected — id=${id} not found`);
      throw new NotFoundException('Reservation not found');
    }
    if (reservation.cc !== cc) {
      this.logger.warn(
        `UPDATE rejected — id=${id} cc=${cc} ownership mismatch`,
      );
      throw new ForbiddenException(
        'This reservation does not belong to the provided CC',
      );
    }

    const dateStr = this.menuDateStr(reservation.menu.date);
    if (!isDateTomorrowOrLaterColombia(dateStr)) {
      throw new BadRequestException(
        'El menú ya se encuentra en preparación para el día de hoy.',
      );
    }

    if (reservation.status === 'CANCELADA') {
      throw new BadRequestException('Cannot modify a cancelled reservation');
    }

    if (reservation.printedAt) {
      throw new BadRequestException('El ticket ya fue impreso y la reservación no puede ser modificada');
    }

    // Validate protein is in menu options
    const validProteins = reservation.menu.proteinOptions.map(
      (o: { proteinTypeId: string }) => o.proteinTypeId,
    );
    if (!validProteins.includes(dto.proteinTypeId)) {
      throw new BadRequestException(
        'Selected protein is not available in this menu',
      );
    }

    // Execute update immediately (side dishes remain untouched)
    return await this.prisma.reservation.update({
      where: { id },
      data: {
        proteinTypeId: dto.proteinTypeId,
        ...colombiaUpdatedAt(),
      },
      include: INCLUDE_RELATIONS,
    });
  }

  /* ───────── CANCEL ───────── */

  async cancel(id: string, cc: string) {
    cc = cc.trim();
    this.logger.log(`CANCEL reservation — id=${id} cc=${cc}`);

    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { menu: { select: { date: true } } },
    });
    if (!reservation) {
      this.logger.warn(`CANCEL rejected — id=${id} not found`);
      throw new NotFoundException('Reservation not found');
    }
    if (reservation.cc !== cc) {
      this.logger.warn(
        `CANCEL rejected — id=${id} cc=${cc} ownership mismatch`,
      );
      throw new ForbiddenException(
        'This reservation does not belong to the provided CC',
      );
    }

    const dateStr = this.menuDateStr(reservation.menu.date);
    if (!isDateTomorrowOrLaterColombia(dateStr)) {
      throw new BadRequestException(
        'El menú ya se encuentra en preparación para el día de hoy. Las cancelaciones solo están permitidas para el día de mañana en adelante.',
      );
    }

    if (reservation.status === 'CANCELADA') {
      this.logger.warn(`CANCEL rejected — id=${id} already CANCELADA`);
      throw new BadRequestException('Reservation is already cancelled');
    }

    const result = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: 'CANCELADA',
        ...colombiaUpdatedAt(),
      },
      include: INCLUDE_RELATIONS,
    });
    this.logger.log(`CANCEL success — id=${id} cc=${cc}`);
    return result;
  }

  /* ───────── MARK AS PRINTED (admin) ───────── */

  async markAsPrinted(id: string) {
    this.logger.log(`MARK AS PRINTED — id=${id}`);

    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: INCLUDE_RELATIONS,
    });

    if (!reservation) {
      this.logger.warn(`MARK AS PRINTED rejected — id=${id} not found`);
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.printedAt) {
      return reservation;
    }

    return await this.prisma.reservation.update({
      where: { id },
      data: {
        printedAt: nowColombia(),
        ...colombiaUpdatedAt(),
      },
      include: INCLUDE_RELATIONS,
    });
  }

  /* ───────── DELETE (public) ───────── */

  async delete(id: string, cc: string) {
    cc = cc.trim();
    this.logger.log(`DELETE reservation — id=${id} cc=${cc}`);

    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      select: { id: true, cc: true },
    });

    if (!reservation) {
      this.logger.warn(`DELETE rejected — id=${id} not found`);
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.cc !== cc) {
      this.logger.warn(`DELETE rejected — id=${id} cc=${cc} ownership mismatch`);
      throw new ForbiddenException('This reservation does not belong to the provided CC');
    }

    await this.prisma.reservation.delete({ where: { id } });
    this.logger.log(`DELETE success — id=${id}`);
    return { deleted: true, id };
  }

  /* ───────── LIST ALL (admin) ───────── */

  async findAll(params: { skip?: number; take?: number; date?: string }) {
    const { skip = 0, take = 500, date } = params;

    if (take > 1000) throw new BadRequestException('take max is 1000');

    return this.prisma.reservation.findMany({
      where: date
        ? { menu: { date: new Date(date + 'T00:00:00Z') } }
        : undefined,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: INCLUDE_RELATIONS,
    });
  }

  /* ───────── LIST BY CC (user) ───────── */

  async findByCC(cc: string, date?: string) {
    cc = cc.trim();

    const where: { cc: string; menu?: { date: Date } } = { cc };
    if (date) {
      where.menu = { date: new Date(date + 'T00:00:00Z') };
    } else {
      where.menu = { date: new Date(todayColombia() + 'T00:00:00Z') };
    }

    return this.prisma.reservation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: INCLUDE_RELATIONS,
    });
  }

  /* ───────── LIST BY MENU ID (admin) ───────── */

  async findByMenuId(menuId: string) {
    return this.prisma.reservation.findMany({
      where: { menuId },
      orderBy: { createdAt: 'desc' },
      include: INCLUDE_RELATIONS,
    });
  }

  /* ───────── SUMMARY BY DATE (restaurant) ───────── */

  async findSummaryByDate(dateStr: string) {
    const menu = await this.prisma.menu.findUnique({
      where: { date: new Date(dateStr + 'T00:00:00Z') },
      select: { id: true },
    });

    if (!menu) throw new NotFoundException('No menu found for this date');

    const reservations = await this.prisma.reservation.findMany({
      where: { menuId: menu.id },
      select: {
        proteinTypeId: true,
        proteinType: { select: { name: true } },
        status: true,
      },
    });

    // Determine global status from reservations
    const statuses = new Set(reservations.map((r: { status: string }) => r.status));
    let globalStatus = 'SIN_RESERVAS';
    if (statuses.has('SERVIDA')) globalStatus = 'SERVIDA';
    else if (statuses.has('RESERVADA') || statuses.has('AUTO_ASIGNADA'))
      globalStatus = 'RESERVADA';
    else if (statuses.has('CANCELADA')) globalStatus = 'CANCELADA';

    // Group by protein type (exclude CANCELADA from counts)
    const map = new Map<
      string,
      { proteinTypeId: string; proteinName: string; count: number }
    >();

    for (const r of reservations) {
      if (r.status === 'CANCELADA') continue;
      const key = r.proteinTypeId;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, {
          proteinTypeId: key,
          proteinName: r.proteinType.name,
          count: 1,
        });
      }
    }

    return {
      date: dateStr,
      status: globalStatus,
      proteins: Array.from(map.values()).sort((a, b) => b.count - a.count),
    };
  }

  /* ───────── BULK MARK SERVED (admin) ───────── */

  async bulkMarkServed(dateStr: string) {
    this.logger.log(`BULK-SERVED — date=${dateStr}`);
    const menu = await this.prisma.menu.findUnique({
      where: { date: new Date(dateStr + 'T00:00:00Z') },
      select: { id: true },
    });

    if (!menu) {
      this.logger.warn(`BULK-SERVED rejected — no menu for date=${dateStr}`);
      throw new NotFoundException('No menu found for this date');
    }

    const now = nowColombia();
    const result = await this.prisma.reservation.updateMany({
      where: {
        menuId: menu.id,
        status: { not: 'CANCELADA' },
      },
      data: {
        status: 'SERVIDA',
        servedAt: now,
        updatedAt: now,
      },
    });

    this.logger.log(
      `BULK-SERVED success — date=${dateStr} updated=${result.count}`,
    );
    return { date: dateStr, status: 'SERVIDA', updated: result.count };
  }

  /* ───────── BULK MARK CANCELLED (admin) ───────── */

  async bulkMarkCancelled(dateStr: string) {
    this.logger.log(`BULK-CANCELLED — date=${dateStr}`);
    const menu = await this.prisma.menu.findUnique({
      where: { date: new Date(dateStr + 'T00:00:00Z') },
      select: { id: true },
    });

    if (!menu) {
      this.logger.warn(`BULK-CANCELLED rejected — no menu for date=${dateStr}`);
      throw new NotFoundException('No menu found for this date');
    }

    const now = nowColombia();
    const result = await this.prisma.reservation.updateMany({
      where: {
        menuId: menu.id,
        status: { notIn: ['CANCELADA', 'SERVIDA'] },
      },
      data: {
        status: 'CANCELADA',
        updatedAt: now,
      },
    });

    this.logger.log(
      `BULK-CANCELLED success — date=${dateStr} updated=${result.count}`,
    );
    return { date: dateStr, status: 'CANCELADA', updated: result.count };
  }
}
