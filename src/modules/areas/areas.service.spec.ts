import { Test, TestingModule } from '@nestjs/testing';
import { AreasService } from './areas.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

/* ───────── Prisma mock ───────── */
const mockPrisma = () => ({
  area: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
});

type MockPrisma = ReturnType<typeof mockPrisma>;

const fakeArea = (overrides: Record<string, string | boolean | Date> = {}) => ({
  id: 'area-1',
  name: 'Pintura',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('AreasService', () => {
  let service: AreasService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AreasService,
        { provide: PrismaService, useFactory: mockPrisma },
      ],
    }).compile();

    service = module.get<AreasService>(AreasService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  /* ═══════════════════════════════════════════════
   *  CREATE
   * ═══════════════════════════════════════════════ */
  describe('create', () => {
    it('should create an area and return it', async () => {
      const area = fakeArea();
      prisma.area.create.mockResolvedValue(area);

      const result = await service.create({ name: 'Pintura' });

      expect(result).toEqual(area);
      expect(prisma.area.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Pintura',
            isActive: true,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should trim the name', async () => {
      prisma.area.create.mockResolvedValue(fakeArea());

      await service.create({ name: '  Pintura  ' });

      expect(prisma.area.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Pintura' }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('should throw ConflictException on duplicate name (P2002)', async () => {
      prisma.area.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create({ name: 'Pintura' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  /* ═══════════════════════════════════════════════
   *  FIND ALL
   * ═══════════════════════════════════════════════ */
  describe('findAll', () => {
    it('should return list with default pagination', async () => {
      const items = [
        fakeArea(),
        fakeArea({ id: 'area-2', name: 'Administrativa' }),
      ];
      prisma.area.findMany.mockResolvedValue(items);

      const result = await service.findAll({});

      expect(result).toEqual(items);
      expect(prisma.area.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 }),
      );
    });

    it('should filter by search query', async () => {
      prisma.area.findMany.mockResolvedValue([]);

      await service.findAll({ q: 'pint' });

      const call = prisma.area.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(call.where).toHaveProperty('name', {
        contains: 'pint',
        mode: 'insensitive',
      });
    });

    it('should filter by active status', async () => {
      prisma.area.findMany.mockResolvedValue([]);

      await service.findAll({ active: false });

      const call = prisma.area.findMany.mock.calls[0][0] as {
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
   *  FIND ALL ACTIVE
   * ═══════════════════════════════════════════════ */
  describe('findAllActive', () => {
    it('should return only active areas without pagination', async () => {
      const items = [fakeArea()];
      prisma.area.findMany.mockResolvedValue(items);

      const result = await service.findAllActive();

      expect(result).toEqual(items);
      expect(prisma.area.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: expect.any(Object) as Record<string, unknown>,
      });
    });
  });

  /* ═══════════════════════════════════════════════
   *  FIND ONE
   * ═══════════════════════════════════════════════ */
  describe('findOne', () => {
    it('should return an area by id', async () => {
      const area = fakeArea();
      prisma.area.findUnique.mockResolvedValue(area);

      expect(await service.findOne('area-1')).toEqual(area);
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.area.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  /* ═══════════════════════════════════════════════
   *  UPDATE
   * ═══════════════════════════════════════════════ */
  describe('update', () => {
    it('should update area name and return it', async () => {
      prisma.area.findUnique.mockResolvedValue({ id: 'area-1' });
      const updated = fakeArea({ name: 'Pintura Especial' });
      prisma.area.update.mockResolvedValue(updated);

      const result = await service.update('area-1', {
        name: 'Pintura Especial',
      });

      expect(result).toEqual(updated);
      expect(prisma.area.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'area-1' },
          data: expect.objectContaining({ name: 'Pintura Especial' }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('should throw NotFoundException when updating non-existent area', async () => {
      prisma.area.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nope', { name: 'Pintura Especial' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  /* ═══════════════════════════════════════════════
   *  TOGGLE
   * ═══════════════════════════════════════════════ */
  describe('toggle', () => {
    it('should toggle isActive status', async () => {
      prisma.area.findUnique.mockResolvedValue({
        id: 'area-1',
        isActive: true,
      });
      const updated = fakeArea({ isActive: false });
      prisma.area.update.mockResolvedValue(updated);

      const result = await service.toggle('area-1');

      expect(result).toEqual(updated);
      expect(prisma.area.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }) as Record<
            string,
            unknown
          >,
        }),
      );
    });
  });

  /* ═══════════════════════════════════════════════
   *  DELETE
   * ═══════════════════════════════════════════════ */
  describe('delete', () => {
    it('should delete and return true representation', async () => {
      prisma.area.findUnique.mockResolvedValue({ id: 'area-1' });
      prisma.area.delete.mockResolvedValue(undefined);

      expect(await service.delete('area-1')).toEqual({
        deleted: true,
        id: 'area-1',
      });
    });

    it('should throw ConflictException when referenced by appetizers (P2003)', async () => {
      prisma.area.findUnique.mockResolvedValue({ id: 'area-1' });
      prisma.area.delete.mockRejectedValue({ code: 'P2003' });

      await expect(service.delete('area-1')).rejects.toThrow(ConflictException);
    });
  });
});
