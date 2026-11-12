import { DataScopeService } from '../src/common/data-scope/data-scope.service';

describe('DataScopeService', () => {
  const teams = [
    { id: 'team-a', parentId: null },
    { id: 'team-a-child', parentId: 'team-a' },
    { id: 'team-b', parentId: null },
  ];
  const prisma = {
    adminTeam: { findMany: jest.fn().mockResolvedValue(teams) },
    adminUser: {
      findMany: jest.fn().mockResolvedValue([{ id: 'member-a' }, { id: 'member-child' }]),
      count: jest.fn().mockResolvedValue(2),
    },
  };
  const service = new DataScopeService(prisma as never);
  const base = { adminUserId: 'self', role: 'STAFF', permissions: [] } as any;

  beforeEach(() => jest.clearAllMocks());

  it('limits SELF to the current member for owner and creator fields', async () => {
    await expect(service.permittedAdminIds({ ...base, dataScope: 'SELF' })).resolves.toEqual(['self']);
    await expect(service.ownershipWhere({ ...base, dataScope: 'SELF' }, 'ownerId', 'creatorId')).resolves.toEqual({
      OR: [{ ownerId: { in: ['self'] } }, { creatorId: { in: ['self'] } }],
    });
  });

  it('includes self and de-duplicates assigned members', async () => {
    await expect(service.permittedAdminIds({
      ...base,
      dataScope: 'ASSIGNED_MEMBERS',
      dataScopeMemberIds: ['member-a', 'self', 'member-a'],
    })).resolves.toEqual(['self', 'member-a']);
  });

  it('calculates TEAM dynamically from the current team and all descendants', async () => {
    await expect(service.permittedAdminIds({ ...base, dataScope: 'TEAM', teamId: 'team-a' }))
      .resolves.toEqual(['self', 'member-a', 'member-child']);
    expect(prisma.adminUser.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ teamId: { in: expect.arrayContaining(['team-a', 'team-a-child']) } }),
    }));
  });

  it('never restricts a super administrator even when a local scope is supplied', async () => {
    await expect(service.permittedAdminIds({ ...base, role: 'SUPER_ADMIN', dataScope: 'SELF' })).resolves.toBeNull();
  });

  it('rejects a forged record id whose owner and creator are outside the scope', async () => {
    await expect(service.assertOwned(
      { ...base, dataScope: 'SELF' },
      { ownerId: 'another-member', creatorId: 'third-member' },
      'ownerId',
      'creatorId',
    )).rejects.toMatchObject({ status: 403 });
  });

  it('allows a record created by an assigned member even when the owner differs', async () => {
    await expect(service.assertOwned(
      { ...base, dataScope: 'ASSIGNED_MEMBERS', dataScopeMemberIds: ['creator'] },
      { ownerId: 'another-member', creatorId: 'creator' },
      'ownerId',
      'creatorId',
    )).resolves.toBeUndefined();
  });
});
