/*
  Warnings:

  - A unique constraint covering the columns `[routeId,recordDate]` on the table `LiquidRecord` will be added. If there are existing duplicate values, this will fail.

*/
BEGIN TRY

BEGIN TRAN;

-- DropIndex
ALTER TABLE [dbo].[LiquidRecord] DROP CONSTRAINT [LiquidRecord_graderId_routeId_recordDate_key];

-- AlterTable
ALTER TABLE [dbo].[LiquidRecord] ALTER COLUMN [graderId] INT NULL;

-- CreateIndex
ALTER TABLE [dbo].[LiquidRecord] ADD CONSTRAINT [LiquidRecord_routeId_recordDate_key] UNIQUE NONCLUSTERED ([routeId], [recordDate]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
