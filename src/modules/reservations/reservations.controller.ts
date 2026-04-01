import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { CancelReservationDto } from './dto/cancel-reservation.dto';
import { ReservationResponseDto } from './dto/reservation-response.dto';
import { ReservationSummaryDto } from './dto/reservation-summary.dto';

@ApiTags('Reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) { }

  /* ───────── PUBLIC ENDPOINTS (by CC) ───────── */

  @Post()
  @ApiOperation({ summary: 'Create reservation (public – uses CC)' })
  @ApiCreatedResponse({
    description: 'Reservation created',
    type: ReservationResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Validation error, protein not in menu, or same-day auto-assigned',
  })
  @ApiNotFoundResponse({ description: 'CC not in whitelist or menu not found' })
  @ApiForbiddenResponse({ description: 'User disabled in whitelist' })
  @ApiConflictResponse({
    description: 'Reservation already exists for this menu and CC',
  })
  create(@Body() dto: CreateReservationDto): Promise<ReservationResponseDto> {
    return this.reservations.create(dto) as Promise<ReservationResponseDto>;
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update reservation protein (public – uses CC in body)',
  })
  @ApiParam({ name: 'id', description: 'Reservation UUID' })
  @ApiOkResponse({
    description: 'Reservation updated',
    type: ReservationResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation error, same-day change, or protein not in menu',
  })
  @ApiNotFoundResponse({ description: 'Reservation not found' })
  @ApiForbiddenResponse({ description: 'CC does not match reservation owner' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
  ): Promise<ReservationResponseDto> {
    return this.reservations.update(id, dto) as Promise<ReservationResponseDto>;
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel reservation (public – uses CC in body)' })
  @ApiParam({ name: 'id', description: 'Reservation UUID' })
  @ApiOkResponse({
    description: 'Reservation cancelled',
    type: ReservationResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Same-day cancellation not allowed or already cancelled',
  })
  @ApiNotFoundResponse({ description: 'Reservation not found' })
  @ApiForbiddenResponse({ description: 'CC does not match reservation owner' })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelReservationDto,
  ): Promise<ReservationResponseDto> {
    return this.reservations.cancel(
      id,
      dto.cc,
    ) as Promise<ReservationResponseDto>;
  }

  @Get('by-cc/:cc')
  @ApiOperation({ summary: 'List reservations by CC (public – user reminder)' })
  @ApiParam({ name: 'cc', description: 'User document (CC)' })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Filter by menu date (YYYY-MM-DD)',
  })
  @ApiOkResponse({
    description: 'List of user reservations',
    type: ReservationResponseDto,
    isArray: true,
  })
  findByCC(
    @Param('cc') cc: string,
    @Query('date') date?: string,
  ): Promise<ReservationResponseDto[]> {
    return this.reservations.findByCC(cc, date) as Promise<
      ReservationResponseDto[]
    >;
  }

  /* ───────── ADMIN ENDPOINTS (JWT) ───────── */

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({
    description: 'Unauthorized (missing/invalid Bearer token)',
  })
  @ApiOperation({ summary: 'List all reservations (admin)' })
  @ApiQuery({
    name: 'skip',
    required: false,
    type: Number,
    description: 'Pagination offset (default 0)',
  })
  @ApiQuery({
    name: 'take',
    required: false,
    type: Number,
    description: 'Pagination limit (default 500, max 1000)',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Filter by menu date (YYYY-MM-DD)',
  })
  @ApiOkResponse({
    description: 'List of all reservations',
    type: ReservationResponseDto,
    isArray: true,
  })
  @ApiBadRequestResponse({
    description: 'Invalid query params (e.g., take > 200)',
  })
  findAll(
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
    @Query('date') date?: string,
  ): Promise<ReservationResponseDto[]> {
    return this.reservations.findAll({ skip, take, date }) as Promise<
      ReservationResponseDto[]
    >;
  }

  @Get('by-menu/:menuId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({
    description: 'Unauthorized (missing/invalid Bearer token)',
  })
  @ApiOperation({ summary: 'List reservations by menu ID (admin)' })
  @ApiParam({ name: 'menuId', description: 'Menu UUID' })
  @ApiOkResponse({
    description: 'List of reservations for the given menu',
    type: ReservationResponseDto,
    isArray: true,
  })
  findByMenuId(
    @Param('menuId') menuId: string,
  ): Promise<ReservationResponseDto[]> {
    return this.reservations.findByMenuId(menuId) as Promise<
      ReservationResponseDto[]
    >;
  }

  @Get('summary/:date')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({
    description: 'Unauthorized (missing/invalid Bearer token)',
  })
  @ApiOperation({ summary: 'Protein summary by date (restaurant view)' })
  @ApiParam({ name: 'date', description: 'Date in YYYY-MM-DD format' })
  @ApiOkResponse({
    description: 'Summary with global status and protein counts',
    type: ReservationSummaryDto,
  })
  @ApiNotFoundResponse({ description: 'No menu found for this date' })
  findSummaryByDate(
    @Param('date') date: string,
  ): Promise<ReservationSummaryDto> {
    return this.reservations.findSummaryByDate(
      date,
    ) as Promise<ReservationSummaryDto>;
  }

  @Patch(':id/printed')
  @ApiOperation({ summary: 'Mark reservation ticket as printed (public - triggered by user print)' })
  @ApiParam({ name: 'id', description: 'Reservation UUID' })
  @ApiOkResponse({
    description: 'Reservation marked as printed',
    type: ReservationResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Reservation not found' })
  markAsPrinted(@Param('id') id: string): Promise<ReservationResponseDto> {
    return this.reservations.markAsPrinted(id) as Promise<ReservationResponseDto>;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete reservation (public - uses CC)' })
  @ApiParam({ name: 'id', description: 'Reservation UUID' })
  @ApiQuery({ name: 'cc', description: 'User document (CC) to verify ownership', required: true })
  @ApiNoContentResponse({ description: 'Reservation deleted' })
  @ApiNotFoundResponse({ description: 'Reservation not found' })
  @ApiForbiddenResponse({ description: 'CC does not match reservation owner' })
  async delete(@Param('id') id: string, @Query('cc') cc: string): Promise<void> {
    await this.reservations.delete(id, cc);
  }

  @Patch('bulk-served/:date')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({
    description: 'Unauthorized (missing/invalid Bearer token)',
  })
  @ApiOperation({
    summary: 'Bulk mark reservations as SERVIDA by date (admin)',
  })
  @ApiParam({ name: 'date', description: 'Date in YYYY-MM-DD format' })
  @ApiOkResponse({
    description: 'Bulk update result with count of updated reservations',
  })
  @ApiNotFoundResponse({ description: 'No menu found for this date' })
  bulkMarkServed(@Param('date') date: string) {
    return this.reservations.bulkMarkServed(date);
  }

  @Patch('bulk-cancelled/:date')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({
    description: 'Unauthorized (missing/invalid Bearer token)',
  })
  @ApiOperation({
    summary: 'Bulk mark reservations as CANCELADA by date (admin)',
  })
  @ApiParam({ name: 'date', description: 'Date in YYYY-MM-DD format' })
  @ApiOkResponse({
    description: 'Bulk update result with count of updated reservations',
  })
  @ApiNotFoundResponse({ description: 'No menu found for this date' })
  bulkMarkCancelled(@Param('date') date: string) {
    return this.reservations.bulkMarkCancelled(date);
  }
}
