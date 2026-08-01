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
        // Filter out legacy mock seed transactions if present in storage
        const clean = parsed.filter(tx => tx.id !== 'tx-001' && tx.id !== 'tx-002');
        if (clean.length !== parsed.length) {
          localStorage.setItem(storageKey, JSON.stringify(clean));
        }
        setLedger(clean);
      } catch (err) {
        console.error('Failed to parse Web3 ledger storage:', err);
        setLedger([]);
      }
    } else {
      setLedger([]);
    }
  }, [address, isConnected]);

  const addTransaction = useCallback((
    type: 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER' | 'CONTRACT',
    amount: string,
    targetAddress: string,
    token: string = 'ETH',
    txHash?: string
  ) => {
    if (!address || !isConnected) return;

    const newTx: LedgerTransaction = {
      id: `tx-${Date.now()}`,
      timestamp: Date.now(),
      type,
      amount,
      token,
      targetAddress,
      txHash: txHash || '',
      status: 'SUCCESS',
      network: chain?.name || 'Ethereum Mainnet'
    };

    const storageKey = `proton_v1_ledger_${address.toLowerCase()}`;
    setLedger(prev => {
      const updatedLedger = [newTx, ...prev];
      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedLedger));
      } catch (err) {
        console.warn("Failed to persist web3 transaction:", err);
      }
      return updatedLedger;
    });
    refetchBalance();
  }, [address, isConnected, chain?.name, refetchBalance]);

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
