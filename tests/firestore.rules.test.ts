import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const ALICE = 'alice';
const BOB = 'bob';

const now = () => Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));

const validProfile = () => ({
  displayName: 'Alice',
  currency: 'JOD',
  monthStartDay: 1,
  theme: 'system',
  createdAt: now(),
});

const validCategory = () => ({
  name: 'Food',
  type: 'expense',
  icon: '🍔',
  color: '#FF00aa',
  archived: false,
  order: 0,
});

const validTx = () => ({
  type: 'expense',
  amountFils: 1500,
  categoryId: 'cat1',
  date: now(),
  note: 'lunch',
  createdAt: now(),
});

const validRecurring = () => ({
  type: 'expense',
  amountFils: 25000,
  categoryId: 'cat1',
  note: 'rent',
  frequency: 'monthly',
  startDate: now(),
  nextDate: now(),
  endDate: null,
  active: true,
});

const validDebt = () => ({
  personName: 'أحمد',
  type: 'lent',
  amountFils: 100000,
  paidFils: 30000,
  startDate: now(),
  dueDate: now(),
  note: 'سلفة',
  settled: false,
  payments: [
    {
      id: 'p1',
      amountFils: 30000,
      date: now(),
      createdAt: now(),
    },
  ],
  createdAt: now(),
});

const validCircle = () => ({
  name: 'جمعية العائلة',
  monthlyAmountFils: 100000,
  membersCount: 10,
  totalAmountFils: 1000000,
  myTurnMonth: 3,
  startDate: now(),
  members: [
    {
      id: 'm1',
      name: 'أحمد',
      turnMonth: 1,
      paidMonths: [1],
    },
    {
      id: 'm2',
      name: 'سارة',
      turnMonth: 2,
      paidMonths: [1],
    },
  ],
  status: 'active',
  createdAt: now(),
});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-masareefi',
    firestore: {
      rules: readFileSync(resolve(__dirname, '..', 'firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `users/${ALICE}`), validProfile());
    await setDoc(doc(db, `users/${ALICE}/transactions/t0`), validTx());
    await setDoc(doc(db, `users/${ALICE}/debts/d0`), validDebt());
    await setDoc(doc(db, `users/${ALICE}/circles/c0`), validCircle());
  });
});

const aliceDb = () => testEnv.authenticatedContext(ALICE).firestore();
const bobDb = () => testEnv.authenticatedContext(BOB).firestore();
const anonDb = () => testEnv.unauthenticatedContext().firestore();

describe('unauthenticated', () => {
  it('cannot read or write user data', async () => {
    await assertFails(getDoc(doc(anonDb(), `users/${ALICE}`)));
    await assertFails(getDoc(doc(anonDb(), `users/${ALICE}/transactions/t0`)));
    await assertFails(setDoc(doc(anonDb(), `users/${ALICE}/transactions/t1`), validTx()));
    await assertFails(getDoc(doc(anonDb(), `users/${ALICE}/debts/d0`)));
    await assertFails(setDoc(doc(anonDb(), `users/${ALICE}/debts/d1`), validDebt()));
    await assertFails(getDoc(doc(anonDb(), `users/${ALICE}/circles/c0`)));
    await assertFails(setDoc(doc(anonDb(), `users/${ALICE}/circles/c1`), validCircle()));
  });
});

describe('other user', () => {
  it('cannot read another user data', async () => {
    await assertFails(getDoc(doc(bobDb(), `users/${ALICE}`)));
    await assertFails(getDoc(doc(bobDb(), `users/${ALICE}/transactions/t0`)));
    await assertFails(getDoc(doc(bobDb(), `users/${ALICE}/debts/d0`)));
    await assertFails(getDoc(doc(bobDb(), `users/${ALICE}/circles/c0`)));
  });
  it('cannot write another user data', async () => {
    await assertFails(setDoc(doc(bobDb(), `users/${ALICE}/transactions/t1`), validTx()));
    await assertFails(setDoc(doc(bobDb(), `users/${ALICE}/categories/c1`), validCategory()));
    await assertFails(setDoc(doc(bobDb(), `users/${ALICE}`), validProfile()));
    await assertFails(setDoc(doc(bobDb(), `users/${ALICE}/debts/d1`), validDebt()));
    await assertFails(setDoc(doc(bobDb(), `users/${ALICE}/circles/c1`), validCircle()));
    await assertFails(deleteDoc(doc(bobDb(), `users/${ALICE}/circles/c0`)));
  });
});

