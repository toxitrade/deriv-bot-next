import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should show login page on /bot', async ({ page }) => {
    await page.goto('/bot');
    
    // Check for login button (multiple exist, so check count > 0)
    const loginButtons = page.getByRole('button', { name: /log in/i });
    await expect(loginButtons).toHaveCount(2);
    
    // Check for sign up button
    const signUpButtons = page.getByRole('button', { name: /sign up/i });
    await expect(signUpButtons).toHaveCount(2);
    
    // Check for the prompt text
    await expect(page.getByText(/Log in with your Deriv account/)).toBeVisible();
  });

  test('should redirect to OAuth provider when login is clicked', async ({ page }) => {
    await page.goto('/bot');
    
    // Click the first login button - this triggers a full-page redirect to Deriv OAuth
    const loginButton = page.getByRole('button', { name: /log in/i }).first();
    
    // Wait for navigation to the OAuth provider
    await Promise.all([
      page.waitForURL('https://auth.deriv.com/**', { timeout: 10000 }),
      loginButton.click(),
    ]);
  });
});