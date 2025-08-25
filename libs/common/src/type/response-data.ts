export class ResponseDataDto<T> {
  data: T;
  result: boolean;
  constructor(data: T, result = true) {
    this.data = data;
    this.result = result;
  }
}
