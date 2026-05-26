import { ApiPropertyOptional } from '@nestjs/swagger';
import { AppetizerStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdateAppetizerDto {
  @ApiPropertyOptional({
    example: 12,
    description: 'Quantity of appetizers to order',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({
    example: 'uuid',
    description: 'Area UUID where the appetizer is requested',
  })
  @IsOptional()
  @IsUUID()
  areaId?: string;

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
}
