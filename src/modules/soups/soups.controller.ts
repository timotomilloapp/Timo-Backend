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
import { SoupsService } from './soups.service';
import { CreateSoupDto } from './dto/create-soup.dto';
import { SoupResponseDto } from './dto/soup-response.dto';

@ApiTags('Soups')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Unauthorized (missing/invalid Bearer token)',
})
@UseGuards(JwtAuthGuard)
@Controller('soups')
export class SoupsController {
  constructor(private readonly soups: SoupsService) {}

  @Post()
  @ApiOperation({ summary: 'Create soup' })
  @ApiCreatedResponse({
    description: 'Soup created',
    type: SoupResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiConflictResponse({ description: 'Soup name already exists' })
  create(@Body() dto: CreateSoupDto): Promise<SoupResponseDto> {
    return this.soups.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List soups' })
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
    description: 'List of soups',
    type: SoupResponseDto,
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
  ): Promise<SoupResponseDto[]> {
    return this.soups.findAll({ q, active, skip, take });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get soup by id' })
  @ApiParam({ name: 'id', description: 'Soup UUID' })
  @ApiOkResponse({
    description: 'Soup found',
    type: SoupResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Soup not found' })
  findOne(@Param('id') id: string): Promise<SoupResponseDto> {
    return this.soups.findOne(id);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle soup active status' })
  @ApiParam({ name: 'id', description: 'Soup UUID' })
  @ApiOkResponse({
    description: 'Soup status toggled',
    type: SoupResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Soup not found' })
  toggle(@Param('id') id: string): Promise<SoupResponseDto> {
    return this.soups.toggle(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete soup (hard)' })
  @ApiParam({ name: 'id', description: 'Soup UUID' })
  @ApiNoContentResponse({ description: 'Soup deleted' })
  @ApiNotFoundResponse({ description: 'Soup not found' })
  @ApiConflictResponse({
    description: 'Cannot delete: soup is referenced by menus',
  })
  async delete(@Param('id') id: string): Promise<void> {
    await this.soups.delete(id);
  }
}
