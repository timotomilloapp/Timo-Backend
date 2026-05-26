import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
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
import { AreasService } from './areas.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { AreaResponseDto } from './dto/area-response.dto';

@ApiTags('Areas')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Unauthorized (missing/invalid Bearer token)',
})
@UseGuards(JwtAuthGuard)
@Controller('areas')
export class AreasController {
  constructor(private readonly areas: AreasService) {}

  @Post()
  @ApiOperation({ summary: 'Create area' })
  @ApiCreatedResponse({
    description: 'Area created',
    type: AreaResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiConflictResponse({ description: 'Area name already exists' })
  create(@Body() dto: CreateAreaDto): Promise<AreaResponseDto> {
    return this.areas.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List areas' })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search by name (contains, case-insensitive)',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
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
    description: 'List of areas',
    type: AreaResponseDto,
    isArray: true,
  })
  @ApiBadRequestResponse({
    description: 'Invalid query params (e.g., take > 200)',
  })
  findAll(
    @Query('q') q?: string,
    @Query('active', new ParseBoolPipe({ optional: true })) active?: boolean,
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
  ): Promise<AreaResponseDto[]> {
    return this.areas.findAll({ q, active, skip, take });
  }

  @Get('active/all')
  @ApiOperation({ summary: 'List all active areas without pagination' })
  @ApiOkResponse({
    description: 'List of all active areas',
    type: AreaResponseDto,
    isArray: true,
  })
  findAllActive(): Promise<AreaResponseDto[]> {
    return this.areas.findAllActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get area by id' })
  @ApiParam({ name: 'id', description: 'Area UUID' })
  @ApiOkResponse({
    description: 'Area found',
    type: AreaResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Area not found' })
  findOne(@Param('id') id: string): Promise<AreaResponseDto> {
    return this.areas.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update area name' })
  @ApiParam({ name: 'id', description: 'Area UUID' })
  @ApiOkResponse({
    description: 'Area updated',
    type: AreaResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiConflictResponse({ description: 'Area name already exists' })
  @ApiNotFoundResponse({ description: 'Area not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAreaDto,
  ): Promise<AreaResponseDto> {
    return this.areas.update(id, dto);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle area active status' })
  @ApiParam({ name: 'id', description: 'Area UUID' })
  @ApiOkResponse({
    description: 'Area status toggled',
    type: AreaResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Area not found' })
  toggle(@Param('id') id: string): Promise<AreaResponseDto> {
    return this.areas.toggle(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete area (hard)' })
  @ApiParam({ name: 'id', description: 'Area UUID' })
  @ApiNoContentResponse({ description: 'Area deleted' })
  @ApiNotFoundResponse({ description: 'Area not found' })
  @ApiConflictResponse({
    description: 'Cannot delete: area is referenced by appetizers',
  })
  async delete(@Param('id') id: string): Promise<void> {
    await this.areas.delete(id);
  }
}
