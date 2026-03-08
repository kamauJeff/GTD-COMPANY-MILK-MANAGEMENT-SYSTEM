BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[DriverTrip] (
    [id] INT NOT NULL IDENTITY(1,1),
    [driverId] INT NOT NULL,
    [tripDate] DATETIME2 NOT NULL,
    [litresLoaded] DECIMAL(10,2) NOT NULL,
    [litresDelivered] DECIMAL(10,2) NOT NULL CONSTRAINT [DriverTrip_litresDelivered_df] DEFAULT 0,
    [litresVariance] DECIMAL(10,2) NOT NULL CONSTRAINT [DriverTrip_litresVariance_df] DEFAULT 0,
    [notes] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [DriverTrip_status_df] DEFAULT 'OPEN',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DriverTrip_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [DriverTrip_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [DriverTrip_driverId_tripDate_key] UNIQUE NONCLUSTERED ([driverId],[tripDate])
);

-- CreateTable
CREATE TABLE [dbo].[ShopDrop] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tripId] INT NOT NULL,
    [shopId] INT NOT NULL,
    [litres] DECIMAL(10,2) NOT NULL,
    [cashCollected] DECIMAL(10,2) NOT NULL CONSTRAINT [ShopDrop_cashCollected_df] DEFAULT 0,
    [notes] NVARCHAR(1000),
    [droppedAt] DATETIME2 NOT NULL CONSTRAINT [ShopDrop_droppedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ShopDrop_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ShopDrop_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[DriverExpense] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tripId] INT NOT NULL,
    [driverId] INT NOT NULL,
    [category] NVARCHAR(1000) NOT NULL,
    [amount] DECIMAL(10,2) NOT NULL,
    [description] NVARCHAR(1000),
    [receiptNo] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DriverExpense_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [DriverExpense_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[DriverTrip] ADD CONSTRAINT [DriverTrip_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ShopDrop] ADD CONSTRAINT [ShopDrop_tripId_fkey] FOREIGN KEY ([tripId]) REFERENCES [dbo].[DriverTrip]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ShopDrop] ADD CONSTRAINT [ShopDrop_shopId_fkey] FOREIGN KEY ([shopId]) REFERENCES [dbo].[Shop]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DriverExpense] ADD CONSTRAINT [DriverExpense_tripId_fkey] FOREIGN KEY ([tripId]) REFERENCES [dbo].[DriverTrip]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DriverExpense] ADD CONSTRAINT [DriverExpense_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
