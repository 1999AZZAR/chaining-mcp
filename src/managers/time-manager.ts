// Enhanced JavaScript implementation of the Python time server
// Uses native JavaScript Date API with proper timezone handling

export interface TimeResult {
  timezone: string;
  datetime: string;
  day_of_week: string;
  is_dst: boolean;
}

export interface TimeConversionResult {
  source: TimeResult;
  target: TimeResult;
  time_difference: string;
}

export class TimeManager {
  private getLocalTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  }

  private isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  private formatTimeDifference(hoursDiff: number): string {
    if (Number.isInteger(hoursDiff)) {
      return `${hoursDiff >= 0 ? '+' : ''}${hoursDiff.toFixed(1)}h`;
    } else {
      // For fractional hours like Nepal's UTC+5:45
      return `${hoursDiff >= 0 ? '+' : ''}${hoursDiff.toFixed(2).replace(/\.?0+$/, '')}h`;
    }
  }

  getCurrentTime(timezone: string): TimeResult {
    if (!this.isValidTimezone(timezone)) {
      throw new Error(`Invalid timezone: ${timezone}`);
    }

    const now = new Date();

    // Create a date formatter for the specific timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value || '2024';
    const month = parts.find(p => p.type === 'month')?.value || '01';
    const day = parts.find(p => p.type === 'day')?.value || '01';
    const hour = parts.find(p => p.type === 'hour')?.value || '00';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    const second = parts.find(p => p.type === 'second')?.value || '00';

    const timeInTimezone = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);

    // Get day of week
    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long'
    });
    const dayOfWeek = dayFormatter.format(now);

    // Calculate DST status
    const isDST = this.isDST(now, timezone);

    return {
      timezone: timezone,
      datetime: timeInTimezone.toISOString().replace('Z', this.formatOffset(this.getTimezoneOffset(timezone) / (1000 * 60 * 60))),
      day_of_week: dayOfWeek,
      is_dst: isDST
    };
  }

  convertTime(sourceTimezone: string, timeStr: string, targetTimezone: string): TimeConversionResult {
    if (!this.isValidTimezone(sourceTimezone)) {
      throw new Error(`Invalid source timezone: ${sourceTimezone}`);
    }
    if (!this.isValidTimezone(targetTimezone)) {
      throw new Error(`Invalid target timezone: ${targetTimezone}`);
    }

    // Parse time string (HH:MM format)
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) {
      throw new Error("Invalid time format. Expected HH:MM [24-hour format]");
    }

    const [, hours, minutes] = timeMatch;
    const hour = parseInt(hours, 10);
    const minute = parseInt(minutes, 10);

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new Error("Invalid time values");
    }

    // Create a date for today with the specified time in source timezone
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Create the source time by combining today's date with the specified time
    const sourceTime = new Date(today.getTime() + hour * 60 * 60 * 1000 + minute * 60 * 1000);

    // Convert to target timezone using proper timezone conversion
    const targetTime = new Date(sourceTime.toLocaleString("en-US", { timeZone: targetTimezone }));

    // Calculate timezone offsets
    const sourceOffset = this.getTimezoneOffset(sourceTimezone);
    const targetOffset = this.getTimezoneOffset(targetTimezone);
    const hoursDiff = (targetOffset - sourceOffset) / (1000 * 60 * 60);

    // Format day of week for both times
    const sourceDayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: sourceTimezone,
      weekday: 'long'
    });
    const targetDayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: targetTimezone,
      weekday: 'long'
    });

    return {
      source: {
        timezone: sourceTimezone,
        datetime: sourceTime.toISOString().replace('Z', this.formatOffset(sourceOffset / (1000 * 60 * 60))),
        day_of_week: sourceDayFormatter.format(sourceTime),
        is_dst: this.isDST(sourceTime, sourceTimezone)
      },
      target: {
        timezone: targetTimezone,
        datetime: targetTime.toISOString().replace('Z', this.formatOffset(targetOffset / (1000 * 60 * 60))),
        day_of_week: targetDayFormatter.format(targetTime),
        is_dst: this.isDST(targetTime, targetTimezone)
      },
      time_difference: this.formatTimeDifference(hoursDiff)
    };
  }

  private getTimezoneOffset(timezone: string): number {
    const now = new Date();
    const utcTime = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    const localTime = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    return localTime.getTime() - utcTime.getTime();
  }

  private formatOffset(hours: number): string {
    const sign = hours >= 0 ? '+' : '-';
    const absHours = Math.abs(hours);
    const wholeHours = Math.floor(absHours);
    const minutes = Math.round((absHours - wholeHours) * 60);

    if (minutes === 0) {
      return `${sign}${wholeHours.toString().padStart(2, '0')}:00`;
    } else {
      return `${sign}${wholeHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }

  private isDST(date: Date, timezone: string): boolean {
    try {
      // Create dates for January and July to compare offsets
      const jan = new Date(date.getFullYear(), 0, 1);
      const jul = new Date(date.getFullYear(), 6, 1);

      const janOffset = this.getTimezoneOffset(timezone);
      const julOffset = this.getTimezoneOffset(timezone);

      // If July offset is different from January, DST is likely in effect
      return Math.abs(julOffset) !== Math.abs(janOffset);
    } catch {
      return false;
    }
  }

  /**
   * Get a list of common timezones
   */
  public getCommonTimezones(): string[] {
    return [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Kolkata',
      'Australia/Sydney',
      'Pacific/Auckland'
    ];
  }

  /**
   * Get the local timezone
   */
  public getLocalTimezonePublic(): string {
    return this.getLocalTimezone();
  }
}
