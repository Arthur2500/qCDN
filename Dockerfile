FROM node:slim

# Arbeitsverzeichnis in Container
WORKDIR /usr/src/app

# package.json und package-lock.json kopieren
COPY package*.json ./

# Abhängigkeiten installieren
RUN npm install --omit=dev

# Restliche Dateien kopieren
COPY . .

# Ordner für hochgeladene Dateien sicherstellen
RUN mkdir -p data

# Port festlegen
EXPOSE 3000

# Startbefehl
CMD ["npm", "start"]