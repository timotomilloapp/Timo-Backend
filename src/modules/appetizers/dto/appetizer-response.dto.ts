import { ApiProperty } from '@nestjs/swagger';
import { AreaResponseDto } from '../../areas/dto/area-response.dto';

export class AppetizerResponseDto {
  @ApiProperty({ example: 'uuid' })
  id!: string;

  @ApiProperty({ example: 10 })
  quantity!: number;

  @ApiProperty({ example: 'uuid' })
  areaId!: string;

  @ApiProperty({ type: () => AreaResponseDto })
  area?: AreaResponseDto;

  @ApiProperty({ example: '2026-03-01' })
  date!: string | Date;

  @ApiProperty({ example: 'Observaciones de aperitivos' })
  observations!: string;

  @ApiProperty({ example: '2026-02-20T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-02-20T00:00:00.000Z' })
  updatedAt!: Date;
}
