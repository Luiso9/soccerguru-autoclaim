import dotenv from 'dotenv'

dotenv.config()
import {chromium, devices} from 'playwright'

let token = process.env.DISCORD_TOKEN
let isLoggedIn = false
let nextClaim = 0

function isOnCd() {
    return Date.now() < nextClaim
}

function setCd(hours = 1) {
    nextClaim = Date.now() + hours * 60 * 60 * 1000
}

// Init
const agentBrowser = await chromium.launch({headless: false}) // Set to false if you think something goes wrong or not according to how it supposed to be
const context = await agentBrowser.newContext(devices['iPhone 12']) // Dont change this or it'll break the auth; where you need to scroll then click the auth button
const page = await context.newPage()
await page.goto('https://discord.com/login')

// Check user logged in or not
try {
    await page.getByRole('button', {name: /Log In/}).waitFor({
        state: 'visible',
    });
    isLoggedIn = false
    console.log('Not logged in, processed to logged in')
} catch {
    await page.waitForURL('https://discord.com/channels/@me', {timeout: 10000})
    isLoggedIn = true
    console.log('User already logged in, processed to claim card.')
}

// Login
async function getAuth() {
    if (page?.getByRole('button', {name: /Log In/i})) {
        console.log('not logged in')
        await page.waitForLoadState('networkidle');
        try {
            // Login (insert token)
            await page.evaluate((token) => {
                function login(token) {
                    const interval = setInterval(() => {
                        document.body.appendChild(document.createElement('iframe')).contentWindow.localStorage.token = `"${token}"`;
                    }, 50);

                    setTimeout(() => {
                        clearInterval(interval);
                        location.reload();
                    }, 2500);
                }

                login(token);
            }, token);

            // Reload the page so TOKEN is applied to the session
            await page.reload();
            await page.waitForURL('https://discord.com/channels/@me', {timeout: 10000});
        } finally {
            await page.goto('https://soccerguru.live/dashboard')
            // Authorize Soccer Guru
            // const scrollBtn = page.getByRole('button', { name: /Keep Scrolling.../i })
            // await scrollBtn.waitFor({ state: 'visible', timeout: 5000 })

            await page.getByRole('link', {name: 'privacy policy'}).hover()
            await page.mouse.wheel(0, 50)

            const authorizeBtn = page.getByRole('button', {name: /Authorize/i})
            await authorizeBtn.click()
            console.log('User finally Logged In. Processed to Claim Card.')
            isLoggedIn = true
        }
    }
}

if (isLoggedIn) {
    let statusClaim = false
    await page.goto('https://soccerguru.live/dashboard')

    if (!statusClaim) {
        try {
            const timestamp = Date.now()
            const claimSection = page.getByText('Build your club with a new player every hour!')
            const claimBtn = claimSection.getByRole('button', {name: /Claim/i}).click()
            await page.screenshot({path: `/output/screenshot-${timestamp}.png`, fullPage: true})
            await page.getByRole('button', {name: /Continue/i}).click()
            await page.goto('https://soccerguru.live/dashboard')
        } finally {
            setCd(1)
        }
    } else {
        console.log('Still on cooldown, skipping claim.')
    }
} else {
    await getAuth()
}