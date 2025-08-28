import { HttpStatus } from '@nestjs/common';

export enum ServiceErrorCode {
  NOT_FOUND_DATA = 'NOT_FOUND_DATA',
  UNAUTHORIZED = 'UNAUTHORIZED',
  CONFLICT = 'CONFLICT',
  FORBIDDEN = 'FORBIDDEN',
  GONE = 'GONE',
  BAD_REQUEST = 'BAD_REQUEST',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}

export const ServiceErrorStatus: { [key in ServiceErrorCode]: HttpStatus } = {
  [ServiceErrorCode.NOT_FOUND_DATA]: HttpStatus.NOT_FOUND,
  [ServiceErrorCode.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [ServiceErrorCode.CONFLICT]: HttpStatus.CONFLICT,
  [ServiceErrorCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ServiceErrorCode.GONE]: HttpStatus.GONE,
  [ServiceErrorCode.BAD_REQUEST]: HttpStatus.BAD_REQUEST,
  [ServiceErrorCode.INTERNAL_SERVER_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
};
