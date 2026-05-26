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
import { MenusService } from './menus.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { CloneMenuDto } from './dto/clone-menu.dto';
import { MenuResponseDto } from './dto/menu-response.dto';
import { UpdateMenuStatusDto } from './dto/update-menu-status.dto';
import { UserMenuResponseDto } from './dto/user-menu-response.dto';

@ApiTags('Menus')
@Controller('menus')
export class MenusController {
  constructor(private readonly menus: MenusService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({
    description: 'Unauthorized (missing/invalid Bearer token)',
  })
  @ApiOperation({ summary: 'Create menu' })
  @ApiCreatedResponse({
    description: 'Menu created',
    type: MenuResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation error or referenced IDs not found',
  })
  @ApiConflictResponse({ description: 'A menu for this date already exists' })
  create(@Body() dto: CreateMenuDto): Promise<MenuResponseDto> {
    return this.menus.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List menus (public)' })
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
    description: 'Pagination limit (default 50, max 200)',
  })
  @ApiOkResponse({
    description: 'List of menus',
    type: MenuResponseDto,
    isArray: true,
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Filter by start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Filter by end date (YYYY-MM-DD)',
  })
  @ApiBadRequestResponse({
    description: 'Invalid query params (e.g., take > 200)',
  })
  findAll(
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<MenuResponseDto[]> {
    return this.menus.findAll({ skip, take, startDate, endDate });
  }

  @Get('by-date/:date')
  @ApiOperation({ summary: 'Get menu by date (public)' })
  @ApiParam({ name: 'date', description: 'Date in YYYY-MM-DD format' })
  @ApiOkResponse({
    description: 'Menu found',
    type: MenuResponseDto,
  })
  @ApiNotFoundResponse({ description: 'No menu found for this date' })
  findByDate(@Param('date') date: string): Promise<MenuResponseDto> {
    return this.menus.findByDate(date);
  }

  @Get('by-date/:date/user/:cc')
  @ApiOperation({
    summary: 'Get menu by date with user reservation status (public)',
  })
  @ApiParam({ name: 'date', description: 'Date in YYYY-MM-DD format' })
  @ApiParam({ name: 'cc', description: 'User document (CC)' })
  @ApiOkResponse({
    description: 'Menu found with optional user reservation',
    type: UserMenuResponseDto,
  })
  @ApiNotFoundResponse({ description: 'No menu found for this date' })
  findForUserByDate(
    @Param('date') date: string,
    @Param('cc') cc: string,
  ): Promise<UserMenuResponseDto> {
    return this.menus.findForUserByDate(
      date,
      cc,
    ) as Promise<UserMenuResponseDto>;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({
    description: 'Unauthorized (missing/invalid Bearer token)',
  })
  @ApiOperation({ summary: 'Get menu by id' })
  @ApiParam({ name: 'id', description: 'Menu UUID' })
  @ApiOkResponse({
    description: 'Menu found',
    type: MenuResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Menu not found' })
  findOne(@Param('id') id: string): Promise<MenuResponseDto> {
    return this.menus.findOne(id);
  }

  @Post(':id/clone')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({
    description: 'Unauthorized (missing/invalid Bearer token)',
  })
  @ApiOperation({ summary: 'Clone menu to a new date' })
  @ApiParam({ name: 'id', description: 'Source Menu UUID' })
  @ApiCreatedResponse({
    description: 'Menu cloned',
    type: MenuResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Source menu not found' })
  @ApiConflictResponse({
    description: 'A menu for the target date already exists',
  })
  clone(
    @Param('id') id: string,
    @Body() dto: CloneMenuDto,
  ): Promise<MenuResponseDto> {
    return this.menus.clone(id, dto.date);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({
    description: 'Unauthorized (missing/invalid Bearer token)',
  })
  @ApiOperation({
    summary: 'Update menu status manually',
  })
  @ApiParam({ name: 'id', description: 'Menu UUID' })
  @ApiOkResponse({
    description: 'Menu status updated',
    type: MenuResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Menu not found' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMenuStatusDto,
  ): Promise<MenuResponseDto> {
    return this.menus.updateStatus(id, dto.status) as Promise<MenuResponseDto>;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({
    description: 'Unauthorized (missing/invalid Bearer token)',
  })
  @ApiOperation({
    summary: 'Update menu (scalars, protein options, side options)',
  })
  @ApiParam({ name: 'id', description: 'Menu UUID' })
  @ApiOkResponse({
    description: 'Menu updated',
    type: MenuResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation error or referenced IDs not found',
  })
  @ApiConflictResponse({ description: 'Duplicate protein or side dish option' })
  @ApiNotFoundResponse({ description: 'Menu not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMenuDto,
  ): Promise<MenuResponseDto> {
    return this.menus.update(id, dto) as Promise<MenuResponseDto>;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({
    description: 'Unauthorized (missing/invalid Bearer token)',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete menu (hard)' })
  @ApiParam({ name: 'id', description: 'Menu UUID' })
  @ApiNoContentResponse({ description: 'Menu deleted' })
  @ApiNotFoundResponse({ description: 'Menu not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.menus.delete(id);
  }
}
