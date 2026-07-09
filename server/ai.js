import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { getSettings } from './db.js';

dotenv.config();

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(text.substring(start, end + 1));
    } catch (e) {
      console.warn("Failed to parse extracted JSON substring. Retrying with raw string.", e);
    }
  }
  return JSON.parse(text);
}

async function callLLM(userId, prompt, isJson = true) {
  const settings = await getSettings(userId);
  const provider = settings.provider || 'gemini';

  if (provider === 'gemini') {
    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('API Key de Gemini no configurada.');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: isJson ? { responseMimeType: "application/json" } : {}
    });
    
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return isJson ? extractJson(text) : text;
  } 
  
  else if (provider === 'groq') {
    const apiKey = settings.groqApiKey || process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('API Key de Groq no configurada.');
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: isJson ? { type: 'json_object' } : undefined
      })
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Groq API Error: ${err.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    const text = data.choices[0].message.content;
    return isJson ? extractJson(text) : text;
  } 
  
  else if (provider === 'ollama') {
    const ollamaUrl = settings.ollamaUrl || 'http://localhost:11434';
    const model = settings.ollamaModel || 'llama3';
    
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { temperature: 0.2 },
        format: isJson ? 'json' : undefined
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama Error: ¿Está encendido Ollama? Status: ${response.statusText}`);
    }
    
    const data = await response.json();
    const text = data.message.content;
    return isJson ? extractJson(text) : text;
  }
  
  throw new Error(`Proveedor de IA no soportado: ${provider}`);
}

export async function generateTailoredMaterials(userId, profile, jobDetails) {
  const prompt = `
Analiza el currículum de un candidato y los detalles de una oferta de empleo para generar materiales adaptados.

INFORMACIÓN DEL CANDIDATO:
Nombre: ${profile.name}
Email: ${profile.email}
Teléfono: ${profile.phone}
Ubicación: ${profile.location}
LinkedIn: ${profile.linkedin}
GitHub: ${profile.github}
Sitio web: ${profile.website}
Resumen de experiencia: ${profile.experienceSummary}
Texto del CV Base:
${profile.cvText}

DETALLES DE LA OFERTA DE EMPLEO:
Puesto: ${jobDetails.title}
Empresa: ${jobDetails.company}
Descripción/Requisitos:
${jobDetails.description}

Instrucciones para generar el JSON:
Genera un objeto JSON estructurado con los siguientes campos:
1. "compatibilityScore": Un número entero del 0 al 100 indicando la compatibilidad.
2. "compatibilityRationale": Una explicación corta de 3-4 líneas detallando el análisis (fortalezas y debilidades).
3. "customCoverLetter": Una carta de presentación altamente redactada de unos 3 párrafos para este puesto, usando la experiencia real del candidato.
4. "customEmail": Un borrador de correo electrónico corto (150 palabras) para postulación directa.
5. "cvAdjustments": Un texto en formato Markdown con:
   - Un "Perfil Profesional" adaptado.
   - Puntos clave (bullet points) a resaltar o modificar.
   - "Keywords Coincidentes" (lista de palabras clave en la descripción que sí tiene el candidato).
   - "Keywords Faltantes" (lista de tecnologías/conceptos que pide la oferta y el candidato no tiene listados, para añadirlos si los conoce).

Responde únicamente con el objeto JSON estructurado, sin texto o comentarios fuera de él.
`;

  return await callLLM(userId, prompt, true);
}

export async function generateInterviewPrep(userId, profile, jobDetails) {
  const prompt = `
Genera una guía de preparación para una entrevista de trabajo basada en el CV/Perfil del candidato y la descripción de la oferta o proyecto.

INFORMACIÓN DEL CANDIDATO:
Nombre: ${profile.name}
Texto del CV/Resumen:
${profile.cvText || profile.freelanceOverview}

DETALLES DE LA OFERTA:
Puesto: ${jobDetails.title}
Empresa: ${jobDetails.company}
Descripción/Requisitos:
${jobDetails.description}

Instrucciones para generar el JSON:
Genera un objeto JSON estructurado con un único campo:
"questions": Un array de exactamente 5 objetos. Cada objeto debe tener:
1. "question": Una pregunta que probablemente le hagan al candidato (mezcla técnica y conductual).
2. "suggestedAnswer": Una respuesta modelo sugerida que el candidato puede dar, amoldada a la experiencia real de su currículum.
3. "tips": Un consejo clave para responder con éxito.

Responde únicamente con el objeto JSON estructurado, sin texto fuera del JSON.
`;

  return await callLLM(userId, prompt, true);
}

export async function generateFreelanceProposal(userId, profile, portfolio, projectDetails) {
  const portfolioText = portfolio.map((item, index) => 
    `ID: ${item.id}\nTítulo: ${item.title}\nDescripción: ${item.description}\nTecnologías: ${item.technologies}\nLink: ${item.link}`
  ).join('\n\n');

  const prompt = `
Eres un experto redactor de propuestas comerciales para freelancers en plataformas como Upwork, Workana y Freelancer.com.
Tu tarea es analizar los requerimientos de un proyecto de un cliente y el perfil del freelancer junto a su portafolio para recomendar proyectos relevantes y redactar la mejor propuesta de bid.

INFORMACIÓN DEL FREELANCER:
Nombre: ${profile.name}
Tarifa Base: $${profile.hourlyRate}/hora
Email: ${profile.email}
LinkedIn: ${profile.linkedin}
GitHub: ${profile.github}
Sitio web: ${profile.website}
Habilidades / Overview:
${profile.freelanceOverview}

PORTAFOLIO DE PROYECTOS DISPONIBLES (PROYECTOS PREVIOS DEL FREELANCER):
${portfolioText || "No hay proyectos en el portafolio todavía."}

DETALLES DEL PROYECTO DEL CLIENTE:
Título: ${projectDetails.title}
Cliente/Empresa: ${projectDetails.company}
Presupuesto: ${projectDetails.budget}
Descripción de Requisitos:
${projectDetails.description}
Plataforma Objetivo: ${projectDetails.platform || "Upwork"}

Instrucciones para generar el JSON:
Genera un objeto JSON estructurado con los siguientes campos:
1. "compatibilityScore": Un número del 0 al 100 indicando la compatibilidad de habilidades del freelancer con la propuesta.
2. "compatibilityRationale": Breve explicación de 3 líneas sobre las fortalezas del freelancer frente al proyecto y qué tecnologías clave coinciden.
3. "suggestedProjects": Un array conteniendo las "ID" (cadenas de caracteres) de exactamente los 2-3 proyectos más relevantes del PORTAFOLIO que el freelancer debería destacar. Si el portafolio está vacío, deja un array vacío.
4. "customPitch": Una propuesta comercial altamente persuasiva de aproximadamente 200-250 palabras escrita en primera persona. Debe sonar profesional.
   Ajusta el estilo según la Plataforma Objetivo:
   - Si es **Upwork**: Inicia con un gancho comercial fuerte solucionando el problema directamente en las primeras 2 líneas, destaca tus proyectos de portafolio afines, y termina con un llamado a la acción claro.
   - Si es **Workana**: Usa un tono profesional y educado, estructura la entrega sugiriendo 2 o 3 hitos de entrega (*Milestones*) basados en la descripción, y ofrece cotizaciones claras.
   - Si es **Freelancer**: Redacta una propuesta muy concisa, persuasiva y competitiva para cotizar de manera rápida.
5. "suggestedBid": Una recomendación de precio de puja y tipo (por hora o precio fijo) que se adapte al presupuesto del cliente y al alcance del proyecto.
6. "clientRedFlags": Un array de strings conteniendo alertas o riesgos detectados en la descripción (ej. "Presupuesto muy bajo", "Especificaciones vagas", "Plazo irreal", "Pide trabajo gratis"). Si no hay riesgos, deja el array vacío.

Responde únicamente con el objeto JSON estructurado, sin texto adicional fuera del JSON.
`;

  return await callLLM(userId, prompt, true);
}

export async function generatePlatformBio(userId, profile, platform, niche) {
  const prompt = `
Eres un experto en optimización de perfiles freelance y SEO de plataformas como Upwork, Fiverr, LinkedIn, Malt y Workana.
Basándote en la experiencia del freelancer y su CV base, crea una optimización de perfil.

INFORMACIÓN DEL FREELANCER:
Nombre: ${profile.name}
CV Base / Experiencia:
${profile.freelanceOverview || profile.cvText}

REQUERIMIENTOS:
Plataforma Objetivo: ${platform}
Nicho Tecnológico: ${niche}

Instrucciones para generar el JSON:
Genera un objeto JSON estructurado con los siguientes campos:
1. "headline": Un título de perfil profesional de 1 línea llamativo y lleno de palabras clave que la gente busca (ej. "Senior React Developer | Front-End Architect | UI specialist").
2. "bioOverview": Una biografía comercial (300-400 palabras) adaptada al nicho y plataforma.
   - Para **Upwork/Malt**: Debe iniciar con una frase de impacto, listar los servicios principales, destacar tus logros con viñetas, mencionar tus tecnologías y cerrar con una llamada a la acción para agendar una llamada.
   - Para **Fiverr**: Debe ser una descripción de servicio concisa, directa y orientada a resultados rápidos.
3. "keywords": Un array de 8 palabras clave o tags SEO que el freelancer debería incluir en las etiquetas de su perfil.

Responde únicamente con el objeto JSON estructurado, sin texto fuera del JSON.
`;

  return await callLLM(userId, prompt, true);
}

export async function generateFollowUpMessage(userId, profile, projectDetails, days) {
  const prompt = `
Redacta un mensaje corto de seguimiento (follow-up) para un cliente de un proyecto al que postulaste hace unos días y del cual no has recibido respuesta.
El tono debe ser profesional, cortés y no sonar desesperado o insistente.

FREELANCER:
Nombre: ${profile.name}

DETALLES DEL PROYECTO:
Título: ${projectDetails.title}
Cliente/Empresa: ${projectDetails.company}
Propuesta enviada originalmente:
${projectDetails.customPitch}

TIEMPO DE ESPERA: ${days} días desde la postulación.

Instrucciones para generar el JSON:
Genera un objeto JSON con un único campo:
"message": El texto del mensaje del follow-up (de 80 a 120 palabras).
- Si es a los **3 días**: Enfócate en preguntar cortésmente si tuvieron oportunidad de revisar tu propuesta y ofréceles responder cualquier duda técnica rápida.
- Si es a los **7 días**: Aporta un extra de valor, por ejemplo ofreciendo realizar una videollamada de diagnóstico gratuita de 10 minutos o enviándoles un enlace a un recurso similar que creaste.

Responde únicamente con el objeto JSON, sin texto fuera del JSON.
`;

  return await callLLM(userId, prompt, true);
}
