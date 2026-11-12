import { SmartMonitorActionsService } from '../src/modules/operations/smart-monitor-actions.service';
import { TencentMarketingApiError } from '../src/modules/operations/promotion-data-sync.service';

const user = { adminUserId: 'operator', role: 'MEMBER' } as any;
const creative = { dynamic_creative_id: 13813533120, adgroup_id: 150419360949, configured_status: 'AD_STATUS_NORMAL', creative_set_approval_status: 'CREATIVE_SET_APPROVAL_STATUS_NORMAL' };
const parent = { adgroup_id: 150419360949, configured_status: 'AD_STATUS_NORMAL', system_status: 'ADGROUP_STATUS_PARTIAL_ACTIVE' };
const key = 'test-status-13813533120-001';

function fixture(responses: Array<unknown>) {
  const prisma = {
    promotionAccount: { findFirst: jest.fn().mockResolvedValue({ id: 'account', accountNo: '90913463' }) },
    smartMonitorAction: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'action', accountId: 'account', creativeId: '13813533120', adgroupId: '150419360949', status: 'PREFLIGHT_PASSED' }),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'action', creativeId: '13813533120', adgroupId: '150419360949', ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    adminUser: { findUnique: jest.fn() },
    smartMonitorCapability: { upsert: jest.fn().mockResolvedValue({}) },
  } as any;
  const access = { where: jest.fn().mockResolvedValue({}), assertCanCreateCreatives: jest.fn().mockResolvedValue(undefined) } as any;
  const tencentApi = jest.fn();
  for (const response of responses) {
    if (response instanceof Error) tencentApi.mockRejectedValueOnce(response);
    else tencentApi.mockResolvedValueOnce(response);
  }
  const audit = { create: jest.fn().mockResolvedValue({}) } as any;
  return { prisma, access, tencentApi, audit, service: new SmartMonitorActionsService(prisma, access, { tencentApi } as any, audit) };
}

