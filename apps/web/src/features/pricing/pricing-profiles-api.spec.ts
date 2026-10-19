import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createPricingProfile,
  deactivatePricingProfile,
  listPricingProfiles,
  updatePricingProfile,
} from './pricing-profiles-api';

const profileId = '11111111-1111-4111-8111-111111111111';

function profile(isActive = true) {
  return {
    id: profileId,
    isActive,
    createdAt: '2026-10-18T12:00:00.000Z',
    updatedAt: '2026-10-18T12:00:00.000Z',
    currentRevision: {
      id: '22222222-2222-4222-8222-222222222222',
      revision: 1,
      name: 'Varejo',
      effectiveFrom: '2026-10-18T12:00:00.000Z',
      createdAt: '2026-10-18T12:00:00.000Z',
      deductions: [],
    },
  };
}

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('pricing profiles API', () => {
  it('serializes pagination and active-state filters explicitly', async () => {
    const fetchMock = vi.fn(async () =>
      response({
        data: [],
        pagination: { page: 3, pageSize: 10, total: 0, totalPages: 0 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listPricingProfiles({ page: 3, pageSize: 10, isActive: false });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/pricing/profiles?page=3&pageSize=10&isActive=false',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('sends only the strict create and partial update inputs', async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)));
        return response(profile());
      }),
    );

    await createPricingProfile({ name: 'Varejo', deductions: [] });
    await updatePricingProfile(profileId, { expectedRevision: 1, name: 'Atacado' });

    expect(bodies).toEqual([
      { name: 'Varejo', deductions: [] },
      { expectedRevision: 1, name: 'Atacado' },
    ]);
  });

  it('accepts the same inactive response on repeated deactivation requests', async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)));
        return response(profile(false));
      }),
    );

    const first = await deactivatePricingProfile(profileId, { expectedRevision: 1 });
    const repeated = await deactivatePricingProfile(profileId, { expectedRevision: 1 });

    expect(first.isActive).toBe(false);
    expect(repeated).toEqual(first);
    expect(bodies).toEqual([{ expectedRevision: 1 }, { expectedRevision: 1 }]);
  });
});
