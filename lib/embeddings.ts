import OpenAI from "openai";

const openai = new OpenAI({ 
  baseURL: `https://aicredits.in/v1`, 
  apiKey: process.env.OPENAI_API_KEY 
});

const EMBEDDING_MODEL = "text-embedding-3-small";



export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}
