/*
  Warnings:

  - You are about to drop the column `passwordHash` on the `Employee` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[shopId,saleDate]` on the table `ShopSale` will be added. If there are existing duplicate values, this will fail.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Employee] DROP COLUMN [passwordHash];

-- AlterTable
ALTER TABLE [dbo].[Shop] ALTER COLUMN [keeperId] INT NULL;
ALTER TABLE [dbo].[Shop] ADD [unit] NVARCHAR(1000);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MilkCollection_graderId_collectedAt_idx] ON [dbo].[MilkCollection]([graderId], [collectedAt]);

-- CreateIndex
ALTER TABLE [dbo].[ShopSale] ADD CONSTRAINT [ShopSale_shopId_saleDate_key] UNIQUE NONCLUSTERED ([shopId], [saleDate]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
