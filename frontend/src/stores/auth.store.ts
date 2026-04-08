import { create } from 'zustand';
import api from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';

export interface PlanFeatures {
  broadcast: boolean;
  scheduledMessages: boolean;
  deals: boolean;
  closingReport: boolean;
  autoResponseNewChat: boolean;
  autoResponseOutsideHours: boolean;
  webhookConfigs: boolean;
  webhookAutoReply: boolean;
  teamManagement: boolean;
  assignConversation: boolean;
  conversationLabels: boolean;
  conversationPriority: boolean;
  contactImport: boolean;
  contactCustomFields: boolean;
  editMessage: boolean;
  analyticsMessageVolume: boolean;
  analyticsAgentPerformance: boolean;
  analyticsContactGrowth: boolean;
  apiAccess: boolean;
  scheduleBroadcast: boolean;
  broadcastMedia: boolean;
}

export interface PlanLimits {
  maxUsers: number;
  maxContacts: number;
  maxWaInstances: number;
  maxTemplates: number;
  maxBroadcastsPerMonth: number;
  maxRecipientsPerBroadcast: number;
  maxScheduledMessages: number;
  maxDeals: number;
  maxTags: number;
  maxWebhookConfigs: number;
  dailyMessageLimit: number;
  maxImportBatchSize: number;
  maxStorageMb: number;
  features: PlanFeatures;
  analyticsMaxDays: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  avatar_url: string | null;
  organization: {
    id: string;
    name: string;
    slug: string;
    plan?: string;
    planLimits?: PlanLimits;
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; organizationName: string }) => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { accessToken, refreshToken, user, organization } = data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    document.cookie = 'logged_in=1; path=/; max-age=604800; SameSite=Lax';
    set({ user: { ...user, organization }, isAuthenticated: true });
    connectSocket();
  },

  register: async (input) => {
    const { data } = await api.post('/auth/register', input);
    const { accessToken, refreshToken, user, organization } = data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    document.cookie = 'logged_in=1; path=/; max-age=604800; SameSite=Lax';
    set({ user: { ...user, organization }, isAuthenticated: true });
    connectSocket();
  },

  logout: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // ignore
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    document.cookie = 'logged_in=; path=/; max-age=0';
    disconnectSocket();
    set({ user: null, isAuthenticated: false });
  },

  fetchProfile: async () => {
    try {
      const { data } = await api.get('/auth/profile');
      set({ user: data.data, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },

  initialize: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const { data } = await api.get('/auth/profile');
      set({ user: data.data, isAuthenticated: true, isLoading: false });
      connectSocket();
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      document.cookie = 'logged_in=; path=/; max-age=0';
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
