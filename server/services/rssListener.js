import { getSettings, getFreelanceProfile, addAlert, getAlerts, getProposals } from '../db.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Regex XML Parser for RSS items
function parseRssXml(xmlText) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemContent = match[1];
    const title = (itemContent.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    const link = (itemContent.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
    const description = (itemContent.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';
    const pubDate = (itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    
    const clean = (str) => {
      return str
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
    };
    
    items.push({
      title: clean(title),
      url: clean(link),
      description: clean(description),
      date: clean(pubDate)
    });
  }
  return items;
}

// Call AI Model to quickly score a project from RSS
async function evaluateProjectFit(profile, projectTitle, projectDesc, settings) {
  const provider = settings.provider || 'gemini';
  
  const prompt = `
Realiza una evaluación rápida de compatibilidad entre un perfil profesional y una oferta de proyecto freelance.
Deberás retornar un JSON válido con tres campos:
1. "compatibilityScore": Número entero del 0 al 100 indicando la compatibilidad de habilidades.
2. "compatibilityRationale": Una frase explicativa muy corta (máximo 15 palabras) de por qué ese puntaje.
3. "clientRedFlags": Un array de strings conteniendo alertas o riesgos detectados en la descripción (ej. "Presupuesto muy bajo", "Especificaciones vagas", "Plazo irreal", "Pide trabajo gratis"). Si no hay riesgos, deja el array vacío.

PERFIL DEL FREELANCER:
Habilidades / Experiencia:
${profile.freelanceOverview || profile.cvText}

PROYECTO A EVALUAR:
Título: ${projectTitle}
Descripción: ${projectDesc}

Responde ÚNICAMENTE con el objeto JSON, sin texto adicional fuera del JSON.
`;

  try {
    if (provider === 'gemini') {
      const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) return { compatibilityScore: 0, compatibilityRationale: 'Gemini Key no configurada', clientRedFlags: [] };
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: "application/json" }
      });
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text().trim());
    } 
    
    else if (provider === 'groq') {
      const apiKey = settings.groqApiKey || process.env.GROQ_API_KEY;
      if (!apiKey) return { compatibilityScore: 0, compatibilityRationale: 'Groq Key no configurada', clientRedFlags: [] };
      
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      });
      const data = await response.json();
      return JSON.parse(data.choices[0].message.content.trim());
    } 
    
    else if (provider === 'ollama') {
      const ollamaUrl = settings.ollamaUrl || 'http://localhost:11434';
      const modelName = settings.ollamaModel || 'llama3';
      
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          format: 'json'
        })
      });
      const data = await response.json();
      return JSON.parse(data.message.content.trim());
    }
  } catch (error) {
    console.error('Error al evaluar compatibilidad en segundo plano:', error);
  }
  
  return { compatibilityScore: 0, compatibilityRationale: 'Error de evaluación', clientRedFlags: [] };
}

// Main RSS Poller function
export async function pollAllFeeds() {
  console.log('Iniciando escaneo de Feeds RSS en segundo plano...');
  try {
    const { getAllUsers } = await import('../db.js');
    const users = await getAllUsers();
    
    if (!users || users.length === 0) {
      console.log('No hay usuarios registrados todavía.');
      return;
    }

    for (const user of users) {
      const userId = user.id;
      const settings = await getSettings(userId);
      const feeds = settings.rssFeeds || [];
      if (feeds.length === 0) {
        continue;
      }

      console.log(`Procesando feeds para usuario: ${user.email}`);
      const profile = await getFreelanceProfile(userId);
      const existingAlerts = await getAlerts(userId);
      const existingProposals = await getProposals(userId);
      
      const processedUrls = new Set([
        ...existingAlerts.map(a => a.url),
        ...existingProposals.map(p => p.url)
      ]);

      for (const feedUrl of feeds) {
        if (!feedUrl) continue;
        try {
          const response = await fetch(feedUrl);
          if (!response.ok) {
            console.error(`Error al descargar feed RSS: ${response.statusText}`);
            continue;
          }
          const xmlText = await response.text();
          const items = parseRssXml(xmlText);
          
          for (const item of items) {
            if (processedUrls.has(item.url)) continue;

            console.log(`[${user.email}] Evaluando nuevo proyecto: "${item.title}"`);
            
            // Evaluar compatibilidad con IA (usando settings del usuario)
            // Para pasar las settings correctas de la clave de API, podemos re-evaluar evaluateProjectFit pasando el objeto settings completo
            const fitResult = await evaluateProjectFit(profile, item.title, item.description, settings);
            
            if (fitResult.compatibilityScore >= 50) {
              await addAlert(userId, {
                title: item.title,
                company: 'Cliente RSS Feed',
                url: item.url,
                description: item.description,
                budget: 'Detectado en Feed',
                compatibilityScore: fitResult.compatibilityScore,
                compatibilityRationale: fitResult.compatibilityRationale,
                clientRedFlags: fitResult.clientRedFlags
              });
              console.log(`[${user.email}] ¡Alerta guardada! Compatibilidad ${fitResult.compatibilityScore}%`);
            }

            processedUrls.add(item.url);
          }
        } catch (err) {
          console.error(`Fallo al procesar feed para usuario ${user.email}: ${feedUrl}`, err);
        }
      }
    }
  } catch (error) {
    console.error('Error general en la tarea de monitoreo RSS:', error);
  }
}
