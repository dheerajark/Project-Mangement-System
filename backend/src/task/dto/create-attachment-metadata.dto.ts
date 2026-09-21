import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAttachmentMetadataDto {
  @ApiProperty({ example: 'document.pdf', description: 'The name of the file' })
  @IsString()
  @IsNotEmpty({ message: 'File name is required' })
  fileName: string;

  @ApiProperty({
    example: '/uploads/document.pdf',
    description: 'The storage URL of the file',
  })
  @IsString()
  @IsNotEmpty({ message: 'File URL is required' })
  fileUrl: string;

  @ApiProperty({
    example: 1048576,
    description: 'The size of the file in bytes',
  })
  @IsNumber()
  @IsNotEmpty({ message: 'File size is required' })
  fileSize: number;

  @ApiPropertyOptional({
    example: 'application/pdf',
    description: 'MIME type of the file',
  })
  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class BulkCreateAttachmentMetadataDto {
  @ApiProperty({
    type: [CreateAttachmentMetadataDto],
    description: 'Array of attachment metadata objects',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAttachmentMetadataDto)
  attachments: CreateAttachmentMetadataDto[];
}

export class UpdateAttachmentMetadataDto {
  @ApiPropertyOptional({
    example: 'renamed_document.pdf',
    description: 'Updated name of the attachment',
  })
  @IsString()
  @IsNotEmpty({ message: 'File name cannot be empty' })
  fileName: string;
}

export class LinkDocumentToTaskDto {
  @ApiProperty({
    example: 'doc-uuid-123',
    description: 'ID of the Project Document to link to this task',
  })
  @IsString()
  @IsNotEmpty({ message: 'documentId is required' })
  documentId: string;
}
