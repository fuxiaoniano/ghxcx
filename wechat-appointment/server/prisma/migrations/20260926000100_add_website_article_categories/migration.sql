CREATE TABLE `website_article_categories` (
  `id` VARCHAR(32) NOT NULL,
  `name` VARCHAR(40) NOT NULL,
  `slug` VARCHAR(60) NOT NULL,
  `description` VARCHAR(300) NULL,
  `sort` INTEGER NOT NULL DEFAULT 0,
  `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `website_article_categories_name_key`(`name`),
  UNIQUE INDEX `website_article_categories_slug_key`(`slug`),
  INDEX `website_article_categories_status_sort_idx`(`status`, `sort`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `website_article_categories` (`id`, `name`, `slug`, `description`, `sort`, `status`, `updatedAt`) VALUES
('wac_daily', '日常护理', 'daily-care', '刷牙、牙线、洁牙与日常口腔维护', 10, 'ACTIVE', NOW(3)),
('wac_perio', '牙周健康', 'periodontal-health', '牙龈、牙周组织与口腔清洁知识', 20, 'ACTIVE', NOW(3)),
('wac_children', '儿童口腔', 'children-dentistry', '儿童牙齿发育、龋病预防与家庭护理', 30, 'ACTIVE', NOW(3)),
('wac_ortho', '牙齿矫正', 'orthodontics', '牙齿排列、咬合与矫正相关知识', 40, 'ACTIVE', NOW(3)),
('wac_implant', '种植修复', 'implant-restoration', '缺牙修复、种植治疗与术后维护', 50, 'ACTIVE', NOW(3)),
('wac_other', '其他资讯', 'other', '其他口腔健康科普内容', 99, 'ACTIVE', NOW(3));

ALTER TABLE `wechat_articles` ADD COLUMN `categoryId` VARCHAR(32) NULL;
UPDATE `wechat_articles` SET `categoryId` = CASE
  WHEN `title` LIKE '%种植%' OR `title` LIKE '%修复%' THEN 'wac_implant'
  WHEN `title` LIKE '%牙周%' OR `title` LIKE '%牙龈%' THEN 'wac_perio'
  WHEN `title` LIKE '%儿童%' OR `title` LIKE '%乳牙%' OR `title` LIKE '%涂氟%' THEN 'wac_children'
  WHEN `title` LIKE '%矫正%' OR `title` LIKE '%正畸%' THEN 'wac_ortho'
  WHEN `title` LIKE '%刷牙%' OR `title` LIKE '%牙线%' OR `title` LIKE '%洗牙%' THEN 'wac_daily'
  ELSE 'wac_other'
END;
ALTER TABLE `wechat_articles` MODIFY `categoryId` VARCHAR(32) NOT NULL;
CREATE INDEX `wechat_articles_categoryId_status_publishedAt_idx` ON `wechat_articles`(`categoryId`, `status`, `publishedAt`);
ALTER TABLE `wechat_articles` ADD CONSTRAINT `wechat_articles_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `website_article_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
