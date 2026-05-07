import alertService from './alertService';

export async function matchAlerts(): Promise<void> {
  try {
    await alertService.checkAndTriggerAlerts();
  } catch (error) {
    console.error('Error matching alerts:', error);
  }
}
