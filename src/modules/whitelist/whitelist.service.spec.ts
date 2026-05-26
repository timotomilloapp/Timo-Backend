import { Test, TestingModule } from '@nestjs/testing';
import { WhitelistService } from './whitelist.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';

/* ───────── Prisma mock factory ───────── */
const mockPrisma = () => {
  const txMock = {
    whitelistEntry: {
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  return {
    whitelistEntry: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
    },
    area: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(async (arg) => {
      if (typeof arg === 'function') {
        return arg(txMock);
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    }),
    _txMock: txMock, // Expose inner mock for assertions
  };
};

type MockPrisma = ReturnType<typeof mockPrisma>;

/* ───────── Minimal typings to satisfy eslint ───────── */
type WhitelistFindManyArgs = {
  skip?: number;
  take?: number;
  where?: {
    enabled?: boolean;
    OR?: Array<{
      name?: { contains: string; mode: 'insensitive' };
      cc?: { contains: string; mode: 'insensitive' };
    }>;
  };
};

type WhitelistEntry = {
  id: string;
  cc: string;
  name: string;
  enabled: boolean;
  publicToken: string;
  birthdate?: Date | null;
  areaId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type DeleteResult = { deleted: true; id: string };

type BulkCreateResult = {
  created: number;
  skipped: number;
  errors: unknown[];
};

/* ───────── Helpers ───────── */
const asUnknown = <T>(v: unknown): T => v as T;

const makeFakeEntry = (
  overrides: Partial<WhitelistEntry> = {},
): WhitelistEntry => ({
  id: 'uuid-1',
  cc: '123456',
  name: 'John Doe',
  enabled: true,
  publicToken: 'tok-abc',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('WhitelistService', () => {
  let service: WhitelistService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhitelistService,
        { provide: PrismaService, useFactory: mockPrisma },
      ],
    }).compile();

    service = module.get<WhitelistService>(WhitelistService);
    prisma = module.get<MockPrisma>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  /* ═══════════════════════════════════════════════
   *  CREATE
   * ═══════════════════════════════════════════════ */
  describe('create', () => {
    it('should create a whitelist entry and return it', async () => {
      const entry: WhitelistEntry = makeFakeEntry();
      prisma.whitelistEntry.create.mockResolvedValue(entry);

      const result = asUnknown<WhitelistEntry>(
        await service.create({
          cc: '123456',
          name: 'John Doe',
        }),
      );

      expect(result).toEqual(entry);
      expect(prisma.whitelistEntry.create).toHaveBeenCalledTimes(1);
      expect(prisma.whitelistEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            cc: '123456',
            name: 'John Doe',
          }),
        }),
      );
    });

    it('should trim cc and name before creating', async () => {
      const entry: WhitelistEntry = makeFakeEntry();
      prisma.whitelistEntry.create.mockResolvedValue(entry);

      await service.create({ cc: '  123456  ', name: '  John Doe  ' });

      expect(prisma.whitelistEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            cc: '123456',
            name: 'John Doe',
          }),
        }),
      );
    });

    it('should throw ConflictException on duplicate cc (P2002)', async () => {
      prisma.whitelistEntry.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.create({ cc: '123456', name: 'John Doe' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if Area does not exist', async () => {
      prisma.area.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ cc: '123456', name: 'John Doe', areaId: 'nope' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if Area is inactive', async () => {
      prisma.area.findUnique.mockResolvedValue({
        id: 'area-1',
        isActive: false,
      });

      await expect(
        service.create({ cc: '123456', name: 'John Doe', areaId: 'area-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create entry with areaId and birthdate', async () => {
      prisma.area.findUnique.mockResolvedValue({
        id: 'area-1',
        isActive: true,
      });
      const entry: WhitelistEntry = makeFakeEntry({
        birthdate: new Date('1995-10-15T00:00:00Z'),
        areaId: 'area-1',
      });
      prisma.whitelistEntry.create.mockResolvedValue(entry);

      const result = asUnknown<WhitelistEntry>(
        await service.create({
          cc: '123456',
          name: 'John Doe',
          birthdate: '1995-10-15',
          areaId: 'area-1',
        }),
      );

      expect(result.areaId).toBe('area-1');
      expect(prisma.whitelistEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            birthdate: new Date('1995-10-15T00:00:00Z'),
            areaId: 'area-1',
          }),
        }),
      );
    });

    it('should rethrow non-P2002 errors', async () => {
      const error = new Error('DB down');
      prisma.whitelistEntry.create.mockRejectedValue(error);

      await expect(
        service.create({ cc: '123456', name: 'John Doe' }),
      ).rejects.toThrow('DB down');
    });
  });

  /* ═══════════════════════════════════════════════
   *  FIND ALL
   * ═══════════════════════════════════════════════ */
  describe('findAll', () => {
    it('should return a list of entries with default pagination', async () => {
      const entries: WhitelistEntry[] = [
        makeFakeEntry(),
        makeFakeEntry({ id: 'uuid-2', cc: '789' }),
      ];
      prisma.whitelistEntry.findMany.mockResolvedValue(entries);
      prisma.whitelistEntry.count.mockResolvedValue(2);

      const result = await service.findAll({});

      expect(result).toEqual({ data: entries, total: 2 });
      expect(prisma.whitelistEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 }),
      );
    });

    it('should pass search query to where clause', async () => {
      prisma.whitelistEntry.findMany.mockResolvedValue([]);

      await service.findAll({ q: 'john' });

      const calls = asUnknown<Array<[WhitelistFindManyArgs]>>(
        prisma.whitelistEntry.findMany.mock.calls,
      );
      const [args] = calls[0];

      expect(args.where).toBeDefined();
      expect(args.where?.OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: { contains: 'john', mode: 'insensitive' },
          }),
          expect.objectContaining({
            cc: { contains: 'john', mode: 'insensitive' },
          }),
        ]),
      );
    });

    it('should filter by enabled when provided', async () => {
      prisma.whitelistEntry.findMany.mockResolvedValue([]);

      await service.findAll({ enabled: true });

      const calls = asUnknown<Array<[WhitelistFindManyArgs]>>(
        prisma.whitelistEntry.findMany.mock.calls,
      );
      const [args] = calls[0];

      expect(args.where).toBeDefined();
      expect(args.where?.enabled).toBe(true);
    });

    it('should throw BadRequestException when take > 200', async () => {
      await expect(service.findAll({ take: 201 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  /* ═══════════════════════════════════════════════
   *  FIND ONE
   * ═══════════════════════════════════════════════ */
  describe('findOne', () => {
    it('should return a single entry by id', async () => {
      const entry: WhitelistEntry = makeFakeEntry();
      prisma.whitelistEntry.findUnique.mockResolvedValue(entry);

      const result = asUnknown<WhitelistEntry>(await service.findOne('uuid-1'));

      expect(result).toEqual(entry);
      expect(prisma.whitelistEntry.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'uuid-1' } }),
      );
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  /* ═══════════════════════════════════════════════
   *  UPDATE
   * ═══════════════════════════════════════════════ */
  describe('update', () => {
    it('should update cc and name', async () => {
      const entry: WhitelistEntry = makeFakeEntry({
        cc: '999',
        name: 'Updated',
      });
      prisma.whitelistEntry.findUnique.mockResolvedValue({ id: 'uuid-1' });
      prisma.whitelistEntry.update.mockResolvedValue(entry);

      const result = asUnknown<WhitelistEntry>(
        await service.update('uuid-1', {
          cc: '999',
          name: 'Updated',
        }),
      );

      expect(result).toEqual(entry);
      expect(prisma.whitelistEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'uuid-1' },
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({ cc: '999', name: 'Updated' }),
        }),
      );
    });

    it('should trim values before updating', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue({ id: 'uuid-1' });
      prisma.whitelistEntry.update.mockResolvedValue(makeFakeEntry());

      await service.update('uuid-1', { cc: '  999  ', name: '  Updated  ' });

      expect(prisma.whitelistEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({ cc: '999', name: 'Updated' }),
        }),
      );
    });

    it('should throw BadRequestException when no fields provided', async () => {
      await expect(service.update('uuid-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { cc: '999' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on duplicate cc (P2002)', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue({ id: 'uuid-1' });
      prisma.whitelistEntry.update.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.update('uuid-1', { cc: 'duplicate-cc' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException on update if Area does not exist', async () => {
      prisma.area.findUnique.mockResolvedValue(null);

      await expect(
        service.update('uuid-1', { areaId: 'nope' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException on update if Area is inactive', async () => {
      prisma.area.findUnique.mockResolvedValue({
        id: 'area-1',
        isActive: false,
      });

      await expect(
        service.update('uuid-1', { areaId: 'area-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update birthdate and areaId', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue({ id: 'uuid-1' });
      prisma.area.findUnique.mockResolvedValue({
        id: 'area-1',
        isActive: true,
      });
      const entry: WhitelistEntry = makeFakeEntry({
        birthdate: new Date('1995-10-15T00:00:00Z'),
        areaId: 'area-1',
      });
      prisma.whitelistEntry.update.mockResolvedValue(entry);

      const result = asUnknown<WhitelistEntry>(
        await service.update('uuid-1', {
          birthdate: '1995-10-15',
          areaId: 'area-1',
        }),
      );

      expect(prisma.whitelistEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'uuid-1' },
          data: expect.objectContaining({
            birthdate: new Date('1995-10-15T00:00:00Z'),
            areaId: 'area-1',
          }),
        }),
      );
    });
  });

  /* ═══════════════════════════════════════════════
   *  DEACTIVATE (toggle enabled)
   * ═══════════════════════════════════════════════ */
  describe('deactivate', () => {
    it('should toggle enabled from true to false', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue({
        id: 'uuid-1',
        enabled: true,
      });
      const updated: WhitelistEntry = makeFakeEntry({ enabled: false });
      prisma.whitelistEntry.update.mockResolvedValue(updated);

      const result = asUnknown<WhitelistEntry>(
        await service.deactivate('uuid-1'),
      );

      expect(result).toEqual(updated);
      expect(prisma.whitelistEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({ enabled: false }),
        }),
      );
    });

    it('should toggle enabled from false to true', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue({
        id: 'uuid-1',
        enabled: false,
      });
      const updated: WhitelistEntry = makeFakeEntry({ enabled: true });
      prisma.whitelistEntry.update.mockResolvedValue(updated);

      const result = asUnknown<WhitelistEntry>(
        await service.deactivate('uuid-1'),
      );

      expect(result).toEqual(updated);
      expect(prisma.whitelistEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({ enabled: true }),
        }),
      );
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  /* ═══════════════════════════════════════════════
   *  DELETE
   * ═══════════════════════════════════════════════ */
  describe('delete', () => {
    it('should delete and return { deleted: true, id }', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue({ id: 'uuid-1' });
      prisma.whitelistEntry.delete.mockResolvedValue(undefined);

      const result = asUnknown<DeleteResult>(await service.delete('uuid-1'));

      expect(result).toEqual({ deleted: true, id: 'uuid-1' });
      expect(prisma.whitelistEntry.delete).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
      });
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when referenced by reservations (P2003)', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue({ id: 'uuid-1' });
      prisma.whitelistEntry.delete.mockRejectedValue({ code: 'P2003' });

      await expect(service.delete('uuid-1')).rejects.toThrow(ConflictException);
    });

    it('should rethrow non-P2003 errors', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue({ id: 'uuid-1' });
      const error = new Error('Unexpected');
      prisma.whitelistEntry.delete.mockRejectedValue(error);

      await expect(service.delete('uuid-1')).rejects.toThrow('Unexpected');
    });
  });

  /* ═══════════════════════════════════════════════
   *  BULK CREATE (BULK UPSERT)
   * ═══════════════════════════════════════════════ */
  describe('bulkCreate', () => {
    function makeXlsxBuffer(
      rows: Array<Record<string, string | Date | number>>,
    ): Buffer {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

      const out: unknown = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      if (Buffer.isBuffer(out)) return out;
      if (out instanceof ArrayBuffer) return Buffer.from(out);
      if (ArrayBuffer.isView(out)) return Buffer.from(out.buffer);

      return Buffer.from(String(out));
    }

    it('should bulk create entries from xlsx buffer', async () => {
      prisma.whitelistEntry.findMany.mockResolvedValue([]);
      prisma.area.findMany.mockResolvedValue([
        { id: 'area-1', name: 'Pintura' },
      ]);
      prisma._txMock.whitelistEntry.createMany.mockResolvedValue({ count: 2 });

      const buffer = makeXlsxBuffer([
        { cc: '111', name: 'Alice', area: 'Pintura', birthdate: '1995-10-15' },
        { cc: '222', name: 'Bob' },
      ]);

      const result = asUnknown<any>(await service.bulkCreate(buffer));

      expect(result.created).toBe(2);
      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(prisma._txMock.whitelistEntry.createMany).toHaveBeenCalledTimes(1);
    });

    it('should report validation errors for invalid rows', async () => {
      prisma.whitelistEntry.findMany.mockResolvedValue([]);
      prisma.area.findMany.mockResolvedValue([]);
      prisma._txMock.whitelistEntry.createMany.mockResolvedValue({ count: 1 });

      const buffer = makeXlsxBuffer([
        { cc: '', name: 'No CC' },
        { cc: '333', name: '' },
        { cc: '444', name: 'Valid Entry' },
      ]);

      const result = asUnknown<any>(await service.bulkCreate(buffer));

      expect(result.errors).toHaveLength(2);
      expect(result.created).toBe(1);
    });

    it('should return zero created when all rows are invalid', async () => {
      const buffer = makeXlsxBuffer([
        { cc: '', name: '' },
        { cc: 'x', name: 'y' },
      ]);

      const result = asUnknown<any>(await service.bulkCreate(buffer));

      expect(result.created).toBe(0);
      expect(prisma._txMock.whitelistEntry.createMany).not.toHaveBeenCalled();
    });

    it('should perform upserts on existing CCs correctly', async () => {
      prisma.whitelistEntry.findMany.mockResolvedValue([
        { cc: '111', id: 'uuid-existing-alice' },
      ]);
      prisma.area.findMany.mockResolvedValue([]);
      prisma._txMock.whitelistEntry.createMany.mockResolvedValue({ count: 1 });
      prisma._txMock.whitelistEntry.update.mockResolvedValue({});

      const buffer = makeXlsxBuffer([
        { cc: '111', name: 'Alice Updated', birthdate: '1995-12-25' },
        { cc: '222', name: 'Bob' },
      ]);

      const result = asUnknown<any>(await service.bulkCreate(buffer));

      expect(result.created).toBe(1);
      expect(result.updated).toBe(1);
      expect(prisma._txMock.whitelistEntry.update).toHaveBeenCalledTimes(1);
      expect(prisma._txMock.whitelistEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'uuid-existing-alice' },
          data: expect.objectContaining({
            name: 'Alice Updated',
            birthdate: new Date('1995-12-25T00:00:00Z'),
          }),
        }),
      );
    });
  });
});
