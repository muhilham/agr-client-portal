// Payment account data is money-routing ground truth: a wrong number or name in
// either surface (checkout instructions / invoice PDF) misdirects client
// transfers. The same facts are hardcoded in two modules, so this suite pins
// both literally AND cross-checks them against each other — any future account
// change must update both files or CI goes red.
import { describe, it, expect } from 'vitest'
import { BANK_ACCOUNTS } from './payment'
import { AGROASTERY } from './invoice/document'

describe('BANK_ACCOUNTS (checkout payment instructions)', () => {
  it('pins the exact transfer accounts shown to clients', () => {
    expect([...BANK_ACCOUNTS]).toEqual([
      { bank: 'Bank BCA', account: '5235253906', a_n: 'CV Indonesia Roastery' },
      { bank: 'Bank Mandiri', account: '1270009924133', a_n: 'Muhammad Ilham' },
    ])
  })
})

describe('invoice PDF bank details', () => {
  it('pins the exact accounts printed on invoices', () => {
    expect(AGROASTERY.bcaAccount).toBe('5235253906')
    expect(AGROASTERY.bcaAccountName).toBe('CV INDONESIA ROASTERY')
    expect(AGROASTERY.mandiriAccount).toBe('1270009924133')
    expect(AGROASTERY.mandiriAccountName).toBe('MUHAMMAD ILHAM')
  })

  it('stays consistent with checkout BANK_ACCOUNTS (one truth per bank)', () => {
    const bca = BANK_ACCOUNTS.find((b) => b.bank === 'Bank BCA')
    const mandiri = BANK_ACCOUNTS.find((b) => b.bank === 'Bank Mandiri')
    expect(bca).toBeDefined()
    expect(mandiri).toBeDefined()
    expect(AGROASTERY.bcaAccount).toBe(bca?.account)
    expect(AGROASTERY.bcaAccountName).toBe(bca?.a_n.toUpperCase())
    expect(AGROASTERY.mandiriAccount).toBe(mandiri?.account)
    expect(AGROASTERY.mandiriAccountName).toBe(mandiri?.a_n.toUpperCase())
  })
})
