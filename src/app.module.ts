import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { ProteinsModule } from './modules/proteins/proteins.module';
import { SideDishesModule } from './modules/side-dishes/side-dishes.module';
import { SoupsModule } from './modules/soups/soups.module';
import { DrinksModule } from './modules/drinks/drinks.module';
import { WhitelistModule } from './modules/whitelist/whitelist.module';
import { MenusModule } from './modules/menus/menus.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AreasModule } from './modules/areas/areas.module';
import { AppetizersModule } from './modules/appetizers/appetizers.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    ProteinsModule,
    SideDishesModule,
    SoupsModule,
    DrinksModule,
    WhitelistModule,
    MenusModule,
    ReservationsModule,
    HealthModule,
    UsersModule,
    AreasModule,
    AppetizersModule,
  ],
})
export class AppModule {}
