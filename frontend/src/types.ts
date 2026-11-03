export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type Zone = '.ru' | '.com' | '.io' | '.xyz';
export type RollType = 'normal' | 'uncommon_plus' | 'rare_plus' | 'epic_plus';

export interface User {
  id: number;
  telegram_id: number;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  balance: number;
  total_spins: number;
  is_admin: boolean;
  is_banned: boolean;
  created_at: string;
}

export interface Domain {
  id: number;
  name: string;
  zone: Zone;
  full_name: string;
  rarity: Rarity;
  weight: number;
  price: number;
  is_available: boolean;
}

export interface MeStats {
  collection_count: number;
  collection_value: number;
  collection_by_rarity: Record<Rarity, number>;
  rank: number | null;
  total_players: number;
  daily_bonus: number;
  daily_available_at: string | null;
  can_daily_bonus: boolean;
}

export interface LuckProgress {
  level: number;
  title: string;
  total_spins: number;
  next_level_spins: number | null;
  spins_into_level: number;
  spins_to_next: number | null;
  level_luck: number;
  inventory_luck: number;
  total_luck: number;
}

export interface MeResponse {
  user: User;
  stats: MeStats;
  progress: LuckProgress;
}

export interface EarnResult {
  earned: number;
  balance: number;
}

export interface AdminUser {
  id: number;
  telegram_id: number;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  balance: number;
  total_spins: number;
  is_admin: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  created_at: string;
}

export interface AdminOverview {
  users: number;
  banned: number;
  admins: number;
  total_balance: number;
  total_spins: number;
  inventory_count: number;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
}

export interface AdminGrantResult {
  domain: Domain;
  balance: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RollTypeMeta {
  key: RollType;
  title: string;
  short_title: string;
  cost: number;
  rarities: Rarity[];
  min_price: number;
  description: string;
}

export interface UpgradeSector {
  sector: 10 | 25 | 50 | 75;
  multiplier: number;
  ev: number;
}

export interface SpinResult {
  id: number;
  roll_type: RollType;
  times: number;
  domain: Domain;
  rarity: Rarity;
  price: number;
  balance: number;
  auto_sold: boolean;
  auto_sold_price: number | null;
  inventory_id: number | null;
  created_at: string;
}

export interface SpinBatchResult {
  items: SpinResult[];
  times: number;
  total_cost: number;
  balance: number;
}

export interface KeepResult {
  spin_id: number;
  domain: Domain;
  inventory_id: number;
  balance: number;
}

export interface InventoryItem {
  id: number;
  domain: Domain;
  acquired_at: string;
  sold_at: string | null;
  sold_price: number | null;
}

export interface SellResult {
  item_id: number;
  sold_price: number;
  balance: number;
  domain: Domain;
}

export interface BulkSellResult {
  sold: number;
  earned: number;
  balance: number;
  ids: number[];
}

export interface AutosellSettings {
  autosell_common: boolean;
  autosell_rare: boolean;
  autosell_epic: boolean;
  autosell_legendary: boolean;
  autosell_mythic: boolean;
  autosell_below_price: number | null;
}

export interface UpgradePreview {
  target_value: number;
  target_rarity: Rarity;
  domain: Domain | null;
}

export interface UpgradeResult {
  id: number;
  success: boolean;
  chance: number;
  multiplier: number;
  spent_value: number;
  target_value: number;
  from_domain_ids: number[];
  burned_ids: number[];
  domain: Domain | null;
  balance: number;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
  domains_count: number;
  is_me: boolean;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  total_players: number;
}

export interface Drop {
  spin_id: number;
  user_id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  domain: Domain;
  rarity: Rarity;
  price: number;
  roll_type: RollType;
  auto_sold: boolean;
  created_at: string;
}

export interface DropsResponse {
  drops: Drop[];
}

export interface DailyBonusResponse {
  rewarded: boolean;
  amount: number;
  balance: number;
  next_available_at: string | null;
  user: User;
}

export interface Meta {
  app_name: string;
  zones: Zone[];
  rarities: Array<{
    key: Rarity;
    title: string;
    min_price: number;
    max_price: number | null;
    color: string;
  }>;
  roll_types: RollTypeMeta[];
  upgrade_sectors: UpgradeSector[];
  economy: {
    start_balance: number;
    daily_bonus_percent: number;
    daily_bonus_max: number;
    daily_cooldown_hours: number;
    spin_cooldown_seconds: number;
    total_domains: number;
    upgrade_chance_ranges: Record<string, [number, number]>;
  };
  total_domains: number;
}

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: TelegramWebAppUser; start_param?: string };
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  disableVerticalSwipes?: () => void;
  enableClosingConfirmation?: () => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  themeParams?: Record<string, string>;
  colorScheme?: 'light' | 'dark';
  viewportStableHeight?: number;
  platform?: string;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}
