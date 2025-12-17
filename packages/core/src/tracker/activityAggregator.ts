import { ActivityEvent } from '../model/types';

/**
 * Activity aggregator for determining active vs idle state
 */
export class ActivityAggregator {
  private lastActivityTime: number = 0;
  private activeStartTime: number = 0;
  private accumulatedSeconds: number = 0;
  private isCurrentlyActive: boolean = false;

  constructor(private idleThresholdMinutes: number = 5) {}

  /**
   * Record an activity event
   */
  recordActivity(event: ActivityEvent): void {
    const now = new Date(event.timestamp).getTime();
    this.lastActivityTime = now;

    if (!this.isCurrentlyActive) {
      // Starting a new active period
      this.activeStartTime = now;
      this.isCurrentlyActive = true;
    }
  }

  /**
   * Check if currently idle
   */
  checkIdle(currentTime: Date = new Date()): boolean {
    if (!this.isCurrentlyActive) {
      return true;
    }

    const now = currentTime.getTime();
    const idleMillis = this.idleThresholdMinutes * 60 * 1000;
    const timeSinceLastActivity = now - this.lastActivityTime;

    if (timeSinceLastActivity > idleMillis) {
      // Gone idle - accumulate time up to idle threshold
      this.accumulateActiveTime(this.lastActivityTime + idleMillis);
      this.isCurrentlyActive = false;
      return true;
    }

    return false;
  }

  /**
   * Get accumulated active seconds since last reset
   */
  getAccumulatedSeconds(): number {
    if (this.isCurrentlyActive) {
      // Check if we're still actually active or have gone idle
      const now = Date.now();
      const idleMillis = this.idleThresholdMinutes * 60 * 1000;
      const timeSinceLastActivity = now - this.lastActivityTime;

      if (timeSinceLastActivity > idleMillis) {
        // We've gone idle - only count up to idle threshold after last activity
        const effectiveEndTime = this.lastActivityTime + idleMillis;
        const activeMillis = effectiveEndTime - this.activeStartTime;
        const activeSeconds = Math.max(0, Math.floor(activeMillis / 1000));
        return this.accumulatedSeconds + activeSeconds;
      } else {
        // Still active - include current active period up to now
        const currentActiveSeconds = Math.floor((now - this.activeStartTime) / 1000);
        return this.accumulatedSeconds + currentActiveSeconds;
      }
    }

    return this.accumulatedSeconds;
  }

  /**
   * End the current session and get total accumulated time
   */
  endSession(endTime: Date = new Date()): number {
    if (this.isCurrentlyActive) {
      this.accumulateActiveTime(endTime.getTime());
      this.isCurrentlyActive = false;
    }

    const total = this.accumulatedSeconds;
    this.reset();
    return total;
  }

  /**
   * Reset the aggregator
   */
  reset(): void {
    this.lastActivityTime = 0;
    this.activeStartTime = 0;
    this.accumulatedSeconds = 0;
    this.isCurrentlyActive = false;
  }

  /**
   * Check if currently in an active state
   */
  isActive(): boolean {
    return this.isCurrentlyActive;
  }

  /**
   * Set idle threshold
   */
  setIdleThreshold(minutes: number): void {
    this.idleThresholdMinutes = minutes;
  }

  /**
   * Accumulate active time up to a specific timestamp
   */
  private accumulateActiveTime(upTo: number): void {
    if (this.isCurrentlyActive && this.activeStartTime > 0) {
      const activeMillis = upTo - this.activeStartTime;
      const activeSeconds = Math.floor(activeMillis / 1000);
      this.accumulatedSeconds += activeSeconds;
      this.activeStartTime = 0;
    }
  }
}
