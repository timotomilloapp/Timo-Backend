import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DeviceAccessService } from './device-access.service';

class AccessPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

@Controller('device-access')
export class DeviceAccessController {
  constructor(private readonly access: DeviceAccessService) {}

  @Post('login')
  @Header('Cache-Control', 'no-store')
  login(@Body() body: AccessPasswordDto, @Req() request: Request) {
    return this.access.login(body.password, request.ip ?? 'unknown');
  }

  @Get('session')
  @Header('Cache-Control', 'no-store')
  async session(@Headers('x-device-session') token?: string) {
    const session = await this.access.validate(token);
    return { active: !!session, expiresAt: session?.expiresAt ?? null };
  }

  @Post('logout')
  logout(@Headers('x-device-session') token?: string) {
    return this.access.logout(token);
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Header('Cache-Control', 'no-store')
  settings() {
    return this.access.settings();
  }

  @Put('settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  setPassword(@Body() body: AccessPasswordDto) {
    return this.access.setPassword(body.password);
  }
}
