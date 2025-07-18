import { ObjectId } from 'mongodb';

export interface WalletAddress {
  address: string;
  currency: string; // e.g., "ETH", "BTC"
  network: string; // e.g., "Ethereum", "Bitcoin"
}

export interface UserSettings {
  currencyPreference: string; // e.g., "USD", "EUR"
  notifications: {
    email: boolean;
    sms: boolean;
  };
}

export interface User {
  _id?: ObjectId;
  email: string;
  name: string;
  role: string; // e.g., "admin", "user", "accountant"
  organizationId?: ObjectId; // Reference to Organizations
  walletAddresses: WalletAddress[];
  phone?: string;
  profilePicture?: string; // URL to image
  settings: UserSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: string;
  organizationId?: ObjectId;
  walletAddresses?: WalletAddress[];
  phone?: string;
  profilePicture?: string;
  settings?: Partial<UserSettings>;
}

export interface UpdateUserInput {
  name?: string;
  role?: string;
  organizationId?: ObjectId;
  walletAddresses?: WalletAddress[];
  phone?: string;
  profilePicture?: string;
  settings?: Partial<UserSettings>;
} 