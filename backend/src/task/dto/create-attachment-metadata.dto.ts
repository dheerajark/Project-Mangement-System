import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAttachmentMetadataDto {
  @ApiProperty({ example: 'document.pdf', description: 'The name of the file' })
  @IsString()
  @IsNotEmpty({ message: 'File name is required' })
  fileName: string;

  @ApiProperty({ example: '/uploads/document.pdf', description: 'The storage URL of the file' })
  @IsString()
  @IsNotEmpty({ message: 'File URL is required' })
  fileUrl: string;

  @ApiProperty({ example: 1048576, description: 'The size of the file in bytes' })
  @IsNumber()
  @IsNotEmpty({ message: 'File size is required' })
  fileSize: number;
}
