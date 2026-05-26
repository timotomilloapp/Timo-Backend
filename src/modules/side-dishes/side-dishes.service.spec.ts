import { Test, TestingModule } from '@nestjs/testing';
import { SideDishesService } from './side-dishes.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

/* ───────── Prisma mock ───────── */
const mockPrisma = () => ({
  sideDish: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
});

type MockPrisma = ReturnType<typeof mockPrisma>;

const fakeSideDish = (
  overrides: Record<string, string | boolean | Date> = {},
) => ({
  id: 'sd-1',
  name: 'Arroz blanco',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('SideDishesService', () => {
  let service: SideDishesService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SideDishesService,
        { provide: PrismaService, useFactory: mockPrisma },
      ],
    }).compile();

    service = module.get<SideDishesService>(SideDishesService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  /* ═══════════════════════════════════════════════
   *  CREATE
   * ═══════════════════════════════════════════════ */
  describe('create', () => {
    it('should create a side dish and return it', async () => {
      const sd = fakeSideDish();
      prisma.sideDish.create.mockResolvedValue(sd);

      const result = await service.create({ name: 'Arroz blanco' });

      expect(result).toEqual(sd);
      expect(prisma.sideDish.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Arroz blanco',
            isActive: true,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should trim the name', async () => {
      prisma.sideDish.create.mockResolvedValue(fakeSideDish());

      await service.create({ name: '  Arroz blanco  ' });

      expect(prisma.sideDish.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Arroz blanco' }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('should allow setting isActive to false', async () => {
      prisma.sideDish.create.mockResolvedValue(
        fakeSideDish({ isActive: false }),
      );

      await service.create({ name: 'Arroz blanco', isActive: false });

      expect(prisma.sideDish.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('should throw ConflictException on duplicate name (P2002)', async () => {
      prisma.sideDish.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create({ name: 'Arroz blanco' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should rethrow non-P2002 errors', async () => {
      prisma.sideDish.create.mockRejectedValue(new Error('DB down'));

      await expect(service.create({ name: 'Arroz blanco' })).rejects.toThrow(
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
        fakeSideDish(),
        fakeSideDish({ id: 'sd-2', name: 'Ensalada' }),
      ];
      prisma.sideDish.findMany.mockResolvedValue(items);

      const result = await service.findAll({});

      expect(result).toEqual(items);
      expect(prisma.sideDish.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 }),
      );
    });

    it('should filter by search query', async () => {
      prisma.sideDish.findMany.mockResolvedValue([]);

      await service.findAll({ q: 'arroz' });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const call = prisma.sideDish.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(call.where).toHaveProperty('name', {
        contains: 'arroz',
        mode: 'insensitive',
      });
    });

    it('should filter by active status', async () => {
      prisma.sideDish.findMany.mockResolvedValue([]);

      await service.findAll({ active: false });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const call = prisma.sideDish.findMany.mock.calls[0][0] as {
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
    it('should return a side dish by id', async () => {
      const sd = fakeSideDish();
      prisma.sideDish.findUnique.mockResolvedValue(sd);

      expect(await service.findOne('sd-1')).toEqual(sd);
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.sideDish.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  /* ═══════════════════════════════════════════════
   *  TOGGLE
   * ═══════════════════════════════════════════════ */
  describe('toggle', () => {
    it('should set isActive to false if true', async () => {
      prisma.sideDish.findUnique.mockResolvedValue({
        id: 'sd-1',
        isActive: true,
      });
      const updated = fakeSideDish({ isActive: false });
      prisma.sideDish.update.mockResolvedValue(updated);

      const result = await service.toggle('sd-1');

      expect(result).toEqual(updated);
      expect(prisma.sideDish.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.sideDish.findUnique.mockResolvedValue(null);

      await expect(service.toggle('nope')).rejects.toThrow(NotFoundException);
    });
  });

  /* ═══════════════════════════════════════════════
   *  DELETE
   * ═══════════════════════════════════════════════ */
  describe('delete', () => {
    it('should delete and return { deleted: true, id }', async () => {
      prisma.sideDish.findUnique.mockResolvedValue({ id: 'sd-1' });
      prisma.sideDish.delete.mockResolvedValue(undefined);

      expect(await service.delete('sd-1')).toEqual({
        deleted: true,
        id: 'sd-1',
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.sideDish.findUnique.mockResolvedValue(null);

      await expect(service.delete('nope')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when referenced (P2003)', async () => {
      prisma.sideDish.findUnique.mockResolvedValue({ id: 'sd-1' });
      prisma.sideDish.delete.mockRejectedValue({ code: 'P2003' });

      await expect(service.delete('sd-1')).rejects.toThrow(ConflictException);
    });

    it('should rethrow non-P2003 errors', async () => {
      prisma.sideDish.findUnique.mockResolvedValue({ id: 'sd-1' });
      prisma.sideDish.delete.mockRejectedValue(new Error('Unexpected'));

      await expect(service.delete('sd-1')).rejects.toThrow('Unexpected');
    });
  });
});
