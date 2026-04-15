import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProteinDto {
  @ApiPropertyOptional({
    example: 'Pollo asado',
    description: 'New name for the protein type',
    minLength: 2,
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Active status of the protein type',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
