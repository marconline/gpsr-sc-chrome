var data = null;
var index = 0;

function sendApiRequests(dataRows) {
  const apiUrl = 'https://enws6e193jz8.x.pipedream.net/';  // Sostituisci con l'endpoint API

  dataRows.forEach((row, index) => {
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(row) // Invii ogni riga come body della richiesta
    })
    .then(response => response.json())
    .then(data => {
      console.log(`Risposta per riga ${index + 1}:`, data);
    })
    .catch(error => {
      console.error(`Errore nella chiamata API per riga ${index + 1}:`, error);
    });
  });

  document.getElementById('status').textContent = 'Chiamate API completate.';
}

document.getElementById('upload').addEventListener('click', () => {
  const fileInput = document.getElementById('csvFile');
  const file = fileInput.files[0];

  if (!file) {
    document.getElementById('status').textContent = 'Per favore, carica un file CSV.';
    return;
  }

  const reader = new FileReader();

  // Quando il file è stato caricato
  reader.onload = function(event) {
    const csvData = event.target.result;
    
    // Usa PapaParse per convertire il CSV in un array di oggetti
    Papa.parse(csvData, {
      header: true, // Se il CSV ha intestazioni
      complete: function(results) {
        document.getElementById('status').textContent = results.data.length + ' elementi caricati';
		document.getElementById('fill').style.display = 'block';
        
		data = results.data;
		index = 0;
      },
      error: function(err) {
        console.error('Errore durante il parsing del CSV:', err);
        document.getElementById('status').textContent = 'Errore durante il parsing del CSV.';
      }
    });
  };

  reader.readAsText(file); // Leggi il file come testo
});

document.getElementById('fill').addEventListener('click', () => {
	
		chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
			const tabId = tabs[0].id;
			var elm = data[index];
			
			chrome.scripting.executeScript({
			  target: {tabId: tabId},
			  files: ['jquery-3.7.1.min.js']  // Inietta jQuery prima
			}, () => {
			
			chrome.scripting.executeScript({
				target: {tabId: tabId},
				func: modifyFields,  // La funzione da eseguire nel content script
				args: [elm]  // Passa i dati della riga al content script
			  });
			index++;
		});
	});
});

function modifyFields(rowData) {
  // Modifica i campi nella pagina web utilizzando i dati della riga CSV

	$("kat-input[name='name']", "#flyout-root").val(rowData.company);

  // Puoi aggiungere altre logiche per gestire campi diversi
  console.log("Campi aggiornati con i dati della riga:", rowData);
}

