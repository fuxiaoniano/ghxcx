ALTER TABLE `wechat_articles`
  ADD COLUMN `siteKey` VARCHAR(32) NOT NULL DEFAULT 'main';

DROP INDEX `wechat_articles_slug_key` ON `wechat_articles`;
CREATE UNIQUE INDEX `wechat_articles_siteKey_slug_key` ON `wechat_articles`(`siteKey`, `slug`);
CREATE INDEX `wechat_articles_siteKey_status_publishedAt_idx` ON `wechat_articles`(`siteKey`, `status`, `publishedAt`);

ALTER TABLE `website_article_categories`
  ADD COLUMN `siteKey` VARCHAR(32) NOT NULL DEFAULT 'main';

DROP INDEX `website_article_categories_name_key` ON `website_article_categories`;
DROP INDEX `website_article_categories_slug_key` ON `website_article_categories`;
CREATE UNIQUE INDEX `website_article_categories_siteKey_name_key` ON `website_article_categories`(`siteKey`, `name`);
CREATE UNIQUE INDEX `website_article_categories_siteKey_slug_key` ON `website_article_categories`(`siteKey`, `slug`);
CREATE INDEX `website_article_categories_siteKey_status_sort_idx` ON `website_article_categories`(`siteKey`, `status`, `sort`);

ALTER TABLE `website_visitor_daily`
  ADD COLUMN `siteKey` VARCHAR(32) NOT NULL DEFAULT 'main';

DROP INDEX `website_visitor_daily_visitorHash_statDate_key` ON `website_visitor_daily`;
CREATE UNIQUE INDEX `website_visitor_daily_siteKey_visitorHash_statDate_key` ON `website_visitor_daily`(`siteKey`, `visitorHash`, `statDate`);
CREATE INDEX `website_visitor_daily_siteKey_statDate_idx` ON `website_visitor_daily`(`siteKey`, `statDate`);
