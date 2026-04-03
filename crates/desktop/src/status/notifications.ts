import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

/**
 * Send a danger-level notification to the user.
 * Safely handles platform unavailability and permission requirements.
 * 
 * @param title - Notification title
 * @param body - Notification body text
 */
export async function notifyDanger(title: string, body: string): Promise<void> {
  try {
    // Check if notification permissions are granted
    let permissionGranted = await isPermissionGranted();

    // Request permission if not already granted
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }

    // Only send notification if permission is granted
    if (permissionGranted) {
      await sendNotification({
        title,
        body,
      });
    } else {
      // Silently fail if permission not granted - don't crash the UI
      console.warn('Notification permission not granted');
    }
  } catch (error) {
    // Swallow platform errors (e.g., notifications not available on this system)
    // Never crash the UI due to notification failures
    console.error('Failed to send notification:', error);
  }
}
