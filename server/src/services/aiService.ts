import OpenAI from 'openai';

const MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';

const INSTRUCTIONS = `
Você é um redator especializado em documentação de software para auditoria de qualidade.

ENTRADA: Um array JSON com N strings. Cada string traz o título da funcionalidade ("Funcionalidade: ...") e a descrição técnica da atividade ("Descrição: ..."), realizada em uma sprint de desenvolvimento.

TAREFA: Para cada item, escrever a descrição da funcionalidade entregue, clara e objetiva, adequada para gestores e auditores não técnicos lerem na coluna "Descrição das funcionalidades" de um documento de atesto.

REGRAS OBRIGATÓRIAS:

1. CONTAGEM EXATA
   A saída deve ter exatamente N elementos — o mesmo número da entrada, na mesma ordem.
   Nunca agrupe, divida, omita ou adicione itens.

2. TAMANHO
   Cada descrição deve ter entre 120 e 280 caracteres, em uma ou duas frases. Seja direto e completo.

3. IDIOMA
   Português brasileiro. Linguagem formal, acessível e sem jargões técnicos.

4. ESTILO
   Descreva o que a funcionalidade permite fazer, no presente, citando quem usa quando isso estiver claro.
   Comece preferencialmente com "Permite" ou com um verbo no presente (Reúne, Exibe, Consolida, Gera).
   Exemplos:
   "Permite à escola solicitar à SMED a reabertura de uma ou mais turmas já enviadas, informando o motivo da correção para posterior avaliação."
   "Reúne, por competência mensal, as turmas que cada escola deve declarar e mostra a situação de cada registro."
   Não repita o título da funcionalidade.

5. VOCABULÁRIO PROIBIDO
   Não use: HTML, CSS, SQL, JavaScript, checkbox, WYSIWYG, ID, IDs, banco de dados,
   backend, frontend, array, string, boolean, null, undefined, endpoint, API, JSON,
   objeto, classe, função, método, componente, módulo, biblioteca, framework.

6. FOCO NO IMPACTO
   Descreva o que o usuário final ganha ou o que muda no sistema — não a implementação técnica.
   Ruim:  "Permite gravar um campo booleano na tabela de usuários."
   Bom:   "Permite indicar se o usuário está ativo ou inativo no sistema."

7. ITEM VAZIO OU SEM CONTEÚDO
   Se um item não tiver título nem descrição com conteúdo funcional identificável,
   retorne exatamente: "Contempla melhorias internas no funcionamento do sistema."

FORMATO DE SAÍDA:
Retorne as descrições no campo "descriptions", na mesma ordem da entrada.
`.trim();

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    descriptions: { type: 'array', items: { type: 'string' } },
  },
  required: ['descriptions'],
  additionalProperties: false,
};

export async function enrichDescriptions(descriptions: string[]): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith('#')) return descriptions;

  const client = new OpenAI({ apiKey });

  try {
    const startedAt = Date.now();
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: INSTRUCTIONS },
        { role: 'user', content: JSON.stringify(descriptions) },
      ],
      // Garante que a resposta venha no formato { descriptions: [...] }.
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'atesto_descriptions', strict: true, schema: OUTPUT_SCHEMA },
      },
    });

    const choice = completion.choices[0];
    if (choice?.message.refusal) {
      console.warn('[AI] Pedido recusado pelo modelo. Usando originais.');
      return descriptions;
    }
    if (choice?.finish_reason === 'length') {
      console.warn('[AI] Resposta cortada por limite de tokens. Usando originais.');
      return descriptions;
    }

    const content = choice?.message.content;
    if (content) {
      const parsed = JSON.parse(content) as { descriptions?: unknown };
      const result = parsed.descriptions;
      if (Array.isArray(result) && result.length === descriptions.length) {
        console.log(
          `[AI] Enriquecimento concluído: ${result.length} descrições em ${Date.now() - startedAt}ms (modelo ${completion.model}).`,
        );
        return result.map(String);
      }
      console.warn('[AI] Resposta com contagem divergente. Usando originais.');
    } else {
      console.warn('[AI] Resposta vazia do modelo. Usando originais.');
    }
  } catch (err) {
    if (err instanceof OpenAI.AuthenticationError) {
      console.error('[AI] Chave da OpenAI inválida (OPENAI_API_KEY).');
    } else if (err instanceof OpenAI.RateLimitError) {
      console.error('[AI] Limite de uso/crédito da OpenAI atingido:', err.message);
    } else if (err instanceof OpenAI.APIError) {
      console.error(`[AI] Erro da API OpenAI (${err.status}):`, err.message);
    } else {
      console.error('[AI] Falha no enriquecimento:', err);
    }
  }

  return descriptions;
}
