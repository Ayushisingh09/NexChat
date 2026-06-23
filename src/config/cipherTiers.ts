export interface CipherTierConfig {
  name: string;
  dailyTokenLimit: number;
  priority: number;
  features: {
    customPrompt: boolean;
    voiceInput: boolean;
    exportChat: boolean;
    search: boolean;
    branching: boolean;
    regenerate: boolean;
  };
}

export const CIPHER_TIERS: CipherTierConfig[] = [
  {
    name: 'Free',
    dailyTokenLimit: 20000,
    priority: 0,
    features: {
      customPrompt: false,
      voiceInput: false,
      exportChat: false,
      search: false,
      branching: false,
      regenerate: true,
    },
  },
  {
    name: 'Basic',
    dailyTokenLimit: 100000,
    priority: 1,
    features: {
      customPrompt: true,
      voiceInput: true,
      exportChat: true,
      search: false,
      branching: false,
      regenerate: true,
    },
  },
  {
    name: 'Pro',
    dailyTokenLimit: 500000,
    priority: 2,
    features: {
      customPrompt: true,
      voiceInput: true,
      exportChat: true,
      search: true,
      branching: false,
      regenerate: true,
    },
  },
  {
    name: 'Elite',
    dailyTokenLimit: 2000000,
    priority: 3,
    features: {
      customPrompt: true,
      voiceInput: true,
      exportChat: true,
      search: true,
      branching: true,
      regenerate: true,
    },
  },
  {
    name: 'Unlimited',
    dailyTokenLimit: Infinity,
    priority: 4,
    features: {
      customPrompt: true,
      voiceInput: true,
      exportChat: true,
      search: true,
      branching: true,
      regenerate: true,
    },
  },
];

export function getTier(tierIndex: number): CipherTierConfig {
  return CIPHER_TIERS[tierIndex] || CIPHER_TIERS[0];
}
