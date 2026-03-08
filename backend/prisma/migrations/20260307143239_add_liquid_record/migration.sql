BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[LiquidRecord] (
    [id] INT NOT NULL IDENTITY(1,1),
    [graderId] INT NOT NULL,
    [routeId] INT NOT NULL,
    [recordDate] DATETIME2 NOT NULL,
    [journalL] DECIMAL(10,2) NOT NULL,
    [liquidL] DECIMAL(10,2) NOT NULL,
    [diffL] DECIMAL(10,2) NOT NULL,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [LiquidRecord_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [LiquidRecord_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [LiquidRecord_graderId_routeId_recordDate_key] UNIQUE NONCLUSTERED ([graderId],[routeId],[recordDate])
);

-- AddForeignKey
ALTER TABLE [dbo].[LiquidRecord] ADD CONSTRAINT [LiquidRecord_graderId_fkey] FOREIGN KEY ([graderId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[LiquidRecord] ADD CONSTRAINT [LiquidRecord_routeId_fkey] FOREIGN KEY ([routeId]) REFERENCES [dbo].[Route]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
