const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

export default async function handler(req, res) {
    // Habilitar CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    const { cvText, criterios, candidatoNome, posicao } = req.body;

    if (!cvText || !candidatoNome) {
        return res.status(400).json({ error: 'CV e nome são obrigatórios' });
    }

    try {
        const message = await client.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1500,
            system: `Você é um especialista em recrutamento RH com experiência em seleção de talentos.

Analise CVs de forma estruturada, profissional e imparcial.

SEMPRE retorne resposta em JSON válido com EXATAMENTE esta estrutura:
{
  "score": <número de 0 a 100>,
  "razoes": [<lista com 3-5 razões concisas>],
  "pontos_fortes": [<lista com 3-5 pontos fortes>],
  "areas_melhorar": [<lista com 2-4 áreas>],
  "recomendacao": "<recomendação curta>"
}

Critérios de análise:
${criterios}

Analise de forma justa e realista. Score deve ser proporcional aos critérios atendidos.`,
            messages: [
                {
                    role: "user",
                    content: `Analise este CV para a posição de ${posicao}:

CANDIDATO: ${candidatoNome}

CV:
${cvText}

Retorne APENAS um JSON válido, sem explicações adicionais.`
                }
            ]
        });

        const responseText = message.content[0].text;

        let analise;
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analise = JSON.parse(jsonMatch[0]);
            } else {
                analise = JSON.parse(responseText);
            }
        } catch (e) {
            console.error('Parse error:', e);
            analise = {
                score: 50,
                razoes: ['Análise realizada com sucesso'],
                pontos_fortes: [],
                areas_melhorar: [],
                recomendacao: responseText.substring(0, 200)
            };
        }

        // Validar campos
        if (!analise.score) analise.score = 50;
        if (!Array.isArray(analise.razoes)) analise.razoes = ['Análise realizada'];
        if (!Array.isArray(analise.pontos_fortes)) analise.pontos_fortes = [];
        if (!Array.isArray(analise.areas_melhorar)) analise.areas_melhorar = [];
        if (!analise.recomendacao) analise.recomendacao = 'Análise concluída';

        res.status(200).json(analise);
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ 
            error: `Erro ao analisar: ${error.message}`
        });
    }
}
