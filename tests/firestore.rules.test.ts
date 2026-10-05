import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

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
  });
});

describe('other user', () => {
  it('cannot read another user data', async () => {
    await assertFails(getDoc(doc(bobDb(), `users/${ALICE}`)));
    await assertFails(getDoc(doc(bobDb(), `users/${ALICE}/transactions/t0`)));
  });
  it('cannot write another user data', async () => {
    await assertFails(setDoc(doc(bobDb(), `users/${ALICE}/transactions/t1`), validTx()));
    await assertFails(setDoc(doc(bobDb(), `users/${ALICE}/categories/c1`), validCategory()));
    await assertFails(setDoc(doc(bobDb(), `users/${ALICE}`), validProfile()));
  });
});

describe('owner valid writes', () => {
  it('can create profile, category, transaction, recurring', async () => {
    const db = testEnv.authenticatedContext('carol').firestore();
    await assertSucceeds(setDoc(doc(db, 'users/carol'), validProfile()));
    await assertSucceeds(setDoc(doc(aliceDb(), `users/${ALICE}/categories/c1`), validCategory()));
    await assertSucceeds(setDoc(doc(aliceDb(), `users/${ALICE}/transactions/t1`), validTx()));
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}/transactions/t2`), { ...validTx(), recurringId: 'r1' }),
    );
    await assertSucceeds(setDoc(doc(aliceDb(), `users/${ALICE}/recurring/r1`), validRecurring()));
    await assertSucceeds(getDoc(doc(aliceDb(), `users/${ALICE}/transactions/t0`)));
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
  it('denies invalid frequency', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}/recurring/r1`), { ...validRecurring(), frequency: 'daily' }),
    );
  });
});

describe('profile validation', () => {
  it('denies monthStartDay 29', async () => {
    await assertFails(setDoc(doc(aliceDb(), `users/${ALICE}`), { ...validProfile(), monthStartDay: 29 }));
  });
});
