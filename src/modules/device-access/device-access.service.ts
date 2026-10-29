import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'crypto';
import { promisify } from 'util';
import { PrismaService } from '../../prisma/prisma.service';

const deriveKey = promisify(scrypt);
export const SESSION_DURATION_MS = 3 * 60 * 60 * 1000;

@Injectable()
export class DeviceAccessService {
  private readonly attempts = new Map<
    string,
    { count: number; until: number }
  >();

  constructor(private readonly prisma: PrismaService) {}

  async settings() {
    const config = await this.prisma.deviceAccessConfig.findUnique({
      where: { id: 1 },
    });
    return { configured: !!config, updatedAt: config?.updatedAt ?? null };
  }

  async setPassword(password: string, currentPassword?: string) {
    const config = await this.prisma.deviceAccessConfig.findUnique({
      where: { id: 1 },
    });
    if (config) {
      if (!currentPassword) {
        throw new BadRequestException({
          code: 'CURRENT_PASSWORD_REQUIRED',
          message: 'Debes ingresar la clave actual del dispositivo.',
        });
      }
      if (!(await this.matchesPassword(currentPassword, config.passwordHash))) {
        throw new ForbiddenException({
          code: 'CURRENT_PASSWORD_INVALID',
          message: 'La clave actual del dispositivo es incorrecta.',
        });
      }
    }
    const salt = randomBytes(16).toString('hex');
    const hash = (await deriveKey(password, salt, 64)) as Buffer;
    const data = {
      passwordHash: `${salt}:${hash.toString('hex')}`,
      version: randomUUID(),
    };
    if (config) {
      const result = await this.prisma.deviceAccessConfig.updateMany({
        where: { id: 1, version: config.version },
        data,
      });
      if (result.count !== 1) this.passwordChanged();
    } else {
      try {
        await this.prisma.deviceAccessConfig.create({
          data: { id: 1, ...data },
        });
      } catch (error: unknown) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          this.passwordChanged();
        }
        throw error;
      }
    }
    return { configured: true };
  }

  async login(password: string, address: string) {
    const now = Date.now();
    for (const [key, value] of this.attempts) {
      if (value.until <= now) this.attempts.delete(key);
    }
    const attempt = this.attempts.get(address) ?? {
      count: 0,
      until: now + 60_000,
    };
    if (attempt.count >= 10 || this.attempts.size >= 10000) {
      throw new HttpException(
        'Demasiados intentos. Intenta nuevamente en un minuto.',
        429,
      );
    }
    attempt.count++;
    this.attempts.set(address, attempt);
    const config = await this.prisma.deviceAccessConfig.findUnique({
      where: { id: 1 },
    });
    if (!config)
      throw new UnauthorizedException(
        'El administrador debe configurar la clave de acceso.',
      );
    if (!(await this.matchesPassword(password, config.passwordHash))) {
      throw new UnauthorizedException('Clave incorrecta.');
    }
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await this.prisma.deviceSession.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    await this.prisma.deviceSession.create({
      data: {
        tokenHash: this.hashToken(token),
        version: config.version,
        expiresAt,
      },
    });
    return { token, expiresAt };
  }

  async validate(token?: string) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const session = await this.prisma.deviceSession.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) return null;
    const config = await this.prisma.deviceAccessConfig.findUnique({
      where: { id: 1 },
    });
    return config?.version === session.version ? session : null;
  }

  async logout(token?: string) {
    if (token)
      await this.prisma.deviceSession.deleteMany({
        where: { tokenHash: this.hashToken(token) },
      });
    return { active: false };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async matchesPassword(password: string, passwordHash: string) {
    const [salt, storedHash] = passwordHash.split(':');
    const hash = (await deriveKey(password, salt, 64)) as Buffer;
    return timingSafeEqual(hash, Buffer.from(storedHash, 'hex'));
  }

  private passwordChanged(): never {
    throw new ConflictException({
      code: 'DEVICE_PASSWORD_CHANGED',
      message:
        'La clave cambió durante la solicitud. Recarga e ingresa la clave actual.',
    });
  }
}
