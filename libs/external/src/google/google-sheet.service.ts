import { LoggerService } from '@app/common/log/logger.service';
import { Configuration } from '@app/config/configuration';
import { Injectable } from '@nestjs/common';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { drive_v3, google, sheets_v4 } from 'googleapis';

interface convertToSheetValueOption {
  includeHeaders?: boolean;
  defaultValue?: string;
}

/**
 * @description
 * GoogleSheetService는 Google Sheets API 및 Google Drive API를 활용하여
 * 스프레드시트를 생성, 조회, 수정, 삭제하는 기능을 제공합니다.
 *
 * ■ 사용 방법
 * 1. Google Cloud Console(https://console.cloud.google.com)에서 프로젝트 생성 또는 선택
 * 2. "API 및 서비스 > 라이브러리"에서 "Google Sheets API"와 "Google Drive API" 사용 설정
 * 3. "API 및 서비스 > 사용자 인증 정보"에서 서비스 계정 생성 후 JSON 키(또는 private_key) 확보
 * 4. 환경 변수(.env 또는 ConfigModule) 설정:
 *    - GOOGLE_SHEET_SERVICE_EMAIL: 서비스 계정 이메일
 *    - GOOGLE_SHEET_SERVICE_PRIMARY: 서비스 계정 private_key ("\n" 이스케이프 처리 포함)
 *    - (선택) GOOGLE_SHEETS_SPREADSHEET_ID: 기존 스프레드시트 ID
 * 5. 의존성 설치: `npm install googleapis class-transformer @nestjs/config`
 * 6. 모듈에 GoogleSheetService를 등록하고 주입하여 사용
 *
 * ■ 주요 메서드
 * - setSpreadsheetId(id: string): void
 * - createSpreadsheet(title: string, email: string, sheetName?: string): Promise<string>
 * - deleteSpreadsheet(): Promise<void>
 * - getSheetNames(): Promise<string[]>
 * - getData<T>(sheetName: string, type: ClassConstructor<T>): Promise<T[]>
 * - writeRows(range: string, data: Record<string, any>[]): Promise<void>
 * - appendRows(range: string, data: Record<string, any>[]): Promise<void>
 * - addSheet(title: string): Promise<number>
 *
 * @example
 * ```ts
 * // 스프레드시트 생성 및 권한 공유
 * const id = await googleSheetService.createSpreadsheet('My Sheet', 'you@example.com', 'DataTab');
 * googleSheetService.setSpreadsheetId(id);
 *
 * // 데이터 쓰기
 * await googleSheetService.writeRows('DataTab!A1', [
 *   { Name: 'Alice', Age: 30 },
 * ]);
 *
 * // 데이터 조회
 * const rows = await googleSheetService.getData('DataTab', MyDto);
 *
 * // 행 추가
 * await googleSheetService.appendRows('DataTab!A1', [
 *   { Name: 'Bob', Age: 25 },
 * ]);
 *
 * // 시트 탭 추가
 * const newTabId = await googleSheetService.addSheet('Logs');
 *
 * // 전체 스프레드시트 삭제
 * await googleSheetService.deleteSpreadsheet();
 * ```
 */
@Injectable()
export class ExternalGoogleSheetService {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId?: string;
  private drive: drive_v3.Drive;

  constructor(private readonly logger: LoggerService) {
    const auth = new google.auth.JWT({
      email: Configuration.getConfig().GOOGLE_SHEET_SERVICE_EMAIL,
      key: Configuration.getConfig().GOOGLE_SHEET_SERVICE_PRIMARY.replace(
        /\\n/g,
        '\n',
      ),
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    this.drive = google.drive({ version: 'v3', auth });
  }

  setSpreadsheetId(id: string) {
    this.spreadsheetId = id;
  }

  async createSpreadsheet(
    title: string,
    email: string,
    sheetName?: string,
  ): Promise<string> {
    const res = await this.sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: sheetName ? [{ properties: { title: sheetName } }] : undefined,
      },
    });

    const newId = res.data.spreadsheetId;
    this.logger.info(`Created new spreadsheet (${title}) with ID ${newId}`);

