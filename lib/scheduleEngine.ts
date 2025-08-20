import { supabaseAdmin } from './supabase';
import cron from 'node-cron';

interface ScheduleExecution {
  scheduleId: number;
  scheduledTime: Date;
}

class ScheduleEngine {
  private isRunning: boolean = false;
  private cronJobs: Map<number, cron.ScheduledTask> = new Map();
  private executionQueue: ScheduleExecution[] = [];
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log('Schedule Engine initialized');
  }

  // Start the schedule engine
  async start() {
    if (this.isRunning) {
      console.log('Schedule Engine is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting Schedule Engine...');

    // Load all active schedules
    await this.loadSchedules();

    // Check for due schedules every minute
    this.checkInterval = setInterval(() => {
      this.checkSchedules();
    }, 60000); // Every minute

    // Process execution queue every 10 seconds
    setInterval(() => {
      this.processQueue();
    }, 10000);

    console.log('Schedule Engine started');
  }

  // Stop the schedule engine
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Clear all cron jobs
    this.cronJobs.forEach(job => job.stop());
    this.cronJobs.clear();

    // Clear check interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    console.log('Schedule Engine stopped');
  }

  // Load all active schedules
  private async loadSchedules() {
    try {
      const { data: schedules, error } = await supabaseAdmin
        .from('schedules')
        .select(`
          *,
          schedule_times (*)
        `)
        .eq('is_active', true);

      if (error) {
        console.error('Failed to load schedules:', error);
        return;
      }

      console.log(`Loaded ${schedules?.length || 0} active schedules`);

      // Set up cron jobs for each schedule
      for (const schedule of schedules || []) {
        this.setupScheduleCron(schedule);
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
    }
  }

  // Set up cron job for a schedule
  private setupScheduleCron(schedule: any) {
    // Clear existing cron job if any
    if (this.cronJobs.has(schedule.id)) {
      this.cronJobs.get(schedule.id)?.stop();
      this.cronJobs.delete(schedule.id);
    }

    // Create cron expressions for each schedule time
    for (const time of schedule.schedule_times || []) {
      const cronExpression = this.buildCronExpression(
        time,
        schedule.schedule_type
      );

      if (cronExpression) {
        const job = cron.schedule(cronExpression, () => {
          this.queueExecution(schedule.id);
        }, {
          scheduled: true,
          timezone: schedule.timezone || 'America/Chicago'
        });

        this.cronJobs.set(schedule.id, job);
        console.log(`Scheduled cron job for schedule ${schedule.id}: ${cronExpression}`);
      }
    }
  }

  // Build cron expression from schedule time
  private buildCronExpression(time: any, scheduleType: string): string | null {
    const [hours, minutes] = time.time_of_day.split(':');
    
    switch (scheduleType) {
      case 'daily':
        // Run every day at specified time
        return `${minutes} ${hours} * * *`;
      
      case 'weekly':
        // Run on specific days of week
        if (time.days_of_week && time.days_of_week.length > 0) {
          const days = time.days_of_week.join(',');
          return `${minutes} ${hours} * * ${days}`;
        }
        break;
      
      case 'monthly':
        // Run on specific days of month
        if (time.days_of_month && time.days_of_month.length > 0) {
          const days = time.days_of_month.join(',');
          return `${minutes} ${hours} ${days} * *`;
        }
        break;
    }

    return null;
  }

  // Check for schedules that should run now
  private async checkSchedules() {
    if (!this.isRunning) return;

    try {
      const now = new Date();
      const currentMinute = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

      // Query schedules that should run at this time
      const { data: schedules, error } = await supabaseAdmin
        .from('schedules')
        .select(`
          *,
          schedule_times!inner (*)
        `)
        .eq('is_active', true)
        .eq('schedule_times.time_of_day', currentMinute);

      if (error) {
        console.error('Failed to check schedules:', error);
        return;
      }

      // Queue schedules for execution
      for (const schedule of schedules || []) {
        // Check if schedule should run today
        if (this.shouldRunToday(schedule)) {
          this.queueExecution(schedule.id);
        }
      }
    } catch (error) {
      console.error('Error checking schedules:', error);
    }
  }

  // Check if schedule should run today
  private shouldRunToday(schedule: any): boolean {
    const now = new Date();
    const today = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const todayDate = now.getDate();
    const currentMonth = now.getMonth() + 1;

    // Check start/end dates
    const startDate = new Date(schedule.start_date);
    const endDate = schedule.end_date ? new Date(schedule.end_date) : null;

    if (now < startDate || (endDate && now > endDate)) {
      return false;
    }

    // Check schedule type specific conditions
    for (const time of schedule.schedule_times || []) {
      switch (schedule.schedule_type) {
        case 'daily':
          return true;
        
        case 'weekly':
          if (time.days_of_week && time.days_of_week.includes(today)) {
            return true;
          }
          break;
        
        case 'monthly':
          if (time.days_of_month && time.days_of_month.includes(todayDate)) {
            if (!time.months || time.months.includes(currentMonth)) {
              return true;
            }
          }
          break;
      }
    }

    return false;
  }

  // Queue a schedule for execution
  private queueExecution(scheduleId: number) {
    // Check if already queued
    const existing = this.executionQueue.find(e => e.scheduleId === scheduleId);
    if (existing) {
      console.log(`Schedule ${scheduleId} already queued`);
      return;
    }

    this.executionQueue.push({
      scheduleId,
      scheduledTime: new Date()
    });

    console.log(`Queued schedule ${scheduleId} for execution`);
  }

  // Process the execution queue
  private async processQueue() {
    if (!this.isRunning || this.executionQueue.length === 0) return;

    const execution = this.executionQueue.shift();
    if (!execution) return;

    console.log(`Executing schedule ${execution.scheduleId}`);

    try {
      // Call the execute API endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/schedules/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.SYSTEM_API_KEY || ''
        },
        body: JSON.stringify({
          scheduleId: execution.scheduleId,
          isManual: false
        })
      });

      if (!response.ok) {
        throw new Error(`Execution failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`Schedule ${execution.scheduleId} executed:`, result);

    } catch (error) {
      console.error(`Failed to execute schedule ${execution.scheduleId}:`, error);
      
      // Record failed execution
      await supabaseAdmin
        .from('schedule_executions')
        .insert({
          schedule_id: execution.scheduleId,
          scheduled_time: execution.scheduledTime,
          status: 'failed',
          error_message: String(error)
        });
    }
  }

  // Reload a specific schedule (e.g., after updates)
  async reloadSchedule(scheduleId: number) {
    // Remove existing cron job
    if (this.cronJobs.has(scheduleId)) {
      this.cronJobs.get(scheduleId)?.stop();
      this.cronJobs.delete(scheduleId);
    }

    // Reload the schedule
    const { data: schedule, error } = await supabaseAdmin
      .from('schedules')
      .select(`
        *,
        schedule_times (*)
      `)
      .eq('id', scheduleId)
      .single();

    if (error || !schedule) {
      console.error(`Failed to reload schedule ${scheduleId}:`, error);
      return;
    }

    if (schedule.is_active) {
      this.setupScheduleCron(schedule);
    }
  }

  // Get engine status
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeSchedules: this.cronJobs.size,
      queuedExecutions: this.executionQueue.length
    };
  }
}

// Create singleton instance
let engineInstance: ScheduleEngine | null = null;

export function getScheduleEngine(): ScheduleEngine {
  if (!engineInstance) {
    engineInstance = new ScheduleEngine();
  }
  return engineInstance;
}

// Start the engine if this is running on the server
if (typeof window === 'undefined' && process.env.ENABLE_SCHEDULE_ENGINE === 'true') {
  const engine = getScheduleEngine();
  engine.start().catch(console.error);
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, stopping schedule engine...');
    engine.stop();
  });
}