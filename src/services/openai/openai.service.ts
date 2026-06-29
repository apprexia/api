import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class OpenaiService {
  private client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  async analyze(url: string) {
    const response = await this.client.responses.create({
      model: 'gpt-4.1-mini',
      input: `
Analyse cette annonce immobilière :

${url}

Retourne un JSON contenant :
- title
- city
- score
- verdict
- estimatedValue
- recommendedPrice
- negotiationAmount
- strengths
- risks
`,
    });

    return response.output_text;
  }
}