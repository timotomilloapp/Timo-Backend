import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../../prisma/prisma.service';
import { DeviceAccessService } from './device-access.service';
import { DeviceAccessController } from './device-access.controller';
import { DeviceAccessGuard } from './device-access.guard';

@Module({
  imports: [AuthModule],
  controllers: [DeviceAccessController],
  providers: [
    PrismaService,
    DeviceAccessService,
    { provide: APP_GUARD, useClass: DeviceAccessGuard },
  ],
})
export class DeviceAccessModule {}
