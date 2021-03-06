import Fs from 'fs'
import { IgApiClient } from 'instagram-private-api'
import { getRandomAyatFairly, getScreenshot } from './quran'
import { IG_PROXY, IG_USERNAME, IG_PASSWORD, COOKIES_PATH } from './config'

const getRandomTags = () => {
    let tags = ''
    const possibleTags = [
        'alquran', 'surah', 'ayatallah', 'muslim',
        'islam', 'quran', 'muhammad', 'islampost',
        'muslims', 'muslimpost', 'sunnah', 'alquransunnah',
        'alquranterjemahan', 'dakwahislam', 'remajaislami',
        'alhamdulillah', 'masyaallah', 'allahuakbar',
        'subhanallah', 'tabarakallah', 'tafsirsurah',
        'tafsirayat', 'tafsiralquran', 'tafsirquran',
        'tafsir', 'alqurandantafsir', 'tafsirindonesia'
    ]
    
    for (let i = 0; i < 10; i++) {
        tags += `#${possibleTags[
            ~~(Math.random() * possibleTags.length)
        ]} `
    }

    return tags
}

export const setup = async (check = false) => {
    const ig = new IgApiClient()
    IG_PROXY && (ig.state.proxyUrl = IG_PROXY)
    IG_USERNAME && ig.state.generateDevice(IG_USERNAME)

    try {
        const flag = { cache: true }
        if (!check) throw flag

        console.info('> Checking Cookies...')
        if (Fs.existsSync(COOKIES_PATH)) {
            console.info('> Login Skipped, Cookies Exists!')
            throw flag
        }

        const runTask = async (): Promise<any> => {
            try {
                console.info('> Logging In...')
                await ig.simulate.preLoginFlow()
                await ig.account.login(IG_USERNAME as string, IG_PASSWORD as string)
                const cookies = await ig.state.serializeCookieJar() 
                await Fs.promises.writeFile(COOKIES_PATH, JSON.stringify(cookies))
                console.info('> Login Cookies Stored!\n')
            } catch (reason) {
                const { response } = reason

                if (response?.body) {
                    const { message } = response.body
                    if (message.includes('try again')) {
                        console.error('> Too many request, will trying again in 8s...\n')
                        return setTimeout(runTask, 8000)
                    }
                }

                throw reason
            }
        }

        await runTask()
    } catch (reason) {
        if (!reason.cache) throw reason
        const loginCookies = require(COOKIES_PATH)
        await ig.state.deserializeCookieJar(loginCookies)
    }
    
    return ig
}


export const publishPost = async () => {
    console.info('> Preparing surah...')
    const { surah, ayat, nameSurah, nameSurahId, tafsir, translation } = getRandomAyatFairly()
    
    let caption = `${translation} — ${nameSurah} (${nameSurahId}) [QS.${surah}:${ayat}]\n\nTafsir ringkas:\n${tafsir}\n.\n.\n${getRandomTags()}`
    if (caption.length > 2200) {
        caption = `${translation} — ${nameSurah} (${nameSurahId}) [QS.${surah}:${ayat}]\n.\n.\n${getRandomTags()}`
    }

    const file = <Buffer> await getScreenshot(`https://quran.com/${surah}/${ayat}?translations=20`)
    console.info(`> Surah Prepared: Q.S ${surah}:${ayat}`)

    const { latitude, longitude, searchQuery } = {
        // set to jakarta location
        latitude: -6.121435,
        longitude: 106.774124,
        searchQuery: 'Jakarta, Indonesia',
    }

    console.info('> Publishing surah...')
    const instagram = await setup()
    const location = (await instagram.search.location(latitude, longitude, searchQuery))[0]
    
    try {
        const result = await instagram.publish.photo({ file, caption, location })
        console.info(`> Surah published at: ${new Date().toLocaleString()}.\n`)
        return result
    } catch (reason) {
        const { response } = reason
        
        if (response?.body) {
            const { message } = response.body
            if (message.includes('aspect ratio')) {
                console.error('> Error on aspect ratio surah.')
                throw {
                    aspectRatioError: true,
                    surah,
                    ayat
                }
            }
        }
        
        console.error('Error on publishing surah:', reason)
        throw new Error(reason)
    }
}
