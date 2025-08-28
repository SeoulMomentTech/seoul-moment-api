/* eslint-disable max-lines-per-function */
import { LoggerModule } from '@app/common/log/logger.module';
import { LoggerService } from '@app/common/log/logger.service';
import { Configuration } from '@app/config/configuration';
import { ExternalGoogleSheetService } from '@app/external/google/google-sheet.service';
import { ExternalGoogleModule } from '@app/external/google/google.module';
import { Test } from '@nestjs/testing';
import { plainToInstance, Type } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

// 네트워크 통합 테스트용으로 60초로 타임아웃 연장
jest.setTimeout(60_000);

class TestDto {
  @IsString()
  name: string;

  @Type(() => Number)
  @IsNumber()
  age: number;

  static from(name: string, age: number): TestDto {
    return plainToInstance(this, { name, age });
  }
}

const hasEnv =
  Configuration.getConfig().GOOGLE_SHEET_SERVICE_EMAIL !== '' &&
  Configuration.getConfig().GOOGLE_SHEET_SERVICE_PRIMARY !== '';

const describeOrSkip = hasEnv ? describe : describe.skip;

describeOrSkip('Google Sheet Service', () => {
  let googleSheetService: ExternalGoogleSheetService;
  let createdSpreadsheetId: string;
  const shareEmail = 'seoulmomenttw@gmail.com';
  const customSheetName = 'MyTestTab';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ExternalGoogleModule, LoggerModule],
    })
      .overrideProvider(LoggerService)
      .useValue({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      })
      .compile();

    googleSheetService = module.get<ExternalGoogleSheetService>(
      ExternalGoogleSheetService,
    );
  });

  it('should create a new spreadsheet with a custom sheet name', async () => {
    const title = `Jest Integration ${Date.now()}`;
    const id = await googleSheetService.createSpreadsheet(
      title,
      shareEmail,
      customSheetName,
    );

    expect(typeof id).toBe('string');
    expect(id).toMatch(/^[a-zA-Z0-9-_]+$/);

    // 생성된 ID 저장
    createdSpreadsheetId = id;

    // 생성된 문서에 setSpreadsheetId 후 탭 이름 확인
    googleSheetService.setSpreadsheetId(createdSpreadsheetId);
    const sheetNames = await googleSheetService.getSheetNames();
    expect(sheetNames).toContain(customSheetName);
  });

  it('should writeRows then appendRows correctly', async () => {
    // 1) writeRows 테스트
    googleSheetService.setSpreadsheetId(createdSpreadsheetId);

    const writeData = [TestDto.from('Alice', 30), TestDto.from('Kim', 11)];

    await googleSheetService.writeRows(`${customSheetName}!A1`, writeData);

    const rowsAfterWrite = await googleSheetService.getData(
      customSheetName,
      TestDto,
    );

    expect(rowsAfterWrite).toEqual(writeData);

    // 2) appendRows 테스트
    const appendData = [TestDto.from('123', 4444)];
    await googleSheetService.appendRows(`${customSheetName}!A1`, appendData);
    const rowsAfterAppend = await googleSheetService.getData(
      customSheetName,
      TestDto,
    );
    expect(rowsAfterAppend).toEqual([...writeData, ...appendData]);
  });

  it('should delete the created spreadsheet', async () => {
    googleSheetService.setSpreadsheetId(createdSpreadsheetId);
    await expect(googleSheetService.deleteSpreadsheet()).resolves.not.toThrow();
  });

  afterAll(async () => {
    // 첫 삭제 테스트에서 실패했을 경우를 대비해 한 번 더 시도
    if (createdSpreadsheetId) {
      googleSheetService.setSpreadsheetId(createdSpreadsheetId);
      try {
        await googleSheetService.deleteSpreadsheet();
      } catch {
        // 이미 삭제되었거나 권한 에러 등 무시
      }
    }
  });
});
