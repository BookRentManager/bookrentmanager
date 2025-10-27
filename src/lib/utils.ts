import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate consistent color for user message bubbles based on their ID
export function getUserColor(userId: string): string {
  const colors = [
    'bg-violet-400 border-violet-500',
    'bg-emerald-400 border-emerald-500', 
    'bg-amber-400 border-amber-500',
    'bg-rose-400 border-rose-500',
    'bg-cyan-400 border-cyan-500',
    'bg-pink-400 border-pink-500',
    'bg-teal-400 border-teal-500',
    'bg-orange-400 border-orange-500',
    'bg-indigo-400 border-indigo-500',
    'bg-lime-400 border-lime-500',
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

export interface RentalDaysCalculation {
  totalDays: number;           // e.g., 4
  fullDays: number;            // e.g., 3
  remainingHours: number;      // e.g., 2.5
  exceedsTolerance: boolean;   // true if remaining > tolerance
  formattedDuration: string;   // "3 days + 2.5h"
  formattedTotal: string;      // "4 Days"
}

export function calculateRentalDays(
  deliveryDateTime: Date,
  collectionDateTime: Date,
  hourTolerance: number = 1
): RentalDaysCalculation {
  // Calculate time difference in milliseconds
  const timeDiffMs = collectionDateTime.getTime() - deliveryDateTime.getTime();
  
  // If collection is before or at delivery, no tolerance issue
  if (timeDiffMs <= 0) {
    return {
      totalDays: 1,
      fullDays: 0,
      remainingHours: 0,
      exceedsTolerance: false,
      formattedDuration: '0 days',
      formattedTotal: '1 Day'
    };
  }
  
  // Calculate full 24-hour periods
  const fullDays = Math.floor(timeDiffMs / (24 * 60 * 60 * 1000));
  
  // Calculate remaining hours after full days
  const remainingMs = timeDiffMs - (fullDays * 24 * 60 * 60 * 1000);
  const remainingHours = Math.round((remainingMs / (60 * 60 * 1000)) * 10) / 10; // Round to 1 decimal
  
  // Check if it exceeds tolerance (only if remaining hours > tolerance)
  const exceedsTolerance = remainingHours > hourTolerance;
  
  // Calculate total days (add 1 if exceeds tolerance)
  const totalDays = exceedsTolerance ? fullDays + 1 : fullDays || 1; // Minimum 1 day
  
  // Format breakdown
  const formattedDuration = remainingHours > 0 
    ? `${fullDays} ${fullDays === 1 ? 'day' : 'days'} + ${remainingHours}h`
    : `${fullDays} ${fullDays === 1 ? 'day' : 'days'}`;
  
  // Format total
  const formattedTotal = `${totalDays} ${totalDays === 1 ? 'Day' : 'Days'}`;
  
  return {
    totalDays,
    fullDays,
    remainingHours,
    exceedsTolerance,
    formattedDuration,
    formattedTotal
  };
}
