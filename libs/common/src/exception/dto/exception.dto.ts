import { HttpStatus } from '@nestjs/common';

export enum ServiceErrorCode {
  NOT_FOUND_DATA = 'NOT_FOUND_DATA',
  UNAUTHORIZED = 'UNAUTHORIZED',
  CONFLICT = 'CONFLICT',
  /**
   * SNS 로 가입된 이메일이라 이메일 회원가입을 진행할 수 없다.
   * CONFLICT(409) 와 상태 코드는 같지만, 클라이언트가 'SNS 로 로그인하세요' 로
   * 안내를 갈라야 하므로 코드를 따로 둔다. 메시지 문구로 분기하면 문구를
   * 다듬는 순간 클라이언트가 깨진다.
   */
  SNS_JOINED = 'SNS_JOINED',
  FORBIDDEN = 'FORBIDDEN',
  GONE = 'GONE',
  BAD_REQUEST = 'BAD_REQUEST',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}

export const ServiceErrorStatus: { [key in ServiceErrorCode]: HttpStatus } = {
  [ServiceErrorCode.NOT_FOUND_DATA]: HttpStatus.NOT_FOUND,
  [ServiceErrorCode.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [ServiceErrorCode.CONFLICT]: HttpStatus.CONFLICT,
  [ServiceErrorCode.SNS_JOINED]: HttpStatus.CONFLICT,
  [ServiceErrorCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ServiceErrorCode.GONE]: HttpStatus.GONE,
  [ServiceErrorCode.BAD_REQUEST]: HttpStatus.BAD_REQUEST,
  [ServiceErrorCode.INTERNAL_SERVER_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
};
