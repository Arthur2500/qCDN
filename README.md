[![Docker Image CI](https://github.com/Arthur2500/qCDN/actions/workflows/docker-image-prod.yml/badge.svg)](https://github.com/Arthur2500/qCDN/actions/workflows/docker-image-prod.yml)

# qCDN <img src="https://github.com/Arthur2500/qCDN/raw/main/public/icon/favicon.ico" alt="Icon" width="32"/>
A lightweight CDN server with a simple frontend & API.

## Demo:
https://cdn.ziemlich-schnell.de

## How to run:
### Use Prebuilt Image (Recommended)
```
docker run --name qcdn -p 3000:3000 \
  -e NODE_ENV=production \
  -e SECURITY=enabled \
  -e API_KEYS=none \
  -e PASSWORDS=CHANGEME \
  -e HEAD_TAGS='<link rel="stylesheet" href="https://cdn.example.com/styles.css">,<script src="https://cdn.example.com/script.js"></script>' \
  -e SESSION_SECRET=your-secret-key \
  -e USE_HTTPS=true \
  -e DOMAIN=localhost \
  -e PORT=3000 \
  -v ./data:/usr/src/app/data --restart unless-stopped \
  ghcr.io/arthur2500/qcdn:latest
```

or
```
mkdir qCDN &&
cd qCDN &&
wget https://raw.githubusercontent.com/Arthur2500/qCDN/main/docker-compose.yml &&
docker-compose up -d
```

### Build Docker Image Locally
```
git clone https://github.com/Arthur2500/qCDN.git &&
docker-compose -f docker-compose.local.yml up -d --build
```

### Run without Docker
#### Requirements:
```
Node.js >= 16
```

#### Clone Repository
```
git clone https://github.com/Arthur2500/qCDN.git
```

#### Install dependencies
```
npm install
```

#### Run server.js
```
SECURITY=enabled \
PASSWORDS=your-passwords-here \
API_KEYS=your-api-key-here \
HEAD_TAGS='<link rel="stylesheet" href="https://cdn.example.com/styles.css">,<script src="https://cdn.example.com/script.js"></script>' \
PRIVACY_LINK=https://example.com/privacy \
TERMS_LINK=https://example.com/terms \
IMPRINT_LINK=https://example.com/imprint \
SESSION_SECRET=your-secret-key \
USE_HTTPS=true \
DOMAIN=your-domain-here \
PORT=3000 \
node server.js
```

## Configuration
`docker-compose.yml` Environment Settings:
- `SECURITY: [enabled/disabled]`: Enables/disables security features such as rate limiting and Helmet protection
- `PASSWORDS: [$PASSWORDS]`: Comma-separated passwords to secure frontend
- `API_KEYS: [none/$CUSTOM_KEYS]`: Comma-separated API tokens (if set to "none", API is disabled)
- `HEAD_TAGS`: HTML elements to be included in `<head>`
- `PRIVACY_LINK`: Privacy policy link
- `TERMS_LINK`: Terms of service link
- `IMPRINT_LINK`: Imprint link
- `SESSION_SECRET`: Secret key for session management
- `USE_HTTPS`: If `true`, uses HTTPS protocol
- `DOMAIN`: Server domain name
- `PORT`: Port if run locally

## Screenshots
![Screenshot 1](https://github.com/user-attachments/assets/1b613775-4f23-404c-adde-f0ac2d70970f)
![Screenshot 2](https://github.com/user-attachments/assets/ddf5159e-7224-4198-ace2-ab18c48cc57e)

## API Endpoints

### `/api/upload`
#### Method: `POST`
#### Description:
Allows authenticated users to upload files via API and receive a URL for accessing them.

#### Request Headers
- `x-api-token`: API authentication token.

#### Request Body
- `file`: File to upload (multipart/form-data).

#### Response
- **Success**:
```json
{
  "success": true,
  "url": "https://example.com/<hash>/<originalName>"
}
```
- **Failure**:
```json
{
  "success": false,
  "message": "Error message"
}
```

#### Example Requests
##### `curl`
```sh
curl -X POST http://localhost:3000/api/upload \
  -H "x-api-token: YOUR_API_TOKEN" \
  -F "file=@/path/to/your/file.txt"
```

##### Python
```python
import requests

url = "http://localhost:3000/api/upload"
headers = {"x-api-token": "YOUR_API_TOKEN"}
files = {"file": open("/path/to/your/file.txt", "rb")}

response = requests.post(url, headers=headers, files=files)
if response.status_code == 200:
    data = response.json()
    if data.get("success"):
        print("File uploaded successfully:", data["url"])
    else:
        print("Error:", data)
else:
    print("Error:", response.text)
```

### `/api/delete/:hash`
#### Method: `DELETE`
#### Description:
Allows authenticated users to delete an uploaded file by hash.

#### Request Headers
- `x-api-token`: API authentication token.

#### Response
- **Success**:
```json
{
  "success": true
}
```
- **Failure**:
```json
{
  "success": false,
  "message": "Error message"
}
```

#### Example Requests
##### `curl`
```sh
curl -X DELETE http://localhost:3000/api/delete/<hash> \
  -H "x-api-token: YOUR_API_TOKEN"
```

##### Python
```python
import requests

url = "http://localhost:3000/api/delete/<hash>"
headers = {"x-api-token": "YOUR_API_TOKEN"}

response = requests.delete(url, headers=headers)
if response.status_code == 200:
    data = response.json()
    if data.get("success"):
        print("File deleted successfully")
    else:
        print("Error:", data)
else:
    print("Error:", response.text)
```

### `/api/list`
#### Method: `GET`
#### Description:
Returns a list of all uploaded files.

#### Request Headers
- `x-api-token`: API authentication token.

#### Response
- **Success**:
```json
{
  "success": true,
  "uploads": [
    {
      "hash": "<hash>",
      "originalName": "<originalName>",
      "size": <size>,
      "uploadedAt": "<uploadedAt>"
    }
  ]
}
```
- **Failure**:
```json
{
  "success": false,
  "message": "Error message"
}
```

#### Example Requests
##### `curl`
```sh
curl -X GET http://localhost:3000/api/list \
  -H "x-api-token: YOUR_API_TOKEN"
```

##### Python
```python
import requests

url = "http://localhost:3000/api/list"
headers = {"x-api-token": "YOUR_API_TOKEN"}

response = requests.get(url, headers=headers)
if response.status_code == 200:
    data = response.json()
    if data.get("success"):
        print("Uploads:", data["uploads"])
    else:
        print("Error:", data)
else:
    print("Error:", response.text)
```

### `/api/list/r`
#### Method: `GET`
#### Description:
Returns a list of all reverse shares.

#### Request Headers
- `x-api-token`: API authentication token.

#### Response
- **Success**:
```json
{
  "success": true,
  "reverseShares": [
    {
      "hash": "<hash>",
      "createdAt": "<createdAt>",
      "used": <true/false>
    }
  ]
}
```
- **Failure**:
```json
{
  "success": false,
  "message": "Error message"
}
```

#### Example Requests
##### `curl`
```sh
curl -X GET http://localhost:3000/api/list/r \
  -H "x-api-token: YOUR_API_TOKEN"
```

##### Python
```python
import requests

url = "http://localhost:3000/api/list/r"
headers = {"x-api-token": "YOUR_API_TOKEN"}

response = requests.get(url, headers=headers)
if response.status_code == 200:
    data = response.json()
    if data.get("success"):
        print("Reverse Shares:", data["reverseShares"])
    else:
        print("Error:", data)
else:
    print("Error:", response.text)
```

### `/api/reverse-share/:hash/status`
#### Method: `GET`
#### Description:
Fetches the status of a reverse share.

#### Request Headers
- `x-api-token`: API authentication token.

#### Response
- **Success**:
```json
{
  "success": true,
  "used": false,
  "filename": "example.txt",
  "fileUrl": "https://your-domain/example-hash/example.txt",
  "uploadedAt": "2025-06-17T11:00:00.000Z",
  "createdAt": "2025-06-17T10:00:00.000Z",
  "callbackUrl": "https://example.com/webhook"
}
```
- **Failure**:
```json
{
  "success": false,
  "message": "Error message"
}
```

#### Example Requests
##### `curl`
```sh
curl -X GET https://your-domain/api/reverse-share/example-hash/status \
  -H "x-api-token: YOUR_API_TOKEN"
```

##### Python
```python
import requests

url = "https://your-domain/api/reverse-share/example-hash/status"
headers = {"x-api-token": "YOUR_API_TOKEN"}

response = requests.get(url, headers=headers)
if response.status_code == 200:
    data = response.json()
    if data.get("success"):
        print("Reverse Share Status:", data)
    else:
        print("Error:", data)
else:
    print("Error:", response.text)
```

### Reverse Shares
Reverse shares allow one-time file uploads via a special link. This feature is particularly useful for receiving files from other users without granting them full access to the platform.

#### Create a Reverse Share
##### `curl`
```sh
curl -X POST https://<DOMAIN>/api/reverse-share \
  -H "x-api-token: YOUR_API_TOKEN"
```

##### Python
```python
import requests

url = "https://<DOMAIN>/api/reverse-share"
headers = {"x-api-token": "YOUR_API_TOKEN"}

response = requests.post(url, headers=headers)
if response.status_code == 200:
    data = response.json()
    if data.get("success"):
        print("Reverse share created successfully:", data["url"])
    else:
        print("Error:", data)
else:
    print("Error:", response.text)
```

#### Use a Reverse Share
1. Open the generated reverse share link.
2. Drag and drop the file into the upload area or select it manually.
3. The file will be uploaded, and a download link will be displayed.

#### Delete a Reverse Share
##### `curl`
```sh
curl -X DELETE https://<DOMAIN>/api/delete/r/<HASH> \
  -H "x-api-token: YOUR_API_TOKEN"
```

##### Python
```python
import requests

url = "https://<DOMAIN>/api/delete/r/<HASH>"
headers = {"x-api-token": "YOUR_API_TOKEN"}

response = requests.delete(url, headers=headers)
if response.status_code == 200:
    data = response.json()
    if data.get("success"):
        print("Reverse share deleted successfully")
    else:
        print("Error:", data)
else:
    print("Error:", response.text)
```

