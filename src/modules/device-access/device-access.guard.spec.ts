import 'reflect-metadata';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../../prisma/prisma.service';
import { DeviceAccessGuard } from './device-access.guard';
import { DeviceAccessService } from './device-access.service';
import { MenusController } from '../menus/menus.controller';
import { ReservationsController } from '../reservations/reservations.controller';
import { WhitelistController } from '../whitelist/whitelist.controller';
import { AuthController } from '../auth/auth.controller';

describe('DeviceAccessGuard', () => {
  const access = { validate: jest.fn() };
  const prisma = { profile: { findUnique: jest.fn() } };
  const request = {
    headers: {} as Record<string, string>,
    get: jest.fn(),
    user: { sub: 'admin' },
  };
  const guard = new DeviceAccessGuard(
    new Reflector(),
    access as unknown as DeviceAccessService,
    prisma as unknown as PrismaService,
  );
  const context = (controller: { prototype: object }, method: string) =>
    ({
      getClass: () => controller,
      getHandler: () =>
        Object.getOwnPropertyDescriptor(controller.prototype, method)
          ?.value as unknown,
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.resetAllMocks();
    request.headers = {};
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    [MenusController, 'findAll'],
    [MenusController, 'findByDate'],
    [MenusController, 'findForUserByDate'],
    [ReservationsController, 'create'],
    [ReservationsController, 'update'],
    [ReservationsController, 'cancel'],
    [ReservationsController, 'delete'],
    [ReservationsController, 'findByCC'],
    [ReservationsController, 'markAsPrinted'],
    [WhitelistController, 'login'],
  ])(
    'blocks a public route without a valid device session (%p, %p)',
    async (controller, handler) => {
      await expect(
        guard.canActivate(context(controller, handler)),
      ).rejects.toThrow(UnauthorizedException);
    },
  );

  it('permits a valid device session', async () => {
    access.validate.mockResolvedValue({ expiresAt: new Date() });
    await expect(
      guard.canActivate(context(ReservationsController, 'create')),
    ).resolves.toBe(true);
  });

  it('keeps administrative login accessible', async () => {
    await expect(
      guard.canActivate(context(AuthController, 'getToken')),
    ).resolves.toBe(true);
  });

  it('permits authenticated enabled panel users independently of device access', async () => {
    request.headers.authorization = 'Bearer valid';
    const authenticate = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockResolvedValue(true);
    prisma.profile.findUnique.mockResolvedValue({
      enabled: true,
      role: 'ADMIN',
    });
    await expect(
      guard.canActivate(context(MenusController, 'findAll')),
    ).resolves.toBe(true);
    expect(authenticate).toHaveBeenCalled();
    prisma.profile.findUnique.mockResolvedValue({
      enabled: false,
      role: 'ADMIN',
    });
    await expect(
      guard.canActivate(context(MenusController, 'findAll')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('does not let an administrative token bypass the cedula entry gate', async () => {
    request.headers.authorization = 'Bearer valid';
    await expect(
      guard.canActivate(context(WhitelistController, 'login')),
    ).rejects.toThrow(UnauthorizedException);
  });
});
