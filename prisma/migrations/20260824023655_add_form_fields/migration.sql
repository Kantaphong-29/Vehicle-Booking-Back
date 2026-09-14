-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `province` VARCHAR(191) NULL,
    ADD COLUMN `route` VARCHAR(191) NULL,
    ADD COLUMN `speakerName` VARCHAR(191) NULL,
    ADD COLUMN `speakerPhone` VARCHAR(191) NULL,
    ADD COLUMN `street` VARCHAR(191) NULL;
