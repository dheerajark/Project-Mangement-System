import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TaskReminderService } from './task-reminder.service';
import {
  CreateTaskReminderDto,
  UpdateTaskReminderDto,
} from './dto/task-reminder.dto';
import { AccessTokenGuard } from '../auth/guards/accessToken.guard';

@Controller('tasks/:taskId/reminders')
@UseGuards(AccessTokenGuard)
export class TaskReminderController {
  constructor(private readonly taskReminderService: TaskReminderService) {}

  @Post()
  async createReminder(
    @Request() req: any,
    @Param('taskId') taskId: string,
    @Body() dto: CreateTaskReminderDto,
  ) {
    const orgId = req.user.organizationId;
    const userId = req.user.id;
    return this.taskReminderService.createReminder(orgId, userId, taskId, dto);
  }

  @Get()
  async getTaskReminders(
    @Request() req: any,
    @Param('taskId') taskId: string,
  ) {
    const orgId = req.user.organizationId;
    const userId = req.user.id;
    return this.taskReminderService.getTaskReminders(orgId, userId, taskId);
  }

  @Patch(':reminderId')
  async updateReminder(
    @Request() req: any,
    @Param('taskId') taskId: string,
    @Param('reminderId') reminderId: string,
    @Body() dto: UpdateTaskReminderDto,
  ) {
    const orgId = req.user.organizationId;
    const userId = req.user.id;
    return this.taskReminderService.updateReminder(
      orgId,
      userId,
      taskId,
      reminderId,
      dto,
    );
  }

  @Delete(':reminderId')
  async deleteReminder(
    @Request() req: any,
    @Param('taskId') taskId: string,
    @Param('reminderId') reminderId: string,
  ) {
    const orgId = req.user.organizationId;
    const userId = req.user.id;
    return this.taskReminderService.deleteReminder(
      orgId,
      userId,
      taskId,
      reminderId,
    );
  }
}
