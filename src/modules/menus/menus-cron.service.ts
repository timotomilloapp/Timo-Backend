import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { MenusService } from './menus.service';

@Injectable()
export class MenusCronService {
    private readonly logger = new Logger(MenusCronService.name);

    constructor(
        private readonly menusService: MenusService,
        private readonly configService: ConfigService,
    ) { }

    @Cron(process.env.MENU_CRON_SCHEDULE || '59 23 * * *', { timeZone: 'America/Bogota' })
    async handleMenuStatusUpdate() {
        this.logger.debug('Running handleMenuStatusUpdate cron job');
        try {
            await this.menusService.updateCurrentDayMenusStatus();
            this.logger.debug('Successfully updated menu statuses for the current day');
        } catch (error) {
            this.logger.error('Failed to update menu statuses', error instanceof Error ? error.stack : error);
        }
    }
}
