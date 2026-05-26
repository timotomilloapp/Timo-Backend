import { Test, TestingModule } from '@nestjs/testing';
import { ProteinsService } from './proteins.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

/* ───────── Prisma mock ───────── */
const mockPrisma = () => ({
  proteinType: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
});

type MockPrisma = ReturnType<typeof mockPrisma>;

const fakeProtein = (
  overrides: Record<string, string | boolean | Date> = {},
) => ({
  id: 'prot-1',
  name: 'Pollo',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('ProteinsService', () => {
  let service: ProteinsService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProteinsService,
        { provide: PrismaService, useFactory: mockPrisma },
      ],
    }).compile();

    service = module.get<ProteinsService>(ProteinsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  /* ═══════════════════════════════════════════════
   *  CREATE
   * ═══════════════════════════════════════════════ */
  describe('create', () => {
    it('should create a protein and return it', async () => {
      const protein = fakeProtein();
      prisma.proteinType.create.mockResolvedValue(protein);

      const result = await service.create({ name: 'Pollo' });

      expect(result).toEqual(protein);
      expect(prisma.proteinType.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Pollo',
            isActive: true,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should trim the name', async () => {
      prisma.proteinType.create.mockResolvedValue(fakeProtein());

      await service.create({ name: '  Pollo  ' });

      expect(prisma.proteinType.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Pollo' }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('should allow setting isActive to false', async () => {
      prisma.proteinType.create.mockResolvedValue(
        fakeProtein({ isActive: false }),
      );

      await service.create({ name: 'Pollo', isActive: false });

      expect(prisma.proteinType.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('should throw ConflictException on duplicate name (P2002)', async () => {
      prisma.proteinType.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create({ name: 'Pollo' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should rethrow non-P2002 errors', async () => {
      prisma.proteinType.create.mockRejectedValue(new Error('DB down'));

      await expect(service.create({ name: 'Pollo' })).rejects.toThrow(
        'DB down',
      );
    });
  });

  /* ═══════════════════════════════════════════════
   *  FIND ALL
   * ═══════════════════════════════════════════════ */
  describe('findAll', () => {
    it('should return list with default pagination', async () => {
      const items = [fakeProtein(), fakeProtein({ id: 'prot-2', name: 'Res' })];
      prisma.proteinType.findMany.mockResolvedValue(items);

      const result = await service.findAll({});

      expect(result).toEqual(items);
      expect(prisma.proteinType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 }),
      );
    });

    it('should filter by search query', async () => {
      prisma.proteinType.findMany.mockResolvedValue([]);

      await service.findAll({ q: 'poll' });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const call = prisma.proteinType.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(call.where).toHaveProperty('name', {
        contains: 'poll',
        mode: 'insensitive',
      });
    });

    it('should filter by active status', async () => {
      prisma.proteinType.findMany.mockResolvedValue([]);

      await service.findAll({ active: true });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const call = prisma.proteinType.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(call.where).toHaveProperty('isActive', true);
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
    it('should return a protein by id', async () => {
      const protein = fakeProtein();
      prisma.proteinType.findUnique.mockResolvedValue(protein);

      expect(await service.findOne('prot-1')).toEqual(protein);
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.proteinType.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  /* ═══════════════════════════════════════════════
   *  TOGGLE
   * ═══════════════════════════════════════════════ */
  describe('toggle', () => {
    it('should set isActive to false if true', async () => {
      prisma.proteinType.findUnique.mockResolvedValue({
        id: 'prot-1',
        isActive: true,
      });
      const updated = fakeProtein({ isActive: false });
      prisma.proteinType.update.mockResolvedValue(updated);

      const result = await service.toggle('prot-1');

      expect(result).toEqual(updated);
      expect(prisma.proteinType.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.proteinType.findUnique.mockResolvedValue(null);

      await expect(service.toggle('nope')).rejects.toThrow(NotFoundException);
    });
  });

  /* ═══════════════════════════════════════════════
   *  DELETE
   * ═══════════════════════════════════════════════ */
  describe('delete', () => {
    it('should delete and return { deleted: true, id }', async () => {
      prisma.proteinType.findUnique.mockResolvedValue({ id: 'prot-1' });
      prisma.proteinType.delete.mockResolvedValue(undefined);

      expect(await service.delete('prot-1')).toEqual({
        deleted: true,
        id: 'prot-1',
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.proteinType.findUnique.mockResolvedValue(null);

      await expect(service.delete('nope')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when referenced (P2003)', async () => {
      prisma.proteinType.findUnique.mockResolvedValue({ id: 'prot-1' });
      prisma.proteinType.delete.mockRejectedValue({ code: 'P2003' });

      await expect(service.delete('prot-1')).rejects.toThrow(ConflictException);
    });

    it('should rethrow non-P2003 errors', async () => {
      prisma.proteinType.findUnique.mockResolvedValue({ id: 'prot-1' });
      prisma.proteinType.delete.mockRejectedValue(new Error('Unexpected'));

      await expect(service.delete('prot-1')).rejects.toThrow('Unexpected');
    });
  });
});
