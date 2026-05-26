import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWhitelistDto } from './dto/create-whitelist.dto';
import { UpdateWhitelistDto } from './dto/update-whitelist.dto';
import * as XLSX from 'xlsx';
import { colombiaTimestamps, colombiaUpdatedAt } from '../../common/date.util';

const SELECT_FIELDS = {
  id: true,
  cc: true,
  name: true,
  enabled: true,
  publicToken: true,
  birthdate: true,
  areaId: true,
  area: {
    select: {
      id: true,
      name: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class WhitelistService {
  private readonly logger = new Logger(WhitelistService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWhitelistDto) {
    const cc = dto.cc?.trim();
    const name = dto.name?.trim();
    const birthdate = dto.birthdate
      ? new Date(dto.birthdate + 'T00:00:00Z')
      : null;
    const areaId = dto.areaId ?? null;

    if (areaId) {
      const area = await this.prisma.area.findUnique({
        where: { id: areaId },
        select: { id: true, isActive: true },
      });
      if (!area) throw new NotFoundException('Area not found');
      if (!area.isActive)
        throw new BadRequestException('Referenced area is inactive');
    }

    try {
      return await this.prisma.whitelistEntry.create({
        data: {
          cc,
          name,
          birthdate,
          areaId,
          ...colombiaTimestamps(),
        },
        select: SELECT_FIELDS,
      });
    } catch (e: unknown) {
      const error = e as { code?: string };
      if (error.code === 'P2002')
        throw new ConflictException(
          'Ya existe un empleado registrado con esta cédula',
        );
      throw e;
    }
  }

  async findAll(params: {
    q?: string;
    enabled?: boolean;
    skip?: number;
    take?: number;
  }) {
    const { q, enabled, skip = 0, take = 50 } = params;

    if (take > 200) throw new BadRequestException('take max is 200');

    const where = {
      ...(typeof enabled === 'boolean' ? { enabled } : {}),
      ...(q?.trim()
        ? {
            OR: [
              { name: { contains: q.trim(), mode: 'insensitive' as const } },
              { cc: { contains: q.trim(), mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.whitelistEntry.count({ where }),
      this.prisma.whitelistEntry.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take,
        select: SELECT_FIELDS,
      }),
    ]);

    return { data, total };
  }

  async login(cc: string) {
    const entry = await this.prisma.whitelistEntry.findUnique({
      where: { cc: cc.trim() },
      select: {
        publicToken: true,
        cc: true,
        name: true,
        enabled: true,
      },
    });

    if (!entry || !entry.enabled) {
      throw new UnauthorizedException(
        'Cédula no encontrada o inactiva en la lista de acceso',
      );
    }

    return {
      publicToken: entry.publicToken,
      cc: entry.cc,
      name: entry.name,
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.whitelistEntry.findUnique({
      where: { id },
      select: SELECT_FIELDS,
    });

    if (!item) throw new NotFoundException('Whitelist entry not found');
    return item;
  }

  async update(id: string, dto: UpdateWhitelistDto) {
    const data: Record<string, any> = {};
    if (dto.cc !== undefined) data.cc = dto.cc.trim();
    if (dto.name !== undefined) data.name = dto.name.trim();

    if (dto.birthdate !== undefined) {
      data.birthdate = dto.birthdate
        ? new Date(dto.birthdate + 'T00:00:00Z')
        : null;
    }

    if (dto.areaId !== undefined) {
      if (dto.areaId) {
        const area = await this.prisma.area.findUnique({
          where: { id: dto.areaId },
          select: { id: true, isActive: true },
        });
        if (!area) throw new NotFoundException('Area not found');
        if (!area.isActive)
          throw new BadRequestException('Referenced area is inactive');
      }
      data.areaId = dto.areaId;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException(
        'At least one field must be provided for update',
      );
    }

    const exists = await this.prisma.whitelistEntry.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Whitelist entry not found');

    try {
      return await this.prisma.whitelistEntry.update({
        where: { id },
        data: { ...data, ...colombiaUpdatedAt() },
        select: SELECT_FIELDS,
      });
    } catch (e: unknown) {
      const error = e as { code?: string };
      if (error.code === 'P2002')
        throw new ConflictException(
          'A whitelist entry with this cc already exists',
        );
      throw e;
    }
  }

  async deactivate(id: string) {
    const entry = await this.prisma.whitelistEntry.findUnique({
      where: { id },
      select: { id: true, enabled: true },
    });
    if (!entry) throw new NotFoundException('Whitelist entry not found');

    return this.prisma.whitelistEntry.update({
      where: { id },
      data: { enabled: !entry.enabled, ...colombiaUpdatedAt() },
      select: SELECT_FIELDS,
    });
  }

  async delete(id: string) {
    const exists = await this.prisma.whitelistEntry.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Whitelist entry not found');

    try {
      await this.prisma.whitelistEntry.delete({ where: { id } });
      return { deleted: true, id };
    } catch (e: unknown) {
      const error = e as { code?: string };
      if (error.code === 'P2003') {
        throw new ConflictException(
          'Cannot delete: whitelist entry is referenced by reservations. Deactivate it instead.',
        );
      }
      throw e;
    }
  }

  async bulkCreate(buffer: Buffer) {
    this.logger.log('Starting bulk whitelist creation process');
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
    });

    if (rows.length === 0) {
      this.logger.warn('Bulk upload failed: Empty file or invalid format');
      throw new BadRequestException(
        'El archivo está vacío o no tiene formato válido de tabla.',
      );
    }

    // Check headers intuitively by sampling the first row keys
    const firstRow = rows[0];
    const keys = Object.keys(firstRow);
    const ccKey = keys.find((key) => key.toLowerCase() === 'cc');
    const nameKey = keys.find(
      (key) => key.toLowerCase() === 'name' || key.toLowerCase() === 'nombre',
    );

    if (!ccKey || !nameKey) {
      this.logger.warn('Bulk upload failed: Missing required columns');
      throw new BadRequestException(
        'El archivo debe contener las columnas "cc" y "name" (o "nombre").',
      );
    }

    // Locate optional column keys
    const areaKey = keys.find(
      (key) =>
        key.toLowerCase() === 'area' ||
        key.toLowerCase() === 'área' ||
        key.toLowerCase() === 'nombre_area' ||
        key.toLowerCase() === 'area_name' ||
        key.toLowerCase() === 'areaname',
    );

    const birthdateKey = keys.find(
      (key) =>
        key.toLowerCase() === 'birthdate' ||
        key.toLowerCase() === 'fecha_nacimiento' ||
        key.toLowerCase() === 'nacimiento' ||
        key.toLowerCase() === 'cumpleaños' ||
        key.toLowerCase() === 'birth_date' ||
        key.toLowerCase() === 'birthdate',
    );

    this.logger.log(`Parsed ${rows.length} rows from uploaded file`);

    const errors: { row: number; cc: string; reason: string }[] = [];
    const validEntries: {
      cc: string;
      name: string;
      birthdate: Date | null;
      areaName: string;
      areaId: string | null;
    }[] = [];

    // Pre-fetch all areas to build cache
    const existingAreas = await this.prisma.area.findMany();
    const areaMap = new Map<string, string>(
      existingAreas.map((a) => [a.name.toLowerCase().trim(), a.id]),
    );

    const getAreaIdByName = async (
      areaName: string,
    ): Promise<string | null> => {
      const normalized = areaName.toLowerCase().trim();
      if (!normalized) return null;

      if (areaMap.has(normalized)) {
        return areaMap.get(normalized)!;
      }

      try {
        const newArea = await this.prisma.area.create({
          data: {
            name: areaName.trim(),
            isActive: true,
            ...colombiaTimestamps(),
          },
          select: { id: true },
        });
        areaMap.set(normalized, newArea.id);
        return newArea.id;
      } catch (e) {
        const existing = await this.prisma.area.findUnique({
          where: { name: areaName.trim() },
          select: { id: true },
        });
        if (existing) {
          areaMap.set(normalized, existing.id);
          return existing.id;
        }
        return null;
      }
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cc = String(row[ccKey] ?? '').trim();
      const name = String(row[nameKey] ?? '').trim();
      const areaName = areaKey ? String(row[areaKey] ?? '').trim() : '';
      const rawBirthdate = birthdateKey ? row[birthdateKey] : null;

      if (!cc || cc.length < 2) {
        errors.push({
          row: i + 2,
          cc: cc || '(empty)',
          reason: 'Cédula faltante o muy corta (mínimo 2 caracteres)',
        });
        continue;
      }
      if (!name || name.length < 2) {
        errors.push({
          row: i + 2,
          cc,
          reason: 'Nombre faltante o muy corto (mínimo 2 caracteres)',
        });
        continue;
      }

      // Map area name to areaId
      let areaId: string | null = null;
      if (areaName) {
        areaId = await getAreaIdByName(areaName);
      }

      // Parse birthdate
      let birthdate: Date | null = null;
      if (rawBirthdate) {
        birthdate = parseBirthdate(rawBirthdate);
        if (!birthdate) {
          this.logger.warn(
            `Row ${i + 2}: CC=${cc} has invalid birthdate "${rawBirthdate}"`,
          );
        }
      }

      validEntries.push({
        cc,
        name,
        birthdate,
        areaName,
        areaId,
      });
    }

    if (validEntries.length === 0) {
      this.logger.warn(
        `Bulk process finished with 0 valid entries out of ${rows.length} total rows. Errors: ${errors.length}`,
      );
      return { created: 0, skipped: 0, errors, updated: 0 };
    }

    // Fetch all existing entries matching these CCs
    const targetCcs = validEntries.map((e) => e.cc);
    const existingEntries = await this.prisma.whitelistEntry.findMany({
      where: { cc: { in: targetCcs } },
      select: { id: true, cc: true },
    });

    const existingCcMap = new Map<string, string>(
      existingEntries.map((e) => [e.cc, e.id]),
    );

    const toCreate: any[] = [];
    const toUpdate: {
      id: string;
      name: string;
      birthdate: Date | null;
      areaId: string | null;
    }[] = [];

    const now = colombiaTimestamps();

    for (const entry of validEntries) {
      const existingId = existingCcMap.get(entry.cc);
      if (existingId) {
        toUpdate.push({
          id: existingId,
          name: entry.name,
          birthdate: entry.birthdate,
          areaId: entry.areaId,
        });
      } else {
        toCreate.push({
          cc: entry.cc,
          name: entry.name,
          birthdate: entry.birthdate,
          areaId: entry.areaId,
          enabled: true,
          ...now,
        });
      }
    }

    let createdCount = 0;
    let updatedCount = 0;

    await this.prisma.$transaction(async (tx) => {
      // 1. Bulk Create
      if (toCreate.length > 0) {
        const res = await tx.whitelistEntry.createMany({
          data: toCreate,
        });
        createdCount = res.count;
      }

      // 2. Individual Updates
      if (toUpdate.length > 0) {
        for (const item of toUpdate) {
          await tx.whitelistEntry.update({
            where: { id: item.id },
            data: {
              name: item.name,
              birthdate: item.birthdate,
              areaId: item.areaId,
              enabled: true,
              ...colombiaUpdatedAt(),
            },
          });
          updatedCount++;
        }
      }
    });

    this.logger.log(
      `Bulk process completed. Created: ${createdCount}, Updated: ${updatedCount}, Invalid Rows: ${errors.length}`,
    );

    return {
      created: createdCount,
      skipped: 0,
      errors,
      updated: updatedCount,
    };
  }
}

function parseBirthdate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      return val;
    }
  }
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) return date;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    let date = new Date(trimmed);
    if (!isNaN(date.getTime())) return date;

    const partsSlash = trimmed.split('/');
    if (partsSlash.length === 3) {
      const day = parseInt(partsSlash[0], 10);
      const month = parseInt(partsSlash[1], 10) - 1;
      const year = parseInt(partsSlash[2], 10);
      date = new Date(Date.UTC(year, month, day));
      if (!isNaN(date.getTime())) return date;
    }

    const partsDash = trimmed.split('-');
    if (partsDash.length === 3) {
      const day = parseInt(partsDash[0], 10);
      const month = parseInt(partsDash[1], 10) - 1;
      const year = parseInt(partsDash[2], 10);
      if (day < 32 && year > 1000) {
        date = new Date(Date.UTC(year, month, day));
        if (!isNaN(date.getTime())) return date;
      }
    }
  }
  return null;
}
