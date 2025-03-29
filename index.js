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

    // Capturar screenshot para debug
    await page.screenshot({ path: 'debug-screenshot.png' });

    // Seletor para os resultados
    const resultsSelector = `[aria-label="Resultados para ${searchTerm}"]`;
    try {
      await page.waitForSelector(resultsSelector, { timeout: 30000 }); // Reduz o tempo limite para o carregamento
    } catch (e) {
      console.log("Aviso: Seletor de resultados não encontrado. Continuando com captura de dados brutos.");
    }
    
    // Capturar o HTML completo da página
    const pageContent = await page.content();

    // Rolar a página até carregar todos os resultados
    try {
      let previousHeight;
      let scrollAttempts = 0;
      const maxScrollAttempts = 3; // Limite de tentativas de rolagem
      
      while (scrollAttempts < maxScrollAttempts) {
        const resultDiv = await page.$(resultsSelector);
        if (!resultDiv) break;
        
        previousHeight = await page.evaluate((el) => el.scrollHeight, resultDiv);
        await page.evaluate((el) => el.scrollBy(0, el.scrollHeight), resultDiv);
        await new Promise((resolve) => setTimeout(resolve, 3000)); // Reduz o tempo de espera entre rolagens
        
        const newHeight = await page.evaluate((el) => el.scrollHeight, resultDiv);
        if (newHeight === previousHeight) break; // Sai do loop se não houver mais resultados
        
        scrollAttempts++;
      }
    } catch (e) {
      console.log("Aviso: Erro durante a rolagem. Continuando com os dados disponíveis.");
    }

    // Extrair os dados brutos dos resultados
    const rawData = await page.evaluate((resultsSelector) => {
      console.log("Iniciando extração de dados brutos");
      
      // Capturar a estrutura completa da página
      const pageStructure = {
        body: document.body.innerHTML
      };
      
      // Tentar múltiplos seletores comuns no Google Maps
      const resultsContainer = document.querySelector(resultsSelector);
      let resultElements = [];
      
      if (resultsContainer) {
        // Tentar diferentes seletores para os resultados
        resultElements = resultsContainer.querySelectorAll('[role="article"], .section-result, .gm2-body, div[jsaction*="mouseover"], div[data-result-index], div[data-item-id]');
        
        console.log(`Encontrados ${resultElements.length} elementos com os seletores específicos`);
        
        // Se não encontrou nada, tenta capturar mais elementos genéricos
        if (resultElements.length === 0) {
          resultElements = resultsContainer.querySelectorAll('div > a, div[role="link"], div[role="region"], div[jscontroller]');
          console.log(`Tentativa com seletores mais genéricos: ${resultElements.length} elementos encontrados`);
        }
      }
      
      // Retornar a estrutura completa da página e quaisquer resultados encontrados
      return {
        pageStructure: pageStructure,
        results: Array.from(resultElements || []).map(element => {
          try {
            return {
              outerHTML: element.outerHTML,
              textContent: element.textContent,
              attributes: Array.from(element.attributes).map(attr => ({
                name: attr.name,
                value: attr.value
              }))
            };
          } catch (e) {
            return { error: e.toString(), elementType: element.tagName };
          }
        })
      };
    }, resultsSelector);

    await browser.close();

    // Retorna os resultados brutos como JSON
    return res.json({
      term: searchTerm,
      rawData: rawData,
      fullPageHTML: pageContent
    });
  } catch (error) {
    console.error("Erro ao realizar a pesquisa:", error);
    return res.status(500).json({ error: "Erro ao realizar a pesquisa." });
  }
});

// Inicializar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
