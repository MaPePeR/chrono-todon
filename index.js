"use strict";

let lastSeen = null
let current_login = null
let instance_url = null

function loadAbove(id) {
    const url = new URL('/api/v1/timelines/home?max_id=' + id, instance_url)
    return authenticatedGet(url).then(parseTimeline)
}
function loadBelow(id) {
    const url = new URL('/api/v1/timelines/home?min_id=' + id, instance_url)
    return authenticatedGet(url).then(parseTimeline)
}

async function parseTimeline(response) {
    const jsonResponse = await response.json()
    return jsonResponse.reverse()
}


function authenticatedGet(url) {
    return fetch(url, {
        headers: {
            'Authorization': 'Bearer ' + current_login.token.access_token
        }
    })
}

const lastSeenObserver = new IntersectionObserver(function (entries, observer){
    for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (entry.target.dataset.id > lastSeen) {
            lastSeen = entry.target.dataset.id
            console.log("LastSeen: ", lastSeen)
        }
        observer.unobserve(entry.target)
    }
}, {threshold: 1.0})

async function initialLoad() {
    const previous = await loadAbove(lastSeen)
    const newContent = await loadBelow(previous[previous.length - 1].id)

    const fragment = document.createDocumentFragment()
    for (const timeline of [previous, newContent]) {
        for (const status of timeline) {
            const statusNode = createStatusNode(status)
            fragment.append(statusNode)
        }
    }
    bottomSentinel.parentElement.insertBefore(fragment, bottomSentinel)

    document.querySelector('#timeline .status[data-id="' + lastSeen + '"]').scrollIntoView({behavior: 'instant', block: 'center'})

    document.querySelectorAll('#timeline .status[data-id="' + lastSeen + '"] ~ .status').forEach((el) => {
        lastSeenObserver.observe(el)
    })

    const sentinelOptions = {
        rootMargin: '200px',
        root: timeline,
    }

    const topObserver = new IntersectionObserver(function handleIntersection(entries, observer) {
        if (entries && entries[0] && entries[0].isIntersecting) {
            console.log("top", entries)
            loadPrev()
        }
    }, sentinelOptions)
    topObserver.observe(topSentinel)

    const bottomObserver = new IntersectionObserver(function handleIntersection(entries, observer) {
        if (entries && entries[0] && entries[0].isIntersecting) {
            console.log("bottom", entries)
            loadNew()
        }
    }, sentinelOptions)
    bottomObserver.observe(bottomSentinel)
}

let loadingPrev = false
async function loadPrev() {
    if (loadingPrev) return 
    loadingPrev = true;
    topSentinel.innerText = "Loading..."
    const firstStatus = topSentinel.nextElementSibling
    const aboveStatus = await loadAbove(firstStatus.dataset.id)
    const fragment = document.createDocumentFragment()
    for (const status of aboveStatus) {
        const statusNode = createStatusNode(status)
        fragment.append(statusNode)
    }
    const position = timeline.scrollHeight - timeline.scrollTop
    firstStatus.parentElement.insertBefore(fragment, firstStatus)
    timeline.scrollTop = timeline.scrollHeight - position
    loadingPrev = false
    topSentinel.innerText = ''
}

let loadingNew = false
async function loadNew() {
    if (loadingNew) return 
    loadingNew = true;
    bottomSentinel.innerText = "Loading..."
    const lastStatus = bottomSentinel.previousElementSibling
    const newStatus = await loadBelow(lastStatus.dataset.id)
    const fragment = document.createDocumentFragment()
    console.log(newStatus)
    for (const status of newStatus) {
        const statusNode = createStatusNode(status)
        fragment.append(statusNode)
    }
    bottomSentinel.parentElement.insertBefore(fragment, bottomSentinel)
    loadingNew = false
    bottomSentinel.innerText = ''
}

function getRedirectURL(instance) {
    const params = new URLSearchParams({from: instance})
    return new URL("./?" + params.toString(), window.location.href)
}


function getApplicationCached(instance) {
    const existing = localStorage.getItem('instance:' + instance)
    if (existing) {
        return JSON.parse(existing)
    }
    return null
}
async function getApplication(instance) {
    const existing = localStorage.getItem('instance:' + instance)
    if (existing) {
        return JSON.parse(existing)
    }
    const redirect_uri = getRedirectURL(instance)
    console.log(redirect_uri)

    const request = new FormData()
    request.append('client_name', 'Chrono-todon')
    request.append('redirect_uris', redirect_uri.toString())
    request.append('scopes', 'read')
    request.append('website', 'https://github.com/MaPePeR/chrono-todon')
    console.log(request.toString())

    const createAppResponse = await fetch(new URL('/api/v1/apps', 'https://' + instance), {method: 'POST', body: request})

    const applicationData = await createAppResponse.json()

    localStorage.setItem('instance:' + instance, JSON.stringify(applicationData))
    return applicationData
}

function redirectToInstance(instance, application) {
    /*
        https://mastodon.example/oauth/authorize
        ?client_id=CLIENT_ID
        &scope=read+write+push
        &redirect_uri=urn:ietf:wg:oauth:2.0:oob
        &response_type=code
    */
    const params = new URLSearchParams()
    params.append('client_id', application.client_id)
    params.append('scope', 'read')
    params.append('redirect_uri', getRedirectURL(instance).toString())
    params.append('response_type', 'code')

    const url = new URL('/oauth/authorize?' + params.toString(), 'https://' + instance)
    location.href = url
}

