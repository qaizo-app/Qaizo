// src/utils/cardCharge.ts
// Credit-card → funding-account liquidity helpers. A credit card can be linked
// to the bank/cash account it is charged from (fundingAccountId). Each month it
// deducts either a fixed amount (revolving credit) or the whole accumulated
// debt. fundingShortfall warns when a funding account won't cover the upcoming
// card charges (plus its own recurring) before end of month.

interface ChargeableCard {
  balance?: number;
  fixedCharge?: number;
}

interface Account {
  id: string;
  type?: string;
  balance?: number;
  overdraft?: number;
  fundingAccountId?: string;
  billingDay?: number;
  fixedCharge?: number;
}

interface RecurringLite {
  isActive?: boolean;
  account?: string;
  type?: string;
  amount?: number;
  nextDate?: string;
}

// Amount that leaves the funding account for this card this cycle.
export function cardMonthlyCharge(card: ChargeableCard): number {
  const fixed = card.fixedCharge || 0;
  if (fixed > 0) return fixed;
  return Math.max(0, -(card.balance || 0)); // debt magnitude; 0 if not in debt
}

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// How much `account` falls short of its allowed floor once upcoming recurring
// and linked-card charges (billing day still ahead this month) are applied.
// Returns 0 when the projected balance stays within the allowed overdraft.
// Currency-agnostic: assumes cards and their funding account share a currency.
export function fundingShortfall(
  account: Account,
  allAccounts: Account[],
  recurring: RecurringLite[],
  now: Date = new Date(),
): number {
  const minAllowed = -(account.overdraft || 0);
  const endOfMonth = dateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const today = now.getDate();

  let projected = account.balance || 0;

  // Upcoming recurring on this account before end of month.
  for (const r of recurring || []) {
    if (r.isActive && r.account === account.id && r.nextDate && r.nextDate <= endOfMonth) {
      projected += r.type === 'expense' ? -(r.amount || 0) : (r.amount || 0);
    }
  }

  // Linked credit cards whose billing day hasn't passed yet this month.
  for (const c of allAccounts || []) {
    if (c.type === 'credit' && c.fundingAccountId === account.id && (c.billingDay || 0) >= today) {
      projected -= cardMonthlyCharge(c);
    }
  }

  return projected < minAllowed ? minAllowed - projected : 0;
}

export default { cardMonthlyCharge, fundingShortfall };
