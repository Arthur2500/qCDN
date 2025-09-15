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

### `/api/:hash`
#### Method: `POST`
#### Description:
Uploads a file to a reverse share by its hash. No authentication required.

#### Request Body
- `file`: File to upload (multipart/form-data).

#### Response
- **Success**:
```json
{
  "success": true,
  "fileUrl": "<file_url>",
  "filename": "<filename>",
  "uploadedAt": "<timestamp>"
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
curl -X POST http://localhost:3000/api/<hash> \
  -F "file=@/path/to/your/file.txt"
```

##### Python
```python
import requests

url = "http://localhost:3000/api/<hash>"
files = {"file": open("/path/to/your/file.txt", "rb")}

response = requests.post(url, files=files)
if response.status_code == 200:
    data = response.json()
    if data.get("success"):
        print("File uploaded successfully:", data["fileUrl"])
    else:
        print("Error:", data)
else:
    print("Error:", response.text)
```

### `/api/:hash`
#### Method: `DELETE`
#### Description:
Allows authenticated users to delete an uploaded file or reverse share by hash.

#### Request Headers
- `x-api-token`: API authentication token.

#### Response
- **Success**:
```json
{
  "success": true,
  "type": "file" | "reverse-share"
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
curl -X DELETE http://localhost:3000/api/<hash> \
  -H "x-api-token: YOUR_API_TOKEN"
```

##### Python
```python
import requests

url = "http://localhost:3000/api/<hash>"
headers = {"x-api-token": "YOUR_API_TOKEN"}

response = requests.delete(url, headers=headers)
if response.status_code == 200:
    data = response.json()
    if data.get("success"):
        print("Deleted successfully")
    else:
        print("Error:", data)
else:
    print("Error:", response.text)
```

### `/api/reverse-share`
#### Method: `POST`
#### Description:
Creates a new reverse share.

#### Request Headers
- `x-api-token`: API authentication token.

#### Request Body
- `callbackUrl` (optional): URL to be called after the file is uploaded.

#### Response
- **Success**:
```json
{
  "success": true,
  "url": "<reverse_share_url>"
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
curl -X POST http://localhost:3000/api/reverse-share \
  -H "x-api-token: YOUR_API_TOKEN" \
  -d '{"callbackUrl": "https://example.com/callback"}'
```

##### Python
```python
import requests

url = "http://localhost:3000/api/reverse-share"
headers = {"x-api-token": "YOUR_API_TOKEN"}
data = {"callbackUrl": "https://example.com/callback"}

response = requests.post(url, headers=headers, json=data)
if response.status_code == 200:
    data = response.json()
    if data.get("success"):
        print("Reverse share created successfully:", data["url"])
    else:
        print("Error:", data)
else:
    print("Error:", response.text)
```

### `/api/list`
#### Method: `GET`
#### Description:
Lists all uploaded files.

#### Request Headers
- `x-api-token`: API authentication token.

#### Response
- **Success**:
```json
{
  "success": true,
  "uploads": [<file_objects>]
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

### `/api/list/reverse-shares`
#### Method: `GET`
#### Description:
Lists all reverse shares.

#### Request Headers
- `x-api-token`: API authentication token.

#### Response
- **Success**:
```json
{
  "success": true,
  "uploads": [<reverse_share_objects>]
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
curl -X GET http://localhost:3000/api/list/reverse-shares \
  -H "x-api-token: YOUR_API_TOKEN"
```

##### Python
```python
import requests

url = "http://localhost:3000/api/list/reverse-shares"
headers = {"x-api-token": "YOUR_API_TOKEN"}

response = requests.get(url, headers=headers)
if response.status_code == 200:
    data = response.json()
    if data.get("success"):
        print("Reverse Shares:", data["uploads"])
    else:
        print("Error:", data)
else:
    print("Error:", response.text)
```

