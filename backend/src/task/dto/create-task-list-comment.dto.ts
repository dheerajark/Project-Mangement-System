import { IsNotEmpty, IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskListCommentDto {
  @ApiProperty({
    example: 'This is a comment on the task list.',
    description: 'The text content of the comment',
  })
  @IsString()
  @IsNotEmpty({ message: 'Comment content is required' })
  content: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Array of mentioned user IDs',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentionedUserIds?: string[];

  @ApiPropertyOptional({
    type: [Object],
    description: 'Array of attachment metadata objects',
  })
  @IsOptional()
  @IsArray()
  attachments?: {
    fileName: string;
    fileUrl: string;
    fileSize?: number;
  }[];
}
