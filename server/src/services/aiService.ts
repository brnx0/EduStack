import OpenAI from 'openai';

const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID || 'asst_EMSneBT4LxQPGjXocKTcs4PU';

const INSTRUCTIONS = `
Você é um redator especializado em documentação de software para auditoria de qualidade.

ENTRADA: Um array JSON com N strings contendo descrições técnicas (podendo incluir HTML) de atividades realizadas em uma sprint de desenvolvimento.

TAREFA: Transformar cada descrição técnica em uma frase clara e objetiva, adequada para gestores e auditores não técnicos lerem em um documento de atesto de sprint.

REGRAS OBRIGATÓRIAS:

1. CONTAGEM EXATA
   A saída deve ter exatamente N elementos — o mesmo número da entrada, na mesma ordem.
   Nunca agrupe, divida, omita ou adicione itens.

2. TAMANHO
   Cada frase deve ter entre 80 e 150 caracteres. Seja direto e completo.

3. IDIOMA
   Português brasileiro. Linguagem formal, acessível e sem jargões técnicos.

4. INÍCIO COM GERÚNDIO
   Comece sempre com um verbo no particípio que represente a ação principal.
   Exemplos: Criado, Corrigido, Ajustado, Implementado, Adicionado, Removido, Melhorado, Validado.

5. VOCABULÁRIO PROIBIDO
   Não use: HTML, CSS, SQL, JavaScript, checkbox, WYSIWYG, ID, IDs, banco de dados,
   backend, frontend, array, string, boolean, null, undefined, endpoint, API, JSON,
   objeto, classe, função, método, componente, módulo, biblioteca, framework.

6. FOCO NO IMPACTO
   Descreva o que o usuário final ganha ou o que muda no sistema — não a implementação técnica.
   Ruim:  "Adicionando campo booleano na tabela de usuários."
   Bom:   "Adicionando opção para indicar se o usuário está ativo ou inativo no sistema."

7. ITEM VAZIO OU SEM CONTEÚDO
   Se uma string estiver vazia, ilegível ou sem conteúdo funcional identificável,
   retorne exatamente: "Realizando melhoria interna no sistema."

FORMATO DE SAÍDA:
Retorne SOMENTE o array JSON puro. Sem markdown, sem blocos de código, sem explicações, sem texto antes ou depois.
Correto:   ["Frase 1.", "Frase 2.", "Frase 3."]
Incorreto: \`\`\`json\\n["Frase 1."]\\n\`\`\`
`.trim();

export async function enrichDescriptions(descriptions: string[]): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith('#')) return descriptions;

  const client = new OpenAI({ apiKey });

  try {
    const thread = await client.beta.threads.create();

    await client.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: JSON.stringify(descriptions),
    });

    let run = await client.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID,
      instructions: INSTRUCTIONS,
    });

    let attempts = 0;
    while (run.status !== 'completed') {
      if (attempts > 30 || run.status === 'failed' || run.status === 'cancelled') {
        console.warn('[AI] Assistente não completou a tempo. Usando descrições originais.');
        return descriptions;
      }
      await new Promise((r) => setTimeout(r, 1000));
      run = await client.beta.threads.runs.retrieve(run.id, { thread_id: thread.id });
      attempts++;
    }

    const messages = await client.beta.threads.messages.list(thread.id);
    const firstContent = messages.data.find((m) => m.role === 'assistant')?.content?.[0];

    if (firstContent?.type === 'text') {
      const raw = firstContent.text.value.trim();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === descriptions.length) {
        return parsed as string[];
      }
      console.warn('[AI] Resposta com contagem divergente. Usando originais.');
    }
  } catch (err) {
    console.error('[AI] Falha no enriquecimento:', err);
  }

  return descriptions;
}
