BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Route] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [supervisorId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Route_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Route_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Route_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[Farmer] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [idNumber] NVARCHAR(1000),
    [phone] NVARCHAR(1000) NOT NULL,
    [routeId] INT NOT NULL,
    [pricePerLitre] DECIMAL(10,2) NOT NULL,
    [paymentMethod] NVARCHAR(1000) NOT NULL CONSTRAINT [Farmer_paymentMethod_df] DEFAULT 'MPESA',
    [mpesaPhone] NVARCHAR(1000),
    [bankName] NVARCHAR(1000),
    [bankAccount] NVARCHAR(1000),
    [paidOn15th] BIT NOT NULL CONSTRAINT [Farmer_paidOn15th_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [Farmer_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Farmer_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Farmer_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Farmer_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[Employee] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [phone] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL,
    [salary] DECIMAL(10,2) NOT NULL,
    [passwordHash] NVARCHAR(1000),
    [paymentMethod] NVARCHAR(1000) NOT NULL CONSTRAINT [Employee_paymentMethod_df] DEFAULT 'MPESA',
    [mpesaPhone] NVARCHAR(1000),
    [bankName] NVARCHAR(1000),
    [bankAccount] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [Employee_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Employee_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Employee_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Employee_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[MilkCollection] (
    [id] INT NOT NULL IDENTITY(1,1),
    [farmerId] INT NOT NULL,
    [routeId] INT NOT NULL,
    [graderId] INT NOT NULL,
    [litres] DECIMAL(10,2) NOT NULL,
    [collectedAt] DATETIME2 NOT NULL,
    [synced] BIT NOT NULL CONSTRAINT [MilkCollection_synced_df] DEFAULT 0,
    [smsSent] BIT NOT NULL CONSTRAINT [MilkCollection_smsSent_df] DEFAULT 0,
    [receiptNo] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MilkCollection_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [MilkCollection_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[FactoryReceipt] (
    [id] INT NOT NULL IDENTITY(1,1),
    [graderId] INT NOT NULL,
    [litres] DECIMAL(10,2) NOT NULL,
    [receivedAt] DATETIME2 NOT NULL,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [FactoryReceipt_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [FactoryReceipt_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[PasteurizationBatch] (
    [id] INT NOT NULL IDENTITY(1,1),
    [batchNo] NVARCHAR(1000) NOT NULL,
    [inputLitres] DECIMAL(10,2) NOT NULL,
    [outputLitres] DECIMAL(10,2) NOT NULL,
    [lossLitres] DECIMAL(10,2) NOT NULL CONSTRAINT [PasteurizationBatch_lossLitres_df] DEFAULT 0,
    [processedAt] DATETIME2 NOT NULL,
    [qualityNotes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PasteurizationBatch_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PasteurizationBatch_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PasteurizationBatch_batchNo_key] UNIQUE NONCLUSTERED ([batchNo])
);

-- CreateTable
CREATE TABLE [dbo].[Shop] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [location] NVARCHAR(1000),
    [keeperId] INT NOT NULL,
    [tillNumber] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Shop_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Shop_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Shop_code_key] UNIQUE NONCLUSTERED ([code]),
    CONSTRAINT [Shop_keeperId_key] UNIQUE NONCLUSTERED ([keeperId])
);

-- CreateTable
CREATE TABLE [dbo].[DeliveryToShop] (
    [id] INT NOT NULL IDENTITY(1,1),
    [batchId] INT NOT NULL,
    [shopId] INT NOT NULL,
    [driverId] INT NOT NULL,
    [litres] DECIMAL(10,2) NOT NULL,
    [sellingPrice] DECIMAL(10,2) NOT NULL,
    [deliveredAt] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DeliveryToShop_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [DeliveryToShop_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ShopSale] (
    [id] INT NOT NULL IDENTITY(1,1),
    [shopId] INT NOT NULL,
    [saleDate] DATETIME2 NOT NULL,
    [litresSold] DECIMAL(10,2) NOT NULL,
    [expectedRevenue] DECIMAL(10,2) NOT NULL,
    [cashCollected] DECIMAL(10,2) NOT NULL,
    [tillAmount] DECIMAL(10,2) NOT NULL CONSTRAINT [ShopSale_tillAmount_df] DEFAULT 0,
    [variance] DECIMAL(10,2) NOT NULL CONSTRAINT [ShopSale_variance_df] DEFAULT 0,
    [reconciled] BIT NOT NULL CONSTRAINT [ShopSale_reconciled_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ShopSale_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ShopSale_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[FarmerAdvance] (
    [id] INT NOT NULL IDENTITY(1,1),
    [farmerId] INT NOT NULL,
    [amount] DECIMAL(10,2) NOT NULL,
    [advanceDate] DATETIME2 NOT NULL,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [FarmerAdvance_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [FarmerAdvance_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[FarmerDeduction] (
    [id] INT NOT NULL IDENTITY(1,1),
    [farmerId] INT NOT NULL,
    [amount] DECIMAL(10,2) NOT NULL,
    [reason] NVARCHAR(1000) NOT NULL,
    [deductionDate] DATETIME2 NOT NULL,
    [periodMonth] INT NOT NULL,
    [periodYear] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [FarmerDeduction_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [FarmerDeduction_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[FarmerPayment] (
    [id] INT NOT NULL IDENTITY(1,1),
    [farmerId] INT NOT NULL,
    [periodMonth] INT NOT NULL,
    [periodYear] INT NOT NULL,
    [isMidMonth] BIT NOT NULL CONSTRAINT [FarmerPayment_isMidMonth_df] DEFAULT 0,
    [grossPay] DECIMAL(10,2) NOT NULL,
    [totalAdvances] DECIMAL(10,2) NOT NULL,
    [totalDeductions] DECIMAL(10,2) NOT NULL,
    [netPay] DECIMAL(10,2) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [FarmerPayment_status_df] DEFAULT 'PENDING',
    [kopokopoRef] NVARCHAR(1000),
    [paidAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [FarmerPayment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [FarmerPayment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FarmerPayment_farmerId_periodMonth_periodYear_isMidMonth_key] UNIQUE NONCLUSTERED ([farmerId],[periodMonth],[periodYear],[isMidMonth])
);

-- CreateTable
CREATE TABLE [dbo].[Payroll] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [periodMonth] INT NOT NULL,
    [periodYear] INT NOT NULL,
    [baseSalary] DECIMAL(10,2) NOT NULL,
    [varianceDeductions] DECIMAL(10,2) NOT NULL CONSTRAINT [Payroll_varianceDeductions_df] DEFAULT 0,
    [otherDeductions] DECIMAL(10,2) NOT NULL CONSTRAINT [Payroll_otherDeductions_df] DEFAULT 0,
    [netPay] DECIMAL(10,2) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Payroll_status_df] DEFAULT 'PENDING',
    [kopokopoRef] NVARCHAR(1000),
    [paidAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Payroll_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Payroll_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Payroll_employeeId_periodMonth_periodYear_key] UNIQUE NONCLUSTERED ([employeeId],[periodMonth],[periodYear])
);

-- CreateTable
CREATE TABLE [dbo].[VarianceRecord] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [amount] DECIMAL(10,2) NOT NULL,
    [recordDate] DATETIME2 NOT NULL,
    [periodMonth] INT NOT NULL,
    [periodYear] INT NOT NULL,
    [description] NVARCHAR(1000),
    [applied] BIT NOT NULL CONSTRAINT [VarianceRecord_applied_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VarianceRecord_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [VarianceRecord_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[KopokopoTransaction] (
    [id] INT NOT NULL IDENTITY(1,1),
    [shopId] INT NOT NULL,
    [tillNumber] NVARCHAR(1000) NOT NULL,
    [amount] DECIMAL(10,2) NOT NULL,
    [transactionRef] NVARCHAR(1000) NOT NULL,
    [transactionDate] DATETIME2 NOT NULL,
    [matched] BIT NOT NULL CONSTRAINT [KopokopoTransaction_matched_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [KopokopoTransaction_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [KopokopoTransaction_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [KopokopoTransaction_transactionRef_key] UNIQUE NONCLUSTERED ([transactionRef])
);

-- CreateTable
CREATE TABLE [dbo].[_BatchReceipts] (
    [A] INT NOT NULL,
    [B] INT NOT NULL,
    CONSTRAINT [_BatchReceipts_AB_unique] UNIQUE NONCLUSTERED ([A],[B])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MilkCollection_collectedAt_idx] ON [dbo].[MilkCollection]([collectedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MilkCollection_farmerId_collectedAt_idx] ON [dbo].[MilkCollection]([farmerId], [collectedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MilkCollection_routeId_collectedAt_idx] ON [dbo].[MilkCollection]([routeId], [collectedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [_BatchReceipts_B_index] ON [dbo].[_BatchReceipts]([B]);

-- AddForeignKey
ALTER TABLE [dbo].[Route] ADD CONSTRAINT [Route_supervisorId_fkey] FOREIGN KEY ([supervisorId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Farmer] ADD CONSTRAINT [Farmer_routeId_fkey] FOREIGN KEY ([routeId]) REFERENCES [dbo].[Route]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MilkCollection] ADD CONSTRAINT [MilkCollection_farmerId_fkey] FOREIGN KEY ([farmerId]) REFERENCES [dbo].[Farmer]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MilkCollection] ADD CONSTRAINT [MilkCollection_routeId_fkey] FOREIGN KEY ([routeId]) REFERENCES [dbo].[Route]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MilkCollection] ADD CONSTRAINT [MilkCollection_graderId_fkey] FOREIGN KEY ([graderId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FactoryReceipt] ADD CONSTRAINT [FactoryReceipt_graderId_fkey] FOREIGN KEY ([graderId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Shop] ADD CONSTRAINT [Shop_keeperId_fkey] FOREIGN KEY ([keeperId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DeliveryToShop] ADD CONSTRAINT [DeliveryToShop_batchId_fkey] FOREIGN KEY ([batchId]) REFERENCES [dbo].[PasteurizationBatch]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DeliveryToShop] ADD CONSTRAINT [DeliveryToShop_shopId_fkey] FOREIGN KEY ([shopId]) REFERENCES [dbo].[Shop]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DeliveryToShop] ADD CONSTRAINT [DeliveryToShop_driverId_fkey] FOREIGN KEY ([driverId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ShopSale] ADD CONSTRAINT [ShopSale_shopId_fkey] FOREIGN KEY ([shopId]) REFERENCES [dbo].[Shop]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FarmerAdvance] ADD CONSTRAINT [FarmerAdvance_farmerId_fkey] FOREIGN KEY ([farmerId]) REFERENCES [dbo].[Farmer]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FarmerDeduction] ADD CONSTRAINT [FarmerDeduction_farmerId_fkey] FOREIGN KEY ([farmerId]) REFERENCES [dbo].[Farmer]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FarmerPayment] ADD CONSTRAINT [FarmerPayment_farmerId_fkey] FOREIGN KEY ([farmerId]) REFERENCES [dbo].[Farmer]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Payroll] ADD CONSTRAINT [Payroll_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VarianceRecord] ADD CONSTRAINT [VarianceRecord_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[KopokopoTransaction] ADD CONSTRAINT [KopokopoTransaction_shopId_fkey] FOREIGN KEY ([shopId]) REFERENCES [dbo].[Shop]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[_BatchReceipts] ADD CONSTRAINT [_BatchReceipts_A_fkey] FOREIGN KEY ([A]) REFERENCES [dbo].[FactoryReceipt]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[_BatchReceipts] ADD CONSTRAINT [_BatchReceipts_B_fkey] FOREIGN KEY ([B]) REFERENCES [dbo].[PasteurizationBatch]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
