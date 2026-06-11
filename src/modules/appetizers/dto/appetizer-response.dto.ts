import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AreaResponseDto } from '../../areas/dto/area-response.dto';
import { AppetizerStatus } from '@prisma/client';

export class AppetizerDetailResponseDto {
  @ApiProperty({ example: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'uuid' })
  appetizerId!: string;

  @ApiProperty({ example: 'uuid' })
  areaId!: string;

  @ApiProperty({ type: () => AreaResponseDto })
  area?: AreaResponseDto;

  @ApiProperty({ example: 5 })
  quantity!: number;
}

export class AppetizerResponseDto {
  @ApiProperty({ example: 'uuid' })
  id!: string;

  @ApiProperty({ example: 10 })
  quantity!: number;

  @ApiProperty({ example: '2026-03-01' })
  date!: string | Date;

  @ApiProperty({ example: 'Observaciones de aperitivos' })
  observations!: string;

  @ApiProperty({ enum: AppetizerStatus, example: AppetizerStatus.PENDIENTE })
  status!: AppetizerStatus;

  @ApiProperty({ example: '2026-02-20T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-02-20T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ type: [AppetizerDetailResponseDto] })
  details?: AppetizerDetailResponseDto[];
}
