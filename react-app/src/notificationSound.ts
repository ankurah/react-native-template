import { NativeModules } from 'react-native';

/**
 * Plays the notification chime when a message arrives from another user.
 *
 * React Native has no Web Audio API (unlike the web templates), so playback is
 * delegated to a small native module — see ios/{{project-name | pascal_case}}/NotificationSound.mm.
 * If that module isn't present (e.g. before the native chime has been built into
 * the app), this degrades to a no-op so that notification *badges* still work.
 */
interface NotificationSoundModule {
  play(): void;
}

const soundModule: NotificationSoundModule | undefined = (
  NativeModules as { NotificationSound?: NotificationSoundModule }
).NotificationSound;

// Don't play more often than this — matches the web templates' debounce.
const SOUND_DEBOUNCE_MS = 300;
let lastSoundPlayedAt = 0;

export function playNotificationSound(): void {
  const now = Date.now();
  if (now - lastSoundPlayedAt < SOUND_DEBOUNCE_MS) return;
  lastSoundPlayedAt = now;

  try {
    soundModule?.play();
  } catch (e) {
    console.warn('Failed to play notification sound:', e);
  }
}
