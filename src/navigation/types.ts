import type { NavigatorScreenParams } from '@react-navigation/native';
import type { DueTodayItem } from '@/db/repos/collections';

export type AuthStackParamList = {
  Language: undefined;
  PhoneLogin: undefined;
  Otp: undefined;
  PinLogin: undefined;
};

export interface SuccessReceiptParams {
  borrowerName: string;
  amount: number;
  loanRemaining: number;
  daysPaid: number;
  totalDays: number;
  agentName?: string;
  timestamp: number;
}

export type OwnerStackParamList = {
  Tabs: NavigatorScreenParams<OwnerTabParamList>;
  BorrowerDetail: { id: string };
  BorrowerEdit: { id?: string };
  NewLoan: { borrowerId: string; renewedFromId?: string };
  TopUp: { loanId: string };
  LoanPlan: { loanId: string };
  Collect: { item: DueTodayItem };
  BatchCollect: undefined;
  Lines: undefined;
  Expenses: undefined;
  Investments: undefined;
  MonthlySummary: undefined;
  Overdue: undefined;
  AgentManagement: undefined;
  Subscription: undefined;
  AIChat: undefined;
  Import: undefined;
  Documents: { borrowerId: string };
  Referral: undefined;
  NippuReport: undefined;
  DailySummary: undefined;
  PattiNote: undefined;
  OutstandingReport: undefined;
  SuccessReceipt: SuccessReceiptParams;
  BorrowerRating: { id: string };
  Deposits: undefined;
  Guarantor: { loanId: string };
  LoanCelebration: { borrowerName: string; principal: number; totalPaid: number; installments: number; rating: number; borrowerId: string };
  HandoverInbox: undefined;
  LoanRequests: undefined;
  FraudDashboard: undefined;
  ToolsHub: undefined;
  SmsQueue: undefined;
  SmsSettings: undefined;
  MultiLineDashboard: undefined;
  Diagnostics: undefined;
  Backup: undefined;
  Sync: undefined;
  OrgSwitcher: undefined;
};

export type OwnerTabParamList = {
  Home: undefined;
  Borrowers: undefined;
  Reports: undefined;
  Settings: undefined;
};

export type AgentTabParamList = {
  Collect: undefined;
  Expenses: undefined;
  Summary: undefined;
};

export type AgentStackParamList = {
  AgentTabs: NavigatorScreenParams<AgentTabParamList>;
  AgentReceipt: SuccessReceiptParams;
  AgentSharePreview: undefined;
  BatchCollect: undefined;
  AgentEOD: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Owner: NavigatorScreenParams<OwnerStackParamList>;
  Agent: NavigatorScreenParams<AgentStackParamList>;
};
