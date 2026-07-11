import * as ImagePicker from 'expo-image-picker';
import { supabaseService } from './supabaseService';
import { authService } from './authService';

/**
 * Progress photos service.
 *
 * Photos are stored directly in the PUBLIC Supabase Storage bucket
 * `progress-photos`, one object per user per day at `{userId}/{date}.jpg`.
 * Uploads reuse T0's `supabaseService.uploadFile()` — this service never
 * builds its own Storage client. The date-keyed path means at most one photo
 * per day (a re-take overwrites, `upsert: true`), which keeps the timeline
 * clean and makes before/after comparison a simple date lookup.
 */

export const PROGRESS_PHOTOS_BUCKET = 'progress-photos';

/** A single progress photo: its capture date and public URL. */
export type ProgressPhoto = {
  date: string; // YYYY-MM-DD
  uri: string; // public URL
};

// ── Pure helpers (unit-tested) ───────────────────────────────────────────────

/** Local date as `YYYY-MM-DD`, the per-day key used for the storage path. */
export function todayDateString(now: Date = new Date()): string {
  return now.toISOString().split('T')[0];
}

/** Storage object path for a user's photo on a given date: `{userId}/{date}.jpg`. */
export function buildPhotoPath(userId: string, date: string): string {
  return `${userId}/${date}.jpg`;
}

/** Extracts the `YYYY-MM-DD` date from a stored object name like `2026-07-11.jpg`. */
export function dateFromObjectName(name: string): string {
  return name.replace(/\.jpe?g$/i, '');
}

/** Returns a new array of photos ordered chronologically (oldest → newest). */
export function sortTimeline(photos: ProgressPhoto[]): ProgressPhoto[] {
  return [...photos].sort((a, b) => a.date.localeCompare(b.date));
}

// ── Service ──────────────────────────────────────────────────────────────────

function requireUserId(): string {
  const user = authService.getCurrentUser();
  if (!user?.uid) {
    throw new Error('Debes iniciar sesión para usar las fotos de progreso');
  }
  return user.uid;
}

export const progressPhotoService = {
  /**
   * Opens the camera, uploads the captured photo to Supabase Storage and
   * returns its public URL. Returns an empty string if the user cancels.
   * Throws if camera permission is denied or the user is not signed in.
   *
   * `now` is injectable for deterministic tests.
   */
  async takePhoto(now: Date = new Date()): Promise<string> {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Se necesita permiso de cámara para tomar la foto de progreso');
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]?.uri) {
      return '';
    }

    const userId = requireUserId();
    const path = buildPhotoPath(userId, todayDateString(now));

    // Local file URI → ArrayBuffer (the reliable payload for supabase-js on RN).
    const response = await fetch(result.assets[0].uri);
    const arrayBuffer = await response.arrayBuffer();

    return supabaseService.uploadFile(PROGRESS_PHOTOS_BUCKET, path, arrayBuffer);
  },

  /** All of the signed-in user's progress photos, ordered oldest → newest. */
  async getTimeline(): Promise<ProgressPhoto[]> {
    const userId = requireUserId();
    const { data, error } = await supabaseService
      .getClient()
      .storage.from(PROGRESS_PHOTOS_BUCKET)
      .list(userId);
    if (error) {
      throw new Error(error.message);
    }

    const photos: ProgressPhoto[] = (data ?? [])
      .filter((file: { name: string }) => /\.jpe?g$/i.test(file.name))
      .map((file: { name: string }) => {
        const date = dateFromObjectName(file.name);
        return {
          date,
          uri: supabaseService.getPublicUrl(PROGRESS_PHOTOS_BUCKET, buildPhotoPath(userId, date)),
        };
      });

    return sortTimeline(photos);
  },

  /** Public URLs for two dated photos, for a before/after comparison. */
  async compareBeforeAfter(
    date1: string,
    date2: string,
  ): Promise<{ uri1: string; uri2: string }> {
    const userId = requireUserId();
    return {
      uri1: supabaseService.getPublicUrl(PROGRESS_PHOTOS_BUCKET, buildPhotoPath(userId, date1)),
      uri2: supabaseService.getPublicUrl(PROGRESS_PHOTOS_BUCKET, buildPhotoPath(userId, date2)),
    };
  },
};