describe('owner valid writes', () => {
  it('can create profile, category, transaction, recurring, debt, circle', async () => {
    const db = testEnv.authenticatedContext('carol').firestore();
    await assertSucceeds(setDoc(doc(db, 'users/carol'), validProfile()));
    await assertSucceeds(setDoc(doc(aliceDb(), `users/${ALICE}/categories/c1`), validCategory()));
    await assertSucceeds(setDoc(doc(aliceDb(), `users/${ALICE}/transactions/t1`), validTx()));
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/transactions/t2`), { ...validTx(), recurringId: 'r1' }),
    );
    await assertSucceeds(setDoc(doc(aliceDb(), `users/${ALICE}/recurring/r1`), validRecurring()));
    await assertSucceeds(setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), validDebt()));
    await assertSucceeds(setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), validCircle()));
    await assertSucceeds(getDoc(doc(aliceDb(), `users/${ALICE}/transactions/t0`)));
    await assertSucceeds(getDoc(doc(aliceDb(), `users/${ALICE}/debts/d0`)));
    await assertSucceeds(getDoc(doc(aliceDb(), `users/${ALICE}/circles/c0`)));
  });
});

describe('transaction validation', () => {
  it('denies float amountFils', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/transactions/t1`), { ...validTx(), amountFils: 1.5 }),
    );
  });
  it('denies negative amountFils', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/transactions/t1`), { ...validTx(), amountFils: -100 }),
    );
  });
  it('denies string amountFils', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/transactions/t1`), { ...validTx(), amountFils: '100' }),
    );
  });
  it('allows valid optional title', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/transactions/t1`), { ...validTx(), title: 'lunch with team' }),
    );
  });
  it('denies title longer than 100 chars', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/transactions/t1`), { ...validTx(), title: 'a'.repeat(101) }),
    );
  });
  it('denies non-string title', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/transactions/t1`), { ...validTx(), title: 123 }),
    );
  });
  it('denies extra field', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/transactions/t1`), { ...validTx(), hacked: true }),
    );
  });
  it('denies invalid update (update bypass)', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/transactions/t0`), { ...validTx(), amountFils: 0 }),
    );
  });
});

describe('recurring validation', () => {
  it('allows valid optional title', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/recurring/r1`), { ...validRecurring(), title: 'gym' }),
    );
  });
  it('denies title longer than 100 chars', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/recurring/r1`), { ...validRecurring(), title: 'a'.repeat(101) }),
    );
  });
  it('denies non-string title', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/recurring/r1`), { ...validRecurring(), title: false }),
    );
  });
  it('denies invalid frequency', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/recurring/r1`), { ...validRecurring(), frequency: 'daily' }),
    );
  });
  it('allows valid optional circleId and skipMonth', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/recurring/r1`), {
        ...validRecurring(),
        circleId: 'circle_123',
        skipMonth: 4,
      }),
    );
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/recurring/r2`), {
        ...validRecurring(),
        skipMonth: 1,
      }),
    );
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/recurring/r3`), {
        ...validRecurring(),
        skipMonth: 50,
      }),
    );
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/recurring/r4`), {
        ...validRecurring(),
        circleId: 'circle_only',
      }),
    );
  });
  it('denies invalid skipMonth', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/recurring/r1`), {
        ...validRecurring(),
        skipMonth: 0,
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/recurring/r1`), {
        ...validRecurring(),
        skipMonth: 55,
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/recurring/r1`), {
        ...validRecurring(),
        skipMonth: '4',
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/recurring/r1`), {
        ...validRecurring(),
        skipMonth: 2.5,
      }),
    );
  });
  it('denies invalid circleId', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/recurring/r1`), {
        ...validRecurring(),
        circleId: '',
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/recurring/r1`), {
        ...validRecurring(),
        circleId: 'a'.repeat(129),
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/recurring/r1`), {
        ...validRecurring(),
        circleId: 123,
      }),
    );
  });
});

