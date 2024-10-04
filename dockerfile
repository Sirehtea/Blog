# Gebruik de Node.js LTS versie als basis image
FROM node:18

# Stel de werkdirectory in de container
WORKDIR /usr/src/app

# Kopieer package.json en package-lock.json
COPY package*.json ./

# Installeer de Node.js dependencies
RUN npm install

# Kopieer de rest van de app's broncode naar de container
COPY . .

# Exposeer de poort waar de app op draait
EXPOSE 3000

# Start de Node.js-app
CMD ["node", "server.js"]