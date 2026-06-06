import { IsString, IsNotEmpty } from 'class-validator';

export class CreateIssueCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
