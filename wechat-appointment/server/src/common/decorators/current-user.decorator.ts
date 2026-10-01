import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface MiniCurrentUser {
  userId: string;
  miniOpenId?: string;
}

export interface AdminCurrentUser {
  adminUserId: string;
  username: string;
  nickname?: string;
  role: string;
  roleName?: string;
  permissions: string[];
  dataScope?: 'SELF' | 'ASSIGNED_MEMBERS' | 'TEAM' | 'ALL';
  dataScopeMemberIds?: string[];
  teamId?: string | null;
  consultationReceivable?: boolean;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<{ user?: MiniCurrentUser | AdminCurrentUser }>();
  return request.user;
});
