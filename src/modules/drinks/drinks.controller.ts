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
import { DrinksService } from './drinks.service';
import { CreateDrinkDto } from './dto/create-drink.dto';
import { DrinkResponseDto } from './dto/drink-response.dto';

@ApiTags('Drinks')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Unauthorized (missing/invalid Bearer token)',
})
@UseGuards(JwtAuthGuard)
@Controller('drinks')
export class DrinksController {
  constructor(private readonly drinks: DrinksService) {}

  @Post()
  @ApiOperation({ summary: 'Create drink' })
  @ApiCreatedResponse({
    description: 'Drink created',
    type: DrinkResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiConflictResponse({ description: 'Drink name already exists' })
  create(@Body() dto: CreateDrinkDto): Promise<DrinkResponseDto> {
    return this.drinks.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List drinks' })
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
    description: 'List of drinks',
    type: DrinkResponseDto,
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
  ): Promise<DrinkResponseDto[]> {
    return this.drinks.findAll({ q, active, skip, take });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get drink by id' })
  @ApiParam({ name: 'id', description: 'Drink UUID' })
  @ApiOkResponse({
    description: 'Drink found',
    type: DrinkResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Drink not found' })
  findOne(@Param('id') id: string): Promise<DrinkResponseDto> {
    return this.drinks.findOne(id);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle drink active status' })
  @ApiParam({ name: 'id', description: 'Drink UUID' })
  @ApiOkResponse({
    description: 'Drink status toggled',
    type: DrinkResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Drink not found' })
  toggle(@Param('id') id: string): Promise<DrinkResponseDto> {
    return this.drinks.toggle(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete drink (hard)' })
  @ApiParam({ name: 'id', description: 'Drink UUID' })
  @ApiNoContentResponse({ description: 'Drink deleted' })
  @ApiNotFoundResponse({ description: 'Drink not found' })
  @ApiConflictResponse({
    description: 'Cannot delete: drink is referenced by menus',
  })
  async delete(@Param('id') id: string): Promise<void> {
    await this.drinks.delete(id);
  }
}
