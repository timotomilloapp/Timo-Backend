import { Test, TestingModule } from '@nestjs/testing';
import { AppetizersService } from './appetizers.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { tomorrowColombia } from '../../common/date.util';

/* ───────── Prisma mock ───────── */
const mockPrisma = () => {
  const mock: any = {
    appetizer: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
    appetizerDetail: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    area: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
    },
  };
  mock.$transaction = jest.fn((cb) => cb(mock));
  return mock;
};

type MockPrisma = ReturnType<typeof mockPrisma>;

const fakeAppetizer = (
  overrides: Record<string, any> = {},
) => ({
  id: 'appetizer-1',
  quantity: 10,
  date: new Date(tomorrowColombia() + 'T00:00:00Z'),
  observations: 'Some observations',
  status: 'PENDIENTE',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  details: [
    {
      id: 'detail-1',
      appetizerId: 'appetizer-1',
      areaId: 'area-1',
      quantity: 10,
      area: {
        id: 'area-1',
        name: 'Pintura',
        isActive: true,
      },
    },
  ],
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
      prisma.appetizer.findUnique.mockResolvedValue(null);
      prisma.area.findMany.mockResolvedValue([
        { id: 'area-1', isActive: true },
      ]);
      const appetizer = fakeAppetizer();
      prisma.appetizer.create.mockResolvedValue(appetizer);

      const result = await service.create({
        date: tomorrowColombia(),
        observations: 'Some observations',
        details: [{ areaId: 'area-1', quantity: 10 }],
      });

      expect(result).toEqual(appetizer);
      expect(prisma.appetizer.findUnique).toHaveBeenCalledWith({
        where: { date: new Date(tomorrowColombia() + 'T00:00:00Z') },
        select: { id: true },
      });
      expect(prisma.area.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['area-1'] } },
        select: { id: true, isActive: true },
      });
    });

    it('should throw BadRequestException if appetizer already exists for date', async () => {
      prisma.appetizer.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({
          date: tomorrowColombia(),
          details: [{ areaId: 'area-1', quantity: 10 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if Area does not exist', async () => {
      prisma.appetizer.findUnique.mockResolvedValue(null);
      prisma.area.findMany.mockResolvedValue([]);

      await expect(
        service.create({
          date: tomorrowColombia(),
          details: [{ areaId: 'nope', quantity: 10 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if Area is inactive', async () => {
      prisma.appetizer.findUnique.mockResolvedValue(null);
      prisma.area.findMany.mockResolvedValue([
        { id: 'area-1', isActive: false },
      ]);

      await expect(
        service.create({
          date: tomorrowColombia(),
          details: [{ areaId: 'area-1', quantity: 10 }],
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

    it('should filter by areaId in details list', async () => {
      prisma.appetizer.findMany.mockResolvedValue([]);

      await service.findAll({ areaId: 'area-1' });

      const call = prisma.appetizer.findMany.mock.calls[0][0] as {
        where: Record<string, any>;
      };
      expect(call.where.details).toEqual({
        some: { areaId: 'area-1' },
      });
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
    it('should update appetizer fields without details', async () => {
      prisma.appetizer.findUnique.mockResolvedValue({
        id: 'appetizer-1',
        date: new Date(tomorrowColombia() + 'T00:00:00Z'),
      });
      prisma.profile.findUnique.mockResolvedValue({ role: 'USER' });
      const updated = fakeAppetizer({ observations: 'New observations' });
      prisma.appetizer.update.mockResolvedValue(updated);

      const result = await service.update('appetizer-1', {
        observations: 'New observations',
      }, 'user-1');

      expect(result).toEqual(updated);
      expect(prisma.appetizer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'appetizer-1' },
          data: expect.objectContaining({
            observations: 'New observations',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should update appetizer fields with details', async () => {
      prisma.appetizer.findUnique.mockResolvedValue({
        id: 'appetizer-1',
        date: new Date(tomorrowColombia() + 'T00:00:00Z'),
      });
      prisma.area.findMany.mockResolvedValue([
        { id: 'area-2', isActive: true },
      ]);
      prisma.profile.findUnique.mockResolvedValue({ role: 'USER' });
      const updated = fakeAppetizer({ quantity: 5 });
      prisma.appetizer.update.mockResolvedValue(updated);

      const result = await service.update('appetizer-1', {
        details: [{ areaId: 'area-2', quantity: 5 }],
      }, 'user-1');

      expect(result).toEqual(updated);
      expect(prisma.appetizerDetail.deleteMany).toHaveBeenCalledWith({
        where: { appetizerId: 'appetizer-1' },
      });
      expect(prisma.appetizerDetail.createMany).toHaveBeenCalledWith({
        data: [{ appetizerId: 'appetizer-1', areaId: 'area-2', quantity: 5 }],
      });
    });

    it('should throw NotFoundException if appetizer does not exist', async () => {
      prisma.appetizer.findUnique.mockResolvedValue(null);

      await expect(service.update('nope', { observations: 'test' }, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
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
      prisma.profile.findUnique.mockResolvedValue({ role: 'USER' });
      prisma.appetizer.delete.mockResolvedValue(undefined);

      expect(await service.delete('appetizer-1', 'user-1')).toEqual({
        deleted: true,
        id: 'appetizer-1',
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.appetizer.findUnique.mockResolvedValue(null);

      await expect(service.delete('nope', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });
});
