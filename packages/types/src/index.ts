export type AlertType = 'follow' | 'subscribe' | 'sub_gift' | 'cheer' | 'raid' | 'donation';

export interface AlertData {
  id: string;
  type: AlertType;
  timestamp: string;
  user: {
    id?: string;
    name: string;
    displayName: string;
    avatar?: string;
  };
  amount?: number;
  message?: string;
  tier?: '1000' | '2000' | '3000';
  viewers?: number;
  isGift?: boolean;
  cumulative?: number;
  metadata?: Record<string, unknown>;
}

export interface AlertConfig {
  duration: number;
  animation: string;
  sound: string;
  template: string;
  position: 'top' | 'center' | 'bottom';
}

export interface ServerToClientEvents {
  'alert:trigger': (alert: AlertData) => void;
  'alert:complete': (alertId: string) => void;
  'alert:queue': (queue: AlertData[]) => void;
  'connection:established': (data: { clientId: string }) => void;
  'test:ping': (message: string) => void;
}

export interface ClientToServerEvents {
  'alert:complete': (alertId: string) => void;
  'alert:skip': (alertId: string) => void;
  'test:trigger': (type: AlertType) => void;
}

export interface DonationData {
  id: string;
  provider: 'stripe' | 'paypal';
  amount: number;
  currency: string;
  donorName: string;
  donorEmail?: string;
  message?: string;
  isAnonymous: boolean;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface DonationPageConfig {
  streamerName: string;
  streamerAvatar?: string;
  minAmount: number;
  suggestedAmounts: number[];
  currency: string;
  messageEnabled: boolean;
  messageMaxLength: number;
  thankYouMessage: string;
}

export interface TwitchEventBase {
  subscription: {
    id: string;
    status: string;
    type: string;
    version: string;
    cost: number;
    condition: Record<string, string>;
    transport: {
      method: string;
      session_id?: string;
    };
    created_at: string;
  };
  event: Record<string, unknown>;
}

export interface ChannelFollowEvent {
  user_id: string;
  user_login: string;
  user_name: string;
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  followed_at: string;
}

export interface ChannelSubscribeEvent {
  user_id: string;
  user_login: string;
  user_name: string;
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  tier: '1000' | '2000' | '3000';
  is_gift: boolean;
}

export interface ChannelSubscriptionGiftEvent {
  user_id: string;
  user_login: string;
  user_name: string;
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  total: number;
  tier: '1000' | '2000' | '3000';
  cumulative_total: number | null;
  is_anonymous: boolean;
}

export interface ChannelCheerEvent {
  is_anonymous: boolean;
  user_id: string | null;
  user_login: string | null;
  user_name: string | null;
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  message: string;
  bits: number;
}

export interface ChannelRaidEvent {
  from_broadcaster_user_id: string;
  from_broadcaster_user_login: string;
  from_broadcaster_user_name: string;
  to_broadcaster_user_id: string;
  to_broadcaster_user_login: string;
  to_broadcaster_user_name: string;
  viewers: number;
}

export interface StreamStats {
  followCount: number;
  subCount: number;
  cheerCount: number;
  donationTotal: number;
  viewerCount: number;
}
