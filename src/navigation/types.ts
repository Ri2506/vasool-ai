import type { NavigatorScreenParams } from '@react-navigation/native';
import type { DueTodayItem } from '@/db/repos/collections';

export type AuthStackParamList = {
  Language: undefined;
  PhoneLogin: undefined;
  Otp: undefined;
  PinLogin: undefined;
};

export type OwnerStackParamList = {
  Tabs: NavigatorScreenParams<OwnerTabParamList>;
  BorrowerDetail: { id: string };
  BorrowerEdit: { id?: string };
  NewLoan: { borrowerId: string };
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
  BorrowerRating: { id: string };
  Deposits: undefined;
  Guarantor: { loanId: string };
  LoanCelebration: { borrowerName: string; principal: number; totalPaid: number; installments: number; rating: number; borrowerId: string };
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

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Owner: NavigatorScreenParams<OwnerStackParamList>;
  Agent: NavigatorScreenParams<AgentTabParamList>;
};
