import { SchoolService } from './school.service';
import { getLockedSchoolTermIds } from '../../helpers/schoolPaymentLock';
jest.mock('./entities/school.entity', () => ({ School: class School {} }));
jest.mock('../payment/entities/payment.entity', () => ({ Payment: class Payment {} }));
jest.mock('src/app/helpers/fileUploder', () => ({ fileUpload: {} }));
const terms = [1,2,3].map(n => ({ termId: 'term_'+n, label: 'Term '+n, amount: 10 }));
describe('School term editing with payment history', () => {
  const setup = (payments: any[]) => {
    const school = { _id: 'school', termsLocked: true, subscribePrice: 10, totalStudent: 3, paymentTerms: terms, toObject() { return { ...this }; } };
    const schools = { findById: jest.fn().mockReturnValue(Object.assign(Promise.resolve(school), { populate: jest.fn().mockResolvedValue(school) })), findByIdAndUpdate: jest.fn().mockResolvedValue(school) };
    const model = { find: jest.fn().mockResolvedValue(payments) };
    return { service: new SchoolService(schools as any, model as any), schools };
  };
  it('unlocks upcoming terms even when an earlier term is paid', async () => {
    const { service } = setup([{ termId: 'term_1', status: 'completed' }]);
    expect(await service.getSingleSchool('school')).toMatchObject({ termsLocked: false, lockedTermIds: ['term_1'] });
  });
  it('allows changing upcoming pricing while preserving the paid term', async () => {
    const { service, schools } = setup([{ termId: 'term_1', status: 'completed' }]);
    await service.updateSchool('school', { subscribePrice: 12, paymentTerms: JSON.stringify([terms[0], {...terms[1], amount: 16}, terms[2]]) } as any);
    expect(schools.findByIdAndUpdate).toHaveBeenCalledWith('school', { $set: expect.objectContaining({ totalContractAmount: 36 }) }, expect.anything());
  });
  it('rejects changes to the paid amount', async () => {
    const { service, schools } = setup([{ termId: 'term_1', status: 'completed' }]);
    await expect(service.updateSchool('school', { paymentTerms: JSON.stringify([{...terms[0],amount:12},{...terms[1],amount:8},terms[2]]) } as any)).rejects.toThrow('cannot be changed');
    expect(schools.findByIdAndUpdate).not.toHaveBeenCalled();
  });
  it.each(['pending','failed'])('keeps %s attempts editable alongside a completed term', status => {
    expect(getLockedSchoolTermIds(terms,[{status:'completed',termId:'term_1'},{status,termId:'term_2'}])).toEqual(['term_1']);
  });
  it('protects legacy term payments and full-year payments', () => {
    expect(getLockedSchoolTermIds(terms,[{status:'completed',paymentPlan:'first_term'}])).toEqual(['term_1']);
    expect(getLockedSchoolTermIds(terms,[{status:'completed',paymentPlan:'full_year'}])).toEqual(terms.map(t=>t.termId));
  });
});