describe('user profile validation', () => {
  it('denies monthStartDay 29', async () => {
    await assertFails(setDoc(doc(aliceDb(), `users/${ALICE}`), { ...validProfile(), monthStartDay: 29 }));
  });

  it('allows updating currency to SAR, USD, EUR, AED, and custom strings', async () => {
    for (const curr of ['SAR', 'USD', 'EUR', 'AED', 'دينار كويتي']) {
      await assertSucceeds(
        setDoc(doc(aliceDb(), `users/${ALICE}`), {
          ...validProfile(),
          currency: curr,
        }),
      );
    }
  });

  it('denies empty currency or currency longer than 20 chars', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}`), {
        ...validProfile(),
        currency: '',
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}`), {
        ...validProfile(),
        currency: 'a'.repeat(21),
      }),
    );
  });

  it('allows creating and updating user profile with valid rolloverBalance (true or false)', async () => {
    const daveDb = testEnv.authenticatedContext('dave').firestore();
    await assertSucceeds(
      setDoc(doc(daveDb, 'users/dave'), {
        ...validProfile(),
        rolloverBalance: true,
      }),
    );
    const eveDb = testEnv.authenticatedContext('eve').firestore();
    await assertSucceeds(
      setDoc(doc(eveDb, 'users/eve'), {
        ...validProfile(),
        rolloverBalance: false,
      }),
    );
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}`), {
        ...validProfile(),
        rolloverBalance: true,
      }),
    );
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}`), {
        ...validProfile(),
        rolloverBalance: false,
      }),
    );
  });

  it('denies invalid rolloverBalance (non-boolean)', async () => {
    const frankDb = testEnv.authenticatedContext('frank').firestore();
    await assertFails(
      setDoc(doc(frankDb, 'users/frank'), {
        ...validProfile(),
        rolloverBalance: 'true',
      }),
    );
    await assertFails(
      setDoc(doc(frankDb, 'users/frank'), {
        ...validProfile(),
        rolloverBalance: 1,
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}`), {
        ...validProfile(),
        rolloverBalance: 'true',
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}`), {
        ...validProfile(),
        rolloverBalance: 1,
      }),
    );
  });
});

