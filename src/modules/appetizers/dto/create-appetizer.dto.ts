import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

export class AppetizerDetailDto {
  @ApiProperty({
    example: 'uuid',
    description: 'Area UUID where the appetizer is requested',
  })
  @IsUUID()
  areaId!: string;

  @ApiProperty({
    example: 5,
    description: 'Quantity of appetizers to order for this area',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateAppetizerDto {
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

  @ApiProperty({
    type: [AppetizerDetailDto],
    description: 'Breakdown of appetizer quantities per area',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe ingresar al menos un detalle para un área.' })
  @ValidateNested({ each: true })
  @Type(() => AppetizerDetailDto)
  details!: AppetizerDetailDto[];
}
