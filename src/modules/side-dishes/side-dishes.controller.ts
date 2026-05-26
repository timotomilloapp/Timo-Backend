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
import { SideDishesService } from './side-dishes.service';
import { CreateSideDishDto } from './dto/create-side-dish.dto';
import { SideDishResponseDto } from './dto/side-dish-response.dto';

@ApiTags('Side Dishes')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Unauthorized (missing/invalid Bearer token)',
})
@UseGuards(JwtAuthGuard)
@Controller('side-dishes')
export class SideDishesController {
  constructor(private readonly sideDishes: SideDishesService) {}

  @Post()
  @ApiOperation({ summary: 'Create side dish' })
  @ApiCreatedResponse({
    description: 'Side dish created',
    type: SideDishResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiConflictResponse({ description: 'Side dish name already exists' })
  create(@Body() dto: CreateSideDishDto): Promise<SideDishResponseDto> {
    return this.sideDishes.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List side dishes' })
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
    description: 'List of side dishes',
    type: SideDishResponseDto,
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
  ): Promise<SideDishResponseDto[]> {
    return this.sideDishes.findAll({ q, active, skip, take });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get side dish by id' })
  @ApiParam({ name: 'id', description: 'SideDish UUID' })
  @ApiOkResponse({
    description: 'Side dish found',
    type: SideDishResponseDto,
  })
  @ApiNotFoundResponse({ description: 'SideDish not found' })
  findOne(@Param('id') id: string): Promise<SideDishResponseDto> {
    return this.sideDishes.findOne(id);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle side dish active status' })
  @ApiParam({ name: 'id', description: 'SideDish UUID' })
  @ApiOkResponse({
    description: 'Side dish status toggled',
    type: SideDishResponseDto,
  })
  @ApiNotFoundResponse({ description: 'SideDish not found' })
  toggle(@Param('id') id: string): Promise<SideDishResponseDto> {
    return this.sideDishes.toggle(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete side dish (hard)' })
  @ApiParam({ name: 'id', description: 'SideDish UUID' })
  @ApiNoContentResponse({ description: 'Side dish deleted' })
  @ApiNotFoundResponse({ description: 'SideDish not found' })
  @ApiConflictResponse({
    description: 'Cannot delete: side dish is referenced by menus/reservations',
  })
  async delete(@Param('id') id: string): Promise<void> {
    await this.sideDishes.delete(id);
  }
}
