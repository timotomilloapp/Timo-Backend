import { ApiProperty } from '@nestjs/swagger';

class BulkErrorItem {
  @ApiProperty({ example: 2, description: 'Row number in the file' })
  row!: number;

  @ApiProperty({
    example: '1234567890',
    description: 'CC value of the failed row',
  })
  cc!: string;

  @ApiProperty({ example: 'Duplicate cc', description: 'Reason for failure' })
  reason!: string;
}

export class BulkResultResponseDto {
  @ApiProperty({
    example: 10,
    description: 'Number of entries successfully created',
  })
  created!: number;

  @ApiProperty({
    example: 2,
    description: 'Number of entries skipped (duplicates)',
  })
  skipped!: number;

  @ApiProperty({
    type: [BulkErrorItem],
    description: 'Details of rows that failed validation',
  })
  errors!: BulkErrorItem[];

  @ApiProperty({
    example: 5,
    description: 'Number of entries successfully updated',
    required: false,
  })
  updated?: number;
}
