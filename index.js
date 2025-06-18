import dotenv from "dotenv";

dotenv.config();
import { chromium, devices } from "playwright";
import fs from "fs";

let token = process.env.DISCORD_TOKEN;
let browser = null;
let context = null;
let page = null;
let nextClaim = 0;
const cooldownFile = "./cooldown.json";

function loadCd() {
	if (fs.existsSync(cooldownFile)) {
		const data = JSON.parse(fs.readFileSync(cooldownFile, "utf-8"));
		nextClaim = data.nextClaim || 0;
	}
}

function saveCd() {
	fs.writeFileSync(cooldownFile, JSON.stringify({ nextClaim }), "utf-8");
}

function isOnCd() {
	const diff = nextClaim - Date.now();
	if (diff > 0) {
		console.log(`cooldown ${Math.ceil(diff / 1000)}s left.`);
		return true;
	}
	return false;
}

function setCd(hours = 1) {
	nextClaim = Date.now() + hours * 60 * 60 * 1000;
	saveCd();
	console.log(`Cooldown set ${hours}h`);
}

async function initBrowser() {
	if (!browser) {
		browser = await chromium.launch({ headless: true }); // set to false to debug
		context = await browser.newContext(devices["iPhone 12"]); // do not change this ive match the code based on Iphone 12's viewport
		page = await context.newPage();
	}
	return page;
}

async function checkLoginStatus() {
	await page.goto("https://discord.com/login");
	await page.waitForLoadState("networkidle");

	try {
		await page.getByRole("button", { name: /Log In/ }).waitFor({
			state: "visible",
			timeout: 5000,
		});

		return false;
	} catch {
		try {
			await page.waitForURL("https://discord.com/channels/@me", {
				timeout: 10000,
			});
			return true;
		} catch {
			return false;
		}
	}
}

async function performLogin() {
	console.log("Not logged in, going to logged in");

	// Login (insert token)
	await page.evaluate((token) => {
		function login(token) {
			const interval = setInterval(() => {
				document.body.appendChild(
					document.createElement("iframe")
				).contentWindow.localStorage.token = `"${token}"`;
			}, 50);

			setTimeout(() => {
				clearInterval(interval);
				location.reload();
			}, 2500);
		}
		login(token);
	}, token);

	// Reload the page to make sure TOKEN is applied
	await page.reload();
	// if url changed to * mean user logged in
	await page.waitForURL("https://discord.com/channels/@me", {
		timeout: 10000,
	});

	await page.goto("https://soccerguru.live/dashboard");
	await page.waitForLoadState("networkidle");
	await page.getByRole("button", { name: /Keep scrolling/ }).isVisible({
		timeout: 5000,
	});
	// Authorize Soccer Guru
	await page
		.getByRole("link", { name: /privacy policy/i })
		.scrollIntoViewIfNeeded();
	await page
		.getByRole("link", { name: /terms of service/ })
		.scrollIntoViewIfNeeded();
	await page.mouse.wheel(0, 50);
	await page.mouse.wheel(0, 50);
	await page.mouse.wheel(0, 50);

	const authorizeBtn = page.getByRole("button", { name: /Authorize/i });
	await page.waitForTimeout(2000); // to make sure its actually visible, sometimes itll just process to click while the button it self still hasnt been atached
	await authorizeBtn.click();
	console.log("User finally Logged In. Processed to Claim Card.");
}

async function attemptClaim() {
	await page.waitForTimeout(5000);
	await page.goto("https://soccerguru.live/dashboard");

	try {
		await page.mouse.wheel(0, 50);
		await page.mouse.wheel(0, 50);
		await page.mouse.wheel(0, 50);
		const timestamp = Date.now();
		const claimWrapper = page.locator(
			'div.bg-blue-600:has-text("Build your club")'
		);
		const claimBtn = claimWrapper.locator("a");

		if ((await claimBtn.count()) > 0) {
			const classList = await claimBtn.first().getAttribute("class");
			const isDisabled = classList?.includes("btn-disabled");

			const innerText = await claimBtn.first().innerText();
			console.log(`Button text: ${innerText}`);

			if (isDisabled || innerText.trim() === "/in a/") {
				console.log("Claim button is disabled. Sleeping for 30 minutes.");
				setCd(0.5);
				await sleep(30 * 60 * 1000);
				return false;
			}

			await claimBtn.first().click();
			await page.getByRole("button", { name: /Continue/i }).click();
			console.log("Card claimed");
			await page.screenshot({
				path: `/output/screenshot-${Date.now()}.png`,
				fullPage: true,
			});
			await page.getByRole("button", { name: /Continue/i }).click();
			await page.goto("https://soccerguru.live/dashboard");
			setCd(1);
			return true;
		} else {
			console.log("No claim button found");
			return false;
		}
	} catch (e) {
		console.error("Error during claim:", e);
		return false;
	}
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
	loadCd();

	console.log("Starting Soccer Guru Auto Claimer...");

	await initBrowser();

	while (true) {
		try {
			const isLoggedIn = await checkLoginStatus();

			if (!isLoggedIn) {
				await performLogin();
			} else {
				console.log("User already logged in, processed to claim card.");
			}

			if (isOnCd()) {
				const sleepTime = Math.max(nextClaim - Date.now(), 60000);
				console.log(`Sleeping for ${Math.ceil(sleepTime / 1000)}`);
				await sleep(sleepTime);
			} else {
				await sleep(5000);
				await attemptClaim();
				await sleep(30000);
			}

			console.log(
				"next claim available in",
				new Date(nextClaim).toLocaleString()
			);
		} catch (error) {
			console.error("Error in main loop:", error);

			await sleep(5 * 60 * 1000);
		}
	}
}

main().catch(console.error);
