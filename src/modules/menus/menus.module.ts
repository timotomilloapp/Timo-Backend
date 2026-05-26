import { Module } from '@nestjs/common';
import { MenusController } from './menus.controller';
import { MenusService } from './menus.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MenusCronService } from './menus-cron.service';

@Module({
  controllers: [MenusController],
  providers: [MenusService, PrismaService, MenusCronService],
  exports: [MenusService],
})
export class MenusModule {}
