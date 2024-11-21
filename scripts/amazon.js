pageLoaded();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        var response = null;
        switch (request.type) {
            case "manufacturers":
                response = await sendManufacturer(request.entity);
                break;
            case "responsiblePersons":
                response = await sendResponsiblePerson(request.entity);
                break;
        }

        if (response) sendResponse(response);
    })();

    return true;
});

async function pageLoaded() {
    await downloadAmazon();
}

async function downloadAmazon() {

    try {
        var manufacturers = await loadManufacturers();
        var rps = await loadResponsiblePersons();

        var amazonData = { manufacturers: manufacturers, responsiblePersons: rps };
        chrome.runtime.sendMessage({ action: "inputAmazonData", data: amazonData });
    }
    catch (e) {
        chrome.runtime.sendMessage({ action: "inputAmazonData", failure: e });
    }
}

async function loadManufacturers() {
    var host = location.hostname;
    var response = await fetch(`https://${host}/spx/myc/myc-backend-service/api/get-artifact-submission-batch`, {
        method: "POST",
        body: JSON.stringify({ "contributor": { "ContributorType": "SELLER" }, "policyId": 185092, "resolutionPathId": "af8bbf6d-4f48-432d-93e5-f59a15fcb1fb", "entity": { "grain": "SELLING_PARTNER_PRIMARY_CONTACT_REFERENCE", "values": {} }, "artifactRequests": [{ "namespace": "product_compliance", "name": "manufacturer_address", "schemaSource": "UMP" }] })
    });

    var resp = await response.json();
    return resp.artifacts.map(k => {
        return {
            type: k.name,
            entity: JSON.parse(k.payload).collection,
            status: k.status
        }
    });
}

async function loadResponsiblePersons() {

    var host = location.hostname;
    var response = await fetch(`https://${host}/spx/myc/myc-backend-service/api/get-artifact-submission-batch`, {
        method: "POST",
        body: JSON.stringify({ "contributor": { "ContributorType": "SELLER" }, "policyId": 185093, "resolutionPathId": "b4763998-a455-4b43-8434-6de50ca46344", "entity": { "grain": "LEGACY_RSP_EMAIL", "values": {} }, "artifactRequests": [{ "namespace": "product_compliance", "name": "responsible_person", "schemaSource": "UMP", "specifications": null }] })
    });

    var resp = await response.json();
    return resp.artifacts.map(k => {
        return {
            type: k.name,
            entity: JSON.parse(k.payload),
            status: k.status
        }
    });
}

function getPrimaryId(person) {
    if (person.Email1)
        return person.Email1;
    else if (person.Email2)
        return person.Email2;
    else if (person.URL)
        return person.URL;
    else
        return null;
}

function getSecondaryId(person) {
    var primary = getPrimaryId(person);
    if (!primary) return null;

    if (person.Email2 && person.Email2 != primary)
        return person.Email2;
    else if (person.URL && person.URL != primary)
        return person.URL;
    else
        return null;
}

async function sendManufacturer(person) {

    var id = getPrimaryId(person);
    var secondary_id = getSecondaryId(person);

    var payload = {
        collection: {
            name: person.CompanyName,
            primary_contact_reference: id,
            address: {}
        }
    }

    if (secondary_id) payload.collection.secondary_contact_reference = secondary_id;
    if (person.Phone) payload.collection.phone_number = person.Phone;

    if (person.Address1) payload.collection.address.address_line_1 = person.Address1;
    if (person.Address2) payload.collection.address.address_line_2 = person.Address2;
    if (person.City) payload.collection.address.city = person.City;
    if (person.CountyOrState) payload.collection.address.state_or_region = person.CountyOrState;
    if (person.ZipCode) payload.collection.address.postal_code = person.ZipCode;
    if (person.CountryIsoName) payload.collection.address.country = person.CountryIsoName;

    var host = location.hostname;
    var str = JSON.stringify(payload);
    var result = await fetch(`https://${host}/spx/myc/myc-backend-service/api/put-artifact-submission-batch`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "anti-csrftoken-a2z-request": "true"
        },
        body: JSON.stringify({
            "contributor":
                { "ContributorType": "SELLER" },
            "policyId": 185328,
            "resolutionPathId": "af8bbf6d-4f48-432d-93e5-f59a15fcb1fb",
            "entity":
            {
                "grain": "SELLING_PARTNER_PRIMARY_CONTACT_REFERENCE",
                "values": { "PRIMARY_CONTACT_REFERENCE": id }
            },
            "artifacts": [
                {
                    "namespace": "product_compliance",
                    "name": "manufacturer_address",
                    "schemaSource": "UMP",
                    "payload": str,
                    "selectors": {}
                }
            ]
        })
    });
    return { pushed: result.ok };
}

async function sendResponsiblePerson(person) {

    var id = getPrimaryId(person);
    var payload = {
        name: person.CompanyName,
    };

    if (person.Address1) payload.address_line_1 = person.Address1;
    if (person.Address2) payload.address_line_2 = person.Address2;
    if (person.City) payload.city = person.City;
    if (person.ZipCode) payload.postal_code = person.ZipCode;
    if (person.CountyOrState) payload.state_or_region = person.CountyOrState;
    if (person.CountryIsoName) payload.country = person.CountryIsoName;
    if (person.Email1) payload.email = id;
    if (person.Phone) payload.phone_number = person.Phone;

    var host = location.hostname;
    var str = JSON.stringify(payload);
    var result = await fetch(`https://${host}/spx/myc/myc-backend-service/api/put-artifact-submission-batch`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "anti-csrftoken-a2z-request": "true"
        },
        body: JSON.stringify({
            "contributor":
                { "ContributorType": "SELLER" },
            "policyId": 185336,
            "resolutionPathId": "b4763998-a455-4b43-8434-6de50ca46344",
            "entity":
            {
                "grain": "LEGACY_RSP_EMAIL",
                "values": { "email_id": id }
            },
            "artifacts": [
                {
                    "namespace": "product_compliance",
                    "name": "responsible_person",
                    "schemaSource": "UMP",
                    "payload": str,
                    "selectors": {}
                }
            ]
        })
    });
    return { pushed: result.ok };
}