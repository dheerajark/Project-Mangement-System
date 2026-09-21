import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTaskListCommentDto {
  @ApiProperty({
    example: 'Updated comment content.',
    description: 'The updated text content of the comment',
  })
  @IsString()
  @IsNotEmpty({ message: 'Comment content is required' })
  content: string;
}
