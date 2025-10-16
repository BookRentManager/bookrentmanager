import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ChatContext = {
  type: 'general' | 'booking' | 'fine' | 'supplier_invoice' | 'client_invoice';
  id?: string;
  name?: string;
};

interface ChatPanelState {
  isOpen: boolean;
  currentContext: ChatContext;
  recentContexts: ChatContext[];
  setOpen: (open: boolean) => void;
  setContext: (context: ChatContext) => void;
  addRecentContext: (context: ChatContext) => void;
  togglePanel: () => void;
}

export const useChatPanel = create<ChatPanelState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      currentContext: { type: 'general' },
      recentContexts: [],
      
      setOpen: (open) => set({ isOpen: open }),
      
      togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),
      
      setContext: (context) => {
        set({ currentContext: context });
        get().addRecentContext(context);
      },
      
      addRecentContext: (context) => set((state) => {
        // Don't add general chat to recents
        if (context.type === 'general') return state;
        
        // Remove duplicates and add to front
        const filtered = state.recentContexts.filter(
          (c) => !(c.type === context.type && c.id === context.id)
        );
        
        return {
          recentContexts: [context, ...filtered].slice(0, 10), // Keep last 10
        };
      }),
    }),
    {
      name: 'chat-panel-storage',
      partialize: (state) => ({
        recentContexts: state.recentContexts,
        currentContext: state.currentContext,
      }),
    }
  )
);
