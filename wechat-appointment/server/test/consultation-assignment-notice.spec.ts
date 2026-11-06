import axios from 'axios';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

describe('网咨转交公众号通知', () => {
  const form = {
    id: 'form-1', name: '测试用户', phoneMasked: '138****5678', ownerAdminId: 'new-owner',
    channelSource: '腾讯营销', promotionAccount: { name: '测试账户', project: '测试项目' }
  };
  const owner = { id: 'new-owner', status: 'ACTIVE', oaOpenId: 'openid-new', nickname: '新跟进人', username: 'new' };
  const prisma = {
    consultationForm: { findUnique: jest.fn().mockResolvedValue(form) },
    adminUser: { findUnique: jest.fn().mockResolvedValue(owner) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    consultationAssignmentNoticeJob: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    }
  };
  const configs = { getAppointmentNotifyConfig: jest.fn().mockResolvedValue({
    enabled: false, templateId: 'appointment-template', assignmentEnabled: true, assignmentTemplateId: 'assignment-template'
  }) };
  const official = { getAccessToken: jest.fn().mockResolvedValue('test-token') };
  const service = new NotificationsService(prisma as never, { get: jest.fn() } as never, official as never, {} as never, configs as never);

  beforeEach(() => jest.clearAllMocks());

  it('只向新跟进人使用独立模板发送脱敏表单信息', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValueOnce({ data: { errcode: 0, msgid: 123 } });
    await service.sendConsultationAssignmentNotice('form-1', 'new-owner');
    expect(post).toHaveBeenCalledWith(expect.stringContaining('/message/template/send'), expect.objectContaining({
      touser: 'openid-new', template_id: 'assignment-template',
      data: expect.objectContaining({ remark: expect.objectContaining({ value: expect.stringContaining('138****5678') }) })
    }), expect.anything());
    expect(JSON.stringify(post.mock.calls[0][1])).not.toContain('13812345678');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ afterJson: expect.objectContaining({ result: 'SENT' }) })
    }));
    post.mockRestore();
  });

  it('独立通知关闭时不会调用公众号接口', async () => {
    configs.getAppointmentNotifyConfig.mockResolvedValueOnce({ assignmentEnabled: false, assignmentTemplateId: 'assignment-template' });
    const post = jest.spyOn(axios, 'post');
    await service.sendConsultationAssignmentNotice('form-1', 'new-owner');
    expect(post).not.toHaveBeenCalled();
    post.mockRestore();
  });

  it('持久任务领取后记录公众号发送结果，避免服务重启静默漏单', async () => {
    prisma.consultationAssignmentNoticeJob.findMany.mockResolvedValueOnce([{
      id: 'job-1', formId: 'form-1', ownerAdminId: 'new-owner'
    }]);
    const post = jest.spyOn(axios, 'post').mockResolvedValueOnce({ data: { errcode: 0, msgid: 123 } });
    await (service as any).runAssignmentNoticeWorker();
    expect(prisma.consultationAssignmentNoticeJob.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'job-1' }, data: expect.objectContaining({ status: 'SENT' })
    }));
    post.mockRestore();
  });
});
