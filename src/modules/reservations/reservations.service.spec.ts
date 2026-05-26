import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsService } from './reservations.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as dateUtil from '../../common/date.util';

/* ───────── Mock date utilities ───────── */
jest.mock('../../common/date.util', () => ({
  isDateTomorrowOrLaterColombia: jest.fn().mockReturnValue(true),
  colombiaTimestamps: jest.fn().mockReturnValue({
    createdAt: new Date('2026-01-01T05:00:00Z'),
    updatedAt: new Date('2026-01-01T05:00:00Z'),
  }),
  colombiaUpdatedAt: jest.fn().mockReturnValue({
    updatedAt: new Date('2026-01-01T05:00:00Z'),
  }),
  nowColombia: jest.fn().mockReturnValue(new Date('2026-01-01T05:00:00Z')),
  todayColombia: jest.fn().mockReturnValue('2026-03-10'),
}));

/* ───────── Prisma mock ───────── */
const mockTx = {
  reservation: { update: jest.fn(), findUnique: jest.fn() },
  reservationSideDish: { deleteMany: jest.fn(), createMany: jest.fn() },
  sideDish: { findMany: jest.fn() },
};

const mockPrisma = () => ({
  whitelistEntry: { findUnique: jest.fn() },
  menu: { findUnique: jest.fn() },
  reservation: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<unknown>) =>
    cb(mockTx),
  ),
});

type MockPrisma = ReturnType<typeof mockPrisma>;

/* ───────── Helpers ───────── */
const fakeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'wl-1',
  cc: '123456',
  name: 'John Doe',
  enabled: true,
  ...overrides,
});

const fakeMenu = (overrides: Record<string, unknown> = {}) => ({
  id: 'menu-1',
  date: new Date('2026-03-10T00:00:00Z'),
  defaultProteinTypeId: 'prot-default',
  proteinOptions: [{ proteinTypeId: 'prot-a' }, { proteinTypeId: 'prot-b' }],
  sideOptions: [
    { sideDishId: 'sd-1', sideDish: { id: 'sd-1', name: 'Arroz' } },
    { sideDishId: 'sd-2', sideDish: { id: 'sd-2', name: 'Ensalada' } },
  ],
  ...overrides,
});

const fakeReservation = (overrides: Record<string, unknown> = {}) => ({
  id: 'res-1',
  menuId: 'menu-1',
  cc: '123456',
  name: 'John Doe',
  proteinTypeId: 'prot-a',
  status: 'RESERVADA',
  proteinType: { id: 'prot-a', name: 'Pollo' },
  menu: {
    id: 'menu-1',
    date: new Date('2026-03-10T00:00:00Z'),
    dayOfWeek: 'MAR',
  },
  sideDishes: [],
  createdAt: new Date('2026-01-01T05:00:00Z'),
  updatedAt: new Date('2026-01-01T05:00:00Z'),
  ...overrides,
});

