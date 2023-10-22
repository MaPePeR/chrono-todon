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