    await this.drive.permissions.create({
      fileId: newId,
      requestBody: { type: 'user', role: 'writer', emailAddress: email },
    });
    this.logger.info(`Shared spreadsheet ${newId} with ${email}`);

    return newId;
  }

  async deleteSpreadsheet(): Promise<void> {
    try {
      await this.drive.files.delete({ fileId: this.spreadsheetId });
      this.logger.info(`Deleted spreadsheet file: ${this.spreadsheetId}`);
    } catch (err: any) {
      const status = err.code ?? err.response?.status;
      if (status === 404) {
        this.logger.warn(`Spreadsheet not found: ${this.spreadsheetId}`);
      } else {
        this.logger.error(`Failed to delete spreadsheet: ${err.message}`);
        throw err;
      }
    }
  }

  async getSheetNames(): Promise<string[]> {
    const meta = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });
    return meta.data.sheets.map((s) => s.properties.title);
  }

  async getData<T>(range: string, type: ClassConstructor<T>): Promise<T[]> {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range,
    });
    const allValues = res.data.values || [];

    if (allValues.length < 2) return [];
    const [headers, ...rows] = allValues as [string[], any[][]];

    const result = rows.map((row) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        obj[h] = row[idx];
      });
      return plainToInstance(type, obj);
    });

    this.logger.info(`Fetched ${rows.length} data rows from ${range}`);
    return result;
  }

  async writeRows(range: string, data: Record<string, any>[]): Promise<void> {
    if (!data.length) return;

    const values = this.convertToSheetValue(data, { includeHeaders: true });

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values },
    });
    this.logger.info(`Updated ${values.length - 1} data rows at ${range}`);
  }

  async appendRows(range: string, data: Record<string, any>[]): Promise<void> {
    if (!data.length) return;

    const values = this.convertToSheetValue(data);

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
    this.logger.info(`Appended ${values.length} rows to ${range}`);
  }

  async addSheet(title: string): Promise<number> {
    const res = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    const sheetId = res.data.replies?.[0].addSheet?.properties?.sheetId;
    this.logger.info(`Added sheet "${title}" with ID ${sheetId}`);
    return sheetId;
  }

  /**
   * 주어진 spreadsheetId(또는 this.spreadsheetId)가
   * 존재‧접근 가능한지 확인한다.
   *
   * @param spreadsheetId - 검사할 Google Sheet ID
   * @returns true  → 존재 & 권한 OK
   *          false → 404 (존재하지 않음) or 403 (권한 없음)
   * @throws  기타 오류(네트워크 등)는 그대로 throw
   */
  async isSpreadsheetExists(): Promise<boolean> {
    if (!this.spreadsheetId) {
      this.logger.warn('isSpreadsheetExists: spreadsheetId is empty');
      return false;
    }

    try {
      // Drive API를 이용해 메타데이터 조회(성공 시 200)
      await this.drive.files.get({
        fileId: this.spreadsheetId,
        fields: 'id', // 최소 필드만 요청해 트래픽 절감
        supportsAllDrives: false,
      });
      return true;
    } catch (err: any) {
      const status = err?.response?.status as number | undefined;

      // 404: 존재하지 않음, 403: 권한 없음 → false 로 처리
      if (status === 404 || status === 403) {
        this.logger.debug(
          `Spreadsheet ${this.spreadsheetId} not accessible (status: ${status})`,
        );
        return false;
      }

      // 그 외 오류는 상위에서 판단하도록 throw
      this.logger.error(
        `isSpreadsheetExists: unexpected error for ${this.spreadsheetId}`,
        err,
      );
      throw err;
    }
  }

  private convertToSheetValue(
    data: Record<string, any>[],
    option: convertToSheetValueOption = {
      includeHeaders: false,
      defaultValue: '',
    },
  ): any[][] {
    if (!data.length) return [];

    const headers = Object.keys(data[0]);
    const value = data.map((item) =>
      headers.map((key) => item[key] ?? option.defaultValue),
    );

    return option.includeHeaders ? [headers, ...value] : value;
  }
}
