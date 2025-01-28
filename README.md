[![Docker Image CI](https://github.com/Arthur2500/qCDN/actions/workflows/docker-image.yml/badge.svg)](https://github.com/Arthur2500/qCDN/actions/workflows/docker-image.yml)
# qCDN <img src="https://github.com/Arthur2500/qCDN/raw/main/public/icon/favicon.ico" alt="Icon" width="32"/>
A lightweight CDN server with a simple frontend & API.

## Demo:
https://cdn.ziemlich-schnell.de

## How to run:
### Use Prebuilt Image (Recommended)
```
docker run --name qcdn -p 3000:3000 -e NODE_ENV=production -e SECURITY=enabled -e API_KEYS=none -e PASSWORDS=CHANGEME -v ./data:/usr/src/app/data --restart unless-stopped ghcr.io/arthur2500/qcdn:latest
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
Requirements:
```
Node.js >= 16
ffmpeg
```

Clone Repository
```
git clone https://github.com/Arthur2500/qCDN.git
```

Install dependencies
```
npm install
```

Run main.js
```
node main.js
```

For improved security, set environment variable SECURITY=enabled if exclusively accessed via Cloudflare Tunnel or localhost
```
SECURITY=enabled node main.js
```

Frontend authentication key is also passed via environment variable
```
PASSWORDS=your-passwords-here node main.js
```

API authentication key is also passed via environment variable
```
API_KEYS=your-api-key-here node main.js
```

Or all 3
```
SECURITY=enabled PASSWORDS=your-passwords-here API_KEYS=your-api-key-here node main.js
```

## Configuration
`docker-compose.yml` Environment Settings:
- `SECURITY: [enabled/disabled]`: Enable/Disable Security features such as Ratelimiting for API and Helmet header protection
- `PASSWORDS: [$PASSWORDS]`: Secure the frontend via these comma separated passwords
- `API_KEY: [none/$CUSTOM_KEYS]`: If set to "none," API is disabled. Otherwise, Strings separated by commas are used as access tokens. (see [Request Headers](#request-headers))

## Screenshots
![Screenshot 2025-01-28 225737](https://github.com/user-attachments/assets/9ac70af6-52f9-4df4-986c-39b6967a969d)
![Screenshot 2025-01-28 225827](https://github.com/user-attachments/assets/734168ae-b2ba-4e65-81cc-a1379e23fa19)

## API Endpoint

### Endpoint: `/api/upload`###

Method: `POST`

Description: Allows authenticated users to upload files via the API and receive a URL for accessing the uploaded file.

#### Request Headers

- `x-api-token`: API token for authentication.

#### Request Body

- `file`: File to upload (multipart/form-data).

#### Response

- **Success**: Returns a JSON object containing the uploaded file's URL:
```json
{
"success": true,
"url": "https://example.com/<hash>/<originalName>"
}
```

- **Failure**: Returns a JSON object with an error message:
```json
{
"success": false,
"message": "Error message"
}
```

### Examples

#### `curl` Example

```sh
curl -X POST http://localhost:3000/api/upload \
  -H "x-api-token: YOUR_API_TOKEN" \
  -F "file=@/path/to/your/file.txt"
```

#### Python Example

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

### Endpoint: `/api/delete/:hash` ###

Method: `DELETE`

Description: Allows authenticated users to delete an uploaded file by specifying its hash.

#### Request Headers

- `x-api-token`: API token for authentication.

#### Request Body

- None.

#### Response

- **Success**: Returns a JSON object indicating the file was deleted:
```json
{
  "success": true
}
```

- **Failure**: Returns a JSON object with an error message:
```json
{
"success": false,
"message": "Error message"
}
```

### Examples

#### `curl` Example

```sh
curl -X DELETE http://localhost:3000/api/delete/<hash> \
  -H "x-api-token: YOUR_API_TOKEN"
```

#### Python Example

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
