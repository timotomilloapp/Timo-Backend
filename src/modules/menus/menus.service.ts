import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { DayOfWeek, MenuStatus } from '@prisma/client';
import {
  isDateInPastColombia,
  colombiaTimestamps,
  colombiaUpdatedAt,
  todayColombia,
} from '../../common/date.util';

interface PrismaError {
  code?: string;
  stack?: string;
}

const DEFAULT_PROTEIN_TYPE_ID = '99dc22df-fdb4-4000-8e5e-30caab647b1d';

const DAY_MAP: DayOfWeek[] = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];

const INCLUDE_RELATIONS = {
  soup: { select: { id: true, name: true } },
  drink: { select: { id: true, name: true } },
  defaultProteinType: { select: { id: true, name: true } },
  proteinOptions: {
    select: {
      id: true,
      proteinTypeId: true,
      proteinType: { select: { id: true, name: true } },
    },
  },
  sideOptions: {
    select: {
      id: true,
      sideDishId: true,
      sideDish: { select: { id: true, name: true } },
    },
  },
} as const;

function deriveDayOfWeek(dateStr: string): DayOfWeek {
  const d = new Date(dateStr + 'T12:00:00Z');
  return DAY_MAP[d.getUTCDay()];
}

@Injectable()
export class MenusService {
  private readonly logger = new Logger(MenusService.name);

  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreateMenuDto) {
    this.logger.log(`CREATE menu — date=${dto.date}`);
    if (isDateInPastColombia(dto.date)) {
      throw new BadRequestException('Cannot create a menu for a past date');
    }

    const dayOfWeek = deriveDayOfWeek(dto.date);
    const defaultProteinTypeId =
      dto.defaultProteinTypeId ?? DEFAULT_PROTEIN_TYPE_ID;

    try {
      return await this.prisma.menu.create({
        data: {
          date: new Date(dto.date + 'T00:00:00Z'),
          dayOfWeek,
          soupId: dto.soupId ?? null,
          drinkId: dto.drinkId ?? null,
          defaultProteinTypeId,
          proteinOptions: dto.proteinOptionIds?.length
            ? {
              create: dto.proteinOptionIds.map((id) => ({
                proteinTypeId: id,
              })),
            }
            : undefined,
          sideOptions: dto.sideOptionIds?.length
            ? { create: dto.sideOptionIds.map((id) => ({ sideDishId: id })) }
            : undefined,
          ...colombiaTimestamps(),
        },
        include: INCLUDE_RELATIONS,
      });
    } catch (e: unknown) {
      const pe = e as PrismaError;
      if (pe.code === 'P2002') {
        this.logger.warn(`CREATE conflict — date=${dto.date} already exists`);
        throw new ConflictException('A menu for this date already exists');
      }
      if (pe.code === 'P2003') {
        this.logger.warn(
          `CREATE rejected — date=${dto.date} invalid references`,
        );
        throw new BadRequestException(
          'One or more referenced IDs (soup, drink, protein, side dish) do not exist',
        );
      }
      this.logger.error(`CREATE menu failed — date=${dto.date}`, pe.stack);
      throw e;
    }
    this.logger.log(`CREATE menu success — date=${dto.date}`);
  }

  async findAll(params: { skip?: number; take?: number; startDate?: string; endDate?: string }) {
    const { skip = 0, take = 50, startDate, endDate } = params;

    if (take > 200) throw new BadRequestException('take max is 200');

    const where: any = {};
    if (startDate) {
      where.date = { ...where.date, gte: new Date(startDate + 'T00:00:00Z') };
    }
    if (endDate) {
      where.date = { ...where.date, lte: new Date(endDate + 'T23:59:59Z') };
    }

    return this.prisma.menu.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take,
      include: INCLUDE_RELATIONS,
    });
  }

  async findOne(id: string) {
    const menu = await this.prisma.menu.findUnique({
      where: { id },
      include: INCLUDE_RELATIONS,
    });

    if (!menu) throw new NotFoundException('Menu not found');
    return menu;
  }

  async findByDate(dateStr: string) {
    const date = new Date(dateStr + 'T00:00:00Z');

    const menu = await this.prisma.menu.findUnique({
      where: { date },
      include: INCLUDE_RELATIONS,
    });

    if (!menu) throw new NotFoundException('No menu found for this date');
    return menu;
  }

  async findForUserByDate(dateStr: string, cc: string) {
    const menu = await this.findByDate(dateStr);

    const reservation = await this.prisma.reservation.findFirst({
      where: {
        menuId: menu.id,
        cc,
      },
      select: {
        id: true,
        proteinTypeId: true,
        printedAt: true,
      }
    });

    return {
      ...menu,
      hasReservation: !!reservation,
      reservationId: reservation ? reservation.id : null,
      reservedProteinId: reservation ? reservation.proteinTypeId : null,
      isPrinted: !!reservation?.printedAt,
    };
  }

  async clone(id: string, targetDateStr: string) {
    this.logger.log(`CLONE menu — source=${id} target=${targetDateStr}`);
    const source = await this.prisma.menu.findUnique({
      where: { id },
      include: {
        proteinOptions: { select: { proteinTypeId: true } },
        sideOptions: { select: { sideDishId: true } },
      },
    });

    if (!source) throw new NotFoundException('Source menu not found');

    if (isDateInPastColombia(targetDateStr)) {
      throw new BadRequestException(
        'Cannot clone a menu to a past date (Colombia timezone)',
      );
    }

    const dayOfWeek = deriveDayOfWeek(targetDateStr);

    try {
      return await this.prisma.menu.create({
        data: {
          date: new Date(targetDateStr + 'T00:00:00Z'),
          dayOfWeek,
          soupId: source.soupId,
          drinkId: source.drinkId,
          defaultProteinTypeId: source.defaultProteinTypeId,
          proteinOptions: source.proteinOptions.length
            ? {
              create: source.proteinOptions.map(
                (o: { proteinTypeId: string }) => ({
                  proteinTypeId: o.proteinTypeId,
                }),
              ),
            }
            : undefined,
          sideOptions: source.sideOptions.length
            ? {
              create: source.sideOptions.map(
                (o: { sideDishId: string }) => ({
                  sideDishId: o.sideDishId,
                }),
              ),
            }
            : undefined,
          ...colombiaTimestamps(),
        },
        include: INCLUDE_RELATIONS,
      });
    } catch (e: unknown) {
      const pe = e as PrismaError;
      if (pe.code === 'P2002') {
        this.logger.warn(
          `CLONE conflict — target=${targetDateStr} already exists`,
        );
        throw new ConflictException(
          'A menu for the target date already exists',
        );
      }
      this.logger.error(
        `CLONE failed — source=${id} target=${targetDateStr}`,
        pe.stack,
      );
      throw e;
    }
    this.logger.log(`CLONE success — source=${id} target=${targetDateStr}`);
  }

  async update(id: string, dto: UpdateMenuDto) {
    this.logger.log(`UPDATE menu — id=${id}`);
    const exists = await this.prisma.menu.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Menu not found');

    try {
      return await this.prisma.$transaction(async (tx: any) => {
        // Update scalar fields
        const data: Record<string, string | null | undefined> = {};
        if (dto.soupId !== undefined) data.soupId = dto.soupId;
        if (dto.drinkId !== undefined) data.drinkId = dto.drinkId;
        if (dto.defaultProteinTypeId !== undefined)
          data.defaultProteinTypeId = dto.defaultProteinTypeId;

        if (Object.keys(data).length > 0) {
          await tx.menu.update({
            where: { id },
            data: { ...data, ...colombiaUpdatedAt() },
          });
        }

        // Replace protein options (set-based)
        if (dto.proteinOptionIds !== undefined) {
          await tx.menuProteinOption.deleteMany({ where: { menuId: id } });
          if (dto.proteinOptionIds.length > 0) {
            await tx.menuProteinOption.createMany({
              data: dto.proteinOptionIds.map((proteinTypeId) => ({
                menuId: id,
                proteinTypeId,
              })),
            });
          }
        }

        // Replace side options (set-based)
        if (dto.sideOptionIds !== undefined) {
          await tx.menuSideOption.deleteMany({ where: { menuId: id } });
          if (dto.sideOptionIds.length > 0) {
            await tx.menuSideOption.createMany({
              data: dto.sideOptionIds.map((sideDishId) => ({
                menuId: id,
                sideDishId,
              })),
            });
          }
        }

        return tx.menu.findUnique({
          where: { id },
          include: INCLUDE_RELATIONS,
        });
      });
    } catch (e: unknown) {
      const pe = e as PrismaError;
      if (pe.code === 'P2002') {
        this.logger.warn(`UPDATE conflict — id=${id} duplicate option`);
        throw new ConflictException('Duplicate protein or side dish option');
      }
      if (pe.code === 'P2003') {
        this.logger.warn(`UPDATE rejected — id=${id} invalid references`);
        throw new BadRequestException(
          'One or more referenced IDs do not exist',
        );
      }
      this.logger.error(`UPDATE menu failed — id=${id}`, pe.stack);
      throw e;
    }
  }

  async updateStatus(id: string, status: MenuStatus) {
    this.logger.log(`UPDATE status — id=${id} status=${status}`);
    const exists = await this.prisma.menu.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Menu not found');

    return await this.prisma.menu.update({
      where: { id },
      data: { status, ...colombiaUpdatedAt() },
      include: INCLUDE_RELATIONS,
    });
  }

  async updateCurrentDayMenusStatus() {
    this.logger.log('UPDATE current day menus status to SERVED');
    const todayStr = todayColombia();
    const date = new Date(todayStr + 'T00:00:00Z');

    const result = await this.prisma.menu.updateMany({
      where: {
        date,
        status: MenuStatus.SCHEDULED,
      },
      data: {
        status: MenuStatus.SERVED,
        ...colombiaUpdatedAt(),
      },
    });

    this.logger.log(`Updated ${result.count} menu(s) to SERVED status for date=${todayStr}`);
    return result;
  }

  async delete(id: string) {
    this.logger.log(`DELETE menu — id=${id}`);
    const exists = await this.prisma.menu.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      this.logger.warn(`DELETE rejected — id=${id} not found`);
      throw new NotFoundException('Menu not found');
    }

    await this.prisma.menu.delete({ where: { id } });
    this.logger.log(`DELETE menu success — id=${id}`);
    return { deleted: true, id };
  }
}
