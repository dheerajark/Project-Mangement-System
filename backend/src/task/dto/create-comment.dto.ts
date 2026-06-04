import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ example: 'This is a comment on the task.', description: 'The text content of the comment' })
  @IsString()
  @IsNotEmpty({ message: 'Comment content is required' })
  content: string;
}
