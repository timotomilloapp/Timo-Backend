import { Test, TestingModule } from '@nestjs/testing';
import { AppetizersService } from './appetizers.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { tomorrowColombia } from '../../common/date.util';

/* ───────── Prisma mock ───────── */
const mockPrisma = () => ({
  appetizer: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  area: {
    findUnique: jest.fn(),
  },
});

type MockPrisma = ReturnType<typeof mockPrisma>;

const fakeAppetizer = (
  overrides: Record<string, string | number | boolean | Date | object> = {},
) => ({
  id: 'appetizer-1',
  quantity: 10,
  areaId: 'area-1',
  date: new Date(tomorrowColombia() + 'T00:00:00Z'),
  observations: 'Some observations',
  status: 'PENDIENTE',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  area: {
    id: 'area-1',
    name: 'Pintura',
    isActive: true,
  },
  ...overrides,
});

describe('AppetizersService', () => {
  let service: AppetizersService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppetizersService,
        { provide: PrismaService, useFactory: mockPrisma },
      ],
    }).compile();

    service = module.get<AppetizersService>(AppetizersService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  /* ═══════════════════════════════════════════════
   *  CREATE
   * ═══════════════════════════════════════════════ */
  describe('create', () => {
    it('should create an appetizer and return it', async () => {
      prisma.area.findUnique.mockResolvedValue({
        id: 'area-1',
        isActive: true,
      });
      const appetizer = fakeAppetizer();
      prisma.appetizer.create.mockResolvedValue(appetizer);

      const result = await service.create({
        quantity: 10,
        areaId: 'area-1',
        date: tomorrowColombia(),
        observations: 'Some observations',
      });

      expect(result).toEqual(appetizer);
      expect(prisma.area.findUnique).toHaveBeenCalledWith({
        where: { id: 'area-1' },
        select: { id: true, isActive: true },
      });
      expect(prisma.appetizer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantity: 10,
            areaId: 'area-1',
            date: new Date(tomorrowColombia() + 'T00:00:00Z'),
            observations: 'Some observations',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should throw NotFoundException if Area does not exist', async () => {
      prisma.area.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          quantity: 10,
          areaId: 'nope',
          date: tomorrowColombia(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if Area is inactive', async () => {
      prisma.area.findUnique.mockResolvedValue({
        id: 'area-1',
        isActive: false,
      });

      await expect(
        service.create({
          quantity: 10,
          areaId: 'area-1',
          date: tomorrowColombia(),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* ═══════════════════════════════════════════════
   *  FIND ALL
   * ═══════════════════════════════════════════════ */
  describe('findAll', () => {
    it('should return list with default pagination', async () => {
      const items = [fakeAppetizer()];
      prisma.appetizer.findMany.mockResolvedValue(items);

      const result = await service.findAll({});

      expect(result).toEqual(items);
      expect(prisma.appetizer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 }),
      );
    });

    it('should filter by areaId', async () => {
      prisma.appetizer.findMany.mockResolvedValue([]);

      await service.findAll({ areaId: 'area-1' });

      const call = prisma.appetizer.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(call.where).toHaveProperty('areaId', 'area-1');
    });

    it('should filter by date', async () => {
      prisma.appetizer.findMany.mockResolvedValue([]);

      await service.findAll({ date: tomorrowColombia() });

      const call = prisma.appetizer.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(call.where).toHaveProperty(
        'date',
        new Date(tomorrowColombia() + 'T00:00:00Z'),
      );
    });

    it('should filter by observations search query', async () => {
      prisma.appetizer.findMany.mockResolvedValue([]);

      await service.findAll({ q: 'some' });

      const call = prisma.appetizer.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(call.where).toHaveProperty('observations', {
        contains: 'some',
        mode: 'insensitive',
      });
    });

    it('should throw BadRequestException when take > 1000', async () => {
      await expect(service.findAll({ take: 1001 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  /* ═══════════════════════════════════════════════
   *  FIND ONE
   * ═══════════════════════════════════════════════ */
  describe('findOne', () => {
    it('should return an appetizer by id', async () => {
      const appetizer = fakeAppetizer();
      prisma.appetizer.findUnique.mockResolvedValue(appetizer);

      expect(await service.findOne('appetizer-1')).toEqual(appetizer);
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.appetizer.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  /* ═══════════════════════════════════════════════
   *  UPDATE
   * ═══════════════════════════════════════════════ */
  describe('update', () => {
    it('should update appetizer fields', async () => {
      prisma.appetizer.findUnique.mockResolvedValue({
        id: 'appetizer-1',
        date: new Date(tomorrowColombia() + 'T00:00:00Z'),
      });
      prisma.area.findUnique.mockResolvedValue({
        id: 'area-2',
        isActive: true,
      });
      const updated = fakeAppetizer({ quantity: 15, areaId: 'area-2' });
      prisma.appetizer.update.mockResolvedValue(updated);

      const result = await service.update('appetizer-1', {
        quantity: 15,
        areaId: 'area-2',
      });

      expect(result).toEqual(updated);
      expect(prisma.appetizer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'appetizer-1' },
          data: expect.objectContaining({
            quantity: 15,
            areaId: 'area-2',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should throw NotFoundException if appetizer does not exist', async () => {
      prisma.appetizer.findUnique.mockResolvedValue(null);

      await expect(service.update('nope', { quantity: 15 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if updated Area does not exist', async () => {
      prisma.appetizer.findUnique.mockResolvedValue({
        id: 'appetizer-1',
        date: new Date(tomorrowColombia() + 'T00:00:00Z'),
      });
      prisma.area.findUnique.mockResolvedValue(null);

      await expect(
        service.update('appetizer-1', { areaId: 'nope' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if updated Area is inactive', async () => {
      prisma.appetizer.findUnique.mockResolvedValue({
        id: 'appetizer-1',
        date: new Date(tomorrowColombia() + 'T00:00:00Z'),
      });
      prisma.area.findUnique.mockResolvedValue({
        id: 'area-2',
        isActive: false,
      });

      await expect(
        service.update('appetizer-1', { areaId: 'area-2' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* ═══════════════════════════════════════════════
   *  DELETE
   * ═══════════════════════════════════════════════ */
  describe('delete', () => {
    it('should delete and return true representation', async () => {
      prisma.appetizer.findUnique.mockResolvedValue({
        id: 'appetizer-1',
        date: new Date(tomorrowColombia() + 'T00:00:00Z'),
      });
      prisma.appetizer.delete.mockResolvedValue(undefined);

      expect(await service.delete('appetizer-1')).toEqual({
        deleted: true,
        id: 'appetizer-1',
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.appetizer.findUnique.mockResolvedValue(null);

      await expect(service.delete('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
