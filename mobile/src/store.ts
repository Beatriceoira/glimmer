import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

type Screen = 'library' | 'reader' | 'login';
type S = {
  ready: boolean; token: string | null; role: string | null; screen: Screen; storyId: string | null;
  hydrate: () => Promise<void>;
  signIn: (token: string, role: string) => Promise<void>;
  signOut: () => Promise<void>;
  go: (screen: Screen, storyId?: string) => void;
};

export const useStore = create<S>((set) => ({
  ready: false, token: null, role: null, screen: 'library', storyId: null,
  hydrate: async () => {
    const token = await SecureStore.getItemAsync('gl_token');
    const role = await SecureStore.getItemAsync('gl_role');
    set({ token, role, ready: true });
  },
  signIn: async (token, role) => {
    await SecureStore.setItemAsync('gl_token', token); await SecureStore.setItemAsync('gl_role', role);
    set({ token, role, screen: 'library' });
  },
  signOut: async () => {
    await SecureStore.deleteItemAsync('gl_token'); await SecureStore.deleteItemAsync('gl_role');
    set({ token: null, role: null, screen: 'library', storyId: null });
  },
  go: (screen, storyId) => set({ screen, storyId: storyId ?? null }),
}));
