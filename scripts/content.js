var currentMode = null;

$(async () => {
    $('#btnDownload').click(() => download());
    $("#btnClear").click(() => clear());
    $('#btnManufacturers').click(() => { currentMode = "manufacturers"; populateTable(); });
    $('#btnResponsiblePersons').click(() => { currentMode = "responsiblePersons"; populateTable(); });
    $('#btnUpload').click(() => { window.location = 'upload.html' });

    await loadStatus();
});

chrome.storage.onChanged.addListener(async function (changes, namespace) {
    if (changes.manufacturers && namespace === 'local') {
        await loadStatus();
    }
    if (changes.responsiblePersons && namespace === 'local') {
        await loadStatus();
    }

    if (changes.amazon && namespace === 'local') {
        await parseAmazonData();
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        var response = null;
        switch (request.action) {
            case "inputAmazonData":
                if (request.data)
                    response = await parseAmazonData(request.data);
                else
                    showMessage("Error while retrieving data from Seller Central");
                break;
        }

        if (response) sendResponse(response);
    })();

    return true;
});

async function loadStatus() {
    var data = await loadFromStorage();

    if (data.manufacturers.length == 0 && data.responsiblePersons.length == 0) {
        $("#data").hide();
        $("#clear").hide();
    }
    else {
        $("#data").show();
        $("#clear").show();
        if (data.manufacturers.length == 0)
            $("#btnManufacturers").hide();
        else {
            $("#btnManufacturers").text(`Manufacturers (${data.manufacturers.length})`).show();
        }

        if (data.responsiblePersons.length == 0)
            $("#btnResponsiblePersons").hide();
        else {
            $("#btnResponsiblePersons").text(`Responsible Persons (${data.responsiblePersons.length})`).show();
        }
    }

    if (data.manufacturers.length > 0 || data.responsiblePersons.length > 0)
        $("#btnClear").show();

    if (!currentMode) {
        $("#resultsTable tbody").empty();
        $("#resultsTable").hide();
    }
    await populateTable();
}

async function clear() {
    chrome.storage.local.clear();
    loadStatus();
}

async function showMessage(message) {
    const toastLiveExample = $('#liveToast');
    $(".toast-body", toastLiveExample).text(message);

    const toastBootstrap = bootstrap.Toast.getOrCreateInstance(toastLiveExample);
    toastBootstrap.show()
}

async function download() {
    var cookie = await getToken();
    if (!cookie) {
        showMessage("Not authenticated");
        return;
    }

    var token = cookie.value;
    var manufacturers = await loadPersonsFromMarketRock(token, "Manufacturer");
    var responsiblePersons = await loadPersonsFromMarketRock(token, "ResponsiblePerson");


    saveToStorage({ manufacturers: manufacturers, responsiblePersons: responsiblePersons });
    showMessage(`${manufacturers.length} manufacturers retrieved`);
    showMessage(`${responsiblePersons.length} responsible persons retrieved`);
}

async function getCookie(name) {
    return await chrome.cookies.get(
        details = { name: name, url: "https://html5.marketrock.it" },
    );
}

async function getToken() { return await getCookie("BearerToken"); }



async function loadPersonsFromMarketRock(token, personType) {
    var page = 0;
    var persons = [];

    do {
        var result = await makeAPICall(token, personType, page);
        if (!result.ok) {
            showMessage("Error while retrieving data from MarketRock");
            break;
        }
        else {
            page++;

            var body = await result.json();
            var personsPage = body.Content;
            personsPage.map(k => {
                k.Status = 0;
                k.uid = crypto.randomUUID();
                persons.push(k);
            });

            if (personsPage.length === 0) break;
        }
    }
    while (true);

    return persons;
}

async function makeAPICall(token, type, page) {
    var response = await fetch("https://html5.marketrock.it/api/api/manufacturers/search", {
        method: "POST",
        body: JSON.stringify({ "page": page, "pageSize": 50, "sort": { "field": "", "verb": "" }, "filters": [{ "field": "PersonType", values: [type] }], "details": [] }),
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    });

    return response;
}

function saveToStorage(data) {
    chrome.storage.local.set(data);
}

function isNotEmptyObject(obj) {
    return obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).length > 0;
}

async function loadFromStorage() {
    var manufacturers = await chrome.storage.local.get("manufacturers") || [];
    var responsiblePersons = await chrome.storage.local.get("responsiblePersons") || [];

    var localData = {};
    Object.assign(localData, isNotEmptyObject(manufacturers) ? manufacturers : { manufacturers: [] });
    Object.assign(localData, isNotEmptyObject(responsiblePersons) ? responsiblePersons : { responsiblePersons: [] });
    return localData;
}

