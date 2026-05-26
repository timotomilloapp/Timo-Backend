import { Test, TestingModule } from '@nestjs/testing';
import { SoupsService } from './soups.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

/* ───────── Prisma mock ───────── */
const mockPrisma = () => ({
  soup: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
});

type MockPrisma = ReturnType<typeof mockPrisma>;

const fakeSoup = (overrides: Record<string, string | boolean | Date> = {}) => ({
  id: 'soup-1',
  name: 'Ajiaco',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('SoupsService', () => {
  let service: SoupsService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SoupsService,
        { provide: PrismaService, useFactory: mockPrisma },
      ],
    }).compile();

    service = module.get<SoupsService>(SoupsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  /* ═══════════════════════════════════════════════
   *  CREATE
   * ═══════════════════════════════════════════════ */
  describe('create', () => {
    it('should create a soup and return it', async () => {
      const soup = fakeSoup();
      prisma.soup.create.mockResolvedValue(soup);

      const result = await service.create({ name: 'Ajiaco' });

      expect(result).toEqual(soup);
      expect(prisma.soup.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Ajiaco',
            isActive: true,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should trim the name', async () => {
      prisma.soup.create.mockResolvedValue(fakeSoup());

      await service.create({ name: '  Ajiaco  ' });

      expect(prisma.soup.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Ajiaco' }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('should allow setting isActive to false', async () => {
      prisma.soup.create.mockResolvedValue(fakeSoup({ isActive: false }));

      await service.create({ name: 'Ajiaco', isActive: false });

      expect(prisma.soup.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('should throw ConflictException on duplicate name (P2002)', async () => {
      prisma.soup.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create({ name: 'Ajiaco' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should rethrow non-P2002 errors', async () => {
      prisma.soup.create.mockRejectedValue(new Error('DB down'));

      await expect(service.create({ name: 'Ajiaco' })).rejects.toThrow(
        'DB down',
      );
    });
  });

  /* ═══════════════════════════════════════════════
   *  FIND ALL
   * ═══════════════════════════════════════════════ */
  describe('findAll', () => {
    it('should return list with default pagination', async () => {
      const soups = [fakeSoup(), fakeSoup({ id: 'soup-2', name: 'Sancocho' })];
      prisma.soup.findMany.mockResolvedValue(soups);

      const result = await service.findAll({});

      expect(result).toEqual(soups);
      expect(prisma.soup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 }),
      );
    });

    it('should filter by search query', async () => {
      prisma.soup.findMany.mockResolvedValue([]);

      await service.findAll({ q: 'aji' });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const call = prisma.soup.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(call.where).toHaveProperty('name', {
        contains: 'aji',
        mode: 'insensitive',
      });
    });

    it('should filter by active status', async () => {
      prisma.soup.findMany.mockResolvedValue([]);

      await service.findAll({ active: true });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const call = prisma.soup.findMany.mock.calls[0][0] as {
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
    it('should return a soup by id', async () => {
      const soup = fakeSoup();
      prisma.soup.findUnique.mockResolvedValue(soup);

      expect(await service.findOne('soup-1')).toEqual(soup);
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.soup.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  /* ═══════════════════════════════════════════════
   *  TOGGLE
   * ═══════════════════════════════════════════════ */
  describe('toggle', () => {
    it('should set isActive to false if true', async () => {
      prisma.soup.findUnique.mockResolvedValue({
        id: 'soup-1',
        isActive: true,
      });
      const updated = fakeSoup({ isActive: false });
      prisma.soup.update.mockResolvedValue(updated);

      const result = await service.toggle('soup-1');

      expect(result).toEqual(updated);
      expect(prisma.soup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.soup.findUnique.mockResolvedValue(null);

      await expect(service.toggle('nope')).rejects.toThrow(NotFoundException);
    });
  });

  /* ═══════════════════════════════════════════════
   *  DELETE
   * ═══════════════════════════════════════════════ */
  describe('delete', () => {
    it('should delete and return { deleted: true, id }', async () => {
      prisma.soup.findUnique.mockResolvedValue({ id: 'soup-1' });
      prisma.soup.delete.mockResolvedValue(undefined);

      expect(await service.delete('soup-1')).toEqual({
        deleted: true,
        id: 'soup-1',
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.soup.findUnique.mockResolvedValue(null);

      await expect(service.delete('nope')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when referenced by menus (P2003)', async () => {
      prisma.soup.findUnique.mockResolvedValue({ id: 'soup-1' });
      prisma.soup.delete.mockRejectedValue({ code: 'P2003' });

      await expect(service.delete('soup-1')).rejects.toThrow(ConflictException);
    });

    it('should rethrow non-P2003 errors', async () => {
      prisma.soup.findUnique.mockResolvedValue({ id: 'soup-1' });
      prisma.soup.delete.mockRejectedValue(new Error('Unexpected'));

      await expect(service.delete('soup-1')).rejects.toThrow('Unexpected');
    });
  });
});
