import dotenv from 'dotenv'

dotenv.config()
import {chromium, devices} from 'playwright'
import fs from 'fs'

let token = process.env.DISCORD_TOKEN
let isLoggedIn = false
let nextClaim = 0
const cooldownFile = './cooldown.json'

function loadCd() {
    if (fs.existsSync(cooldownFile)) {
        const data = JSON.parse(fs.readFileSync(cooldownFile, 'utf-8'))
        nextClaim = data.nextClaim || 0
    }
}

function saveCd() {
    fs.writeFileSync(cooldownFile, JSON.stringify({nextClaim}), 'utf-8')
}

function isOnCd() {
    const diff = nextClaim - Date.now()
    if (diff > 0) {
        console.log(`⏳ On cooldown: ${Math.ceil(diff / 1000)}s left.`)
        return true
    }
    return false
}

function setCd(hours = 1) {
    nextClaim = Date.now() + hours * 60 * 60 * 1000
    saveCd()
    console.log(`✅ Cooldown set for ${hours}h`)
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
    if (isOnCd()) {
        console.log('Cooldown!!!')
    } else {
        await page.goto('https://soccerguru.live/dashboard')
        // TODO : Fix claim button detector
        try {
            const timestamp = Date.now()
            const claimSection = page.getByText('Build your club with a new player every hour!').locator('..')
            const claimBtn = claimSection.locator('a:not(.btn-disabled):has-text("Claim")')
            if (await claimBtn.count() > 0) {
                await claimBtn.click()
                await page.getByRole('button', {name: /Continue/i}).click()
                console.log('Card claimed')
                await page.screenshot({path: `/output/screenshot-${timestamp}.png`, fullPage: true})
                await page.getByRole('button', {name: /Continue/i}).click()
                await page.goto('https://soccerguru.live/dashboard')
                setCd(1)
            } else {
                console.log('No button claim found')
            }
        } catch (e) {
            console.error('Error', e)
        }
    }
    console.log('next claim available in', new Date(nextClaim).toLocaleString())
} else {
    await getAuth()
}

loadCd()
