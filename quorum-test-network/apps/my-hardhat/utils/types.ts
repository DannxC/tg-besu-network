/**
 * Tipos, Interfaces e Type Helpers
 */

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Resultado de deploy de um contrato
 */
export interface DeployResult {
  contractAddress: string;
  deployerAddress: string;
  transactionHash: string;
  blockNumber: number;
}

/**
 * Configuração para deploy de contrato
 */
export interface ContractConfig {
  name: string;
  initialValue?: bigint;
  gasPrice?: bigint;
}

/**
 * Resultado de uma transação
 */
export interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  blockNumber: number;
  gasUsed: bigint;
}

// ============================================================================
// TYPE HELPERS
// ============================================================================

/**
 * Ethereum address (0x prefixed)
 */
export type Address = `0x${string}`;

/**
 * Transaction hash (0x prefixed)
 */
export type TransactionHash = `0x${string}`;

/**
 * Chain ID
 */
export type ChainId = number;

