import { store } from '@/store';
import { getUserCompany } from '@/shared/service/b2b/graphql/global';
import b2bLogger from '@/utils/b3Logger';

export type ExtraField = {
  fieldName: string;
  fieldValue: string;
};

/**
 * Fetches the logged in user's company extra fields and provides them keyed by the invoice
 * company IDs so the UI can merge them into each invoice node.
 *
 * @param ids list of unique company IDs appearing on the invoice nodes
 * @param userId optional customer ID used to scope the query (will fall back to the Redux store)
 */
export const getCompaniesExtraFields = async (
  ids: (string | number)[],
  userId?: number,
): Promise<Record<string, ExtraField[]>> => {
  if (!ids.length) return {};

  const resolvedUserId = userId ?? store.getState().company.customer.b2bId;
  if (!resolvedUserId) return {};

  try {
    const response = await getUserCompany(resolvedUserId);
    const company = response?.userCompany;
    if (!company?.id) {
      return {};
    }

    const normalizedExtraFields = (company.extraFields || []).map((field) => ({
      fieldName: field?.fieldName ?? '',
      fieldValue: field?.fieldValue ?? '',
    }));

    const companyKey = String(company.id);
    const result: Record<string, ExtraField[]> = {};
    ids.forEach((id) => {
      if (String(id) === companyKey) {
        result[String(id)] = normalizedExtraFields;
      }
    });

    return result;
  } catch (error) {
    b2bLogger.error('Failed to fetch extra fields for companies', error);
    return {};
  }
};
