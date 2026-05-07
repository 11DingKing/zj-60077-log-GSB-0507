import alertService from './alertService';

export class AlertMatcher {
  private lastCheckTime: number = 0;
  private checkIntervalMs: number = 60000;

  constructor(checkIntervalMs?: number) {
    this.checkIntervalMs = checkIntervalMs ?? 60000;
  }

  async checkIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCheckTime < this.checkIntervalMs) {
      return;
    }

    this.lastCheckTime = now;
    await this.checkAndTriggerAlerts();
  }

  async checkAndTriggerAlerts(): Promise<void> {
    await alertService.checkAndTriggerAlerts();
  }
}

export const alertMatcher = new AlertMatcher();
export default alertMatcher;
