import OpenAI from 'openai';

const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID || 'asst_EMSneBT4LxQPGjXocKTcs4PU';

export async function enrichDescriptions(descriptions: string[]): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return descriptions;

  const client = new OpenAI({ apiKey });

  try {
    const thread = await client.beta.threads.create();

    await client.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: JSON.stringify(descriptions),
    });

    let run = await client.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID,
    });

    let attempts = 0;
    while (run.status !== 'completed') {
      if (attempts > 30 || run.status === 'failed' || run.status === 'cancelled') {
        console.warn('AI assistant did not complete in time, using original descriptions.');
        return descriptions;
      }
      await new Promise((r) => setTimeout(r, 1000));
      run = await client.beta.threads.runs.retrieve(run.id, { thread_id: thread.id });
      attempts++;
    }

    const messages = await client.beta.threads.messages.list(thread.id);
    const assistantMsg = messages.data.find((m) => m.role === 'assistant');
    const firstContent = assistantMsg?.content?.[0];

    if (firstContent?.type === 'text') {
      const parsed = JSON.parse(firstContent.text.value);
      if (Array.isArray(parsed)) return parsed as string[];
    }
  } catch (err) {
    console.error('AI enrichment failed:', err);
  }

  return descriptions;
}
