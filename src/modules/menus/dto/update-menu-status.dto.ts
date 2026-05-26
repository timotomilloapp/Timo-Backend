import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { MenuStatus } from '@prisma/client';

export class UpdateMenuStatusDto {
  @ApiProperty({
    enum: MenuStatus,
    description: 'The new status of the menu',
    example: MenuStatus.SERVED,
  })
  @IsEnum(MenuStatus)
  @IsNotEmpty()
  status!: MenuStatus;
}
