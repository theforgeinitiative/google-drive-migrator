const CLIENT_ID = '553423144419-jlfck395bk4qpioffj199dhph5je0pej.apps.googleusercontent.com';
const FOLDER_ID = "0B7JfziZ0vamoMHE2VHU3dlNDWDA"; // TFI Board
// const FOLDER_ID = "1WsKm9eQXFZc3QiZUwheB0iUtKt7r3ZbL"; // Real estate
const SCOPES = 'https://www.googleapis.com/auth/drive';

let tokenClient;
let accessToken = null;
let currentFolder = "";

function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
  await gapi.client.init({
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
  });
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (tokenResponse) => {
      accessToken = tokenResponse.access_token;
      await loadAndListFiles();
    }
  });

  document.getElementById("signinDiv").innerHTML = '<button class="btn btn-success" onclick="handleAuthClick()">Sign in and List Files</button>';
}

function handleAuthClick() {
  tokenClient.requestAccessToken();
}

async function loadAndListFiles() {
  document.getElementById("signinDiv").style.display = "none"
  document.getElementById("loading").style.display = "block";
  const files = await listFilesRecursively(FOLDER_ID);
  document.getElementById("loading").style.display = "none";
  document.getElementById("post-list").style.display = "block";
  renderTable(files);
}

async function listFilesRecursively(folderId, results = []) {
  let pageToken = null;
  do {
    const response = await gapi.client.drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, webViewLink, owners)',
      pageSize: 1000,
      pageToken: pageToken
    });

    const items = response.result.files || [];
    for (const file of items) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        // Recurse into subfolder
        document.getElementById("currentFolder").textContent = file.name;
        currentFolder = file.name
        await listFilesRecursively(file.id, results);
      } else if (file.owners && file.owners[0].me) {
        // Only include files owned by the current user
        results.push({
            "id": file.id,
            "name": file.name,
            "folder": currentFolder,
            "type": file.mimeType,
            "url": file.webViewLink,
        });
      }
    }

    pageToken = response.result.nextPageToken;
  } while (pageToken);

  return results;
}

function renderTable(files) {
  const tbody = document.getElementById("fileTableBody");
  tbody.innerHTML = "";

  files.forEach(file => {
    const row = document.createElement("tr");
    row.dataset.id = file.id;

    row.innerHTML = `
      <td><a href="${file.url}" target="_blank">${file.name}</a></td>
      <td>${file.folder}</td>
      <td>${file.type}</td>
      <td class="status">Found</td>
    `;

    tbody.appendChild(row);
  });
}

async function transferFiles() {
    var rows = document.querySelectorAll('#fileTableBody tr'); // returns NodeList
    var row_array = [...rows]; // converts NodeList to Array
    
    // Get current user's email
    const userInfo = await gapi.client.drive.about.get({
        fields: 'user'
    });
    const currentUserEmail = userInfo.result.user.emailAddress;
    
    for (const r of row_array) {
        const newOwner = currentUserEmail.endsWith('theforgeinitiative.org') 
            ? atob("cGF0cmljay5lYXN0ZXJzQHRoZWZvcmdlaW5pdGlhdGl2ZS5vcmc=")
            : atob("dGhlZm9yZ2Vpbml0aWF0aXZlLm9yZ0BnbWFpbC5jb20=");
            
        await gapi.client.drive.permissions.create({
            fileId: r.dataset.id,
            transferOwnership: true,
            sendNotificationEmail: true,
            resource: {
            role: "owner",
            type: "user",
            emailAddress: newOwner,
            }
        });
        r.querySelector(':scope > .status').textContent = "✅ Transferred";        
    }
}

// Load GAPI and GIS
window.onload = () => {
    gapiLoaded();
    gisLoaded();
  };