describe('debt validation', () => {
  it('allows valid lent debt and borrowed debt', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d_lent`), { ...validDebt(), type: 'lent' }),
    );
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d_borrowed`), { ...validDebt(), type: 'borrowed' }),
    );
  });

  it('allows null dueDate or omitted dueDate', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d_null_due`), { ...validDebt(), dueDate: null }),
    );
    const withoutDue = { ...validDebt() };
    delete (withoutDue as Record<string, unknown>).dueDate;
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d_no_due`), withoutDue),
    );
  });

  it('allows owner to update debt while preserving createdAt', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d0`), {
        ...validDebt(),
        paidFils: 50000,
        settled: false,
      }),
    );
  });

  it('allows owner to delete debt and denies non-owner delete', async () => {
    await assertFails(deleteDoc(doc(bobDb(), `users/${ALICE}/debts/d0`)));
    await assertSucceeds(deleteDoc(doc(aliceDb(), `users/${ALICE}/debts/d0`)));
  });

  it('denies empty or overlong personName', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), { ...validDebt(), personName: '' }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), { ...validDebt(), personName: 'a'.repeat(101) }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), { ...validDebt(), personName: 123 }),
    );
  });

  it('denies invalid type', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), { ...validDebt(), type: 'expense' }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), { ...validDebt(), type: 'other' }),
    );
  });

  it('denies non-positive or float amountFils', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), { ...validDebt(), amountFils: 0 }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), { ...validDebt(), amountFils: -500 }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), { ...validDebt(), amountFils: 12.5 }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), { ...validDebt(), amountFils: '1000' }),
    );
  });

  it('denies negative paidFils or paidFils exceeding amountFils', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), { ...validDebt(), paidFils: -1 }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), {
        ...validDebt(),
        amountFils: 1000,
        paidFils: 1001,
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), { ...validDebt(), paidFils: 5.5 }),
    );
  });

  it('denies non-timestamp startDate', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), {
        ...validDebt(),
        startDate: '2026-01-01',
      }),
    );
  });

  it('denies invalid dueDate (non-null, non-timestamp)', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), {
        ...validDebt(),
        dueDate: '2026-02-01',
      }),
    );
  });

  it('denies note longer than 500 chars or non-string', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), {
        ...validDebt(),
        note: 'a'.repeat(501),
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), {
        ...validDebt(),
        note: 12345,
      }),
    );
  });

  it('denies non-boolean settled', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), {
        ...validDebt(),
        settled: 'false',
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), {
        ...validDebt(),
        settled: 1,
      }),
    );
  });

  it('denies settled: true when paidFils < amountFils', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), {
        ...validDebt(),
        amountFils: 100000,
        paidFils: 30000,
        settled: true,
      }),
    );
  });

  it('denies settled: false when paidFils == amountFils', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), {
        ...validDebt(),
        amountFils: 100000,
        paidFils: 100000,
        settled: false,
      }),
    );
  });

  it('allows settled: true when paidFils == amountFils', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), {
        ...validDebt(),
        amountFils: 100000,
        paidFils: 100000,
        settled: true,
      }),
    );
  });

  it('denies non-list payments or payments exceeding 100 entries', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), {
        ...validDebt(),
        payments: 'not-a-list',
      }),
    );
    const oversizedPayments = Array.from({ length: 101 }, (_, i) => ({ id: `p${i}` }));
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), {
        ...validDebt(),
        payments: oversizedPayments,
      }),
    );
  });

  it('denies extra unexpected fields', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), {
        ...validDebt(),
        extraField: true,
      }),
    );
  });

  it('denies missing required fields', async () => {
    const withoutPerson = { ...validDebt() };
    delete (withoutPerson as Record<string, unknown>).personName;
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), withoutPerson),
    );

    const withoutPayments = { ...validDebt() };
    delete (withoutPayments as Record<string, unknown>).payments;
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d1`), withoutPayments),
    );
  });

  it('denies modifying createdAt on update', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d0`), {
        ...validDebt(),
        createdAt: Timestamp.fromDate(new Date('2027-01-01T00:00:00Z')),
      }),
    );
  });

  it('denies invalid update (update bypass)', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d0`), {
        ...validDebt(),
        paidFils: 200000, // exceeds amountFils (100000)
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/debts/d0`), {
        ...validDebt(),
        type: 'invalidType',
      }),
    );
  });
});

describe('money circle validation', () => {
  it('allows valid active circle and completed circle', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c_active`), { ...validCircle(), status: 'active' }),
    );
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c_completed`), { ...validCircle(), status: 'completed' }),
    );
  });

  it('allows valid optional recurringId', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c_with_recurring`), {
        ...validCircle(),
        recurringId: 'rec_123',
      }),
    );
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c0`), {
        ...validCircle(),
        recurringId: 'rec_456',
      }),
    );
  });

  it('denies invalid recurringId', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), {
        ...validCircle(),
        recurringId: '',
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), {
        ...validCircle(),
        recurringId: 'a'.repeat(129),
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), {
        ...validCircle(),
        recurringId: 123,
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), {
        ...validCircle(),
        recurringId: false,
      }),
    );
  });

  it('allows creating and updating circle with valid isManager (true or false)', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c_manager_true`), {
        ...validCircle(),
        isManager: true,
      }),
    );
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c_manager_false`), {
        ...validCircle(),
        isManager: false,
      }),
    );
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c0`), {
        ...validCircle(),
        isManager: true,
      }),
    );
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c0`), {
        ...validCircle(),
        isManager: false,
      }),
    );
  });

  it('denies invalid isManager (non-boolean)', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), {
        ...validCircle(),
        isManager: 'yes',
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), {
        ...validCircle(),
        isManager: 1,
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c0`), {
        ...validCircle(),
        isManager: 'yes',
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c0`), {
        ...validCircle(),
        isManager: 1,
      }),
    );
  });

  it('allows owner to update circle while preserving createdAt', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c0`), {
        ...validCircle(),
        status: 'completed',
      }),
    );
  });

  it('allows owner to delete circle and denies non-owner delete', async () => {
    await assertFails(deleteDoc(doc(bobDb(), `users/${ALICE}/circles/c0`)));
    await assertSucceeds(deleteDoc(doc(aliceDb(), `users/${ALICE}/circles/c0`)));
  });

  it('denies empty or overlong name', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), name: '' }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), name: 'a'.repeat(101) }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), name: 123 }),
    );
  });

  it('denies non-positive, float, or non-int monthlyAmountFils', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), monthlyAmountFils: 0 }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), monthlyAmountFils: -500 }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), monthlyAmountFils: 50.5 }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), monthlyAmountFils: '1000' }),
    );
  });

  it('denies membersCount < 2 or > 50 or float or non-int', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), membersCount: 1 }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), membersCount: 51 }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), membersCount: 5.5 }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), membersCount: '10' }),
    );
  });

  it('denies non-positive, float, or non-int totalAmountFils', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), totalAmountFils: 0 }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), totalAmountFils: -100 }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), totalAmountFils: 100.5 }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), totalAmountFils: '100000' }),
    );
  });

  it('denies myTurnMonth < 1, myTurnMonth > membersCount, or non-int', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), myTurnMonth: 0 }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), membersCount: 10, myTurnMonth: 11 }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), myTurnMonth: 2.5 }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), myTurnMonth: '3' }),
    );
  });

  it('denies non-timestamp startDate', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), startDate: '2026-01-01' }),
    );
  });

  it('denies non-list members or members exceeding 50 entries', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), members: 'not-a-list' }),
    );
    const oversizedMembers = Array.from({ length: 51 }, (_, i) => ({ id: `m${i}` }));
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), members: oversizedMembers }),
    );
  });

  it('denies invalid status', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), status: 'pending' }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), status: 'cancelled' }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), status: 1 }),
    );
  });

  it('denies extra unexpected fields', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c1`), { ...validCircle(), extraField: true }),
    );
  });

  it('denies missing required fields', async () => {
    const requiredKeys = [
      'name',
      'monthlyAmountFils',
      'membersCount',
      'totalAmountFils',
      'myTurnMonth',
      'startDate',
      'members',
      'status',
      'createdAt',
    ];
    for (const key of requiredKeys) {
      const copy = { ...validCircle() };
      delete (copy as Record<string, unknown>)[key];
      await assertFails(setDoc(doc(aliceDb(), `users/${ALICE}/circles/c_missing_${key}`), copy));
    }
  });

  it('denies modifying createdAt on update', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c0`), {
        ...validCircle(),
        createdAt: Timestamp.fromDate(new Date('2027-01-01T00:00:00Z')),
      }),
    );
  });

  it('denies invalid update (update bypass)', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c0`), {
        ...validCircle(),
        membersCount: 1, // < 2
      }),
    );
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/circles/c0`), {
        ...validCircle(),
        status: 'invalidStatus',
      }),
    );
  });
});


