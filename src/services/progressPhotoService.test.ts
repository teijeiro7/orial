import * as ImagePicker from 'expo-image-picker';
import {
  progressPhotoService,
  PROGRESS_PHOTOS_BUCKET,
  todayDateString,
  buildPhotoPath,
  dateFromObjectName,
  sortTimeline,
} from './progressPhotoService';
import { supabaseService } from './supabaseService';
import { authService } from './authService';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

jest.mock('./supabaseService', () => ({
  supabaseService: {
    uploadFile: jest.fn(),
    getPublicUrl: jest.fn(),
    getClient: jest.fn(),
  },
}));

jest.mock('./authService', () => ({
  authService: {
    getCurrentUser: jest.fn(),
  },
}));

const mockPicker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const mockSupabase = supabaseService as jest.Mocked<typeof supabaseService>;
const mockAuth = authService as jest.Mocked<typeof authService>;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.getCurrentUser.mockReturnValue({ uid: 'user-1' } as never);
  mockSupabase.getPublicUrl.mockImplementation(
    (bucket: string, path: string) => `https://cdn/${bucket}/${path}`,
  );
});

// ── Pure helpers ─────────────────────────────────────────────────────────────

describe('progressPhoto — pure helpers', () => {
  it('todayDateString formats a date as YYYY-MM-DD', () => {
    expect(todayDateString(new Date('2026-07-11T09:30:00Z'))).toBe('2026-07-11');
  });

  it('buildPhotoPath produces `{userId}/{date}.jpg`', () => {
    expect(buildPhotoPath('user-1', '2026-07-11')).toBe('user-1/2026-07-11.jpg');
  });

  it('dateFromObjectName strips the .jpg extension', () => {
    expect(dateFromObjectName('2026-07-11.jpg')).toBe('2026-07-11');
    expect(dateFromObjectName('2026-07-11.JPG')).toBe('2026-07-11');
  });

  it('sortTimeline orders photos oldest → newest without mutating input', () => {
    const input = [
      { date: '2026-07-11', uri: 'c' },
      { date: '2026-01-01', uri: 'a' },
      { date: '2026-03-15', uri: 'b' },
    ];
    const sorted = sortTimeline(input);
    expect(sorted.map((p) => p.uri)).toEqual(['a', 'b', 'c']);
    // immutability: original order preserved
    expect(input[0].uri).toBe('c');
  });
});

// ── takePhoto ────────────────────────────────────────────────────────────────

describe('progressPhoto — takePhoto', () => {
  it('throws when camera permission is denied', async () => {
    mockPicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);
    await expect(progressPhotoService.takePhoto()).rejects.toThrow(/permiso/i);
    expect(mockPicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('returns an empty string when the user cancels the camera', async () => {
    mockPicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as never);
    mockPicker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null } as never);
    expect(await progressPhotoService.takePhoto()).toBe('');
    expect(mockSupabase.uploadFile).not.toHaveBeenCalled();
  });

  it('uploads the captured photo to the correct bucket/path and returns its url', async () => {
    mockPicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as never);
    mockPicker.launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/photo.jpg' }],
    } as never);
    const buffer = new ArrayBuffer(8);
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: jest.fn().mockResolvedValue(buffer) });
    mockSupabase.uploadFile.mockResolvedValue('https://cdn/progress-photos/user-1/2026-07-11.jpg');

    const url = await progressPhotoService.takePhoto(new Date('2026-07-11T08:00:00Z'));

    expect(global.fetch).toHaveBeenCalledWith('file:///tmp/photo.jpg');
    expect(mockSupabase.uploadFile).toHaveBeenCalledWith(
      PROGRESS_PHOTOS_BUCKET,
      'user-1/2026-07-11.jpg',
      buffer,
    );
    expect(url).toBe('https://cdn/progress-photos/user-1/2026-07-11.jpg');
  });

  it('throws when no user is signed in', async () => {
    mockAuth.getCurrentUser.mockReturnValue(null as never);
    mockPicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as never);
    mockPicker.launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/photo.jpg' }],
    } as never);
    await expect(progressPhotoService.takePhoto()).rejects.toThrow(/sesión/i);
  });
});

// ── getTimeline ──────────────────────────────────────────────────────────────

describe('progressPhoto — getTimeline', () => {
  function clientWithList(result: { data: unknown; error: unknown }) {
    const list = jest.fn().mockResolvedValue(result);
    const from = jest.fn(() => ({ list }));
    return { storage: { from }, __list: list, __from: from } as never;
  }

  it('lists the user folder, keeps only jpg files, and returns sorted public urls', async () => {
    mockSupabase.getClient.mockReturnValue(
      clientWithList({
        data: [
          { name: '2026-07-11.jpg' },
          { name: '2026-01-01.jpg' },
          { name: '.emptyFolderPlaceholder' },
        ],
        error: null,
      }),
    );

    const timeline = await progressPhotoService.getTimeline();

    expect(timeline).toEqual([
      { date: '2026-01-01', uri: 'https://cdn/progress-photos/user-1/2026-01-01.jpg' },
      { date: '2026-07-11', uri: 'https://cdn/progress-photos/user-1/2026-07-11.jpg' },
    ]);
  });

  it('throws when supabase returns a storage error', async () => {
    mockSupabase.getClient.mockReturnValue(clientWithList({ data: null, error: { message: 'boom' } }));
    await expect(progressPhotoService.getTimeline()).rejects.toThrow('boom');
  });

  it('returns an empty timeline when there are no photos yet', async () => {
    mockSupabase.getClient.mockReturnValue(clientWithList({ data: [], error: null }));
    expect(await progressPhotoService.getTimeline()).toEqual([]);
  });
});

// ── compareBeforeAfter ───────────────────────────────────────────────────────

describe('progressPhoto — compareBeforeAfter', () => {
  it('resolves both dates to their public urls', async () => {
    const result = await progressPhotoService.compareBeforeAfter('2026-01-01', '2026-07-11');
    expect(result).toEqual({
      uri1: 'https://cdn/progress-photos/user-1/2026-01-01.jpg',
      uri2: 'https://cdn/progress-photos/user-1/2026-07-11.jpg',
    });
  });
});
