import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";

// A throwaway account per run, so reruns never see each other's trades
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const username = `e2e_${Array.from(randomBytes(8), (byte) => ALPHABET[byte % ALPHABET.length]).join("")}`;
const password = "e2e-password-123";

test("sign up, buy and sell USD, check the wallet, then reset it", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/wallet$/);
  await expect(page.getByText("Total value")).toBeVisible();

  await page.goto("/currency/USD-BRL");
  const orderSide = page.getByRole("group", { name: "Order side" });
  const buyToggle = orderSide.getByRole("button", { name: "Buy", exact: true });
  const sellToggle = orderSide.getByRole("button", { name: "Sell", exact: true });
  // The order form is a client action, so a click before hydration is lost. The side toggle
  // only changes local state, so retry it until it responds; then each order is clicked once
  await expect(async () => {
    await sellToggle.click();
    await expect(sellToggle).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass({ timeout: 60_000 });
  await buyToggle.click();
  await expect(buyToggle).toHaveAttribute("aria-pressed", "true");

  await page.getByLabel("Amount (R$)").fill("100");
  // The Buy toggle comes first in the page, so the submit button is the last match
  await page.getByRole("button", { name: "Buy", exact: true }).last().click();
  // getByText, not role=alert: the route announcer is also role="alert"
  await expect(
    page.getByText(/^Bought .+ USD for R\$100\.00 at R\$[\d.]+ \(\d{2}:\d{2}:\d{2} Brasília time\)\.$/),
  ).toBeVisible();

  await sellToggle.click();
  await page.getByLabel("Sell all").check();
  await page.getByRole("button", { name: "Sell", exact: true }).last().click();
  await expect(page.getByText(/^Sold .+ USD for R\$[\d,.]+ at /)).toBeVisible();

  await page.goto("/wallet");
  const history = page
    .getByRole("table")
    .filter({ has: page.getByRole("columnheader", { name: "Side" }) });
  const tradeRows = history.getByRole("row").filter({ has: page.getByRole("cell") });
  await expect(tradeRows).toHaveCount(2);
  await expect(
    tradeRows.filter({ has: page.getByRole("cell", { name: "Buy", exact: true }) }),
  ).toHaveCount(1);
  await expect(
    tradeRows.filter({ has: page.getByRole("cell", { name: "Sell", exact: true }) }),
  ).toHaveCount(1);
  await expect(
    tradeRows.filter({ has: page.getByRole("cell", { name: "USD", exact: true }) }),
  ).toHaveCount(2);

  await page.getByRole("button", { name: "Reset wallet" }).click();
  await page.getByRole("button", { name: "Yes, reset" }).click();
  await expect(page.getByText("No trades yet.")).toBeVisible();
  await expect(page.getByText("No positions yet.")).toBeVisible();
  // Total value and Cash both show the starting balance once the wallet is empty
  await expect(page.getByText("R$100,000.00", { exact: true })).toHaveCount(2);
});
