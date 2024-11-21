const SC_URLS = [
    'https://sellercentral.amazon.co.uk',
    'https://sellercentral-europe.amazon.com',
    'https://sellercentral.amazon.com.be',
    'https://sellercentral.amazon.it',
    'https://sellercentral.amazon.fr',
    'https://sellercentral.amazon.de',
    'https://sellercentral.amazon.es',
    'https://sellercentral.amazon.nl',
    'https://sellercentral.amazon.pl'
]


chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    if (!tab.url) return;
    const url = new URL(tab.url);

    var allowed = SC_URLS.filter(k => k === url.origin)[0];
    if (allowed) {
        await chrome.sidePanel.setOptions({
            tabId,
            path: 'content/sidepanel.html',
            enabled: true
        });
    } else {
        // Disables the side panel on all other sites
        await chrome.sidePanel.setOptions({
            tabId,
            enabled: false
        });
    }
});