describe('smart monitor creative-level status', () => {
  it('blocks out-of-scope accounts before any platform call', async () => {
    const f = fixture([]);
    f.prisma.promotionAccount.findFirst.mockResolvedValue(null);
    await expect(f.service.changeStatus('account', '13813533120', 'AD_STATUS_SUSPEND', key, '测试', user)).rejects.toMatchObject({ status: 403 });
    expect(f.tencentApi).not.toHaveBeenCalled();
  });

  it('updates only the selected creative and requires matching platform readback', async () => {
    const f = fixture([
      { data: { list: [creative] } }, { data: { list: [parent] } },
      { data: { dynamic_creative_id: 13813533120 }, requestId: 'request-safe' },
      { data: { list: [{ ...creative, configured_status: 'AD_STATUS_SUSPEND' }] } },
    ]);
    const result = await f.service.changeStatus('account', '13813533120', 'AD_STATUS_SUSPEND', key, '测试暂停', user);
    expect(result.status).toBe('CONFIRMED');
    expect(f.tencentApi.mock.calls[2].slice(0, 4)).toEqual(['POST', '/dynamic_creatives/update', '90913463', { dynamic_creative_id: 13813533120, configured_status: 'AD_STATUS_SUSPEND' }]);
    expect(f.tencentApi.mock.calls.some((call) => call[1] === '/adgroups/update_configured_status')).toBe(false);
    expect(f.prisma.smartMonitorCapability.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ validationStatus: 'WRITE_READBACK_VERIFIED' }) }));
  });

  it('marks an explicit platform rejection failed without falling back to the adgroup', async () => {
    const f = fixture([{ data: { list: [creative] } }, { data: { list: [parent] } }, new TencentMarketingApiError('18002', 'unsupported', 'request-safe')]);
    const result = await f.service.changeStatus('account', '13813533120', 'AD_STATUS_SUSPEND', key, '测试暂停', user);
    expect(result.status).toBe('FAILED');
    expect(f.tencentApi.mock.calls).toHaveLength(3);
  });

  it('keeps a timed-out submission unknown and never retries the write', async () => {
    const f = fixture([{ data: { list: [creative] } }, { data: { list: [parent] } }, new TencentMarketingApiError('TIMEOUT', 'timeout', undefined, 502, true)]);
    const result = await f.service.changeStatus('account', '13813533120', 'AD_STATUS_SUSPEND', key, '测试暂停', user);
    expect(result.status).toBe('UNKNOWN_NEEDS_REVIEW');
    expect(f.tencentApi.mock.calls.filter((call) => call[0] === 'POST')).toHaveLength(1);
  });

  it('persists a future schedule only for a currently suspended creative', async () => {
    const f = fixture([{ data: { list: [{ ...creative, configured_status: 'AD_STATUS_SUSPEND' }] } }, { data: { list: [parent] } }]);
    f.prisma.smartMonitorAction.create.mockResolvedValue({ id: 'scheduled', accountId: 'account', creativeId: '13813533120', adgroupId: '150419360949', status: 'SCHEDULED', scheduledAt: new Date(Date.now() + 3_600_000) });
    const result = await f.service.scheduleResume('account', '13813533120', new Date(Date.now() + 3_600_000), key, '测试定时', user);
    expect(result.status).toBe('SCHEDULED');
    expect(f.tencentApi.mock.calls.every((call) => call[0] === 'GET')).toBe(true);
    expect(f.prisma.smartMonitorAction.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'SCHEDULE_RESUME_CREATIVE', status: 'SCHEDULED' }) }));
  });

  it('blocks scheduling when the creative is not suspended', async () => {
    const f = fixture([{ data: { list: [creative] } }]);
    await expect(f.service.scheduleResume('account', '13813533120', new Date(Date.now() + 3_600_000), key, '测试定时', user)).rejects.toMatchObject({ status: 409 });
    expect(f.prisma.smartMonitorAction.create).not.toHaveBeenCalled();
  });

  it('reconciles an uncertain status by GET without another POST', async () => {
    const f = fixture([{ data: { list: [{ ...creative, configured_status: 'AD_STATUS_SUSPEND' }] } }]);
    f.prisma.smartMonitorAction.findFirst.mockResolvedValue({ id: 'action', accountId: 'account', creativeId: '13813533120', adgroupId: '150419360949', action: 'PAUSE_CREATIVE', status: 'UNKNOWN_NEEDS_REVIEW', requestedByAdminId: user.adminUserId });
    const result = await f.service.reconcile('account', 'action', user);
    expect(result.status).toBe('CONFIRMED');
    expect(f.tencentApi.mock.calls.every((call) => call[0] === 'GET')).toBe(true);
  });

  it('does not execute a due schedule after the operator loses permission', async () => {
    const f = fixture([]);
    f.prisma.smartMonitorAction.findMany.mockResolvedValue([{ id: 'scheduled', accountId: 'account', creativeId: '13813533120', idempotencyKey: key, action: 'SCHEDULE_RESUME_CREATIVE', status: 'SCHEDULED', attemptedAt: null, requestedByAdminId: 'operator' }]);
    f.prisma.adminUser.findUnique.mockResolvedValue({ id: 'operator', username: 'operator', role: 'MEMBER', status: 'ACTIVE', permissionsJson: [], customRole: null });
    await f.service.runScheduledActions();
    expect(f.tencentApi).not.toHaveBeenCalled();
    expect(f.prisma.smartMonitorAction.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'UNKNOWN_NEEDS_REVIEW' }) }));
  });

  it('claims a due schedule and uses a stable child idempotency key', async () => {
    const f = fixture([]);
    f.prisma.smartMonitorAction.findMany.mockResolvedValue([{ id: 'scheduled', accountId: 'account', creativeId: '13813533120', idempotencyKey: key, action: 'SCHEDULE_RESUME_CREATIVE', status: 'SCHEDULED', attemptedAt: null, requestedByAdminId: 'operator' }]);
    f.prisma.adminUser.findUnique.mockResolvedValue({ id: 'operator', username: 'operator', role: 'MEMBER', status: 'ACTIVE', permissionsJson: ['PROMOTION_SMART_MONITOR_STATUS'], customRole: null, dataScope: 'ALL', teamId: null });
    const change = jest.spyOn(f.service, 'changeStatus').mockResolvedValue({ id: 'child', status: 'CONFIRMED', creativeId: '13813533120', adgroupId: '150419360949', platformRequestId: 'request-safe', errorCode: null, errorMessage: null, verifiedAt: new Date() });
    await f.service.runScheduledActions();
    expect(change).toHaveBeenCalledWith('account', '13813533120', 'AD_STATUS_NORMAL', `${key}-execute`, expect.any(String), expect.objectContaining({ adminUserId: 'operator' }));
    expect(f.prisma.smartMonitorAction.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CONFIRMED', replacementId: 'child' }) }));
  });

  it('requires exact typed confirmation before deleting a creative', async () => {
    const f = fixture([]);
    await expect(f.service.deleteCreative('account', '13813533120', '13813533121', key, '测试', user)).rejects.toMatchObject({ status: 400 });
    expect(f.tencentApi).not.toHaveBeenCalled();
  });

  it('does not list actions from an account outside creative data scope', async () => {
    const f = fixture([]);
    f.prisma.promotionAccount.findFirst.mockResolvedValue(null);
    await expect(f.service.listActions('hidden-account', user)).rejects.toMatchObject({ status: 403 });
    expect(f.prisma.smartMonitorAction.findMany).not.toHaveBeenCalled();
  });

  it('cancels only a scheduled task before the worker claims it', async () => {
    const f = fixture([]);
    f.prisma.smartMonitorAction.findFirst.mockResolvedValue({ id: 'scheduled', creativeId: '13813533120', adgroupId: '150419360949', status: 'SCHEDULED', scheduledAt: new Date() });
    const result = await f.service.cancelSchedule('account', 'scheduled', user);
    expect(result.status).toBe('CANCELLED');
    expect(f.prisma.smartMonitorAction.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'scheduled', status: 'SCHEDULED' }, data: { status: 'CANCELLED' } }));
    expect(f.tencentApi).not.toHaveBeenCalled();
  });

  it('confirms deletion only after Tencent returns a matching deleted object', async () => {
    const f = fixture([
      { data: { list: [creative] } }, { data: { list: [parent] } },
      { data: { dynamic_creative_id: 13813533120 }, requestId: 'delete-request' },
      { data: { list: [{ ...creative, is_deleted: true }] } },
    ]);
    const result = await f.service.deleteCreative('account', '13813533120', '13813533120', key, '人工测试删除', user);
    expect(result.status).toBe('DELETED_CONFIRMED');
    expect(f.tencentApi.mock.calls[2].slice(0, 4)).toEqual(['POST', '/dynamic_creatives/delete', '90913463', { dynamic_creative_id: 13813533120 }]);
    expect(f.tencentApi.mock.calls[3][3].is_deleted).toBe(true);
  });

  it('does not claim deletion success after an uncertain response and missing readback', async () => {
    const f = fixture([{ data: { list: [creative] } }, { data: { list: [parent] } }, new TencentMarketingApiError('TIMEOUT', 'timeout', undefined, 502, true), { data: { list: [] } }]);
    const result = await f.service.deleteCreative('account', '13813533120', '13813533120', key, '人工测试删除', user);
    expect(result.status).toBe('UNKNOWN_NEEDS_REVIEW');
    expect(f.tencentApi.mock.calls.filter((call) => call[0] === 'POST')).toHaveLength(1);
  });
});
