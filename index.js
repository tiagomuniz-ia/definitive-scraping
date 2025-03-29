const express = require("express");
const puppeteer = require("puppeteer");

const app = express();

// Rota raiz
app.get("/", (req, res) => {
  res.send("Bem vindo ao Scraper Google Maps");
});

// Rota de busca no Google Maps
app.get("/search", async (req, res) => {
  const searchTerm = req.query.term;

  if (!searchTerm) {
    return res.status(400).json({ error: "O parâmetro 'term' é obrigatório." });
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: "/usr/bin/google-chrome", // Caminho para o Chrome instalado
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--lang=pt-BR", // Define o idioma do navegador como português
      ],
    });

    const page = await browser.newPage();

    // Configura o cabeçalho de idioma
    await page.setExtraHTTPHeaders({
      "Accept-Language": "pt-BR,pt;q=0.9",
    });

    // Gera a URL de pesquisa do Google Maps
    const url = `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}`;
    await page.goto(url, { waitUntil: "networkidle2" });

    console.log(`Pesquisando: ${searchTerm}`);

    // Seletor para os resultados
    const resultsSelector = `[aria-label="Resultados para ${searchTerm}"]`;
    await page.waitForSelector(resultsSelector, { timeout: 60000 }); // Aumenta o tempo limite para o carregamento

    // Rolar a página até carregar todos os resultados
    let previousHeight;
    while (true) {
      const resultDiv = await page.$(resultsSelector);
      previousHeight = await page.evaluate((el) => el.scrollHeight, resultDiv);
      await page.evaluate((el) => el.scrollBy(0, el.scrollHeight), resultDiv);
      await new Promise((resolve) => setTimeout(resolve, 6000)); // Aguarda 6 segundos entre as rolagens
      const newHeight = await page.evaluate((el) => el.scrollHeight, resultDiv);
      if (newHeight === previousHeight) break; // Sai do loop se não houver mais resultados
    }

    // Extrair os dados brutos dos resultados
    const rawData = await page.evaluate((resultsSelector) => {
      const resultsContainer = document.querySelector(resultsSelector);
      if (!resultsContainer) return [];
      
      // Obter todos os elementos de resultado
      const resultElements = resultsContainer.querySelectorAll('[role="article"]');
      
      // Extrair HTML bruto de cada elemento
      return Array.from(resultElements).map(element => {
        return {
          outerHTML: element.outerHTML,
          innerHTML: element.innerHTML,
          textContent: element.textContent
        };
      });
    }, resultsSelector);

    await browser.close();

    // Retorna os resultados brutos como JSON
    return res.json({
      term: searchTerm,
      rawResults: rawData,
      count: rawData.length
    });
  } catch (error) {
    console.error("Erro ao realizar a pesquisa:", error);
    return res.status(500).json({ error: "Erro ao realizar a pesquisa." });
  }
});

// Inicializar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
