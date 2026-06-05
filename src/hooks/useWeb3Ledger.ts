import { useEffect, useState, useCallback } from 'react';
import { useAccount, useBalance } from 'wagmi';

export interface LedgerTransaction {
  id: string;
  timestamp: number;
  type: 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER' | 'CONTRACT';
  amount: string;
  token: string;
  targetAddress: string;
  txHash: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  network: string;
}

export function useWeb3Ledger() {
  const { address, isConnected, chain } = useAccount();
  const [ledger, setLedger] = useState<LedgerTransaction[]>([]);

  // we use standard useBalance config
  const { data: balanceData, isLoading: isBalanceLoading, refetch: refetchBalance } = useBalance({
    address,
  });

  // Load ledger transactions on wallet change
  useEffect(() => {
    if (!isConnected || !address) {
      setLedger([]);
      return;
    }

    const storageKey = `proton_v1_ledger_${address.toLowerCase()}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as LedgerTransaction[];
        setLedger(parsed);
      } catch (err) {
        console.error('Failed to parse Web3 ledger storage:', err);
        setLedger([]);
      }
    } else {
      // Seed initial mock transactional history for the developer simulation/playground
      const initialTransactions: LedgerTransaction[] = [
        {
          id: 'tx-001',
          timestamp: Date.now() - 3600000 * 24 * 3, // 3 days ago
          type: 'DEPOSIT',
          amount: '1.25',
          token: 'ETH',
          targetAddress: address,
          txHash: '0x3a9f...e62b',
          status: 'SUCCESS',
          network: chain?.name || 'Ethereum Mainnet'
        },
        {
          id: 'tx-002',
          timestamp: Date.now() - 3600000 * 4, // 4 hours ago
          type: 'CONTRACT',
          amount: '0.045',
          token: 'ETH',
          targetAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d1476B',
          txHash: '0x9d4b...4f7a',
          status: 'SUCCESS',
          network: chain?.name || 'Ethereum Mainnet'
        }
      ];
      localStorage.setItem(storageKey, JSON.stringify(initialTransactions));
      setLedger(initialTransactions);
    }
  }, [address, isConnected, chain?.name]);

  const addTransaction = useCallback((
    type: 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER' | 'CONTRACT',
    amount: string,
    targetAddress: string,
    token: string = 'ETH'
  ) => {
    if (!address || !isConnected) return;

    const newTx: LedgerTransaction = {
      id: `tx-${Date.now()}`,
      timestamp: Date.now(),
      type,
      amount,
      token,
      targetAddress,
      txHash: `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('').slice(0, 4)}...${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('').slice(-4)}`,
      status: 'SUCCESS',
      network: chain?.name || 'Ethereum Mainnet'
    };

    const storageKey = `proton_v1_ledger_${address.toLowerCase()}`;
    const updatedLedger = [newTx, ...ledger];
    localStorage.setItem(storageKey, JSON.stringify(updatedLedger));
    setLedger(updatedLedger);
    refetchBalance();
  }, [address, isConnected, ledger, chain?.name, refetchBalance]);

  const clearLedger = useCallback(() => {
    if (!address || !isConnected) return;
    const storageKey = `proton_v1_ledger_${address.toLowerCase()}`;
    localStorage.removeItem(storageKey);
    setLedger([]);
  }, [address, isConnected]);

  return {
    address,
    isConnected,
    chain,
    balance: balanceData ? `${parseFloat(balanceData.formatted).toFixed(4)} ${balanceData.symbol}` : '0.0000 ETH',
    isBalanceLoading,
    ledger,
    addTransaction,
    clearLedger,
    refetchBalance
  };
}
