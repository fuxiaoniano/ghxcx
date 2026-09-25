ALTER TABLE `wechat_articles`
  ADD COLUMN `seoTitle` VARCHAR(160) NULL,
  ADD COLUMN `seoKeywords` VARCHAR(300) NULL,
  ADD COLUMN `seoDescription` VARCHAR(300) NULL;
