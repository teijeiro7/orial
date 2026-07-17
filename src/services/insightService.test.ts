import type { Insight } from './insightService';

// ---------------------------------------------------------------------------
// db mock (fluent drizzle-style builder) — insightService is DB-coupled like
// the rest of the app's services, so we mock `./database` the same way
// jest.setup.js mocks AsyncStorage: replace the module before it's imported,
// so the real expo-sqlite native binding is never touched.
// ---------------------------------------------------------------------------
const mockWhere = jest.fn();
const mockUpdateWhere = jest.fn().mockResolvedValue(undefined);
const mockSet = jest.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = jest.fn((..._args: unknown[]) => ({ set: mockSet }));
const mockSelect = jest.fn((..._args: unknown[]) => ({
  from: jest.fn(() => ({
    where: mockWhere,
  })),
}));

jest.mock('./database', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

jest.mock('./openclawService', () => ({
  agentService: {
    getConfig: jest.fn(),
  },
}));

jest.mock('./syncService', () => ({
  syncService: {
    pullChanges: jest.fn().mockResolvedValue(undefined),
  },
}));

import { agentService } from './openclawService';
import { syncService } from './syncService';
import {
  insightService,
  sortInsights,
  filterInsights,
  applyDismiss,
} from './insightService';

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: 'insight-1',
    generatedAt: new Date('2026-07-01T08:00:00Z'),
    category: 'sleep',
    title: 'Sueño insuficiente',
    body: 'Los últimos 3 días has dormido < 6h.',
    severity: 'info',
    dismissed: false,
    sourceAgent: 'jarvis',
    createdAt: new Date('2026-07-01T08:00:00Z'),
    ...overrides,
  };
}

describe('sortInsights (pure)', () => {
  it('orders critical before warning before info', () => {
    const critical = makeInsight({ id: 'c', severity: 'critical' });
    const warning = makeInsight({ id: 'w', severity: 'warning' });
    const info = makeInsight({ id: 'i', severity: 'info' });

    const sorted = sortInsights([info, warning, critical]);

    expect(sorted.map((i) => i.id)).toEqual(['c', 'w', 'i']);
  });

  it('within the same severity, orders newest generatedAt first', () => {
    const older = makeInsight({ id: 'older', severity: 'warning', generatedAt: new Date('2026-06-01') });
    const newer = makeInsight({ id: 'newer', severity: 'warning', generatedAt: new Date('2026-07-01') });

    const sorted = sortInsights([older, newer]);

    expect(sorted.map((i) => i.id)).toEqual(['newer', 'older']);
  });

  it('does not mutate the input array', () => {
    const input = [makeInsight({ id: 'a', severity: 'info' }), makeInsight({ id: 'b', severity: 'critical' })];
    const inputCopy = [...input];

    sortInsights(input);

    expect(input).toEqual(inputCopy);
  });
});

describe('filterInsights (pure)', () => {
  const sleepInsight = makeInsight({ id: 's', category: 'sleep' });
  const gymInsight = makeInsight({ id: 'g', category: 'gym' });
  const dismissedInsight = makeInsight({ id: 'd', category: 'sleep', dismissed: true });

  it('excludes dismissed insights regardless of category filter', () => {
    const result = filterInsights([sleepInsight, dismissedInsight]);
    expect(result.map((i) => i.id)).toEqual(['s']);
  });

  it('returns all non-dismissed insights when no category is given', () => {
    const result = filterInsights([sleepInsight, gymInsight, dismissedInsight]);
    expect(result.map((i) => i.id).sort()).toEqual(['g', 's']);
  });

  it('filters by category when provided', () => {
    const result = filterInsights([sleepInsight, gymInsight], 'gym');
    expect(result.map((i) => i.id)).toEqual(['g']);
  });
});

describe('applyDismiss (pure)', () => {
  it('marks only the matching insight as dismissed, immutably', () => {
    const target = makeInsight({ id: 'target', dismissed: false });
    const other = makeInsight({ id: 'other', dismissed: false });

    const result = applyDismiss([target, other], 'target');

    expect(result.find((i) => i.id === 'target')?.dismissed).toBe(true);
    expect(result.find((i) => i.id === 'other')?.dismissed).toBe(false);
    // Immutability: original array/objects untouched.
    expect(target.dismissed).toBe(false);
  });

  it('returns an equivalent list when the id is not found', () => {
    const list = [makeInsight({ id: 'a' }), makeInsight({ id: 'b' })];

    const result = applyDismiss(list, 'missing');

    expect(result).toEqual(list);
  });
});

describe('InsightService.getInsights (DB-mocked orchestration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWhere.mockReset();
  });

  it('fetches rows, then applies filter + sort before returning', async () => {
    const rows = [
      {
        id: 'a',
        generatedAt: new Date('2026-07-01'),
        category: 'gym',
        title: 'Press banca +10kg',
        body: 'Sigue así',
        severity: 'info',
        dismissed: false,
        sourceAgent: 'jarvis',
        createdAt: new Date('2026-07-01'),
      },
      {
        id: 'b',
        generatedAt: new Date('2026-07-02'),
        category: 'sleep',
        title: 'HRV bajo',
        body: 'Baja intensidad hoy',
        severity: 'critical',
        dismissed: false,
        sourceAgent: 'jarvis',
        createdAt: new Date('2026-07-02'),
      },
    ];
    // select().from() returns a thenable/array-like; our mock's `.where` is
    // reached only when a category filter is used. For the no-arg case the
    // service selects all rows directly from `.from(...)`.
    const fromMock = jest.fn().mockResolvedValue(rows);
    mockSelect.mockReturnValueOnce({ from: fromMock });

    const result = await insightService.getInsights();

    expect(result.map((i) => i.id)).toEqual(['b', 'a']); // critical before info
  });
});

describe('InsightService.dismissInsight (DB-mocked orchestration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates the row with the given id, setting dismissed = true', async () => {
    await insightService.dismissInsight('abc-123');

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith({ dismissed: true });
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
  });
});

describe('InsightService.requestManualRefresh', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    (syncService.pullChanges as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws when Jarvis/Hermes is not configured', async () => {
    (agentService.getConfig as jest.Mock).mockResolvedValue(null);

    await expect(insightService.requestManualRefresh()).rejects.toThrow(/no está configurado/i);
  });

  it('POSTs to the refresh endpoint and pulls changes on success', async () => {
    (agentService.getConfig as jest.Mock).mockResolvedValue({
      apiUrl: 'https://hermes.example.com',
      apiKey: 'secret',
    });
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    await insightService.requestManualRefresh();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hermes.example.com/v1/insights/refresh',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
      }),
    );
    expect(syncService.pullChanges).toHaveBeenCalledTimes(1);
  });

  it('throws when the refresh request fails', async () => {
    (agentService.getConfig as jest.Mock).mockResolvedValue({
      apiUrl: 'https://hermes.example.com',
      apiKey: 'secret',
    });
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(insightService.requestManualRefresh()).rejects.toThrow(/500/);
    expect(syncService.pullChanges).not.toHaveBeenCalled();
  });
});
