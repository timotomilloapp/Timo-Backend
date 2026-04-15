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
import { ProteinsService } from './proteins.service';
import { CreateProteinDto } from './dto/create-protein.dto';
import { UpdateProteinDto } from './dto/update-protein.dto';
import { ProteinResponseDto } from './dto/protein-response.dto';

@ApiTags('Proteins')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Unauthorized (missing/invalid Bearer token)',
})
@UseGuards(JwtAuthGuard)
@Controller('proteins')
export class ProteinsController {
  constructor(private readonly proteins: ProteinsService) { }

  @Post()
  @ApiOperation({ summary: 'Create protein type' })
  @ApiCreatedResponse({
    description: 'Protein created',
    type: ProteinResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiConflictResponse({ description: 'Protein name already exists' })
  create(@Body() dto: CreateProteinDto): Promise<ProteinResponseDto> {
    return this.proteins.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List protein types' })
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
    description: 'List of protein types',
    type: ProteinResponseDto,
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
  ): Promise<ProteinResponseDto[]> {
    return this.proteins.findAll({ q, active, skip, take });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get protein type by id' })
  @ApiParam({ name: 'id', description: 'ProteinType UUID' })
  @ApiOkResponse({
    description: 'Protein found',
    type: ProteinResponseDto,
  })
  @ApiNotFoundResponse({ description: 'ProteinType not found' })
  findOne(@Param('id') id: string): Promise<ProteinResponseDto> {
    return this.proteins.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update protein type name' })
  @ApiParam({ name: 'id', description: 'ProteinType UUID' })
  @ApiOkResponse({
    description: 'Protein updated',
    type: ProteinResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiConflictResponse({ description: 'Protein name already exists' })
  @ApiNotFoundResponse({ description: 'ProteinType not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProteinDto,
  ): Promise<ProteinResponseDto> {
    return this.proteins.update(id, dto);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle protein type active status' })
  @ApiParam({ name: 'id', description: 'ProteinType UUID' })
  @ApiOkResponse({
    description: 'Protein status toggled',
    type: ProteinResponseDto,
  })
  @ApiNotFoundResponse({ description: 'ProteinType not found' })
  toggle(@Param('id') id: string): Promise<ProteinResponseDto> {
    return this.proteins.toggle(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete protein type (hard)' })
  @ApiParam({ name: 'id', description: 'ProteinType UUID' })
  @ApiNoContentResponse({ description: 'Protein deleted' })
  @ApiNotFoundResponse({ description: 'ProteinType not found' })
  @ApiConflictResponse({
    description: 'Cannot delete: protein is referenced by menus/reservations',
  })
  async delete(@Param('id') id: string): Promise<void> {
    await this.proteins.delete(id);
  }
}
