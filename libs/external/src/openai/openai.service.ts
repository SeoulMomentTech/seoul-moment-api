import { Configuration } from '@app/config/configuration';
import { LanguageName } from '@app/repository/enum/language.enum';
import { Injectable, OnModuleInit } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class OpenaiService implements OnModuleInit {
  private openai: OpenAI;

  constructor() {}

  onModuleInit() {
    this.openai = new OpenAI({
      apiKey: Configuration.getConfig().OPENAI_API_KEY,
    });
  }

  async translate(text: string, targetLanguage: LanguageName): Promise<string> {
    const isEnglish = targetLanguage === LanguageName.ENGLISH;
    const isChinese = targetLanguage === LanguageName.TAIWAN;

    let additionalInstructions = '';
    if (isEnglish) {
      additionalInstructions =
        ' When translating to English, always capitalize the first letter of each sentence.';
    } else if (isChinese) {
      additionalInstructions =
        ' Always use Traditional Chinese (繁體中文) characters only, never use Simplified Chinese (简体中文).';
    }

    const response = await this.openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the given Korean text to ${targetLanguage}.${additionalInstructions} Only return the translated text without any additional explanation or commentary.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
    });

    return response.choices[0].message.content || '';
  }
}
