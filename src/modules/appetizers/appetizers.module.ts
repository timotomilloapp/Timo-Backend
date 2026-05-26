import { Module } from '@nestjs/common';
import { AppetizersController } from './appetizers.controller';
import { AppetizersService } from './appetizers.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [AppetizersController],
  providers: [AppetizersService, PrismaService],
  exports: [AppetizersService],
})
export class AppetizersModule {}
