import { createClient } from '@supabase/supabase-js';
import { supabaseService } from './supabaseService';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

const mockedCreateClient = createClient as jest.Mock;

/**
 * Builds a chainable Supabase query-builder mock. Every chain method returns
 * the same builder, and awaiting the builder resolves to `result`.
 */
function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const passthrough = jest.fn(() => builder);
  builder.select = passthrough;
  builder.insert = passthrough;
  builder.update = passthrough;
  builder.upsert = passthrough;
  builder.delete = passthrough;
  builder.eq = passthrough;
  builder.gt = passthrough;
  builder.order = passthrough;
  builder.single = passthrough;
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return builder;
}

function makeClient() {
  const upload = jest.fn().mockResolvedValue({ data: { path: 'p' }, error: null });
  const getPublicUrl = jest.fn(() => ({ data: { publicUrl: 'https://cdn/p' } }));
  const storageFrom = jest.fn(() => ({ upload, getPublicUrl }));
  return {
    from: jest.fn(),
    storage: { from: storageFrom },
    __upload: upload,
    __getPublicUrl: getPublicUrl,
    __storageFrom: storageFrom,
  };
}

describe('supabaseService', () => {
  beforeEach(() => {
    mockedCreateClient.mockReset();
    supabaseService.resetClient();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://real.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'real-anon-key';
  });

  it('creates a single client lazily and caches it', () => {
    mockedCreateClient.mockReturnValue(makeClient());

    const c1 = supabaseService.getClient();
    const c2 = supabaseService.getClient();

    expect(c1).toBe(c2);
    expect(mockedCreateClient).toHaveBeenCalledTimes(1);
  });

  it('reports configured when real credentials are present', () => {
    mockedCreateClient.mockReturnValue(makeClient());
    expect(supabaseService.isConfigured()).toBe(true);
  });

  it('reports NOT configured with empty credentials and still returns a client without throwing', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = '';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '';
    mockedCreateClient.mockReturnValue(makeClient());

    expect(supabaseService.isConfigured()).toBe(false);
    expect(() => supabaseService.getClient()).not.toThrow();
    // A fallback URL/key is passed so createClient never throws at startup.
    const [url, key] = mockedCreateClient.mock.calls[0];
    expect(url).toBeTruthy();
    expect(key).toBeTruthy();
  });

  it('treats placeholder credentials as NOT configured', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://xxxx.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'eyJxxx...';
    mockedCreateClient.mockReturnValue(makeClient());
    expect(supabaseService.isConfigured()).toBe(false);
  });

  it('query selects all rows and applies eq filters', async () => {
    const client = makeClient();
    const builder = makeBuilder({ data: [{ id: '1' }], error: null });
    client.from.mockReturnValue(builder);
    mockedCreateClient.mockReturnValue(client);

    const rows = await supabaseService.query('habits', { id: '1' });

    expect(client.from).toHaveBeenCalledWith('habits');
    expect(builder.select).toHaveBeenCalledWith('*');
    expect(builder.eq).toHaveBeenCalledWith('id', '1');
    expect(rows).toEqual([{ id: '1' }]);
  });

  it('query throws when supabase returns an error', async () => {
    const client = makeClient();
    client.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'boom' } }));
    mockedCreateClient.mockReturnValue(client);

    await expect(supabaseService.query('habits')).rejects.toThrow('boom');
  });

  it('insert returns the created row', async () => {
    const client = makeClient();
    const builder = makeBuilder({ data: { id: 'x' }, error: null });
    client.from.mockReturnValue(builder);
    mockedCreateClient.mockReturnValue(client);

    const row = await supabaseService.insert('habits', { id: 'x' });

    expect(builder.insert).toHaveBeenCalledWith({ id: 'x' });
    expect(builder.single).toHaveBeenCalled();
    expect(row).toEqual({ id: 'x' });
  });

  it('update filters by id and returns the row', async () => {
    const client = makeClient();
    const builder = makeBuilder({ data: { id: 'x', n: 2 }, error: null });
    client.from.mockReturnValue(builder);
    mockedCreateClient.mockReturnValue(client);

    const row = await supabaseService.update('habits', 'x', { n: 2 });

    expect(builder.update).toHaveBeenCalledWith({ n: 2 });
    expect(builder.eq).toHaveBeenCalledWith('id', 'x');
    expect(row).toEqual({ id: 'x', n: 2 });
  });

  it('upsert uses the provided conflict key', async () => {
    const client = makeClient();
    const builder = makeBuilder({ data: { date: '2026-01-01' }, error: null });
    client.from.mockReturnValue(builder);
    mockedCreateClient.mockReturnValue(client);

    const row = await supabaseService.upsert('hydration', { date: '2026-01-01' }, 'date');

    expect(builder.upsert).toHaveBeenCalledWith({ date: '2026-01-01' }, { onConflict: 'date' });
    expect(row).toEqual({ date: '2026-01-01' });
  });

  it('uploadFile uploads then returns the public url', async () => {
    const client = makeClient();
    mockedCreateClient.mockReturnValue(client);

    const url = await supabaseService.uploadFile('progress-photos', 'a/b.jpg', new Uint8Array([1]));

    expect(client.__storageFrom).toHaveBeenCalledWith('progress-photos');
    expect(client.__upload).toHaveBeenCalled();
    expect(url).toBe('https://cdn/p');
  });

  it('getPublicUrl returns the cdn url', () => {
    const client = makeClient();
    mockedCreateClient.mockReturnValue(client);

    const url = supabaseService.getPublicUrl('progress-photos', 'a/b.jpg');

    expect(url).toBe('https://cdn/p');
  });
});
