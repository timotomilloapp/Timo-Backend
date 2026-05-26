import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class UpdateReservationDto {
  @ApiProperty({
    example: '1234567890',
    description: 'User document (CC) to verify ownership',
  })
  @IsNotEmpty()
  @IsString()
  cc!: string;

  @ApiProperty({
    example: 'uuid',
    description: 'New ProteinType UUID',
  })
  @IsUUID()
  proteinTypeId!: string;
}
