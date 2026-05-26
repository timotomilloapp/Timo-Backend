import { Test, TestingModule } from '@nestjs/testing';
import { DrinksService } from './drinks.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

/* ───────── Prisma mock ───────── */
const mockPrisma = () => ({
  drink: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
});

type MockPrisma = ReturnType<typeof mockPrisma>;

const fakeDrink = (
  overrides: Record<string, string | boolean | Date> = {},
) => ({
  id: 'drink-1',
  name: 'Limonada',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('DrinksService', () => {
  let service: DrinksService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrinksService,
        { provide: PrismaService, useFactory: mockPrisma },
      ],
    }).compile();

    service = module.get<DrinksService>(DrinksService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  /* ═══════════════════════════════════════════════
   *  CREATE
   * ═══════════════════════════════════════════════ */
  describe('create', () => {
    it('should create a drink and return it', async () => {
      const drink = fakeDrink();
      prisma.drink.create.mockResolvedValue(drink);

      const result = await service.create({ name: 'Limonada' });

      expect(result).toEqual(drink);
      expect(prisma.drink.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Limonada',
            isActive: true,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should trim the name', async () => {
      prisma.drink.create.mockResolvedValue(fakeDrink());

      await service.create({ name: '  Limonada  ' });

      expect(prisma.drink.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Limonada' }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('should allow setting isActive to false', async () => {
      prisma.drink.create.mockResolvedValue(fakeDrink({ isActive: false }));

      await service.create({ name: 'Limonada', isActive: false });

      expect(prisma.drink.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('should throw ConflictException on duplicate name (P2002)', async () => {
      prisma.drink.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create({ name: 'Limonada' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should rethrow non-P2002 errors', async () => {
      prisma.drink.create.mockRejectedValue(new Error('DB down'));

      await expect(service.create({ name: 'Limonada' })).rejects.toThrow(
        'DB down',
      );
    });
  });

  /* ═══════════════════════════════════════════════
   *  FIND ALL
   * ═══════════════════════════════════════════════ */
  describe('findAll', () => {
    it('should return list with default pagination', async () => {
      const items = [
        fakeDrink(),
        fakeDrink({ id: 'drink-2', name: 'Jugo de mora' }),
      ];
      prisma.drink.findMany.mockResolvedValue(items);

      const result = await service.findAll({});

      expect(result).toEqual(items);
      expect(prisma.drink.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 }),
      );
    });

    it('should filter by search query', async () => {
      prisma.drink.findMany.mockResolvedValue([]);

      await service.findAll({ q: 'limon' });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const call = prisma.drink.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(call.where).toHaveProperty('name', {
        contains: 'limon',
        mode: 'insensitive',
      });
    });

    it('should filter by active status', async () => {
      prisma.drink.findMany.mockResolvedValue([]);

      await service.findAll({ active: false });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const call = prisma.drink.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(call.where).toHaveProperty('isActive', false);
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
    it('should return a drink by id', async () => {
      const drink = fakeDrink();
      prisma.drink.findUnique.mockResolvedValue(drink);

      expect(await service.findOne('drink-1')).toEqual(drink);
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.drink.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  /* ═══════════════════════════════════════════════
   *  TOGGLE
   * ═══════════════════════════════════════════════ */
  describe('toggle', () => {
    it('should set isActive to false if true', async () => {
      prisma.drink.findUnique.mockResolvedValue({
        id: 'drink-1',
        isActive: true,
      });
      const updated = fakeDrink({ isActive: false });
      prisma.drink.update.mockResolvedValue(updated);

      const result = await service.toggle('drink-1');

      expect(result).toEqual(updated);
      expect(prisma.drink.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.drink.findUnique.mockResolvedValue(null);

      await expect(service.toggle('nope')).rejects.toThrow(NotFoundException);
    });
  });

  /* ═══════════════════════════════════════════════
   *  DELETE
   * ═══════════════════════════════════════════════ */
  describe('delete', () => {
    it('should delete and return { deleted: true, id }', async () => {
      prisma.drink.findUnique.mockResolvedValue({ id: 'drink-1' });
      prisma.drink.delete.mockResolvedValue(undefined);

      expect(await service.delete('drink-1')).toEqual({
        deleted: true,
        id: 'drink-1',
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.drink.findUnique.mockResolvedValue(null);

      await expect(service.delete('nope')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when referenced (P2003)', async () => {
      prisma.drink.findUnique.mockResolvedValue({ id: 'drink-1' });
      prisma.drink.delete.mockRejectedValue({ code: 'P2003' });

      await expect(service.delete('drink-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should rethrow non-P2003 errors', async () => {
      prisma.drink.findUnique.mockResolvedValue({ id: 'drink-1' });
      prisma.drink.delete.mockRejectedValue(new Error('Unexpected'));

      await expect(service.delete('drink-1')).rejects.toThrow('Unexpected');
    });
  });
});
