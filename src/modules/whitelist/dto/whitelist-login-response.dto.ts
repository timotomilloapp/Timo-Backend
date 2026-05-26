import { ApiProperty } from '@nestjs/swagger';

export class WhitelistLoginResponseDto {
  @ApiProperty({ example: 'uuid-public-token' })
  publicToken!: string;

  @ApiProperty({ example: '1234567890' })
  cc!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  name!: string;
}
