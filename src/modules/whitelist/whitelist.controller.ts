import {
  BadRequestException,
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
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
import { WhitelistService } from './whitelist.service';
import { CreateWhitelistDto } from './dto/create-whitelist.dto';
import { UpdateWhitelistDto } from './dto/update-whitelist.dto';
import { WhitelistResponseDto } from './dto/whitelist-response.dto';
import { BulkResultResponseDto } from './dto/bulk-result-response.dto';
import { WhitelistLoginDto } from './dto/whitelist-login.dto';
import { WhitelistLoginResponseDto } from './dto/whitelist-login-response.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Whitelist')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Unauthorized (missing/invalid Bearer token)',
})
@UseGuards(JwtAuthGuard)
@Controller('whitelist')
export class WhitelistController {
  constructor(private readonly whitelist: WhitelistService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login by cédula (CC) — no JWT required',
    description:
      'Validates the cédula against the whitelist. Returns the publicToken and user info for subsequent reservation calls.',
  })
  @ApiOkResponse({
    description: 'Login successful',
    type: WhitelistLoginResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiUnauthorizedResponse({ description: 'CC not found or disabled' })
  login(@Body() dto: WhitelistLoginDto): Promise<WhitelistLoginResponseDto> {
    return this.whitelist.login(dto.cc);
  }

  @Post()
  @ApiOperation({ summary: 'Create whitelist entry' })
  @ApiCreatedResponse({
    description: 'Whitelist entry created',
    type: WhitelistResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiConflictResponse({ description: 'CC already exists' })
  create(@Body() dto: CreateWhitelistDto): Promise<WhitelistResponseDto> {
    return this.whitelist.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List whitelist entries' })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search by name or cc (contains, case-insensitive)',
  })
  @ApiQuery({
    name: 'enabled',
    required: false,
    type: Boolean,
    description: 'Filter by enabled status',
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
    description: 'List of whitelist entries with total count',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/WhitelistResponseDto' },
        },
        total: { type: 'number' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid query params (e.g., take > 200)',
  })
  findAll(
    @Query('q') q?: string,
    @Query('enabled', new ParseBoolPipe({ optional: true })) enabled?: boolean,
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
  ): Promise<{ data: WhitelistResponseDto[]; total: number }> {
    return this.whitelist.findAll({ q, enabled, skip, take });
  }

  @Get('birthdays')
  @ApiOperation({ summary: 'Get upcoming and all birthdays from whitelist' })
  @ApiOkResponse({
    description: 'Birthdays list successfully retrieved',
    schema: {
      type: 'object',
      properties: {
        upcoming: {
          type: 'array',
          items: { $ref: '#/components/schemas/WhitelistResponseDto' },
        },
        all: {
          type: 'array',
          items: { $ref: '#/components/schemas/WhitelistResponseDto' },
        },
      },
    },
  })
  getBirthdays(): Promise<{ upcoming: any[]; all: any[] }> {
    return this.whitelist.getBirthdays();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get whitelist entry by id' })
  @ApiParam({ name: 'id', description: 'WhitelistEntry UUID' })
  @ApiOkResponse({
    description: 'Whitelist entry found',
    type: WhitelistResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Whitelist entry not found' })
  findOne(@Param('id') id: string): Promise<WhitelistResponseDto> {
    return this.whitelist.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update whitelist entry (cc and/or name)' })
  @ApiParam({ name: 'id', description: 'WhitelistEntry UUID' })
  @ApiOkResponse({
    description: 'Whitelist entry updated',
    type: WhitelistResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation error or no fields provided',
  })
  @ApiConflictResponse({ description: 'CC already exists' })
  @ApiNotFoundResponse({ description: 'Whitelist entry not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWhitelistDto,
  ): Promise<WhitelistResponseDto> {
    return this.whitelist.update(id, dto);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Toggle whitelist entry enabled status' })
  @ApiParam({ name: 'id', description: 'WhitelistEntry UUID' })
  @ApiOkResponse({
    description: 'Whitelist entry enabled status toggled',
    type: WhitelistResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Whitelist entry not found' })
  deactivate(@Param('id') id: string): Promise<WhitelistResponseDto> {
    return this.whitelist.deactivate(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete whitelist entry (hard)' })
  @ApiParam({ name: 'id', description: 'WhitelistEntry UUID' })
  @ApiNoContentResponse({ description: 'Whitelist entry deleted' })
  @ApiNotFoundResponse({ description: 'Whitelist entry not found' })
  @ApiConflictResponse({
    description: 'Cannot delete: entry is referenced by reservations',
  })
  async delete(@Param('id') id: string): Promise<void> {
    await this.whitelist.delete(id);
  }

  @Post('bulk')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Bulk create whitelist entries from XLSX or CSV file',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'XLSX or CSV file with columns: cc, name',
        },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({
    description: 'Bulk creation result',
    type: BulkResultResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'No file uploaded or invalid file format',
  })
  async bulkCreate(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<BulkResultResponseDto> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ];

    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file format. Only XLSX and CSV files are allowed.',
      );
    }

    return this.whitelist.bulkCreate(file.buffer);
  }
}
