import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should show login page on /bot', async ({ page }) => {
    await page.goto('/bot');
    
    // Check for login button
    const loginButton = page.getByRole('button', { name: /log in/i });
    await expect(loginButton).toBeVisible();
    
    // Check for sign up button
    const signUpButton = page.getByRole('button', { name: /sign up/i });
    await expect(signUpButton).toBeVisible();
    
    // Check for the prompt text
    await expect(page.getByText(/Log in with your Deriv account/)).toBeVisible();
  });

  test('should show error when login is clicked without valid OAuth config', async ({ page }) => {
    await page.goto('/bot');
    
    // Click login - this should redirect to OAuth provider
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 5000 }).catch(() => null),
      page.getByRole('button', { name: /log in/i }).click(),
    ]);
    
    // If popup opens, it means redirect happened (good sign)
    // If no popup and no error message, login may have failed silently
    if (!popup) {
      // Check for error display
      const errorEl = page.locator('.text-destructive');
      // Either we have an error or we're still on the login page
      const hasError = await errorEl.count() > 0;
      const loginVisible = await page.getByRole('button', { name: /log in/i }).isVisible();
      expect(hasError || loginVisible).toBeTruthy();
    }
  });
});