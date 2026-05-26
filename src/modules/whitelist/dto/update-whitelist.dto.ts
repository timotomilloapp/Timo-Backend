import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateWhitelistDto {
  @ApiPropertyOptional({
    example: '1234567890',
    description: 'Cédula (identification number)',
    minLength: 2,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  cc?: string;

  @ApiPropertyOptional({
    example: 'Juan Pérez',
    description: 'Full name',
    minLength: 2,
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: '1995-10-15',
    description: 'Date of birth (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  birthdate?: string;

  @ApiPropertyOptional({
    example: 'uuid',
    description: 'Area UUID reference',
  })
  @IsOptional()
  @IsUUID()
  areaId?: string;
}
