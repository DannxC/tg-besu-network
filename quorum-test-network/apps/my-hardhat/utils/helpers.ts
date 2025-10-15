/**
 * Funções utilitárias
 */

import type { Address } from "./types.js";

/**
 * Formata wei para ether (string legível)
 */
export function formatWeiToEther(wei: bigint): string {
  const ether = Number(wei) / 1e18;
  return `${ether.toFixed(4)} ETH`;
}

/**
 * Formata wei com sufixo apropriado
 */
export function formatWei(wei: bigint): string {
  const weiNum = Number(wei);
  
  if (weiNum === 0) return "0 wei";
  if (weiNum >= 1e18) return `${(weiNum / 1e18).toFixed(4)} ETH`;
  if (weiNum >= 1e9) return `${(weiNum / 1e9).toFixed(4)} Gwei`;
  if (weiNum >= 1e6) return `${(weiNum / 1e6).toFixed(4)} Mwei`;
  
  return `${weiNum} wei`;
}

/**
 * Valida se é um endereço Ethereum válido
 */
export function isValidAddress(address: string): address is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Trunca endereço para exibição (0x1234...5678)
 */
export function truncateAddress(address: string, chars = 4): string {
  if (!isValidAddress(address)) return address;
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`;
}

/**
 * Sleep/delay para uso em scripts
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

