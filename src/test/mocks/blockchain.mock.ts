/**
 * Mock Blockchain Services for unit testing
 */

export const mockTransactionResult = {
  hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  receipt: {
    status: 1,
    blockNumber: 12345678,
    gasUsed: BigInt(21000),
    logs: [],
  },
  success: true,
  blockNumber: 12345678,
  gasUsed: BigInt(21000),
  effectiveGasPrice: BigInt(1000000000),
};

export const mockStomaTradeContractService = {
  onModuleInit: jest.fn(),
  getContract: jest.fn().mockReturnValue({
    runner: { address: '0xPlatformWalletAddress' },
    interface: {
      parseLog: jest.fn().mockReturnValue({
        name: 'FarmerMinted',
        args: { nftId: BigInt(1001), farmer: '0xFarmerAddress', namaKomoditas: 'Coffee' },
      }),
      encodeFunctionData: jest.fn().mockReturnValue('0xencodeddata'),
    },
  }),
  getContractAddress: jest.fn().mockReturnValue('0xContractAddress'),
  getstomatradeAddress: jest.fn().mockReturnValue('0xContractAddress'),
  getSignerAddress: jest.fn().mockReturnValue('0xPlatformWalletAddress'),
  getCreateProjectCalldata: jest.fn().mockReturnValue('0xencodeddata'),
  getMintFarmerCalldata: jest.fn().mockReturnValue('0xencodeddata'),
  createProject: jest.fn().mockResolvedValue(mockTransactionResult),
  mintFarmerNFT: jest.fn().mockResolvedValue(mockTransactionResult),
  addFarmer: jest.fn().mockResolvedValue(mockTransactionResult),
  invest: jest.fn().mockResolvedValue(mockTransactionResult),
  // New method names (aligned with smart contract)
  withdrawProject: jest.fn().mockResolvedValue(mockTransactionResult),
  claimWithdraw: jest.fn().mockResolvedValue(mockTransactionResult),
  refundProject: jest.fn().mockResolvedValue(mockTransactionResult),
  claimRefund: jest.fn().mockResolvedValue(mockTransactionResult),
  closeProject: jest.fn().mockResolvedValue(mockTransactionResult),
  finishProject: jest.fn().mockResolvedValue(mockTransactionResult),
  // Deprecated methods (backward compatibility)
  depositProfit: jest.fn().mockResolvedValue(mockTransactionResult),
  claimProfit: jest.fn().mockResolvedValue(mockTransactionResult),
  markRefundable: jest.fn().mockResolvedValue(mockTransactionResult),
  closeCrowdFunding: jest.fn().mockResolvedValue(mockTransactionResult),
  getProject: jest.fn().mockResolvedValue({
    owner: '0xOwnerAddress',
    valueProject: BigInt(1000000),
    maxCrowdFunding: BigInt(500000),
    totalRaised: BigInt(100000),
    status: 0,
    cid: 'QmTestCid',
  }),
  getContribution: jest.fn().mockResolvedValue({
    id: BigInt(1),
    idToken: BigInt(1001),
    idProject: BigInt(3001),
    investor: '0xInvestorAddress',
    amount: BigInt(50000),
    status: 0,
  }),
  // New read methods (aligned with smart contract)
  getAdminRequiredDeposit: jest.fn().mockResolvedValue({
    totalPrincipal: BigInt(100000),
    totalInvestorProfit: BigInt(10000),
    totalRequired: BigInt(110000),
  }),
  getInvestorReturn: jest.fn().mockResolvedValue({
    principal: BigInt(50000),
    profit: BigInt(5000),
    totalReturn: BigInt(55000),
  }),
  getProjectProfitBreakdown: jest.fn().mockResolvedValue({
    grossProfit: BigInt(20000),
    investorProfitPool: BigInt(16000),
    platformProfit: BigInt(4000),
  }),
  // Deprecated methods (backward compatibility)
  getProfitPool: jest.fn().mockResolvedValue(BigInt(10000)),
  getClaimedProfit: jest.fn().mockResolvedValue(BigInt(5000)),
  getTokenURI: jest.fn().mockResolvedValue('ipfs://QmTestCid'),
  parseEventLogs: jest.fn().mockReturnValue([]),
  getEventFromReceipt: jest.fn().mockReturnValue({
    topics: ['0xtopic1'],
    data: '0xdata',
  }),
};

export const mockEthersProviderService = {
  onModuleInit: jest.fn(),
  getProvider: jest.fn().mockReturnValue({
    getNetwork: jest.fn().mockResolvedValue({ name: 'lisk-sepolia', chainId: BigInt(4202) }),
    getBlockNumber: jest.fn().mockResolvedValue(12345678),
    getFeeData: jest.fn().mockResolvedValue({
      gasPrice: BigInt(1000000000),
      maxFeePerGas: BigInt(2000000000),
      maxPriorityFeePerGas: BigInt(1000000000),
    }),
  }),
  getChainId: jest.fn().mockReturnValue(4202),
  getBlockNumber: jest.fn().mockResolvedValue(12345678),
  getGasPrice: jest.fn().mockResolvedValue(BigInt(1000000000)),
  estimateGas: jest.fn().mockResolvedValue(BigInt(21000)),
  waitForTransaction: jest.fn().mockResolvedValue({ status: 1, blockNumber: 12345678 }),
  getTransaction: jest.fn(),
  getTransactionReceipt: jest.fn(),
  getBalance: jest.fn().mockResolvedValue(BigInt(1000000000000000000)),
  getBlock: jest.fn(),
  parseUnits: jest.fn((value, decimals) => BigInt(value) * BigInt(10 ** (decimals || 18))),
  formatUnits: jest.fn((value, decimals) => (Number(value) / 10 ** (decimals || 18)).toString()),
  isAddress: jest.fn().mockReturnValue(true),
  getAddress: jest.fn((addr) => addr),
};

export const mockPlatformWalletService = {
  onModuleInit: jest.fn(),
  getWallet: jest.fn().mockReturnValue({
    address: '0xPlatformWalletAddress',
    provider: {
      getBalance: jest.fn().mockResolvedValue(BigInt(1000000000000000000)),
    },
  }),
  getAddress: jest.fn().mockReturnValue('0xPlatformWalletAddress'),
  getBalance: jest.fn().mockResolvedValue(BigInt(1000000000000000000)),
  getNonce: jest.fn().mockResolvedValue(1),
  signMessage: jest.fn().mockResolvedValue('0xSignedMessage'),
  signTransaction: jest.fn().mockResolvedValue('0xSignedTransaction'),
  sendTransaction: jest.fn().mockResolvedValue({ hash: '0xTxHash' }),
};

export const mockTransactionService = {
  sendTransaction: jest.fn().mockResolvedValue(mockTransactionResult),
  executeContractMethod: jest.fn().mockResolvedValue(mockTransactionResult),
  callContractMethod: jest.fn(),
};

export const mockBlockchainEventService = {
  onModuleInit: jest.fn(),
  startListening: jest.fn(),
  stopListening: jest.fn(),
  queryPastEvents: jest.fn().mockResolvedValue([]),
  syncEventsFromBlock: jest.fn(),
};

export const createMockBlockchainServices = () => ({
  stomaTradeContract: { ...mockStomaTradeContractService },
  ethersProvider: { ...mockEthersProviderService },
  platformWallet: { ...mockPlatformWalletService },
  transaction: { ...mockTransactionService },
  blockchainEvent: { ...mockBlockchainEventService },
});

