// src/content/utils/reviewPromptTracker.ts
// Shared utility for tracking API calls and determining if review prompt should show

import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';

/** Number of API calls before the first review prompt is shown */
const REVIEW_PROMPT_FIRST_TRIGGER = 30;

/** Number of API calls between subsequent review prompts */
const REVIEW_PROMPT_RECURRING_INTERVAL = 30;

/**
 * Increment the API counter and return whether the review prompt modal should be shown.
 *
 * Trigger rules:
 *  - First trigger at counter == REVIEW_PROMPT_FIRST_TRIGGER (20)
 *  - Then every REVIEW_PROMPT_RECURRING_INTERVAL (30) calls after that (50, 80, 110, …)
 *  - Only when has_user_review_submission_attempted === false
 *
 * @returns true if the review prompt should be shown
 */
export async function incrementApiCounterAndShouldShowReview(): Promise<boolean> {
  try {
    const newCount = await ChromeStorage.incrementUserTotalApiCounter();
    const hasAttempted = await ChromeStorage.getHasUserReviewSubmissionAttempted();

    if (hasAttempted) return false;

    return (
      newCount === REVIEW_PROMPT_FIRST_TRIGGER ||
      (newCount > REVIEW_PROMPT_FIRST_TRIGGER &&
        (newCount - REVIEW_PROMPT_FIRST_TRIGGER) % REVIEW_PROMPT_RECURRING_INTERVAL === 0)
    );
  } catch {
    // Silently fail — review prompt is non-critical
    return false;
  }
}
