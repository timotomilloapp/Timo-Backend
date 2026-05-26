import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateAppetizerDto {
  @ApiProperty({
    example: 10,
    description: 'Quantity of appetizers to order',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({
    example: 'uuid',
    description: 'Area UUID where the appetizer is requested',
  })
  @IsUUID()
  areaId!: string;

  @ApiProperty({
    example: '2026-03-01',
    description: 'Date for which the appetizer is requested (YYYY-MM-DD)',
  })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({
    example: 'Observaciones para el pedido de aperitivos...',
    description: 'Observations or notes for the request',
  })
  @IsOptional()
  @IsString()
  observations?: string;
}
