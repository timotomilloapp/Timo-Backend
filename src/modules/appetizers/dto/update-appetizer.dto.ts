import { ApiPropertyOptional } from '@nestjs/swagger';
import { AppetizerStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { AppetizerDetailDto } from './create-appetizer.dto';

export class UpdateAppetizerDto {
  @ApiPropertyOptional({
    example: '2026-03-01',
    description: 'Date for which the appetizer is requested (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    example: 'Observaciones actualizadas...',
    description: 'Observations or notes for the request',
  })
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiPropertyOptional({
    enum: AppetizerStatus,
    example: AppetizerStatus.PENDIENTE,
    description: 'Status of the appetizer request',
  })
  @IsOptional()
  @IsEnum(AppetizerStatus)
  status?: AppetizerStatus;

  @ApiPropertyOptional({
    type: [AppetizerDetailDto],
    description: 'Breakdown of appetizer quantities per area',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppetizerDetailDto)
  details?: AppetizerDetailDto[];
}
