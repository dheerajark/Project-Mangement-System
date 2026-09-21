import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';
import { ReorderCustomFieldsDto } from './dto/reorder-custom-fields.dto';
import { CustomFieldType, TaskCustomField } from '@prisma/client';

@Injectable()
export class CustomFieldService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all active (or all) custom fields for an organization and optional project.
   * Inherits global organization fields + project-specific fields.
   */
  async getCustomFields(
    organizationId: string,
    projectId?: string,
    includeInactive = false,
  ): Promise<TaskCustomField[]> {
    const where: any = {
      organizationId,
      deletedAt: null,
    };

    if (!includeInactive) {
      where.isActive = true;
    }

    if (projectId) {
      where.OR = [{ projectId: null }, { projectId }];
    } else {
      where.projectId = null;
    }

    return this.prisma.taskCustomField.findMany({
      where,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Get a single custom field by ID.
   */
  async getCustomFieldById(
    organizationId: string,
    id: string,
  ): Promise<TaskCustomField> {
    const field = await this.prisma.taskCustomField.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!field) {
      throw new NotFoundException(`Custom field with ID '${id}' not found`);
    }

    return field;
  }

  /**
   * Create a new custom field definition.
   */
  async createCustomField(
    organizationId: string,
    dto: CreateCustomFieldDto,
  ): Promise<TaskCustomField> {
    // Check if apiName is unique within organization and project scope
    const existing = await this.prisma.taskCustomField.findFirst({
      where: {
        organizationId,
        projectId: dto.projectId || null,
        apiName: dto.apiName,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `A custom field with API name '${dto.apiName}' already exists in this scope`,
      );
    }

    // Auto-compute position if not provided
    let position = dto.position;
    if (position === undefined || position === null) {
      const maxField = await this.prisma.taskCustomField.findFirst({
        where: {
          organizationId,
          projectId: dto.projectId || null,
          deletedAt: null,
        },
        orderBy: { position: 'desc' },
      });
      position = maxField ? maxField.position + 1 : 0;
    }

    // Validate options JSON for SELECT and MULTI_SELECT
    if (dto.type === CustomFieldType.SELECT || dto.type === CustomFieldType.MULTI_SELECT) {
      if (dto.options) {
        try {
          const parsed = JSON.parse(dto.options);
          if (!Array.isArray(parsed) || parsed.length === 0) {
            throw new BadRequestException('Options must be a non-empty array of items');
          }
        } catch (e) {
          if (e instanceof BadRequestException) throw e;
          throw new BadRequestException('Options must be valid JSON array string');
        }
      }
    }

    // Validate validation JSON if present
    if (dto.validation) {
      try {
        JSON.parse(dto.validation);
      } catch {
        throw new BadRequestException('Validation must be valid JSON string');
      }
    }

    return this.prisma.taskCustomField.create({
      data: {
        organizationId,
        projectId: dto.projectId || null,
        name: dto.name,
        apiName: dto.apiName,
        type: dto.type,
        description: dto.description || null,
        placeholder: dto.placeholder || null,
        defaultValue: dto.defaultValue || null,
        isRequired: dto.isRequired ?? false,
        isActive: dto.isActive ?? true,
        showInList: dto.showInList ?? true,
        showInKanban: dto.showInKanban ?? false,
        showInGantt: dto.showInGantt ?? false,
        options: dto.options || null,
        validation: dto.validation || null,
        position,
        section: dto.section || 'General',
      },
    });
  }

  /**
   * Update custom field definition.
   */
  async updateCustomField(
    organizationId: string,
    id: string,
    dto: UpdateCustomFieldDto,
  ): Promise<TaskCustomField> {
    const field = await this.getCustomFieldById(organizationId, id);

    // Validate options JSON if updating options
    if (dto.options !== undefined && dto.options !== null) {
      try {
        const parsed = JSON.parse(dto.options);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new BadRequestException('Options must be a non-empty array of items');
        }
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
        throw new BadRequestException('Options must be valid JSON array string');
      }
    }

    // Validate validation JSON if updating validation
    if (dto.validation !== undefined && dto.validation !== null) {
      try {
        JSON.parse(dto.validation);
      } catch {
        throw new BadRequestException('Validation must be valid JSON string');
      }
    }

    return this.prisma.taskCustomField.update({
      where: { id: field.id },
      data: {
        name: dto.name !== undefined ? dto.name : undefined,
        description: dto.description !== undefined ? dto.description : undefined,
        placeholder: dto.placeholder !== undefined ? dto.placeholder : undefined,
        defaultValue: dto.defaultValue !== undefined ? dto.defaultValue : undefined,
        isRequired: dto.isRequired !== undefined ? dto.isRequired : undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
        showInList: dto.showInList !== undefined ? dto.showInList : undefined,
        showInKanban: dto.showInKanban !== undefined ? dto.showInKanban : undefined,
        showInGantt: dto.showInGantt !== undefined ? dto.showInGantt : undefined,
        options: dto.options !== undefined ? dto.options : undefined,
        validation: dto.validation !== undefined ? dto.validation : undefined,
        position: dto.position !== undefined ? dto.position : undefined,
        section: dto.section !== undefined ? dto.section : undefined,
      },
    });
  }

  /**
   * Soft delete custom field definition.
   * Retains historical task data in JSON format while removing the field definition from future active queries.
   */
  async deleteCustomField(organizationId: string, id: string): Promise<TaskCustomField> {
    const field = await this.getCustomFieldById(organizationId, id);
    return this.prisma.taskCustomField.update({
      where: { id: field.id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Reorder custom fields.
   */
  async reorderCustomFields(
    organizationId: string,
    dto: ReorderCustomFieldsDto,
  ): Promise<{ success: boolean }> {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.taskCustomField.updateMany({
          where: { id: item.id, organizationId, deletedAt: null },
          data: { position: item.position },
        }),
      ),
    );
    return { success: true };
  }

  /**
   * Validates and sanitizes custom field values payload against active definitions.
   * Ensures:
   * 1. Required fields are present on creation or when updated.
   * 2. Default values are applied if not explicitly provided during task creation.
   * 3. Values conform to types (numbers, decimals, currencies, dates, booleans, URLs, emails, dropdown options).
   * 4. Validation rules (min/max length, min/max numbers, regex, etc.) are strictly enforced.
   */
  async validateAndSanitizeTaskCustomFields(
    organizationId: string,
    projectId: string,
    customFieldsJson: string | null | undefined,
    isCreate: boolean,
    existingValuesJson?: string | null,
  ): Promise<string | null> {
    const activeFields = await this.getCustomFields(organizationId, projectId, false);

    let parsedPayload: Record<string, any> = {};
    if (customFieldsJson) {
      try {
        parsedPayload = typeof customFieldsJson === 'string' ? JSON.parse(customFieldsJson) : customFieldsJson;
      } catch {
        throw new BadRequestException('Invalid customFields JSON format');
      }
    }

    let existingValues: Record<string, any> = {};
    if (existingValuesJson) {
      try {
        existingValues = typeof existingValuesJson === 'string' ? JSON.parse(existingValuesJson) : existingValuesJson;
      } catch {
        existingValues = {};
      }
    }

    // Merged state for full validation
    const mergedValues: Record<string, any> = isCreate
      ? { ...parsedPayload }
      : { ...existingValues, ...parsedPayload };

    // Process each active field definition
    for (const field of activeFields) {
      const key = field.apiName;
      let val = mergedValues[key];

      // If creating and value is not provided (undefined or null), apply defaultValue
      if (isCreate && (val === undefined || val === null)) {
        if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '') {
          val = field.defaultValue;
          mergedValues[key] = val;
        }
      }

      // Check required
      if (field.isRequired) {
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          throw new BadRequestException(`Custom field '${field.name}' (${field.apiName}) is required`);
        }
      }

      // If value is provided, validate type and constraints
      if (val !== undefined && val !== null && val !== '') {
        const valStr = String(val).trim();
        let validationConfig: any = {};
        if (field.validation) {
          try {
            validationConfig = JSON.parse(field.validation);
          } catch {
            validationConfig = {};
          }
        }

        switch (field.type) {
          case CustomFieldType.TEXT: {
            if (validationConfig.minLength && valStr.length < validationConfig.minLength) {
              throw new BadRequestException(
                `Field '${field.name}' must be at least ${validationConfig.minLength} characters`,
              );
            }
            if (validationConfig.maxLength && valStr.length > validationConfig.maxLength) {
              throw new BadRequestException(
                `Field '${field.name}' cannot exceed ${validationConfig.maxLength} characters`,
              );
            }
            if (validationConfig.regex) {
              const regex = new RegExp(validationConfig.regex);
              if (!regex.test(valStr)) {
                throw new BadRequestException(
                  validationConfig.regexMessage ||
                    `Field '${field.name}' does not match the required format`,
                );
              }
            }
            mergedValues[key] = valStr;
            break;
          }

          case CustomFieldType.TEXTAREA: {
            if (validationConfig.minLength && valStr.length < validationConfig.minLength) {
              throw new BadRequestException(
                `Field '${field.name}' must be at least ${validationConfig.minLength} characters`,
              );
            }
            if (validationConfig.maxLength && valStr.length > validationConfig.maxLength) {
              throw new BadRequestException(
                `Field '${field.name}' cannot exceed ${validationConfig.maxLength} characters`,
              );
            }
            mergedValues[key] = valStr;
            break;
          }

          case CustomFieldType.NUMBER: {
            const num = Number(val);
            if (isNaN(num) || !Number.isInteger(num)) {
              throw new BadRequestException(`Field '${field.name}' must be an integer number`);
            }
            if (validationConfig.minValue !== undefined && num < validationConfig.minValue) {
              throw new BadRequestException(
                `Field '${field.name}' must be at least ${validationConfig.minValue}`,
              );
            }
            if (validationConfig.maxValue !== undefined && num > validationConfig.maxValue) {
              throw new BadRequestException(
                `Field '${field.name}' cannot exceed ${validationConfig.maxValue}`,
              );
            }
            mergedValues[key] = num;
            break;
          }

          case CustomFieldType.DECIMAL:
          case CustomFieldType.CURRENCY:
          case CustomFieldType.PERCENTAGE: {
            const num = Number(val);
            if (isNaN(num)) {
              throw new BadRequestException(`Field '${field.name}' must be a valid number`);
            }
            if (validationConfig.minValue !== undefined && num < validationConfig.minValue) {
              throw new BadRequestException(
                `Field '${field.name}' must be at least ${validationConfig.minValue}`,
              );
            }
            if (validationConfig.maxValue !== undefined && num > validationConfig.maxValue) {
              throw new BadRequestException(
                `Field '${field.name}' cannot exceed ${validationConfig.maxValue}`,
              );
            }
            if (field.type === CustomFieldType.PERCENTAGE && validationConfig.minValue === undefined && num < 0) {
              throw new BadRequestException(`Field '${field.name}' percentage cannot be negative`);
            }
            mergedValues[key] = num;
            break;
          }

          case CustomFieldType.DATE: {
            const d = new Date(valStr);
            if (isNaN(d.getTime())) {
              throw new BadRequestException(`Field '${field.name}' must be a valid date`);
            }
            if (validationConfig.minDate && new Date(valStr) < new Date(validationConfig.minDate)) {
              throw new BadRequestException(
                `Field '${field.name}' cannot be earlier than ${validationConfig.minDate}`,
              );
            }
            if (validationConfig.maxDate && new Date(valStr) > new Date(validationConfig.maxDate)) {
              throw new BadRequestException(
                `Field '${field.name}' cannot be later than ${validationConfig.maxDate}`,
              );
            }
            mergedValues[key] = valStr.substring(0, 10);
            break;
          }

          case CustomFieldType.DATETIME: {
            const d = new Date(valStr);
            if (isNaN(d.getTime())) {
              throw new BadRequestException(`Field '${field.name}' must be a valid date & time`);
            }
            mergedValues[key] = d.toISOString();
            break;
          }

          case CustomFieldType.CHECKBOX: {
            const boolVal = val === true || val === 'true' || val === 1 || val === '1';
            mergedValues[key] = boolVal;
            break;
          }

          case CustomFieldType.SELECT: {
            let allowedValues: string[] = [];
            if (field.options) {
              try {
                const parsedOpts = JSON.parse(field.options);
                if (Array.isArray(parsedOpts)) {
                  allowedValues = parsedOpts.map((o: any) =>
                    typeof o === 'string' ? o : o.value || o.label,
                  );
                }
              } catch {
                allowedValues = [];
              }
            }
            if (allowedValues.length > 0 && !allowedValues.includes(valStr)) {
              throw new BadRequestException(
                `Invalid option '${valStr}' for field '${field.name}'. Allowed: ${allowedValues.join(', ')}`,
              );
            }
            mergedValues[key] = valStr;
            break;
          }

          case CustomFieldType.MULTI_SELECT: {
            let allowedValues: string[] = [];
            if (field.options) {
              try {
                const parsedOpts = JSON.parse(field.options);
                if (Array.isArray(parsedOpts)) {
                  allowedValues = parsedOpts.map((o: any) =>
                    typeof o === 'string' ? o : o.value || o.label,
                  );
                }
              } catch {
                allowedValues = [];
              }
            }
            const selectedItems: string[] = Array.isArray(val)
              ? val.map((v) => String(v).trim())
              : valStr.split(',').map((v) => v.trim()).filter(Boolean);

            for (const item of selectedItems) {
              if (allowedValues.length > 0 && !allowedValues.includes(item)) {
                throw new BadRequestException(
                  `Invalid option '${item}' for field '${field.name}'. Allowed: ${allowedValues.join(', ')}`,
                );
              }
            }
            mergedValues[key] = selectedItems;
            break;
          }

          case CustomFieldType.URL: {
            const urlPattern = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/i;
            if (!urlPattern.test(valStr)) {
              throw new BadRequestException(`Field '${field.name}' must be a valid URL`);
            }
            mergedValues[key] = valStr;
            break;
          }

          case CustomFieldType.EMAIL: {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(valStr)) {
              throw new BadRequestException(`Field '${field.name}' must be a valid email address`);
            }
            mergedValues[key] = valStr;
            break;
          }

          case CustomFieldType.PHONE: {
            const phonePattern = /^[+()0-9\s-]{6,20}$/;
            if (!phonePattern.test(valStr)) {
              throw new BadRequestException(`Field '${field.name}' must be a valid phone number`);
            }
            mergedValues[key] = valStr;
            break;
          }

          case CustomFieldType.USER: {
            // Verify user belongs to organization
            const userExists = await this.prisma.organizationMember.findFirst({
              where: {
                organizationId,
                userId: valStr,
                status: 'ACTIVE',
                deletedAt: null,
              },
            });
            if (!userExists) {
              // Also check if userId is valid user in users table
              const userInOrg = await this.prisma.user.findFirst({
                where: { id: valStr, organizationId, isActive: true, deletedAt: null },
              });
              if (!userInOrg) {
                throw new BadRequestException(
                  `Assigned user for custom field '${field.name}' does not exist in this organization`,
                );
              }
            }
            mergedValues[key] = valStr;
            break;
          }

          default:
            mergedValues[key] = val;
        }
      }
    }

    return Object.keys(mergedValues).length > 0 ? JSON.stringify(mergedValues) : null;
  }
}
