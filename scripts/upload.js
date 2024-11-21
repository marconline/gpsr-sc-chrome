$(document).ready(function () {
    $("#btnProcess").on("click", handleFileUpload);

    async function handleFileUpload(event) {
        const files = $("#fileInput").prop("files");
        const $messages = $("#messages");
        $messages.empty(); // Resetta i messaggi

        if (files.length === 0) {
            displayMessage("No file selected.", "danger");
            return;
        }

        var file = files[0];

        // Validazione tipo file
        if (file.type !== "text/csv") {
            displayMessage("Invalid file type. Please upload a CSV file.", "danger");
            return;
        }

        try {
            var content = await readFileAsText(file);
            if (!content) {
                displayMessage("Error reading file.", "danger");
                return;
            }
        } catch (e) {
            console.log(e);
            return;
        }

        const rows = parseCsv(content);

        // Validazione formato CSV
        if (!isValidCsv(rows)) {
            displayMessage("Invalid CSV format.", "danger");
            return;
        }

        var persons = await processCsvRows(rows);
        var type = $("input[name='type']:checked").val();

        var result = {};
        result[type] = persons;
        await chrome.storage.local.set(result)

        displayMessage("File uploaded successfully! <a href='sidepanel.html'>Go back!</a>", "success");
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error("Failed to read file."));
            reader.readAsText(file);
        });
    }


    function isValidCsv(rows) {
        // Esempio: Valida che il CSV abbia almeno 2 righe e ogni riga abbia 3 colonne
        if (rows.length < 2) return false;

        const header = rows[0];
        const expectedHeader = ["CompanyName", "Address1", "Address2", "City", "ZipCode", "CountyOrState", "CountryIsoName", "Email", "URL", "Phone"];
        if (!arraysEqual(header, expectedHeader)) {
            displayMessage(`Invalid header. Expected: ${expectedHeader.join(", ")}`, "danger");
            return false;
        }

        const expectedColumns = 10;
        return rows.every(row => row.length === expectedColumns);
    }

    async function processCsvRows(rows) {

        var persons = [];
        rows.slice(1).forEach((row, index) => {
            var person = {
                "CompanyName": row[0],
                "Address1": row[1],
                "Address2": row[2],
                "City": row[3],
                "ZipCode": row[4],
                "CountyOrState": row[5],
                "CountryIsoName": row[6],
                "Email1": row[7],
                "URL": row[8],
                "Phone": row[9],
                "Status": 0,
                "uid": crypto.randomUUID()
            }

            persons.push(person);
        });

        return persons;

    }

    function displayMessage(message, type) {
        const alert = `<div class="alert alert-${type}">${message}</div>`;
        $("#messages").html(alert);
    }

    function parseCsv(content) {
        const rows = [];
        let currentRow = [];
        let currentField = "";
        let insideQuotes = false;

        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const nextChar = content[i + 1];

            if (char === '"' && !insideQuotes) {
                // Entriamo in un campo tra virgolette
                insideQuotes = true;
            } else if (char === '"' && insideQuotes && nextChar === '"') {
                // Virgolette annidate ("")
                currentField += '"';
                i++; // Saltiamo il secondo carattere delle virgolette
            } else if (char === '"' && insideQuotes) {
                // Usciamo da un campo tra virgolette
                insideQuotes = false;
            } else if (char === ',' && !insideQuotes) {
                // Nuovo campo
                currentRow.push(currentField.trim());
                currentField = "";
            } else if (char === '\n' && !insideQuotes) {
                // Nuova riga
                currentRow.push(currentField.trim());
                rows.push(currentRow);
                currentRow = [];
                currentField = "";
            } else {
                // Accumula caratteri
                currentField += char;
            }
        }

        // Aggiungi l'ultima riga se esiste
        if (currentField || currentRow.length > 0) {
            currentRow.push(currentField.trim());
            rows.push(currentRow);
        }

        return rows;
    }

    function arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        return arr1.every((value, index) => value.trim() === arr2[index].trim());
    }
});