async function pushToStorage(element) {
    await chrome.storage.local.set(element);
}

async function populateTable() {
    if (!currentMode) return;

    var data = await loadFromStorage();
    var dataToVisualize = data[currentMode] || [];

    var title = "";
    switch (currentMode) {
        case "manufacturers":
            title = "Manufacturers";
            break;
        case "responsiblePersons":
            title = "Responsible Persons";
            break;
    }
    $("#currentMode").text(title);

    const table = $("#resultsTable");
    const tableBody = $("tbody", table);
    $(tableBody).html("")

    dataToVisualize.forEach(item => {
        const row = $('<tr>');

        const companyName = $(`<td>${item.CompanyName}</td>`);
        const status = $('<td>');
        const submit = $(`<td><button class='submitButton' data-uid='${item.uid}' type='button' class='btn'>Submit</button></td>`);

        var statusAction = ""
        switch (item.Status) {
            case 0:
                statusAction = "<i title='data loaded, refresh SC page' class='bi bi-question-circle'></i>";
                break;
            case 1:
                statusAction = "<i title='found on SC. You are all set' class='bi bi-check-circle-fill' style='color: green'></i>";
                break;
            case 2:
                statusAction = "<i title='found on SC, but invalid. Check error on SC' class='bi bi-exclamation-circle-fill' style='color: red'></i>";
                break;
            case 4:
                statusAction = "<div title='pending on SC. Finger crossed!' class='spinner-border spinner-border-sm' role='status'></div>";
                break;
        }

        $(status).html(statusAction);
        $(row).append(status);
        $(row).append(companyName);

        if (item.Status !== 4)
            $(row).append(submit);
        else
            $(row).append($("<td>"));

        $(tableBody).append(row);
    });

    $(table).show();
    $(".submitButton", $(table)).click((e) => submitToAmazon(e));

}

async function parseAmazonData(amazonData) {

    var localData = await loadFromStorage();
    var localManufacturers = localData.manufacturers;
    var amazonManufacturers = amazonData.manufacturers || [];
    localManufacturers.forEach(m => {
        var existing = amazonManufacturers.find(y =>
            y.entity.name === m.CompanyName ||
            y.entity.primary_contact_reference === m.Email1 ||
            y.entity.primary_contact_reference === m.URL
        );
        if (existing) {
            if (existing.status === "Valid")
                m.Status = 1;
            else if (existing.status === "Pending")
                m.Status = 4;
            else
                m.Status = 2;
        }
        else {
            if (m.Status == 0)
                m.Status = 3;
        }
    });

    var localResponsiblePersons = localData.responsiblePersons;
    var amazonResponsiblePersons = amazonData.responsiblePersons || [];
    localResponsiblePersons.forEach(m => {
        var existing = amazonResponsiblePersons.find(y =>
            y.entity.name === m.CompanyName ||
            y.entity.email === m.Email1 ||
            y.entity.email === m.URL
        );
        if (existing) {
            if (existing.status === "Valid")
                m.Status = 1;
            else if (existing.status === "Pending")
                m.Status = 4;
            else
                m.Status = 2;
        }
        else {
            if (m.Status == 0)
                m.Status = 3;
        }
    });


    saveToStorage({ manufacturers: localManufacturers, responsiblePersons: localResponsiblePersons });
    await populateTable();
}



async function submitToAmazon(e) {

    if (!currentMode) return;

    var selectedUid = $(e.currentTarget).data("uid");
    var localData = await loadFromStorage();
    var persons = localData[currentMode];
    var person = persons.find(k => k.uid == selectedUid);
    if (!person) { showMessage("Unable to find manufacturer. Please refresh data."); return; }

    
    if (!person.CountryIsoName) {
        showMessage("Manufacturer is missing Country");
        return;
    }

    if (!person.Email1 && !person.Email2 && !person.URL) {
        showMessage("Manufacturer is missing Email1 and Email2 and URL. At least one is required.");
        return;
    }


    const [tab] = await chrome.tabs.query({ active: true });
    if (!tab) {
        showMessage("Seller Central Tab not found");
        return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: currentMode, entity: person });
    if (response.pushed) {
        person.Status = 4;
        await pushToStorage(localData);
    } else {
        showMessage("Unable to push to Seller Central. Please, reload");
    }
}