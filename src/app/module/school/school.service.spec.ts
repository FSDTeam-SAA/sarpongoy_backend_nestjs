import { SchoolService } from './school.service';

jest.mock('./entities/school.entity', () => ({ School: class School {} }));
jest.mock('../payment/entities/payment.entity', () => ({ Payment: class Payment {} }));
jest.mock('src/app/helpers/fileUploder', () => ({ fileUpload: {} }));

describe('School payment terms lock', () => {
  it.each([false, true])('returns the current lock instead of the stale stored flag (%s)', async (locked) => {
    const school = { termsLocked: !locked };
    const schools = { findById: jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(school) }) };
    const payments = { exists: jest.fn().mockResolvedValue(locked ? { _id: 'payment' } : null) };
    const service = new SchoolService(schools as any, payments as any);
    expect((await service.getSingleSchool('school')).termsLocked).toBe(locked);
    expect(payments.exists).toHaveBeenCalledWith({ schoolId: 'school', paymentType: 'school', status: { $in: ['offline_pending', 'completed', 'refunded'] } });
  });

  it.each([false, true])('enforces the current lock when updating pricing (%s)', async (locked) => {
    const school = { termsLocked: !locked, subscribePrice: 10, totalStudent: 3 };
    const schools = { findById: jest.fn().mockResolvedValue(school), findByIdAndUpdate: jest.fn().mockResolvedValue(school) };
    const payments = { exists: jest.fn().mockResolvedValue(locked ? { _id: 'payment' } : null) };
    const service = new SchoolService(schools as any, payments as any);
    jest.spyOn(service, 'getSingleSchool').mockResolvedValue(school as any);
    const update = service.updateSchool('school', { subscribePrice: 12 } as any);
    if (locked) {
      await expect(update).rejects.toThrow('Payment terms are locked');
      expect(schools.findByIdAndUpdate).not.toHaveBeenCalled();
    } else {
      await update;
      expect(schools.findByIdAndUpdate).toHaveBeenCalledWith('school', { $set: expect.objectContaining({ subscribePrice: 12, totalContractAmount: 36 }) }, expect.anything());
    }
  });
});
