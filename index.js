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

const status_template = document.getElementById('status_template')
const status_template_div = status_template.content.querySelector('.status')
const status_template_content = status_template.content.querySelector('.status_content')
const status_template_time = status_template.content.querySelector('.time')
const status_template_handle = status_template.content.querySelector('.account_handle')
const status_template_name = status_template.content.querySelector('.account_name')
const status_template_avatar = status_template.content.querySelector('img')
const status_template_reblogger_a = status_template.content.querySelector('.reblog a')
const status_template_response_a = status_template.content.querySelector('.response a')

const timeline = document.getElementById('timeline')
const topSentinel = document.getElementById('topSentinel')
const bottomSentinel = document.getElementById('bottomSentinel')

function createStatusNode(status) {
    status_template_div.dataset.id = status.id
    let reblogging_account = null;
    let responding_account = null
    if (status.reblog) {
        reblogging_account = status.account
        status = status.reblog
    } else if (status.in_reply_to_id || status.in_reply_to_account_id) {
        if (status.in_reply_to_account_id == status.account.id) {
            responding_account = status.account
        } else {
            //TODO: Do I need to do another request to get the info or can I get it from "mentions"?
            responding_account = {
                display_name: '???',
                url: '#'
            }
        }
    }
    if (reblogging_account) {
        status_template_reblogger_a.href = reblogging_account.url
        status_template_reblogger_a.innerText = reblogging_account.display_name
    }
    if (responding_account) {
        status_template_response_a.href = responding_account.url
        status_template_response_a.innerText = responding_account.display_name
    }
    status_template_content.innerHTML = status.content
    status_template_time.innerText = status.created_at
    status_template_handle.innerText = status.account.acct
    status_template_name.innerText = status.account.display_name
    status_template_avatar.src = status.account.avatar
    const node = status_template.content.cloneNode(true)
    if (!reblogging_account) {
        node.querySelector('.reblog').remove()
    }
    if (!responding_account) {
        node.querySelector('.response').remove()
    }
    for (let media_attachment of status.media_attachments) {
        node.querySelector('.status_attachments').appendChild(createMediaNode(media_attachment))
    }
    if (status.media_attachments.length == 0 && status.card && status.card.image) {
        node.querySelector('.status_card').appendChild(createCardNode(status.card))
    }
    return node
}

const image_attachment_template = document.getElementById('image_attachment_template')
const image_attachment_img = image_attachment_template.content.querySelector('img')
const video_attachment_template = document.getElementById('video_attachment_template')
const video_attachment_video = video_attachment_template.content.querySelector('video')
const gifv_attachment_template = document.getElementById('gifv_attachment_template')
const audio_attachment_template = document.getElementById('audio_attachment_template')
const unknown_attachment_template = document.getElementById('unknown_attachment_template')

function createMediaNode(media) {
    switch(media.type) {
        case 'image':
        case 'gifv':
            image_attachment_img.src = media.preview_url
            image_attachment_img.alt = media.description
            return image_attachment_template.content.cloneNode(true)
            //return gifv_attachment_template.content.cloneNode(true)
        case 'video':
            video_attachment_video.src = media.url
            video_attachment_video.poster = media.preview_url
            return video_attachment_template.content.cloneNode(true)
        case 'audio':
            return audio_attachment_template.content.cloneNode(true)
        default:
            return unknown_attachment_template.content.cloneNode(true)
    }
}


const status_card_link_template = document.getElementById('status_card_link_template')
const status_card_link_img =  status_card_link_template.content.querySelector('img')
const status_card_link_a = status_card_link_template.content.querySelector('a')
const status_card_link_title = status_card_link_template.content.querySelector('.card-title')
const status_card_link_description = status_card_link_template.content.querySelector('.card-text')
const status_card_link_provider = status_card_link_template.content.querySelector('.card-subtitle')

function createCardNode(card) {
    if (card.type === 'link') {
        status_card_link_img.src = card.image
        status_card_link_a.href = card.url
        status_card_link_title.innerText = card.title
        status_card_link_description.innerText = card.description
        status_card_link_provider.innerText = card.provider_name
        return status_card_link_template.content.cloneNode(true)
    } else {
        return document.createTextNode('Card type ' + card.type + ' not supported')
    }
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
    window.history.replaceState({}, document.title, window.location.pathname);
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