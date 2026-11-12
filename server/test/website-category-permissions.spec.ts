import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { WebsiteAdminController } from '../src/modules/website/website-admin.controller';

describe('website article category permissions', () => {
  const guard = new PermissionsGuard(new Reflector());
  const context = (method: keyof WebsiteAdminController, permissions: string[]) => ({
    getHandler: () => WebsiteAdminController.prototype[method],
    getClass: () => WebsiteAdminController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role: 'ADMIN', permissions } }) })
  }) as any;

  it('lets article editors read shared categories and create a category without website settings access', () => {
    expect(guard.canActivate(context('categories', ['WEBSITE_ARTICLES']))).toBe(true);
    expect(guard.canActivate(context('createCategory', ['WEBSITE_ARTICLES']))).toBe(true);
    expect(guard.canActivate(context('createArticle', ['WEBSITE_ARTICLES']))).toBe(true);
    expect(() => guard.canActivate(context('settings', ['WEBSITE_ARTICLES']))).toThrow();
  });

  it('keeps category editing and deletion limited to category managers', () => {
    expect(() => guard.canActivate(context('updateCategory', ['WEBSITE_ARTICLES']))).toThrow();
    expect(() => guard.canActivate(context('deleteCategory', ['WEBSITE_ARTICLES']))).toThrow();
    expect(guard.canActivate(context('updateCategory', ['WEBSITE_CATEGORIES']))).toBe(true);
  });

  it('does not reveal categories to unrelated members', () => {
    expect(() => guard.canActivate(context('categories', ['CONTENT_HOME']))).toThrow();
  });

  it('grants the existing website section permission access to all category and article endpoints', () => {
    const allWebsiteMethods: (keyof WebsiteAdminController)[] = [
      'settings', 'updateSettings', 'categories', 'createCategory', 'updateCategory',
      'deleteCategory', 'articles', 'article', 'createArticle', 'updateArticle', 'deleteArticle'
    ];
    for (const method of allWebsiteMethods) {
      expect(guard.canActivate(context(method, ['WEBSITE_MANAGE']))).toBe(true);
    }
  });
});
