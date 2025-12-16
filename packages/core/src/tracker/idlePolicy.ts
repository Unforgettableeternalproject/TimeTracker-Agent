/**
 * Idle policy configuration and utilities
 */

export interface IdleConfig {
  thresholdMinutes: number;
  checkIntervalSeconds: number;
}

export const DEFAULT_IDLE_CONFIG: IdleConfig = {
  thresholdMinutes: 5,
  checkIntervalSeconds: 30,
};

/**
 * Idle policy manager
 */
export class IdlePolicy {
  private config: IdleConfig;

  constructor(config: Partial<IdleConfig> = {}) {
    this.config = { ...DEFAULT_IDLE_CONFIG, ...config };
  }

  /**
   * Get idle threshold in milliseconds
   */
  getIdleThresholdMs(): number {
    return this.config.thresholdMinutes * 60 * 1000;
  }

  /**
   * Get check interval in milliseconds
   */
  getCheckIntervalMs(): number {
    return this.config.checkIntervalSeconds * 1000;
  }

  /**
   * Check if the time since last activity exceeds threshold
   */
  isIdle(lastActivityTime: Date, currentTime: Date = new Date()): boolean {
    const elapsed = currentTime.getTime() - lastActivityTime.getTime();
    return elapsed > this.getIdleThresholdMs();
  }

  /**
   * Calculate active time, capping at idle threshold
   */
  calculateActiveTime(startTime: Date, endTime: Date, lastActivityTime: Date): number {
    const threshold = this.getIdleThresholdMs();
    const timeSinceActivity = endTime.getTime() - lastActivityTime.getTime();

    if (timeSinceActivity > threshold) {
      // Cap end time at last activity + threshold
      const cappedEndTime = new Date(lastActivityTime.getTime() + threshold);
      return Math.floor((cappedEndTime.getTime() - startTime.getTime()) / 1000);
    }

    return Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<IdleConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): IdleConfig {
    return { ...this.config };
  }
}
