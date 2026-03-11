import { test, expect } from '@playwright/test';

const SUPABASE_URL = 'https://etfkdcsoazbxiqzsjkrh.supabase.co';

async function setupMocks(page) {
  await page.route(`${SUPABASE_URL}/auth/v1/**`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({access_token:'a',refresh_token:'r',expires_in:3600,token_type:'bearer',user:{id:'t',email:'t@t.com',aud:'authenticated',role:'authenticated'}}) }));
  await page.route(`${SUPABASE_URL}/rest/v1/**`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().method() === 'GET' ? [] : {}) }));
  await page.addInitScript((url) => {
    const k = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
    localStorage.setItem(k, JSON.stringify({access_token:'a',refresh_token:'r',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:'t',email:'t@t.com',aud:'authenticated',role:'authenticated'}}));
  }, SUPABASE_URL);
}

test('debug emoji input events', async ({ page }) => {
  // Set up console listener FIRST
  const messages = [];
  page.on('console', msg => messages.push(msg.text()));

  await setupMocks(page);
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Enter edit mode
  await page.keyboard.press('Enter');
  await page.waitForSelector('.node-text-input', { timeout: 5000 });
  await page.waitForTimeout(300);

  // Type with keyboard
  await page.keyboard.press('Meta+a');
  await page.keyboard.type(':smile');
  await page.waitForTimeout(500);

  // Filter for our debug messages
  const debugMsgs = messages.filter(m => m.includes('EMOJI_DEBUG'));
  console.log('Debug messages count:', debugMsgs.length);
  console.log('Debug messages:', JSON.stringify(debugMsgs.slice(0, 10)));
  console.log('All messages count:', messages.length);
  console.log('All messages:', JSON.stringify(messages.slice(0, 20)));

  const pickerExists = await page.evaluate(() => !!document.querySelector('.emoji-picker'));
  console.log('Picker exists:', pickerExists);

  // Also check textarea value
  const taValue = await page.evaluate(() => document.querySelector('.node-text-input')?.value);
  console.log('Textarea value:', taValue);

  expect(debugMsgs.length).toBeGreaterThan(0);
});
