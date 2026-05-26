import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AreaResponseDto } from '../../areas/dto/area-response.dto';

export class WhitelistResponseDto {
  @ApiProperty({ example: 'uuid' })
  id!: string;

  @ApiProperty({ example: '1234567890' })
  cc!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  name!: string;

  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({ example: 'uuid' })
  publicToken!: string;

  @ApiPropertyOptional({ example: '1995-10-15', nullable: true })
  birthdate!: Date | null;

  @ApiPropertyOptional({ example: 'uuid', nullable: true })
  areaId!: string | null;

  @ApiPropertyOptional({ type: () => AreaResponseDto, nullable: true })
  area!: AreaResponseDto | null;

  @ApiProperty({ example: '2026-02-20T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-02-20T00:00:00.000Z' })
  updatedAt!: Date;
}
