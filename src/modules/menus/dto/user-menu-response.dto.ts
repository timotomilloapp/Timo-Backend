import { ApiProperty } from '@nestjs/swagger';
import { MenuResponseDto } from './menu-response.dto';

export class UserMenuResponseDto extends MenuResponseDto {
    @ApiProperty({
        description: 'Indicates if the user has a reservation for this menu',
        type: Boolean,
        example: true,
    })
    hasReservation: boolean = false;

    @ApiProperty({
        description: 'The UUID of the reservation, if the user has one',
        type: String,
        required: false,
        nullable: true,
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    reservationId?: string | null;

    @ApiProperty({
        description: 'Indicates if the reservation ticket has already been printed',
        type: Boolean,
        required: false,
    })
    isPrinted?: boolean;
}
