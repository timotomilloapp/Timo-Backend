import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DeviceAccessService,
  SESSION_DURATION_MS,
} from './device-access.service';

describe('DeviceAccessService', () => {
  type Config = { passwordHash: string; version: string };
  type Session = { tokenHash: string; version: string; expiresAt: Date };
  const prisma = {
    deviceAccessConfig: {
      findUnique: jest.fn(),
      create: jest.fn<Promise<void>, [{ data: Config & { id: number } }]>(),
      updateMany: jest.fn<
        Promise<{ count: number }>,
        [{ data: Config; where: { id: number; version: string } }]
      >(),
    },
    deviceSession: {
      create: jest.fn<Promise<void>, [{ data: Session }]>(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  let service: DeviceAccessService;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.deviceAccessConfig.updateMany.mockResolvedValue({ count: 1 });
    service = new DeviceAccessService(prisma as unknown as PrismaService);
  });

  async function configure() {
    await service.setPassword('clave-segura');
    const config = prisma.deviceAccessConfig.create.mock.calls[0][0].data as {
      passwordHash: string;
      version: string;
    };
    prisma.deviceAccessConfig.findUnique.mockResolvedValue(config);
    return config;
  }

  it('fails closed until an administrator configures a password', async () => {
    await expect(service.login('clave-segura', 'device')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.deviceSession.create).not.toHaveBeenCalled();
  });

  it('stores a salted hash and rejects incorrect passwords', async () => {
    const config = await configure();
    expect(config.passwordHash).not.toContain('clave-segura');
    await expect(service.login('incorrecta', 'device')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.deviceSession.create).not.toHaveBeenCalled();
  });

  it('issues a session for exactly three hours without storing the raw token', async () => {
    await configure();
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
    try {
      const result = await service.login('clave-segura', 'device');
      expect(result.expiresAt.getTime()).toBe(now + SESSION_DURATION_MS);
      const session = prisma.deviceSession.create.mock.calls[0][0].data;
      expect(session.tokenHash).not.toBe(result.token);
      prisma.deviceSession.findUnique.mockResolvedValue(session);
      expect(await service.validate(result.token)).toEqual(session);
      clock.mockReturnValue(now + SESSION_DURATION_MS);
      expect(await service.validate(result.token)).toBeNull();
    } finally {
      clock.mockRestore();
    }
  });

  it('invalidates old sessions when the password changes', async () => {
    await configure();
    const result = await service.login('clave-segura', 'device');
    prisma.deviceSession.findUnique.mockResolvedValue(
      prisma.deviceSession.create.mock.calls[0][0].data,
    );
    await service.setPassword('otra-clave', 'clave-segura');
    prisma.deviceAccessConfig.findUnique.mockResolvedValue(
      prisma.deviceAccessConfig.updateMany.mock.calls[0][0].data,
    );
    expect(await service.validate(result.token)).toBeNull();
    await expect(service.login('clave-segura', 'device')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.login('otra-clave', 'device')).resolves.toHaveProperty(
      'token',
    );
  });

  it('allows initial setup without a current password', async () => {
    await expect(service.setPassword('clave-segura')).resolves.toEqual({
      configured: true,
    });
    expect(prisma.deviceAccessConfig.create).toHaveBeenCalledTimes(1);
    expect(prisma.deviceAccessConfig.updateMany).not.toHaveBeenCalled();
  });

  it.each([undefined, ''])(
    'requires the current password when configured (%p)',
    async (currentPassword) => {
      await configure();
      await expect(
        service.setPassword('otra-clave', currentPassword),
      ).rejects.toMatchObject({
        response: { code: 'CURRENT_PASSWORD_REQUIRED' },
        status: 400,
      });
      expect(prisma.deviceAccessConfig.updateMany).not.toHaveBeenCalled();
      expect(prisma.deviceAccessConfig.create).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects an incorrect current password without revoking sessions', async () => {
    await configure();
    const session = await service.login('clave-segura', 'device');
    prisma.deviceSession.findUnique.mockResolvedValue(
      prisma.deviceSession.create.mock.calls[0][0].data,
    );
    await expect(
      service.setPassword('otra-clave', 'incorrecta'),
    ).rejects.toMatchObject({
      response: { code: 'CURRENT_PASSWORD_INVALID' },
      status: 403,
    });
    expect(prisma.deviceAccessConfig.updateMany).not.toHaveBeenCalled();
    expect(await service.validate(session.token)).not.toBeNull();
  });

  it('does not overwrite a password changed concurrently', async () => {
    const config = await configure();
    prisma.deviceAccessConfig.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.setPassword('otra-clave', 'clave-segura'),
    ).rejects.toMatchObject({
      response: { code: 'DEVICE_PASSWORD_CHANGED' },
      status: 409,
    });
    expect(prisma.deviceAccessConfig.updateMany).toHaveBeenCalledWith({
      where: { id: 1, version: config.version },
      data: expect.any(Object) as Config,
    });
  });

  it('does not overwrite a concurrently initialized password', async () => {
    prisma.deviceAccessConfig.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.setPassword('clave-segura')).rejects.toMatchObject({
      response: { code: 'DEVICE_PASSWORD_CHANGED' },
      status: 409,
    });
    expect(prisma.deviceAccessConfig.updateMany).not.toHaveBeenCalled();
  });

  it('revokes only the current device session and rejects reuse', async () => {
    await configure();
    const result = await service.login('clave-segura', 'device');
    const session = prisma.deviceSession.create.mock.calls[0][0].data;
    prisma.deviceSession.findUnique.mockResolvedValue(session);
    prisma.deviceSession.deleteMany.mockImplementation(() => {
      prisma.deviceSession.findUnique.mockResolvedValue(null);
      return Promise.resolve({ count: 1 });
    });
    await service.logout(result.token);
    expect(prisma.deviceSession.deleteMany).toHaveBeenLastCalledWith({
      where: { tokenHash: session.tokenHash },
    });
    expect(await service.validate(result.token)).toBeNull();
  });

  it('rejects missing and malformed tokens before querying the database', async () => {
    expect(await service.validate()).toBeNull();
    expect(await service.validate('invalid')).toBeNull();
    expect(prisma.deviceSession.findUnique).not.toHaveBeenCalled();
  });

  it('limits password attempts', async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await expect(service.login('incorrecta', 'device')).rejects.toThrow(
        UnauthorizedException,
      );
    }
    await expect(service.login('incorrecta', 'device')).rejects.toMatchObject({
      status: 429,
    });
  });
});