describe('ReservationsService', () => {
  let service: ReservationsService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useFactory: mockPrisma },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
    (dateUtil.isDateTomorrowOrLaterColombia as jest.Mock).mockReturnValue(true);
  });

  /* ═══════════════════════════════════════════════
   *  CREATE
   * ═══════════════════════════════════════════════ */
  describe('create', () => {
    const dto = { cc: '123456', menuId: 'menu-1', proteinTypeId: 'prot-a' };

    it('should create a reservation with chosen protein (future date)', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue(fakeUser());
      prisma.menu.findUnique.mockResolvedValue(fakeMenu());
      const res = fakeReservation();
      prisma.reservation.create.mockResolvedValue(res);

      const result = await service.create(dto);

      expect(result).toEqual(res);
      expect(prisma.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            proteinTypeId: 'prot-a',
            status: 'RESERVADA',
            cc: '123456',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should auto-assign default protein for same-day reservations', async () => {
      (dateUtil.isDateTomorrowOrLaterColombia as jest.Mock).mockReturnValue(
        false,
      );
      prisma.whitelistEntry.findUnique.mockResolvedValue(fakeUser());
      prisma.menu.findUnique.mockResolvedValue(fakeMenu());
      prisma.reservation.create.mockResolvedValue(
        fakeReservation({
          proteinTypeId: 'prot-default',
          status: 'AUTO_ASIGNADA',
        }),
      );

      await service.create(dto);

      expect(prisma.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            proteinTypeId: 'prot-default',
            status: 'AUTO_ASIGNADA',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should auto-assign side dishes from menu options', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue(fakeUser());
      prisma.menu.findUnique.mockResolvedValue(fakeMenu());
      prisma.reservation.create.mockResolvedValue(fakeReservation());

      await service.create(dto);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const call = prisma.reservation.create.mock.calls[0][0] as {
        data: { sideDishes: unknown };
      };
      expect(call.data.sideDishes).toEqual({
        create: [
          { sideDishId: 'sd-1', nameSnapshot: 'Arroz' },
          { sideDishId: 'sd-2', nameSnapshot: 'Ensalada' },
        ],
      });
    });

    it('should trim cc before processing', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue(fakeUser());
      prisma.menu.findUnique.mockResolvedValue(fakeMenu());
      prisma.reservation.create.mockResolvedValue(fakeReservation());

      await service.create({ ...dto, cc: '  123456  ' });

      expect(prisma.whitelistEntry.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { cc: '123456' } }),
      );
    });

    it('should throw NotFoundException when cc not in whitelist', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is disabled', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue(
        fakeUser({ enabled: false }),
      );

      await expect(service.create(dto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when menu not found', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue(fakeUser());
      prisma.menu.findUnique.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when protein not in menu options', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue(fakeUser());
      prisma.menu.findUnique.mockResolvedValue(fakeMenu());

      await expect(
        service.create({ ...dto, proteinTypeId: 'invalid-prot' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no default protein on same-day', async () => {
      (dateUtil.isDateTomorrowOrLaterColombia as jest.Mock).mockReturnValue(
        false,
      );
      prisma.whitelistEntry.findUnique.mockResolvedValue(fakeUser());
      prisma.menu.findUnique.mockResolvedValue(
        fakeMenu({ defaultProteinTypeId: null }),
      );

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException on duplicate reservation (P2002)', async () => {
      prisma.whitelistEntry.findUnique.mockResolvedValue(fakeUser());
      prisma.menu.findUnique.mockResolvedValue(fakeMenu());
      prisma.reservation.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  /* ═══════════════════════════════════════════════
   *  UPDATE
   * ═══════════════════════════════════════════════ */
  describe('update', () => {
    const dto = { cc: '123456', proteinTypeId: 'prot-b' };

    const reservationWithMenu = {
      id: 'res-1',
      cc: '123456',
      status: 'RESERVADA',
      menu: {
        date: new Date('2026-03-10T00:00:00Z'),
        proteinOptions: [
          { proteinTypeId: 'prot-a' },
          { proteinTypeId: 'prot-b' },
        ],
        sideOptions: [{ sideDishId: 'sd-1' }],
      },
    };

    it('should update protein directly (no side dishes)', async () => {
      prisma.reservation.findUnique.mockResolvedValue(reservationWithMenu);
      const updated = fakeReservation({ proteinTypeId: 'prot-b' });
      prisma.reservation.update.mockResolvedValue(updated);

      const result = await service.update('res-1', dto);

      expect(result).toEqual(updated);
      expect(prisma.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: expect.objectContaining({ proteinTypeId: 'prot-b' }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.reservation.findUnique.mockResolvedValue(null);

      await expect(service.update('nope', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException on cc mismatch', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        ...reservationWithMenu,
        cc: '999999',
      });

      await expect(service.update('res-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException for same-day/past modifications', async () => {
      (dateUtil.isDateTomorrowOrLaterColombia as jest.Mock).mockReturnValue(
        false,
      );
      prisma.reservation.findUnique.mockResolvedValue(reservationWithMenu);

      await expect(service.update('res-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when reservation is cancelled', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        ...reservationWithMenu,
        status: 'CANCELADA',
      });

      await expect(service.update('res-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when protein not in menu', async () => {
      prisma.reservation.findUnique.mockResolvedValue(reservationWithMenu);

      await expect(
        service.update('res-1', { cc: '123456', proteinTypeId: 'invalid' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* ═══════════════════════════════════════════════
   *  CANCEL
   * ═══════════════════════════════════════════════ */
  describe('cancel', () => {
    const reservation = {
      id: 'res-1',
      cc: '123456',
      status: 'RESERVADA',
      menu: { date: new Date('2026-03-10T00:00:00Z') },
    };

    it('should cancel a reservation', async () => {
      prisma.reservation.findUnique.mockResolvedValue(reservation);
      const cancelled = fakeReservation({ status: 'CANCELADA' });
      prisma.reservation.update.mockResolvedValue(cancelled);

      const result = await service.cancel('res-1', '123456');

      expect(result).toEqual(cancelled);
      expect(prisma.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELADA' }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.reservation.findUnique.mockResolvedValue(null);

      await expect(service.cancel('nope', '123456')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException on cc mismatch', async () => {
      prisma.reservation.findUnique.mockResolvedValue(reservation);

      await expect(service.cancel('res-1', '999999')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException for same-day/past cancellations', async () => {
      (dateUtil.isDateTomorrowOrLaterColombia as jest.Mock).mockReturnValue(
        false,
      );
      prisma.reservation.findUnique.mockResolvedValue(reservation);

      await expect(service.cancel('res-1', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when already cancelled', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        ...reservation,
        status: 'CANCELADA',
      });

      await expect(service.cancel('res-1', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  /* ═══════════════════════════════════════════════
   *  DELETE
   * ═══════════════════════════════════════════════ */
  describe('delete', () => {
    it('should delete and return { deleted: true, id }', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        cc: '123456',
      });
      prisma.reservation.delete.mockResolvedValue(undefined);

      expect(await service.delete('res-1', '123456')).toEqual({
        deleted: true,
        id: 'res-1',
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.reservation.findUnique.mockResolvedValue(null);

      await expect(service.delete('nope', '123456')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException on cc mismatch', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        cc: '999999',
      });

      await expect(service.delete('res-1', '123456')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  /* ═══════════════════════════════════════════════
   *  FIND ALL
   * ═══════════════════════════════════════════════ */
  describe('findAll', () => {
    it('should return reservations with default pagination', async () => {
      const items = [fakeReservation()];
      prisma.reservation.findMany.mockResolvedValue(items);

      expect(await service.findAll({})).toEqual(items);
      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 500 }),
      );
    });

    it('should filter by date when provided', async () => {
      prisma.reservation.findMany.mockResolvedValue([]);

      await service.findAll({ date: '2026-03-10' });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const call = prisma.reservation.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(call.where).toEqual({
        menu: { date: new Date('2026-03-10T00:00:00Z') },
      });
    });

    it('should throw BadRequestException when take > 1000', async () => {
      await expect(service.findAll({ take: 1001 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  /* ═══════════════════════════════════════════════
   *  FIND BY CC
   * ═══════════════════════════════════════════════ */
  describe('findByCC', () => {
    it('should return reservations by cc', async () => {
      prisma.reservation.findMany.mockResolvedValue([fakeReservation()]);

      const result = await service.findByCC('123456');

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            cc: '123456',
            menu: { date: new Date('2026-03-10T00:00:00Z') },
          },
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('should filter by date when provided', async () => {
      prisma.reservation.findMany.mockResolvedValue([]);

      await service.findByCC('123456', '2026-03-10');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const call = prisma.reservation.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(call.where).toEqual({
        cc: '123456',
        menu: { date: new Date('2026-03-10T00:00:00Z') },
      });
    });

    it('should trim cc', async () => {
      prisma.reservation.findMany.mockResolvedValue([]);

      await service.findByCC('  123456  ');

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            cc: '123456',
            menu: { date: new Date('2026-03-10T00:00:00Z') },
          },
        }),
      );
    });
  });

  /* ═══════════════════════════════════════════════
   *  FIND SUMMARY BY DATE
   * ═══════════════════════════════════════════════ */
  describe('findSummaryByDate', () => {
    it('should return summary with protein counts grouped', async () => {
      prisma.menu.findUnique.mockResolvedValue({ id: 'menu-1' });
      prisma.reservation.findMany.mockResolvedValue([
        {
          proteinTypeId: 'p1',
          proteinType: { name: 'Pollo' },
          status: 'RESERVADA',
        },
        {
          proteinTypeId: 'p1',
          proteinType: { name: 'Pollo' },
          status: 'RESERVADA',
        },
        {
          proteinTypeId: 'p2',
          proteinType: { name: 'Res' },
          status: 'AUTO_ASIGNADA',
        },
      ]);

      const result = await service.findSummaryByDate('2026-03-10');

      expect(result.date).toBe('2026-03-10');
      expect(result.status).toBe('RESERVADA');
      expect(result.proteins).toEqual([
        { proteinTypeId: 'p1', proteinName: 'Pollo', count: 2 },
        { proteinTypeId: 'p2', proteinName: 'Res', count: 1 },
      ]);
    });

    it('should exclude CANCELADA from protein counts', async () => {
      prisma.menu.findUnique.mockResolvedValue({ id: 'menu-1' });
      prisma.reservation.findMany.mockResolvedValue([
        {
          proteinTypeId: 'p1',
          proteinType: { name: 'Pollo' },
          status: 'RESERVADA',
        },
        {
          proteinTypeId: 'p1',
          proteinType: { name: 'Pollo' },
          status: 'CANCELADA',
        },
      ]);

      const result = await service.findSummaryByDate('2026-03-10');

      expect(result.proteins).toEqual([
        { proteinTypeId: 'p1', proteinName: 'Pollo', count: 1 },
      ]);
    });

    it('should return SIN_RESERVAS when no reservations', async () => {
      prisma.menu.findUnique.mockResolvedValue({ id: 'menu-1' });
      prisma.reservation.findMany.mockResolvedValue([]);

      const result = await service.findSummaryByDate('2026-03-10');

      expect(result.status).toBe('SIN_RESERVAS');
      expect(result.proteins).toEqual([]);
    });

    it('should return SERVIDA when any reservation is served', async () => {
      prisma.menu.findUnique.mockResolvedValue({ id: 'menu-1' });
      prisma.reservation.findMany.mockResolvedValue([
        {
          proteinTypeId: 'p1',
          proteinType: { name: 'Pollo' },
          status: 'SERVIDA',
        },
        {
          proteinTypeId: 'p1',
          proteinType: { name: 'Pollo' },
          status: 'RESERVADA',
        },
      ]);

      const result = await service.findSummaryByDate('2026-03-10');
      expect(result.status).toBe('SERVIDA');
    });

    it('should throw NotFoundException when no menu for date', async () => {
      prisma.menu.findUnique.mockResolvedValue(null);

      await expect(service.findSummaryByDate('2026-12-25')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  /* ═══════════════════════════════════════════════
   *  BULK MARK SERVED
   * ═══════════════════════════════════════════════ */
  describe('bulkMarkServed', () => {
    it('should mark non-cancelled reservations as SERVIDA', async () => {
      prisma.menu.findUnique.mockResolvedValue({ id: 'menu-1' });
      prisma.reservation.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.bulkMarkServed('2026-03-10');

      expect(result).toEqual({
        date: '2026-03-10',
        status: 'SERVIDA',
        updated: 5,
      });
      expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { menuId: 'menu-1', status: { not: 'CANCELADA' } },
          data: expect.objectContaining({ status: 'SERVIDA' }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('should throw NotFoundException when no menu for date', async () => {
      prisma.menu.findUnique.mockResolvedValue(null);

      await expect(service.bulkMarkServed('2026-12-25')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  /* ═══════════════════════════════════════════════
   *  BULK MARK CANCELLED
   * ═══════════════════════════════════════════════ */
  describe('bulkMarkCancelled', () => {
    it('should mark eligible reservations as CANCELADA', async () => {
      prisma.menu.findUnique.mockResolvedValue({ id: 'menu-1' });
      prisma.reservation.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.bulkMarkCancelled('2026-03-10');

      expect(result).toEqual({
        date: '2026-03-10',
        status: 'CANCELADA',
        updated: 3,
      });
      expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            menuId: 'menu-1',
            status: { notIn: ['CANCELADA', 'SERVIDA'] },
          },
        }),
      );
    });

    it('should throw NotFoundException when no menu for date', async () => {
      prisma.menu.findUnique.mockResolvedValue(null);

      await expect(service.bulkMarkCancelled('2026-12-25')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
