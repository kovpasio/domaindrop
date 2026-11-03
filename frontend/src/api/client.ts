import type {
  AdminGrantResult,
  AdminOverview,
  AdminUser,
  AdminUsersResponse,
  AuthResponse,
  AutosellSettings,
  BulkSellResult,
  DailyBonusResponse,
  Domain,
  DropsResponse,
  EarnResult,
  InventoryItem,
  KeepResult,
  LeaderboardResponse,
  MeResponse,
  Meta,
  Rarity,
  RollType,
  SellResult,
  SpinBatchResult,
  SpinResult,
  UpgradePreview,
  UpgradeResult,
} from '@/types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '/api';
const TOKEN_KEY = 'dropzone.jwt';
const DEV_USER_KEY = 'dropzone.devUser';

export class ApiError extends Error {
  status: number;
  retryAfter?: number;

  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function apiUrl(path: string): string {
  return `${API_BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function detailToString(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'object' && item && 'msg' in item) return String(item.msg);
        return String(item);
      })
      .join('; ');
  }
  return 'Не удалось выполнить запрос';
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  withAuth = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (withAuth) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...options, headers });
  } catch {
    throw new ApiError('Нет связи с сервером. Проверьте интернет.', 0);
  }

  if (!response.ok) {
    let message = `Ошибка ${response.status}`;
    try {
      const data = await response.json();
      message = detailToString(data?.detail);
    } catch {
      // non-JSON response
    }
    const retryAfter = Number(response.headers.get('Retry-After') ?? 0) || undefined;
    throw new ApiError(message, response.status, retryAfter);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function getDevUser(): { id: number; username: string; first_name: string } {
  const raw = localStorage.getItem(DEV_USER_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { id: number; username: string; first_name: string };
      if (parsed?.id) return parsed;
    } catch {
      // regenerate
    }
  }
  const id = 100_000_000 + Math.floor(Math.random() * 800_000_000);
  const user = { id, username: 'demo_pilot', first_name: 'Demo' };
  localStorage.setItem(DEV_USER_KEY, JSON.stringify(user));
  return user;
}

export async function authenticateTelegram(): Promise<AuthResponse> {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData ?? '';
  const payload: Record<string, unknown> = { init_data: initData };
  if (!initData) {
    payload.dev_user = getDevUser();
  }

  const result = await request<AuthResponse>(
    '/auth/telegram',
    { method: 'POST', body: JSON.stringify(payload) },
    false,
  );
  setToken(result.access_token);
  return result;
}

export const api = {
  me: () => request<MeResponse>('/me'),

  meta: () => request<Meta>('/meta', {}, false),

  feed: (rollType: RollType, limit = 60) =>
    request<Domain[]>(`/domains/feed?roll_type=${encodeURIComponent(rollType)}&limit=${limit}`),

  spin: (rollType: RollType, times: 1 | 3 = 1) =>
    request<SpinResult | SpinBatchResult>('/spin', {
      method: 'POST',
      body: JSON.stringify({ roll_type: rollType, times }),
    }),

  keepSpin: (spinId: number) =>
    request<KeepResult>(`/spin/${spinId}/keep`, {
      method: 'POST',
    }),

  inventory: (params?: { zone?: string; rarity?: Rarity }) => {
    const query = new URLSearchParams();
    if (params?.zone) query.set('zone', params.zone);
    if (params?.rarity) query.set('rarity', params.rarity);
    const serialized = query.toString();
    return request<InventoryItem[]>(`/inventory${serialized ? `?${serialized}` : ''}`);
  },

  sell: (itemId: number) =>
    request<SellResult>(`/inventory/${itemId}/sell`, { method: 'POST' }),

  sellBulk: (ids: number[]) =>
    request<BulkSellResult>('/inventory/sell-bulk', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  leaderboard: () => request<LeaderboardResponse>('/leaderboard'),

  drops: () => request<DropsResponse>('/drops/recent'),

  dailyBonus: () =>
    request<DailyBonusResponse>('/daily-bonus', { method: 'POST' }),

  earnClick: () => request<EarnResult>('/earnings/click', { method: 'POST' }),

  earnHold: () => request<EarnResult>('/earnings/hold', { method: 'POST' }),

  adminOverview: () => request<AdminOverview>('/admin/overview'),

  adminUsers: (query = '') =>
    request<AdminUsersResponse>(`/admin/users?query=${encodeURIComponent(query)}&limit=50`),

  adminBalance: (userId: number, amount: number) =>
    request<AdminUser>(`/admin/users/${userId}/balance`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  adminBan: (userId: number, banned: boolean, reason?: string) =>
    request<AdminUser>(`/admin/users/${userId}/ban`, {
      method: 'POST',
      body: JSON.stringify({ banned, reason: reason ?? null }),
    }),

  adminGrantDomain: (userId: number, rarity?: Rarity) =>
    request<AdminGrantResult>(`/admin/users/${userId}/grant-domain`, {
      method: 'POST',
      body: JSON.stringify({ rarity: rarity ?? null }),
    }),

  autosell: () => request<AutosellSettings>('/settings/autosell'),

  updateAutosell: (settings: AutosellSettings) =>
    request<AutosellSettings>('/settings/autosell', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  upgradePreview: (
    domainIds: number[],
    chanceSector: 10 | 25 | 50 | 75,
    chance: number,
  ) =>
    request<UpgradePreview>('/upgrade/preview', {
      method: 'POST',
      body: JSON.stringify({
        domain_ids: domainIds,
        chance_sector: chanceSector,
        chance,
      }),
    }),

  upgrade: (domainIds: number[], chanceSector: 10 | 25 | 50 | 75, chance: number) =>
    request<UpgradeResult>('/upgrade', {
      method: 'POST',
      body: JSON.stringify({
        domain_ids: domainIds,
        chance_sector: chanceSector,
        chance,
      }),
    }),
};

export function dropsWebSocketUrl(): string {
  const token = getToken() ?? '';
  const base = new URL(API_BASE.replace(/\/$/, ''), window.location.origin);
  base.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = `${base.pathname.replace(/\/$/, '')}/drops/recent`;
  base.search = new URLSearchParams({ token }).toString();
  base.hash = '';
  return base.toString();
}