async function loginWithInstance(instance) {
    console.log(instance)
    const application = await getApplication(instance)
    console.log(application)
    redirectToInstance(instance, application)
}

async function checkLoginCodeAfterRedirect() {
    const urlparams = new URLSearchParams(window.location.search)
    if (!urlparams.has('code') || !urlparams.has('from')) {
        return null
    }
    const instance = urlparams.get('from')
    const code = urlparams.get('code')
    const application = getApplicationCached(instance)
    if (!application) {
        throw "Application unknown..."
    }
    const token = await getAccessTokenFromCode(instance, application, code)
    removeOauthQueryParameters()
    return {
        instance: instance,
        token: token,
    }
}
//checkLoginCodeAfterRedirect()

const localstorage_current_login_key = 'chrono_todon_current_login'

async function getAccessTokenFromCode(instance, application, code) {
    /*
    curl -X POST \
        -F 'client_id=your_client_id_here' \
        -F 'client_secret=your_client_secret_here' \
        -F 'redirect_uri=urn:ietf:wg:oauth:2.0:oob' \
        -F 'grant_type=authorization_code' \
        -F 'code=user_authzcode_here' \
        -F 'scope=read write push' \
        https://mastodon.example/oauth/token
    */
    const request = new FormData()
    request.append('client_id', application.client_id)
    request.append('client_secret', application.client_secret)
    request.append('redirect_uri', getRedirectURL(instance))
    request.append('grant_type', 'authorization_code')
    request.append('code', code)
    request.append('scope', 'read:accounts read:statuses')
    const url = new URL('/oauth/token', 'https://' + instance)
    const tokenResponse = await fetch(url, {method: 'POST', body: request})
    const token = await tokenResponse.json()
    return token
}

async function testAccessToken(instance, token) {
    /*
    curl \
        -H 'Authorization: Bearer our_access_token_here' \
        https://mastodon.example/api/v1/accounts/verify_credentials
    */
    const url = new URL('/api/v1/accounts/verify_credentials', 'https://' + instance)
    const response = await fetch(url, {
        headers: {
            'Authorization': 'Bearer ' + token.access_token
        }
    })
    const jsonResponse = await response.json()
    return true
}

function removeOauthQueryParameters() {
    const url = new URL(window.location)
    url.searchParams.delete('code')
    url.searchParams.delete('from')
    window.history.replaceState({}, document.title, url.href);
}

async function attemptLogin() {
    const existing_token = localStorage.getItem(localstorage_current_login_key)
    if (existing_token) {
        const token = JSON.parse(existing_token)
        console.log('Found existing token', existing_token)
        try {
            if (await testAccessToken(token.instance, token.token)) {
                removeOauthQueryParameters()
                return token
            }
        } catch (e) {
            console.log("Error testing access token: ", e)
            localStorage.removeItem(localstorage_current_login_key)
        }
    }
    const new_token =  await checkLoginCodeAfterRedirect()
    if (new_token) {
        localStorage.setItem(localstorage_current_login_key, JSON.stringify(new_token))
        if (await testAccessToken(new_token.instance, new_token.token)) {
            return new_token
        }
        localStorage.removeItem(localstorage_current_login_key)
        throw "Token test failed"
    }
    throw "Login failed"
}

async function logout() {
    const application = getApplicationCached(current_login.instance)
    if (!application) {
        throw "Application unknown..."
    }
    const url = new URL('/oauth/revoke', instance_url)
    const data = new FormData()
    data.append('client_id', application.client_id)
    data.append('client_secret', application.client_secret)
    data.append('token', current_login.token.access_token)
    await fetch(url, {body: data, method: 'POST', mode: 'no-cors'})
    current_login = null;
    instance_url = null
    localStorage.removeItem(localstorage_current_login_key)
    document.getElementById('login').classList.remove('d-none')
    document.getElementById('logout_container').classList.add('d-none')
    timeline.classList.add('d-none')
}

async function getLastSeen() {
    if (window.location.hash) {
        if (/^#marker:\d+$/.test(window.location.hash)) {
            const marker = window.location.hash.substring(8)
            return marker
        }
    }
    const url = new URL('/api/v1/markers?timeline[]=home', instance_url)
    const response = await authenticatedGet(url)
    const jsonResponse = await response.json()
    return jsonResponse.home.last_read_id
}
attemptLogin().then(async function (token) {
    current_login = token
    instance_url = new URL('https://' + token.instance)
    document.getElementById('login').classList.add('d-none')
    document.getElementById('logout_container').classList.remove('d-none')
    timeline.classList.remove('d-none')
    lastSeen = await getLastSeen()

    initialLoad()
}).catch(function (err) { console.log("Login failed: " + err); throw err})

document.getElementById('login_form').addEventListener('submit', function (evt) {
    loginWithInstance(document.getElementById('mastadon_instance').value.toLowerCase())
    evt.preventDefault()
})
document.getElementById('logout_button').addEventListener('click', logout)

document.getElementById('timeline').addEventListener('scrollend', function (evt) {
    const centerStatus = document.elementFromPoint(
        window.visualViewport.width/2,
        window.visualViewport.height/2
    ).closest('div.status[data-id]')
    const url = new URL(location.href)
    if (centerStatus) {
        url.hash = '#marker:' + centerStatus.dataset.id
    } else {
        url.hash = ''
    }
    window.history.replaceState({}, document.title, url.href);
})