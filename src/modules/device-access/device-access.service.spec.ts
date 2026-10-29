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
      upsert: jest.fn<
        Promise<void>,
        [{ create: Config; update: Config; where: { id: number } }]
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
    service = new DeviceAccessService(prisma as unknown as PrismaService);
  });

  async function configure() {
    await service.setPassword('clave-segura');
    const config = prisma.deviceAccessConfig.upsert.mock.calls[0][0].create as {
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
    await service.setPassword('otra-clave');
    prisma.deviceAccessConfig.findUnique.mockResolvedValue(
      prisma.deviceAccessConfig.upsert.mock.calls[1][0].create,
    );
    expect(await service.validate(result.token)).toBeNull();
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
