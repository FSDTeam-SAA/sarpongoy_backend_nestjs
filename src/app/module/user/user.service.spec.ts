import { UserService } from './user.service';

jest.mock('./entities/user.entity', () => ({ User: class User {} }));
jest.mock('../school/entities/school.entity', () => ({ School: class School {} }));
jest.mock('src/app/helpers/fileUploder', () => ({ fileUpload: {} }));
jest.mock('src/app/helpers/sendMailer', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('src/app/utils/generateWelcomeEmail', () => ({ generateWelcomeEmail: jest.fn() }));

describe('UserService school population', () => {
  let service: UserService;
  let users: any;
  let schools: any;
  let user: any;
  let select: jest.Mock;

  beforeEach(() => {
    const stored = { _id: 'user-1', schoolName: 'school-1', totalStudent: 100 };
    user = { ...stored, toObject: () => ({ ...stored }) };
    users = {
      findById: jest.fn().mockResolvedValue(user),
      findByIdAndUpdate: jest.fn().mockResolvedValue(user),
    };
    select = jest.fn().mockResolvedValue({ totalStudent: 150 });
    schools = { findById: jest.fn().mockReturnValue({ select }) };
    service = new UserService(users, schools);
  });

  it('returns the latest school count on every profile fetch without changing stored user data', async () => {
    expect((await service.getProfile('user-1')).totalStudent).toBe(150);
    select.mockResolvedValue({ totalStudent: 200 });
    expect((await service.getProfile('user-1')).totalStudent).toBe(200);
    expect(user.totalStudent).toBe(100);
    expect(schools.findById).toHaveBeenCalledWith('school-1');
  });

  it('returns the same school count for account detail and both update responses', async () => {
    expect((await service.getSingleUser('user-1')).totalStudent).toBe(150);
    expect((await service.updateUser('user-1', {}))?.totalStudent).toBe(150);
    expect((await service.updateMyProfile('user-1', {}))?.totalStudent).toBe(150);
  });

  it('preserves an explicit zero instead of displaying the old user count', async () => {
    select.mockResolvedValue({ totalStudent: 0 });
    expect((await service.getProfile('user-1')).totalStudent).toBe(0);
  });

  it('uses the legacy count when the assigned school no longer exists', async () => {
    select.mockResolvedValue(null);
    expect((await service.getProfile('user-1')).totalStudent).toBe(100);
  });

  it('leaves accounts without a school unchanged', async () => {
    user.schoolName = undefined;
    expect(await service.getProfile('user-1')).toBe(user);
    expect(schools.findById).not.toHaveBeenCalled();
  });

  it('still rejects a missing user', async () => {
    users.findById.mockResolvedValue(null);
    await expect(service.getProfile('missing')).rejects.toThrow('User not found');
  });
});
