export type SearchResult = {
  status: 'available' | 'taken' | 'reserved' | 'invalid' | 'idle';
  name: string;
  error?: string;
  owner?: string;
};

export type TxState = 'idle' | 'pending' | 'confirming' | 'success' | 'failed';
export type TxErrorType = 'insufficient_balance' | 'generic';

export interface DurationOption {
  label: string;
  years: number;
  permanent: boolean;
}
