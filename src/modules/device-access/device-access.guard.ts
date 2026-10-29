import {
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { DeviceAccessService } from './device-access.service';

export const DeviceAccess = (allowAdmin = true) =>
  SetMetadata('device-access', { allowAdmin });

@Injectable()
export class DeviceAccessGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: DeviceAccessService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<{ allowAdmin: boolean }>(
      'device-access',
      [context.getHandler(), context.getClass()],
    );
    if (!policy) return true;
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { sub: string } }>();
    if (policy.allowAdmin && request.headers.authorization) {
      await super.canActivate(context);
      const profile = await this.prisma.profile.findUnique({
        where: { id: request.user!.sub },
      });
      if (profile?.enabled && ['ADMIN', 'USER'].includes(profile.role))
        return true;
      throw new UnauthorizedException('Acceso administrativo no autorizado.');
    }
    if (await this.access.validate(request.get('X-Device-Session')))
      return true;
    throw new UnauthorizedException({
      code: 'DEVICE_SESSION_REQUIRED',
      message: 'Abre una sesión del dispositivo para continuar.',
    });
  }
}
