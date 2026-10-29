import {
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

  async setPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const hash = (await deriveKey(password, salt, 64)) as Buffer;
    const data = {
      passwordHash: `${salt}:${hash.toString('hex')}`,
      version: randomUUID(),
    };
    await this.prisma.deviceAccessConfig.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
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
    const [salt, storedHash] = config.passwordHash.split(':');
    const hash = (await deriveKey(password, salt, 64)) as Buffer;
    if (!timingSafeEqual(hash, Buffer.from(storedHash, 'hex'))) {
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
}
