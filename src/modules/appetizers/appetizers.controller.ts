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
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { AppetizersService } from './appetizers.service';
import { CreateAppetizerDto } from './dto/create-appetizer.dto';
import { UpdateAppetizerDto } from './dto/update-appetizer.dto';
import { AppetizerResponseDto, AppetizerDetailResponseDto } from './dto/appetizer-response.dto';

@ApiTags('Appetizers')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Unauthorized (missing/invalid Bearer token)',
})
@UseGuards(JwtAuthGuard)
@Controller('appetizers')
export class AppetizersController {
  constructor(private readonly appetizers: AppetizersService) {}

  @Post()
  @ApiOperation({ summary: 'Create appetizer order' })
  @ApiCreatedResponse({
    description: 'Appetizer order created',
    type: AppetizerResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation error or inactive Area reference',
  })
  @ApiNotFoundResponse({ description: 'Area not found' })
  create(@Body() dto: CreateAppetizerDto): Promise<AppetizerResponseDto> {
    return this.appetizers.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List appetizer orders' })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search observations (contains, case-insensitive)',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Filter by date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'areaId',
    required: false,
    description: 'Filter by Area UUID',
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
    description: 'List of appetizer orders',
    type: AppetizerResponseDto,
    isArray: true,
  })
  @ApiBadRequestResponse({
    description: 'Invalid query params (e.g., take > 200)',
  })
  findAll(
    @Query('q') q?: string,
    @Query('date') date?: string,
    @Query('areaId') areaId?: string,
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
  ): Promise<AppetizerResponseDto[]> {
    return this.appetizers.findAll({ q, date, areaId, skip, take });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appetizer order by id' })
  @ApiParam({ name: 'id', description: 'Appetizer UUID' })
  @ApiOkResponse({
    description: 'Appetizer order found',
    type: AppetizerResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Appetizer request not found' })
  findOne(@Param('id') id: string): Promise<AppetizerResponseDto> {
    return this.appetizers.findOne(id);
  }

  @Get(':id/details')
  @ApiOperation({ summary: 'Get details of a specific appetizer request' })
  @ApiParam({ name: 'id', description: 'Appetizer UUID' })
  @ApiOkResponse({
    description: 'List of appetizer details by area',
    type: AppetizerDetailResponseDto,
    isArray: true,
  })
  @ApiNotFoundResponse({ description: 'Appetizer request not found' })
  findDetails(@Param('id') id: string): Promise<AppetizerDetailResponseDto[]> {
    return this.appetizers.findDetails(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update appetizer order' })
  @ApiParam({ name: 'id', description: 'Appetizer UUID' })
  @ApiOkResponse({
    description: 'Appetizer order updated',
    type: AppetizerResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation error or inactive Area reference',
  })
  @ApiNotFoundResponse({ description: 'Appetizer request or Area not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAppetizerDto,
    @Req() req: any,
  ): Promise<AppetizerResponseDto> {
    return this.appetizers.update(id, dto, req.user?.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete appetizer order' })
  @ApiParam({ name: 'id', description: 'Appetizer UUID' })
  @ApiNoContentResponse({ description: 'Appetizer order deleted' })
  @ApiNotFoundResponse({ description: 'Appetizer request not found' })
  async delete(
    @Param('id') id: string,
    @Req() req: any,
  ): Promise<void> {
    await this.appetizers.delete(id, req.user?.sub);
  }
}
