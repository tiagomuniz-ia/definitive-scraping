FROM node:18

# Instale dependências do sistema necessárias para o Puppeteer
RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libxss1 \
    libgtk-3-0 \
    libxshmfence1 \
    libglu1

# Configure o diretório de trabalho
WORKDIR /app

# Copie o projeto
COPY . .

# Instale as dependências do Node.js
RUN npm install

# Exponha a porta
EXPOSE 3000

# Comando de inicialização
CMD ["npm", "start"]
