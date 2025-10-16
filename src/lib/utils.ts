import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate consistent color for user message bubbles based on their ID
export function getUserColor(userId: string): string {
  const colors = [
    'bg-violet-500 border-violet-600',
    'bg-emerald-500 border-emerald-600', 
    'bg-amber-500 border-amber-600',
    'bg-rose-500 border-rose-600',
    'bg-cyan-500 border-cyan-600',
    'bg-pink-500 border-pink-600',
    'bg-teal-500 border-teal-600',
    'bg-orange-500 border-orange-600',
    'bg-indigo-500 border-indigo-600',
    'bg-lime-500 border-lime-600',
  ];
  
  // Simple hash function to get consistent color for user
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

// Generate consistent color for user avatars based on their ID
export function getUserAvatarColor(userId: string): string {
  const colors = [
    'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300',
  ];
  
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}
