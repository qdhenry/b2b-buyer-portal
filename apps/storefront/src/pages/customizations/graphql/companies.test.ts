import { describe, expect, it, vi } from 'vitest';

import { getCompaniesExtraFields } from './companies';
import { getUserCompany } from '@/shared/service/b2b/graphql/global';

vi.mock('@/shared/service/b2b/graphql/global', () => ({
  getUserCompany: vi.fn(),
}));

const mockedGetUserCompany = vi.mocked(getUserCompany);

describe('getCompaniesExtraFields', () => {
  beforeEach(() => {
    mockedGetUserCompany.mockReset();
  });

  it('returns a map of the extra fields for the matching company id', async () => {
    mockedGetUserCompany.mockResolvedValue({
      userCompany: {
        id: '777',
        extraFields: [
          {
            fieldName: 'foo',
            fieldValue: 'bar',
          },
          {
            fieldName: 'baz',
            fieldValue: 'qux',
          },
        ],
      },
    });

    await expect(getCompaniesExtraFields(['777'], 222)).resolves.toEqual({
      '777': [
        { fieldName: 'foo', fieldValue: 'bar' },
        { fieldName: 'baz', fieldValue: 'qux' },
      ],
    });
    expect(mockedGetUserCompany).toHaveBeenCalledWith(222);
  });

  it('does not call the API when no ids are provided', async () => {
    await expect(getCompaniesExtraFields([], 222)).resolves.toEqual({});
    expect(mockedGetUserCompany).not.toHaveBeenCalled();
  });

  it('returns an empty map when the API fails', async () => {
    mockedGetUserCompany.mockRejectedValue(new Error('boom'));

    await expect(getCompaniesExtraFields(['777'], 222)).resolves.toEqual({});
  });
});
